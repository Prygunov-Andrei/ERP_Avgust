"""
personnel/tests/test_services.py — тесты бизнес-логики services.py.

Тестируем create_position_record, create_salary_record, build_org_chart
без обращения к БД через mock objects.
"""
from decimal import Decimal
from unittest.mock import Mock, MagicMock, patch, call

import pytest
from django.test import SimpleTestCase

from personnel.services import (
    create_position_record,
    create_salary_record,
    create_counterparty_for_employee,
    build_org_chart,
)


class TestCreatePositionRecord(SimpleTestCase):
    """Тесты create_position_record."""

    def test_calls_save_fn_and_returns_instance(self):
        """save_fn вызывается и результат возвращается."""
        employee = Mock()
        employee.positions.filter.return_value.first.return_value = None
        saved_instance = Mock()
        save_fn = Mock(return_value=saved_instance)

        result = create_position_record(employee, {}, save_fn)

        save_fn.assert_called_once()
        assert result is saved_instance

    def test_updates_current_position_when_exists(self):
        """Если есть текущая должность — обновляет current_position на сотруднике."""
        employee = Mock()
        current_pos = Mock()
        current_pos.position_title = 'Инженер'
        employee.positions.filter.return_value.first.return_value = current_pos

        save_fn = Mock(return_value=Mock())

        create_position_record(employee, {}, save_fn)

        employee.positions.filter.assert_called_once_with(is_current=True)
        assert employee.current_position == 'Инженер'
        employee.save.assert_called_once_with(update_fields=['current_position'])

    def test_does_not_update_when_no_current_position(self):
        """Если текущей должности нет — save на employee не вызывается."""
        employee = Mock()
        employee.positions.filter.return_value.first.return_value = None

        save_fn = Mock(return_value=Mock())

        create_position_record(employee, {}, save_fn)

        employee.save.assert_not_called()


class TestCreateSalaryRecord(SimpleTestCase):
    """Тесты create_salary_record."""

    def test_calls_save_fn_and_returns_instance(self):
        employee = Mock()
        saved_instance = Mock()
        save_fn = Mock(return_value=saved_instance)
        validated_data = {
            'salary_full': Decimal('100000'),
            'salary_official': Decimal('50000'),
        }

        result = create_salary_record(employee, validated_data, save_fn)

        save_fn.assert_called_once()
        assert result is saved_instance

    def test_updates_employee_salary_fields(self):
        """Обновляет salary_full и salary_official на employee."""
        employee = Mock()
        save_fn = Mock(return_value=Mock())
        validated_data = {
            'salary_full': Decimal('120000'),
            'salary_official': Decimal('60000'),
        }

        create_salary_record(employee, validated_data, save_fn)

        assert employee.salary_full == Decimal('120000')
        assert employee.salary_official == Decimal('60000')
        employee.save.assert_called_once_with(
            update_fields=['salary_full', 'salary_official']
        )

    def test_zero_salary_accepted(self):
        """Нулевой оклад допустим."""
        employee = Mock()
        save_fn = Mock(return_value=Mock())
        validated_data = {
            'salary_full': Decimal('0'),
            'salary_official': Decimal('0'),
        }

        create_salary_record(employee, validated_data, save_fn)

        assert employee.salary_full == Decimal('0')
        assert employee.salary_official == Decimal('0')


class TestCreateCounterpartyForEmployee(SimpleTestCase):
    """Тесты create_counterparty_for_employee."""

    def test_raises_if_already_has_counterparty(self):
        employee = Mock()
        employee.counterparty = Mock()  # truthy — уже привязан

        with pytest.raises(ValueError, match='уже есть привязанный контрагент'):
            create_counterparty_for_employee(employee)

    @patch('personnel.services.Counterparty', create=True)
    def test_creates_and_links_counterparty(self, mock_cp_import):
        """Создаёт контрагента и привязывает к сотруднику."""
        with patch('accounting.models.Counterparty') as MockCounterparty:
            employee = Mock()
            employee.counterparty = None  # falsy — нет контрагента
            employee.full_name = 'Иванов Иван'

            fake_cp = Mock()
            MockCounterparty.objects.create.return_value = fake_cp

            result = create_counterparty_for_employee(employee)

            MockCounterparty.objects.create.assert_called_once_with(
                name='Иванов Иван',
                short_name='Иванов Иван',
                type='employee',
                legal_form='fiz',
                inn='',
            )
            assert employee.counterparty is fake_cp
            employee.save.assert_called_once_with(update_fields=['counterparty'])
            assert result is fake_cp


class TestBuildOrgChart(SimpleTestCase):
    """Тесты build_org_chart."""

    def _make_employee(self, emp_id, full_name, current_position, is_active,
                       positions=None, supervisors=None):
        emp = Mock()
        emp.id = emp_id
        emp.full_name = full_name
        emp.current_position = current_position
        emp.is_active = is_active

        # positions — list of Mock(legal_entity=Mock(id=..., short_name=...), position_title=...)
        emp.positions.all.return_value = positions or []
        emp.supervisors.all.return_value = supervisors or []
        return emp

    def test_empty_employees(self):
        result = build_org_chart([])
        assert result == {'nodes': [], 'edges': []}

    def test_single_employee_no_supervisor(self):
        emp = self._make_employee(1, 'Иванов', 'Директор', True)
        result = build_org_chart([emp])

        assert len(result['nodes']) == 1
        assert result['nodes'][0]['id'] == 1
        assert result['nodes'][0]['full_name'] == 'Иванов'
        assert result['nodes'][0]['current_position'] == 'Директор'
        assert result['nodes'][0]['is_active'] is True
        assert result['edges'] == []

    def test_supervisor_edge_created(self):
        boss = self._make_employee(1, 'Босс', 'CEO', True)
        subordinate = self._make_employee(2, 'Работник', 'Инженер', True)

        # У subordinate есть supervisor=boss
        boss.supervisors.all.return_value = []
        subordinate.supervisors.all.return_value = [boss]

        result = build_org_chart([boss, subordinate])

        assert len(result['nodes']) == 2
        assert len(result['edges']) == 1
        assert result['edges'][0] == {'source': 1, 'target': 2}

    def test_supervisor_outside_queryset_ignored(self):
        """Ребро не создаётся, если supervisor не в списке employees."""
        external_boss = Mock()
        external_boss.id = 99

        emp = self._make_employee(1, 'Работник', 'Инженер', True)
        emp.supervisors.all.return_value = [external_boss]

        result = build_org_chart([emp])

        assert len(result['nodes']) == 1
        assert result['edges'] == []

    def test_legal_entities_in_nodes(self):
        """Nodes содержат данные legal_entities из positions."""
        le = Mock()
        le.id = 10
        le.short_name = 'ООО Рога'

        pos = Mock()
        pos.legal_entity = le
        pos.position_title = 'Начальник'

        emp = self._make_employee(1, 'Работник', 'Начальник', True, positions=[pos])

        result = build_org_chart([emp])

        node = result['nodes'][0]
        assert len(node['legal_entities']) == 1
        assert node['legal_entities'][0]['id'] == 10
        assert node['legal_entities'][0]['short_name'] == 'ООО Рога'
        assert node['legal_entities'][0]['position_title'] == 'Начальник'
