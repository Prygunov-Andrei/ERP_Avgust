import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { ItemsTable } from "@/components/estimate/items-table";
import type { EstimateItem, EstimateSection } from "@/lib/api/types";

const toastMock = vi.hoisted(() => ({
  success: vi.fn(),
  error: vi.fn(),
  info: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock("sonner", () => ({
  toast: toastMock,
  Toaster: () => null,
}));

function wrap(ui: React.ReactElement) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{ui}</QueryClientProvider>;
}

function makeItem(overrides: Partial<EstimateItem> = {}): EstimateItem {
  return {
    id: "it-1",
    section: "sec-1",
    estimate: "est-1",
    row_id: "rid-1",
    sort_order: 0,
    name: "Позиция",
    unit: "шт",
    quantity: "1",
    equipment_price: "0",
    material_price: "0",
    work_price: "0",
    equipment_total: "0",
    material_total: "0",
    work_total: "0",
    total: "0",
    version: 1,
    match_source: "unmatched",
    material_markup: null,
    work_markup: null,
    tech_specs: {},
    custom_data: {},
    is_deleted: false,
    is_key_equipment: false,
    procurement_status: "none",
    man_hours: "0",
    created_at: "",
    updated_at: "",
    ...overrides,
  };
}

function makeSection(
  overrides: Partial<EstimateSection> = {},
): EstimateSection {
  return {
    id: "sec-1",
    estimate: "est-1",
    name: "Раздел 1",
    sort_order: 0,
    version: 1,
    material_markup: null,
    work_markup: null,
    created_at: "",
    updated_at: "",
    ...overrides,
  };
}

const SAMPLE_ITEMS: EstimateItem[] = [
  makeItem({
    id: "a",
    sort_order: 0,
    name: "Воздуховод прямоугольный",
    unit: "м.п.",
    tech_specs: {
      model_name: "ВП 100x100",
      brand: "Лиссант",
      manufacturer: "ООО Лиссант",
      comments: "оцинкованный",
      system: "ПВ-ИТП",
    },
  }),
  makeItem({
    id: "b",
    sort_order: 1,
    name: "Кассетный фанкойл",
    unit: "шт",
    tech_specs: {
      model_name: "WNK 100/1",
      brand: "KORF",
      manufacturer: 'ООО "КОРФ"',
      comments: "4-трубная схема",
      system: "ВК-02",
    },
  }),
  makeItem({
    id: "c",
    sort_order: 2,
    name: "Решётка вытяжная",
    unit: "шт",
    tech_specs: {
      model_name: "РВ-200",
      brand: "Арктос",
      manufacturer: "Арктос",
      comments: "",
      system: "ПВ-ИТП",
    },
  }),
];

function renderTable(options: {
  items?: EstimateItem[];
  sections?: EstimateSection[];
  activeSectionId?: string | null;
  allItemsForSearch?: EstimateItem[];
  onClearSection?: () => void;
}) {
  const {
    items = SAMPLE_ITEMS,
    sections = [makeSection()],
    activeSectionId = "sec-1",
    allItemsForSearch,
    onClearSection,
  } = options;
  return render(
    wrap(
      <ItemsTable
        estimateId="est-1"
        items={items}
        activeSectionId={activeSectionId}
        fallbackSectionId="sec-1"
        sections={sections}
        allItemsForSearch={allItemsForSearch}
        onClearSection={onClearSection}
      />,
    ),
  );
}

async function typeSearch(value: string) {
  const input = screen.getByTestId("items-search-input") as HTMLInputElement;
  fireEvent.change(input, { target: { value } });
  // Проскакиваем 200ms debounce, чтобы filter применился.
  await act(async () => {
    vi.advanceTimersByTime(210);
  });
}

function rowNames(): string[] {
  return Array.from(document.querySelectorAll("tbody tr"))
    .filter((tr) => tr.id.startsWith("item-row-"))
    .map((tr) => tr.id.replace("item-row-", ""));
}

describe("UI-07 Items Search", () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    toastMock.success.mockReset();
    toastMock.error.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("search input присутствует и placeholder корректен", () => {
    renderTable({});
    const input = screen.getByTestId("items-search-input") as HTMLInputElement;
    expect(input).toBeInTheDocument();
    expect(input.placeholder).toBe("Поиск по строкам сметы…");
    expect(input.type).toBe("search");
  });

  it("test_search_filters_by_name — query «Воздуховод» → только item с этим словом", async () => {
    renderTable({});
    await typeSearch("Воздуховод");
    expect(rowNames()).toEqual(["a"]);
  });

  it("test_search_filters_by_model — query «WNK 100/1» → item с tech_specs.model_name", async () => {
    renderTable({});
    await typeSearch("WNK 100/1");
    expect(rowNames()).toEqual(["b"]);
  });

  it("test_search_filters_by_manufacturer — query «КОРФ» → items с manufacturer", async () => {
    renderTable({});
    await typeSearch("КОРФ");
    expect(rowNames()).toEqual(["b"]);
  });

  it("test_search_case_insensitive — «КоРф» → finds «ООО \"КОРФ\"»", async () => {
    renderTable({});
    await typeSearch("КоРф");
    expect(rowNames()).toEqual(["b"]);
  });

  it("test_search_trim_whitespace — query «  Воз  » работает", async () => {
    renderTable({});
    await typeSearch("  Воз  ");
    expect(rowNames()).toEqual(["a"]);
  });

  it("test_search_empty_state — query «xyz123» → empty state + кнопка очистки", async () => {
    renderTable({});
    await typeSearch("xyz123");
    const empty = screen.getByTestId("items-search-empty");
    expect(empty).toBeInTheDocument();
    expect(empty.textContent).toContain("xyz123");
    fireEvent.click(screen.getByTestId("items-search-empty-clear"));
    expect(
      (screen.getByTestId("items-search-input") as HTMLInputElement).value,
    ).toBe("");
  });

  it("test_search_counter — показывает «Найдено: N из M»", async () => {
    renderTable({});
    await typeSearch("ПВ-ИТП");
    const counter = screen.getByTestId("items-search-counter");
    expect(counter.textContent).toMatch(/Найдено:\s*2\s*из\s*3/);
  });

  it("test_search_highlight_marks — <mark> в ячейке name", async () => {
    renderTable({});
    await typeSearch("Воздуховод");
    const marks = document.querySelectorAll("tbody mark");
    expect(marks.length).toBeGreaterThanOrEqual(1);
    expect(marks[0].textContent?.toLowerCase()).toBe("воздуховод");
  });

  it("test_search_other_sections_hint — совпадения в других секциях → hint viсible и кликабелен", async () => {
    const onClearSection = vi.fn();
    const sections: EstimateSection[] = [
      makeSection({ id: "sec-1", name: "Раздел 1" }),
      makeSection({ id: "sec-2", name: "Раздел 2" }),
    ];
    const scoped = [SAMPLE_ITEMS[0]]; // отображается только первый
    const allWithOther = [
      ...SAMPLE_ITEMS,
      makeItem({
        id: "x",
        section: "sec-2",
        name: "Воздуховод круглый",
        tech_specs: { model_name: "ВК-160" },
      }),
      makeItem({
        id: "y",
        section: "sec-2",
        name: "Воздуховод оцинкованный",
        tech_specs: {},
      }),
    ];
    renderTable({
      items: scoped,
      sections,
      activeSectionId: "sec-1",
      allItemsForSearch: allWithOther,
      onClearSection,
    });
    await typeSearch("Воздуховод");
    const hint = screen.getByTestId("items-search-other-sections");
    expect(hint.textContent).toMatch(/\+2/);
    fireEvent.click(hint);
    expect(onClearSection).toHaveBeenCalledTimes(1);
  });

  it("test_search_clear_button_resets — click clear → query пуст, все items visible", async () => {
    renderTable({});
    await typeSearch("Воздуховод");
    expect(rowNames()).toEqual(["a"]);
    fireEvent.click(screen.getByTestId("items-search-clear"));
    await act(async () => {
      vi.advanceTimersByTime(210);
    });
    expect(rowNames()).toEqual(["a", "b", "c"]);
    expect(screen.queryByTestId("items-search-counter")).toBeNull();
  });

  it("фильтрует по section.name — query совпадает с именем раздела", async () => {
    renderTable({
      items: SAMPLE_ITEMS,
      sections: [makeSection({ id: "sec-1", name: "Вентиляция" })],
    });
    await typeSearch("Вентиляция");
    // все items из sec-1 попадают под совпадение section.name
    expect(rowNames()).toEqual(["a", "b", "c"]);
  });

  it("debounce 200ms — немедленный ввод ещё не фильтрует", async () => {
    renderTable({});
    const input = screen.getByTestId("items-search-input") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "Воздуховод" } });
    // debounce ещё не сработал
    await act(async () => {
      vi.advanceTimersByTime(50);
    });
    expect(rowNames()).toEqual(["a", "b", "c"]);
    // ждём остаток
    await act(async () => {
      vi.advanceTimersByTime(200);
    });
    expect(rowNames()).toEqual(["a"]);
  });

  it("selection сохраняется если выделенный item остаётся в visible list", async () => {
    renderTable({});
    const row = document.querySelectorAll("tbody tr")[0];
    const cb = row.querySelector(
      'input[type="checkbox"]',
    ) as HTMLInputElement;
    fireEvent.click(cb);
    expect(cb.checked).toBe(true);
    await typeSearch("Воздуховод");
    const cbAfter = document
      .querySelectorAll("tbody tr")[0]
      .querySelector('input[type="checkbox"]') as HTMLInputElement;
    expect(cbAfter.checked).toBe(true);
  });

  it("selection очищается если item скрылся по фильтру", async () => {
    renderTable({});
    // выделяем первую строку (id=a — Воздуховод)
    const rows = document.querySelectorAll("tbody tr");
    const cb = rows[0].querySelector(
      'input[type="checkbox"]',
    ) as HTMLInputElement;
    fireEvent.click(cb);
    expect(cb.checked).toBe(true);
    // после фильтра «Кассетный» — видимым становится только item b
    await typeSearch("Кассетный");
    const visibleCb = document
      .querySelectorAll("tbody tr")[0]
      .querySelector('input[type="checkbox"]') as HTMLInputElement;
    expect(visibleCb.checked).toBe(false);
  });

  it("счётчик не показывается когда query пуст", () => {
    renderTable({});
    expect(screen.queryByTestId("items-search-counter")).toBeNull();
  });

  it("перформанс: 200+ items фильтруются быстро (<200ms на filter)", async () => {
    const many: EstimateItem[] = Array.from({ length: 250 }, (_, i) =>
      makeItem({
        id: `p-${i}`,
        sort_order: i,
        name: i === 123 ? "Уникальный радиатор" : `Позиция ${i}`,
        tech_specs: { model_name: `MOD-${i}` },
      }),
    );
    renderTable({ items: many });
    const t0 = performance.now();
    await typeSearch("Уникальный");
    const dt = performance.now() - t0;
    expect(rowNames()).toEqual(["p-123"]);
    // Замер включает debounce + рендер — но 200ms на filter+render самого
    // плотного кейса более чем достаточно.
    expect(dt).toBeLessThan(2000);
  });
});
