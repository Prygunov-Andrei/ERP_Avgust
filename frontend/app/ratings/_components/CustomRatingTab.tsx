'use client';

import type {
  RatingMethodology,
  RatingModelListItem,
} from '@/lib/api/types/rating';
import { T } from './primitives';

// TODO(T5): заменить на полноценный CustomRating с computeIndex, пресетами,
// drawer'ом критериев и FLIP-анимацией. Этот stub сохраняет layout-место,
// чтобы DesktopListing уже маршрутизировал tab=custom в нужный компонент.
export default function CustomRatingTab({
  models,
  methodology,
}: {
  models: RatingModelListItem[];
  methodology: RatingMethodology;
}) {
  return (
    <div style={{ padding: '48px 40px', textAlign: 'center' }}>
      <T size={14} color="hsl(var(--rt-ink-60))">
        «Свой рейтинг» появится в T5 Ф6A — {models.length} моделей,{' '}
        {methodology.criteria.length} критериев готовы к использованию.
      </T>
    </div>
  );
}
