from django.core.management.base import BaseCommand

from kanban_core.models import Board, Column


BOARD_KEY = 'supply'
BOARD_TITLE = 'Канбан снабжения'

COLUMNS = [
    {'order': 1, 'key': 'new', 'title': 'Новые'},
    {'order': 2, 'key': 'in_progress', 'title': 'В работе'},
    {'order': 3, 'key': 'waiting_invoice', 'title': 'Ожидаем счет'},
    {'order': 4, 'key': 'delivery', 'title': 'Поставка'},
    {'order': 5, 'key': 'done', 'title': 'Завершено'},
]


class Command(BaseCommand):
    help = 'Инициализация борда supply с базовыми колонками снабжения'

    def handle(self, *args, **options):
        board, created = Board.objects.get_or_create(
            key=BOARD_KEY,
            defaults={'title': BOARD_TITLE},
        )
        action = 'Создан' if created else 'Уже существует'
        self.stdout.write(f'{action} борд: {board.key} ({board.title})')

        for col_data in COLUMNS:
            column, column_created = Column.objects.get_or_create(
                board=board,
                key=col_data['key'],
                defaults={
                    'title': col_data['title'],
                    'order': col_data['order'],
                },
            )
            status = 'создана' if column_created else 'уже существует'
            self.stdout.write(f'  Колонка [{col_data["order"]:>2}] {col_data["key"]}: {status}')

        self.stdout.write(self.style.SUCCESS(
            f'Борд "{BOARD_TITLE}" готов — {len(COLUMNS)} колонок'
        ))
