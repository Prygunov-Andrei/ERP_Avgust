"""
personnel/services.py — бизнес-логика для сотрудников и оргструктуры.

Вынесена из views.py для тонких view-обёрток.
"""
from __future__ import annotations

from typing import Iterable


def reset_access_for_all(Employee, director_usernames: Iterable[str], get_all_keys, default_perms) -> dict:
    """
    Обнулить erp_permissions у всех сотрудников и выдать полный edit директорам.

    Параметры Employee/get_all_keys/default_perms приняты явно, чтобы функция
    была пригодна и для обычного рантайма, и для data-миграции (через apps.get_model).

    Returns:
        dict со счётчиками: {'directors': N, 'reset': M}
    """
    director_set = set(director_usernames)
    full_edit = {key: 'edit' for key in get_all_keys()}
    empty = default_perms()

    directors = 0
    reset = 0
    for emp in Employee.objects.all():
        username = emp.user.username if emp.user_id else None
        if username in director_set:
            emp.erp_permissions = full_edit
            directors += 1
        else:
            emp.erp_permissions = empty
            reset += 1
        emp.save(update_fields=['erp_permissions'])

    return {'directors': directors, 'reset': reset}


def create_position_record(employee, validated_data, save_fn):
    """
    Создать запись о должности и обновить денормализованное поле.

    Args:
        employee: Employee instance
        validated_data: dict с валидированными данными (включая employee pk)
        save_fn: callable — serializer.save()
    Returns:
        Сохранённый PositionRecord (через serializer).
    """
    instance = save_fn()

    current = employee.positions.filter(is_current=True).first()
    if current:
        employee.current_position = current.position_title
        employee.save(update_fields=['current_position'])

    return instance


def create_salary_record(employee, validated_data, save_fn):
    """
    Создать запись об окладе и обновить денормализованные поля.

    Args:
        employee: Employee instance
        validated_data: dict с salary_full / salary_official
        save_fn: callable — serializer.save()
    Returns:
        Сохранённый SalaryHistory (через serializer).
    """
    instance = save_fn()

    employee.salary_full = validated_data['salary_full']
    employee.salary_official = validated_data['salary_official']
    employee.save(update_fields=['salary_full', 'salary_official'])

    return instance


def create_counterparty_for_employee(employee):
    """
    Создать контрагента типа 'employee' и привязать к сотруднику.

    Returns:
        Counterparty instance.
    Raises:
        ValueError — если контрагент уже привязан.
    """
    if employee.counterparty:
        raise ValueError('У сотрудника уже есть привязанный контрагент.')

    from accounting.models import Counterparty

    counterparty = Counterparty.objects.create(
        name=employee.full_name,
        short_name=employee.full_name,
        type='employee',
        legal_form='fiz',
        inn='',
    )
    employee.counterparty = counterparty
    employee.save(update_fields=['counterparty'])

    return counterparty


def build_org_chart(employees):
    """
    Сформировать данные оргструктуры (nodes + edges) по queryset сотрудников.

    Returns:
        dict {'nodes': [...], 'edges': [...]}
    """
    nodes = []
    edges = []
    employee_ids = set()

    for emp in employees:
        employee_ids.add(emp.id)
        current_positions = emp.positions.all()
        nodes.append({
            'id': emp.id,
            'full_name': emp.full_name,
            'current_position': emp.current_position,
            'is_active': emp.is_active,
            'legal_entities': [
                {
                    'id': p.legal_entity.id,
                    'short_name': p.legal_entity.short_name,
                    'position_title': p.position_title,
                }
                for p in current_positions
            ],
        })

    # Собираем рёбра (только между видимыми сотрудниками)
    for emp in employees:
        for supervisor in emp.supervisors.all():
            if supervisor.id in employee_ids:
                edges.append({
                    'source': supervisor.id,
                    'target': emp.id,
                })

    return {'nodes': nodes, 'edges': edges}
