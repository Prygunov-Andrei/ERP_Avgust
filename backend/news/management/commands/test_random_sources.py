"""
Тестирование поиска новостей на случайно выбранных источниках.
"""
import logging
from datetime import date, timedelta
from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand
from django.utils import timezone
from references.models import NewsResource
from news.discovery_service import NewsDiscoveryService
from news.models import NewsDiscoveryRun
import random

logger = logging.getLogger(__name__)
User = get_user_model()


class Command(BaseCommand):
    help = 'Тестирует поиск новостей на случайно выбранных источниках'

    def add_arguments(self, parser):
        parser.add_argument(
            '--count',
            type=int,
            default=10,
            help='Количество случайных источников (по умолчанию: 10)'
        )
        parser.add_argument(
            '--days',
            type=int,
            default=14,
            help='Количество дней назад для начала поиска (по умолчанию: 14)'
        )

    def handle(self, *args, **options):
        count = options['count']
        days_back = options['days']
        
        # Вычисляем период (последние N дней)
        end_date = timezone.now().date()
        start_date = end_date - timedelta(days=days_back)
        
        self.stdout.write(self.style.SUCCESS(f'\n📅 Период поиска:'))
        self.stdout.write(f'   Начало: {start_date.strftime("%d.%m.%Y")}')
        self.stdout.write(f'   Конец: {end_date.strftime("%d.%m.%Y")}')
        self.stdout.write(f'   Длительность: {days_back} дней')
        
        # Сохраняем текущую дату последнего поиска
        original_last_search = NewsDiscoveryRun.get_last_search_date()
        
        # Временно устанавливаем дату начала поиска
        NewsDiscoveryRun.update_last_search_date(start_date)
        
        # Получаем пользователя
        user = User.objects.filter(is_staff=True).first()
        if not user:
            self.stdout.write(self.style.ERROR('Не найден ни один администратор'))
            return
        
        # Получаем все источники и выбираем случайные
        all_resources = list(NewsResource.objects.all().order_by('id'))
        
        if len(all_resources) < count:
            self.stdout.write(self.style.WARNING(f'В базе только {len(all_resources)} источников, будет использовано {len(all_resources)}'))
            count = len(all_resources)
        
        random.seed()  # Для случайности
        selected_resources = random.sample(all_resources, count)
        
        self.stdout.write(self.style.SUCCESS(f'\n🎲 Выбрано {len(selected_resources)} случайных источников:'))
        for i, resource in enumerate(selected_resources, 1):
            self.stdout.write(f'   {i}. ID {resource.id} - {resource.name}')
        
        # Создаем сервис
        service = NewsDiscoveryService(user=user)
        
        self.stdout.write(self.style.SUCCESS('\nНачинаем тестирование...'))
        self.stdout.write('=' * 80)
        
        total_created = 0
        total_errors = 0
        found_news_count = 0
        no_news_count = 0
        
        results = []
        
        for i, resource in enumerate(selected_resources, 1):
            self.stdout.write(f'\n[{i}/{len(selected_resources)}] Обработка: ID {resource.id} - {resource.name}')
            self.stdout.write(f'  URL: {resource.url}')
            
            try:
                # Формируем промпт с фиксированными датами
                prompt = service._build_search_prompt(resource, start_date, end_date)
                
                # Вызываем Grok напрямую
                try:
                    llm_response = service._query_grok(prompt)
                    provider = 'Grok'
                except Exception as e:
                    self.stdout.write(self.style.WARNING(f'  ⚠️  Grok ошибка: {str(e)[:100]}'))
                    if service.use_openai_fallback:
                        llm_response = service._query_openai(prompt)
                        provider = 'OpenAI (fallback)'
                    else:
                        raise
                
                # Обрабатываем ответ
                final_news = []
                if isinstance(llm_response, dict) and 'news' in llm_response:
                    final_news = llm_response['news']
                
                if not final_news or len(final_news) == 0:
                    service._create_no_news_news(resource, start_date, end_date)
                    total_created += 1
                    no_news_count += 1
                    self.stdout.write(self.style.WARNING(f'  ⚠️  Новостей не найдено'))
                    results.append({
                        'resource': resource.name,
                        'status': 'no_news',
                        'count': 0
                    })
                else:
                    created_for_resource = 0
                    for news_item in final_news:
                        try:
                            service._create_news_post(news_item, resource)
                            total_created += 1
                            found_news_count += 1
                            created_for_resource += 1
                        except Exception as e:
                            logger.error(f"Error creating news post: {str(e)}")
                            total_errors += 1
                    
                    self.stdout.write(self.style.SUCCESS(f'  ✅ Найдено новостей: {created_for_resource} (провайдер: {provider})'))
                    results.append({
                        'resource': resource.name,
                        'status': 'found',
                        'count': created_for_resource,
                        'provider': provider
                    })
                    
            except Exception as e:
                self.stdout.write(self.style.ERROR(f'  ✗ Критическая ошибка: {str(e)[:150]}'))
                total_errors += 1
                results.append({
                    'resource': resource.name,
                    'status': 'error',
                    'error': str(e)[:100]
                })
                logger.error(f"Error processing resource {resource.id}: {str(e)}", exc_info=True)
        
        # Восстанавливаем оригинальную дату
        NewsDiscoveryRun.update_last_search_date(original_last_search)
        
        self.stdout.write('=' * 80)
        self.stdout.write(self.style.SUCCESS('\n📊 ИТОГОВЫЕ РЕЗУЛЬТАТЫ:'))
        self.stdout.write(f'   Обработано источников: {len(selected_resources)}')
        self.stdout.write(f'   Создано записей: {total_created}')
        self.stdout.write(f'   Найдено реальных новостей: {found_news_count}')
        self.stdout.write(f'   Записей "новостей не найдено": {no_news_count}')
        self.stdout.write(f'   Ошибок: {total_errors}')
        
        self.stdout.write(self.style.SUCCESS('\n📋 ДЕТАЛЬНЫЕ РЕЗУЛЬТАТЫ:'))
        for result in results:
            if result['status'] == 'found':
                self.stdout.write(self.style.SUCCESS(f"   ✅ {result['resource']}: {result['count']} новостей ({result.get('provider', 'unknown')})"))
            elif result['status'] == 'no_news':
                self.stdout.write(self.style.WARNING(f"   ⚠️  {result['resource']}: новостей не найдено"))
            else:
                self.stdout.write(self.style.ERROR(f"   ✗ {result['resource']}: ошибка - {result.get('error', 'unknown')}"))
