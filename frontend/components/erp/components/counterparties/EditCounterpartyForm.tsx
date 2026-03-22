import { useState } from 'react';
import { Counterparty, CreateCounterpartyData } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface EditCounterpartyFormProps {
  counterparty: Counterparty;
  onSubmit: (data: Partial<CreateCounterpartyData>) => void;
  isLoading: boolean;
}

export function EditCounterpartyForm({ counterparty, onSubmit, isLoading }: EditCounterpartyFormProps) {
  const [formData, setFormData] = useState<Partial<CreateCounterpartyData>>({
    name: counterparty.name,
    short_name: counterparty.short_name,
    inn: counterparty.inn,
    kpp: counterparty.kpp,
    ogrn: counterparty.ogrn,
    type: counterparty.type,
    vendor_subtype: counterparty.vendor_subtype,
    legal_form: counterparty.legal_form,
    address: counterparty.address || '',
    contact_info: counterparty.contact_info,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name?.trim() || !formData.inn?.trim() || !formData.legal_form) {
      toast.error('Заполните обязательные поля');
      return;
    }
    if (formData.vendor_subtype && formData.type === 'customer') {
      toast.error('Подтип можно указывать только для контрагентов типа "Исполнитель-Поставщик"');
      return;
    }
    const dataToSubmit: Partial<CreateCounterpartyData> = {
      ...formData,
      short_name: formData.short_name?.trim() || undefined,
      kpp: formData.kpp?.trim() || undefined,
      ogrn: formData.ogrn?.trim() || undefined,
      address: formData.address?.trim() || undefined,
      contact_info: formData.contact_info?.trim() || undefined,
      vendor_subtype: (formData.type === 'vendor' || formData.type === 'both') ? formData.vendor_subtype : undefined,
    };
    onSubmit(dataToSubmit);
  };

  const showVendorSubtype = formData.type === 'vendor' || formData.type === 'both';

  return (
    <form onSubmit={handleSubmit} className="space-y-4 mt-4">
      <div>
        <Label htmlFor="edit-name">Название <span className="text-red-500">*</span></Label>
        <Input id="edit-name" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} disabled={isLoading} className="mt-1.5" required />
      </div>
      <div>
        <Label htmlFor="edit-short_name">Краткое название</Label>
        <Input id="edit-short_name" value={formData.short_name} onChange={(e) => setFormData({ ...formData, short_name: e.target.value })} disabled={isLoading} className="mt-1.5" />
      </div>
      <div>
        <Label htmlFor="edit-legal_form">Правовая форма <span className="text-red-500">*</span></Label>
        <Select value={formData.legal_form} onValueChange={(value: string) => setFormData({ ...formData, legal_form: value })} disabled={isLoading}>
          <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ooo">ООО</SelectItem>
            <SelectItem value="ip">ИП</SelectItem>
            <SelectItem value="fiz">Физ.лицо</SelectItem>
            <SelectItem value="self_employed">Самозанятый</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label htmlFor="edit-inn">ИНН <span className="text-red-500">*</span></Label>
        <Input id="edit-inn" value={formData.inn} onChange={(e) => setFormData({ ...formData, inn: e.target.value })} disabled={isLoading} className="mt-1.5" required />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="edit-kpp">КПП</Label>
          <Input id="edit-kpp" value={formData.kpp} onChange={(e) => setFormData({ ...formData, kpp: e.target.value })} disabled={isLoading} className="mt-1.5" />
        </div>
        <div>
          <Label htmlFor="edit-ogrn">ОГРН</Label>
          <Input id="edit-ogrn" value={formData.ogrn} onChange={(e) => setFormData({ ...formData, ogrn: e.target.value })} disabled={isLoading} className="mt-1.5" />
        </div>
      </div>
      <div>
        <Label htmlFor="edit-address">Юридический адрес</Label>
        <Input id="edit-address" value={formData.address} onChange={(e) => setFormData({ ...formData, address: e.target.value })} disabled={isLoading} className="mt-1.5" />
      </div>
      <div>
        <Label htmlFor="edit-type">Тип <span className="text-red-500">*</span></Label>
        <Select value={formData.type} onValueChange={(value: string) => { setFormData({ ...formData, type: value as CreateCounterpartyData['type'], vendor_subtype: value === 'customer' ? null : formData.vendor_subtype }); }} disabled={isLoading}>
          <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="customer">Заказчик</SelectItem>
            <SelectItem value="potential_customer">Потенциальный Заказчик</SelectItem>
            <SelectItem value="vendor">Исполнитель-Поставщик</SelectItem>
            <SelectItem value="both">Заказчик и Исполнитель-Поставщик</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {showVendorSubtype && (
        <div>
          <Label htmlFor="edit-vendor_subtype">Подтип</Label>
          <Select value={formData.vendor_subtype || 'null'} onValueChange={(value: string) => { setFormData({ ...formData, vendor_subtype: value === 'null' ? null : value as NonNullable<CreateCounterpartyData['vendor_subtype']> }); }} disabled={isLoading}>
            <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="null">Не указано</SelectItem>
              <SelectItem value="supplier">Поставщик</SelectItem>
              <SelectItem value="executor">Исполнитель</SelectItem>
              <SelectItem value="both">Исполнитель и Поставщик</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}
      <div>
        <Label htmlFor="edit-contact_info">Контакты</Label>
        <Textarea id="edit-contact_info" value={formData.contact_info} onChange={(e) => setFormData({ ...formData, contact_info: e.target.value })} disabled={isLoading} className="mt-1.5" rows={2} />
      </div>
      <div className="flex gap-3 pt-4">
        <Button type="submit" className="flex-1 bg-blue-600 hover:bg-blue-700" disabled={isLoading}>
          {isLoading ? (<><Loader2 className="w-4 h-4 mr-2 animate-spin" />Обновление...</>) : 'Обновить'}
        </Button>
      </div>
    </form>
  );
}
