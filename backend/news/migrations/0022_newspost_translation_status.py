# Generated manually on 2026-04-16 for async translation feature

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('news', '0021_alter_ratingconfiguration_anthropic_input_price_and_more'),
    ]

    operations = [
        migrations.AddField(
            model_name='newspost',
            name='translation_status',
            field=models.CharField(
                blank=True,
                choices=[
                    ('pending', 'Pending'),
                    ('in_progress', 'In progress'),
                    ('completed', 'Completed'),
                    ('failed', 'Failed'),
                ],
                db_index=True,
                default=None,
                help_text='Статус фонового перевода. NULL = перевод не запрашивался.',
                max_length=16,
                null=True,
                verbose_name='Translation Status',
            ),
        ),
        migrations.AddField(
            model_name='newspost',
            name='translation_error',
            field=models.TextField(
                blank=True,
                help_text='Последняя ошибка Celery-задачи перевода (если была).',
                null=True,
                verbose_name='Translation Error',
            ),
        ),
    ]
