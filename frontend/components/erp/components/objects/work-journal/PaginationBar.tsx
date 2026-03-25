import { ChevronLeft, ChevronRight } from 'lucide-react';

interface PaginationBarProps {
  count: number;
  page: number;
  pageSize: number;
  onPageChange: (p: number) => void;
}

export function PaginationBar({ count, page, pageSize, onPageChange }: PaginationBarProps) {
  const totalPages = Math.ceil(count / pageSize);
  if (totalPages <= 1) return null;

  return (
    <div className="flex items-center justify-between px-6 py-3 border-t border-border bg-muted">
      <div className="text-sm text-muted-foreground">Всего: {count}</div>
      <div className="flex items-center gap-2">
        <button type="button" className="p-1.5 rounded-lg border border-border text-muted-foreground hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed" disabled={page <= 1} onClick={() => onPageChange(page - 1)} aria-label="Предыдущая страница" tabIndex={0}>
          <ChevronLeft className="w-4 h-4" />
        </button>
        <span className="text-sm text-foreground min-w-[80px] text-center">{page} из {totalPages}</span>
        <button type="button" className="p-1.5 rounded-lg border border-border text-muted-foreground hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed" disabled={page >= totalPages} onClick={() => onPageChange(page + 1)} aria-label="Следующая страница" tabIndex={0}>
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
