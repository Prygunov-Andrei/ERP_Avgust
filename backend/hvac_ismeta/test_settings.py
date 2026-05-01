"""Тесты hvac_ismeta: singleton, GET/PUT, права."""

from django.contrib.auth import get_user_model
from django.db.utils import IntegrityError
from django.test import TestCase
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient

from .models import HvacIsmetaSettings


class HvacIsmetaSettingsModelTests(TestCase):
    def test_get_settings_creates_singleton(self):
        obj = HvacIsmetaSettings.get_settings()
        self.assertEqual(obj.pk, 1)
        self.assertTrue(obj.enabled)
        self.assertEqual(obj.default_pipeline, "td17g")
        self.assertEqual(obj.feedback_email, "andrei@aug-clim.ru")

    def test_get_settings_idempotent(self):
        a = HvacIsmetaSettings.get_settings()
        b = HvacIsmetaSettings.get_settings()
        self.assertEqual(a.pk, b.pk)
        self.assertEqual(HvacIsmetaSettings.objects.count(), 1)

    def test_singleton_constraint_blocks_other_pks(self):
        HvacIsmetaSettings.get_settings()
        with self.assertRaises(IntegrityError):
            HvacIsmetaSettings.objects.create(pk=2)


class HvacIsmetaSettingsApiTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        User = get_user_model()
        self.admin = User.objects.create_user(
            username="admin", password="pwd", is_staff=True, is_superuser=True
        )
        self.user = User.objects.create_user(username="user", password="pwd")
        self.url = reverse("hvac-ismeta-settings")

    def test_get_requires_authentication(self):
        resp = self.client.get(self.url)
        self.assertIn(resp.status_code, (status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN))

    def test_get_returns_defaults_for_authenticated_user(self):
        self.client.force_authenticate(self.user)
        resp = self.client.get(self.url)
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(resp.data["default_pipeline"], "td17g")
        self.assertTrue(resp.data["enabled"])

    def test_put_requires_admin(self):
        self.client.force_authenticate(self.user)
        resp = self.client.patch(self.url, {"enabled": False}, format="json")
        self.assertEqual(resp.status_code, status.HTTP_403_FORBIDDEN)

    def test_admin_can_patch(self):
        self.client.force_authenticate(self.admin)
        resp = self.client.patch(
            self.url,
            {"enabled": False, "default_pipeline": "main", "max_file_size_mb": 100},
            format="json",
        )
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertFalse(resp.data["enabled"])
        self.assertEqual(resp.data["default_pipeline"], "main")
        self.assertEqual(resp.data["max_file_size_mb"], 100)

        obj = HvacIsmetaSettings.get_settings()
        self.assertFalse(obj.enabled)
        self.assertEqual(obj.default_pipeline, "main")
