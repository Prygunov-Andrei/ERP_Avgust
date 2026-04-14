"""
Тесты функции reset_access_for_all — сердце миграции 0005.

Тестируем саму функцию сервиса, а не миграцию напрямую (миграция — тонкая обёртка).
"""
import pytest
from django.contrib.auth.models import User

from personnel.models import (
    Employee,
    get_all_permission_keys,
    default_erp_permissions,
)
from personnel.services import reset_access_for_all


DIRECTOR_USERNAMES = ('savinov.a', 'veraksa.o', 'efimova.i')


@pytest.fixture
def directors_and_staff(db):
    """Три директора + двое рядовых + один сотрудник без User."""
    savinov = User.objects.create_user(username='savinov.a', password='p1')
    veraksa = User.objects.create_user(username='veraksa.o', password='p2')
    efimova = User.objects.create_user(username='efimova.i', password='p3')
    worker1 = User.objects.create_user(username='worker.1', password='p4')
    worker2 = User.objects.create_user(username='worker.2', password='p5')

    # Дадим всем стартовые «широкие» права, чтобы было с чего сбрасывать
    wide = {key: 'edit' for key in get_all_permission_keys()}

    Employee.objects.create(full_name='Савинов Андрей', user=savinov, erp_permissions=wide)
    Employee.objects.create(full_name='Веракса Ольга', user=veraksa, erp_permissions=wide)
    Employee.objects.create(full_name='Ефимова Ирина', user=efimova, erp_permissions=wide)
    Employee.objects.create(full_name='Иванов Иван', user=worker1, erp_permissions=wide)
    Employee.objects.create(full_name='Петров Пётр', user=worker2, erp_permissions=wide)
    Employee.objects.create(full_name='Без User', user=None, erp_permissions=wide)


@pytest.mark.django_db
class TestResetAccessForAll:
    def test_counters(self, directors_and_staff):
        result = reset_access_for_all(
            Employee=Employee,
            director_usernames=DIRECTOR_USERNAMES,
            get_all_keys=get_all_permission_keys,
            default_perms=default_erp_permissions,
        )
        assert result == {'directors': 3, 'reset': 3}

    def test_directors_have_full_edit(self, directors_and_staff):
        reset_access_for_all(
            Employee=Employee,
            director_usernames=DIRECTOR_USERNAMES,
            get_all_keys=get_all_permission_keys,
            default_perms=default_erp_permissions,
        )
        for username in DIRECTOR_USERNAMES:
            emp = Employee.objects.get(user__username=username)
            assert set(emp.erp_permissions.values()) == {'edit'}
            # Точечная сверка ключей
            for key in get_all_permission_keys():
                assert emp.erp_permissions[key] == 'edit'

    def test_non_directors_fully_reset_to_none(self, directors_and_staff):
        reset_access_for_all(
            Employee=Employee,
            director_usernames=DIRECTOR_USERNAMES,
            get_all_keys=get_all_permission_keys,
            default_perms=default_erp_permissions,
        )
        for username in ('worker.1', 'worker.2'):
            emp = Employee.objects.get(user__username=username)
            assert set(emp.erp_permissions.values()) == {'none'}

    def test_employee_without_user_is_reset(self, directors_and_staff):
        reset_access_for_all(
            Employee=Employee,
            director_usernames=DIRECTOR_USERNAMES,
            get_all_keys=get_all_permission_keys,
            default_perms=default_erp_permissions,
        )
        emp = Employee.objects.get(full_name='Без User')
        assert set(emp.erp_permissions.values()) == {'none'}

    def test_empty_queryset_is_safe(self, db):
        result = reset_access_for_all(
            Employee=Employee,
            director_usernames=DIRECTOR_USERNAMES,
            get_all_keys=get_all_permission_keys,
            default_perms=default_erp_permissions,
        )
        assert result == {'directors': 0, 'reset': 0}
