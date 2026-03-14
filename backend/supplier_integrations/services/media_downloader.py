import hashlib
import logging
import time
from urllib.parse import urlparse

import httpx
from django.conf import settings

from catalog.models import Product

logger = logging.getLogger(__name__)

# Rate limiting
DOWNLOAD_DELAY = 0.2  # секунды между запросами


def _get_s3_client():
    """Создаёт boto3 S3 client для MinIO (реиспользуем WORKLOG credentials)."""
    import boto3
    return boto3.client(
        's3',
        endpoint_url=settings.WORKLOG_S3_ENDPOINT_URL,
        aws_access_key_id=settings.WORKLOG_S3_ACCESS_KEY,
        aws_secret_access_key=settings.WORKLOG_S3_SECRET_KEY,
        region_name=settings.WORKLOG_S3_REGION,
    )


def _guess_content_type(url):
    """Определяет Content-Type по расширению URL."""
    ext = urlparse(url).path.rsplit('.', 1)[-1].lower() if '.' in url else ''
    mapping = {
        'jpg': 'image/jpeg', 'jpeg': 'image/jpeg',
        'png': 'image/png', 'gif': 'image/gif',
        'webp': 'image/webp', 'svg': 'image/svg+xml',
        'pdf': 'application/pdf',
    }
    return mapping.get(ext, 'application/octet-stream')


def _url_hash(url):
    """Короткий хеш URL для имени файла."""
    return hashlib.md5(url.encode()).hexdigest()[:12]


def _get_extension(url):
    """Извлекает расширение из URL."""
    path = urlparse(url).path
    if '.' in path:
        return path.rsplit('.', 1)[-1].lower()[:10]
    return 'bin'


def _is_minio_url(url):
    """Проверяет, указывает ли URL уже на MinIO."""
    if not url:
        return False
    bucket = getattr(settings, 'PRODUCT_MEDIA_S3_BUCKET', 'product-media')
    return f'/{bucket}/' in url


class ProductMediaDownloader:
    """Скачивает картинки, буклеты, инструкции из внешних URL в MinIO"""

    def __init__(self):
        self.bucket = getattr(settings, 'PRODUCT_MEDIA_S3_BUCKET', 'product-media')
        self.s3 = _get_s3_client()
        self.http = httpx.Client(timeout=30, follow_redirects=True)
        self.stats = {'downloaded': 0, 'skipped': 0, 'errors': 0}

    def close(self):
        self.http.close()

    def __enter__(self):
        return self

    def __exit__(self, *args):
        self.close()

    def download_all_for_integration(self, integration_id):
        """Скачать все медиа для Product привязанных к интеграции."""
        from supplier_integrations.models import SupplierProduct

        product_ids = SupplierProduct.objects.filter(
            integration_id=integration_id,
            product__isnull=False,
        ).values_list('product_id', flat=True)

        products = Product.objects.filter(pk__in=product_ids)
        total = products.count()
        logger.info('Скачивание медиа для %d товаров', total)

        for i, product in enumerate(products.iterator(chunk_size=50), 1):
            try:
                self.download_for_product(product)
            except Exception as e:
                self.stats['errors'] += 1
                logger.warning('Ошибка загрузки медиа Product #%d: %s', product.pk, e)

            if i % 100 == 0:
                logger.info('Прогресс: %d/%d', i, total)

        logger.info(
            'Загрузка завершена: скачано=%d, пропущено=%d, ошибок=%d',
            self.stats['downloaded'], self.stats['skipped'], self.stats['errors'],
        )
        return self.stats

    def download_for_product(self, product):
        """Скачать медиа одного Product."""
        updated_fields = []

        # Картинки
        if product.images:
            new_images = []
            changed = False
            for url in product.images:
                if _is_minio_url(url):
                    new_images.append(url)
                    self.stats['skipped'] += 1
                    continue
                s3_url = self._download_and_upload(
                    url, f'products/{product.pk}/images/{_url_hash(url)}.{_get_extension(url)}'
                )
                new_images.append(s3_url if s3_url else url)
                if s3_url:
                    changed = True
            if changed:
                product.images = new_images
                updated_fields.append('images')

        # Буклет
        if product.booklet_url and not _is_minio_url(product.booklet_url):
            s3_url = self._download_and_upload(
                product.booklet_url,
                f'products/{product.pk}/docs/booklet.{_get_extension(product.booklet_url)}',
            )
            if s3_url:
                product.booklet_url = s3_url
                updated_fields.append('booklet_url')

        # Инструкция
        if product.manual_url and not _is_minio_url(product.manual_url):
            s3_url = self._download_and_upload(
                product.manual_url,
                f'products/{product.pk}/docs/manual.{_get_extension(product.manual_url)}',
            )
            if s3_url:
                product.manual_url = s3_url
                updated_fields.append('manual_url')

        if updated_fields:
            product.save(update_fields=updated_fields + ['updated_at'])

    def _download_and_upload(self, url, s3_key):
        """Скачивает файл и загружает в MinIO. Возвращает S3 URL или None."""
        if not url or not url.startswith('http'):
            return None

        try:
            time.sleep(DOWNLOAD_DELAY)
            response = self.http.get(url)
            if response.status_code != 200:
                logger.warning('HTTP %d при скачивании %s', response.status_code, url)
                self.stats['errors'] += 1
                return None

            content_type = _guess_content_type(url)

            self.s3.put_object(
                Bucket=self.bucket,
                Key=s3_key,
                Body=response.content,
                ContentType=content_type,
            )

            public_url = getattr(settings, 'WORKLOG_S3_PUBLIC_URL', settings.WORKLOG_S3_ENDPOINT_URL)
            s3_url = f'{public_url}/{self.bucket}/{s3_key}'
            self.stats['downloaded'] += 1
            return s3_url

        except Exception as e:
            logger.warning('Ошибка скачивания %s: %s', url, e)
            self.stats['errors'] += 1
            return None
