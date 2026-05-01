# Generated for F8-06: rate-limit fields в HvacIsmetaSettings.
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("hvac_ismeta", "0002_ismetajob_ismetafeedback"),
    ]

    operations = [
        migrations.AddField(
            model_name="hvacismetasettings",
            name="hourly_per_session",
            field=models.IntegerField(
                default=5,
                help_text="Лимит загрузок PDF в час с одной сессии (через Redis).",
            ),
        ),
        migrations.AddField(
            model_name="hvacismetasettings",
            name="hourly_per_ip",
            field=models.IntegerField(
                default=10,
                help_text="Лимит загрузок PDF в час с одного IP-адреса.",
            ),
        ),
        migrations.AddField(
            model_name="hvacismetasettings",
            name="daily_per_ip",
            field=models.IntegerField(
                default=30,
                help_text="Лимит загрузок PDF в день с одного IP-адреса.",
            ),
        ),
    ]
