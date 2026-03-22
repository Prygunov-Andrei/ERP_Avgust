import type { EstimateItem, EstimateSection, ColumnDef as ColumnDefAPI } from '@/lib/api';

export type EstimateItemsEditorProps = {
  estimateId: number;
  readOnly?: boolean;
  columnConfig?: ColumnDefAPI[];
  onOpenColumnConfig?: () => void;
};

// Union type for mixed table rows (sections as virtual header rows + real items)
export type TableRow = EstimateItem & {
  _isSection?: boolean;
  _sectionId?: number;
};

// Empty section row factory
export function makeSectionRow(section: EstimateSection): TableRow {
  return {
    id: -(section.id),
    estimate: section.estimate,
    section: 0,
    subsection: null,
    sort_order: section.sort_order,
    item_number: 0,
    name: section.name,
    model_name: '',
    unit: '',
    quantity: '',
    material_unit_price: '',
    work_unit_price: '',
    material_total: '',
    work_total: '',
    line_total: '',
    product: null,
    work_item: null,
    is_analog: false,
    analog_reason: '',
    original_name: '',
    source_price_history: null,
    created_at: '',
    updated_at: '',
    _isSection: true,
    _sectionId: section.id,
  };
}
