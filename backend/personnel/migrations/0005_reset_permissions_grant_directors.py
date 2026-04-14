"""
Data migration: обнулить erp_permissions всем сотрудникам и выдать полный доступ
трём директорам (Веракса, Савинов, Ефимова).

Приурочено к первому официальному деплою. Дальше директора сами выдают доступ
своим сотрудникам через UI «Персонал».
"""
from django.db import migrations

from personnel.models import default_erp_permissions, get_all_permission_keys
from personnel.services import reset_access_for_all


DIRECTOR_USERNAMES = ('savinov.a', 'veraksa.o', 'efimova.i')


def forward(apps, schema_editor):
    Employee = apps.get_model('personnel', 'Employee')
    reset_access_for_all(
        Employee=Employee,
        director_usernames=DIRECTOR_USERNAMES,
        get_all_keys=get_all_permission_keys,
        default_perms=default_erp_permissions,
    )


class Migration(migrations.Migration):

    dependencies = [
        ('personnel', '0004_migrate_goods_permissions'),
    ]

    operations = [
        migrations.RunPython(forward, migrations.RunPython.noop),
    ]
