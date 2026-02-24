"""
Миграция erp_permissions: расширение плоского формата до иерархического
с точечной нотацией (section.subsection).

Старый формат: {'commercial': 'edit', 'settings': 'none', ...}
Новый формат:  {'commercial': 'edit', 'commercial.kanban': 'edit', ...,
                'settings': 'none', 'settings.goods': 'none', ...}

Подразделы наследуют уровень родительского раздела при миграции.
"""
from django.db import migrations


TREE = {
    'dashboard': [],
    'commercial': ['kanban', 'tkp', 'mp', 'estimates', 'pricelists'],
    'objects': [],
    'finance': ['dashboard', 'payments', 'statements', 'recurring',
                'debtors', 'accounting', 'budget', 'indicators'],
    'contracts': ['framework', 'object_contracts', 'estimates',
                  'mounting_estimates', 'acts', 'household'],
    'supply': ['kanban', 'invoices', 'drivers', 'moderation', 'warehouse'],
    'pto': ['projects', 'production', 'executive', 'samples', 'knowledge'],
    'marketing': ['kanban', 'potential_customers', 'executors'],
    'communications': [],
    'settings': ['goods', 'work_conditions', 'personnel',
                 'counterparties', 'config'],
    'help': [],
    'finance_approve': [],
    'supply_approve': [],
    'kanban_admin': [],
}

OLD_TO_PARENT = {
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


def _all_keys():
    keys = []
    for section, children in TREE.items():
        keys.append(section)
        for child in children:
            keys.append(f'{section}.{child}')
    return keys


def _best(a, b):
    order = {'none': 0, 'read': 1, 'edit': 2}
    return a if order.get(a, 0) >= order.get(b, 0) else b


def migrate_forward(apps, schema_editor):
    Employee = apps.get_model('personnel', 'Employee')
    all_keys = _all_keys()

    for emp in Employee.objects.all():
        old_perms = emp.erp_permissions or {}
        new_perms = {k: 'none' for k in all_keys}

        for old_key, level in old_perms.items():
            if level == 'none':
                continue

            target = old_key
            if old_key in OLD_TO_PARENT:
                target = OLD_TO_PARENT[old_key]

            if target in TREE:
                new_perms[target] = _best(new_perms.get(target, 'none'), level)
                for child in TREE[target]:
                    dotted = f'{target}.{child}'
                    new_perms[dotted] = _best(new_perms.get(dotted, 'none'), level)
            elif '.' in target and target in new_perms:
                new_perms[target] = _best(new_perms.get(target, 'none'), level)

        emp.erp_permissions = new_perms
        emp.save(update_fields=['erp_permissions'])


class Migration(migrations.Migration):
    dependencies = [
        ('personnel', '0002_migrate_erp_sections'),
    ]

    operations = [
        migrations.RunPython(migrate_forward, migrations.RunPython.noop),
    ]
