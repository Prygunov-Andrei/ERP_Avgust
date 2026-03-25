from __future__ import annotations

from django.conf import settings
from django.contrib.auth.models import User
from django.core.management.base import BaseCommand, CommandError
from django.test import Client

from personnel.models import Employee, default_erp_permissions


class Command(BaseCommand):
    help = 'Проводит HVAC API smoke: public read, admin read и optional feedback write.'

    def add_arguments(self, parser):
        parser.add_argument(
            '--skip-feedback-write',
            action='store_true',
            help='Пропустить write-smoke для feedback endpoint.',
        )

    def _ensure_staff_user(self) -> User:
        user, _created = User.objects.get_or_create(
            username='hvac_smoke_admin',
            defaults={
                'email': 'hvac-smoke@example.com',
                'is_staff': True,
                'is_active': True,
            },
        )
        if not user.is_staff:
            user.is_staff = True
            user.save(update_fields=['is_staff'])

        employee, _created = Employee.objects.get_or_create(
            user=user,
            defaults={
                'full_name': 'HVAC Smoke Admin',
                'erp_permissions': default_erp_permissions(),
            },
        )
        perms = employee.erp_permissions or default_erp_permissions()
        perms['marketing'] = 'edit'
        employee.erp_permissions = perms
        employee.save(update_fields=['erp_permissions'])
        return user

    def _assert_ok(self, response, endpoint: str) -> None:
        if response.status_code != 200:
            raise CommandError(f'{endpoint} вернул status={response.status_code}')

    def handle(self, *args, **options):
        client = Client(HTTP_HOST='localhost')

        public_news = client.get('/api/v1/hvac/public/news/')
        self._assert_ok(public_news, '/api/v1/hvac/public/news/')

        public_manufacturers = client.get('/api/v1/hvac/public/references/manufacturers/')
        self._assert_ok(public_manufacturers, '/api/v1/hvac/public/references/manufacturers/')

        staff_user = self._ensure_staff_user()
        client.force_login(staff_user)

        admin_info = client.get('/api/v1/hvac/admin/references/newsresource/discover-news-info/')
        self._assert_ok(admin_info, '/api/v1/hvac/admin/references/newsresource/discover-news-info/')

        has_captcha_secret = bool(
            getattr(settings, 'HCAPTCHA_SECRET_KEY', '').strip()
            or getattr(settings, 'RECAPTCHA_SECRET_KEY', '').strip()
        )

        if not options['skip_feedback_write'] and has_captcha_secret:
            feedback_response = client.post(
                '/api/v1/hvac/public/feedback/',
                data={
                    'email': 'smoke@example.com',
                    'name': 'Smoke',
                    'message': 'HVAC feedback smoke test',
                    'captcha': 'smoke-test-token',
                },
            )
            if feedback_response.status_code != 201:
                raise CommandError(
                    '/api/v1/hvac/public/feedback/ write-smoke failed '
                    f'with status={feedback_response.status_code}'
                )
        elif not options['skip_feedback_write']:
            self.stdout.write(
                self.style.WARNING(
                    '[hvac_api_smoke] feedback write-smoke skipped: captcha secret is not configured.'
                )
            )

        self.stdout.write(self.style.SUCCESS('[hvac_api_smoke] OK'))
