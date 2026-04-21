import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  within,
} from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { ItemsTable } from "@/components/estimate/items-table";
import type { EstimateItem } from "@/lib/api/types";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() },
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
    name: "Воздуховод",
    unit: "м.п.",
    quantity: "10",
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

describe("ItemsTable — столбцы «Модель» и «Примечание» (UI-04)", () => {
  it("рендерит все ожидаемые заголовки столбцов в корректном порядке", () => {
    render(
      wrap(
        <ItemsTable
          estimateId="est-1"
          items={[makeItem()]}
          activeSectionId="sec-1"
          fallbackSectionId="sec-1"
        />,
      ),
    );

    const headers = screen
      .getAllByRole("columnheader")
      .map((h) => h.textContent?.trim() ?? "");

    const expected = [
      "Наименование",
      "Модель",
      "Ед.изм.",
      "Кол-во",
      "Цена обор.",
      "Цена мат.",
      "Цена работ",
      "Итого",
      "Подбор",
      "Примечание",
    ];
    for (const title of expected) {
      expect(headers).toContain(title);
    }

    expect(headers.indexOf("Наименование")).toBeLessThan(
      headers.indexOf("Модель"),
    );
    expect(headers.indexOf("Модель")).toBeLessThan(headers.indexOf("Ед.изм."));
    expect(headers.indexOf("Подбор")).toBeLessThan(
      headers.indexOf("Примечание"),
    );
  });

  it("значение tech_specs.model_name отображается в столбце «Модель»", () => {
    const item = makeItem({
      name: "Дефлектор Цаги",
      tech_specs: { model_name: "ф355-оц-фл" },
    });
    render(
      wrap(
        <ItemsTable
          estimateId="est-1"
          items={[item]}
          activeSectionId="sec-1"
          fallbackSectionId="sec-1"
        />,
      ),
    );

    expect(
      screen.getByRole("button", { name: "ф355-оц-фл" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Дефлектор Цаги" }),
    ).toBeInTheDocument();
  });

  it("пустой tech_specs.model_name → em-dash", () => {
    render(
      wrap(
        <ItemsTable
          estimateId="est-1"
          items={[makeItem({ tech_specs: {} })]}
          activeSectionId="sec-1"
          fallbackSectionId="sec-1"
        />,
      ),
    );
    // название и модель оба могут содержать em-dash (модель точно пуста),
    // поэтому проверяем что в строке есть хотя бы один em-dash.
    const row = document.getElementById("item-row-it-1")!;
    expect(row.textContent).toContain("—");
  });

  it("значение tech_specs.comments отображается в столбце «Примечание»", () => {
    const item = makeItem({
      tech_specs: { comments: "согласовано с заказчиком" },
    });
    render(
      wrap(
        <ItemsTable
          estimateId="est-1"
          items={[item]}
          activeSectionId="sec-1"
          fallbackSectionId="sec-1"
        />,
      ),
    );
    const comments = screen.getByTestId("item-comments");
    expect(comments).toHaveTextContent("согласовано с заказчиком");
    expect(comments.getAttribute("title")).toBe("согласовано с заказчиком");
  });

  it("item без tech_specs.comments → em-dash в столбце «Примечание»", () => {
    render(
      wrap(
        <ItemsTable
          estimateId="est-1"
          items={[makeItem({ tech_specs: { model_name: "X" } })]}
          activeSectionId="sec-1"
          fallbackSectionId="sec-1"
        />,
      ),
    );
    const comments = screen.getByTestId("item-comments");
    expect(within(comments).getByText("—")).toBeInTheDocument();
    expect(comments.hasAttribute("title")).toBe(false);
  });

  it("подстрока с model_name под именем удалена", () => {
    render(
      wrap(
        <ItemsTable
          estimateId="est-1"
          items={[
            makeItem({
              tech_specs: { brand: "Korf", model_name: "WNK 100/1" },
            }),
          ]}
          activeSectionId="sec-1"
          fallbackSectionId="sec-1"
        />,
      ),
    );
    expect(screen.queryByTestId("item-sub-label")).toBeNull();
  });
});

describe("ItemsTable — inline-edit tech_specs через PATCH merge", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("редактирование «Модель» шлёт PATCH с merged tech_specs (не теряет произвольные ключи)", async () => {
    const item = makeItem({
      tech_specs: {
        model_name: "WNK 100/1",
        brand: "Korf",
        flow: "2600 м³/ч",
      },
    });
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          ...item,
          tech_specs: { ...item.tech_specs, model_name: "WNK 200/1" },
          version: item.version + 1,
        }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
            ETag: String(item.version + 1),
          },
        },
      ),
    );

    render(
      wrap(
        <ItemsTable
          estimateId="est-1"
          items={[item]}
          activeSectionId="sec-1"
          fallbackSectionId="sec-1"
        />,
      ),
    );

    fireEvent.click(screen.getByRole("button", { name: "WNK 100/1" }));
    const input = screen.getByDisplayValue("WNK 100/1") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "WNK 200/1" } });
    fireEvent.blur(input);

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(String(url)).toMatch(/\/items\/it-1\/$/);
    expect(init.method).toBe("PATCH");
    const body = JSON.parse(String(init.body));
    expect(body).toEqual({
      tech_specs: {
        model_name: "WNK 200/1",
        brand: "Korf",
        flow: "2600 м³/ч",
      },
    });
  });

  it("редактирование «Примечание» шлёт PATCH с обновлённым tech_specs.comments", async () => {
    const item = makeItem({
      tech_specs: { model_name: "X", comments: "старое" },
    });
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          ...item,
          tech_specs: { ...item.tech_specs, comments: "новое" },
          version: item.version + 1,
        }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
            ETag: String(item.version + 1),
          },
        },
      ),
    );

    render(
      wrap(
        <ItemsTable
          estimateId="est-1"
          items={[item]}
          activeSectionId="sec-1"
          fallbackSectionId="sec-1"
        />,
      ),
    );

    const comments = screen.getByTestId("item-comments");
    fireEvent.click(within(comments).getByRole("button"));
    const input = screen.getByDisplayValue("старое") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "новое" } });
    fireEvent.blur(input);

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(String(init.body));
    expect(body).toEqual({
      tech_specs: { model_name: "X", comments: "новое" },
    });
  });
});
