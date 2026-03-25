import { useState } from 'react';
import { Account, LegalEntity, CreateAccountData } from '@/lib/api';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface AccountFormProps {
  account?: Account;
  entities: LegalEntity[];
  onSubmit: (data: CreateAccountData) => void;
  isLoading: boolean;
}

export function AccountForm({ account, entities, onSubmit, isLoading }: AccountFormProps) {
  const [formData, setFormData] = useState({
    legal_entity: account?.legal_entity?.toString() || '',
    name: account?.name || '',
    number: account?.account_number || account?.number || '',
    account_type: account?.account_type || 'bank_account',
    bank_name: account?.bank_name || '',
    bik: account?.bic || account?.bik || '',
    currency: account?.currency || 'RUB',
    initial_balance: account?.initial_balance || account?.balance || '0.00',
    location: account?.location || '',
    description: account?.description || '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.legal_entity || !formData.name.trim() || !formData.currency || !formData.account_type) {
      toast.error('Заполните обязательные поля');
      return;
    }

    const dataToSubmit: Record<string, unknown> = {
      legal_entity: parseInt(formData.legal_entity),
      name: formData.name,
      account_type: formData.account_type,
      currency: formData.currency,
    };

    if (formData.bank_name?.trim()) dataToSubmit.bank_name = formData.bank_name;
    if (formData.bik?.trim()) dataToSubmit.bik = formData.bik;
    if (formData.location?.trim()) dataToSubmit.location = formData.location;
    if (formData.description?.trim()) dataToSubmit.description = formData.description;

    if (!account) {
      if (!formData.number.trim()) {
        toast.error('Заполните номер счета');
        return;
      }
      dataToSubmit.number = formData.number;
      dataToSubmit.initial_balance = formData.initial_balance;
    }

    onSubmit(dataToSubmit as unknown as CreateAccountData);
  };

  const showBankFields = formData.account_type === 'bank_account';
  const showLocationField = formData.account_type === 'cash';

  return (
    <form onSubmit={handleSubmit} className="space-y-4 mt-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2">
          <Label htmlFor="legal_entity">
            Юридическое лицо <span className="text-red-500">*</span>
          </Label>
          <Select
            value={formData.legal_entity}
            onValueChange={(value: string) => setFormData({ ...formData, legal_entity: value })}
            disabled={isLoading}
          >
            <SelectTrigger className="mt-1.5">
              <SelectValue placeholder="Выберите компанию" />
            </SelectTrigger>
            <SelectContent>
              {entities.length === 0 ? (
                <div className="p-2 text-sm text-muted-foreground">Нет доступных компаний</div>
              ) : (
                entities.map((entity) => (
                  <SelectItem key={entity.id} value={entity.id.toString()}>
                    {entity.name}
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
        </div>

        <div className="col-span-2">
          <Label htmlFor="name">
            Название счета <span className="text-red-500">*</span>
          </Label>
          <Input
            id="name"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder="Расчетный счет"
            disabled={isLoading}
            className="mt-1.5"
            required
          />
        </div>

        <div>
          <Label htmlFor="account_type">
            Тип счёта <span className="text-red-500">*</span>
          </Label>
          <Select
            value={formData.account_type}
            onValueChange={(value: string) => setFormData({ ...formData, account_type: value })}
            disabled={isLoading}
          >
            <SelectTrigger className="mt-1.5">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="bank_account">Расчётный счёт</SelectItem>
              <SelectItem value="cash">Касса</SelectItem>
              <SelectItem value="deposit">Депозит</SelectItem>
              <SelectItem value="currency_account">Валютный счёт</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label htmlFor="currency">
            Валюта <span className="text-red-500">*</span>
          </Label>
          <Select
            value={formData.currency}
            onValueChange={(value: string) => setFormData({ ...formData, currency: value })}
            disabled={isLoading}
          >
            <SelectTrigger className="mt-1.5">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="RUB">RUB (₽)</SelectItem>
              <SelectItem value="USD">USD ($)</SelectItem>
              <SelectItem value="EUR">EUR (€)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="col-span-2">
          <Label htmlFor="number">
            Номер счета <span className="text-red-500">*</span>
          </Label>
          <Input
            id="number"
            value={formData.number}
            onChange={(e) => setFormData({ ...formData, number: e.target.value })}
            placeholder="40702810000000000000"
            disabled={isLoading || !!account}
            className="mt-1.5"
            required={!account}
          />
          {account && (
            <p className="text-xs text-muted-foreground mt-1">Номер счета нельзя изменить</p>
          )}
        </div>

        {showBankFields && (
          <>
            <div>
              <Label htmlFor="bank_name">Банк</Label>
              <Input
                id="bank_name"
                value={formData.bank_name}
                onChange={(e) => setFormData({ ...formData, bank_name: e.target.value })}
                placeholder="Сбербанк"
                disabled={isLoading}
                className="mt-1.5"
              />
            </div>

            <div>
              <Label htmlFor="bik">БИК</Label>
              <Input
                id="bik"
                value={formData.bik}
                onChange={(e) => setFormData({ ...formData, bik: e.target.value })}
                placeholder="044525225"
                disabled={isLoading}
                className="mt-1.5"
              />
            </div>
          </>
        )}

        {showLocationField && (
          <div className="col-span-2">
            <Label htmlFor="location">Местоположение</Label>
            <Input
              id="location"
              value={formData.location}
              onChange={(e) => setFormData({ ...formData, location: e.target.value })}
              placeholder="Офис, г. Москва"
              disabled={isLoading}
              className="mt-1.5"
            />
          </div>
        )}

        {!account && (
          <div className="col-span-2">
            <Label htmlFor="initial_balance">Начальный остаток</Label>
            <Input
              id="initial_balance"
              type="number"
              step="0.01"
              value={formData.initial_balance}
              onChange={(e) => setFormData({ ...formData, initial_balance: e.target.value })}
              placeholder="0.00"
              disabled={isLoading}
              className="mt-1.5"
            />
          </div>
        )}

        <div className="col-span-2">
          <Label htmlFor="description">Описание</Label>
          <Textarea
            id="description"
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            placeholder="Дополнительная информация о счёте"
            disabled={isLoading}
            className="mt-1.5"
            rows={3}
          />
        </div>
      </div>

      <div className="flex gap-3 pt-4">
        <Button type="submit" className="flex-1 bg-blue-600 hover:bg-blue-700" disabled={isLoading}>
          {isLoading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              {account ? 'Сохранение...' : 'Создание...'}
            </>
          ) : (
            account ? 'Сохранить' : 'Создать'
          )}
        </Button>
      </div>
    </form>
  );
}
