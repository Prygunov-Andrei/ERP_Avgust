"""
Data migration: перенос ERP-разрешений из settings.goods → goods.*
и commercial.pricelists → goods.pricelists.
Также переименование категории 'Услуги' → 'Услуги субподрядчиков'.
"""
from django.db import migrations


def migrate_permissions_forward(apps, schema_editor):
    Employee = apps.get_model('personnel', 'Employee')

    for emp in Employee.objects.exclude(erp_permissions=None):
        perms = emp.erp_permissions or {}
        changed = False

        # 1. settings.goods → goods (и все goods.* наследуют)
        old_goods = perms.pop('settings.goods', None)
        if old_goods is not None:
            perms['goods'] = old_goods
            for sub in ('categories', 'catalog', 'moderation',
                        'works', 'pricelists', 'grades'):
                perms[f'goods.{sub}'] = old_goods
            changed = True

        # 2. commercial.pricelists → goods.pricelists
        old_pl = perms.pop('commercial.pricelists', None)
        if old_pl is not None:
            perms['goods.pricelists'] = old_pl
            changed = True

        if changed:
            emp.erp_permissions = perms
            emp.save(update_fields=['erp_permissions'])

    # 3. Переименование категории
    Category = apps.get_model('catalog', 'Category')
    Category.objects.filter(code='services').update(
        name='Услуги субподрядчиков'
    )


def migrate_permissions_reverse(apps, schema_editor):
    Employee = apps.get_model('personnel', 'Employee')

    for emp in Employee.objects.exclude(erp_permissions=None):
        perms = emp.erp_permissions or {}
        changed = False

        goods_level = perms.pop('goods', None)
        if goods_level is not None:
            perms['settings.goods'] = goods_level
            changed = True

        goods_pl = perms.pop('goods.pricelists', None)
        if goods_pl is not None:
            perms['commercial.pricelists'] = goods_pl
            changed = True

        # Remove all goods.* keys
        for key in list(perms.keys()):
            if key.startswith('goods.'):
                perms.pop(key)
                changed = True

        if changed:
            emp.erp_permissions = perms
            emp.save(update_fields=['erp_permissions'])

    Category = apps.get_model('catalog', 'Category')
    Category.objects.filter(code='services').update(name='Услуги')


class Migration(migrations.Migration):

    dependencies = [
        ('personnel', '0003_migrate_subsection_permissions'),
        ('catalog', '0001_initial'),
    ]

    operations = [
        migrations.RunPython(
            migrate_permissions_forward,
            migrate_permissions_reverse,
        ),
    ]
