"""
Очистка базы данных от тестовых/seed данных.

Сохраняются:
  - auth.User (все)
  - personnel.* (Employee, PositionRecord, SalaryHistory)
  - accounting.TaxSystem
  - accounting.LegalEntity (3 реальных юрлица)
  - accounting.Account (счета реальных юрлиц)
  - core.UserProfile, core.Notification

Всё остальное удаляется.

  python manage.py cleanup_database
"""
from django.core.management.base import BaseCommand
from django.db import transaction

# ИНН реальных юрлиц (ГК Август, ПРОКСИМА, Техмастер)
REAL_INNS = {'5032322673', '5032322666', '5032201319'}


# Порядок удаления: листья → родители (обход PROTECT)
# Kanban-приложения работают в отдельном сервисе (kanban_service)
# и не входят в INSTALLED_APPS основного backend.
def _get_deletion_plan():
    """Возвращает список (app_label, Model) для удаления."""
    from llm_services.models import ParsedDocument, LLMProvider

    from worklog.models import (
        Answer, Question, Report, Media, TeamMembership,
        Team, ShiftRegistration, Shift, Supergroup,
        Worker, InviteToken,
    )

    from communications.models import Correspondence
    from supply.models import SupplyRequest, BitrixIntegration
    from fns.models import FNSReport, FNSCache

    from banking.models import (
        BankPaymentOrderEvent, BankPaymentOrder,
        BankTransaction, BankAccount, BankConnection,
    )

    from proposals.models import (
        TKPFrontOfWork, TKPCharacteristic,
        TKPEstimateSubsection, TKPEstimateSection,
        TKPStatusHistory,
        MountingProposal, TechnicalProposal,
        MountingCondition, FrontOfWorkItem,
    )

    from estimates.models import (
        MountingEstimate, EstimateCharacteristic,
        EstimateItem, EstimateSubsection, EstimateSection,
        Estimate, ProjectNote, Project,
    )

    from contracts.models import (
        EstimatePurchaseLink,
        ContractEstimateItem, ContractEstimateSection,
        ContractEstimate, ContractText,
        ActPaymentAllocation, ActItem, Act,
        WorkScheduleItem, ContractAmendment,
        Contract, FrameworkContract,
    )

    from payments.models import (
        JournalEntry, InvoiceEvent, InvoiceItem,
        RecurringPayment, BulkImportSession, PaymentItem,
        PaymentRegistry, Invoice, IncomeRecord,
        Payment, ExpenseCategory,
    )

    from catalog.models import (
        ProductWorkMapping, ProductPriceHistory,
        ProductAlias, Product, Category,
    )

    from pricelists.models import (
        PriceListItem, PriceListAgreement,
        WorkItem, PriceList,
        WorkerGradeSkills, WorkSection, WorkerGrade,
    )

    from objects.models import Object

    from accounting.models import (
        AccountBalance, Counterparty,
    )

    return [
        # --- 1. LLM ---
        ('llm_services', ParsedDocument),
        ('llm_services', LLMProvider),

        # --- 2. Worklog ---
        ('worklog', Answer),
        ('worklog', Question),
        ('worklog', Report),
        ('worklog', Media),
        ('worklog', TeamMembership),
        ('worklog', Team),
        ('worklog', ShiftRegistration),
        ('worklog', Shift),
        ('worklog', Supergroup),
        ('worklog', Worker),
        ('worklog', InviteToken),

        # --- 3. Misc ---
        ('communications', Correspondence),
        ('supply', SupplyRequest),
        ('supply', BitrixIntegration),
        ('fns', FNSReport),
        ('fns', FNSCache),

        # --- 4. Banking ---
        ('banking', BankPaymentOrderEvent),
        ('banking', BankPaymentOrder),
        ('banking', BankTransaction),
        ('banking', BankAccount),
        ('banking', BankConnection),

        # --- 5. Payments (до Contracts — ExpenseCategory
        #     ссылается на Contract через CASCADE, но сама
        #     защищена PROTECT из JournalEntry/Invoice и т.д.)
        ('payments', JournalEntry),
        ('payments', InvoiceEvent),
        ('payments', InvoiceItem),
        ('payments', RecurringPayment),
        ('payments', BulkImportSession),
        ('payments', PaymentItem),
        ('payments', PaymentRegistry),
        ('payments', Invoice),
        ('payments', IncomeRecord),
        ('payments', Payment),
        ('payments', ExpenseCategory),

        # --- 6. Proposals ---
        ('proposals', TKPFrontOfWork),
        ('proposals', TKPCharacteristic),
        ('proposals', TKPEstimateSubsection),
        ('proposals', TKPEstimateSection),
        ('proposals', TKPStatusHistory),
        ('proposals', MountingProposal),
        ('proposals', TechnicalProposal),
        ('proposals', MountingCondition),
        ('proposals', FrontOfWorkItem),

        # --- 7. Estimates ---
        ('estimates', MountingEstimate),
        ('estimates', EstimateCharacteristic),
        ('estimates', EstimateItem),
        ('estimates', EstimateSubsection),
        ('estimates', EstimateSection),
        ('estimates', Estimate),
        ('estimates', ProjectNote),
        ('estimates', Project),

        # --- 8. Contracts ---
        ('contracts', EstimatePurchaseLink),
        ('contracts', ContractEstimateItem),
        ('contracts', ContractEstimateSection),
        ('contracts', ContractEstimate),
        ('contracts', ContractText),
        ('contracts', ActPaymentAllocation),
        ('contracts', ActItem),
        ('contracts', Act),
        ('contracts', WorkScheduleItem),
        ('contracts', ContractAmendment),
        ('contracts', Contract),
        ('contracts', FrameworkContract),

        # --- 9. Catalog ---
        ('catalog', ProductWorkMapping),
        ('catalog', ProductPriceHistory),
        ('catalog', ProductAlias),
        ('catalog', Product),
        ('catalog', Category),

        # --- 10. Pricelists ---
        ('pricelists', PriceListItem),
        ('pricelists', PriceListAgreement),
        ('pricelists', WorkItem),
        ('pricelists', PriceList),
        ('pricelists', WorkerGradeSkills),
        ('pricelists', WorkSection),
        ('pricelists', WorkerGrade),

        # --- 11. Objects ---
        ('objects', Object),

        # --- 12. Accounting (лишние) ---
        ('accounting', AccountBalance),
        ('accounting', Counterparty),
    ]


class Command(BaseCommand):
    help = 'Очистка БД от тестовых данных (сохраняются User, Employee, юрлица)'

    def handle(self, *args, **options):
        plan = _get_deletion_plan()
        total = 0

        with transaction.atomic():
            for app_label, model_cls in plan:
                name = f'{app_label}.{model_cls.__name__}'
                qs = model_cls.objects.all()
                count = qs.count()
                if count:
                    qs.delete()
                    self.stdout.write(f'  {name}: {count}')
                    total += count

            # Удаляем лишние Account/LegalEntity
            total += self._cleanup_extra_entities()

            # Удаляем осиротевших User (не superuser, без Employee)
            total += self._cleanup_orphan_users()

        self.stdout.write('')
        self.stdout.write(self.style.SUCCESS(
            f'Очистка завершена. Удалено объектов: {total}'
        ))
        self._print_preserved()

    def _cleanup_extra_entities(self):
        from accounting.models import Account, LegalEntity

        count = 0

        # Удаляем счета, не принадлежащие реальным юрлицам
        extra_accounts = Account.objects.exclude(
            legal_entity__inn__in=REAL_INNS,
        )
        n = extra_accounts.count()
        if n:
            extra_accounts.delete()
            self.stdout.write(f'  accounting.Account (лишние): {n}')
            count += n

        # Удаляем юрлица, не входящие в список реальных
        extra_les = LegalEntity.objects.exclude(inn__in=REAL_INNS)
        n = extra_les.count()
        if n:
            extra_les.delete()
            self.stdout.write(
                f'  accounting.LegalEntity (лишние): {n}'
            )
            count += n

        return count

    def _cleanup_orphan_users(self):
        from django.contrib.auth.models import User

        orphans = User.objects.filter(
            is_superuser=False,
            employee__isnull=True,
        )
        n = orphans.count()
        if n:
            orphans.delete()
            self.stdout.write(
                f'  auth.User (тестовые, без Employee): {n}'
            )
        return n

    def _print_preserved(self):
        from accounting.models import LegalEntity
        from personnel.models import Employee
        from django.contrib.auth.models import User

        self.stdout.write('')
        self.stdout.write('Сохранено:')
        self.stdout.write(
            f'  User: {User.objects.count()}'
        )
        self.stdout.write(
            f'  Employee: {Employee.objects.count()}'
        )

        for le in LegalEntity.objects.all():
            acc_count = le.accounts.count()
            self.stdout.write(
                f'  {le.short_name} (ИНН {le.inn})'
                f' — счетов: {acc_count}'
            )
