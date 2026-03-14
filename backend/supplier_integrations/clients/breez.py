import logging
import time

import httpx

logger = logging.getLogger(__name__)


class BreezAPIError(Exception):
    def __init__(self, message, status_code=None, response_data=None):
        self.message = message
        self.status_code = status_code
        self.response_data = response_data
        super().__init__(message)


class BreezAPIClient:
    """Клиент для REST API поставщика Breez (https://api.breez.ru/)"""

    TIMEOUT = 120
    MAX_RETRIES = 3
    RETRY_DELAY = 2  # секунды между ретраями

    def __init__(self, integration):
        self.integration = integration
        self.base_url = integration.base_url.rstrip('/')
        self.auth_header = integration.auth_header
        self._client = None

    def __enter__(self):
        self._client = httpx.Client(
            timeout=self.TIMEOUT,
            headers={
                'Authorization': self.auth_header,
                'Accept': 'application/json',
            },
        )
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        if self._client:
            self._client.close()
            self._client = None
        return False

    def _request(self, path, params=None):
        """GET-запрос с ретраями"""
        url = f'{self.base_url}/{path.lstrip("/")}'
        last_error = None

        for attempt in range(1, self.MAX_RETRIES + 1):
            try:
                response = self._client.get(url, params=params)
                if response.status_code >= 500:
                    raise BreezAPIError(
                        f'Server error {response.status_code}',
                        status_code=response.status_code,
                    )
                if response.status_code == 401:
                    raise BreezAPIError(
                        'Ошибка авторизации (401). Проверьте ключ API.',
                        status_code=401,
                    )
                if response.status_code >= 400:
                    raise BreezAPIError(
                        f'Client error {response.status_code}: {response.text[:200]}',
                        status_code=response.status_code,
                    )
                return response.json()
            except httpx.TimeoutException as e:
                last_error = BreezAPIError(f'Timeout on attempt {attempt}: {e}')
                logger.warning('Breez API timeout (attempt %d/%d): %s', attempt, self.MAX_RETRIES, url)
            except httpx.RequestError as e:
                last_error = BreezAPIError(f'Request error on attempt {attempt}: {e}')
                logger.warning('Breez API request error (attempt %d/%d): %s', attempt, self.MAX_RETRIES, e)
            except BreezAPIError as e:
                if e.status_code and e.status_code >= 500:
                    last_error = e
                    logger.warning('Breez API 5xx (attempt %d/%d): %s', attempt, self.MAX_RETRIES, e.message)
                else:
                    raise

            if attempt < self.MAX_RETRIES:
                time.sleep(self.RETRY_DELAY * attempt)

        raise last_error

    # --- Content API ---

    def get_categories(self):
        """GET /categories/ — все категории"""
        return self._request('/categories/')

    def get_brands(self):
        """GET /brands/ — все бренды"""
        return self._request('/brands/')

    def get_products(self):
        """GET /products/ — все товары"""
        return self._request('/products/')

    def get_product(self, product_id):
        """GET /products/?id=N — один товар"""
        return self._request('/products/', params={'id': product_id})

    def get_tech_specs(self, product_id):
        """GET /tech/?id=N — технические характеристики"""
        return self._request('/tech/', params={'id': product_id})

    # --- Leftovers API ---

    def get_leftovers(self):
        """GET /leftoversnew/ — остатки + цены по всем товарам"""
        return self._request('/leftoversnew/')

    def get_leftover(self, nc_code):
        """GET /leftoversnew/?nc=НС-XXX — остатки одного товара"""
        return self._request('/leftoversnew/', params={'nc': nc_code})
