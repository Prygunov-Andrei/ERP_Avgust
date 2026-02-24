from django.db import migrations


OLD_TO_NEW = {
    'payments': 'finance',
    'projects': 'commercial',
    'proposals': 'commercial',
    'catalog': 'settings',
    'banking': 'finance',
    'banking_approve': 'finance_approve',
    'recurring_payments': 'finance',
    'warehouse': 'supply',
    'object_tasks': 'objects',
}

NEW_SECTIONS = [
    'dashboard', 'commercial', 'objects', 'finance', 'contracts',
    'supply', 'pto', 'marketing', 'communications', 'settings', 'help',
    'finance_approve', 'supply_approve', 'kanban_admin',
]


def migrate_permissions_forward(apps, schema_editor):
    Employee = apps.get_model('personnel', 'Employee')
    for emp in Employee.objects.all():
        old_perms = emp.erp_permissions or {}
        new_perms = {s: 'none' for s in NEW_SECTIONS}

        for old_key, level in old_perms.items():
            if level == 'none':
                continue
            if old_key in NEW_SECTIONS:
                new_perms[old_key] = _best(new_perms.get(old_key, 'none'), level)
            elif old_key in OLD_TO_NEW:
                target = OLD_TO_NEW[old_key]
                new_perms[target] = _best(new_perms.get(target, 'none'), level)

        emp.erp_permissions = new_perms
        emp.save(update_fields=['erp_permissions'])


def _best(a, b):
    order = {'none': 0, 'read': 1, 'edit': 2}
    return a if order.get(a, 0) >= order.get(b, 0) else b


class Migration(migrations.Migration):
    dependencies = [
        ('personnel', '0001_initial'),
    ]

    operations = [
        migrations.RunPython(migrate_permissions_forward, migrations.RunPython.noop),
    ]
