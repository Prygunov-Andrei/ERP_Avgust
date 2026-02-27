import React, { useState, useCallback } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { type ColumnDef } from '@tanstack/react-table';
import { api, type AutoMatchResult } from '../../lib/api';
import { DataTable } from '../ui/data-table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../ui/dialog';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Loader2, Wand2, Check, X } from 'lucide-react';
import { toast } from 'sonner';

type AutoMatchDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  estimateId: number;
};

type MatchRow = AutoMatchResult & { accepted: boolean };

const confidenceBadge = (value: number) => {
  if (value >= 0.8) return <Badge className="bg-green-100 text-green-800">{Math.round(value * 100)}%</Badge>;
  if (value >= 0.5) return <Badge className="bg-yellow-100 text-yellow-800">{Math.round(value * 100)}%</Badge>;
  return <Badge variant="destructive">{Math.round(value * 100)}%</Badge>;
};

export const AutoMatchDialog: React.FC<AutoMatchDialogProps> = ({
  open,
  onOpenChange,
  estimateId,
}) => {
  const queryClient = useQueryClient();
  const [results, setResults] = useState<MatchRow[]>([]);
  const [step, setStep] = useState<'config' | 'results'>('config');

  const matchMutation = useMutation({
    mutationFn: () => api.autoMatchEstimateItems(estimateId),
    onSuccess: (data) => {
      const rows = (data || []).map((r) => ({
        ...r,
        accepted: r.product_confidence >= 0.8,
      }));
      setResults(rows);
      setStep('results');
      if (rows.length === 0) {
        toast.info('Совпадений не найдено. Убедитесь, что счета поставщиков проверены.');
      }
    },
    onError: (error) => {
      toast.error(`Ошибка: ${error instanceof Error ? error.message : 'Неизвестная ошибка'}`);
    },
  });

  const handleApply = useCallback(async () => {
    const accepted = results.filter((r) => r.accepted);
    if (accepted.length === 0) {
      toast.error('Не выбрано ни одной строки');
      return;
    }

    const updates = accepted.map((r) => ({
      id: r.item_id,
      ...(r.matched_product ? {
        product: r.matched_product.id,
        material_unit_price: r.matched_product.price,
      } : {}),
      ...(r.source_price_history_id ? {
        source_price_history: r.source_price_history_id,
      } : {}),
    }));

    try {
      await api.bulkUpdateEstimateItems(updates);
      queryClient.invalidateQueries({ queryKey: ['estimate-items', estimateId] });
      toast.success(`Применено ${accepted.length} совпадений`);
      onOpenChange(false);
    } catch (error) {
      toast.error(`Ошибка: ${error instanceof Error ? error.message : 'Неизвестная ошибка'}`);
    }
  }, [results, estimateId, queryClient, onOpenChange]);

  const handleToggle = useCallback((idx: number) => {
    setResults((prev) => prev.map((r, i) => i === idx ? { ...r, accepted: !r.accepted } : r));
  }, []);

  const handleAcceptAll = useCallback(() => {
    setResults((prev) => prev.map((r) => ({
      ...r,
      accepted: r.product_confidence >= 0.8,
    })));
  }, []);

  const columns: ColumnDef<MatchRow, any>[] = [
    {
      id: 'accepted',
      header: '',
      size: 40,
      cell: ({ row }) => (
        <button
          onClick={() => handleToggle(row.index)}
          className={`w-6 h-6 rounded flex items-center justify-center ${
            row.original.accepted ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-400'
          }`}
          aria-label={row.original.accepted ? 'Отклонить' : 'Принять'}
        >
          {row.original.accepted ? <Check className="h-4 w-4" /> : <X className="h-4 w-4" />}
        </button>
      ),
    },
    { accessorKey: 'name', header: 'Строка сметы', size: 200 },
    {
      id: 'product',
      header: 'Товар из каталога',
      size: 180,
      cell: ({ row }) => row.original.matched_product?.name || '—',
    },
    {
      id: 'product_price',
      header: 'Цена',
      size: 100,
      cell: ({ row }) => {
        const price = row.original.matched_product?.price;
        if (!price || price === '0') return '—';
        return Number(price).toLocaleString('ru-RU', { maximumFractionDigits: 2 }) + ' ₽';
      },
    },
    {
      id: 'source',
      header: 'Источник цены',
      size: 220,
      cell: ({ row }) => {
        const info = row.original.invoice_info;
        if (!info) return <span className="text-muted-foreground">Нет данных</span>;
        return (
          <div className="text-xs leading-tight">
            <div className="font-medium">{info.counterparty_name || 'Неизвестный'}</div>
            <div className="text-muted-foreground">
              Счёт {info.invoice_number || '—'} от{' '}
              {info.invoice_date
                ? new Date(info.invoice_date).toLocaleDateString('ru-RU')
                : '—'}
            </div>
          </div>
        );
      },
    },
    {
      id: 'confidence',
      header: 'Увер.',
      size: 70,
      cell: ({ row }) => confidenceBadge(row.original.product_confidence),
    },
  ];

  const handleClose = useCallback(() => {
    setStep('config');
    setResults([]);
    onOpenChange(false);
  }, [onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-5xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            <Wand2 className="inline h-5 w-5 mr-2" />
            Подобрать цены из счетов
          </DialogTitle>
        </DialogHeader>

        {step === 'config' && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Система найдёт совпадения между строками сметы и позициями из загруженных счетов поставщиков.
              Вы сможете принять или отклонить каждое совпадение перед применением.
            </p>
          </div>
        )}

        {step === 'results' && (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <Badge variant="secondary">{results.length} строк</Badge>
              <Badge className="bg-green-100 text-green-800">
                {results.filter((r) => r.accepted).length} принято
              </Badge>
              <Button size="sm" variant="outline" onClick={handleAcceptAll}>
                Принять все {'>'}80%
              </Button>
            </div>
            <DataTable
              columns={columns}
              data={results}
              enableSorting
              enableVirtualization={results.length > 100}
              emptyMessage="Совпадения не найдены. Убедитесь, что счета поставщиков загружены и проверены."
            />
          </div>
        )}

        <DialogFooter>
          {step === 'config' && (
            <>
              <Button variant="outline" onClick={handleClose}>Отмена</Button>
              <Button onClick={() => matchMutation.mutate()} disabled={matchMutation.isPending}>
                {matchMutation.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
                Запустить подбор
              </Button>
            </>
          )}
          {step === 'results' && (
            <>
              <Button variant="outline" onClick={handleClose}>Отмена</Button>
              <Button onClick={handleApply}>
                Применить ({results.filter((r) => r.accepted).length})
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
