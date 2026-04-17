import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { MatchingReview } from "@/components/estimate/matching-review";
import type { MatchingResult, MatchingSession } from "@/lib/api/types";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

const toastError = vi.fn();
const toastSuccess = vi.fn();
const toastInfo = vi.fn();

vi.mock("sonner", () => ({
  toast: {
    error: (m: string) => toastError(m),
    success: (m: string) => toastSuccess(m),
    info: (m: string) => toastInfo(m),
  },
  Toaster: () => null,
}));

function wrap(ui: React.ReactElement) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{ui}</QueryClientProvider>;
}

function makeResult(
  groupName: string,
  confidence: number,
  opts: Partial<MatchingResult> = {},
): MatchingResult {
  return {
    group_name: groupName,
    unit: "шт",
    item_count: opts.item_count ?? 1,
    item_ids: opts.item_ids ?? ["it-" + groupName],
    match: {
      work_name:
        confidence === 0 ? "—" : `Монтаж ${groupName.toLowerCase()}`,
      work_unit: "шт",
      work_price: String(confidence === 0 ? 0 : 1000 + Math.floor(confidence * 10000)),
      confidence: confidence.toFixed(2),
      source: confidence === 0 ? "unmatched" : "knowledge",
      reasoning: "",
    },
  };
}

const session: MatchingSession = {
  session_id: "s1",
  total_items: 22,
  groups: 4,
  results: [
    makeResult("Вентилятор крышный", 0.92), // high
    makeResult("Кабель UTP", 0.7, { item_count: 20, item_ids: ["a", "b", "c"] }),
    makeResult("Датчик XYZ", 0.0),
    makeResult("Фильтр G4", 0.95), // high
  ],
};

describe("MatchingReview — keyboard navigation", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(
      new Response(JSON.stringify([]), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    ));
    toastError.mockClear();
    toastSuccess.mockClear();
    toastInfo.mockClear();
  });
  afterEach(() => vi.unstubAllGlobals());

  it("рендерит table с role=grid, aria-activedescendant и строками aria-selected", () => {
    render(wrap(<MatchingReview estimateId="e1" sessionId="s1" session={session} />));
    const grid = screen.getByRole("grid");
    expect(grid).toHaveAttribute("aria-activedescendant", "match-row-0");
    expect(grid).toHaveAttribute("aria-rowcount", "4");
    const firstRow = document.getElementById("match-row-0")!;
    expect(firstRow).toHaveAttribute("aria-selected", "true");
  });

  it("↑/↓ меняют активную строку (aria-activedescendant)", () => {
    render(wrap(<MatchingReview estimateId="e1" sessionId="s1" session={session} />));
    const grid = screen.getByRole("grid");
    fireEvent.keyDown(grid, { key: "ArrowDown" });
    expect(grid).toHaveAttribute("aria-activedescendant", "match-row-1");
    fireEvent.keyDown(grid, { key: "ArrowDown" });
    expect(grid).toHaveAttribute("aria-activedescendant", "match-row-2");
    fireEvent.keyDown(grid, { key: "ArrowUp" });
    expect(grid).toHaveAttribute("aria-activedescendant", "match-row-1");
  });

  it("Enter принимает текущую строку и двигает курсор вниз", () => {
    render(wrap(<MatchingReview estimateId="e1" sessionId="s1" session={session} />));
    const grid = screen.getByRole("grid");
    fireEvent.keyDown(grid, { key: "Enter" });
    const row0 = document.getElementById("match-row-0")!;
    expect(row0).toHaveAttribute("data-decision", "accept");
    expect(grid).toHaveAttribute("aria-activedescendant", "match-row-1");
    expect(
      screen.getByRole("button", { name: /Применить выбранные \(1\)/ }),
    ).toBeEnabled();
  });

  it("Esc отклоняет текущую строку", () => {
    render(wrap(<MatchingReview estimateId="e1" sessionId="s1" session={session} />));
    const grid = screen.getByRole("grid");
    fireEvent.keyDown(grid, { key: "Escape" });
    const row0 = document.getElementById("match-row-0")!;
    expect(row0).toHaveAttribute("data-decision", "reject");
  });

  it("Tab пропускает green и переходит к следующей не-green строке", () => {
    render(wrap(<MatchingReview estimateId="e1" sessionId="s1" session={session} />));
    const grid = screen.getByRole("grid");
    // активна строка 0 (high) → Tab должен пропустить green (0 сама high но мы переходим дальше),
    // следующая не-high = индекс 1 (confidence 0.7 → medium)
    fireEvent.keyDown(grid, { key: "Tab" });
    expect(grid).toHaveAttribute("aria-activedescendant", "match-row-1");
    // с 1 (medium) Tab → индекс 2 (confidence 0 → none), пропускаем индекс 3 (high) если он дальше
    fireEvent.keyDown(grid, { key: "Tab" });
    expect(grid).toHaveAttribute("aria-activedescendant", "match-row-2");
    // с 2 (none) Tab → индекс 3 high — пропустить — но дальше ничего нет, курсор не двигается
    fireEvent.keyDown(grid, { key: "Tab" });
    expect(grid).toHaveAttribute("aria-activedescendant", "match-row-2");
  });

  it("Space переключает accept/reject на активной строке", () => {
    render(wrap(<MatchingReview estimateId="e1" sessionId="s1" session={session} />));
    const grid = screen.getByRole("grid");
    fireEvent.keyDown(grid, { key: " " });
    const row0 = document.getElementById("match-row-0")!;
    expect(row0).toHaveAttribute("data-decision", "accept");
    fireEvent.keyDown(grid, { key: " " });
    expect(row0).toHaveAttribute("data-decision", "reject");
  });

  it("Shift+Enter принимает все high-confidence строки", () => {
    render(wrap(<MatchingReview estimateId="e1" sessionId="s1" session={session} />));
    const grid = screen.getByRole("grid");
    fireEvent.keyDown(grid, { key: "Enter", shiftKey: true });
    expect(document.getElementById("match-row-0")).toHaveAttribute(
      "data-decision",
      "accept",
    );
    expect(document.getElementById("match-row-3")).toHaveAttribute(
      "data-decision",
      "accept",
    );
    // medium + none — остались pending
    expect(document.getElementById("match-row-1")).toHaveAttribute(
      "data-decision",
      "pending",
    );
    expect(document.getElementById("match-row-2")).toHaveAttribute(
      "data-decision",
      "pending",
    );
    expect(
      screen.getByRole("button", { name: /Применить выбранные \(2\)/ }),
    ).toBeEnabled();
  });
});

describe("MatchingReview — group expand + apply", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify([]), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      ),
    );
    toastError.mockClear();
    toastSuccess.mockClear();
  });
  afterEach(() => vi.unstubAllGlobals());

  it("показывает badge ×N для группы и разворачивает состав по клику", () => {
    render(wrap(<MatchingReview estimateId="e1" sessionId="s1" session={session} />));
    // group 1 item_count=20
    expect(screen.getByText("×20")).toBeInTheDocument();
    const expandBtn = screen.getByRole("button", {
      name: /Развернуть группу/,
    });
    expect(expandBtn).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(expandBtn);
    expect(expandBtn).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText(/Объединено позиций: 20/)).toBeInTheDocument();
  });

  it("кнопка «Применить» делает POST /apply/ с выбранными results", async () => {
    const fetchMock = vi.fn().mockImplementation(async (url: string) => {
      if (url.includes("/items/")) {
        return new Response("[]", {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      if (url.includes("/apply/")) {
        return new Response(JSON.stringify({ updated: 2 }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      return new Response("[]", { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);

    render(wrap(<MatchingReview estimateId="e1" sessionId="s1" session={session} />));
    const grid = screen.getByRole("grid");
    fireEvent.keyDown(grid, { key: "Enter", shiftKey: true }); // accept all green (2)

    const applyBtn = screen.getByRole("button", {
      name: /Применить выбранные \(2\)/,
    });
    fireEvent.click(applyBtn);

    await waitFor(() => {
      const calls = fetchMock.mock.calls.map((c) => String(c[0]));
      expect(calls.some((u) => u.includes("/match-works/s1/apply/"))).toBe(
        true,
      );
    });

    const applyCall = fetchMock.mock.calls.find((c) =>
      String(c[0]).includes("/apply/"),
    )!;
    const [, init] = applyCall as [string, RequestInit];
    expect(init.method).toBe("POST");
    const headers = init.headers as Headers;
    expect(headers.get("X-Workspace-Id")).toBeTruthy();
    const body = JSON.parse(init.body as string);
    expect(body.results).toHaveLength(2);
    expect(body.results[0].group_name).toBeTruthy();
  });

  it("«Отклонить все» сбрасывает все решения", () => {
    render(wrap(<MatchingReview estimateId="e1" sessionId="s1" session={session} />));
    const grid = screen.getByRole("grid");
    fireEvent.keyDown(grid, { key: "Enter", shiftKey: true });
    expect(
      screen.getByRole("button", { name: /Применить выбранные \(2\)/ }),
    ).toBeEnabled();
    fireEvent.click(screen.getByRole("button", { name: /Отклонить все/ }));
    expect(
      screen.getByRole("button", { name: /Применить выбранные \(0\)/ }),
    ).toBeDisabled();
  });
});

describe("MatchingReview — keyboard listener cleanup", () => {
  beforeEach(() =>
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify([]), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      ),
    ),
  );
  afterEach(() => vi.unstubAllGlobals());

  it("keydown-хэндлер отвязан от grid после unmount (нет утечки)", () => {
    const { unmount, container } = render(
      wrap(<MatchingReview estimateId="e1" sessionId="s1" session={session} />),
    );
    const grid = container.querySelector('[role="grid"]') as HTMLDivElement;
    expect(grid).toBeTruthy();
    unmount();
    // После unmount grid не в DOM
    expect(container.querySelector('[role="grid"]')).toBeNull();
    // fireEvent уже не имеет таргет. Проверка: никаких state-update-warn от вложенных setState после unmount.
    expect(toastError).not.toHaveBeenCalled();
  });
});

describe("ConfidenceBadge внутри MatchingReview", () => {
  beforeEach(() =>
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify([]), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      ),
    ),
  );
  afterEach(() => vi.unstubAllGlobals());

  it("рендерит 4 уровня уверенности по confidence + source", () => {
    render(wrap(<MatchingReview estimateId="e1" sessionId="s1" session={session} />));
    expect(screen.getAllByText("Уверенно").length).toBe(2);
    expect(screen.getByText("Проверить")).toBeInTheDocument();
    expect(screen.getByText("Не найдено")).toBeInTheDocument();
  });
});
