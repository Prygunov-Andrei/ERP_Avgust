from django.core.management.base import BaseCommand

from kanban_core.models import Board, Column


BOARD_KEY = 'object_tasks'
BOARD_TITLE = 'Задачи по объектам'

COLUMNS = [
    {'order': 1, 'key': 'todo', 'title': 'К выполнению'},
    {'order': 2, 'key': 'in_progress', 'title': 'В работе'},
    {'order': 3, 'key': 'blocked', 'title': 'Блокировано'},
    {'order': 4, 'key': 'done', 'title': 'Выполнено'},
]


class Command(BaseCommand):
    help = 'Инициализация борда object_tasks с базовыми колонками задач'

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
