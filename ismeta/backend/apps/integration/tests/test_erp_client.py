"""Тесты ERP catalog client (E13)."""

from decimal import Decimal
from unittest.mock import MagicMock, patch

import httpx
import pytest

from apps.integration.erp_client import ERPCatalogClient, MockERPCatalogClient
from apps.integration.types import PriceItem, WorkItem


class TestMockClient:
    def test_search_works(self):
        works = [
            WorkItem(id="w1", name="Монтаж вентилятора", unit="шт", price=Decimal("12000")),
            WorkItem(id="w2", name="Прокладка кабеля", unit="м", price=Decimal("150")),
        ]
        client = MockERPCatalogClient(works=works)
        result = client.search_works("вентилятор", "ws-1")
        assert len(result) == 1
        assert result[0].name == "Монтаж вентилятора"

    def test_search_works_empty(self):
        client = MockERPCatalogClient(works=[])
        result = client.search_works("что-то", "ws-1")
        assert result == []

    def test_get_work(self):
        works = [WorkItem(id="w1", name="Монтаж", unit="шт", price=Decimal("5000"))]
        client = MockERPCatalogClient(works=works)
        assert client.get_work("w1").name == "Монтаж"
        assert client.get_work("w99") is None

    def test_get_pricelist(self):
        items = [PriceItem(work_id="w1", work_name="Работа", unit="шт", price=Decimal("1000"))]
        client = MockERPCatalogClient(pricelist=items)
        result = client.get_pricelist("ws-1")
        assert len(result) == 1


class TestRealClientErrors:
    @patch("apps.integration.erp_client.httpx.Client")
    def test_search_works_connect_error(self, mock_cls):
        mock_client = MagicMock()
        mock_client.__enter__ = MagicMock(return_value=mock_client)
        mock_client.__exit__ = MagicMock(return_value=False)
        mock_client.get.side_effect = httpx.ConnectError("Connection refused")
        mock_cls.return_value = mock_client

        client = ERPCatalogClient()
        result = client.search_works("test", "ws-1")
        assert result == []

    @patch("apps.integration.erp_client.httpx.Client")
    def test_get_work_http_error(self, mock_cls):
        mock_resp = MagicMock(spec=httpx.Response)
        mock_resp.status_code = 404
        mock_resp.raise_for_status.side_effect = httpx.HTTPStatusError("404", request=MagicMock(), response=mock_resp)
        mock_client = MagicMock()
        mock_client.__enter__ = MagicMock(return_value=mock_client)
        mock_client.__exit__ = MagicMock(return_value=False)
        mock_client.get.return_value = mock_resp
        mock_cls.return_value = mock_client

        client = ERPCatalogClient()
        assert client.get_work("w1") is None
