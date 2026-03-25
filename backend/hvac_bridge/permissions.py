from rest_framework.permissions import SAFE_METHODS, BasePermission

from personnel.models import resolve_permission_level


def has_hvac_admin_access(user, method: str) -> bool:
    if not user or not user.is_authenticated:
        return False

    if user.is_superuser or user.is_staff:
        return True

    employee = getattr(user, 'employee', None)
    if employee is None:
        return False

    perms = employee.erp_permissions or {}
    required_sections = ('marketing', 'settings.config') if method in SAFE_METHODS else ('marketing',)
    allowed_levels = ('read', 'edit') if method in SAFE_METHODS else ('edit',)

    return any(
        resolve_permission_level(perms, section) in allowed_levels
        for section in required_sections
    )


class IsHvacAdminProxyAllowed(BasePermission):
    """
    HVAC admin должен проходить серверную ERP-проверку, а не только
    проверку валидности JWT в frontend BFF.
    """

    message = 'Недостаточно прав для HVAC admin.'
    read_sections = ('marketing', 'settings.config')
    write_sections = ('marketing',)

    def has_permission(self, request, view):
        return has_hvac_admin_access(request.user, request.method)
