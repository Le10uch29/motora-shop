import { zipSync, strToU8 } from "fflate";

/*
 * Минимальный писатель .xlsx — одна таблица, текст и числа, картинки в ячейках.
 *
 * Зачем свой, а не библиотека: SheetJS (он уже есть в проекте для импорта) в
 * бесплатной версии картинки не пишет, а ради одного экспорта тащить ещё одну
 * тяжёлую библиотеку незачем — формат простой: несколько XML-файлов в zip.
 *
 * И зачем .xlsx, а не CSV: CSV не хранит кодировку, и Excel угадывает её по
 * настройкам Windows — грузинский, азербайджанский, а иногда и русский текст
 * превращался в «иероглифы». В .xlsx текст всегда в UTF-8, Excel читает его
 * одинаково на любом компьютере. Коды вида «403.730» или «12-05» записаны как
 * текст, и Excel не превращает их в число или дату.
 */

export type XlsxCell = string | number | null;

export type XlsxImage = {
  /** Строка данных, считая от 0 (строка заголовков не считается). */
  row: number;
  /** Колонка, считая от 0. */
  col: number;
  /** JPEG. */
  data: Uint8Array;
  /** Размер картинки в пикселях — по нему держатся пропорции. */
  width: number;
  height: number;
};

export type XlsxColumn = {
  header: string;
  /** Ширина в символах, как в Excel. */
  width: number;
  /** money — два знака после запятой, int — целое, text — как есть. */
  kind: "text" | "int" | "money";
};

export type XlsxSheet = {
  name: string;
  columns: XlsxColumn[];
  rows: XlsxCell[][];
  images?: XlsxImage[];
  /** Высота строк данных в пунктах; нужна, когда в строках есть картинки. */
  rowHeight?: number;
};

const NS_MAIN = "http://schemas.openxmlformats.org/spreadsheetml/2006/main";
const NS_REL = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
const NS_PKG_REL = "http://schemas.openxmlformats.org/package/2006/relationships";
const XML_HEAD = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';

/** Сколько EMU (единиц DrawingML) в одном пикселе. */
const EMU_PER_PX = 9525;
/** Отступ картинки от края ячейки, px. */
const IMAGE_PADDING_PX = 4;

/** Символы, которых не может быть в XML 1.0 (управляющие из старых данных),
 * выбрасываются: с ними Excel отказался бы открыть файл. */
export function escapeXml(value: string): string {
  return value
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F￾￿]/g, "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** 0 → A, 25 → Z, 26 → AA. */
export function columnLetter(index: number): string {
  let n = index + 1;
  let letters = "";
  while (n > 0) {
    const rem = (n - 1) % 26;
    letters = String.fromCharCode(65 + rem) + letters;
    n = Math.floor((n - 1) / 26);
  }
  return letters;
}

/** Имя листа: не длиннее 31 символа и без []:*?/\ — иначе Excel чинит файл. */
export function sheetName(value: string): string {
  const cleaned = value.replace(/[[\]:*?/\\]/g, " ").trim().slice(0, 31);
  return cleaned || "Sheet1";
}

/** Ширина колонки Excel (в символах) в пикселях — та же формула, что у Excel
 * для шрифта по умолчанию. */
function columnWidthPx(width: number): number {
  return Math.floor(width * 7 + 5);
}

/** Стили: 0 — обычный, 1 — заголовок, 2 — текст, 3 — целое, 4 — деньги.
 * Всё по центру по вертикали: в строке с картинкой текст не прилипает к низу. */
const STYLE = { header: 1, text: 2, int: 3, money: 4 } as const;

const STYLES_XML =
  XML_HEAD +
  `<styleSheet xmlns="${NS_MAIN}">` +
  '<fonts count="2"><font><sz val="11"/><name val="Calibri"/><family val="2"/></font>' +
  '<font><b/><sz val="11"/><name val="Calibri"/><family val="2"/></font></fonts>' +
  '<fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill>' +
  '<fill><patternFill patternType="solid"><fgColor rgb="FFF4F4F5"/><bgColor indexed="64"/></patternFill></fill></fills>' +
  '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>' +
  '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
  '<cellXfs count="5">' +
  '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>' +
  '<xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf>' +
  '<xf numFmtId="49" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf>' +
  '<xf numFmtId="1" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1" applyAlignment="1"><alignment vertical="center"/></xf>' +
  '<xf numFmtId="2" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1" applyAlignment="1"><alignment vertical="center"/></xf>' +
  "</cellXfs>" +
  '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>' +
  "</styleSheet>";

function cellXml(ref: string, value: XlsxCell, kind: XlsxColumn["kind"]): string {
  if (value === null || value === "") return "";
  if (typeof value === "number" && Number.isFinite(value) && kind !== "text") {
    return `<c r="${ref}" s="${kind === "money" ? STYLE.money : STYLE.int}"><v>${value}</v></c>`;
  }
  const text = escapeXml(String(value));
  return `<c r="${ref}" t="inlineStr" s="${STYLE.text}"><is><t xml:space="preserve">${text}</t></is></c>`;
}

function sheetXml(sheet: XlsxSheet, hasDrawing: boolean): string {
  const cols = sheet.columns
    .map((column, i) => `<col min="${i + 1}" max="${i + 1}" width="${column.width}" customWidth="1"/>`)
    .join("");

  const header =
    '<row r="1" ht="30" customHeight="1">' +
    sheet.columns
      .map(
        (column, i) =>
          `<c r="${columnLetter(i)}1" t="inlineStr" s="${STYLE.header}"><is><t xml:space="preserve">${escapeXml(column.header)}</t></is></c>`
      )
      .join("") +
    "</row>";

  const height = sheet.rowHeight ? ` ht="${sheet.rowHeight}" customHeight="1"` : "";
  const body = sheet.rows
    .map((cells, r) => {
      const rowNumber = r + 2;
      const inner = cells
        .map((value, c) => cellXml(`${columnLetter(c)}${rowNumber}`, value, sheet.columns[c]?.kind ?? "text"))
        .join("");
      return `<row r="${rowNumber}"${height}>${inner}</row>`;
    })
    .join("");

  const lastRef = `${columnLetter(Math.max(0, sheet.columns.length - 1))}${sheet.rows.length + 1}`;

  return (
    XML_HEAD +
    `<worksheet xmlns="${NS_MAIN}" xmlns:r="${NS_REL}">` +
    `<dimension ref="A1:${lastRef}"/>` +
    // Строка заголовков закреплена — при прокрутке видно, где какая колонка.
    '<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>' +
    '<sheetFormatPr defaultRowHeight="15"/>' +
    `<cols>${cols}</cols>` +
    `<sheetData>${header}${body}</sheetData>` +
    (hasDrawing ? '<drawing r:id="rId1"/>' : "") +
    "</worksheet>"
  );
}

function drawingXml(sheet: XlsxSheet, images: XlsxImage[]): string {
  const rowHeightPx = Math.round(((sheet.rowHeight ?? 15) * 96) / 72);
  const anchors = images
    .map((image, i) => {
      const colPx = columnWidthPx(sheet.columns[image.col]?.width ?? 10);
      // Вписываем в ячейку с отступами, сохраняя пропорции.
      const boxW = Math.max(1, colPx - IMAGE_PADDING_PX * 2);
      const boxH = Math.max(1, rowHeightPx - IMAGE_PADDING_PX * 2);
      const scale = Math.min(boxW / image.width, boxH / image.height);
      const w = Math.max(1, Math.round(image.width * scale));
      const h = Math.max(1, Math.round(image.height * scale));
      const offX = IMAGE_PADDING_PX + Math.floor((boxW - w) / 2);
      const offY = IMAGE_PADDING_PX + Math.floor((boxH - h) / 2);
      const row = image.row + 1; // строка 0 в DrawingML — это заголовки
      const id = i + 1;
      // twoCellAnchor editAs="oneCell": картинка привязана к своей ячейке и
      // переезжает вместе со строкой при сортировке и фильтре.
      return (
        '<xdr:twoCellAnchor editAs="oneCell">' +
        `<xdr:from><xdr:col>${image.col}</xdr:col><xdr:colOff>${offX * EMU_PER_PX}</xdr:colOff><xdr:row>${row}</xdr:row><xdr:rowOff>${offY * EMU_PER_PX}</xdr:rowOff></xdr:from>` +
        `<xdr:to><xdr:col>${image.col}</xdr:col><xdr:colOff>${(offX + w) * EMU_PER_PX}</xdr:colOff><xdr:row>${row}</xdr:row><xdr:rowOff>${(offY + h) * EMU_PER_PX}</xdr:rowOff></xdr:to>` +
        "<xdr:pic>" +
        `<xdr:nvPicPr><xdr:cNvPr id="${id + 1}" name="Picture ${id}"/><xdr:cNvPicPr><a:picLocks noChangeAspect="1"/></xdr:cNvPicPr></xdr:nvPicPr>` +
        `<xdr:blipFill><a:blip r:embed="rId${id}"/><a:stretch><a:fillRect/></a:stretch></xdr:blipFill>` +
        `<xdr:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${w * EMU_PER_PX}" cy="${h * EMU_PER_PX}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></xdr:spPr>` +
        "</xdr:pic><xdr:clientData/></xdr:twoCellAnchor>"
      );
    })
    .join("");

  return (
    XML_HEAD +
    '<xdr:wsDr xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing" ' +
    `xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="${NS_REL}">` +
    anchors +
    "</xdr:wsDr>"
  );
}

/** Готовый .xlsx одним массивом байт. */
export function buildXlsx(sheet: XlsxSheet): Uint8Array {
  const images = (sheet.images ?? []).filter(
    (image) => image.data.length > 0 && image.width > 0 && image.height > 0
  );
  const hasDrawing = images.length > 0;

  const files: Record<string, Uint8Array> = {
    "[Content_Types].xml": strToU8(
      XML_HEAD +
        '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
        '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
        '<Default Extension="xml" ContentType="application/xml"/>' +
        (hasDrawing ? '<Default Extension="jpeg" ContentType="image/jpeg"/>' : "") +
        '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
        '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>' +
        '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' +
        (hasDrawing
          ? '<Override PartName="/xl/drawings/drawing1.xml" ContentType="application/vnd.openxmlformats-officedocument.drawing+xml"/>'
          : "") +
        "</Types>"
    ),
    "_rels/.rels": strToU8(
      XML_HEAD +
        `<Relationships xmlns="${NS_PKG_REL}">` +
        `<Relationship Id="rId1" Type="${NS_REL}/officeDocument" Target="xl/workbook.xml"/>` +
        "</Relationships>"
    ),
    "xl/workbook.xml": strToU8(
      XML_HEAD +
        `<workbook xmlns="${NS_MAIN}" xmlns:r="${NS_REL}">` +
        `<sheets><sheet name="${escapeXml(sheetName(sheet.name))}" sheetId="1" r:id="rId1"/></sheets>` +
        "</workbook>"
    ),
    "xl/_rels/workbook.xml.rels": strToU8(
      XML_HEAD +
        `<Relationships xmlns="${NS_PKG_REL}">` +
        `<Relationship Id="rId1" Type="${NS_REL}/worksheet" Target="worksheets/sheet1.xml"/>` +
        `<Relationship Id="rId2" Type="${NS_REL}/styles" Target="styles.xml"/>` +
        "</Relationships>"
    ),
    "xl/styles.xml": strToU8(STYLES_XML),
    "xl/worksheets/sheet1.xml": strToU8(sheetXml(sheet, hasDrawing)),
  };

  if (hasDrawing) {
    files["xl/worksheets/_rels/sheet1.xml.rels"] = strToU8(
      XML_HEAD +
        `<Relationships xmlns="${NS_PKG_REL}">` +
        `<Relationship Id="rId1" Type="${NS_REL}/drawing" Target="../drawings/drawing1.xml"/>` +
        "</Relationships>"
    );
    files["xl/drawings/drawing1.xml"] = strToU8(drawingXml(sheet, images));
    files["xl/drawings/_rels/drawing1.xml.rels"] = strToU8(
      XML_HEAD +
        `<Relationships xmlns="${NS_PKG_REL}">` +
        images
          .map((_, i) => `<Relationship Id="rId${i + 1}" Type="${NS_REL}/image" Target="../media/image${i + 1}.jpeg"/>`)
          .join("") +
        "</Relationships>"
    );
    images.forEach((image, i) => {
      files[`xl/media/image${i + 1}.jpeg`] = image.data;
    });
  }

  // JPEG уже сжат — повторно его не жмём.
  const entries: Record<string, [Uint8Array, { level: 0 | 6 }]> = {};
  for (const [path, data] of Object.entries(files)) {
    entries[path] = [data, { level: path.startsWith("xl/media/") ? 0 : 6 }];
  }
  return zipSync(entries);
}
