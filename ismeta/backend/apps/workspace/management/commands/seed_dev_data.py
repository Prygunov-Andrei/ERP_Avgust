"""Management command: seed_dev_data — создаёт dev workspace + смету.

UUIDs зафиксированы в .env.example (WORKSPACE_DEV_SEED_UUIDS).
Идемпотентна: при повторном запуске — обновляет, не дублирует.
"""

import uuid

from django.contrib.auth import get_user_model
from django.db import connection
from django.core.management.base import BaseCommand

from apps.workspace.models import MemberRole, Workspace, WorkspaceMember
from apps.estimate.models import Estimate, EstimateSection
from apps.estimate.matching.knowledge import ProductKnowledge

User = get_user_model()

WS_AVGUST_ID = uuid.UUID("11111111-1111-1111-1111-111111111111")

SEED_WORKSPACES = [
    {"id": WS_AVGUST_ID, "name": "Август Климат", "slug": "avgust-klimat"},
    {
        "id": uuid.UUID("22222222-2222-2222-2222-222222222222"),
        "name": "Тестовая Компания",
        "slug": "test-company",
    },
]

SEED_ITEMS = [
    {"name": "Вентилятор крышный MOB2600/45-3a", "unit": "шт", "qty": 4, "key": True},
    {"name": "Воздуховод прямоугольный 500x400", "unit": "м.п.", "qty": 42.5, "key": False},
    {"name": "Кабель UTP Cat.6", "unit": "м", "qty": 350, "key": False},
    {"name": "Кондиционер Daikin RQ-71", "unit": "шт", "qty": 2, "key": True},
    {"name": "Датчик дыма Системсенсор 2151", "unit": "шт", "qty": 18, "key": False},
]


class Command(BaseCommand):
    help = "Создаёт dev workspace + тестовую смету (идемпотентно)."

    def handle(self, *args, **options):
        admin_user, created = User.objects.get_or_create(
            username="admin",
            defaults={"is_staff": True, "is_superuser": True},
        )
        if created:
            admin_user.set_password("admin")
            admin_user.save()
            self.stdout.write(self.style.SUCCESS("  Создан суперпользователь admin/admin"))

        for ws_data in SEED_WORKSPACES:
            ws, created = Workspace.objects.update_or_create(
                id=ws_data["id"],
                defaults={"name": ws_data["name"], "slug": ws_data["slug"]},
            )
            verb = "Создан" if created else "Обновлён"
            self.stdout.write(self.style.SUCCESS(f"  {verb} workspace: {ws.name} ({ws.id})"))
            WorkspaceMember.objects.get_or_create(
                workspace=ws, user=admin_user, defaults={"role": MemberRole.OWNER}
            )

        # Тестовая смета в Август Климат
        ws_avg = Workspace.objects.get(id=WS_AVGUST_ID)
        est, est_created = Estimate.objects.get_or_create(
            workspace=ws_avg,
            name="Тестовая смета — Вентиляция офиса",
            defaults={
                "folder_name": "Офис на Мясницкой",
                "default_material_markup": {"type": "percent", "value": 30},
                "default_work_markup": {"type": "percent", "value": 300},
                "created_by": admin_user,
            },
        )
        if est_created:
            self.stdout.write(self.style.SUCCESS(f"  Создана смета: {est.name}"))

            sec_vent, _ = EstimateSection.objects.get_or_create(
                estimate=est, workspace=ws_avg, name="Вентиляция", defaults={"sort_order": 1}
            )
            sec_ss, _ = EstimateSection.objects.get_or_create(
                estimate=est, workspace=ws_avg, name="Слаботочка", defaults={"sort_order": 2}
            )
            self.stdout.write(self.style.SUCCESS("  Созданы разделы: Вентиляция, Слаботочка"))

            for i, item_data in enumerate(SEED_ITEMS):
                sec = sec_vent if i < 2 else sec_ss
                with connection.cursor() as cur:
                    cur.execute(
                        """
                        INSERT INTO estimate_item (
                            id, section_id, estimate_id, workspace_id, row_id,
                            sort_order, name, unit, quantity,
                            is_key_equipment, procurement_status
                        ) VALUES (
                            gen_random_uuid(), %s, %s, %s, gen_random_uuid(),
                            %s, %s, %s, %s,
                            %s, %s
                        ) ON CONFLICT DO NOTHING
                        """,
                        [
                            sec.id,
                            est.id,
                            ws_avg.id,
                            i + 1,
                            item_data["name"],
                            item_data["unit"],
                            item_data["qty"],
                            item_data["key"],
                            "requested" if item_data["key"] else "none",
                        ],
                    )
            self.stdout.write(self.style.SUCCESS(f"  Создано {len(SEED_ITEMS)} позиций"))
        else:
            self.stdout.write("  Смета уже существует, пропуск.")

        # ProductKnowledge rules (E5.1) — 50 правил по 4 категориям.
        # Цены — монтаж (work_price) на ОВиК/СС рынке РФ, март 2026.
        knowledge_rules = [
            # --- Вентиляция (15) ---
            {"pattern": "воздуховод+прямоугольный", "work_name": "Монтаж воздуховода прямоуг.", "unit": "м.п.", "price": 800},
            {"pattern": "воздуховод+круглый", "work_name": "Монтаж воздуховода круглого", "unit": "м.п.", "price": 600},
            {"pattern": "вентилятор+крышный", "work_name": "Монтаж вентилятора крышного", "unit": "шт", "price": 12000},
            {"pattern": "вентилятор+канальный", "work_name": "Монтаж вентилятора канального", "unit": "шт", "price": 8500},
            {"pattern": "вентилятор+осевой", "work_name": "Монтаж вентилятора осевого", "unit": "шт", "price": 6000},
            {"pattern": "клапан+огнезадерживающий", "work_name": "Монтаж огнезадерж. клапана", "unit": "шт", "price": 3500},
            {"pattern": "клапан+обратный", "work_name": "Монтаж клапана обратного", "unit": "шт", "price": 1800},
            {"pattern": "решётка+вентиляционная", "work_name": "Установка решётки вент.", "unit": "шт", "price": 500},
            {"pattern": "диффузор", "work_name": "Установка диффузора", "unit": "шт", "price": 600},
            {"pattern": "шумоглушитель", "work_name": "Монтаж шумоглушителя", "unit": "шт", "price": 2200},
            {"pattern": "фильтр+воздушный", "work_name": "Установка воздушного фильтра", "unit": "шт", "price": 900},
            {"pattern": "калорифер", "work_name": "Монтаж калорифера", "unit": "шт", "price": 5500},
            {"pattern": "рекуператор", "work_name": "Монтаж рекуператора", "unit": "шт", "price": 18000},
            {"pattern": "гибкая+вставка", "work_name": "Монтаж гибкой вставки", "unit": "шт", "price": 700},
            {"pattern": "заслонка+регулирующая", "work_name": "Монтаж регулирующей заслонки", "unit": "шт", "price": 2500},

            # --- Кондиционирование (10) ---
            {"pattern": "сплит+система", "work_name": "Монтаж сплит-системы", "unit": "шт", "price": 12000},
            {"pattern": "мульти+сплит", "work_name": "Монтаж мульти-сплит системы", "unit": "шт", "price": 25000},
            {"pattern": "кондиционер+кассетный", "work_name": "Монтаж кассетного кондиционера", "unit": "шт", "price": 18000},
            {"pattern": "кондиционер+канальный", "work_name": "Монтаж канального кондиционера", "unit": "шт", "price": 22000},
            {"pattern": "кондиционер+колонный", "work_name": "Монтаж колонного кондиционера", "unit": "шт", "price": 16000},
            {"pattern": "чиллер", "work_name": "Монтаж чиллера", "unit": "шт", "price": 80000},
            {"pattern": "фанкойл", "work_name": "Монтаж фанкойла", "unit": "шт", "price": 9500},
            {"pattern": "vrf", "work_name": "Монтаж внутреннего блока VRF", "unit": "шт", "price": 22000},
            {"pattern": "дренажная+помпа", "work_name": "Установка дренажной помпы", "unit": "шт", "price": 3500},
            {"pattern": "фреонопровод", "work_name": "Прокладка фреонопровода", "unit": "м.п.", "price": 1200},

            # --- Слаботочные системы (15) ---
            {"pattern": "кабель+utp", "work_name": "Прокладка кабеля UTP", "unit": "м", "price": 150},
            {"pattern": "кабель+ftp", "work_name": "Прокладка кабеля FTP", "unit": "м", "price": 180},
            {"pattern": "кабель+оптический", "work_name": "Прокладка оптического кабеля", "unit": "м", "price": 250},
            {"pattern": "кабель+коаксиальный", "work_name": "Прокладка коаксиального кабеля", "unit": "м", "price": 130},
            {"pattern": "камера+видеонаблюдение", "work_name": "Монтаж IP-камеры", "unit": "шт", "price": 1200},
            {"pattern": "видеорегистратор", "work_name": "Установка видеорегистратора", "unit": "шт", "price": 3000},
            {"pattern": "коммутатор", "work_name": "Монтаж коммутатора", "unit": "шт", "price": 2500},
            {"pattern": "ибп", "work_name": "Установка ИБП", "unit": "шт", "price": 2000},
            {"pattern": "датчик+дым", "work_name": "Монтаж датчика дыма", "unit": "шт", "price": 350},
            {"pattern": "датчик+движения", "work_name": "Монтаж датчика движения", "unit": "шт", "price": 400},
            {"pattern": "датчик+протечки", "work_name": "Монтаж датчика протечки", "unit": "шт", "price": 450},
            {"pattern": "считыватель+скуд", "work_name": "Монтаж считывателя СКУД", "unit": "шт", "price": 1500},
            {"pattern": "контроллер+скуд", "work_name": "Монтаж контроллера СКУД", "unit": "шт", "price": 3500},
            {"pattern": "извещатель+пожарный", "work_name": "Монтаж пожарного извещателя", "unit": "шт", "price": 450},
            {"pattern": "оповещатель+пожарный", "work_name": "Монтаж пожарного оповещателя", "unit": "шт", "price": 800},

            # --- Автоматика (10) ---
            {"pattern": "контроллер+ddc", "work_name": "Монтаж контроллера DDC", "unit": "шт", "price": 8500},
            {"pattern": "привод+клапана", "work_name": "Монтаж привода клапана", "unit": "шт", "price": 3200},
            {"pattern": "датчик+температуры", "work_name": "Монтаж датчика температуры", "unit": "шт", "price": 900},
            {"pattern": "датчик+давления", "work_name": "Монтаж датчика давления", "unit": "шт", "price": 1100},
            {"pattern": "датчик+co2", "work_name": "Монтаж датчика CO2", "unit": "шт", "price": 1600},
            {"pattern": "термостат", "work_name": "Установка термостата", "unit": "шт", "price": 1400},
            {"pattern": "частотный+преобразователь", "work_name": "Монтаж частотного преобразователя", "unit": "шт", "price": 6500},
            {"pattern": "щит+автоматики", "work_name": "Монтаж щита автоматики", "unit": "шт", "price": 28000},
            {"pattern": "панель+оператора", "work_name": "Монтаж панели оператора", "unit": "шт", "price": 4500},
            {"pattern": "модуль+ввода-вывода", "work_name": "Монтаж модуля I/O", "unit": "шт", "price": 2800},
        ]
        pk_created = 0
        for rule in knowledge_rules:
            _, created = ProductKnowledge.objects.get_or_create(
                workspace_id=ws_avg.id,
                pattern=rule["pattern"],
                defaults={"work_name": rule["work_name"], "work_unit": rule["unit"], "work_price": rule["price"]},
            )
            if created:
                pk_created += 1
        if pk_created:
            self.stdout.write(self.style.SUCCESS(f"  Создано {pk_created} правил ProductKnowledge"))

        self.stdout.write(self.style.SUCCESS(f"\nSeed завершён: {len(SEED_WORKSPACES)} workspace."))
