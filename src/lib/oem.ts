/**
 * OEM-коды товара (колонка `origin_code`).
 *
 * У одной детали бывает несколько OEM-номеров — в Excel они идут в одной
 * ячейке через «/»: «8200768913 / 7701477028 / 8200036147». В базе они так и
 * лежат одной строкой через «/», а показываются по-разному:
 *   - первый код — «главный»: он на карточке товара, в инвойсе, в списках;
 *   - все коды по порядку, включая первый, — на странице товара под фото.
 *
 * Поиск по `origin_code.ilike` находит товар по любому из кодов, потому что
 * они все в одной строке.
 */

/** Все коды по порядку, без пробелов вокруг и без повторов. */
export function oemCodes(raw: string | null | undefined): string[] {
  if (!raw) return [];
  const seen = new Set<string>();
  const codes: string[] = [];
  for (const part of raw.split("/")) {
    const code = part.trim();
    const key = code.toLowerCase();
    if (!code || seen.has(key)) continue;
    seen.add(key);
    codes.push(code);
  }
  return codes;
}

/** Как хранить в базе: коды через «/» без пробелов, или null, если кодов нет. */
export function normalizeOem(raw: string | null | undefined): string | null {
  const codes = oemCodes(raw);
  return codes.length > 0 ? codes.join("/") : null;
}

/** Главный (первый) код — для карточки, инвойса и списков. */
export function primaryOem(raw: string | null | undefined): string {
  return oemCodes(raw)[0] ?? "";
}

/** Объединяет два набора кодов: сначала коды из `a`, затем новые из `b`. */
export function mergeOem(a: string | null | undefined, b: string | null | undefined): string | null {
  return normalizeOem([a, b].filter(Boolean).join("/"));
}
