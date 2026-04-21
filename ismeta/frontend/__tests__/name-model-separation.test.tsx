import { describe, expect, it } from "vitest";

import {
  techSpecsSubLabel,
  techSpecsTitle,
} from "@/components/estimate/tech-specs";

describe("techSpecsSubLabel", () => {
  it("brand + model_name → 'brand · model_name'", () => {
    expect(
      techSpecsSubLabel({ brand: "Korf", model_name: "WNK 100/1" }),
    ).toBe("Korf · WNK 100/1");
  });

  it("только brand → 'brand' без разделителя", () => {
    expect(techSpecsSubLabel({ brand: "Korf" })).toBe("Korf");
  });

  it("только model_name → 'model_name' без разделителя", () => {
    expect(techSpecsSubLabel({ model_name: "WNK 100/1" })).toBe("WNK 100/1");
  });

  it("пустые/отсутствующие/мусор → null", () => {
    expect(techSpecsSubLabel({})).toBeNull();
    expect(techSpecsSubLabel(null)).toBeNull();
    expect(techSpecsSubLabel(undefined)).toBeNull();
    expect(techSpecsSubLabel({ brand: "   ", model_name: "" })).toBeNull();
    expect(techSpecsSubLabel({ brand: 42, model_name: null })).toBeNull();
  });

  it("триммит пробелы и учитывает только непустые части", () => {
    expect(techSpecsSubLabel({ brand: "  Korf  ", model_name: "" })).toBe(
      "Korf",
    );
    expect(techSpecsSubLabel({ brand: "", model_name: "  WNK  " })).toBe(
      "WNK",
    );
  });
});

describe("techSpecsTitle", () => {
  it("формирует multiline 'k: v' по всем строковым/числовым значениям", () => {
    const t = techSpecsTitle({
      brand: "Korf",
      model_name: "WNK 100/1",
      flow: "2600 м³/ч",
      power: 1.5,
    });
    expect(t).toBeDefined();
    expect(t).toContain("brand: Korf");
    expect(t).toContain("model_name: WNK 100/1");
    expect(t).toContain("flow: 2600 м³/ч");
    expect(t).toContain("power: 1.5");
    expect(t!.split("\n").length).toBe(4);
  });

  it("пустой / без валидных полей → undefined", () => {
    expect(techSpecsTitle({})).toBeUndefined();
    expect(techSpecsTitle(null)).toBeUndefined();
    expect(techSpecsTitle({ brand: "", model_name: "   " })).toBeUndefined();
  });

  it("игнорирует null, undefined и объекты", () => {
    const t = techSpecsTitle({
      brand: "Korf",
      model_name: null,
      extra: undefined,
      nested: { a: 1 },
    });
    expect(t).toBe("brand: Korf");
  });
});
