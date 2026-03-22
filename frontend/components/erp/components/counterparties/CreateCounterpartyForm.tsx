import { useState, useRef, useCallback } from 'react';
import { api, CreateCounterpartyData, Counterparty, FNSSuggestResult, FNSQuickCheckResponse, FNSEnrichResponse } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Loader2, Search, FileText, StickyNote, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { FNSSuggestDropdown, FNSCheckTabContent } from './fns-helpers';

interface CreateCounterpartyFormProps {
  onSubmit: (data: CreateCounterpartyData) => void;
  isLoading: boolean;
  lockedType?: Counterparty['type'];
}

export function CreateCounterpartyForm({ onSubmit, isLoading, lockedType }: CreateCounterpartyFormProps) {
  const [formData, setFormData] = useState<CreateCounterpartyData>({
    name: '',
    short_name: '',
    inn: '',
    kpp: '',
    ogrn: '',
    type: lockedType || 'customer',
    vendor_subtype: null,
    legal_form: 'ooo',
    address: '',
    contact_info: '',
    notes: '',
  });

  const [activeTab, setActiveTab] = useState('requisites');
  const [showInnSuggestions, setShowInnSuggestions] = useState(false);
  const [showNameSuggestions, setShowNameSuggestions] = useState(false);
  const [quickCheck, setQuickCheck] = useState<FNSQuickCheckResponse | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const innFieldRef = useRef<HTMLDivElement>(null);
  const nameFieldRef = useRef<HTMLDivElement>(null);
  const [isEnriching, setIsEnriching] = useState(false);

  const handleSuggestSelect = useCallback(async (result: FNSSuggestResult) => {
    if (result.is_local) {
      toast.info(`Контрагент "${result.name}" уже есть в базе`);
    }
    setFormData((prev) => ({
      ...prev,
      name: result.name || prev.name,
      short_name: result.short_name || prev.short_name || '',
      inn: result.inn || prev.inn,
      kpp: result.kpp || prev.kpp || '',
      ogrn: result.ogrn || prev.ogrn || '',
      legal_form: result.legal_form || prev.legal_form,
      address: result.address || prev.address || '',
    }));
    setShowInnSuggestions(false);
    setShowNameSuggestions(false);

    const inn = result.inn || '';
    if (inn && inn.match(/^\d{10,12}$/) && !result.is_local) {
      setIsEnriching(true);
      try {
        const enriched: FNSEnrichResponse = await api.core.fnsEnrich(inn);
        setFormData((prev) => ({
          ...prev,
          name: enriched.name || prev.name,
          short_name: enriched.short_name || prev.short_name || '',
          inn: enriched.inn || prev.inn,
          kpp: enriched.kpp || prev.kpp || '',
          ogrn: enriched.ogrn || prev.ogrn || '',
          legal_form: enriched.legal_form || prev.legal_form,
          address: enriched.address || prev.address || '',
          contact_info: enriched.contact_info || prev.contact_info || '',
        }));
        toast.success('Реквизиты загружены из ЕГРЮЛ/ЕГРИП');
      } catch {
        // Silent — data from suggest already filled
      } finally {
        setIsEnriching(false);
      }
    }
  }, []);

  const handleQuickCheck = async () => {
    const inn = formData.inn.trim();
    if (!inn || !inn.match(/^\d{10,12}$/)) {
      toast.error('Укажите корректный ИНН (10 или 12 цифр)');
      return;
    }
    setIsChecking(true);
    setQuickCheck(null);
    try {
      const result = await api.core.fnsQuickCheck(inn);
      setQuickCheck(result);
      setActiveTab('fns-check');
    } catch (e: unknown) {
      toast.error(`Ошибка проверки: ${(e instanceof Error ? e.message : String(e)) || 'Неизвестная ошибка'}`);
    } finally {
      setIsChecking(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.inn.trim() || !formData.legal_form) {
      toast.error('Заполните обязательные поля');
      setActiveTab('requisites');
      return;
    }
    if (formData.vendor_subtype && formData.type === 'customer') {
      toast.error('Подтип можно указывать только для контрагентов типа "Исполнитель-Поставщик"');
      setActiveTab('requisites');
      return;
    }
    const dataToSubmit: CreateCounterpartyData = {
      ...formData,
      short_name: formData.short_name?.trim() || undefined,
      kpp: formData.kpp?.trim() || undefined,
      ogrn: formData.ogrn?.trim() || undefined,
      address: formData.address?.trim() || undefined,
      contact_info: formData.contact_info?.trim() || undefined,
      notes: formData.notes?.trim() || undefined,
      vendor_subtype: (formData.type === 'vendor' || formData.type === 'both') ? formData.vendor_subtype : undefined,
    };
    onSubmit(dataToSubmit);
  };

  const showVendorSubtype = formData.type === 'vendor' || formData.type === 'both';

  return (
    <form onSubmit={handleSubmit} className="mt-2">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="w-full grid grid-cols-3 mb-4">
          <TabsTrigger value="requisites" className="text-xs gap-1">
            <FileText className="w-3.5 h-3.5" /> Реквизиты
          </TabsTrigger>
          <TabsTrigger value="fns-check" className="text-xs gap-1 relative">
            <ShieldCheck className="w-3.5 h-3.5" /> Проверка ФНС
            {quickCheck && (
              <span className={`absolute -top-1 -right-1 w-2 h-2 rounded-full ${
                quickCheck.summary.risk_level === 'low' ? 'bg-green-500' :
                quickCheck.summary.risk_level === 'medium' ? 'bg-yellow-500' :
                quickCheck.summary.risk_level === 'high' ? 'bg-red-500' : 'bg-gray-400'
              }`} />
            )}
          </TabsTrigger>
          <TabsTrigger value="notes" className="text-xs gap-1">
            <StickyNote className="w-3.5 h-3.5" /> Заметки
          </TabsTrigger>
        </TabsList>

        <div className="min-h-[520px]">
        <TabsContent value="requisites" className="space-y-4 mt-0">
          <div ref={innFieldRef} className="relative">
            <Label htmlFor="create-inn">ИНН <span className="text-red-500">*</span></Label>
            <div className="flex gap-2 mt-1.5">
              <Input
                id="create-inn"
                value={formData.inn}
                onChange={(e) => {
                  setFormData({ ...formData, inn: e.target.value });
                  if (e.target.value.length >= 3) setShowInnSuggestions(true);
                  setQuickCheck(null);
                }}
                onFocus={() => { if (formData.inn.length >= 3) setShowInnSuggestions(true); }}
                placeholder="Введите ИНН для автозаполнения"
                disabled={isLoading}
                required
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleQuickCheck}
                disabled={isLoading || isChecking || !formData.inn.trim()}
                className="shrink-0 text-xs"
                title="Проверить контрагента в ФНС"
              >
                {isChecking ? <Loader2 className="w-3 h-3 animate-spin" /> : <Search className="w-3 h-3" />}
                <span className="ml-1">Проверить</span>
              </Button>
            </div>
            <FNSSuggestDropdown
              query={formData.inn}
              onSelect={handleSuggestSelect}
              isVisible={showInnSuggestions}
              onClose={() => setShowInnSuggestions(false)}
            />
          </div>

          {isEnriching && (
            <div className="flex items-center gap-2 p-2 bg-blue-50 rounded-lg text-sm text-blue-600">
              <Loader2 className="w-3 h-3 animate-spin" />
              Загрузка реквизитов из ЕГРЮЛ/ЕГРИП...
            </div>
          )}

          <div ref={nameFieldRef} className="relative">
            <Label htmlFor="create-name">Название <span className="text-red-500">*</span></Label>
            <Input
              id="create-name"
              value={formData.name}
              onChange={(e) => {
                setFormData({ ...formData, name: e.target.value });
                if (e.target.value.length >= 3 && !e.target.value.match(/^\d+$/)) setShowNameSuggestions(true);
              }}
              onFocus={() => {
                if (formData.name.length >= 3 && !formData.name.match(/^\d+$/)) setShowNameSuggestions(true);
              }}
              placeholder="Введите название для поиска"
              disabled={isLoading}
              className="mt-1.5"
              required
            />
            <FNSSuggestDropdown
              query={formData.name}
              onSelect={handleSuggestSelect}
              isVisible={showNameSuggestions}
              onClose={() => setShowNameSuggestions(false)}
            />
          </div>

          <div>
            <Label htmlFor="create-short_name">Краткое название</Label>
            <Input id="create-short_name" value={formData.short_name} onChange={(e) => setFormData({ ...formData, short_name: e.target.value })} placeholder="Ромашка" disabled={isLoading} className="mt-1.5" />
          </div>

          <div>
            <Label htmlFor="create-legal_form">Правовая форма <span className="text-red-500">*</span></Label>
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

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="create-kpp">КПП</Label>
              <Input id="create-kpp" value={formData.kpp} onChange={(e) => setFormData({ ...formData, kpp: e.target.value })} placeholder="Заполнится из ФНС" disabled={isLoading} className="mt-1.5" />
            </div>
            <div>
              <Label htmlFor="create-ogrn">ОГРН</Label>
              <Input id="create-ogrn" value={formData.ogrn} onChange={(e) => setFormData({ ...formData, ogrn: e.target.value })} placeholder="Заполнится из ФНС" disabled={isLoading} className="mt-1.5" />
            </div>
          </div>

          <div>
            <Label htmlFor="create-address">Юридический адрес</Label>
            <Input id="create-address" value={formData.address} onChange={(e) => setFormData({ ...formData, address: e.target.value })} placeholder="Заполнится автоматически из ФНС" disabled={isLoading} className="mt-1.5" />
          </div>

          {!lockedType && (
            <div>
              <Label htmlFor="create-type">Тип <span className="text-red-500">*</span></Label>
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
          )}

          {showVendorSubtype && (
            <div>
              <Label htmlFor="create-vendor_subtype">Подтип</Label>
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
            <Label htmlFor="create-contact_info">Контакты</Label>
            <Textarea id="create-contact_info" value={formData.contact_info} onChange={(e) => setFormData({ ...formData, contact_info: e.target.value })} placeholder="Email, телефон..." disabled={isLoading} className="mt-1.5" rows={2} />
          </div>
        </TabsContent>

        <TabsContent value="fns-check" className="mt-0">
          {isChecking ? (
            <div className="flex flex-col items-center justify-center py-12 text-gray-500">
              <Loader2 className="w-8 h-8 animate-spin mb-3" />
              <span className="text-sm">Проверка контрагента в ФНС...</span>
            </div>
          ) : quickCheck ? (
            <FNSCheckTabContent data={quickCheck} />
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-gray-400">
              <ShieldCheck className="w-10 h-10 mb-3 opacity-40" />
              <p className="text-sm text-center">
                Введите ИНН на вкладке «Реквизиты» и нажмите
                <br />
                <span className="font-medium text-gray-600">«Проверить»</span> для загрузки данных из ФНС
              </p>
            </div>
          )}
        </TabsContent>

        <TabsContent value="notes" className="mt-0">
          <div>
            <Label htmlFor="create-notes">Заметки по контрагенту</Label>
            <Textarea id="create-notes" value={formData.notes || ''} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} placeholder="Произвольные заметки, комментарии, важная информация..." disabled={isLoading} className="mt-1.5" rows={8} />
          </div>
        </TabsContent>
        </div>
      </Tabs>

      <div className="flex gap-3 pt-4 border-t mt-4">
        <Button type="submit" className="flex-1 bg-blue-600 hover:bg-blue-700" disabled={isLoading}>
          {isLoading ? (<><Loader2 className="w-4 h-4 mr-2 animate-spin" />Создание...</>) : 'Создать'}
        </Button>
      </div>
    </form>
  );
}
