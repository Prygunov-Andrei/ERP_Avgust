"""
Расширенные edge-case тесты для core/state_machine.py — validate_transition.
"""
import pytest
from unittest.mock import Mock
from rest_framework.exceptions import ValidationError

from core.state_machine import validate_transition


# Основная таблица переходов
TRANSITIONS = {
    'draft': ['active', 'cancelled'],
    'active': ['completed', 'cancelled'],
    'completed': [],
    'cancelled': [],
}


class TestValidateTransitionEdgeCases:
    def test_self_transition_not_allowed(self):
        """Переход draft -> draft недопустим (нет в списке)."""
        obj = Mock(status='draft')
        with pytest.raises(ValidationError):
            validate_transition(obj, 'draft', TRANSITIONS)

    def test_transition_to_same_terminal_not_allowed(self):
        """completed -> completed недопустим."""
        obj = Mock(status='completed')
        with pytest.raises(ValidationError):
            validate_transition(obj, 'completed', TRANSITIONS)

    def test_error_message_contains_current_and_target(self):
        """Сообщение об ошибке содержит текущий и целевой статус."""
        obj = Mock(status='completed')
        with pytest.raises(ValidationError) as exc_info:
            validate_transition(obj, 'draft', TRANSITIONS)
        error_msg = str(exc_info.value.detail['status'])
        assert 'completed' in error_msg
        assert 'draft' in error_msg

    def test_error_message_lists_allowed_transitions(self):
        """Сообщение перечисляет допустимые переходы."""
        obj = Mock(status='active')
        with pytest.raises(ValidationError) as exc_info:
            validate_transition(obj, 'draft', TRANSITIONS)
        error_msg = str(exc_info.value.detail['status'])
        assert 'completed' in error_msg
        assert 'cancelled' in error_msg

    def test_terminal_state_error_says_no_transitions(self):
        """Терминальный статус — 'нет' допустимых переходов."""
        obj = Mock(status='completed')
        with pytest.raises(ValidationError) as exc_info:
            validate_transition(obj, 'active', TRANSITIONS)
        error_msg = str(exc_info.value.detail['status'])
        assert 'нет' in error_msg.lower()

    def test_returns_current_status(self):
        """При успехе возвращает текущий статус."""
        obj = Mock(status='draft')
        result = validate_transition(obj, 'active', TRANSITIONS)
        assert result == 'draft'

    def test_empty_transitions_dict(self):
        """Пустой transitions — любой переход недопустим."""
        obj = Mock(status='anything')
        with pytest.raises(ValidationError):
            validate_transition(obj, 'anywhere', {})

    def test_custom_status_field_name(self):
        """Кастомное имя поля статуса."""
        obj = Mock(current_state='draft')
        result = validate_transition(
            obj, 'active', TRANSITIONS, status_field='current_state',
        )
        assert result == 'draft'

    def test_transition_chain(self):
        """Полная цепочка переходов draft -> active -> completed."""
        obj = Mock(status='draft')
        validate_transition(obj, 'active', TRANSITIONS)
        obj.status = 'active'
        validate_transition(obj, 'completed', TRANSITIONS)
        obj.status = 'completed'
        # completed — терминальный, дальше нельзя
        with pytest.raises(ValidationError):
            validate_transition(obj, 'active', TRANSITIONS)

    def test_single_allowed_transition(self):
        """Единственная таблица: один переход."""
        simple = {'start': ['end'], 'end': []}
        obj = Mock(status='start')
        validate_transition(obj, 'end', simple)

        obj.status = 'end'
        with pytest.raises(ValidationError):
            validate_transition(obj, 'start', simple)
