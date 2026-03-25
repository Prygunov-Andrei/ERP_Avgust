import Link from 'next/link';
import type { NewsItem } from '@/lib/hvac-api';
import { formatDate, getNewsPrimaryImageUrl, stripHtml, truncate } from '@/lib/utils';

interface NewsCardProps {
  news: NewsItem;
}

export function NewsCard({ news }: NewsCardProps) {
  const imageUrl = getNewsPrimaryImageUrl(news);
  const bodyPreview = truncate(stripHtml(news.body || ''), 200);

  return (
    <article className="overflow-hidden rounded-lg border border-border bg-card text-card-foreground transition-shadow hover:shadow-md">
      {imageUrl && (
        <Link href={`/news/${news.id}`}>
          <img
            src={imageUrl}
            alt={news.title}
            className="w-full h-48 object-cover"
            loading="lazy"
          />
        </Link>
      )}
      <div className="p-5">
        <time dateTime={news.pub_date} className="text-sm text-muted-foreground">
          {formatDate(news.pub_date)}
        </time>
        <h2 className="mt-2 text-lg font-semibold text-card-foreground">
          <Link href={`/news/${news.id}`} className="transition-colors hover:text-primary">
            {news.title}
          </Link>
        </h2>
        {bodyPreview && (
          <p className="mt-2 line-clamp-3 text-sm text-muted-foreground">
            {bodyPreview}
          </p>
        )}
        {news.manufacturer && (
          <div className="mt-3">
            <span className="inline-flex items-center rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
              {news.manufacturer.name}
            </span>
          </div>
        )}
      </div>
    </article>
  );
}
