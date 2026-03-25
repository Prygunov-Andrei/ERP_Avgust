from __future__ import annotations

import json
from pathlib import Path

from django.conf import settings
from django.core.management.base import BaseCommand

from news.models import MediaUpload, NewsMedia, NewsPost
from references.models import Brand, NewsResource


TRACKED_MODELS = (Brand, NewsResource, NewsPost, NewsMedia, MediaUpload)


class Command(BaseCommand):
    help = 'Экспортирует manifest HVAC media/image файлов с признаком present/missing.'

    def add_arguments(self, parser):
        parser.add_argument(
            '--output',
            required=True,
            help='Абсолютный или относительный путь к JSON manifest-файлу.',
        )
        parser.add_argument(
            '--base-root',
            default='',
            help='Корень, относительно которого проверяется наличие файлов. По умолчанию MEDIA_ROOT.',
        )

    def handle(self, *args, **options):
        base_root = Path(options['base_root']).expanduser() if options['base_root'] else Path(settings.MEDIA_ROOT)
        output_path = Path(options['output']).expanduser()
        if not output_path.is_absolute():
            output_path = Path.cwd() / output_path

        entries: list[dict[str, object]] = []

        for model in TRACKED_MODELS:
            for field in model._meta.concrete_fields:
                if field.get_internal_type() not in ('FileField', 'ImageField'):
                    continue

                for instance in model.objects.exclude(**{field.attname: ''}).iterator():
                    file_name = getattr(instance, field.attname)
                    if not file_name:
                        continue

                    relative_path = str(file_name)
                    full_path = base_root / relative_path
                    entries.append(
                        {
                            'model': model._meta.label,
                            'field': field.attname,
                            'pk': instance.pk,
                            'relative_path': relative_path,
                            'absolute_path': str(full_path),
                            'exists': full_path.exists(),
                        }
                    )

        output_path.parent.mkdir(parents=True, exist_ok=True)
        payload = {
            'base_root': str(base_root),
            'total_entries': len(entries),
            'present_entries': sum(1 for entry in entries if entry['exists']),
            'missing_entries': sum(1 for entry in entries if not entry['exists']),
            'entries': entries,
        }
        output_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding='utf-8')
        self.stdout.write(self.style.SUCCESS(f'Manifest written to {output_path}'))
