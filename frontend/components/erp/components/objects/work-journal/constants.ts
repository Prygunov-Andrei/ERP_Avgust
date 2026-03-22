import { Camera, Video, Mic, FileText, FileSpreadsheet } from 'lucide-react';

export const SHIFT_TYPE_LABELS: Record<string, string> = {
  day: 'Дневная',
  evening: 'Вечерняя',
  night: 'Ночная',
};

export const SHIFT_STATUS_STYLES: Record<string, string> = {
  active: 'bg-green-100 text-green-700',
  scheduled: 'bg-blue-100 text-blue-700',
  closed: 'bg-gray-100 text-gray-600',
};

export const MEDIA_TYPE_ICONS: Record<string, typeof Camera> = {
  photo: Camera,
  video: Video,
  voice: Mic,
  audio: Mic,
  text: FileText,
  document: FileSpreadsheet,
};

export const MEDIA_TAG_STYLES: Record<string, string> = {
  progress: 'bg-blue-100 text-blue-700',
  problem: 'bg-red-100 text-red-700',
  safety: 'bg-yellow-100 text-yellow-700',
  result: 'bg-green-100 text-green-700',
  other: 'bg-gray-100 text-gray-600',
};
