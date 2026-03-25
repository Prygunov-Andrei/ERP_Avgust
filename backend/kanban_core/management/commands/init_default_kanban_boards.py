from django.core.management import call_command
from django.core.management.base import BaseCommand


class Command(BaseCommand):
    help = 'Инициализирует все штатные kanban-доски проекта'

    def handle(self, *args, **options):
        commands = [
            'init_commercial_board',
            'init_supply_board',
            'init_object_tasks_board',
        ]

        for command_name in commands:
            self.stdout.write(f'Запуск {command_name}...')
            call_command(command_name)

        self.stdout.write(self.style.SUCCESS('Все штатные kanban-доски инициализированы.'))
