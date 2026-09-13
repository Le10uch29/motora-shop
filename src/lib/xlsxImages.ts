import { unzipSync } from "fflate";

/** A picture that sits in the spreadsheet itself, tied to the sheet row it was
 * anchored to.
 *
 * `sheetRow` is the row as the file numbers it: 0-based, counting the header
 * and any blank rows. Callers map it onto their own parsed rows — which is why
 * it isn't pre-adjusted here, since parsing usually drops blank rows and would
 * otherwise shift every picture onto the wrong product. */
export type EmbeddedImage = {
  sheetRow: number;
  fileName: string;
  contentType: string;
  bytes: Uint8Array;
};

const CONTENT_TYPE_BY_EXTENSION: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  bmp: "image/bmp",
};

function contentTypeFor(path: string): string {
  const ext = path.split(".").pop()?.toLowerCase() ?? "";
  return CONTENT_TYPE_BY_EXTENSION[ext] ?? "application/octet-stream";
}

function decodeText(bytes: Uint8Array): string {
  return new TextDecoder().decode(bytes);
}

/** Resolves a path from a .rels file (usually "../media/image1.png") against
 * the folder that .rels belongs to, into a path inside the archive. */
function resolveRelative(basedir: string, target: string): string {
  const segments = `${basedir}/${target}`.split("/");
  const out: string[] = [];
  for (const segment of segments) {
    if (segment === "." || segment === "") continue;
    if (segment === "..") out.pop();
    else out.push(segment);
  }
  return out.join("/");
}

/** Maps an .xlsx relationship file to { rId -> resolved archive path }. */
function readRelationships(
  files: Record<string, Uint8Array>,
  relsPath: string
): Map<string, string> {
  const result = new Map<string, string>();
  const raw = files[relsPath];
  if (!raw) return result;

  const basedir = relsPath.replace(/\/_rels\/[^/]+$/, "");
  for (const match of decodeText(raw).matchAll(/<Relationship\b[^>]*>/g)) {
    const tag = match[0];
    const id = /\bId="([^"]+)"/.exec(tag)?.[1];
    const target = /\bTarget="([^"]+)"/.exec(tag)?.[1];
    if (!id || !target) continue;
    // External targets are links, not embedded files — not our business here.
    if (/\bTargetMode="External"/.test(tag) || /^https?:/i.test(target)) continue;
    result.set(id, resolveRelative(basedir, target));
  }
  return result;
}

/**
 * Pulls the pictures embedded in the first worksheet of an .xlsx file out of
 * the file itself, each tied to the row it sits on.
 *
 * An .xlsx is a ZIP. The picture bytes live in xl/media/, while their position
 * is described in a separate drawing part: each anchor in xl/drawings/*.xml
 * carries the row it starts at plus a relationship id, and that id resolves
 * through xl/drawings/_rels/*.rels to the file in xl/media/. Neither the
 * sheet's cells nor SheetJS's parsed output mention any of this, which is why
 * a spreadsheet full of photos imports as a spreadsheet with no photos unless
 * they're read separately, like here.
 *
 * Anything unexpected is skipped rather than thrown: a file with no pictures,
 * an unfamiliar anchor shape or a broken relationship simply yields fewer
 * images, so importing a normal spreadsheet still behaves exactly as before.
 */
export function extractEmbeddedImages(fileBytes: Uint8Array): EmbeddedImage[] {
  let files: Record<string, Uint8Array>;
  try {
    files = unzipSync(fileBytes);
  } catch {
    return [];
  }

  // The sheet SheetJS reads is the workbook's first one, so its drawing is
  // the one to follow.
  const sheetPath = Object.keys(files)
    .filter((path) => /^xl\/worksheets\/sheet\d+\.xml$/.test(path))
    .sort()[0];
  if (!sheetPath) return [];

  const sheetRels = readRelationships(
    files,
    sheetPath.replace(/^(.*)\/([^/]+)$/, "$1/_rels/$2.rels")
  );
  const drawingPaths = Array.from(sheetRels.values()).filter((path) =>
    path.startsWith("xl/drawings/")
  );

  const images: EmbeddedImage[] = [];

  for (const drawingPath of drawingPaths) {
    const drawingXml = files[drawingPath];
    if (!drawingXml) continue;

    const drawingRels = readRelationships(
      files,
      drawingPath.replace(/^(.*)\/([^/]+)$/, "$1/_rels/$2.rels")
    );

    // Every anchor kind (one-cell, two-cell, absolute) opens with a <xdr:from>
    // holding the row, and carries the picture's relationship id further in.
    for (const anchor of decodeText(drawingXml).split(/<xdr:(?=oneCellAnchor|twoCellAnchor|absoluteAnchor)/)) {
      const row = /<xdr:from>[\s\S]*?<xdr:row>(\d+)<\/xdr:row>/.exec(anchor)?.[1];
      const embedId = /r:embed="([^"]+)"/.exec(anchor)?.[1];
      if (row === undefined || !embedId) continue;

      const mediaPath = drawingRels.get(embedId);
      const bytes = mediaPath ? files[mediaPath] : undefined;
      if (!mediaPath || !bytes) continue;

      images.push({
        sheetRow: Number(row),
        fileName: mediaPath.split("/").pop() ?? "image",
        contentType: contentTypeFor(mediaPath),
        bytes,
      });
    }
  }

  return images;
}
