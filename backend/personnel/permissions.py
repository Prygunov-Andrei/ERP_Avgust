import logging
from rest_framework.permissions import BasePermission
from personnel.models import resolve_permission_level

logger = logging.getLogger(__name__)


class ERPSectionPermission(BasePermission):
    """
    Проверяет права доступа сотрудника к разделам ERP.

    Определяет раздел по URL-prefix запроса и проверяет
    erp_permissions у связанного Employee.
    Поддерживает точечную нотацию (section.subsection) с fallback
    на родительский раздел.

    Суперпользователи — всегда имеют полный доступ.
    Пользователи без привязанного Employee — полный доступ.
    """

    SECTION_MAP = {
        # Объекты
        '/api/v1/objects/': 'objects',
        # Коммерческие предложения
        '/api/v1/estimates/': 'commercial.estimates',
        '/api/v1/proposals/': 'commercial.tkp',
        '/api/v1/mounting-proposals/': 'commercial.mp',
        '/api/v1/price-lists/': 'goods.pricelists',
        # Финансы
        '/api/v1/payments/': 'finance.payments',
        '/api/v1/expense-categories/': 'finance.payments',
        '/api/v1/bank-connections/': 'finance.statements',
        '/api/v1/bank-accounts/': 'finance.statements',
        '/api/v1/bank-transactions/': 'finance.statements',
        '/api/v1/bank-payment-orders/': 'finance.payments',
        '/api/v1/payment-registry/': 'finance_approve',
        # Договоры
        '/api/v1/contracts/': 'contracts.object_contracts',
        '/api/v1/framework-contracts/': 'contracts.framework',
        '/api/v1/acts/': 'contracts.acts',
        # Снабжение и Склад
        '/api/v1/supply/': 'supply',
        '/api/v1/invoices/': 'supply.invoices',
        '/api/v1/warehouse/': 'supply.warehouse',
        # Переписка
        '/api/v1/communications/': 'communications',
        # Справочники и настройки
        '/api/v1/catalog/': 'goods.catalog',
        '/api/v1/work-items/': 'goods.works',
        '/api/v1/work-sections/': 'goods.works',
        '/api/v1/worker-grades/': 'goods.grades',
        '/api/v1/tax-systems/': 'settings.config',
        '/api/v1/legal-entities/': 'settings.config',
        '/api/v1/accounts/': 'settings.config',
        '/api/v1/personnel/': 'settings.personnel',
        '/api/v1/front-of-work-items/': 'settings.work_conditions',
        '/api/v1/mounting-conditions/': 'settings.work_conditions',
        '/api/v1/counterparties/': 'settings.counterparties',
    }

    SAFE_METHODS = ('GET', 'HEAD', 'OPTIONS')

    def has_permission(self, request, view):
        user = request.user

        if not user or not user.is_authenticated:
            return False

        if user.is_superuser:
            return True

        path = request.path
        section = None
        for prefix, section_code in self.SECTION_MAP.items():
            if path.startswith(prefix):
                section = section_code
                break

        if section is None:
            return True

        employee = getattr(user, 'employee', None)
        if employee is None:
            return True

        perms = employee.erp_permissions or {}
        level = resolve_permission_level(perms, section)

        if request.method in self.SAFE_METHODS:
            return level in ('read', 'edit')
        return level == 'edit'
