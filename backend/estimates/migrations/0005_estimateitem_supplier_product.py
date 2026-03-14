import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('estimates', '0004_add_column_config_and_templates'),
        ('supplier_integrations', '0001_initial'),
    ]

    operations = [
        migrations.AddField(
            model_name='estimateitem',
            name='supplier_product',
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='estimate_items',
                to='supplier_integrations.supplierproduct',
                verbose_name='Предложение поставщика',
            ),
        ),
    ]
