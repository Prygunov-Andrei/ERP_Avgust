from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('supplier_integrations', '0001_initial'),
    ]

    operations = [
        migrations.AddIndex(
            model_name='supplierproduct',
            index=models.Index(
                fields=['integration', 'product'],
                name='si_sp_integration_product_idx',
            ),
        ),
        migrations.AddIndex(
            model_name='supplierproduct',
            index=models.Index(
                fields=['base_price'],
                name='si_sp_base_price_idx',
            ),
        ),
        migrations.AddIndex(
            model_name='supplierstock',
            index=models.Index(
                fields=['supplier_product', 'quantity'],
                name='si_stock_sp_qty_idx',
            ),
        ),
    ]
