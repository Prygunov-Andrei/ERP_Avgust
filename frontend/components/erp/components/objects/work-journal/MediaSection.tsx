import { WorklogMedia, PaginatedResponse } from '@/lib/api';
import { formatDateTime, cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Loader2, Image, Filter, FileText, Video } from 'lucide-react';
import { PaginationBar } from './PaginationBar';
import { MEDIA_TYPE_ICONS, MEDIA_TAG_STYLES } from './constants';

function MediaCard({ media }: { media: WorklogMedia }) {
  const IconComponent = MEDIA_TYPE_ICONS[media.media_type] || FileText;
  const tagStyle = MEDIA_TAG_STYLES[media.tag] || MEDIA_TAG_STYLES.other;
  const isVisual = media.media_type === 'photo' || media.media_type === 'video';

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden hover:shadow-md transition-shadow">
      <div className="relative aspect-video bg-gray-100 flex items-center justify-center">
        {isVisual && media.thumbnail_url ? (
          <img src={media.thumbnail_url} alt={media.text_content || 'Медиа'} className="w-full h-full object-cover" loading="lazy" />
        ) : (
          <IconComponent className="w-10 h-10 text-gray-400" />
        )}
        {media.media_type === 'video' && media.thumbnail_url && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-10 h-10 bg-black/50 rounded-full flex items-center justify-center">
              <Video className="w-5 h-5 text-white" />
            </div>
          </div>
        )}
        {media.tag && (
          <Badge className={cn('absolute top-2 right-2 text-xs', tagStyle)}>
            {media.tag === 'progress' ? 'Прогресс' : media.tag === 'problem' ? 'Проблема' : media.tag === 'safety' ? 'Безопасность' : media.tag === 'result' ? 'Результат' : media.tag}
          </Badge>
        )}
      </div>
      <div className="p-3">
        <div className="flex items-center gap-1.5 text-xs text-gray-500 mb-1">
          <IconComponent className="w-3.5 h-3.5" />
          <span>{media.media_type === 'photo' ? 'Фото' : media.media_type === 'video' ? 'Видео' : media.media_type === 'voice' ? 'Голосовое' : media.media_type === 'text' ? 'Текст' : media.media_type}</span>
        </div>
        <div className="text-sm text-gray-700 truncate">{media.author_name}</div>
        {media.text_content && (<p className="text-xs text-gray-500 mt-1 line-clamp-2">{media.text_content}</p>)}
        <div className="text-xs text-gray-400 mt-1">{formatDateTime(media.created_at)}</div>
      </div>
    </div>
  );
}

interface MediaSectionProps {
  data: PaginatedResponse<WorklogMedia> | undefined;
  isLoading: boolean;
  page: number;
  onPageChange: (p: number) => void;
  typeFilter: string;
  onTypeFilterChange: (f: string) => void;
  tagFilter: string;
  onTagFilterChange: (f: string) => void;
}

export function MediaSection({ data, isLoading, page, onPageChange, typeFilter, onTypeFilterChange, tagFilter, onTagFilterChange }: MediaSectionProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <Filter className="w-4 h-4 text-gray-400" />
        <select className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500" value={typeFilter} onChange={(e) => { onTypeFilterChange(e.target.value); onPageChange(1); }} aria-label="Фильтр по типу медиа">
          <option value="">Все типы</option>
          <option value="photo">Фото</option>
          <option value="video">Видео</option>
          <option value="voice">Голосовые</option>
          <option value="text">Текст</option>
          <option value="document">Документы</option>
        </select>
        <select className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500" value={tagFilter} onChange={(e) => { onTagFilterChange(e.target.value); onPageChange(1); }} aria-label="Фильтр по тегу">
          <option value="">Все теги</option>
          <option value="progress">Прогресс</option>
          <option value="problem">Проблема</option>
          <option value="safety">Безопасность</option>
          <option value="result">Результат</option>
          <option value="other">Прочее</option>
        </select>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-blue-500" /></div>
      ) : !data || data.results.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-xl p-8 text-center">
          <Image className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">Нет медиа{typeFilter || tagFilter ? ' с выбранными фильтрами' : ''}</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {data.results.map((item) => (<MediaCard key={item.id} media={item} />))}
          </div>
          <PaginationBar count={data.count} page={page} pageSize={12} onPageChange={onPageChange} />
        </>
      )}
    </div>
  );
}
