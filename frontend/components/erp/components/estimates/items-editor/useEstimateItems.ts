import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { type RowSelectionState } from '@tanstack/react-table';
import {
  api,
  type CreateEstimateItemData,
  type ColumnDef as ColumnDefAPI,
  DEFAULT_COLUMN_CONFIG,
} from '@/lib/api';
import { CONSTANTS } from '@/constants';
import { toast } from 'sonner';
import { type TableRow, makeSectionRow } from './types';

const DEBOUNCE_MS = 600;

export function useEstimateItems(estimateId: number, readOnly: boolean, columnConfig?: ColumnDefAPI[]) {
  const queryClient = useQueryClient();
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [globalFilter, setGlobalFilter] = useState('');
  const [isAddDialogOpen, setAddDialogOpen] = useState(false);
  const [isPasteDialogOpen, setPasteDialogOpen] = useState(false);
  const [isImportDialogOpen, setImportDialogOpen] = useState(false);
  const [isAutoMatchOpen, setAutoMatchOpen] = useState(false);
  const [isAutoMatchWorksOpen, setAutoMatchWorksOpen] = useState(false);
  const [pasteText, setPasteText] = useState('');
  const [moveTargetPosition, setMoveTargetPosition] = useState('');
  const debounceTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const { data: items = [], isLoading } = useQuery({
    queryKey: ['estimate-items', estimateId],
    queryFn: () => api.estimates.getEstimateItems(estimateId),
    staleTime: CONSTANTS.QUERY_STALE_TIME_MS,
    refetchOnWindowFocus: false,
    placeholderData: (prev) => prev,
  });

  const { data: sections = [] } = useQuery({
    queryKey: ['estimate-sections', estimateId],
    queryFn: () => api.estimates.getEstimateSections(estimateId),
    staleTime: CONSTANTS.QUERY_STALE_TIME_MS,
    refetchOnWindowFocus: false,
    placeholderData: (prev) => prev,
  });

  const effectiveConfig = useMemo<ColumnDefAPI[]>(
    () => (columnConfig && columnConfig.length > 0 ? columnConfig : DEFAULT_COLUMN_CONFIG),
    [columnConfig],
  );

  const [newItemForm, setNewItemForm] = useState<Partial<CreateEstimateItemData>>({
    estimate: estimateId,
    section: undefined,
    name: '',
    unit: 'шт',
    quantity: '1',
    material_unit_price: '0',
    work_unit_price: '0',
  });

  useEffect(() => {
    if (sections.length > 0) {
      setNewItemForm((f) => {
        const currentValid = f.section && sections.some((s) => s.id === f.section);
        if (!currentValid) {
          return { ...f, section: sections[0].id };
        }
        return f;
      });
    }
  }, [sections]);

  // Build mixed display rows
  const displayRows = useMemo<TableRow[]>(() => {
    const rows: TableRow[] = [];
    const sortedSections = [...sections].sort((a, b) => a.sort_order - b.sort_order);
    const showHeaders = sortedSections.length >= 1;

    for (const section of sortedSections) {
      const sectionItems = items
        .filter((i) => i.section === section.id)
        .sort((a, b) => a.sort_order - b.sort_order || a.item_number - b.item_number);
      if (showHeaders) {
        rows.push(makeSectionRow(section));
      }
      rows.push(...sectionItems);
    }
    const sectionIds = new Set(sections.map((s) => s.id));
    const orphans = items.filter((i) => !sectionIds.has(i.section));
    if (orphans.length > 0) {
      rows.push(...orphans);
    }
    return rows;
  }, [sections, items]);

  // Mutations
  const updateItemMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<CreateEstimateItemData> & { custom_data?: Record<string, string> } }) =>
      api.estimates.updateEstimateItem(id, data as Partial<CreateEstimateItemData>),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['estimate-items', estimateId] });
    },
    onError: (error) => {
      toast.error(`Ошибка обновления: ${error instanceof Error ? error.message : 'Неизвестная ошибка'}`);
    },
  });

  const createItemMutation = useMutation({
    mutationFn: (data: CreateEstimateItemData) => api.estimates.createEstimateItem(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['estimate-items', estimateId] });
      setAddDialogOpen(false);
      setNewItemForm({
        estimate: estimateId,
        section: sections[0]?.id,
        name: '',
        unit: 'шт',
        quantity: '1',
        material_unit_price: '0',
        work_unit_price: '0',
      });
      toast.success('Строка добавлена');
    },
    onError: (error) => {
      toast.error(`Ошибка: ${error instanceof Error ? error.message : 'Неизвестная ошибка'}`);
    },
  });

  const deleteItemMutation = useMutation({
    mutationFn: (id: number) => api.estimates.deleteEstimateItem(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['estimate-items', estimateId] });
      toast.success('Строка удалена');
    },
    onError: (error) => {
      toast.error(`Ошибка: ${error instanceof Error ? error.message : 'Неизвестная ошибка'}`);
    },
  });

  const bulkCreateMutation = useMutation({
    mutationFn: (newItems: CreateEstimateItemData[]) => api.estimates.bulkCreateEstimateItems(newItems),
    onSuccess: (created) => {
      queryClient.invalidateQueries({ queryKey: ['estimate-items', estimateId] });
      setPasteDialogOpen(false);
      setPasteText('');
      toast.success(`Создано ${Array.isArray(created) ? created.length : 0} строк`);
    },
    onError: (error) => {
      toast.error(`Ошибка: ${error instanceof Error ? error.message : 'Неизвестная ошибка'}`);
    },
  });

  const bulkMoveMutation = useMutation({
    mutationFn: ({ itemIds, targetPosition }: { itemIds: number[]; targetPosition: number }) =>
      api.estimates.bulkMoveEstimateItems(itemIds, targetPosition),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['estimate-items', estimateId] });
      setMoveTargetPosition('');
      setRowSelection({});
      toast.success(`Перемещено ${result.moved} строк`);
    },
    onError: (error) => {
      toast.error(`Ошибка: ${error instanceof Error ? error.message : 'Неизвестная ошибка'}`);
    },
  });

  const invalidateAll = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['estimate-items', estimateId] });
    queryClient.invalidateQueries({ queryKey: ['estimate-sections', estimateId] });
    queryClient.invalidateQueries({ queryKey: ['estimate', String(estimateId)] });
  }, [queryClient, estimateId]);

  const promoteMutation = useMutation({
    mutationFn: (itemId: number) => api.estimates.promoteItemToSection(itemId),
    onSuccess: () => { invalidateAll(); toast.success('Строка назначена разделом'); },
    onError: () => { toast.error('Ошибка назначения раздела'); },
  });

  const demoteMutation = useMutation({
    mutationFn: (sectionId: number) => api.estimates.demoteSectionToItem(sectionId),
    onSuccess: () => { invalidateAll(); toast.success('Раздел снят'); },
    onError: () => { toast.error('Ошибка снятия раздела'); },
  });

  const moveMutation = useMutation({
    mutationFn: ({ itemId, direction }: { itemId: number; direction: 'up' | 'down' }) =>
      api.estimates.moveEstimateItem(itemId, { direction }),
    onSuccess: () => { invalidateAll(); },
    onError: () => { toast.error('Ошибка перемещения'); },
  });

  const moveToSectionMutation = useMutation({
    mutationFn: ({ itemId, targetSectionId }: { itemId: number; targetSectionId: number }) =>
      api.estimates.moveEstimateItem(itemId, { target_section_id: targetSectionId }),
    onSuccess: () => { invalidateAll(); toast.success('Строка перемещена в другой раздел'); },
    onError: () => { toast.error('Ошибка перемещения'); },
  });

  // Context menu state
  const [contextMenu, setContextMenu] = useState<{
    x: number; y: number; itemId: number; sectionId: number;
  } | null>(null);

  useEffect(() => {
    if (!contextMenu) return;
    const close = () => setContextMenu(null);
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, [contextMenu]);

  const handleCellEdit = useCallback(
    (rowIndex: number, columnId: string, value: unknown) => {
      if (readOnly) return;
      const row = displayRows[rowIndex];
      if (!row || row._isSection) return;

      const key = `${row.id}-${columnId}`;
      if (debounceTimers.current[key]) {
        clearTimeout(debounceTimers.current[key]);
      }

      debounceTimers.current[key] = setTimeout(() => {
        const colDef = effectiveConfig.find((c) => c.key === columnId);
        if (colDef && colDef.type.startsWith('custom_')) {
          const existingCustomData = row.custom_data || {};
          updateItemMutation.mutate({
            id: row.id,
            data: { custom_data: { ...existingCustomData, [columnId]: String(value ?? '') } },
          });
        } else {
          updateItemMutation.mutate({
            id: row.id,
            data: { [columnId]: value },
          });
        }
        delete debounceTimers.current[key];
      }, DEBOUNCE_MS);
    },
    [displayRows, readOnly, updateItemMutation, effectiveConfig],
  );

  const handleDeleteSelected = useCallback(() => {
    const selectedIds = Object.keys(rowSelection)
      .filter((key) => rowSelection[key])
      .map((key) => Number(key))
      .filter((id) => id > 0);

    if (selectedIds.length === 0) return;

    Promise.all(selectedIds.map((id) => api.estimates.deleteEstimateItem(id))).then(() => {
      queryClient.invalidateQueries({ queryKey: ['estimate-items', estimateId] });
      setRowSelection({});
      toast.success(`Удалено ${selectedIds.length} строк`);
    });
  }, [rowSelection, queryClient, estimateId]);

  const handleMoveSelected = useCallback(() => {
    const pos = parseInt(moveTargetPosition, 10);
    if (!pos || pos < 1) {
      toast.error('Введите корректный номер позиции');
      return;
    }
    const selectedIds = Object.keys(rowSelection)
      .filter((key) => rowSelection[key])
      .map((key) => Number(key))
      .filter((id) => id > 0);

    if (selectedIds.length === 0) return;

    bulkMoveMutation.mutate({ itemIds: selectedIds, targetPosition: pos });
  }, [rowSelection, moveTargetPosition, bulkMoveMutation]);

  const handlePasteFromExcel = useCallback(() => {
    if (!pasteText.trim()) return;
    const lines = pasteText.trim().split('\n');
    const newItems: CreateEstimateItemData[] = lines
      .map((line): CreateEstimateItemData | null => {
        const cols = line.split('\t');
        if (cols.length < 2) return null;
        return {
          estimate: estimateId,
          section: sections[0]?.id ?? 0,
          name: cols[0]?.trim() || '',
          model_name: cols[1]?.trim() || '',
          unit: cols[2]?.trim() || 'шт',
          quantity: cols[3]?.trim() || '1',
          material_unit_price: cols[4]?.trim() || '0',
          work_unit_price: cols[5]?.trim() || '0',
        };
      })
      .filter((x): x is CreateEstimateItemData => x !== null && x.name !== '');

    if (newItems.length === 0) {
      toast.error('Не удалось распознать строки');
      return;
    }

    bulkCreateMutation.mutate(newItems);
  }, [pasteText, estimateId, sections, bulkCreateMutation]);

  const handleAddItem = useCallback(() => {
    if (!newItemForm.name?.trim()) {
      toast.error('Введите наименование');
      return;
    }
    createItemMutation.mutate({
      estimate: estimateId,
      section: newItemForm.section || sections[0]?.id || 0,
      name: newItemForm.name,
      model_name: newItemForm.model_name,
      unit: newItemForm.unit || 'шт',
      quantity: newItemForm.quantity || '1',
      material_unit_price: newItemForm.material_unit_price || '0',
      work_unit_price: newItemForm.work_unit_price || '0',
    });
  }, [newItemForm, estimateId, sections, createItemMutation]);

  const totals = useMemo(() => {
    const aggCols = effectiveConfig.filter((c) => c.aggregatable && c.visible);
    const sums: Record<string, number> = {};
    for (const col of aggCols) sums[col.key] = 0;

    items.forEach((item) => {
      for (const col of aggCols) {
        let val: number | undefined;
        if (col.type === 'builtin' && col.builtin_field) {
          val = parseFloat((item as unknown as Record<string, string>)[col.builtin_field!]) || 0;
        } else if (col.type === 'formula') {
          const sv = item.computed_values?.[col.key];
          val = sv != null ? parseFloat(sv) : 0;
        } else if (col.type === 'custom_number') {
          val = parseFloat(item.custom_data?.[col.key] || '0') || 0;
        }
        if (val != null) sums[col.key] += val;
      }
    });
    return { aggCols, sums };
  }, [items, effectiveConfig]);

  const selectedCount = Object.values(rowSelection).filter(Boolean).length;

  return {
    items,
    sections,
    isLoading,
    effectiveConfig,
    displayRows,
    rowSelection,
    setRowSelection,
    globalFilter,
    setGlobalFilter,
    isAddDialogOpen,
    setAddDialogOpen,
    isPasteDialogOpen,
    setPasteDialogOpen,
    isImportDialogOpen,
    setImportDialogOpen,
    isAutoMatchOpen,
    setAutoMatchOpen,
    isAutoMatchWorksOpen,
    setAutoMatchWorksOpen,
    pasteText,
    setPasteText,
    moveTargetPosition,
    setMoveTargetPosition,
    newItemForm,
    setNewItemForm,
    contextMenu,
    setContextMenu,
    // mutations
    updateItemMutation,
    createItemMutation,
    deleteItemMutation,
    bulkCreateMutation,
    bulkMoveMutation,
    promoteMutation,
    demoteMutation,
    moveMutation,
    moveToSectionMutation,
    // handlers
    handleCellEdit,
    handleDeleteSelected,
    handleMoveSelected,
    handlePasteFromExcel,
    handleAddItem,
    // computed
    totals,
    selectedCount,
  };
}
