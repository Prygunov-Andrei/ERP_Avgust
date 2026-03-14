from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('catalog', '0004_product_rich_fields'),
    ]

    operations = [
        migrations.AddIndex(
            model_name='product',
            index=models.Index(
                fields=['status', 'name'],
                name='catalog_product_status_name_idx',
            ),
        ),
        migrations.AddIndex(
            model_name='product',
            index=models.Index(
                fields=['brand'],
                name='catalog_product_brand_idx',
            ),
        ),
        migrations.AddIndex(
            model_name='productpricehistory',
            index=models.Index(
                fields=['counterparty', 'product'],
                name='catalog_pph_cp_product_idx',
            ),
        ),
    ]
