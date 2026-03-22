import { PriceListItem, UpdatePriceListItemData, CreatePriceListAgreementData, CreatePriceListData, Counterparty, PriceListDetail} from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Loader2, Info } from 'lucide-react';
import { toast } from 'sonner';
import { UseMutationResult } from '@tanstack/react-query';

// ---- Edit Item Dialog ----

interface EditItemDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingItem: PriceListItem | null;
  formData: UpdatePriceListItemData;
  onFormChange: (data: UpdatePriceListItemData) => void;
  onSubmit: (e: React.FormEvent) => void;
  isPending: boolean;
}

export function EditItemDialog({ open, onOpenChange, editingItem, formData, onFormChange, onSubmit, isPending }: EditItemDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Редактировать позицию</DialogTitle>
          <DialogDescription>Измените параметры позиции прайс-листа. Поля с переопределением опциональны.</DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          {editingItem && (
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-sm text-gray-700"><strong>{editingItem.work_item_detail.name}</strong></p>
              <p className="text-xs text-gray-500 mt-1">Базовые значения: Часы = {editingItem.work_item_detail.hours}, Разряд = {editingItem.work_item_detail.grade}, Коэфф. = {editingItem.work_item_detail.coefficient}</p>
            </div>
          )}
          <div>
            <Label htmlFor="hours_override">Часы (переопределение)</Label>
            <Input id="hours_override" type="number" step="0.01" value={formData.hours_override || ''} onChange={(e) => onFormChange({ ...formData, hours_override: e.target.value || null })} placeholder="Оставьте пустым для использования базового значения" className="mt-1.5" />
          </div>
          <div>
            <Label htmlFor="coefficient_override">Коэффициент (переопределение)</Label>
            <Input id="coefficient_override" type="number" step="0.01" value={formData.coefficient_override || ''} onChange={(e) => onFormChange({ ...formData, coefficient_override: e.target.value || null })} placeholder="Оставьте пустым для использования базового значения" className="mt-1.5" />
          </div>
          <div>
            <Label htmlFor="grade_override" className="flex items-center gap-2">
              Переопределить разряд
              <TooltipProvider><Tooltip><TooltipTrigger type="button"><Info className="w-3.5 h-3.5 text-gray-400" /></TooltipTrigger><TooltipContent className="max-w-xs"><p className="text-xs">Можно указать дробное значение (например, 2.5, 3.65) для работ, выполняемых несколькими монтажниками с разными разрядами. Оставьте пустым для использования разряда из работы.</p></TooltipContent></Tooltip></TooltipProvider>
            </Label>
            <Input id="grade_override" type="number" step="0.01" min="1.00" max="5.00" value={formData.grade_override || ''} onChange={(e) => {
              const value = e.target.value;
              if (value && (parseFloat(value) < 1 || parseFloat(value) > 5)) { toast.error('Разряд должен быть от 1.00 до 5.00'); return; }
              onFormChange({ ...formData, grade_override: value || null });
            }} placeholder="2.5, 3.65, 4.2" className="mt-1.5" />
            <p className="text-xs text-gray-500 mt-1.5">Примеры: 2.5 (средний между 2 и 3), 3.65 (взвешенный 3 и 4)</p>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox id="is_included" checked={formData.is_included} onCheckedChange={(checked) => onFormChange({ ...formData, is_included: checked as boolean })} />
            <Label htmlFor="is_included" className="cursor-pointer">Включена в прайс-лист</Label>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>Отмена</Button>
            <Button type="submit" disabled={isPending} className="bg-blue-600 hover:bg-blue-700">
              {isPending ? (<><Loader2 className="w-4 h-4 mr-2 animate-spin" />Сохранение...</>) : 'Сохранить'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ---- Create Agreement Dialog ----

interface CreateAgreementDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  formData: CreatePriceListAgreementData;
  onFormChange: (data: CreatePriceListAgreementData) => void;
  onSubmit: (e: React.FormEvent) => void;
  onReset: () => void;
  counterparties: Counterparty[] | undefined;
  isPending: boolean;
}

export function CreateAgreementDialog({ open, onOpenChange, formData, onFormChange, onSubmit, onReset, counterparties, isPending }: CreateAgreementDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Добавить согласование</DialogTitle>
          <DialogDescription>Добавьте информацию о согласовании прайс-листа с контрагентом.</DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <Label htmlFor="counterparty">Контрагент *</Label>
            <select id="counterparty" value={formData.counterparty} onChange={(e) => onFormChange({ ...formData, counterparty: Number(e.target.value) })} className="mt-1.5 w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" required>
              <option value={0}>Выберите контрагента</option>
              {counterparties?.map((c) => (<option key={c.id} value={c.id}>{c.name} ({c.inn})</option>))}
            </select>
            <p className="text-xs text-gray-500 mt-1.5">Только контрагенты типа "Поставщик" или "Исполнитель"</p>
          </div>
          <div><Label htmlFor="agreed_date">Дата согласования *</Label><Input id="agreed_date" type="date" value={formData.agreed_date} onChange={(e) => onFormChange({ ...formData, agreed_date: e.target.value })} required className="mt-1.5" /></div>
          <div>
            <Label htmlFor="notes">Примечания</Label>
            <textarea id="notes" value={formData.notes} onChange={(e) => onFormChange({ ...formData, notes: e.target.value })} placeholder="Дополнительная информация о согласовании" rows={3} className="mt-1.5 w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => { onOpenChange(false); onReset(); }} disabled={isPending}>Отмена</Button>
            <Button type="submit" disabled={isPending} className="bg-blue-600 hover:bg-blue-700">
              {isPending ? (<><Loader2 className="w-4 h-4 mr-2 animate-spin" />Создание...</>) : 'Создать'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ---- Edit Price List Dialog ----

interface EditPriceListDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  formData: Partial<CreatePriceListData>;
  onFormChange: (data: Partial<CreatePriceListData>) => void;
  onSubmit: () => void;
  isPending: boolean;
}

export function EditPriceListDialog({ open, onOpenChange, formData, onFormChange, onSubmit, isPending }: EditPriceListDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Редактировать прайс-лист</DialogTitle>
          <DialogDescription>Измените основные параметры прайс-листа (номер, название, дату, статус, ставки разрядов).</DialogDescription>
        </DialogHeader>
        <form onSubmit={(e) => { e.preventDefault(); onSubmit(); }} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div><Label htmlFor="pl_number">Номер *</Label><Input id="pl_number" value={formData.number} onChange={(e) => onFormChange({ ...formData, number: e.target.value })} required className="mt-1.5" /></div>
            <div><Label htmlFor="pl_date">Дата *</Label><Input id="pl_date" type="date" value={formData.date} onChange={(e) => onFormChange({ ...formData, date: e.target.value })} required className="mt-1.5" /></div>
          </div>
          <div><Label htmlFor="pl_name">Название</Label><Input id="pl_name" value={formData.name} onChange={(e) => onFormChange({ ...formData, name: e.target.value })} placeholder="Опциональное описание прайс-листа" className="mt-1.5" /></div>
          <div>
            <Label htmlFor="pl_status">Статус *</Label>
            <select id="pl_status" value={formData.status} onChange={(e) => onFormChange({ ...formData, status: e.target.value as 'draft' | 'active' | 'archived' })} className="mt-1.5 w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" required>
              <option value="draft">Черновик</option><option value="active">Активный</option><option value="archived">Архивный</option>
            </select>
            <p className="text-xs text-gray-500 mt-1.5">Черновик — редактируемый, Активный — используется в работе, Архивный — не используется</p>
          </div>
          <div>
            <h4 className="font-medium text-gray-900 mb-3">Часовые ставки по разрядам</h4>
            <div className="grid grid-cols-5 gap-3">
              {[1, 2, 3, 4, 5].map((grade) => (
                <div key={grade}>
                  <Label htmlFor={`grade_${grade}_rate`} className="text-xs">Разряд {grade}</Label>
                  <Input id={`grade_${grade}_rate`} type="number" step="0.01" value={formData[`grade_${grade}_rate` as keyof typeof formData] as string} onChange={(e) => onFormChange({ ...formData, [`grade_${grade}_rate`]: e.target.value })} required className="mt-1.5" placeholder="P/ч" />
                </div>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>Отмена</Button>
            <Button type="submit" disabled={isPending} className="bg-blue-600 hover:bg-blue-700">
              {isPending ? (<><Loader2 className="w-4 h-4 mr-2 animate-spin" />Сохранение...</>) : 'Сохранить'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ---- Create Version Dialog ----

interface CreateVersionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  priceList: PriceListDetail;
  onConfirm: () => void;
  isPending: boolean;
}

export function CreateVersionDialog({ open, onOpenChange, priceList, onConfirm, isPending }: CreateVersionDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Создать новую версию прайс-листа</DialogTitle>
          <DialogDescription>Создание новой версии прайс-листа</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-sm text-blue-800 mb-2"><strong>Новая версия наследует все данные:</strong></p>
            <ul className="list-disc list-inside text-sm text-blue-800 space-y-1"><li>Все ставки по разрядам</li><li>Все позиции прайс-листа</li></ul>
          </div>
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
            <p className="text-sm text-amber-800 mb-2"><strong>Изменения:</strong></p>
            <ul className="list-disc list-inside text-sm text-amber-800 space-y-1">
              <li>Текущая версия будет переведена в статус "Архивный"</li>
              <li>Новая версия получит статус "Черновик"</li>
              <li>Номер новой версии: {priceList?.number}-v{(priceList?.version_number || 0) + 1}</li>
            </ul>
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>Отмена</Button>
          <Button onClick={onConfirm} disabled={isPending} className="bg-blue-600 hover:bg-blue-700">
            {isPending ? (<><Loader2 className="w-4 h-4 mr-2 animate-spin" />Создание...</>) : 'Создать версию'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---- Delete Agreement Dialog ----

interface DeleteAgreementDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}

export function DeleteAgreementDialog({ open, onOpenChange, onConfirm }: DeleteAgreementDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Удалить согласование?</AlertDialogTitle>
          <AlertDialogDescription>Вы уверены, что хотите удалить это согласование? Это действие нельзя отменить.</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Отмена</AlertDialogCancel>
          <AlertDialogAction className="bg-red-600 hover:bg-red-700" onClick={onConfirm}>Удалить</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
