"""
Загрузка реальных данных сотрудников и юрлиц.

Очищает тестовые данные, создаёт/обновляет юрлица с реальными реквизитами,
создаёт User-аккаунты и Employee-записи. Superuser сохраняется.

  python manage.py load_real_employees
"""
from datetime import date
from decimal import Decimal

from django.contrib.auth.models import User
from django.core.management.base import BaseCommand
from django.db import transaction
from django.db.models import ProtectedError

from accounting.models import Account, LegalEntity, TaxSystem
from personnel.models import Employee, PositionRecord, SalaryHistory


# (full_name, login, password, salary_full, salary_official,
#  date_of_birth, hire_date, gender, position, companies)
# companies: list of short_name strings; empty list = no company
# login=None means no User account
EMPLOYEES = [
    ('Савинов Андрей', 'savinov.a', 'Savinov1985',
     320000, 160000, '1985-04-13', '2020-12-21', 'M',
     'Генеральный директор', ['ГК Август']),

    ('Веракса Ольга', 'veraksa.o', 'Veraksa1990',
     320000, 160000, '1990-05-22', '2024-12-06', 'F',
     'Генеральный директор', ['ПРОКСИМА']),

    ('Ефимова Ирина', 'efimova.i', 'Efimova1988',
     320000, 160000, '1988-04-08', '2022-07-25', 'F',
     'Генеральный директор', ['Техмастер']),

    ('Бекетов Борис', 'beketov.b', 'Beketov1975',
     200000, 60000, '1975-04-13', '2025-11-01', 'M',
     'Главный инженер', ['ГК Август']),

    ('Мичурин Сергей', 'michurin.s', 'Michurin1984',
     150000, 50000, '1984-04-09', '2025-08-22', 'M',
     'Инженер по слаботочным системам', ['ПРОКСИМА']),

    ('Мозговая Дарья', 'mozgovaya.d', 'Mozgovaya1999',
     115000, 56000, '1999-09-17', '2024-02-01', 'F',
     'Руководитель сметного отдела', ['ГК Август']),

    ('Агишева Екатерина', 'agisheva.e', 'Agisheva1990',
     95000, 52200, '1990-11-10', '2025-04-01', 'F',
     'Сметчик', ['ГК Август']),

    ('Каракулина Ольга', 'karakulina.o', 'Karakulina2000',
     95000, 52200, '2000-06-20', '2025-06-23', 'F',
     'Сметчик', ['Техмастер']),

    ('Иванникова Оксана', 'ivannikova.o', 'Ivannikova1990',
     115000, 60000, '1990-01-23', '2020-12-21', 'F',
     'Руководитель ПТО', ['ГК Август']),

    ('Овсянникова Алена', 'ovsyannikova.a', 'Ovsyannikova1996',
     100000, 50000, '1996-09-19', '2024-12-02', 'F',
     'Инженер ПТО', ['ГК Август']),

    ('Ширяева Лена', 'shiryaeva.l', 'Shiryaeva1984',
     90000, 50000, '1984-02-10', '2025-04-01', 'F',
     'Инженер ПТО', ['ГК Август']),

    ('Гриднева Мария', 'gridneva.m', 'Gridneva1987',
     140000, 50000, '1987-09-05', '2023-09-01', 'F',
     'Главный бухгалтер', ['ГК Август', 'ПРОКСИМА']),

    ('Никифорова Ирина', 'nikiforova.i', 'Nikiforova1989',
     100000, 45000, '1989-05-29', '2026-03-02', 'F',
     'Бухгалтер', ['Техмастер']),

    ('Гусева Лидия', 'guseva.l', 'Guseva1981',
     60000, 60000, '1981-04-03', '2025-12-01', 'F',
     'Начальник отдела продаж', ['Техмастер']),

    ('Коровина Светлана', 'korovina.s', 'Korovina1989',
     50000, 50000, '1989-03-23', '2024-11-01', 'F',
     'Старший менеджер по продажам', ['ГК Август']),

    ('Кузнецова Ксения', 'kuznetsova.k', 'Kuznetsova2003',
     40000, 25000, '2003-02-06', '2024-11-01', 'F',
     'IT-менеджер', ['Техмастер']),

    ('Начальник отдела снабжения', 'snab', 'Snab2025',
     115000, 55000, None, None, '',
     'Начальник отдела снабжения', []),

    ('Широва Наталья', 'shirova.n', 'Shirova1978',
     95000, 50000, '1978-11-13', '2025-07-01', 'F',
     'Специалист по снабжению', ['Техмастер']),

    ('Павлов Андрей', 'pavlov.a', 'Pavlov1987',
     115000, 65250, '1987-02-15', '2023-06-05', 'M',
     'Начальник склада', ['ГК Август', 'ПРОКСИМА']),

    ('Демин Сергей', 'demin.s', 'Demin1967',
     90000, 50000, '1967-07-10', '2020-12-21', 'M',
     'Водитель-экспедитор', ['ГК Август', 'ПРОКСИМА']),

    ('Дубовой Павел', 'dubovoy.p', 'Dubovoy1970',
     90000, 50000, '1970-11-10', '2021-05-11', 'M',
     'Водитель-экспедитор', ['ГК Август', 'ПРОКСИМА']),

    ('Корниенко Женя', 'kornienko.e', 'Kornienko1991',
     90000, 0, '1991-09-14', None, 'M',
     'Кладовщик', []),

    ('Куля Дмитрий', 'kulya.d', 'Kulya1990',
     90000, 45000, '1990-12-12', '2021-10-14', 'M',
     'Кладовщик', ['ГК Август', 'ПРОКСИМА']),

    ('Савинова Юлия', 'savinova.y', 'Savinova1988',
     50000, 25000, '1988-05-10', '2025-08-18', 'F',
     'Менеджер по персоналу', ['Техмастер']),

    ('Уборщица', None, None,
     25000, 0, None, None, 'F',
     'Уборщица', []),
]

# Реальные реквизиты юрлиц
LEGAL_ENTITIES = [
    {
        'short_name': 'ГК Август',
        'name': 'ООО «ГК Август»',
        'inn': '5032322673',
        'kpp': '503201001',
        'ogrn': '1205000097004',
        'legal_address': '143011, Московская обл., г. Одинцово, Можайское шоссе, д. 58А, пом. 23, этаж 5',
        'director_name': 'Савинов Андрей Владимирович',
        'bank': {
            'name': 'Расчётный счёт (Точка)',
            'bank_name': 'Банк Точка (ПАО Банк «ФК Открытие»)',
            'number': '40702810501500182340',
            'bik': '044525104',
            'corr_account': '30101810745374525104',
        },
    },
    {
        'short_name': 'ПРОКСИМА',
        'name': 'ООО «ПРОКСИМА»',
        'inn': '5032322666',
        'kpp': '503201001',
        'ogrn': '1205000096894',
        'legal_address': '143011, Московская обл., г. Одинцово, Можайское шоссе, д. 58А, пом. 20, этаж 5',
        'director_name': 'Веракса Ольга Валерьевна',
        'bank': {
            'name': 'Расчётный счёт (Точка)',
            'bank_name': 'Банк Точка (ПАО Банк «ФК Открытие»)',
            'number': '40702810001500182280',
            'bik': '044525104',
            'corr_account': '30101810745374525104',
        },
    },
    {
        'short_name': 'Техмастер',
        'name': 'ООО «Техмастер»',
        'inn': '5032201319',
        'kpp': '503201001',
        'ogrn': '1175024006365',
        'legal_address': '143007, Московская обл., г. Одинцово, Можайское ш., д. 18, оф. 7, этаж 1',
        'director_name': 'Булушева Ольга Олеговна',
        'bank': {
            'name': 'Расчётный счёт (Точка)',
            'bank_name': 'Банк Точка (ПАО Банк «ФК Открытие»)',
            'number': '40702810020000018013',
            'bik': '044525104',
            'corr_account': '30101810745374525104',
        },
    },
]


class Command(BaseCommand):
    help = (
        'Загрузка реальных данных сотрудников и юрлиц '
        '(очистка тестовых + создание новых)'
    )

    def handle(self, *args, **options):
        with transaction.atomic():
            self._cleanup_employees()
            le_map = self._ensure_legal_entities()
            self._cleanup_test_legal_entities(le_map)
            results = self._create_employees(le_map)

        self.stdout.write('')
        self.stdout.write(
            self.style.SUCCESS('=== Сотрудники и юрлица загружены ===')
        )
        self.stdout.write('')
        self._print_summary(results)
        self._print_legal_entities(le_map)

    # ------------------------------------------------------------------
    # Cleanup
    # ------------------------------------------------------------------

    def _cleanup_employees(self):
        emp_count = Employee.objects.count()
        Employee.objects.all().delete()
        self.stdout.write(f'Удалено сотрудников: {emp_count}')

        # Удаляем User-аккаунты по логинам из EMPLOYEES
        logins = [row[1] for row in EMPLOYEES if row[1]]
        users_qs = User.objects.filter(username__in=logins)
        user_count = users_qs.count()
        if user_count:
            users_qs.delete()
            self.stdout.write(
                f'Удалено User-аккаунтов: {user_count}'
            )

    def _cleanup_test_legal_entities(self, le_map):
        """Удаляем тестовые юрлица (seed_qa_data и placeholder)."""
        real_ids = {le.id for le in le_map.values()}
        test_les = LegalEntity.objects.exclude(id__in=real_ids)
        for le in test_les:
            try:
                name = le.short_name
                le.delete()
                self.stdout.write(
                    f'Удалено тестовое юрлицо: {name}'
                )
            except ProtectedError:
                self.stdout.write(self.style.WARNING(
                    f'Не удалось удалить «{le.short_name}» '
                    f'(есть ссылки из других объектов)'
                ))

    # ------------------------------------------------------------------
    # Legal entities
    # ------------------------------------------------------------------

    def _ensure_legal_entities(self):
        tax_system = TaxSystem.objects.first()
        if not tax_system:
            tax_system = TaxSystem.objects.create(
                name='ОСН',
                code='osn',
                description='Основная система налогообложения',
            )

        le_map = {}
        for data in LEGAL_ENTITIES:
            le = self._upsert_legal_entity(data, tax_system)
            self._upsert_bank_account(le, data['bank'])
            le_map[data['short_name']] = le
        return le_map

    def _upsert_legal_entity(self, data, tax_system):
        """Создать или обновить юрлицо по short_name."""
        le = LegalEntity.objects.filter(
            short_name=data['short_name']
        ).first()

        fields = {
            'name': data['name'],
            'inn': data['inn'],
            'kpp': data['kpp'],
            'ogrn': data['ogrn'],
            'legal_address': data['legal_address'],
            'actual_address': data['legal_address'],
            'director_name': data['director_name'],
            'tax_system': tax_system,
            'is_active': True,
        }

        if le:
            for attr, val in fields.items():
                setattr(le, attr, val)
            le.save()
            self.stdout.write(
                f'Обновлено юрлицо: {data["short_name"]} '
                f'(ИНН {data["inn"]})'
            )
        else:
            # Удалим конфликт по ИНН, если есть placeholder
            old = LegalEntity.objects.filter(
                inn=data['inn']
            ).first()
            if old:
                old.delete()
            le = LegalEntity.objects.create(
                short_name=data['short_name'],
                **fields,
            )
            self.stdout.write(
                f'Создано юрлицо: {data["short_name"]} '
                f'(ИНН {data["inn"]})'
            )
        return le

    def _upsert_bank_account(self, le, bank_data):
        """Создать или обновить расчётный счёт юрлица."""
        account, created = Account.objects.update_or_create(
            legal_entity=le,
            number=bank_data['number'],
            defaults={
                'name': bank_data['name'],
                'account_type': Account.Type.BANK_ACCOUNT,
                'bank_name': bank_data['bank_name'],
                'bik': bank_data['bik'],
                'corr_account': bank_data['corr_account'],
                'currency': Account.Currency.RUB,
                'is_active': True,
            },
        )
        action = 'Создан' if created else 'Обновлён'
        self.stdout.write(
            f'  {action} счёт: {bank_data["number"]}'
        )

    # ------------------------------------------------------------------
    # Employees
    # ------------------------------------------------------------------

    def _create_employees(self, le_map):
        results = []
        for row in EMPLOYEES:
            (
                full_name, login, password,
                salary_full, salary_official,
                dob, hire, gender, position, companies,
            ) = row

            user = None
            if login and password:
                parts = full_name.split()
                user = User.objects.create_user(
                    username=login,
                    password=password,
                    first_name=parts[-1] if len(parts) > 1 else '',
                    last_name=parts[0],
                )

            emp = Employee.objects.create(
                full_name=full_name,
                user=user,
                date_of_birth=(
                    date.fromisoformat(dob) if dob else None
                ),
                hire_date=(
                    date.fromisoformat(hire) if hire else None
                ),
                gender=gender,
                current_position=position,
                salary_full=Decimal(str(salary_full)),
                salary_official=Decimal(str(salary_official)),
                is_active=True,
            )

            start = (
                date.fromisoformat(hire) if hire
                else date.today()
            )
            for company_name in companies:
                le = le_map.get(company_name)
                if le:
                    PositionRecord.objects.create(
                        employee=emp,
                        legal_entity=le,
                        position_title=position,
                        start_date=start,
                        is_current=True,
                    )

            SalaryHistory.objects.create(
                employee=emp,
                salary_full=Decimal(str(salary_full)),
                salary_official=Decimal(str(salary_official)),
                effective_date=start,
                reason='Данные при загрузке',
            )

            results.append((
                full_name, login, password,
                position, companies,
            ))

        self.stdout.write(f'Создано сотрудников: {len(results)}')
        return results

    # ------------------------------------------------------------------
    # Summary
    # ------------------------------------------------------------------

    def _print_summary(self, results):
        header = (
            f'{"ФИО":<30} {"Логин":<20} '
            f'{"Пароль":<20} {"Должность"}'
        )
        self.stdout.write(header)
        self.stdout.write('-' * 100)
        for name, login, pwd, pos, _ in results:
            self.stdout.write(
                f'{name:<30} {login or "—":<20} '
                f'{pwd or "—":<20} {pos}'
            )

    def _print_legal_entities(self, le_map):
        self.stdout.write('')
        self.stdout.write(
            self.style.SUCCESS('=== Юридические лица ===')
        )
        for short, le in le_map.items():
            self.stdout.write(
                f'  {short}: ИНН {le.inn}, '
                f'КПП {le.kpp}, ОГРН {le.ogrn}'
            )
            for acc in le.accounts.all():
                self.stdout.write(
                    f'    Счёт: {acc.number} '
                    f'({acc.bank_name})'
                )
