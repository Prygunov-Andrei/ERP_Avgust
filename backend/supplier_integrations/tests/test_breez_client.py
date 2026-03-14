from unittest.mock import patch, MagicMock

import httpx
import pytest

from supplier_integrations.clients.breez import BreezAPIClient, BreezAPIError


@pytest.fixture
def integration():
    """Мок-интеграция для клиента"""
    mock = MagicMock()
    mock.base_url = 'https://api.breez.ru/v1'
    mock.auth_header = 'Basic dGVzdDp0ZXN0'
    return mock


class TestBreezAPIClient:
    def test_context_manager(self, integration):
        with BreezAPIClient(integration) as client:
            assert client._client is not None
        assert client._client is None

    @patch('supplier_integrations.clients.breez.httpx.Client')
    def test_auth_header_sent(self, mock_httpx_cls, integration):
        mock_httpx_cls.return_value = MagicMock()
        with BreezAPIClient(integration) as client:
            pass
        mock_httpx_cls.assert_called_once()
        call_kwargs = mock_httpx_cls.call_args[1]
        assert call_kwargs['headers']['Authorization'] == 'Basic dGVzdDp0ZXN0'

    @patch('supplier_integrations.clients.breez.httpx.Client')
    def test_get_categories_success(self, mock_httpx_cls, integration):
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {'categories': [{'id': 1, 'title': 'Вентиляция'}]}
        mock_client = MagicMock()
        mock_client.get.return_value = mock_response
        mock_httpx_cls.return_value = mock_client

        with BreezAPIClient(integration) as client:
            result = client.get_categories()
        assert result == {'categories': [{'id': 1, 'title': 'Вентиляция'}]}

    @patch('supplier_integrations.clients.breez.httpx.Client')
    def test_retry_on_timeout(self, mock_httpx_cls, integration):
        mock_client = MagicMock()
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {'data': []}
        mock_client.get.side_effect = [
            httpx.TimeoutException('timeout'),
            mock_response,
        ]
        mock_httpx_cls.return_value = mock_client

        with BreezAPIClient(integration) as client:
            client.RETRY_DELAY = 0
            result = client.get_categories()
        assert result == {'data': []}
        assert mock_client.get.call_count == 2

    @patch('supplier_integrations.clients.breez.httpx.Client')
    def test_retry_on_500(self, mock_httpx_cls, integration):
        mock_client = MagicMock()
        error_response = MagicMock()
        error_response.status_code = 500
        ok_response = MagicMock()
        ok_response.status_code = 200
        ok_response.json.return_value = []
        mock_client.get.side_effect = [error_response, ok_response]
        mock_httpx_cls.return_value = mock_client

        with BreezAPIClient(integration) as client:
            client.RETRY_DELAY = 0
            result = client.get_categories()
        assert result == []

    @patch('supplier_integrations.clients.breez.httpx.Client')
    def test_error_on_401(self, mock_httpx_cls, integration):
        mock_client = MagicMock()
        mock_response = MagicMock()
        mock_response.status_code = 401
        mock_client.get.return_value = mock_response
        mock_httpx_cls.return_value = mock_client

        with BreezAPIClient(integration) as client:
            with pytest.raises(BreezAPIError, match='401'):
                client.get_categories()

    @patch('supplier_integrations.clients.breez.httpx.Client')
    def test_all_retries_exhausted(self, mock_httpx_cls, integration):
        mock_client = MagicMock()
        mock_client.get.side_effect = httpx.TimeoutException('timeout')
        mock_httpx_cls.return_value = mock_client

        with BreezAPIClient(integration) as client:
            client.RETRY_DELAY = 0
            with pytest.raises(BreezAPIError, match='Timeout'):
                client.get_categories()
        assert mock_client.get.call_count == 3
