"""Сервис бизнес-логики для проектной документации."""

from django.utils import timezone

from estimates.models import Project


def mark_primary_check(project: Project, user) -> Project:
    """Отметить первичную проверку проекта."""
    project.primary_check_done = True
    project.primary_check_by = user
    project.primary_check_date = timezone.now().date()
    project.save(update_fields=[
        'primary_check_done', 'primary_check_by', 'primary_check_date',
    ])
    return project


def mark_secondary_check(project: Project, user) -> Project:
    """Отметить вторичную проверку проекта."""
    project.secondary_check_done = True
    project.secondary_check_by = user
    project.secondary_check_date = timezone.now().date()
    project.save(update_fields=[
        'secondary_check_done', 'secondary_check_by', 'secondary_check_date',
    ])
    return project


def approve_production(project: Project, file=None) -> Project:
    """Разрешить 'В производство работ'."""
    project.is_approved_for_production = True
    project.production_approval_date = timezone.now().date()

    update_fields = ['is_approved_for_production', 'production_approval_date']

    if file is not None:
        project.production_approval_file = file
        update_fields.append('production_approval_file')

    project.save(update_fields=update_fields)
    return project
