from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('accounting', '0010_alter_counterparty_type'),
    ]

    operations = [
        migrations.AddField(
            model_name='counterparty',
            name='is_public',
            field=models.BooleanField(
                default=False,
                help_text='Если включено — поставщик будет виден внешним пользователям публичного API',
                verbose_name='Показывать в публичном API',
            ),
        ),
    ]
