import { describe, expect, it } from 'vitest';
import { filterModels, filterNews } from './SearchDialog';
import type { RatingModelListItem } from '@/lib/api/types/rating';

const model = (over: Partial<RatingModelListItem>): RatingModelListItem =>
  ({
    id: 1,
    slug: 'foo',
    brand: 'Foo',
    brand_logo: '',
    inner_unit: '',
    series: '',
    total_index: 0,
    index_max: 100,
    price: null,
    rank: null,
    noise_score: null,
    publish_status: 'published',
    nominal_capacity: null,
    region_count: 0,
    ...over,
  }) as RatingModelListItem;

describe('SearchDialog filters', () => {
  describe('filterModels', () => {
    const MODELS = [
      model({ id: 1, brand: 'Daikin', inner_unit: 'FTX20K', series: 'Emura' }),
      model({ id: 2, brand: 'Mitsubishi', inner_unit: 'MSZ-LN25', series: 'Kirigamine' }),
      model({ id: 3, brand: 'LG', inner_unit: 'S09EQ', series: 'DualCool' }),
    ];

    it('query короче 2 символов → пустой массив', () => {
      expect(filterModels(MODELS, 'a')).toHaveLength(0);
      expect(filterModels(MODELS, '')).toHaveLength(0);
    });

    it('регистронезависимый поиск по brand', () => {
      const r = filterModels(MODELS, 'DAIKIN');
      expect(r).toHaveLength(1);
      expect(r[0].id).toBe(1);
    });

    it('поиск по inner_unit', () => {
      const r = filterModels(MODELS, 'msz-ln');
      expect(r).toHaveLength(1);
      expect(r[0].id).toBe(2);
    });

    it('поиск по series', () => {
      const r = filterModels(MODELS, 'dualcool');
      expect(r).toHaveLength(1);
      expect(r[0].id).toBe(3);
    });

    it('обрезается до 10 результатов', () => {
      const many = Array.from({ length: 25 }, (_, i) =>
        model({ id: i + 100, brand: `AAABrand${i}` }),
      );
      expect(filterModels(many, 'aaabrand')).toHaveLength(10);
    });
  });

  describe('filterNews', () => {
    const NEWS = [
      { id: 1, title: 'Daikin представил новую серию' },
      { id: 2, title: 'Обзор инверторов 2026' },
      { id: 3, title: 'ГОСТ-шумы: методика' },
    ];

    it('пустой результат для query < 2 символов', () => {
      expect(filterNews(NEWS, 'd')).toHaveLength(0);
    });

    it('регистронезависимый поиск по title', () => {
      expect(filterNews(NEWS, 'DAIKIN')).toHaveLength(1);
    });

    it('обрезается до 5 результатов', () => {
      const many = Array.from({ length: 12 }, (_, i) => ({
        id: i,
        title: `Новость про инвертор ${i}`,
      }));
      expect(filterNews(many, 'инвертор')).toHaveLength(5);
    });
  });
});
