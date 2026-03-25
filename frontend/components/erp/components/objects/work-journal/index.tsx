import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { CONSTANTS } from '@/constants';
import { Button } from '@/components/ui/button';
import { Loader2, ClipboardList, Clock, Image, FileText, Settings, Users, UserPlus } from 'lucide-react';

import { SummaryCard } from './SummaryCard';
import { OverviewSection } from './OverviewSection';
import { ShiftsSection } from './ShiftsSection';
import { MediaSection } from './MediaSection';
import { ReportsSection, ReportDetailDialog } from './ReportsSection';
import { InviteSection, GeoSettingsSection, SupergroupSection } from './SettingsSections';

type JournalSection = 'overview' | 'shifts' | 'media' | 'reports' | 'settings';

export function WorkJournalTab({ objectId }: { objectId: number }) {
  const [activeSection, setActiveSection] = useState<JournalSection>('overview');
  const [shiftsPage, setShiftsPage] = useState(1);
  const [mediaPage, setMediaPage] = useState(1);
  const [reportsPage, setReportsPage] = useState(1);
  const [mediaTypeFilter, setMediaTypeFilter] = useState<string>('');
  const [mediaTagFilter, setMediaTagFilter] = useState<string>('');
  const [shiftStatusFilter, setShiftStatusFilter] = useState<string>('');
  const [reportTypeFilter, setReportTypeFilter] = useState<string>('');
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);
  const [reportDialogOpen, setReportDialogOpen] = useState(false);

  const { data: summary, isLoading: summaryLoading } = useQuery({
    queryKey: ['work-journal-summary', objectId],
    queryFn: () => api.worklog.getWorkJournalSummary(objectId),
    staleTime: CONSTANTS.QUERY_STALE_TIME_MS,
  });

  const { data: shifts, isLoading: shiftsLoading } = useQuery({
    queryKey: ['worklog-shifts', objectId, shiftsPage, shiftStatusFilter],
    queryFn: () => api.worklog.getWorklogShifts({ object: objectId, page: shiftsPage, page_size: 10, ...(shiftStatusFilter ? { status: shiftStatusFilter } : {}) }),
    staleTime: CONSTANTS.QUERY_STALE_TIME_MS,
    enabled: activeSection === 'shifts' || activeSection === 'overview',
  });

  const { data: media, isLoading: mediaLoading } = useQuery({
    queryKey: ['worklog-media', objectId, mediaPage, mediaTypeFilter, mediaTagFilter],
    queryFn: () => api.worklog.getWorklogMedia({ page: mediaPage, page_size: 12, ...(mediaTypeFilter ? { media_type: mediaTypeFilter } : {}), ...(mediaTagFilter ? { tag: mediaTagFilter } : {}) }),
    staleTime: CONSTANTS.QUERY_STALE_TIME_MS,
    enabled: activeSection === 'media',
  });

  const { data: reports, isLoading: reportsLoading } = useQuery({
    queryKey: ['worklog-reports', objectId, reportsPage, reportTypeFilter],
    queryFn: () => api.worklog.getWorklogReports({ page: reportsPage, page_size: 10, ...(reportTypeFilter ? { report_type: reportTypeFilter } : {}) }),
    staleTime: CONSTANTS.QUERY_STALE_TIME_MS,
    enabled: activeSection === 'reports',
  });

  if (summaryLoading) {
    return (<div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-blue-500" /></div>);
  }

  const isEmpty = !summary || (summary.total_shifts === 0 && summary.total_media === 0);

  const sectionButtons: { key: JournalSection; label: string; icon: typeof Clock }[] = [
    { key: 'overview', label: 'Обзор', icon: ClipboardList },
    { key: 'shifts', label: 'Смены', icon: Clock },
    { key: 'media', label: 'Медиа', icon: Image },
    { key: 'reports', label: 'Отчёты', icon: FileText },
    { key: 'settings', label: 'Настройки', icon: Settings },
  ];

  return (
    <div className="space-y-6">
      {!isEmpty && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          <SummaryCard icon={Clock} label="Смены" value={summary!.total_shifts} extra={summary!.active_shifts > 0 ? `${summary!.active_shifts} активных` : undefined} extraColor="text-green-600" />
          <SummaryCard icon={Users} label="Звенья" value={summary!.total_teams} />
          <SummaryCard icon={Image} label="Медиа" value={summary!.total_media} />
          <SummaryCard icon={FileText} label="Отчёты" value={summary!.total_reports} />
          <SummaryCard icon={Users} label="Монтажники" value={summary!.total_workers} />
        </div>
      )}

      <div className="flex gap-2 border-b border-border pb-0">
        {sectionButtons.map(({ key, label, icon: Icon }) => (
          <button key={key} type="button" className={cn('flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors', activeSection === key ? 'border-blue-500 text-primary' : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border')} onClick={() => setActiveSection(key)} tabIndex={0} aria-label={`Раздел ${label}`}>
            <Icon className="w-4 h-4" />{label}
          </button>
        ))}
      </div>

      {activeSection === 'overview' && (
        isEmpty ? (
          <div className="bg-card border border-border rounded-xl p-12 text-center">
            <ClipboardList className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-foreground mb-2">Журнал работ</h3>
            <p className="text-muted-foreground max-w-md mx-auto mb-6">Здесь будут отображаться смены, звенья, медиа и отчёты монтажников. Для начала работы пригласите монтажников и откройте первую смену.</p>
            <Button onClick={() => setActiveSection('settings')} aria-label="Перейти к настройкам" tabIndex={0}><UserPlus className="w-4 h-4 mr-2" /> Пригласить монтажника</Button>
          </div>
        ) : (<OverviewSection shifts={summary!.recent_shifts} />)
      )}

      {activeSection === 'shifts' && (
        <ShiftsSection objectId={objectId} data={shifts} isLoading={shiftsLoading} page={shiftsPage} onPageChange={setShiftsPage} statusFilter={shiftStatusFilter} onStatusFilterChange={setShiftStatusFilter} />
      )}

      {activeSection === 'media' && (
        <MediaSection data={media} isLoading={mediaLoading} page={mediaPage} onPageChange={setMediaPage} typeFilter={mediaTypeFilter} onTypeFilterChange={setMediaTypeFilter} tagFilter={mediaTagFilter} onTagFilterChange={setMediaTagFilter} />
      )}

      {activeSection === 'reports' && (
        <ReportsSection data={reports} isLoading={reportsLoading} page={reportsPage} onPageChange={setReportsPage} typeFilter={reportTypeFilter} onTypeFilterChange={setReportTypeFilter} onReportClick={(id) => { setSelectedReportId(id); setReportDialogOpen(true); }} />
      )}

      {activeSection === 'settings' && (
        <div className="space-y-6">
          <InviteSection objectId={objectId} />
          <GeoSettingsSection objectId={objectId} />
          <SupergroupSection objectId={objectId} />
        </div>
      )}

      <ReportDetailDialog reportId={selectedReportId} open={reportDialogOpen} onOpenChange={setReportDialogOpen} />
    </div>
  );
}

// Re-export settings sections for ObjectSettingsTab
export { InviteSection, GeoSettingsSection, SupergroupSection } from './SettingsSections';
