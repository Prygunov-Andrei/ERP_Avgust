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

        # ProductKnowledge rules (E5.1)
        knowledge_rules = [
            {"pattern": "кабель+utp", "work_name": "Прокладка кабеля UTP", "unit": "м", "price": 150},
            {"pattern": "воздуховод+прямоугольный", "work_name": "Монтаж воздуховода прямоуг.", "unit": "м.п.", "price": 800},
            {"pattern": "вентилятор+крышный", "work_name": "Монтаж вентилятора крышного", "unit": "шт", "price": 12000},
            {"pattern": "кондиционер", "work_name": "Монтаж кондиционера", "unit": "шт", "price": 15000},
            {"pattern": "датчик+дым", "work_name": "Монтаж датчика дыма", "unit": "шт", "price": 350},
            {"pattern": "камера+видеонаблюдение", "work_name": "Монтаж IP-камеры", "unit": "шт", "price": 1200},
            {"pattern": "коммутатор", "work_name": "Монтаж коммутатора", "unit": "шт", "price": 2500},
            {"pattern": "клапан+огнезадерживающий", "work_name": "Монтаж огнезадерж. клапана", "unit": "шт", "price": 3500},
            {"pattern": "воздуховод+круглый", "work_name": "Монтаж воздуховода круглого", "unit": "м.п.", "price": 600},
            {"pattern": "розетка+электрическая", "work_name": "Установка розетки", "unit": "шт", "price": 250},
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
