from django.db import models
from core.models import TimestampedModel


class SupplierIntegration(TimestampedModel):
    """Конфигурация подключения к API поставщика"""

    class Provider(models.TextChoices):
        BREEZ = 'breez', 'Бриз'

    name = models.CharField(max_length=100, verbose_name='Название')
    provider = models.CharField(
        max_length=20,
        choices=Provider.choices,
        verbose_name='Провайдер'
    )
    counterparty = models.ForeignKey(
        'accounting.Counterparty',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='supplier_integrations',
        verbose_name='Контрагент'
    )
    base_url = models.URLField(verbose_name='URL API')
    auth_header = models.CharField(
        max_length=500,
        verbose_name='Authorization header',
        help_text='Полный заголовок, например: Basic aGVycj...'
    )
    is_active = models.BooleanField(default=True, verbose_name='Активна')
    last_catalog_sync = models.DateTimeField(
        null=True, blank=True,
        verbose_name='Последняя синхр. каталога'
    )
    last_stock_sync = models.DateTimeField(
        null=True, blank=True,
        verbose_name='Последняя синхр. остатков'
    )

    class Meta:
        verbose_name = 'Интеграция поставщика'
        verbose_name_plural = 'Интеграции поставщиков'
        ordering = ['name']

    def __str__(self):
        return self.name


class SupplierCategory(TimestampedModel):
    """Категория товаров в каталоге поставщика"""

    integration = models.ForeignKey(
        SupplierIntegration,
        on_delete=models.CASCADE,
        related_name='categories',
        verbose_name='Интеграция'
    )
    external_id = models.IntegerField(verbose_name='ID в API поставщика')
    title = models.CharField(max_length=500, verbose_name='Название')
    parent_external_id = models.IntegerField(
        null=True, blank=True,
        verbose_name='ID родителя в API'
    )
    parent = models.ForeignKey(
        'self',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='children',
        verbose_name='Родительская категория'
    )
    our_category = models.ForeignKey(
        'catalog.Category',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='supplier_categories',
        verbose_name='Наша категория'
    )

    class Meta:
        verbose_name = 'Категория поставщика'
        verbose_name_plural = 'Категории поставщиков'
        unique_together = [('integration', 'external_id')]
        ordering = ['title']

    def __str__(self):
        return self.title


class SupplierBrand(TimestampedModel):
    """Бренд в каталоге поставщика"""

    integration = models.ForeignKey(
        SupplierIntegration,
        on_delete=models.CASCADE,
        related_name='brands',
        verbose_name='Интеграция'
    )
    external_id = models.IntegerField(verbose_name='ID в API поставщика')
    title = models.CharField(max_length=255, verbose_name='Название')
    image_url = models.URLField(blank=True, verbose_name='Логотип')
    website_url = models.URLField(blank=True, verbose_name='Сайт')

    class Meta:
        verbose_name = 'Бренд поставщика'
        verbose_name_plural = 'Бренды поставщиков'
        unique_together = [('integration', 'external_id')]

    def __str__(self):
        return self.title


class SupplierProduct(TimestampedModel):
    """Товар из каталога поставщика"""

    integration = models.ForeignKey(
        SupplierIntegration,
        on_delete=models.CASCADE,
        related_name='products',
        verbose_name='Интеграция'
    )
    external_id = models.IntegerField(
        verbose_name='ID товара в API',
        help_text='product_id из API поставщика'
    )
    nc_code = models.CharField(
        max_length=50,
        db_index=True,
        verbose_name='НС-код',
        help_text='Уникальный код товара у поставщика (например НС-1234567)'
    )
    articul = models.CharField(
        max_length=100,
        blank=True,
        db_index=True,
        verbose_name='Артикул'
    )
    title = models.CharField(max_length=500, verbose_name='Название')
    description = models.TextField(blank=True, verbose_name='Описание')

    supplier_category = models.ForeignKey(
        SupplierCategory,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='products',
        verbose_name='Категория поставщика'
    )
    brand = models.ForeignKey(
        SupplierBrand,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='products',
        verbose_name='Бренд'
    )
    series = models.CharField(max_length=255, blank=True, verbose_name='Серия')

    # Цены
    base_price = models.DecimalField(
        max_digits=14, decimal_places=2,
        null=True, blank=True,
        verbose_name='Закупочная цена'
    )
    base_price_currency = models.CharField(
        max_length=3, default='RUB',
        verbose_name='Валюта закупочной цены'
    )
    ric_price = models.DecimalField(
        max_digits=14, decimal_places=2,
        null=True, blank=True,
        verbose_name='Рекомендованная интернет-цена'
    )
    ric_price_currency = models.CharField(
        max_length=3, default='RUB',
        verbose_name='Валюта РИЦ'
    )
    for_marketplace = models.BooleanField(
        default=False,
        verbose_name='Для маркетплейсов'
    )

    # Медиа
    images = models.JSONField(
        default=list, blank=True,
        verbose_name='Изображения',
        help_text='Список URL-ов изображений'
    )
    booklet_url = models.URLField(blank=True, verbose_name='Буклет (PDF)')
    manual_url = models.URLField(blank=True, verbose_name='Инструкция (PDF)')
    tech_specs = models.JSONField(
        default=dict, blank=True,
        verbose_name='Технические характеристики'
    )

    # Привязка к нашему каталогу
    product = models.ForeignKey(
        'catalog.Product',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='supplier_products',
        verbose_name='Наш товар'
    )

    is_active = models.BooleanField(default=True, verbose_name='Активен')
    price_updated_at = models.DateTimeField(
        null=True, blank=True,
        verbose_name='Цены обновлены'
    )

    class Meta:
        verbose_name = 'Товар поставщика'
        verbose_name_plural = 'Товары поставщиков'
        unique_together = [('integration', 'nc_code')]
        indexes = [
            models.Index(fields=['integration', 'is_active']),
            models.Index(fields=['product']),
        ]

    def __str__(self):
        return f'{self.nc_code} — {self.title}'

    @property
    def total_stock(self):
        return self.stocks.aggregate(total=models.Sum('quantity'))['total'] or 0


class SupplierStock(TimestampedModel):
    """Остатки товара поставщика по складам"""

    supplier_product = models.ForeignKey(
        SupplierProduct,
        on_delete=models.CASCADE,
        related_name='stocks',
        verbose_name='Товар поставщика'
    )
    warehouse_name = models.CharField(max_length=255, verbose_name='Склад')
    quantity = models.IntegerField(default=0, verbose_name='Количество')

    class Meta:
        verbose_name = 'Остаток на складе'
        verbose_name_plural = 'Остатки на складах'
        unique_together = [('supplier_product', 'warehouse_name')]

    def __str__(self):
        return f'{self.supplier_product.nc_code} @ {self.warehouse_name}: {self.quantity}'


class SupplierSyncLog(TimestampedModel):
    """Лог синхронизации с поставщиком"""

    class SyncType(models.TextChoices):
        CATALOG_FULL = 'catalog_full', 'Полный импорт каталога'
        STOCK_SYNC = 'stock_sync', 'Синхронизация остатков/цен'

    class Status(models.TextChoices):
        STARTED = 'started', 'Запущено'
        SUCCESS = 'success', 'Успешно'
        PARTIAL = 'partial', 'Частично'
        FAILED = 'failed', 'Ошибка'

    integration = models.ForeignKey(
        SupplierIntegration,
        on_delete=models.CASCADE,
        related_name='sync_logs',
        verbose_name='Интеграция'
    )
    sync_type = models.CharField(
        max_length=20,
        choices=SyncType.choices,
        verbose_name='Тип синхронизации'
    )
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.STARTED,
        verbose_name='Статус'
    )
    items_processed = models.PositiveIntegerField(default=0, verbose_name='Обработано')
    items_created = models.PositiveIntegerField(default=0, verbose_name='Создано')
    items_updated = models.PositiveIntegerField(default=0, verbose_name='Обновлено')
    items_errors = models.PositiveIntegerField(default=0, verbose_name='Ошибок')
    error_details = models.JSONField(
        default=list, blank=True,
        verbose_name='Детали ошибок'
    )
    duration_seconds = models.FloatField(
        null=True, blank=True,
        verbose_name='Длительность (сек)'
    )

    class Meta:
        verbose_name = 'Лог синхронизации'
        verbose_name_plural = 'Логи синхронизаций'
        ordering = ['-created_at']

    def __str__(self):
        return f'{self.integration.name} — {self.get_sync_type_display()} — {self.get_status_display()}'
