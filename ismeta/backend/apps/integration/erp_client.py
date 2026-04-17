"""ERP Catalog API client — httpx клиент к ERP backend."""

import logging
from decimal import Decimal

import httpx
from django.conf import settings

from .types import PriceItem, WorkItem

logger = logging.getLogger(__name__)


class ERPCatalogClient:
    """HTTP клиент к ERP catalog/pricelist API."""

    def __init__(self):
        self.base_url = getattr(settings, "ISMETA_ERP_BASE_URL", "http://localhost:8000")
        self.token = getattr(settings, "ISMETA_ERP_MASTER_TOKEN", "")
        self.timeout = 10.0

    def _headers(self) -> dict:
        return {
            "Authorization": f"Bearer {self.token}",
            "Content-Type": "application/json",
        }

    def search_works(self, query: str, workspace_id: str) -> list[WorkItem]:
        """GET /api/v1/catalog/works/?q={query}"""
        try:
            with httpx.Client(timeout=self.timeout) as client:
                resp = client.get(
                    f"{self.base_url}/api/v1/catalog/works/",
                    params={"q": query, "workspace_id": workspace_id},
                    headers=self._headers(),
                )
                resp.raise_for_status()
            return [
                WorkItem(
                    id=item["id"],
                    name=item["name"],
                    unit=item.get("unit", "шт"),
                    price=Decimal(str(item.get("price", 0))),
                    section_code=item.get("section_code", ""),
                    grade=item.get("grade", 0),
                    hours=Decimal(str(item.get("hours", 0))),
                )
                for item in resp.json().get("results", [])
            ]
        except httpx.HTTPStatusError as e:
            logger.warning("ERP catalog search_works failed: HTTP %s", e.response.status_code)
            return []
        except httpx.ConnectError as e:
            logger.warning("ERP catalog unreachable: %s", e)
            return []

    def get_work(self, work_id: str) -> WorkItem | None:
        """GET /api/v1/catalog/works/{id}/"""
        try:
            with httpx.Client(timeout=self.timeout) as client:
                resp = client.get(
                    f"{self.base_url}/api/v1/catalog/works/{work_id}/",
                    headers=self._headers(),
                )
                resp.raise_for_status()
            item = resp.json()
            return WorkItem(
                id=item["id"],
                name=item["name"],
                unit=item.get("unit", "шт"),
                price=Decimal(str(item.get("price", 0))),
            )
        except (httpx.HTTPStatusError, httpx.ConnectError) as e:
            logger.warning("ERP catalog get_work(%s) failed: %s", work_id, e)
            return None

    def get_pricelist(self, workspace_id: str) -> list[PriceItem]:
        """GET /api/v1/catalog/pricelist/?workspace_id={ws}"""
        try:
            with httpx.Client(timeout=self.timeout) as client:
                resp = client.get(
                    f"{self.base_url}/api/v1/catalog/pricelist/",
                    params={"workspace_id": workspace_id},
                    headers=self._headers(),
                )
                resp.raise_for_status()
            return [
                PriceItem(
                    work_id=item["work_id"],
                    work_name=item["work_name"],
                    unit=item.get("unit", "шт"),
                    price=Decimal(str(item.get("price", 0))),
                    grade=item.get("grade", 0),
                    hours=Decimal(str(item.get("hours", 0))),
                )
                for item in resp.json().get("results", [])
            ]
        except (httpx.HTTPStatusError, httpx.ConnectError) as e:
            logger.warning("ERP catalog get_pricelist failed: %s", e)
            return []


class MockERPCatalogClient(ERPCatalogClient):
    """Mock для тестов — не делает HTTP, возвращает фикстуры."""

    def __init__(self, works=None, pricelist=None):
        self._works = works or []
        self._pricelist = pricelist or []

    def search_works(self, query, workspace_id):
        return [w for w in self._works if query.lower() in w.name.lower()]

    def get_work(self, work_id):
        for w in self._works:
            if w.id == work_id:
                return w
        return None

    def get_pricelist(self, workspace_id):
        return self._pricelist
