"""
kanban_files/tests.py — тесты бизнес-логики файлового сервиса.
"""
import uuid
from decimal import Decimal
from unittest.mock import Mock, patch, MagicMock

import pytest
from django.test import SimpleTestCase


class TestObjectKeyForSha256(SimpleTestCase):
    """Тестируем утилиту генерации object_key."""

    def test_prefix_is_first_two_chars(self):
        from kanban_files.views import _object_key_for_sha256
        sha = 'ab' + 'c' * 62
        result = _object_key_for_sha256(sha)
        assert result == f'sha256/ab/{sha}'

    def test_different_hashes_different_prefixes(self):
        from kanban_files.views import _object_key_for_sha256
        sha1 = 'aa' + '0' * 62
        sha2 = 'ff' + '0' * 62
        assert _object_key_for_sha256(sha1) != _object_key_for_sha256(sha2)
        assert _object_key_for_sha256(sha1).startswith('sha256/aa/')
        assert _object_key_for_sha256(sha2).startswith('sha256/ff/')


class TestFileInitSerializerValidation(SimpleTestCase):
    """Тестируем валидацию FileInitSerializer."""

    def test_valid_data_passes(self):
        from kanban_files.serializers import FileInitSerializer
        data = {
            'sha256': 'a' * 64,
            'size_bytes': 1024,
            'mime_type': 'application/pdf',
            'original_filename': 'doc.pdf',
        }
        s = FileInitSerializer(data=data)
        assert s.is_valid(), s.errors

    def test_short_sha256_rejected(self):
        from kanban_files.serializers import FileInitSerializer
        data = {'sha256': 'abc', 'size_bytes': 100}
        s = FileInitSerializer(data=data)
        assert not s.is_valid()
        assert 'sha256' in s.errors

    def test_zero_size_rejected(self):
        from kanban_files.serializers import FileInitSerializer
        data = {'sha256': 'a' * 64, 'size_bytes': 0}
        s = FileInitSerializer(data=data)
        assert not s.is_valid()
        assert 'size_bytes' in s.errors

    @patch('kanban_files.serializers.settings')
    def test_too_large_file_rejected(self, mock_settings):
        from kanban_files.serializers import FileInitSerializer
        mock_settings.KANBAN_FILE_MAX_SIZE_BYTES = 100
        data = {'sha256': 'a' * 64, 'size_bytes': 200}
        s = FileInitSerializer(data=data)
        assert not s.is_valid()
        assert 'size_bytes' in s.errors


class TestFileFinalizeSerializerValidation(SimpleTestCase):
    """Тестируем валидацию FileFinalizeSerializer."""

    def test_valid_uuid(self):
        from kanban_files.serializers import FileFinalizeSerializer
        data = {'file_id': str(uuid.uuid4())}
        s = FileFinalizeSerializer(data=data)
        assert s.is_valid(), s.errors

    def test_invalid_uuid_rejected(self):
        from kanban_files.serializers import FileFinalizeSerializer
        data = {'file_id': 'not-a-uuid'}
        s = FileFinalizeSerializer(data=data)
        assert not s.is_valid()
        assert 'file_id' in s.errors


class TestFileModelStr(SimpleTestCase):
    """Тестируем __str__ модели FileObject."""

    def test_str_contains_sha_prefix_and_status(self):
        from kanban_files.models import FileObject
        obj = FileObject(
            sha256='abcdef1234567890' + '0' * 48,
            status=FileObject.Status.READY,
        )
        result = str(obj)
        assert 'abcdef123456' in result
        assert 'ready' in result
