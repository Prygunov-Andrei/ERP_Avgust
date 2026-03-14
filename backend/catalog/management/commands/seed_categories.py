"""
Seed-данные для дерева категорий товаров.

Иерархия заточена под профиль компании:
вентиляция, противопожарная вентиляция, кондиционирование,
слаботочные системы, сопутствующие строительные работы.

Использование:
    python manage.py seed_categories          # Создать дерево
    python manage.py seed_categories --reset   # Удалить все категории и пересоздать
"""
from django.core.management.base import BaseCommand

from catalog.models import Category


# Дерево: (code, name, parent_code | None)
CATEGORIES = [
    # ── 1. Вентиляция ─────────────────────────────────────────────
    ('ventilation', 'Вентиляция', None),

    ('ventilation_fans', 'Вентиляторы', 'ventilation'),
    ('ventilation_fans_duct', 'Вентиляторы канальные', 'ventilation_fans'),
    ('ventilation_fans_roof', 'Вентиляторы крышные', 'ventilation_fans'),
    ('ventilation_fans_axial', 'Вентиляторы осевые', 'ventilation_fans'),
    ('ventilation_fans_radial', 'Вентиляторы радиальные (центробежные)', 'ventilation_fans'),

    ('ventilation_ahu', 'Приточно-вытяжные установки', 'ventilation'),
    ('ventilation_ahu_supply', 'Приточные установки', 'ventilation_ahu'),
    ('ventilation_ahu_exhaust', 'Вытяжные установки', 'ventilation_ahu'),
    ('ventilation_ahu_recovery', 'Установки с рекуперацией', 'ventilation_ahu'),

    ('ventilation_ducts', 'Воздуховоды и фасонные изделия', 'ventilation'),
    ('ventilation_ducts_round', 'Воздуховоды круглые', 'ventilation_ducts'),
    ('ventilation_ducts_rect', 'Воздуховоды прямоугольные', 'ventilation_ducts'),
    ('ventilation_fittings', 'Фасонные изделия', 'ventilation_ducts'),
    ('ventilation_flex', 'Гибкие воздуховоды', 'ventilation_ducts'),

    ('ventilation_grilles', 'Воздухораспределители (решётки, диффузоры)', 'ventilation'),
    ('ventilation_dampers', 'Клапаны и заслонки', 'ventilation'),
    ('ventilation_filters', 'Фильтры', 'ventilation'),
    ('ventilation_silencers', 'Шумоглушители', 'ventilation'),
    ('ventilation_curtains', 'Тепловые завесы', 'ventilation'),
    ('ventilation_automation', 'Автоматика вентиляции', 'ventilation'),

    # ── 2. Противопожарная вентиляция ──────────────────────────────
    ('fire_ventilation', 'Противопожарная вентиляция', None),
    ('fire_vent_fans_smoke', 'Вентиляторы дымоудаления', 'fire_ventilation'),
    ('fire_vent_fans_pressure', 'Вентиляторы подпора воздуха', 'fire_ventilation'),

    ('fire_vent_dampers', 'Противопожарные клапаны', 'fire_ventilation'),
    ('fire_vent_dampers_fire', 'Огнезадерживающие клапаны', 'fire_vent_dampers'),
    ('fire_vent_dampers_smoke', 'Клапаны дымоудаления', 'fire_vent_dampers'),
    ('fire_vent_dampers_pressure', 'Клапаны избыточного давления', 'fire_vent_dampers'),

    ('fire_vent_ducts', 'Огнестойкие воздуховоды', 'fire_ventilation'),
    ('fire_vent_seals', 'Противопожарные муфты и манжеты', 'fire_ventilation'),
    ('fire_vent_hatches', 'Люки дымоудаления', 'fire_ventilation'),

    # ── 3. Кондиционирование ───────────────────────────────────────
    ('conditioning', 'Кондиционирование', None),
    ('conditioning_split', 'Сплит-системы', 'conditioning'),
    ('conditioning_multi', 'Мульти-сплит системы', 'conditioning'),
    ('conditioning_vrf', 'VRF/VRV системы', 'conditioning'),
    ('conditioning_chillers', 'Чиллеры', 'conditioning'),
    ('conditioning_fancoils', 'Фанкойлы', 'conditioning'),
    ('conditioning_rooftop', 'Руфтопы', 'conditioning'),
    ('conditioning_copper', 'Медные трубы и фитинги', 'conditioning'),
    ('conditioning_refrigerant', 'Хладагенты и масла', 'conditioning'),
    ('conditioning_drain', 'Дренаж кондиционеров', 'conditioning'),
    ('conditioning_automation', 'Автоматика кондиционирования', 'conditioning'),

    # ── 4. Слаботочные системы ─────────────────────────────────────
    ('low_voltage', 'Слаботочные системы', None),

    ('lv_fire_alarm', 'Пожарная сигнализация (АПС)', 'low_voltage'),
    ('lv_fire_alarm_detectors', 'Извещатели (детекторы)', 'lv_fire_alarm'),
    ('lv_fire_alarm_panels', 'Приёмно-контрольные приборы', 'lv_fire_alarm'),
    ('lv_fire_alarm_annunciators', 'Оповещатели', 'lv_fire_alarm'),
    ('lv_fire_alarm_suppression', 'Модули пожаротушения', 'lv_fire_alarm'),

    ('lv_soue', 'Система оповещения (СОУЭ)', 'low_voltage'),
    ('lv_soue_speakers', 'Речевые оповещатели', 'lv_soue'),
    ('lv_soue_signs', 'Световые табло', 'lv_soue'),
    ('lv_soue_controllers', 'Блоки управления', 'lv_soue'),

    ('lv_security', 'Охранная сигнализация', 'low_voltage'),
    ('lv_security_motion', 'Датчики движения', 'lv_security'),
    ('lv_security_magnetic', 'Магнитоконтактные извещатели', 'lv_security'),
    ('lv_security_panels', 'Приборы охранные', 'lv_security'),

    ('lv_cctv', 'Видеонаблюдение', 'low_voltage'),
    ('lv_cctv_cameras', 'IP-камеры', 'lv_cctv'),
    ('lv_cctv_nvr', 'Видеорегистраторы (NVR/DVR)', 'lv_cctv'),
    ('lv_cctv_monitors', 'Мониторы', 'lv_cctv'),
    ('lv_cctv_poe', 'Коммутаторы PoE', 'lv_cctv'),

    ('lv_access', 'СКУД', 'low_voltage'),
    ('lv_access_controllers', 'Контроллеры СКУД', 'lv_access'),
    ('lv_access_readers', 'Считыватели', 'lv_access'),
    ('lv_access_locks', 'Замки (электромагнитные, электромеханические)', 'lv_access'),
    ('lv_access_turnstiles', 'Турникеты и шлагбаумы', 'lv_access'),
    ('lv_access_cards', 'Карты и брелоки', 'lv_access'),

    ('lv_scs', 'СКС (структурированные кабельные системы)', 'low_voltage'),
    ('lv_scs_utp', 'Кабель витая пара', 'lv_scs'),
    ('lv_scs_fiber', 'Оптический кабель', 'lv_scs'),
    ('lv_scs_patch', 'Патч-панели и розетки', 'lv_scs'),
    ('lv_scs_racks', 'Шкафы и стойки', 'lv_scs'),
    ('lv_scs_switching', 'Коммутационное оборудование', 'lv_scs'),

    ('lv_dispatch', 'Диспетчеризация и автоматика', 'low_voltage'),
    ('lv_dispatch_controllers', 'Контроллеры', 'lv_dispatch'),
    ('lv_dispatch_sensors', 'Датчики', 'lv_dispatch'),
    ('lv_dispatch_cabinets', 'Шкафы автоматики', 'lv_dispatch'),

    # ── 5. Электрика ───────────────────────────────────────────────
    ('electrical', 'Электрика', None),
    ('electrical_cable', 'Кабель и провод', 'electrical'),
    ('electrical_panels', 'Щитовое оборудование', 'electrical'),
    ('electrical_trays', 'Кабельные лотки и каналы', 'electrical'),
    ('electrical_devices', 'Электроустановочные изделия', 'electrical'),
    ('electrical_breakers', 'Автоматы и УЗО', 'electrical'),
    ('electrical_grounding', 'Заземление и молниезащита', 'electrical'),

    # ── 6. Отопление (сокращённо) ──────────────────────────────────
    ('heating', 'Отопление', None),
    ('heating_radiators', 'Радиаторы и конвекторы', 'heating'),
    ('heating_pipes', 'Трубы и фитинги отопления', 'heating'),
    ('heating_valves', 'Запорно-регулирующая арматура', 'heating'),

    # ── 7. Водоснабжение и канализация (сокращённо) ────────────────
    ('plumbing', 'Водоснабжение и канализация', None),
    ('plumbing_pipes', 'Трубы ВиК', 'plumbing'),
    ('plumbing_valves', 'Арматура ВиК', 'plumbing'),
    ('plumbing_sanitary', 'Санфаянс и сантехника', 'plumbing'),

    # ── 8. Крепёж и метизы ─────────────────────────────────────────
    ('fasteners', 'Крепёж и метизы', None),
    ('fasteners_hangers', 'Подвесы и кронштейны', 'fasteners'),
    ('fasteners_clamps', 'Хомуты', 'fasteners'),
    ('fasteners_studs', 'Шпильки и траверсы', 'fasteners'),
    ('fasteners_anchors', 'Анкеры', 'fasteners'),
    ('fasteners_dowels', 'Дюбели', 'fasteners'),
    ('fasteners_screws', 'Саморезы и шурупы', 'fasteners'),
    ('fasteners_bolts', 'Болты, гайки, шайбы', 'fasteners'),

    # ── 9. Изоляция ────────────────────────────────────────────────
    ('insulation', 'Изоляция', None),
    ('insulation_thermal', 'Теплоизоляция', 'insulation'),
    ('insulation_sound', 'Звукоизоляция', 'insulation'),
    ('insulation_fire', 'Огнезащита', 'insulation'),
    ('insulation_pipe', 'Изоляция трубопроводов', 'insulation'),
    ('insulation_seals', 'Уплотнители и ленты', 'insulation'),

    # ── 10. Строительные материалы ─────────────────────────────────
    ('construction', 'Строительные материалы', None),
    ('construction_mixes', 'Сухие смеси', 'construction'),
    ('construction_sealants', 'Герметики и клеи', 'construction'),
    ('construction_paint', 'Краски и покрытия', 'construction'),
    ('construction_foam', 'Монтажная пена', 'construction'),
    ('construction_general', 'Общестроительные материалы', 'construction'),

    # ── 11. Инструмент и расходники ────────────────────────────────
    ('tools', 'Инструмент и расходники', None),
    ('tools_power', 'Электроинструмент', 'tools'),
    ('tools_hand', 'Ручной инструмент', 'tools'),
    ('tools_consumables', 'Расходные материалы (диски, свёрла, коронки)', 'tools'),
    ('tools_ppe', 'СИЗ (средства индивидуальной защиты)', 'tools'),

    # ── 12. Услуги субподрядчиков ──────────────────────────────────
    ('services', 'Услуги субподрядчиков', None),
    ('services_installation', 'Монтажные работы', 'services'),
    ('services_commissioning', 'Пусконаладочные работы', 'services'),
    ('services_design', 'Проектирование', 'services'),
    ('services_delivery', 'Доставка и логистика', 'services'),
    ('services_other', 'Прочие услуги', 'services'),

    # ── 13. Прочее ─────────────────────────────────────────────────
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
