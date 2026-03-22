import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api, LegalEntity, CreateLegalEntityData, TaxSystem } from '@/lib/api';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { CONSTANTS } from '@/constants';

interface LegalEntityFormProps {
  entity?: LegalEntity;
  onSubmit: (data: CreateLegalEntityData) => void;
  isLoading: boolean;
}

export function LegalEntityForm({ entity, onSubmit, isLoading }: LegalEntityFormProps) {
  const getTaxSystemId = (): string => {
    if (!entity) return '';
    if (entity.tax_system_id) return entity.tax_system_id.toString();
    if (typeof entity.tax_system === 'number') return entity.tax_system.toString();
    if (typeof entity.tax_system === 'object' && entity.tax_system.id) return entity.tax_system.id.toString();
    return '';
  };

  const [formData, setFormData] = useState({
    name: entity?.name || '',
    inn: entity?.inn || '',
    tax_system: getTaxSystemId(),
    short_name: entity?.short_name || '',
    kpp: entity?.kpp || '',
    ogrn: entity?.ogrn || '',
    director: entity?.director?.toString() || '',
    director_name: entity?.director_name || '',
    director_position: entity?.director_position || 'Генеральный директор',
  });

  const { data: taxSystems, isLoading: taxSystemsLoading } = useQuery({
    queryKey: ['tax-systems'],
    queryFn: () => api.core.getTaxSystems(),
    staleTime: CONSTANTS.REFERENCE_STALE_TIME_MS,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.inn.trim() || !formData.tax_system) {
      toast.error('Заполните обязательные поля');
      return;
    }

    const dataToSubmit: Record<string, unknown> = {
      name: formData.name,
      inn: formData.inn,
      tax_system: parseInt(formData.tax_system),
    };

    if (formData.short_name?.trim()) dataToSubmit.short_name = formData.short_name;
    if (formData.kpp?.trim()) dataToSubmit.kpp = formData.kpp;
    if (formData.ogrn?.trim()) dataToSubmit.ogrn = formData.ogrn;
    if (formData.director?.trim()) dataToSubmit.director = parseInt(formData.director);
    if (formData.director_name?.trim()) dataToSubmit.director_name = formData.director_name;
    if (formData.director_position?.trim()) dataToSubmit.director_position = formData.director_position;

    onSubmit(dataToSubmit as unknown as CreateLegalEntityData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 mt-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2">
          <Label htmlFor="name">
            Название <span className="text-red-500">*</span>
          </Label>
          <Input
            id="name"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder="ООО Ромашка"
            disabled={isLoading}
            className="mt-1.5"
            required
          />
        </div>

        <div>
          <Label htmlFor="short_name">Краткое название</Label>
          <Input
            id="short_name"
            value={formData.short_name}
            onChange={(e) => setFormData({ ...formData, short_name: e.target.value })}
            placeholder="Ромашка"
            disabled={isLoading}
            className="mt-1.5"
          />
        </div>

        <div>
          <Label htmlFor="inn">
            ИНН <span className="text-red-500">*</span>
          </Label>
          <Input
            id="inn"
            value={formData.inn}
            onChange={(e) => setFormData({ ...formData, inn: e.target.value })}
            placeholder="1234567890"
            disabled={isLoading}
            className="mt-1.5"
            required
          />
        </div>

        <div>
          <Label htmlFor="kpp">КПП</Label>
          <Input
            id="kpp"
            value={formData.kpp}
            onChange={(e) => setFormData({ ...formData, kpp: e.target.value })}
            placeholder="123456789"
            disabled={isLoading}
            className="mt-1.5"
          />
        </div>

        <div>
          <Label htmlFor="ogrn">ОГРН</Label>
          <Input
            id="ogrn"
            value={formData.ogrn}
            onChange={(e) => setFormData({ ...formData, ogrn: e.target.value })}
            placeholder="1234567890123"
            disabled={isLoading}
            className="mt-1.5"
          />
        </div>

        <div className="col-span-2">
          <Label htmlFor="tax_system">
            Система налогообложения <span className="text-red-500">*</span>
          </Label>
          <Select
            value={formData.tax_system}
            onValueChange={(value: string) => setFormData({ ...formData, tax_system: value })}
            disabled={isLoading || taxSystemsLoading}
          >
            <SelectTrigger className="mt-1.5">
              <SelectValue placeholder={taxSystemsLoading ? "Загрузка..." : "Выберите систему налогообложения"} />
            </SelectTrigger>
            <SelectContent>
              {taxSystems && taxSystems.length > 0 ? (
                taxSystems.map((system: TaxSystem) => (
                  <SelectItem key={system.id} value={system.id.toString()}>
                    {system.name}
                  </SelectItem>
                ))
              ) : (
                <div className="p-2 text-sm text-gray-500">Нет доступных систем</div>
              )}
            </SelectContent>
          </Select>
        </div>

        <div className="col-span-2 pt-4 border-t border-gray-200">
          <h4 className="text-sm font-medium text-gray-700 mb-3">Информация о директоре (для документов)</h4>
        </div>

        <div className="col-span-2">
          <Label htmlFor="director_name">ФИО директора</Label>
          <Input
            id="director_name"
            value={formData.director_name}
            onChange={(e) => setFormData({ ...formData, director_name: e.target.value })}
            placeholder="Иванов Иван Иванович"
            disabled={isLoading}
            className="mt-1.5"
          />
        </div>

        <div className="col-span-2">
          <Label htmlFor="director_position">Должность директора</Label>
          <Input
            id="director_position"
            value={formData.director_position}
            onChange={(e) => setFormData({ ...formData, director_position: e.target.value })}
            placeholder="Генеральный директор"
            disabled={isLoading}
            className="mt-1.5"
          />
        </div>
      </div>

      <div className="flex gap-3 pt-4">
        <Button type="submit" className="flex-1 bg-blue-600 hover:bg-blue-700" disabled={isLoading}>
          {isLoading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              {entity ? 'Сохранение...' : 'Создание...'}
            </>
          ) : (
            entity ? 'Сохранить' : 'Создать'
          )}
        </Button>
      </div>
    </form>
  );
}
