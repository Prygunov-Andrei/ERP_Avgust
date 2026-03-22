"""
Декларативный валидатор переходов статусов.

Использование:

    TRANSITIONS = {
        'planned': ['approved', 'cancelled'],
        'approved': ['paid', 'cancelled'],
        'paid': [],
        'cancelled': [],
    }

    validate_transition(instance, 'approved', TRANSITIONS, status_field='status')
"""

from rest_framework.exceptions import ValidationError


def validate_transition(instance, new_status, transitions, *, status_field='status'):
    """
    Проверяет допустимость перехода статуса.

    Args:
        instance: модель с текущим статусом
        new_status: целевой статус
        transitions: dict {текущий_статус: [допустимые_целевые]}
        status_field: имя поля статуса на модели

    Returns:
        текущий статус (для удобства)

    Raises:
        ValidationError: если переход недопустим
    """
    current = getattr(instance, status_field)

    allowed = transitions.get(current, [])
    if new_status not in allowed:
        raise ValidationError({
            'status': f'Переход "{current}" → "{new_status}" недопустим. '
                      f'Допустимые: {", ".join(allowed) if allowed else "нет"}.'
        })

    return current
