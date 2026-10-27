import { describe, expect, it } from "vitest";
import {
  OPEN_YEAR_FROM,
  OPEN_YEAR_TO,
  fitmentColumns,
  fitmentEngines,
  fitmentsFromForm,
  fitmentsFromImport,
  fitmentsOf,
  fitmentsToFields,
  splitModelAndDescription,
  type Fitment,
} from "./fitments";

describe("fitmentsFromImport", () => {
  it("splits makes by '/', model groups by '//', and shares one year range", () => {
    const fitments = fitmentsFromImport({
      make: "TOYOTA/BMW",
      model: "PRIUS V/PRIUS C//G30/X5 (3,0-4,4)",
      years: "2000:2002",
    });
    expect(fitments).toEqual([
      { make: "TOYOTA", model: "PRIUS V", yearFrom: 2000, yearTo: 2002 },
      { make: "TOYOTA", model: "PRIUS C", yearFrom: 2000, yearTo: 2002 },
      // Скобки только у последней модели группы — двигатели всей группы.
      { make: "BMW", model: "G30", yearFrom: 2000, yearTo: 2002, engines: ["3,0", "4,4"] },
      { make: "BMW", model: "X5", yearFrom: 2000, yearTo: 2002, engines: ["3,0", "4,4"] },
    ]);
  });

  it("drops everything after '///' from the vehicles", () => {
    expect(fitmentsFromImport({ make: "OPEL", model: "ASTRA H///1,6" })).toEqual([
      { make: "OPEL", model: "ASTRA H", yearFrom: null, yearTo: null },
    ]);
  });

  describe("years", () => {
    const years = (raw: string) => {
      const [f] = fitmentsFromImport({ make: "BMW", model: "X5", years: raw });
      return [f.yearFrom, f.yearTo];
    };

    it("reads a closed range with '-' or ':'", () => {
      expect(years("2002-2015")).toEqual([2002, 2015]);
      expect(years("2002:2015")).toEqual([2002, 2015]);
    });

    it("treats '2012+' and a bare start year as open-ended", () => {
      expect(years("2012+")).toEqual([2012, null]);
      expect(years("2012")).toEqual([2012, null]);
    });

    it("reads 'до 2015' as an upper bound only", () => {
      expect(years("до 2015")).toEqual([null, 2015]);
    });

    it("reads '—' as explicitly unknown", () => {
      expect(years("—")).toEqual([null, null]);
    });

    it("leaves the year unknown when the cell is empty", () => {
      expect(years("")).toEqual([null, null]);
      expect(fitmentsFromImport({ make: "BMW", model: "X5" })[0]).toMatchObject({
        yearFrom: null,
        yearTo: null,
      });
    });

    it("gives every make group its own range, a new start not inheriting the old end", () => {
      const fitments = fitmentsFromImport({
        make: "TOYOTA/BMW",
        model: "PRIUS//X5",
        years: "2000-2005//2012",
      });
      expect(fitments.map((f) => [f.yearFrom, f.yearTo])).toEqual([
        [2000, 2005],
        [2012, null],
      ]);
    });

    it("reads separate 'year from' and 'year to' columns, a missing end staying open", () => {
      const fitments = fitmentsFromImport({
        make: "AUDI/VW",
        model: "A4//PASSAT",
        yearFrom: "2010//2016",
        yearTo: "2015",
      });
      expect(fitments.map((f) => [f.yearFrom, f.yearTo])).toEqual([
        [2010, 2015],
        [2016, null],
      ]);
    });
  });

  it("keeps extra makes as make-only vehicles", () => {
    expect(fitmentsFromImport({ make: "AUDI/VW/SKODA", model: "A4//PASSAT" })).toEqual([
      { make: "AUDI", model: "A4", yearFrom: null, yearTo: null },
      { make: "VW", model: "PASSAT", yearFrom: null, yearTo: null },
      { make: "SKODA", model: "", yearFrom: null, yearTo: null },
    ]);
  });

  it("hands extra model groups to the last make", () => {
    expect(fitmentsFromImport({ make: "BMW", model: "X5//X6" }).map((f) => [f.make, f.model])).toEqual([
      ["BMW", "X5"],
      ["BMW", "X6"],
    ]);
  });

  it("drops duplicate vehicles, ignoring case", () => {
    expect(fitmentsFromImport({ make: "BMW", model: "X5/x5/X5" })).toEqual([
      { make: "BMW", model: "X5", yearFrom: null, yearTo: null },
    ]);
  });

  it("gives each model its own engines when several models carry brackets", () => {
    const fitments = fitmentsFromImport({ make: "BMW", model: "F10 (4,4)/GT (3,0)" });
    expect(fitments.map((f) => [f.model, f.engines])).toEqual([
      ["F10", ["4,4"]],
      ["GT", ["3,0"]],
    ]);
  });

  it("spreads one group's engines over all its models, in model order", () => {
    const fitments = fitmentsFromImport({ make: "BMW", model: "F10/GT/E70 ( 4,4-4,8 N63)" });
    expect(fitmentEngines(fitments)).toEqual([
      "F10 4,4",
      "F10 4,8",
      "GT 4,4",
      "GT 4,8",
      "E70 4,4",
      "E70 4,8",
    ]);
  });

  it("keeps engine codes as text when the brackets hold no volumes", () => {
    expect(fitmentsFromImport({ make: "BMW", model: "X5 (N63/N55)" })[0].engines).toEqual(["N63", "N55"]);
  });

  it("falls back to a universal make when no make is given", () => {
    expect(fitmentsFromImport({})).toEqual([
      { make: "universal", model: "", yearFrom: null, yearTo: null },
    ]);
  });
});

describe("splitModelAndDescription", () => {
  it("splits the model from the description at '///'", () => {
    expect(splitModelAndDescription("ASTRA H///1,6")).toEqual({ model: "ASTRA H", description: "1,6" });
  });

  it("joins further '///' fragments of the description with '; '", () => {
    expect(splitModelAndDescription("ASTRA H///1,6///бензин")).toEqual({
      model: "ASTRA H",
      description: "1,6; бензин",
    });
  });

  it("returns an empty description when there is none", () => {
    expect(splitModelAndDescription("G30//X5")).toEqual({ model: "G30//X5", description: "" });
    expect(splitModelAndDescription(undefined)).toEqual({ model: "", description: "" });
  });
});

describe("fitmentsFromForm", () => {
  it("pairs makes, models and years by position, with engines in brackets", () => {
    expect(
      fitmentsFromForm({ make: "MAZDA; BMW", model: "6; G30 (2,0/3,0)", years: "2010-2015; 2016+" })
    ).toEqual([
      { make: "MAZDA", model: "6", yearFrom: 2010, yearTo: 2015 },
      { make: "BMW", model: "G30", yearFrom: 2016, yearTo: null, engines: ["2,0", "3,0"] },
    ]);
  });

  it("accepts a product with no year at all", () => {
    expect(fitmentsFromForm({ make: "BMW", model: "X5", years: "" })).toEqual([
      { make: "BMW", model: "X5", yearFrom: null, yearTo: null },
    ]);
  });

  it("does not split a form model on '/' — a single model name may contain one", () => {
    expect(fitmentsFromForm({ make: "MERCEDES-BENZ", model: "C/E", years: "" })[0].model).toBe("C/E");
  });
});

describe("fitmentColumns", () => {
  it("joins distinct makes and models and spans the known years", () => {
    const columns = fitmentColumns([
      { make: "BMW", model: "X5", yearFrom: 2010, yearTo: 2015 },
      { make: "BMW", model: "X6", yearFrom: 2008, yearTo: 2012 },
      { make: "AUDI", model: "X5", yearFrom: 2011, yearTo: 2013 },
    ]);
    expect(columns).toMatchObject({ make: "BMW; AUDI", model: "X5; X6", year_from: 2008, year_to: 2015 });
  });

  it("writes open or unknown ends as the widest range", () => {
    expect(fitmentColumns([{ make: "BMW", model: "X5", yearFrom: 2012, yearTo: null }])).toMatchObject({
      year_from: 2012,
      year_to: OPEN_YEAR_TO,
    });
    expect(fitmentColumns([{ make: "BMW", model: "X5", yearFrom: null, yearTo: null }])).toMatchObject({
      year_from: OPEN_YEAR_FROM,
      year_to: OPEN_YEAR_TO,
    });
  });

  it("falls back to a universal make and no model", () => {
    expect(fitmentColumns([{ make: "", model: "", yearFrom: null, yearTo: null }])).toMatchObject({
      make: "universal",
      model: null,
    });
  });
});

describe("fitmentsOf", () => {
  it("returns stored fitments as they are", () => {
    const stored: Fitment[] = [{ make: "BMW", model: "X5", yearFrom: 2010, yearTo: 2015 }];
    expect(fitmentsOf({ fitments: stored, make: "x", yearFrom: 1, yearTo: 2 })).toBe(stored);
  });

  it("builds one vehicle from the columns of an older row", () => {
    expect(fitmentsOf({ fitments: [], make: "BMW", model: "X5", yearFrom: 2010, yearTo: 2015 })).toEqual([
      { make: "BMW", model: "X5", yearFrom: 2010, yearTo: 2015 },
    ]);
  });

  it("reads the widest-range sentinels back as unknown years", () => {
    expect(
      fitmentsOf({ fitments: null, make: "BMW", model: null, yearFrom: OPEN_YEAR_FROM, yearTo: OPEN_YEAR_TO })
    ).toEqual([{ make: "BMW", model: "", yearFrom: null, yearTo: null }]);
  });
});

describe("fitmentsToFields", () => {
  it("writes shared values once and per-vehicle values joined with '; '", () => {
    expect(
      fitmentsToFields([
        { make: "BMW", model: "X5", yearFrom: 2010, yearTo: 2015 },
        { make: "BMW", model: "X6", yearFrom: 2016, yearTo: null, engines: ["3,0", "4,4"] },
      ])
    ).toEqual({ make: "BMW", model: "X5; X6 (3,0/4,4)", years: "2010-2015; 2016+" });
  });

  it("leaves the year field empty when no vehicle has a year", () => {
    expect(fitmentsToFields([{ make: "BMW", model: "X5", yearFrom: null, yearTo: null }]).years).toBe("");
  });

  it("round-trips through the admin form unchanged", () => {
    const cases: Fitment[][] = [
      fitmentsFromImport({ make: "TOYOTA/BMW", model: "PRIUS V/PRIUS C//G30/X5 (3,0-4,4)", years: "2000:2002" }),
      fitmentsFromImport({ make: "BMW", model: "F10/GT/E70 ( 4,4-4,8 N63)", yearFrom: "2012" }),
      fitmentsFromImport({ make: "TOYOTA/BMW", model: "PRIUS (1,8)//G30 (2,0/3,0)", years: "2000:2005//2012" }),
      [
        { make: "BMW", model: "X5", yearFrom: null, yearTo: 2015 },
        { make: "BMW", model: "X6", yearFrom: 2010, yearTo: 2010 },
      ],
    ];
    for (const fitments of cases) {
      expect(fitmentsFromForm(fitmentsToFields(fitments))).toEqual(fitments);
    }
  });
});
