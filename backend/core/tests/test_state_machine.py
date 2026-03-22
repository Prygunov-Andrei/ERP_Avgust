"""Тесты для core.state_machine."""

import pytest
from unittest.mock import Mock
from rest_framework.exceptions import ValidationError

from core.state_machine import validate_transition


TRANSITIONS = {
    'draft': ['active', 'cancelled'],
    'active': ['completed', 'cancelled'],
    'completed': [],
    'cancelled': [],
}


class TestValidateTransition:
    def test_valid_transition(self):
        obj = Mock(status='draft')
        result = validate_transition(obj, 'active', TRANSITIONS)
        assert result == 'draft'

    def test_valid_transition_second_option(self):
        obj = Mock(status='draft')
        validate_transition(obj, 'cancelled', TRANSITIONS)

    def test_invalid_transition_raises(self):
        obj = Mock(status='draft')
        with pytest.raises(ValidationError) as exc_info:
            validate_transition(obj, 'completed', TRANSITIONS)
        assert 'status' in exc_info.value.detail

    def test_no_transitions_from_terminal(self):
        obj = Mock(status='completed')
        with pytest.raises(ValidationError):
            validate_transition(obj, 'draft', TRANSITIONS)

    def test_custom_status_field(self):
        obj = Mock(state='draft')
        validate_transition(obj, 'active', TRANSITIONS, status_field='state')

    def test_unknown_current_status(self):
        obj = Mock(status='unknown')
        with pytest.raises(ValidationError):
            validate_transition(obj, 'active', TRANSITIONS)
