import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { EditableCell } from "@/components/estimate/editable-cell";
import { ItemsTable } from "@/components/estimate/items-table";
import type { EstimateItem } from "@/lib/api/types";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

const toastError = vi.fn();
const toastSuccess = vi.fn();

vi.mock("sonner", () => ({
  toast: {
    error: (msg: string) => toastError(msg),
    success: (msg: string) => toastSuccess(msg),
  },
  Toaster: () => null,
}));

function wrap(ui: React.ReactElement) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{ui}</QueryClientProvider>;
}

const item: EstimateItem = {
  id: "it-1",
  section: "sec-1",
  estimate: "est-1",
  row_id: "rid-1",
  sort_order: 0,
  name: "Воздуховод",
  unit: "м.п.",
  quantity: "10",
  equipment_price: "0",
  material_price: "1200",
  work_price: "180",
  equipment_total: "0",
  material_total: "12000",
  work_total: "1800",
  total: "13800",
  version: 3,
  match_source: "knowledge",
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
};

describe("EditableCell", () => {
  it("click → input → blur: отдаёт новое значение через onCommit", () => {
    const onCommit = vi.fn();
    render(<EditableCell value="Исходное" onCommit={onCommit} />);

    fireEvent.click(screen.getByRole("button"));
    const input = screen.getByRole("textbox") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "Новое" } });
    fireEvent.blur(input);

    expect(onCommit).toHaveBeenCalledWith("Новое");
  });

  it("Escape отменяет редактирование и не вызывает onCommit", () => {
    const onCommit = vi.fn();
    render(<EditableCell value="Исходное" onCommit={onCommit} />);
    fireEvent.click(screen.getByRole("button"));
    const input = screen.getByRole("textbox") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "Меняю" } });
    fireEvent.keyDown(input, { key: "Escape" });
    expect(onCommit).not.toHaveBeenCalled();
    expect(screen.getByRole("button")).toHaveTextContent("Исходное");
  });

  it("не вызывает onCommit если значение не изменилось", () => {
    const onCommit = vi.fn();
    render(<EditableCell value="Как есть" onCommit={onCommit} />);
    fireEvent.click(screen.getByRole("button"));
    const input = screen.getByRole("textbox");
    fireEvent.blur(input);
    expect(onCommit).not.toHaveBeenCalled();
  });
});

describe("ItemsTable inline edit → PATCH", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("редактирование name шлёт PATCH /items/{id}/ с If-Match: {version}", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({ ...item, name: "Воздуховод Ø200", version: 4 }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
            ETag: "4",
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

    // click по ячейке name
    fireEvent.click(screen.getByRole("button", { name: "Воздуховод" }));
    const input = screen.getByDisplayValue("Воздуховод") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "Воздуховод Ø200" } });
    fireEvent.blur(input);

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(String(url)).toMatch(/\/items\/it-1\/$/);
    expect(init.method).toBe("PATCH");
    const headers = init.headers as Headers;
    expect(headers.get("If-Match")).toBe("3");
    expect(headers.get("X-Workspace-Id")).toBeTruthy();
    expect(init.body).toBe(JSON.stringify({ name: "Воздуховод Ø200" }));
  });

  it("409 Conflict → toast «Кто-то обновил эту строку...»", async () => {
    toastError.mockClear();
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
          estimateId="est-1"
          items={[item]}
          activeSectionId="sec-1"
          fallbackSectionId="sec-1"
        />,
      ),
    );

    fireEvent.click(screen.getByRole("button", { name: "Воздуховод" }));
    const input = screen.getByDisplayValue("Воздуховод");
    fireEvent.change(input, { target: { value: "Новое имя" } });
    fireEvent.blur(input);

    await waitFor(() =>
      expect(toastError).toHaveBeenCalledWith(
        expect.stringMatching(/Кто-то обновил эту строку/),
      ),
    );
  });
});
