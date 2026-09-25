/** One vehicle a part fits. A part can fit several at once — a MAZDA 6 and a
 * BMW G30, say — so a product carries a list of these. */
export type Fitment = {
  make: string;
  model: string;
  yearFrom: number;
  yearTo: number;
};

/** Make used when a part isn't tied to any particular vehicle. */
export const UNIVERSAL_MAKE = "universal";

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

/** A year field of the admin form holds a range per vehicle ("2002-2015"), or
 * a single year for a part that fits one model-year. The first 4-digit run is
 * the start and the next one, if any, the end. */
function parseYearRange(raw: string): { yearFrom?: number; yearTo?: number } {
  const match = raw.match(/(\d{4})(?:\D+(\d{4}))?/);
  if (!match) return {};
  const yearFrom = Number(match[1]);
  return { yearFrom, yearTo: match[2] ? Number(match[2]) : yearFrom };
}

/** Pairs the n-th make with the n-th group of models and the n-th years, one
 * vehicle per model in the group.
 *
 * A make or year left out carries over from the vehicle before it — "BMW" with
 * models "G30;F10" is a BMW G30 and a BMW F10, and one year range covers every
 * make named. A make with no models of its own is kept as a make-only vehicle:
 * the make filter still finds it, the model filter simply doesn't. */
function assemble(
  makes: string[],
  modelGroups: string[][],
  yearsFrom: (number | undefined)[],
  yearsTo: (number | undefined)[],
  defaults: { yearFrom: number; yearTo: number }
): Fitment[] {
  const count = Math.max(1, makes.length, modelGroups.length, yearsFrom.length, yearsTo.length);
  const fitments: Fitment[] = [];
  const seen = new Set<string>();
  let make = UNIVERSAL_MAKE;
  let yearFrom = defaults.yearFrom;
  let yearTo = defaults.yearTo;
  for (let i = 0; i < count; i++) {
    make = makes[i] || make;
    yearFrom = yearsFrom[i] ?? yearFrom;
    yearTo = yearsTo[i] ?? yearTo;
    const group = modelGroups[i]?.filter(Boolean);
    for (const model of group && group.length > 0 ? group : [""]) {
      const fitment = { make, model, yearFrom, yearTo };
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
 *     Модель: PRIUS V/PRIUS C//G30/X5
 *     Год:    2000:2002
 *
 * "/" in the make cell separates makes. In the model cell "//" closes one
 * make's group of models while a single "/" separates the models inside it, so
 * the row above is a Toyota Prius V, a Toyota Prius C, a BMW G30 and a BMW X5 —
 * all of them 2000-2002, because one year range covers every make.
 *
 * Years come either from that one column ("Год": "2000:2002//2010:2015", a
 * range per make group) or from two columns of their own ("Год от" 2010;2016
 * and "Год до" 2015;2020), whichever the file was mapped with. A bare "2000"
 * in the single column is that one model year, the way it reads in the form;
 * in the two-column form a missing "Год до" still falls back to `defaults`.
 *
 * Counts don't have to match. More makes than groups leaves the extra makes
 * without a model ("AUDI/VW/SKODA" + "A4//PASSAT" keeps SKODA as a make-only
 * vehicle); more groups than makes hands the extra groups to the last make.
 */
export function fitmentsFromImport(
  raw: { make?: string; model?: string; years?: string; yearFrom?: string; yearTo?: string },
  defaults: { yearFrom: number; yearTo: number }
): Fitment[] {
  const ranges = raw.years?.trim()
    ? splitList(raw.years, IMPORT_GROUP_SEPARATOR).map(parseYearRange)
    : [];
  return assemble(
    splitList(raw.make, IMPORT_MAKE_SEPARATOR),
    splitList(raw.model, IMPORT_GROUP_SEPARATOR).map((group) =>
      group.split("/").map((model) => model.trim())
    ),
    ranges.length > 0
      ? ranges.map((range) => range.yearFrom)
      : splitList(raw.yearFrom, IMPORT_GROUP_SEPARATOR).map(firstYear),
    ranges.length > 0
      ? ranges.map((range) => range.yearTo)
      : splitList(raw.yearTo, IMPORT_GROUP_SEPARATOR).map(firstYear),
    defaults
  );
}

/** Vehicles from the admin form, whose one year field holds a range per
 * vehicle: "2010-2015; 2016-2020". Null when it names no year at all. */
export function fitmentsFromForm(raw: { make: string; model: string; years: string }): Fitment[] | null {
  const ranges = splitList(raw.years).map(parseYearRange);
  const first = ranges.find((range) => range.yearFrom !== undefined);
  if (!first) return null;
  return assemble(
    splitList(raw.make),
    // The form gives one model per vehicle, so every group holds just that one.
    splitList(raw.model).map((model) => [model]),
    ranges.map((range) => range.yearFrom),
    ranges.map((range) => range.yearTo),
    { yearFrom: first.yearFrom!, yearTo: first.yearTo! }
  );
}

function joinList(values: string[]): string {
  // One value that every vehicle shares is written once — it carries over.
  return values.every((value) => value === values[0]) ? values[0] ?? "" : values.join("; ");
}

/** The vehicles written back out the way a person types them — for the admin
 * form's fields, and for merging an import into what a product already has. */
export function fitmentsToFields(fitments: Fitment[]): {
  make: string;
  model: string;
  years: string;
  yearFrom: string;
  yearTo: string;
} {
  const models = fitments.map((f) => f.model);
  return {
    make: joinList(fitments.map((f) => f.make)),
    model: models.some(Boolean) ? models.join("; ") : "",
    years: joinList(
      fitments.map((f) => (f.yearFrom === f.yearTo ? String(f.yearFrom) : `${f.yearFrom}-${f.yearTo}`))
    ),
    yearFrom: joinList(fitments.map((f) => String(f.yearFrom))),
    yearTo: joinList(fitments.map((f) => String(f.yearTo))),
  };
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean)));
}

/** The product columns a list of vehicles is stored in. `fitments` is what the
 * site filters on; make/model keep every make and model as plain text for the
 * search box, and the years span them all, for the year filter. */
export function fitmentColumns(fitments: Fitment[]) {
  return {
    fitments,
    make: unique(fitments.map((f) => f.make)).join("; ") || UNIVERSAL_MAKE,
    model: unique(fitments.map((f) => f.model)).join("; ") || null,
    year_from: Math.min(...fitments.map((f) => f.yearFrom)),
    year_to: Math.max(...fitments.map((f) => f.yearTo)),
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
  return [{ make: row.make, model: row.model ?? "", yearFrom: row.yearFrom, yearTo: row.yearTo }];
}
