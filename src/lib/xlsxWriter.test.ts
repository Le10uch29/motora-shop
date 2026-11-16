import { describe, expect, it } from "vitest";
import { strFromU8, unzipSync } from "fflate";
import * as XLSX from "xlsx";
import { buildXlsx, columnLetter, escapeXml, sheetName } from "./xlsxWriter";

const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0xff, 0xd9]);

describe("columnLetter", () => {
  it("counts like Excel", () => {
    expect(columnLetter(0)).toBe("A");
    expect(columnLetter(25)).toBe("Z");
    expect(columnLetter(26)).toBe("AA");
    expect(columnLetter(51)).toBe("AZ");
    expect(columnLetter(52)).toBe("BA");
  });
});

describe("escapeXml", () => {
  it("escapes markup and drops characters XML can't hold", () => {
    expect(escapeXml('<a & "b">')).toBe("&lt;a &amp; &quot;b&quot;&gt;");
    expect(escapeXml("a\u0001b\u000bc")).toBe("abc");
    expect(escapeXml("a\nb\tc")).toBe("a\nb\tc");
  });
});

describe("sheetName", () => {
  it("keeps names Excel accepts", () => {
    expect(sheetName("Остатки")).toBe("Остатки");
    expect(sheetName("a/b:c")).toBe("a b c");
    expect(sheetName("x".repeat(40))).toHaveLength(31);
    expect(sheetName("  ")).toBe("Sheet1");
  });
});

describe("buildXlsx", () => {
  const sheet = {
    name: "Остатки",
    columns: [
      { header: "Код", width: 16, kind: "text" as const },
      { header: "Название", width: 40, kind: "text" as const },
      { header: "Остаток", width: 10, kind: "int" as const },
      { header: "Цена", width: 12, kind: "money" as const },
      { header: "Фото", width: 13, kind: "text" as const },
    ],
    rows: [
      ["403.730", "Прокладка ГБЦ — ძრავის შუასადები, Silindr başlığı", 12, 45.5, null],
      ["12-05", '=HYPERLINK("x")', 0, 3, null],
    ],
  };

  it("reads back with the same text, codes kept as text and numbers as numbers", () => {
    const workbook = XLSX.read(buildXlsx(sheet), { type: "array" });
    expect(workbook.SheetNames).toEqual(["Остатки"]);
    const rows = XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets["Остатки"], { header: 1 });
    expect(rows[0]).toEqual(["Код", "Название", "Остаток", "Цена", "Фото"]);
    expect(rows[1]).toEqual(["403.730", "Прокладка ГБЦ — ძრავის შუასადები, Silindr başlığı", 12, 45.5]);
    // Текст, похожий на формулу, остаётся текстом и не выполняется.
    expect(rows[2]).toEqual(["12-05", '=HYPERLINK("x")', 0, 3]);
    expect(workbook.Sheets["Остатки"].B3.f).toBeUndefined();
  });

  it("has no drawing parts without images", () => {
    const files = unzipSync(buildXlsx(sheet));
    expect(Object.keys(files).some((path) => path.includes("drawing"))).toBe(false);
    expect(strFromU8(files["[Content_Types].xml"])).not.toContain("jpeg");
  });

  it("embeds images anchored to their cells", () => {
    const files = unzipSync(
      buildXlsx({
        ...sheet,
        rowHeight: 60,
        images: [
          { row: 0, col: 4, data: JPEG, width: 144, height: 100 },
          { row: 1, col: 4, data: JPEG, width: 50, height: 144 },
        ],
      })
    );
    expect(files["xl/media/image1.jpeg"]).toEqual(JPEG);
    expect(files["xl/media/image2.jpeg"]).toEqual(JPEG);
    const drawing = strFromU8(files["xl/drawings/drawing1.xml"]);
    // Первая картинка — во второй строке листа (под заголовками), колонка E.
    expect(drawing).toContain("<xdr:from><xdr:col>4</xdr:col>");
    expect(drawing).toContain("<xdr:row>1</xdr:row>");
    expect(drawing).toContain("<xdr:row>2</xdr:row>");
    expect(drawing).toContain('r:embed="rId2"');
    expect(strFromU8(files["xl/worksheets/sheet1.xml"])).toContain('<drawing r:id="rId1"/>');
    expect(strFromU8(files["xl/worksheets/sheet1.xml"])).toContain('ht="60" customHeight="1"');
    expect(strFromU8(files["xl/drawings/_rels/drawing1.xml.rels"])).toContain("../media/image2.jpeg");
  });
});
