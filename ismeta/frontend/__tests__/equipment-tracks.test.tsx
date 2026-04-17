import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { ItemsTable } from "@/components/estimate/items-table";
import { ProcurementSummary } from "@/components/estimate/procurement-summary";
import { TrackTabs } from "@/components/estimate/track-tabs";
import type { EstimateItem } from "@/lib/api/types";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/estimates/e1",
  useSearchParams: () => new URLSearchParams(),
}));

const toastError = vi.fn();
const toastSuccess = vi.fn();
vi.mock("sonner", () => ({
  toast: {
    error: (m: string) => toastError(m),
    success: (m: string) => toastSuccess(m),
    info: vi.fn(),
  },
  Toaster: () => null,
}));

function wrap(ui: React.ReactElement) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return <QueryClientProvider client={qc}>{ui}</QueryClientProvider>;
}

function makeItem(
  id: string,
  opts: Partial<EstimateItem> = {},
): EstimateItem {
  return {
    id,
    section: "sec-1",
    estimate: "e1",
    row_id: "rid-" + id,
    sort_order: 0,
    name: "Позиция " + id,
    unit: "шт",
    quantity: "1",
    equipment_price: "1000",
    material_price: "0",
    work_price: "0",
    equipment_total: "1000",
    material_total: "0",
    work_total: "0",
    total: "1000",
    version: 2,
    match_source: "manual",
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
    ...opts,
  };
}

const items: EstimateItem[] = [
  makeItem("i1"),
  makeItem("i2", { is_key_equipment: true, procurement_status: "requested" }),
  makeItem("i3", { is_key_equipment: true, procurement_status: "quoted" }),
  makeItem("i4", { is_key_equipment: true, procurement_status: "booked" }),
  makeItem("i5", { is_key_equipment: true, procurement_status: "ordered" }),
];

describe("TrackTabs", () => {
  it("показывает три таба с количествами и меняет активный через onChange", () => {
    const onChange = vi.fn();
    render(
      <TrackTabs
        value="all"
        onChange={onChange}
        counts={{ all: 5, standard: 1, key: 4 }}
      />,
    );
    const tabs = screen.getAllByRole("tab");
    expect(tabs).toHaveLength(3);
    const keyTab = screen.getByRole("tab", {
      name: /Основное оборудование/,
    });
    expect(within(keyTab).getByText("4")).toBeInTheDocument();
    expect(
      screen.getByRole("tab", { name: /Стандарт/ }),
    ).toHaveAttribute("aria-selected", "false");
    fireEvent.click(keyTab);
    expect(onChange).toHaveBeenCalledWith("key");
  });
});

describe("ProcurementSummary", () => {
  it("считает позиции по статусам и показывает «Ожидают действия» = none+requested", () => {
    const list: EstimateItem[] = [
      makeItem("a1", { is_key_equipment: true, procurement_status: "none" }),
      makeItem("a2", { is_key_equipment: true, procurement_status: "none" }),
      makeItem("a3", { is_key_equipment: true, procurement_status: "requested" }),
      makeItem("a4", { is_key_equipment: true, procurement_status: "quoted" }),
      makeItem("a5", { is_key_equipment: true, procurement_status: "booked" }),
      makeItem("a6", { is_key_equipment: true, procurement_status: "ordered" }),
      makeItem("a7"), // не ключевое — игнор
    ];
    render(<ProcurementSummary items={list} />);
    expect(screen.getByTestId("proc-total")).toHaveTextContent("6");
    const pending = screen.getByTestId("proc-pending");
    expect(within(pending).getByText("3")).toBeInTheDocument();

    // Каждый статус в ORDER с count
    const requestedLi = document.querySelector('li[data-status="requested"]')!;
    expect(requestedLi.textContent).toContain("Запрошено");
    expect(requestedLi.textContent).toContain("1");

    const orderedLi = document.querySelector('li[data-status="ordered"]')!;
    expect(orderedLi.textContent).toContain("Заказано");
    expect(orderedLi.textContent).toContain("1");
  });

  it("возвращает null если нет основного оборудования", () => {
    const { container } = render(
      <ProcurementSummary items={[makeItem("x")]} />,
    );
    expect(container.firstChild).toBeNull();
  });
});

describe("ItemsTable — tracks", () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    toastError.mockClear();
    toastSuccess.mockClear();
  });
  afterEach(() => vi.unstubAllGlobals());

  it('в track="all" НЕТ колонки «Статус закупки»', () => {
    render(
      wrap(
        <ItemsTable
          estimateId="e1"
          items={items}
          activeSectionId="sec-1"
          fallbackSectionId="sec-1"
          track="all"
        />,
      ),
    );
    expect(screen.queryByText("Статус закупки")).not.toBeInTheDocument();
  });

  it('в track="key" ЕСТЬ колонка «Статус закупки» и selectы по каждой строке', () => {
    const keyOnly = items.filter((i) => i.is_key_equipment);
    render(
      wrap(
        <ItemsTable
          estimateId="e1"
          items={keyOnly}
          activeSectionId="sec-1"
          fallbackSectionId="sec-1"
          track="key"
        />,
      ),
    );
    expect(screen.getByText("Статус закупки")).toBeInTheDocument();
    const triggers = screen.getAllByRole("button", { name: "Статус закупки" });
    expect(triggers.length).toBe(keyOnly.length);
  });

  it("toggle is_key_equipment → PATCH с If-Match", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({ ...items[0], is_key_equipment: true, version: 3 }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
            ETag: "3",
          },
        },
      ),
    );

    render(
      wrap(
        <ItemsTable
          estimateId="e1"
          items={[items[0]!]}
          activeSectionId="sec-1"
          fallbackSectionId="sec-1"
          track="all"
        />,
      ),
    );

    const toggle = screen.getByRole("button", {
      name: /Отметить как основное оборудование/,
    });
    expect(toggle).toHaveAttribute("aria-pressed", "false");
    fireEvent.click(toggle);

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(String(url)).toMatch(/\/items\/i1\/$/);
    expect(init.method).toBe("PATCH");
    const headers = init.headers as Headers;
    expect(headers.get("If-Match")).toBe("2");
    expect(headers.get("X-Workspace-Id")).toBeTruthy();
    expect(JSON.parse(init.body as string)).toEqual({ is_key_equipment: true });
  });

  it("смена procurement_status → PATCH с If-Match и корректным body", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          ...items[1],
          procurement_status: "booked",
          version: 3,
        }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
            ETag: "3",
          },
        },
      ),
    );

    render(
      wrap(
        <ItemsTable
          estimateId="e1"
          items={[items[1]!]}
          activeSectionId="sec-1"
          fallbackSectionId="sec-1"
          track="key"
        />,
      ),
    );

    const user = userEvent.setup();
    // открываем dropdown (Radix использует pointer events)
    await user.click(screen.getByRole("button", { name: "Статус закупки" }));

    // выбираем "Забронировано"
    const bookedItem = await screen.findByRole("menuitem", {
      name: /Забронировано/,
    });
    await user.click(bookedItem);

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(String(url)).toMatch(/\/items\/i2\/$/);
    expect(init.method).toBe("PATCH");
    const headers = init.headers as Headers;
    expect(headers.get("If-Match")).toBe("2");
    expect(JSON.parse(init.body as string)).toEqual({
      procurement_status: "booked",
    });
  });

  it("409 Conflict при изменении procurement_status → toast с reconciliation-сообщением", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          type: "https://ismeta.example.com/errors/conflict",
          title: "Conflict",
          status: 409,
          detail: "Version mismatch",
        }),
        {
          status: 409,
          headers: { "Content-Type": "application/json" },
        },
      ),
    );

    render(
      wrap(
        <ItemsTable
          estimateId="e1"
          items={[items[1]!]}
          activeSectionId="sec-1"
          fallbackSectionId="sec-1"
          track="key"
        />,
      ),
    );

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Статус закупки" }));
    await user.click(
      await screen.findByRole("menuitem", { name: /Заказано/ }),
    );

    await waitFor(() =>
      expect(toastError).toHaveBeenCalledWith(
        expect.stringMatching(/Кто-то обновил эту строку/),
      ),
    );
  });
});
