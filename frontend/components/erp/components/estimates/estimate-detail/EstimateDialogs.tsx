import { EstimateSection, EstimateSubsection, EstimateCharacteristic, EstimateList } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Loader2, Trash2 } from 'lucide-react';

// ---- Section Dialog ----

interface SectionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editing: EstimateSection | null;
  form: { name: string; sort_order: number };
  onFormChange: (form: { name: string; sort_order: number }) => void;
  onSubmit: () => void;
}

export function SectionDialog({ open, onOpenChange, editing, form, onFormChange, onSubmit }: SectionDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{editing ? 'Редактировать раздел' : 'Создать раздел'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label htmlFor="section_name">Название раздела *</Label>
            <Input
              id="section_name"
              value={form.name}
              onChange={(e) => onFormChange({ ...form, name: e.target.value })}
              placeholder="Введите название"
              className="mt-1.5"
            />
          </div>
          <div>
            <Label htmlFor="section_sort">Порядок сортировки</Label>
            <Input
              id="section_sort"
              type="number"
              value={form.sort_order}
              onChange={(e) => onFormChange({ ...form, sort_order: Number(e.target.value) })}
              className="mt-1.5"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Отмена</Button>
          <Button onClick={onSubmit} className="bg-blue-600 hover:bg-blue-700">
            {editing ? 'Сохранить' : 'Создать'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---- Subsection Dialog ----

interface SubsectionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editing: EstimateSubsection | null;
  form: {
    name: string;
    materials_sale: string;
    works_sale: string;
    materials_purchase: string;
    works_purchase: string;
    sort_order: number;
  };
  onFormChange: (form: SubsectionDialogProps['form']) => void;
  onSubmit: () => void;
}

export function SubsectionDialog({ open, onOpenChange, editing, form, onFormChange, onSubmit }: SubsectionDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>{editing ? 'Редактировать подраздел' : 'Создать подраздел'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label htmlFor="subsection_name">Название подраздела *</Label>
            <Input
              id="subsection_name"
              value={form.name}
              onChange={(e) => onFormChange({ ...form, name: e.target.value })}
              placeholder="Введите название"
              className="mt-1.5"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="materials_sale">Материалы — продажа *</Label>
              <Input
                id="materials_sale"
                type="number"
                step="0.01"
                value={form.materials_sale}
                onChange={(e) => onFormChange({ ...form, materials_sale: e.target.value })}
                className="mt-1.5"
              />
            </div>
            <div>
              <Label htmlFor="works_sale">Работы — продажа *</Label>
              <Input
                id="works_sale"
                type="number"
                step="0.01"
                value={form.works_sale}
                onChange={(e) => onFormChange({ ...form, works_sale: e.target.value })}
                className="mt-1.5"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="materials_purchase">Материалы — закупка *</Label>
              <Input
                id="materials_purchase"
                type="number"
                step="0.01"
                value={form.materials_purchase}
                onChange={(e) => onFormChange({ ...form, materials_purchase: e.target.value })}
                className="mt-1.5"
              />
            </div>
            <div>
              <Label htmlFor="works_purchase">Работы — закупка *</Label>
              <Input
                id="works_purchase"
                type="number"
                step="0.01"
                value={form.works_purchase}
                onChange={(e) => onFormChange({ ...form, works_purchase: e.target.value })}
                className="mt-1.5"
              />
            </div>
          </div>

          <div>
            <Label htmlFor="subsection_sort">Порядок сортировки</Label>
            <Input
              id="subsection_sort"
              type="number"
              value={form.sort_order}
              onChange={(e) => onFormChange({ ...form, sort_order: Number(e.target.value) })}
              className="mt-1.5"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Отмена</Button>
          <Button onClick={onSubmit} className="bg-blue-600 hover:bg-blue-700">
            {editing ? 'Сохранить' : 'Создать'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---- Characteristic Dialog ----

interface CharacteristicDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editing: EstimateCharacteristic | null;
  form: { name: string; purchase_amount: string; sale_amount: string };
  onFormChange: (form: CharacteristicDialogProps['form']) => void;
  onSubmit: () => void;
}

export function CharacteristicDialog({ open, onOpenChange, editing, form, onFormChange, onSubmit }: CharacteristicDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{editing ? 'Редактировать характеристику' : 'Создать характеристику'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label htmlFor="char_name">Название *</Label>
            <Input
              id="char_name"
              value={form.name}
              onChange={(e) => onFormChange({ ...form, name: e.target.value })}
              placeholder="Введите название"
              className="mt-1.5"
              disabled={editing?.is_auto_calculated}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="char_purchase">Сумма закупки *</Label>
              <Input
                id="char_purchase"
                type="number"
                step="0.01"
                value={form.purchase_amount}
                onChange={(e) => onFormChange({ ...form, purchase_amount: e.target.value })}
                className="mt-1.5"
              />
            </div>
            <div>
              <Label htmlFor="char_sale">Сумма продажи *</Label>
              <Input
                id="char_sale"
                type="number"
                step="0.01"
                value={form.sale_amount}
                onChange={(e) => onFormChange({ ...form, sale_amount: e.target.value })}
                className="mt-1.5"
              />
            </div>
          </div>

          {editing?.is_auto_calculated && (
            <div className="bg-yellow-50 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3 text-sm text-yellow-800 dark:text-yellow-400">
              При редактировании автоматической характеристики она станет ручной и больше не будет обновляться автоматически.
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Отмена</Button>
          <Button onClick={onSubmit} className="bg-blue-600 hover:bg-blue-700">
            {editing ? 'Сохранить' : 'Создать'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---- Delete Confirm Dialogs ----

interface DeleteConfirmProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  onConfirm: () => void;
}

export function DeleteConfirmDialog({ open, onOpenChange, title, description, onConfirm }: DeleteConfirmProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Отмена</AlertDialogCancel>
          <AlertDialogAction className="bg-red-600 hover:bg-red-700" onClick={onConfirm}>
            Удалить
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

// ---- Auto Characteristic Warning ----

interface AutoCharWarningProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}

export function AutoCharWarningDialog({ open, onOpenChange, onConfirm }: AutoCharWarningProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Редактирование автоматической характеристики</AlertDialogTitle>
          <AlertDialogDescription>
            Эта характеристика рассчитывается автоматически. При редактировании она станет ручной. Продолжить?
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Отмена</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>Продолжить</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

// ---- Version / Mounting Estimate Confirm Dialogs ----

interface ConfirmActionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  onConfirm: () => void;
}

export function ConfirmActionDialog({ open, onOpenChange, title, description, onConfirm }: ConfirmActionDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Отмена</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>Создать</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

// ---- Version History Dialog ----

interface VersionHistoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  versions: EstimateList[] | undefined;
  estimateNumber: string;
  onSelectVersion: (versionId: number) => void;
}

export function VersionHistoryDialog({ open, onOpenChange, versions, estimateNumber, onSelectVersion }: VersionHistoryDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px]">
        <DialogHeader>
          <DialogTitle>История версий</DialogTitle>
          <DialogDescription>Все версии сметы {estimateNumber}</DialogDescription>
        </DialogHeader>
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {versions && versions.length > 0 ? (
            versions.map((version) => (
              <div
                key={version.id}
                onClick={() => onSelectVersion(version.id)}
                className="flex items-center justify-between p-4 border border-border rounded-lg hover:bg-muted cursor-pointer transition-colors"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-foreground">{version.number}</span>
                    <span className="text-sm text-muted-foreground">v{version.version_number}</span>
                  </div>
                  <div className="text-sm text-muted-foreground mt-1">{version.name}</div>
                </div>
                <Button variant="ghost" size="sm">Открыть</Button>
              </div>
            ))
          ) : (
            <p className="text-center text-muted-foreground py-8">Нет других версий</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ---- Delete Estimate Dialog ----

interface DeleteEstimateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  estimateName: string;
  confirmName: string;
  onConfirmNameChange: (name: string) => void;
  onDelete: () => void;
  isPending: boolean;
}

export function DeleteEstimateDialog({
  open,
  onOpenChange,
  estimateName,
  confirmName,
  onConfirmNameChange,
  onDelete,
  isPending,
}: DeleteEstimateDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-red-600">Удаление сметы</DialogTitle>
          <DialogDescription>
            Это действие необратимо. Все строки, разделы и характеристики сметы будут удалены.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div>
            <Label className="text-sm text-muted-foreground">
              Для подтверждения введите название сметы: <span className="font-semibold text-foreground">{estimateName}</span>
            </Label>
            <Input
              className="mt-2"
              placeholder="Введите название сметы"
              value={confirmName}
              onChange={(e) => onConfirmNameChange(e.target.value)}
              autoFocus
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Отмена</Button>
          <Button
            variant="destructive"
            disabled={confirmName !== estimateName || isPending}
            onClick={onDelete}
          >
            {isPending ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Удаление...</>
            ) : (
              <><Trash2 className="w-4 h-4 mr-2" />Удалить смету</>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
