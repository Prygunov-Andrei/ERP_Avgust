from __future__ import annotations

from django.db import migrations


# Маппинг кодов критериев → группа в таблице «Характеристики».
# Сверено с реальными кодами (34 шт) в дампе Максима 2026-04-21.
# Имена кодов в БД отличаются от первичного предположения ТЗ
# (`heating_capability` вместо `heating_capacity`, `inverter` вместо
# `inverter_compressor` и т.д.) — словарь под фактические коды.
CODE_TO_GROUP = {
    # climate (3)
    "energy_efficiency": "climate",
    "heating_capability": "climate",
    "standby_heating": "climate",
    # compressor (11)
    "heat_exchanger_inner": "compressor",
    "heat_exchanger_outer": "compressor",
    "compressor_power": "compressor",
    "inverter": "compressor",
    "evi": "compressor",
    "erv": "compressor",
    "drain_pan_heater": "compressor",
    "max_pipe_length": "compressor",
    "max_height_diff": "compressor",
    "fan_speed_outdoor": "compressor",
    "tolschina_heat_outdoor": "compressor",
    # acoustics (3)
    "noise": "acoustics",
    "vibration": "acoustics",
    "fan_speeds_indoor": "acoustics",
    # control (14)
    "wifi": "control",
    "alice_control": "control",
    "ir_sensor": "control",
    "russian_remote": "control",
    "ionizer_type": "control",
    "uv_lamp": "control",
    "fresh_air": "control",
    "air_freshener": "control",
    "self_clean_freezing": "control",
    "temp_sterilization": "control",
    "fine_filters": "control",
    "remote_holder": "control",
    "remote_backlight": "control",
    "louver_control": "control",
    # dimensions (2)
    "warranty": "dimensions",
    "brand_age_ru": "dimensions",
    # other (1, явно не относится ни к одной группе):
    # min_voltage — рабочий диапазон напряжения, оставляем default `other`.
}


def populate_groups(apps, schema_editor):
    Criterion = apps.get_model("ac_methodology", "Criterion")
    for c in Criterion.objects.all():
        new_group = CODE_TO_GROUP.get(c.code, "other")
        if c.group != new_group:
            c.group = new_group
            c.save(update_fields=["group"])


def reset_to_other(apps, schema_editor):
    Criterion = apps.get_model("ac_methodology", "Criterion")
    Criterion.objects.update(group="other")


class Migration(migrations.Migration):

    dependencies = [
        ("ac_methodology", "0002_add_criterion_group"),
    ]

    operations = [
        migrations.RunPython(populate_groups, reset_to_other),
    ]
