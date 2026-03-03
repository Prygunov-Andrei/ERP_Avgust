from django.core.management.base import BaseCommand
from pricelists.models import WorkerGrade


class Command(BaseCommand):
    help = 'Создаёт базовые справочники для прайс-листов: разряды рабочих 1-5'

    def handle(self, *args, **options):
        self.stdout.write('Создание разрядов рабочих...')
        self.create_worker_grades()

        self.stdout.write(self.style.SUCCESS(
            'Базовые справочники для прайс-листов успешно созданы!'
        ))

    def create_worker_grades(self):
        grades = [
            {'grade': 1, 'name': 'Монтажник 1 разряда',
             'default_hourly_rate': 500},
            {'grade': 2, 'name': 'Монтажник 2 разряда',
             'default_hourly_rate': 650},
            {'grade': 3, 'name': 'Монтажник 3 разряда',
             'default_hourly_rate': 800},
            {'grade': 4, 'name': 'Монтажник 4 разряда',
             'default_hourly_rate': 950},
            {'grade': 5, 'name': 'Монтажник 5 разряда',
             'default_hourly_rate': 1100},
        ]

        for grade_data in grades:
            grade, created = WorkerGrade.objects.get_or_create(
                grade=grade_data['grade'],
                defaults={
                    'name': grade_data['name'],
                    'default_hourly_rate': grade_data['default_hourly_rate']
                }
            )
            status = 'создан' if created else 'уже существует'
            self.stdout.write(f'  {grade.name}: {status}')
