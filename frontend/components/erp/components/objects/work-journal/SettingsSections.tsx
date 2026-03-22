import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, Counterparty } from '@/lib/api';
import { formatDateTime, cn } from '@/lib/utils';
import { CONSTANTS } from '@/constants';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Loader2, UserPlus, Globe, Settings, Users, Link2, Copy, ExternalLink, CheckCircle2, Save } from 'lucide-react';
import { toast } from 'sonner';

/** Extended object fields returned by the API but not yet on the base ConstructionObject type */
interface ObjectGeoFields {
  latitude?: string;
  longitude?: string;
  geo_radius?: number;
  allow_geo_bypass?: boolean;
  registration_window_minutes?: number;
}

// ---- Invite Section ----

export function InviteSection({ objectId }: { objectId: number }) {
  const queryClient = useQueryClient();
  const [selectedContractor, setSelectedContractor] = useState<string>('');
  const [selectedRole, setSelectedRole] = useState<string>('worker');
  const [generatedLink, setGeneratedLink] = useState<string>('');
  const [copied, setCopied] = useState(false);

  const { data: counterparties } = useQuery({
    queryKey: ['counterparties'],
    queryFn: () => api.core.getCounterparties(),
    staleTime: CONSTANTS.QUERY_STALE_TIME_MS,
  });

  const { data: invites, isLoading: invitesLoading } = useQuery({
    queryKey: ['worklog-invites', selectedContractor],
    queryFn: () => api.worklog.getInviteTokens({ ...(selectedContractor ? { contractor: parseInt(selectedContractor) } : {}), page_size: 10 }),
    staleTime: CONSTANTS.QUERY_STALE_TIME_MS,
  });

  const createMutation = useMutation({
    mutationFn: () => api.worklog.createInviteToken({ contractor: parseInt(selectedContractor), role: selectedRole }),
    onSuccess: (data) => { setGeneratedLink(data.bot_link); setCopied(false); queryClient.invalidateQueries({ queryKey: ['worklog-invites'] }); toast.success('Приглашение создано'); },
    onError: () => toast.error('Ошибка при создании приглашения'),
  });

  const handleCreate = () => { if (!selectedContractor) { toast.error('Выберите контрагента'); return; } createMutation.mutate(); };
  const handleCopy = async () => { try { await navigator.clipboard.writeText(generatedLink); setCopied(true); toast.success('Ссылка скопирована'); setTimeout(() => setCopied(false), 3000); } catch { toast.error('Не удалось скопировать'); } };

  const inviteList = invites?.results || [];

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-6">
      <h3 className="text-base font-semibold text-gray-900 mb-4 flex items-center gap-2"><UserPlus className="w-5 h-5 text-blue-600" /> Пригласить монтажника</h3>
      <p className="text-sm text-gray-500 mb-4">Создайте ссылку-приглашение и отправьте её монтажнику. Он откроет ссылку в Telegram, бот попросит ввести ФИО и выбрать язык — и монтажник будет зарегистрирован автоматически.</p>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
        <div>
          <Label htmlFor="invite-contractor">Контрагент</Label>
          <Select value={selectedContractor} onValueChange={setSelectedContractor}>
            <SelectTrigger className="mt-1.5" id="invite-contractor" aria-label="Выбор контрагента"><SelectValue placeholder="Выберите контрагента" /></SelectTrigger>
            <SelectContent>
              {(counterparties || []).map((c: Counterparty) => (<SelectItem key={c.id} value={String(c.id)}>{c.short_name || c.name}</SelectItem>))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label htmlFor="invite-role">Роль</Label>
          <Select value={selectedRole} onValueChange={setSelectedRole}>
            <SelectTrigger className="mt-1.5" id="invite-role" aria-label="Выбор роли"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="worker">Монтажник</SelectItem>
              <SelectItem value="brigadier">Бригадир</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-end">
          <Button onClick={handleCreate} disabled={!selectedContractor || createMutation.isPending} className="w-full" aria-label="Создать приглашение">
            {createMutation.isPending ? (<><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Создание...</>) : (<><UserPlus className="w-4 h-4 mr-2" /> Создать приглашение</>)}
          </Button>
        </div>
      </div>

      {generatedLink && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
          <div className="flex items-center justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-green-800 mb-1">Ссылка готова!</div>
              <div className="text-xs text-green-700 font-mono truncate">{generatedLink}</div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <Button variant="outline" size="sm" onClick={handleCopy} className={cn('transition-colors', copied ? 'border-green-500 text-green-700' : '')} aria-label="Скопировать ссылку" tabIndex={0}>
                {copied ? (<><CheckCircle2 className="w-4 h-4 mr-1" /> Скопировано</>) : (<><Copy className="w-4 h-4 mr-1" /> Скопировать</>)}
              </Button>
              <Button variant="outline" size="sm" onClick={() => window.open(generatedLink, '_blank')} aria-label="Открыть ссылку" tabIndex={0}><ExternalLink className="w-4 h-4" /></Button>
            </div>
          </div>
        </div>
      )}

      <div className="mt-4">
        <h4 className="text-sm font-medium text-gray-700 mb-3">Последние приглашения</h4>
        {invitesLoading ? (
          <div className="flex justify-center py-4"><Loader2 className="w-5 h-5 animate-spin text-blue-500" /></div>
        ) : inviteList.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-4">Нет приглашений</p>
        ) : (
          <div className="space-y-2">
            {inviteList.map((invite) => (
              <div key={invite.id} className="flex items-center justify-between border border-gray-200 rounded-lg px-4 py-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className={cn('w-2.5 h-2.5 rounded-full flex-shrink-0', invite.is_valid ? 'bg-green-500' : (invite.used ? 'bg-blue-500' : 'bg-gray-400'))} />
                  <div className="min-w-0">
                    <div className="text-sm text-gray-900 font-mono truncate">{invite.code}</div>
                    <div className="text-xs text-gray-500">{invite.contractor_name}{' • '}{invite.role === 'brigadier' ? 'Бригадир' : 'Монтажник'}{' • '}{formatDateTime(invite.created_at)}</div>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {invite.used ? (<Badge className="bg-blue-100 text-blue-700 text-xs">{invite.used_by_name || 'Использован'}</Badge>) : invite.is_valid ? (<Badge className="bg-green-100 text-green-700 text-xs">Активен</Badge>) : (<Badge className="bg-gray-100 text-gray-600 text-xs">Истёк</Badge>)}
                  {invite.is_valid && (
                    <Button variant="ghost" size="sm" onClick={async () => { try { await navigator.clipboard.writeText(invite.bot_link); toast.success('Ссылка скопирована'); } catch { toast.error('Не удалось скопировать'); } }} aria-label={`Скопировать ссылку приглашения ${invite.code}`} tabIndex={0}><Copy className="w-4 h-4" /></Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ---- Geo Settings Section ----

export function GeoSettingsSection({ objectId }: { objectId: number }) {
  const queryClient = useQueryClient();
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [geoRadius, setGeoRadius] = useState('200');
  const [allowGeoBypass, setAllowGeoBypass] = useState(false);
  const [registrationWindow, setRegistrationWindow] = useState('0');
  const [hasLoaded, setHasLoaded] = useState(false);

  const { data: object } = useQuery({
    queryKey: ['construction-object', objectId],
    queryFn: () => api.core.getConstructionObjectById(objectId),
    staleTime: CONSTANTS.QUERY_STALE_TIME_MS,
  });

  if (object && !hasLoaded) {
    const geo = object as unknown as ObjectGeoFields;
    if (geo.latitude) setLatitude(geo.latitude);
    if (geo.longitude) setLongitude(geo.longitude);
    if (geo.geo_radius) setGeoRadius(String(geo.geo_radius));
    if (geo.allow_geo_bypass !== undefined) setAllowGeoBypass(geo.allow_geo_bypass);
    if (geo.registration_window_minutes !== undefined) setRegistrationWindow(String(geo.registration_window_minutes));
    setHasLoaded(true);
  }

  const updateMutation = useMutation({
    mutationFn: () => api.core.updateObjectGeo(objectId, { latitude: latitude || undefined, longitude: longitude || undefined, geo_radius: geoRadius ? parseInt(geoRadius) : undefined, allow_geo_bypass: allowGeoBypass, registration_window_minutes: registrationWindow ? parseInt(registrationWindow) : 0 }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['construction-object', objectId] }); toast.success('Гео-настройки сохранены'); },
    onError: () => toast.error('Ошибка при сохранении'),
  });

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-6">
      <h3 className="text-base font-semibold text-gray-900 mb-4 flex items-center gap-2"><Globe className="w-5 h-5 text-blue-600" /> Гео-настройки объекта</h3>
      <p className="text-sm text-gray-500 mb-4">Укажите координаты центра объекта и радиус допустимой зоны для регистрации на смену через Mini App.</p>
      <form onSubmit={(e) => { e.preventDefault(); updateMutation.mutate(); }} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div><Label htmlFor="geo-lat">Широта (Latitude)</Label><Input id="geo-lat" type="text" inputMode="decimal" placeholder="55.7558" value={latitude} onChange={(e) => setLatitude(e.target.value)} className="mt-1.5" aria-label="Широта объекта" /></div>
          <div><Label htmlFor="geo-lng">Долгота (Longitude)</Label><Input id="geo-lng" type="text" inputMode="decimal" placeholder="37.6173" value={longitude} onChange={(e) => setLongitude(e.target.value)} className="mt-1.5" aria-label="Долгота объекта" /></div>
          <div><Label htmlFor="geo-radius">Радиус (метры)</Label><Input id="geo-radius" type="number" min="50" max="50000" step="50" placeholder="200" value={geoRadius} onChange={(e) => setGeoRadius(e.target.value)} className="mt-1.5" aria-label="Радиус гео-зоны" /></div>
        </div>
        <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
          <input id="allow-geo-bypass" type="checkbox" checked={allowGeoBypass} onChange={(e) => setAllowGeoBypass(e.target.checked)} className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 cursor-pointer" aria-label="Разрешить регистрацию вне геозоны" />
          <div>
            <Label htmlFor="allow-geo-bypass" className="cursor-pointer font-medium text-gray-700">Разрешить регистрацию вне геозоны</Label>
            <p className="text-xs text-gray-500 mt-0.5">Если включено, монтажники смогут регистрироваться находясь за пределами геозоны (с пометкой). По умолчанию регистрация вне зоны заблокирована.</p>
          </div>
        </div>
        <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <Label htmlFor="reg-window" className="font-medium text-gray-700">Окно регистрации (минуты)</Label>
              <p className="text-xs text-gray-500 mt-0.5">За сколько минут до начала и после окончания смены разрешена регистрация. 0 = без ограничений.</p>
            </div>
            <Input id="reg-window" type="number" min="0" max="1440" step="5" placeholder="0" value={registrationWindow} onChange={(e) => setRegistrationWindow(e.target.value)} className="w-24" aria-label="Окно регистрации в минутах" />
          </div>
        </div>
        <div className="flex justify-end">
          <Button type="submit" disabled={updateMutation.isPending}>
            {updateMutation.isPending ? (<><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Сохранение...</>) : (<><Save className="w-4 h-4 mr-2" /> Сохранить настройки</>)}
          </Button>
        </div>
      </form>
    </div>
  );
}

// ---- Supergroup Section ----

export function SupergroupSection({ objectId }: { objectId: number }) {
  const { data: supergroups, isLoading } = useQuery({
    queryKey: ['worklog-supergroups', objectId],
    queryFn: () => api.worklog.getWorklogSupergroups({ object: objectId }),
    staleTime: CONSTANTS.QUERY_STALE_TIME_MS,
  });

  if (isLoading) { return (<div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-blue-500" /></div>); }

  const groups = supergroups?.results || [];

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-6">
      <h3 className="text-base font-semibold text-gray-900 mb-4 flex items-center gap-2"><Settings className="w-5 h-5 text-blue-600" /> Telegram-супергруппы</h3>
      <p className="text-sm text-gray-500 mb-4">Супергруппы Telegram привязаны к объекту для фиксации работ. Каждое звено получает отдельный топик в группе.</p>
      {groups.length === 0 ? (
        <div className="text-center py-8">
          <Users className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 text-sm">Нет привязанных супергрупп</p>
          <p className="text-gray-400 text-xs mt-1">Супергруппы создаются автоматически при открытии смены через бота</p>
        </div>
      ) : (
        <div className="space-y-3">
          {groups.map((group) => (
            <div key={group.id} className="flex items-center justify-between border border-gray-200 rounded-lg p-4">
              <div className="flex items-center gap-3">
                <div className={cn('w-3 h-3 rounded-full', group.is_active ? 'bg-green-500' : 'bg-gray-400')} />
                <div>
                  <div className="text-sm font-medium text-gray-900">{group.chat_title}</div>
                  <div className="text-xs text-gray-500">{group.contractor_name} • ID: {group.telegram_chat_id}</div>
                  <div className="text-xs text-gray-400">{formatDateTime(group.created_at)}</div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {group.is_active ? (<Badge className="bg-green-100 text-green-700 text-xs">Активна</Badge>) : (<Badge className="bg-gray-100 text-gray-600 text-xs">Неактивна</Badge>)}
                {group.invite_link && (<Button variant="outline" size="sm" onClick={() => window.open(group.invite_link, '_blank')} aria-label={`Открыть ссылку на группу ${group.chat_title}`}><Link2 className="w-4 h-4" /></Button>)}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
