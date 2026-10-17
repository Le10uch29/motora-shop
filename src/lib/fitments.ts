/** One vehicle a part fits. A part can fit several at once — a MAZDA 6 and a
 * BMW G30, say — so a product carries a list of these.
 *
 * Годы необязательны: null в `yearFrom` и `yearTo` — год не указан (такой
 * пункт нигде не показывается), только `yearFrom` — подходит всем машинам
 * начиная с этого года («2012+»). */
export type Fitment = {
  make: string;
  model: string;
  yearFrom: number | null;
  yearTo: number | null;
  /** Двигатели этой модели — объёмы вроде "4,4", "4,8". Берутся из скобок в
   * ячейке модели: «F10/GT/E70 (4,4-4,8 N63)». */
  engines?: string[];
};

/** Make used when a part isn't tied to any particular vehicle. */
export const UNIVERSAL_MAKE = "universal";

/** Колонки товара year_from / year_to не допускают пустого значения, а фильтр
 * по годам ищет пересечение диапазонов. Неизвестный или открытый конец
 * диапазона пишется туда как самый широкий — товар с годом «2012+» находится
 * при поиске любого года от 2012, а товар без года — при поиске любого. */
export const OPEN_YEAR_FROM = 0;
export const OPEN_YEAR_TO = 9999;

/** Several makes, models or years written in one form field are separated by
 * ";" or ":" — or by a line break (Alt+Enter). This is the admin form's own
 * notation; an imported spreadsheet uses the slash notation below. */
const LIST_SEPARATOR = /\r?\n|[;:\r]/;

/** One vehicle (or one make's whole group of models) apart from the next, in
 * an imported cell: "//" as in "PRIUS V/PRIUS C//G30/X5", or ";" / a line
 * break for a file written in the older notation. ":" is deliberately absent —
 * in a spreadsheet it separates the ends of a year range ("2000:2002"). */
const IMPORT_GROUP_SEPARATOR = /\/{2,}|\r?\n|[;\r]/;

/** Makes in an imported cell: "TOYOTA/LEXUS". A single slash is enough here —
 * unlike models, a make never carries a group of its own. */
const IMPORT_MAKE_SEPARATOR = /\/+|\r?\n|[;\r]/;

/** Three slashes close the vehicles and open the product's description:
 * "ASTRA H///1,6" is an Astra H described as "1,6". Three and not two because
 * "//" already means "next make's models"; a cell is read left to right, so
 * everything past the first "///" is prose, never a vehicle. */
const IMPORT_DESCRIPTION_SEPARATOR = /\/{3,}/;

/** Скобки в ячейке модели — двигатель. Закрывающая скобка необязательна:
 * в прайсах её нередко забывают в конце ячейки. */
const ENGINE_PARENS = /\(([^)]*)(?:\)|$)/g;

/**
 * The vehicle part of a model cell and the description written after it.
 *
 * Price lists carry the engine or a fitting note in the same cell as the
 * model — "ASTRA H///1,6" — and that tail is not a model: left in, it would
 * become a vehicle nobody can filter by and would show up in search as one.
 *
 * Further "///" separate fragments of that description rather than starting
 * another one; they're joined with "; " so no stray slashes survive into the
 * product card.
 */
export function splitModelAndDescription(raw: string | undefined): {
  model: string;
  description: string;
} {
  const parts = (raw ?? "").split(IMPORT_DESCRIPTION_SEPARATOR);
  return {
    model: (parts[0] ?? "").trim(),
    description: parts
      .slice(1)
      .map((part) => part.trim())
      .filter(Boolean)
      .join("; "),
  };
}

/** The entries of one field, in order. Empty entries in the middle are kept so
 * the positions still line up across fields ("6;;G30"); trailing ones are
 * dropped so a stray final ";" doesn't add a vehicle. */
function splitList(raw: string | undefined, separator: RegExp = LIST_SEPARATOR): string[] {
  const items = (raw ?? "").split(separator).map((item) => item.trim());
  while (items.length > 0 && !items[items.length - 1]) items.pop();
  return items;
}

function firstYear(raw: string): number | undefined {
  const match = raw.match(/\d{4}/);
  return match ? Number(match[0]) : undefined;
}

/** Годы одной машины.
 *
 *  - "2002-2015", "2002:2015"  → с 2002 по 2015;
 *  - "2012", "2012+", "2012-"  → с 2012 и дальше (конец открыт);
 *  - "до 2015", "-2015"        → по 2015 включительно;
 *  - "—", "?", "нет"           → год не указан (явно, а не «как у предыдущей»);
 *  - пусто                     → ничего не задано: годы берутся у предыдущей
 *                                машины, как и пропущенная марка. */
function parseYearRange(raw: string): { yearFrom?: number | null; yearTo?: number | null } {
  const text = raw.trim();
  if (!text) return {};
  const upTo = text.match(/^(?:до|to|по|-|–|—)\s*(\d{4})/i);
  if (upTo) return { yearFrom: null, yearTo: Number(upTo[1]) };
  const match = text.match(/(\d{4})(?:\D+(\d{4}))?/);
  if (!match) return { yearFrom: null, yearTo: null };
  return { yearFrom: Number(match[1]), yearTo: match[2] ? Number(match[2]) : null };
}

/** Двигатели из скобок: объёмы ("4,4-4,8 N63" → ["4,4", "4,8"]), а если
 * объёмов нет — сам текст через «/» ("N63/N55" → ["N63", "N55"]). */
function parseEngines(content: string): string[] {
  const volumes = content.match(/\d+[.,]\d+/g);
  const engines = volumes ?? content.split("/").map((part) => part.trim());
  return Array.from(new Set(engines.filter(Boolean)));
}

type ModelEntry = { model: string; engines: string[] };

/** Модель без скобок и двигатели из её скобок. */
function parseModelEntry(raw: string): ModelEntry {
  const engines: string[] = [];
  for (const match of raw.matchAll(ENGINE_PARENS)) engines.push(...parseEngines(match[1]));
  return {
    model: raw.replace(ENGINE_PARENS, "").replace(/\s+/g, " ").trim(),
    engines: Array.from(new Set(engines)),
  };
}

/** Делит по «/», но не внутри скобок: в "F10 (4,4/4,8)/GT" две модели. */
function splitOutsideParens(raw: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let current = "";
  for (const char of raw) {
    if (char === "(") depth++;
    if (char === ")") depth = Math.max(0, depth - 1);
    if (char === "/" && depth === 0) {
      parts.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  parts.push(current);
  return parts;
}

/** Модели одной группы ячейки импорта: "F10/GT/E70 (4,4-4,8 N63)".
 *
 * Скобки только у последней модели группы относятся ко всей группе — так их
 * пишут в прайсах: F10, GT и E70 все получают 4,4 и 4,8. Если скобки стоят у
 * нескольких моделей ("F10 (4,4)/GT (3,0)"), у каждой свои. */
function parseModelGroup(group: string): ModelEntry[] {
  const entries = splitOutsideParens(group).map(parseModelEntry);
  const withEngines = entries.filter((entry) => entry.engines.length > 0);
  const last = entries[entries.length - 1];
  if (entries.length > 1 && withEngines.length === 1 && withEngines[0] === last) {
    return entries.map((entry) => ({ ...entry, engines: last.engines }));
  }
  return entries;
}

/** Pairs the n-th make with the n-th group of models and the n-th years, one
 * vehicle per model in the group.
 *
 * A make or year left out (undefined) carries over from the vehicle before it —
 * "BMW" with models "G30;F10" is a BMW G30 and a BMW F10, and one year range
 * covers every make named. null is not "left out": it's an explicit "no year".
 * A make with no models of its own is kept as a make-only vehicle: the make
 * filter still finds it, the model filter simply doesn't. */
function assemble(
  makes: string[],
  modelGroups: ModelEntry[][],
  yearsFrom: (number | null | undefined)[],
  yearsTo: (number | null | undefined)[]
): Fitment[] {
  const count = Math.max(1, makes.length, modelGroups.length, yearsFrom.length, yearsTo.length);
  const fitments: Fitment[] = [];
  const seen = new Set<string>();
  let make = UNIVERSAL_MAKE;
  let yearFrom: number | null = null;
  let yearTo: number | null = null;
  for (let i = 0; i < count; i++) {
    make = makes[i] || make;
    // A new start year with no end of its own is open-ended, not the previous
    // vehicle's end: "2000-2005//2012" is 2000-2005 and then 2012+.
    if (yearsFrom[i] !== undefined) {
      yearFrom = yearsFrom[i]!;
      yearTo = yearsTo[i] === undefined ? null : yearsTo[i]!;
    } else if (yearsTo[i] !== undefined) {
      yearTo = yearsTo[i]!;
    }
    const group = modelGroups[i]?.filter((entry) => entry.model || entry.engines.length > 0);
    for (const entry of group && group.length > 0 ? group : [{ model: "", engines: [] }]) {
      const fitment: Fitment = { make, model: entry.model, yearFrom, yearTo };
      if (entry.engines.length > 0) fitment.engines = entry.engines;
      const key = JSON.stringify(fitment).toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      fitments.push(fitment);
    }
  }
  return fitments;
}

/**
 * Vehicles from an imported spreadsheet row.
 *
 * A price list keeps a part's whole compatibility in three cells, and writes
 * several vehicles into them with slashes:
 *
 *     Марка:  TOYOTA/BMW
 *     Модель: PRIUS V/PRIUS C//G30/X5 (3,0-4,4)
 *     Год:    2000:2002
 *
 * "/" in the make cell separates makes. In the model cell "//" closes one
 * make's group of models while a single "/" separates the models inside it, so
 * the row above is a Toyota Prius V, a Toyota Prius C, a BMW G30 and a BMW X5 —
 * all of them 2000-2002, because one year range covers every make. Скобки в
 * конце группы — двигатели всех её моделей (см. {@link parseModelGroup}).
 *
 * "///" ends the vehicles entirely and starts the product's description:
 * "ASTRA H///1,6" is one Astra H with "1,6" as its description. The tail is
 * dropped here — {@link splitModelAndDescription} is what hands it to the
 * importer, which stores it as the product's description.
 *
 * Years come either from that one column ("Год": "2000:2002//2010:2015", a
 * range per make group) or from two columns of their own ("Год от" 2010;2016
 * and "Год до" 2015;2020), whichever the file was mapped with. Год только с
 * началом ("2012", или «Год от» без «Год до») — подходит всем от этого года.
 * Без года вовсе — год не указан и нигде не показывается.
 *
 * Counts don't have to match. More makes than groups leaves the extra makes
 * without a model ("AUDI/VW/SKODA" + "A4//PASSAT" keeps SKODA as a make-only
 * vehicle); more groups than makes hands the extra groups to the last make.
 */
export function fitmentsFromImport(raw: {
  make?: string;
  model?: string;
  years?: string;
  yearFrom?: string;
  yearTo?: string;
}): Fitment[] {
  const ranges = raw.years?.trim()
    ? splitList(raw.years, IMPORT_GROUP_SEPARATOR).map(parseYearRange)
    : [];
  // Описание отрезается и здесь, а не только у вызывающего: иначе любой, кто
  // передаст сюда исходную ячейку, получит "1,6" отдельной моделью.
  const { model } = splitModelAndDescription(raw.model);
  return assemble(
    splitList(raw.make, IMPORT_MAKE_SEPARATOR),
    splitList(model, IMPORT_GROUP_SEPARATOR).map(parseModelGroup),
    ranges.length > 0
      ? ranges.map((range) => range.yearFrom)
      : splitList(raw.yearFrom, IMPORT_GROUP_SEPARATOR).map(firstYear),
    ranges.length > 0
      ? ranges.map((range) => range.yearTo)
      : splitList(raw.yearTo, IMPORT_GROUP_SEPARATOR).map(firstYear)
  );
}

/** Vehicles from the admin form, whose one year field holds a range per
 * vehicle: "2010-2015; 2016+". Год можно не указывать. Модель пишется с
 * двигателями в скобках: "F10 (4,4/4,8)". */
export function fitmentsFromForm(raw: { make: string; model: string; years: string }): Fitment[] {
  const ranges = splitList(raw.years).map(parseYearRange);
  return assemble(
    splitList(raw.make),
    // The form gives one model per vehicle, so every group holds just that one.
    splitList(raw.model).map((model) => [parseModelEntry(model)]),
    ranges.map((range) => range.yearFrom),
    ranges.map((range) => range.yearTo)
  );
}

function joinList(values: string[]): string {
  // One value that every vehicle shares is written once — it carries over.
  return values.every((value) => value === values[0]) ? values[0] ?? "" : values.join("; ");
}

/** Годы одной машины так, как их пишет человек — и как их читает
 * {@link parseYearRange}: "2002-2015", "2012+", "-2015" или "—". */
function yearsToText(fitment: Fitment): string {
  const { yearFrom, yearTo } = fitment;
  if (yearFrom == null && yearTo == null) return "—";
  if (yearFrom == null) return `-${yearTo}`;
  if (yearTo == null) return `${yearFrom}+`;
  return `${yearFrom}-${yearTo}`;
}

/** Годы для показа: "2002-2015", "2010" (один модельный год), "2012+",
 * "…2015" — или пустая строка, если год не указан (пункт тогда скрывают). */
export function formatFitmentYears(fitment: Pick<Fitment, "yearFrom" | "yearTo">): string {
  const { yearFrom, yearTo } = fitment;
  if (yearFrom == null && yearTo == null) return "";
  if (yearFrom == null) return `…${yearTo}`;
  if (yearTo == null) return `${yearFrom}+`;
  return yearFrom === yearTo ? String(yearFrom) : `${yearFrom}-${yearTo}`;
}

/** Двигатели для показа: «F10 4,4», «F10 4,8», «GT 4,4» … — по порядку машин. */
export function fitmentEngines(fitments: Fitment[]): string[] {
  const values = fitments.flatMap((f) =>
    (f.engines ?? []).map((engine) => `${f.model} ${engine}`.trim())
  );
  return Array.from(new Set(values));
}

/** The vehicles written back out the way a person types them — for the admin
 * form's fields, and for merging an import into what a product already has. */
export function fitmentsToFields(fitments: Fitment[]): {
  make: string;
  model: string;
  years: string;
} {
  const models = fitments.map((f) =>
    f.engines && f.engines.length > 0 ? `${f.model} (${f.engines.join("/")})`.trim() : f.model
  );
  const years = fitments.map(yearsToText);
  return {
    make: joinList(fitments.map((f) => f.make)),
    model: models.some(Boolean) ? models.join("; ") : "",
    // Ни у одной машины года нет — поле остаётся пустым, а не «—».
    years: years.every((y) => y === "—") ? "" : joinList(years),
  };
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean)));
}

/** The product columns a list of vehicles is stored in. `fitments` is what the
 * site filters on; make/model keep every make and model as plain text for the
 * search box, and the years span them all, for the year filter — открытый или
 * неизвестный конец диапазона пишется как самый широкий (OPEN_YEAR_*). */
export function fitmentColumns(fitments: Fitment[]) {
  const froms = fitments.map((f) => f.yearFrom);
  const tos = fitments.map((f) => f.yearTo);
  return {
    fitments,
    make: unique(fitments.map((f) => f.make)).join("; ") || UNIVERSAL_MAKE,
    model: unique(fitments.map((f) => f.model)).join("; ") || null,
    year_from: froms.some((y) => y == null) ? OPEN_YEAR_FROM : Math.min(...(froms as number[])),
    year_to: tos.some((y) => y == null) ? OPEN_YEAR_TO : Math.max(...(tos as number[])),
  };
}

/** A product's vehicles, falling back to its single make/model/years for a row
 * written before `fitments` existed. */
export function fitmentsOf(row: {
  fitments?: Fitment[] | null;
  make: string;
  model?: string | null;
  yearFrom: number;
  yearTo: number;
}): Fitment[] {
  if (row.fitments && row.fitments.length > 0) return row.fitments;
  return [
    {
      make: row.make,
      model: row.model ?? "",
      yearFrom: row.yearFrom <= OPEN_YEAR_FROM ? null : row.yearFrom,
      yearTo: row.yearTo >= OPEN_YEAR_TO ? null : row.yearTo,
    },
  ];
}
