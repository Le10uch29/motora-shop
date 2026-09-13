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

/** Reads one attribute out of a single XML tag. */
function attr(tag: string, name: string): string | undefined {
  return new RegExp(`\\b${name}="([^"]*)"`).exec(tag)?.[1];
}

function intAttr(tag: string, name: string): number | undefined {
  const raw = attr(tag, name);
  if (raw === undefined || raw === "") return undefined;
  const value = Number(raw);
  return Number.isInteger(value) ? value : undefined;
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

function relsPathFor(partPath: string): string {
  return partPath.replace(/^(.*)\/([^/]+)$/, "$1/_rels/$2.rels");
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
    const id = attr(tag, "Id");
    const target = attr(tag, "Target");
    if (!id || !target) continue;
    // External targets are links, not embedded files — not our business here.
    if (/\bTargetMode="External"/.test(tag) || /^https?:/i.test(target)) continue;
    result.set(id, resolveRelative(basedir, target));
  }
  return result;
}

/** The worksheet the importer reads is the workbook's first one, so pictures
 * have to be looked for in that same sheet. The archive's file names don't say
 * which that is — sheet3.xml can perfectly well be the first tab — so the
 * order declared in workbook.xml decides, with the file names as a fallback
 * for a workbook that doesn't spell its relationships out. */
function firstSheetPath(files: Record<string, Uint8Array>): string | undefined {
  const workbook = files["xl/workbook.xml"];
  if (workbook) {
    const firstSheet = /<sheet\b[^>]*>/.exec(decodeText(workbook))?.[0];
    const relationshipId = firstSheet ? attr(firstSheet, "r:id") : undefined;
    const target = relationshipId
      ? readRelationships(files, "xl/_rels/workbook.xml.rels").get(relationshipId)
      : undefined;
    if (target && files[target]) return target;
  }
  return Object.keys(files)
    .filter((path) => /^xl\/worksheets\/sheet\d+\.xml$/.test(path))
    .sort()[0];
}

/**
 * Pictures floating over the sheet — the classic "insert a picture" kind.
 *
 * The bytes live in xl/media/, while their position is described in a separate
 * drawing part: each anchor in xl/drawings/*.xml carries the row it starts at
 * plus a relationship id, and that id resolves through xl/drawings/_rels/*.rels
 * to the file in xl/media/.
 */
function floatingImages(
  files: Record<string, Uint8Array>,
  sheetPath: string
): EmbeddedImage[] {
  const sheetRels = readRelationships(files, relsPathFor(sheetPath));
  const images: EmbeddedImage[] = [];

  for (const drawingPath of sheetRels.values()) {
    if (!drawingPath.startsWith("xl/drawings/")) continue;
    const drawingXml = files[drawingPath];
    if (!drawingXml) continue;

    const drawingRels = readRelationships(files, relsPathFor(drawingPath));

    // Every anchor kind (one-cell, two-cell, absolute) opens with a <xdr:from>
    // holding the row, and carries the picture's relationship id further in.
    for (const anchor of decodeText(drawingXml).split(
      /<xdr:(?=oneCellAnchor|twoCellAnchor|absoluteAnchor)/
    )) {
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

/** Picture files behind the rich values, in the order the rich-value parts
 * refer to them (xl/richData/richValueRel.xml). */
function richValueMedia(files: Record<string, Uint8Array>): string[] {
  const raw = files["xl/richData/richValueRel.xml"];
  if (!raw) return [];
  const rels = readRelationships(files, "xl/richData/_rels/richValueRel.xml.rels");
  return Array.from(decodeText(raw).matchAll(/<rel\b[^>]*>/g)).map((match) => {
    const id = attr(match[0], "r:id");
    return (id && rels.get(id)) || "";
  });
}

/** Rich value index -> index into {@link richValueMedia}.
 *
 * A rich value is a list of anonymous <v> entries whose meaning comes from the
 * structure it names; the one holding the picture is the key marked "_rvRel:",
 * so the structures are read first to know which entry to take. */
function richValuePictureRefs(files: Record<string, Uint8Array>): number[] {
  const raw = files["xl/richData/rdrichvalue.xml"];
  if (!raw) return [];

  const structureXml = files["xl/richData/rdrichvaluestructure.xml"];
  const pictureKeyByStructure = structureXml
    ? Array.from(decodeText(structureXml).matchAll(/<s\b[^>]*>([\s\S]*?)<\/s>/g)).map(
        (structure) => {
          const keys = Array.from(structure[1].matchAll(/<k\b[^>]*>/g)).map(
            (key) => attr(key[0], "n") ?? ""
          );
          const index = keys.findIndex((name) => name.startsWith("_rvRel:"));
          return index === -1 ? 0 : index;
        }
      )
    : [];

  return Array.from(decodeText(raw).matchAll(/<rv\b([^>]*)>([\s\S]*?)<\/rv>/g)).map(
    (richValue) => {
      const structure = intAttr(`<rv${richValue[1]}>`, "s") ?? 0;
      const position = pictureKeyByStructure[structure] ?? 0;
      const values = Array.from(richValue[2].matchAll(/<v>([\s\S]*?)<\/v>/g));
      const value = Number(values[position]?.[1]);
      return Number.isInteger(value) ? value : -1;
    }
  );
}

/** Cell metadata index (as written in a cell's vm attribute, 1-based) ->
 * rich value index. */
function richValueByCellMetadata(files: Record<string, Uint8Array>): number[] {
  const raw = files["xl/metadata.xml"];
  if (!raw) return [];
  const xml = decodeText(raw);

  const types = Array.from(xml.matchAll(/<metadataType\b[^>]*>/g)).map(
    (match) => attr(match[0], "name") ?? ""
  );
  // Metadata types are referenced by their 1-based position in this list.
  const richValueType = types.indexOf("XLRICHVALUE") + 1;

  const futureBlock =
    /<futureMetadata\b[^>]*name="XLRICHVALUE"[^>]*>([\s\S]*?)<\/futureMetadata>/.exec(
      xml
    )?.[1] ?? "";
  const richValueByFutureIndex = Array.from(
    futureBlock.matchAll(/<(?:\w+:)?rvb\b[^>]*>/g)
  ).map((match) => intAttr(match[0], "i") ?? -1);

  const valueBlock =
    /<valueMetadata\b[^>]*>([\s\S]*?)<\/valueMetadata>/.exec(xml)?.[1] ?? "";
  return Array.from(valueBlock.matchAll(/<bk>([\s\S]*?)<\/bk>/g)).map((block) => {
    const record = /<rc\b[^>]*>/.exec(block[1])?.[0];
    if (!record) return -1;
    const type = intAttr(record, "t");
    const value = intAttr(record, "v");
    if (value === undefined) return -1;
    if (richValueType && type !== richValueType) return -1;
    return richValueByFutureIndex[value] ?? value;
  });
}

/**
 * Pictures put *inside* cells — what Excel's "Place in cell" does, and what
 * comes out of a photo pasted straight onto a product row.
 *
 * These aren't drawings at all: the cell holds an error value plus a `vm`
 * pointer, and the actual picture is found by walking cell metadata -> rich
 * value -> rich value relationship -> xl/media. The row comes from the cell's
 * own reference, so it's exact.
 */
function inCellImages(
  files: Record<string, Uint8Array>,
  sheetPath: string
): EmbeddedImage[] {
  const media = richValueMedia(files);
  if (media.length === 0) return [];

  const pictureRefs = richValuePictureRefs(files);
  const richValues = richValueByCellMetadata(files);
  const sheetXml = files[sheetPath];
  if (!sheetXml) return [];

  const images: EmbeddedImage[] = [];
  for (const match of decodeText(sheetXml).matchAll(/<c\b[^>]*>/g)) {
    const tag = match[0];
    const metadataIndex = intAttr(tag, "vm");
    const reference = attr(tag, "r");
    if (metadataIndex === undefined || metadataIndex < 1 || !reference) continue;

    const rowNumber = Number(/\d+$/.exec(reference)?.[0]);
    if (!Number.isInteger(rowNumber) || rowNumber < 1) continue;

    const richValue = richValues[metadataIndex - 1];
    const mediaPath = media[pictureRefs[richValue] ?? -1];
    const bytes = mediaPath ? files[mediaPath] : undefined;
    if (!mediaPath || !bytes) continue;

    images.push({
      sheetRow: rowNumber - 1,
      fileName: mediaPath.split("/").pop() ?? "image",
      contentType: contentTypeFor(mediaPath),
      bytes,
    });
  }

  return images;
}

/**
 * Pulls the pictures embedded in the first worksheet of an .xlsx file out of
 * the file itself, each tied to the row it sits on.
 *
 * An .xlsx is a ZIP, and it can hold pictures in two quite different ways:
 * floating over the sheet, or placed inside a cell. Neither the sheet's cells
 * nor SheetJS's parsed output mention either of them, which is why a
 * spreadsheet full of photos imports as a spreadsheet with no photos unless
 * they're read separately, like here. Both kinds are collected.
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

  const sheetPath = firstSheetPath(files);
  if (!sheetPath) return [];

  try {
    return [...inCellImages(files, sheetPath), ...floatingImages(files, sheetPath)];
  } catch {
    return [];
  }
}
