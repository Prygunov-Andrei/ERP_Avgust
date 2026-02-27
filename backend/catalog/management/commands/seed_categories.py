"""
Seed-данные для дерева категорий товаров (строительная тематика).

Использование:
    python manage.py seed_categories          # Создать дерево
    python manage.py seed_categories --reset   # Удалить все категории и пересоздать
"""
from django.core.management.base import BaseCommand

from catalog.models import Category


# Дерево: (code, name, parent_code | None)
CATEGORIES = [
    # ── Вентиляция ──────────────────────────────────────────────
    ('ventilation', 'Вентиляция', None),
    ('ventilation_equipment', 'Основное вентиляционное оборудование', 'ventilation'),
    ('ventilation_fans_duct', 'Вентиляторы канальные', 'ventilation_equipment'),
    ('ventilation_fans_roof', 'Вентиляторы крышные', 'ventilation_equipment'),
    ('ventilation_fans_axial', 'Вентиляторы осевые', 'ventilation_equipment'),
    ('ventilation_ahu', 'Приточные установки', 'ventilation_equipment'),
    ('ventilation_recuperators', 'Рекуператоры', 'ventilation_equipment'),
    ('ventilation_curtains', 'Тепловые завесы', 'ventilation_equipment'),
    ('ventilation_ducts', 'Воздуховоды и фасонные изделия', 'ventilation'),
    ('ventilation_ducts_round', 'Воздуховоды круглые', 'ventilation_ducts'),
    ('ventilation_ducts_rect', 'Воздуховоды прямоугольные', 'ventilation_ducts'),
    ('ventilation_fittings', 'Фасонные изделия', 'ventilation_ducts'),
    ('ventilation_flex', 'Гибкие воздуховоды', 'ventilation_ducts'),
    ('ventilation_grilles', 'Решётки и диффузоры', 'ventilation'),
    ('ventilation_dampers', 'Клапаны и заслонки', 'ventilation'),
    ('ventilation_filters', 'Фильтры', 'ventilation'),
    ('ventilation_silencers', 'Шумоглушители', 'ventilation'),
    ('ventilation_automation', 'Автоматика вентиляции', 'ventilation'),

    # ── Кондиционирование ───────────────────────────────────────
    ('conditioning', 'Кондиционирование', None),
    ('conditioning_split', 'Сплит-системы', 'conditioning'),
    ('conditioning_multi', 'Мульти-сплит системы', 'conditioning'),
    ('conditioning_vrf', 'VRF/VRV системы', 'conditioning'),
    ('conditioning_chillers', 'Чиллеры', 'conditioning'),
    ('conditioning_fancoils', 'Фанкойлы', 'conditioning'),
    ('conditioning_rooftop', 'Руфтопы', 'conditioning'),
    ('conditioning_accessories', 'Комплектующие для кондиционирования', 'conditioning'),

    # ── Отопление ───────────────────────────────────────────────
    ('heating', 'Отопление', None),
    ('heating_boilers', 'Котлы', 'heating'),
    ('heating_radiators', 'Радиаторы и конвекторы', 'heating'),
    ('heating_floor', 'Тёплые полы', 'heating'),
    ('heating_pipes', 'Трубы и фитинги отопления', 'heating'),
    ('heating_pumps', 'Насосы отопления', 'heating'),
    ('heating_expansion', 'Расширительные баки', 'heating'),
    ('heating_valves', 'Запорно-регулирующая арматура отопления', 'heating'),
    ('heating_automation', 'Автоматика отопления', 'heating'),

    # ── Водоснабжение и канализация ─────────────────────────────
    ('plumbing', 'Водоснабжение и канализация', None),
    ('plumbing_pipes', 'Трубы ВиК', 'plumbing'),
    ('plumbing_valves', 'Арматура ВиК', 'plumbing'),
    ('plumbing_sanitary', 'Санфаянс и сантехника', 'plumbing'),
    ('plumbing_pumps', 'Насосы ВиК', 'plumbing'),
    ('plumbing_heaters', 'Водонагреватели', 'plumbing'),
    ('plumbing_fittings', 'Фитинги ВиК', 'plumbing'),
    ('plumbing_sewage', 'Канализация', 'plumbing'),

    # ── Электрика ───────────────────────────────────────────────
    ('electrical', 'Электрика', None),
    ('electrical_cable', 'Кабель и провод', 'electrical'),
    ('electrical_panels', 'Щитовое оборудование', 'electrical'),
    ('electrical_lighting', 'Освещение', 'electrical'),
    ('electrical_devices', 'Электроустановочные изделия', 'electrical'),
    ('electrical_automation', 'Автоматика электрическая', 'electrical'),
    ('electrical_trays', 'Кабельные лотки и каналы', 'electrical'),
    ('electrical_grounding', 'Заземление и молниезащита', 'electrical'),

    # ── Крепёж и метизы ─────────────────────────────────────────
    ('fasteners', 'Крепёж и метизы', None),
    ('fasteners_bolts', 'Болты, гайки, шайбы', 'fasteners'),
    ('fasteners_anchors', 'Анкеры', 'fasteners'),
    ('fasteners_clamps', 'Хомуты и подвесы', 'fasteners'),
    ('fasteners_dowels', 'Дюбели', 'fasteners'),
    ('fasteners_screws', 'Саморезы и шурупы', 'fasteners'),

    # ── Изоляция ────────────────────────────────────────────────
    ('insulation', 'Изоляция', None),
    ('insulation_thermal', 'Теплоизоляция', 'insulation'),
    ('insulation_sound', 'Звукоизоляция', 'insulation'),
    ('insulation_fire', 'Огнезащита', 'insulation'),
    ('insulation_pipe', 'Изоляция трубопроводов', 'insulation'),

    # ── Строительные материалы ──────────────────────────────────
    ('construction', 'Строительные материалы', None),
    ('construction_mixes', 'Сухие смеси', 'construction'),
    ('construction_sealants', 'Герметики и клеи', 'construction'),
    ('construction_paint', 'Краски и покрытия', 'construction'),
    ('construction_general', 'Общестроительные материалы', 'construction'),

    # ── Инструмент и расходники ─────────────────────────────────
    ('tools', 'Инструмент и расходники', None),
    ('tools_power', 'Электроинструмент', 'tools'),
    ('tools_hand', 'Ручной инструмент', 'tools'),
    ('tools_consumables', 'Расходные материалы', 'tools'),

    # ── Услуги субподрядчиков ─────────────────────────────────
    ('services', 'Услуги субподрядчиков', None),
    ('services_installation', 'Монтажные работы', 'services'),
    ('services_commissioning', 'Пусконаладочные работы', 'services'),
    ('services_design', 'Проектирование', 'services'),
    ('services_delivery', 'Доставка', 'services'),
    ('services_other', 'Прочие услуги', 'services'),

    # ── Прочее ──────────────────────────────────────────────────
    ('other', 'Прочее', None),
]


class Command(BaseCommand):
    help = 'Создать начальное дерево категорий товаров'

    def add_arguments(self, parser):
        parser.add_argument(
            '--reset',
            action='store_true',
            help='Удалить все существующие категории перед созданием',
        )

    def handle(self, *args, **options):
        if options['reset']:
            count = Category.objects.count()
            Category.objects.all().delete()
            self.stdout.write(self.style.WARNING(f'Удалено {count} категорий'))

        created_count = 0
        existing_count = 0

        # Кэш для быстрого поиска parent
        cache = {}

        for code, name, parent_code in CATEGORIES:
            parent = cache.get(parent_code) if parent_code else None

            category, created = Category.objects.get_or_create(
                code=code,
                defaults={
                    'name': name,
                    'parent': parent,
                },
            )

            if not created:
                existing_count += 1
            else:
                created_count += 1

            cache[code] = category

        self.stdout.write(self.style.SUCCESS(
            f'Категории: {created_count} создано, {existing_count} уже существовало'
        ))
