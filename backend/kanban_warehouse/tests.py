"""
kanban_warehouse/tests.py — тесты бизнес-логики складского модуля.
"""
import uuid
from decimal import Decimal
from unittest.mock import Mock, patch, MagicMock

import pytest
from django.core.exceptions import ValidationError
from django.test import SimpleTestCase

from kanban_warehouse.models import StockLocation, StockMove, StockMoveLine
from kanban_warehouse.views import StockLocationViewSet, StockMoveViewSet
from core.kanban_permissions import KanbanRolePermissionMixin


class TestStockMoveCleanValidation(SimpleTestCase):
    """Тестируем валидацию StockMove.clean() без БД.

    Используем Mock + .__dict__ для обхода Django descriptor'ов на FK-полях.
    """

    def _make_move(self, move_type, from_loc=None, to_loc=None, reason=''):
        move = Mock(spec=StockMove)
        move.move_type = move_type
        move.from_location_id = from_loc
        move.to_location_id = to_loc
        move.reason = reason
        # Mock(spec=...) подменяет MoveType — нужно вернуть реальные константы
        move.MoveType = StockMove.MoveType
        # Вызываем реальный clean, привязанный к mock
        move.clean = lambda: StockMove.clean(move)
        return move

    def test_in_requires_to_location(self):
        move = self._make_move('IN', from_loc=None, to_loc=None)
        with pytest.raises(ValidationError) as exc_info:
            move.clean()
        assert 'to_location' in exc_info.value.message_dict

    def test_in_with_to_location_passes(self):
        move = self._make_move('IN', to_loc=uuid.uuid4())
        move.clean()  # no exception

    def test_out_requires_from_location(self):
        move = self._make_move('OUT', from_loc=None, to_loc=None)
        with pytest.raises(ValidationError) as exc_info:
            move.clean()
        assert 'from_location' in exc_info.value.message_dict

    def test_out_with_from_location_passes(self):
        move = self._make_move('OUT', from_loc=uuid.uuid4())
        move.clean()  # no exception

    def test_adjust_requires_location(self):
        move = self._make_move('ADJUST', from_loc=None, to_loc=None, reason='correction')
        with pytest.raises(ValidationError) as exc_info:
            move.clean()
        assert 'to_location' in exc_info.value.message_dict

    def test_adjust_requires_reason(self):
        move = self._make_move('ADJUST', to_loc=uuid.uuid4(), reason='')
        with pytest.raises(ValidationError) as exc_info:
            move.clean()
        assert 'reason' in exc_info.value.message_dict

    def test_adjust_with_location_and_reason_passes(self):
        move = self._make_move('ADJUST', to_loc=uuid.uuid4(), reason='inventory fix')
        move.clean()  # no exception


class TestStockLocationViewSetConfig(SimpleTestCase):
    """Проверяем конфигурацию StockLocationViewSet."""

    def test_kanban_write_role_is_warehouse(self):
        assert StockLocationViewSet.kanban_write_role == 'warehouse'

    def test_uses_kanban_role_permission_mixin(self):
        assert issubclass(StockLocationViewSet, KanbanRolePermissionMixin)


class TestStockLocationSerializerValidation(SimpleTestCase):
    """Тестируем валидацию StockLocationSerializer."""

    def test_object_kind_requires_erp_object_id(self):
        from kanban_warehouse.serializers import StockLocationSerializer
        data = {'kind': 'object', 'title': 'Объект 1', 'erp_object_id': None}
        s = StockLocationSerializer(data=data)
        assert not s.is_valid()
        assert 'erp_object_id' in s.errors

    def test_warehouse_kind_clears_erp_object_id(self):
        from kanban_warehouse.serializers import StockLocationSerializer
        data = {'kind': 'warehouse', 'title': 'Склад 1', 'erp_object_id': 42}
        s = StockLocationSerializer(data=data)
        s.is_valid(raise_exception=True)
        assert s.validated_data['erp_object_id'] is None

    def test_valid_warehouse_data_passes(self):
        from kanban_warehouse.serializers import StockLocationSerializer
        data = {'kind': 'warehouse', 'title': 'Основной склад'}
        s = StockLocationSerializer(data=data)
        assert s.is_valid(), s.errors


class TestBalancesActionLogic(SimpleTestCase):
    """Тестируем логику расчёта остатков из balances action."""

    @patch('kanban_warehouse.views.StockMoveLine')
    def test_location_id_required(self, mock_sml_cls):
        """balances без location_id возвращает 400."""
        # Мокаем queryset, чтобы не обращаться к БД.
        # Код попадает в qs iteration, но при отсутствии location_id
        # возвращает ошибку при первой итерации.
        mock_qs = MagicMock()
        mock_qs.select_related.return_value = mock_qs
        # Имитируем одну строку — чтобы вызвать branch без location_id
        mock_line = Mock()
        mock_line.move = Mock()
        mock_line.erp_product_id = 1
        mock_line.product_name = 'Test'
        mock_line.unit = 'шт'
        mock_line.qty = Decimal('10')
        mock_qs.__iter__ = Mock(return_value=iter([mock_line]))
        mock_sml_cls.objects.select_related.return_value = mock_qs

        vs = StockMoveViewSet()
        request = Mock()
        request.query_params = {}
        vs.request = request
        vs.format_kwarg = None
        vs.kwargs = {}

        response = vs.balances(request)
        assert response.status_code == 400
        assert 'location_id is required' in str(response.data)

    @patch('kanban_warehouse.views.StockMoveLine')
    def test_balances_calculation_in_and_out(self, mock_sml_cls):
        """Тестируем расчёт баланса: IN +qty, OUT -qty."""
        loc_id = str(uuid.uuid4())

        line_in = Mock()
        line_in.move = Mock()
        line_in.move.to_location_id = loc_id
        line_in.move.from_location_id = None
        line_in.erp_product_id = 1
        line_in.product_name = 'Труба'
        line_in.unit = 'м'
        line_in.qty = Decimal('100')

        line_out = Mock()
        line_out.move = Mock()
        line_out.move.to_location_id = None
        line_out.move.from_location_id = loc_id
        line_out.erp_product_id = 1
        line_out.product_name = 'Труба'
        line_out.unit = 'м'
        line_out.qty = Decimal('30')

        mock_qs = MagicMock()
        mock_qs.select_related.return_value = mock_qs
        mock_qs.filter.return_value = mock_qs
        mock_qs.__or__ = Mock(return_value=mock_qs)
        mock_qs.__iter__ = Mock(return_value=iter([line_in, line_out]))
        mock_sml_cls.objects.select_related.return_value = mock_qs

        vs = StockMoveViewSet()
        request = Mock()
        request.query_params = {'location_id': loc_id}
        vs.request = request
        vs.format_kwarg = None
        vs.kwargs = {}

        response = vs.balances(request)
        assert response.status_code == 200
        results = response.data['results']
        assert len(results) == 1
        assert results[0]['product_name'] == 'Труба'
        assert results[0]['qty'] == '70'
        assert results[0]['ahhtung'] is False
