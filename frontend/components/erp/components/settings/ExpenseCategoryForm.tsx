import { useState } from 'react';
import { ExpenseCategory, CreateExpenseCategoryData } from '@/lib/api';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface ExpenseCategoryFormProps {
  category?: ExpenseCategory;
  categories: ExpenseCategory[];
  onSubmit: (data: CreateExpenseCategoryData) => void;
  isLoading: boolean;
}

export function ExpenseCategoryForm({ category, categories, onSubmit, isLoading }: ExpenseCategoryFormProps) {
  const [formData, setFormData] = useState({
    name: category?.name || '',
    code: category?.code || '',
    parent: category?.parent?.toString() || '',
    requires_contract: category?.requires_contract || false,
    is_active: category?.is_active !== false,
    sort_order: category?.sort_order?.toString() || '0',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      toast.error('Заполните обязательные поля');
      return;
    }

    const dataToSubmit: Record<string, unknown> = {
      name: formData.name,
      requires_contract: formData.requires_contract,
      is_active: formData.is_active,
      sort_order: parseInt(formData.sort_order) || 0,
    };

    if (formData.code?.trim()) dataToSubmit.code = formData.code;
    if (formData.parent?.trim() && formData.parent !== 'none') dataToSubmit.parent = parseInt(formData.parent);

    onSubmit(dataToSubmit as unknown as CreateExpenseCategoryData);
  };

  const availableParents = categories.filter(c => c.id !== category?.id);

  return (
    <form onSubmit={handleSubmit} className="space-y-4 mt-4">
      <div>
        <Label htmlFor="name">
          Название категории <span className="text-red-500">*</span>
        </Label>
        <Input
          id="name"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          placeholder="Коммунальные платежи"
          disabled={isLoading}
          className="mt-1.5"
          required
        />
      </div>

      <div>
        <Label htmlFor="code">Код</Label>
        <Input
          id="code"
          value={formData.code}
          onChange={(e) => setFormData({ ...formData, code: e.target.value })}
          placeholder="COMM"
          disabled={isLoading}
          className="mt-1.5"
        />
      </div>

      <div>
        <Label htmlFor="parent">Родительская категория</Label>
        <Select
          value={formData.parent}
          onValueChange={(value: string) => setFormData({ ...formData, parent: value })}
          disabled={isLoading}
        >
          <SelectTrigger className="mt-1.5">
            <SelectValue placeholder="Без родительской категории" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">Без родительской категории</SelectItem>
            {availableParents.map((cat) => (
              <SelectItem key={cat.id} value={cat.id.toString()}>
                {cat.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="sort_order">Порядок сортировки</Label>
          <Input
            id="sort_order"
            type="number"
            value={formData.sort_order}
            onChange={(e) => setFormData({ ...formData, sort_order: e.target.value })}
            placeholder="0"
            disabled={isLoading}
            className="mt-1.5"
          />
        </div>
      </div>

      <div className="flex items-center space-x-2 pt-2">
        <Checkbox
          id="requires_contract"
          checked={formData.requires_contract}
          onCheckedChange={(checked) =>
            setFormData({ ...formData, requires_contract: checked as boolean })
          }
          disabled={isLoading}
        />
        <Label
          htmlFor="requires_contract"
          className="text-sm font-normal cursor-pointer"
        >
          Требует привязки к договору
        </Label>
      </div>

      <div className="flex items-center space-x-2">
        <Checkbox
          id="is_active"
          checked={formData.is_active}
          onCheckedChange={(checked) =>
            setFormData({ ...formData, is_active: checked as boolean })
          }
          disabled={isLoading}
        />
        <Label
          htmlFor="is_active"
          className="text-sm font-normal cursor-pointer"
        >
          Активна
        </Label>
      </div>

      <div className="flex gap-3 pt-4">
        <Button type="submit" className="flex-1 bg-blue-600 hover:bg-blue-700" disabled={isLoading}>
          {isLoading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              {category ? 'Сохранение...' : 'Создание...'}
            </>
          ) : (
            category ? 'Сохранить' : 'Создать'
          )}
        </Button>
      </div>
    </form>
  );
}
