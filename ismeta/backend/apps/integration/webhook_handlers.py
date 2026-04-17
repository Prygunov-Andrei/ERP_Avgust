"""Обработчики webhook-событий от ERP."""

import logging

from apps.estimate.matching.knowledge import ProductKnowledge
from apps.estimate.models import Estimate, SnapshotTransmission, TransmissionStatus

logger = logging.getLogger(__name__)


def handle_product_updated(payload: dict, workspace_id: str | None):
    """product.updated — обновить ProductKnowledge если релевантно."""
    product_name = payload.get("name", "")
    product_id = payload.get("id", "")
    logger.info("Webhook product.updated: %s (%s)", product_name, product_id)
    # В MVP: логируем. В E5.2: обновляем ProductCache.


def handle_pricelist_updated(payload: dict, workspace_id: str | None):
    """pricelist.updated — инвалидировать кеш прайса."""
    pricelist_id = payload.get("pricelist_id", "")
    logger.info("Webhook pricelist.updated: %s", pricelist_id)
    # В MVP: логируем. В E5.2: помечаем сметы для пересчёта.


def handle_contract_signed(payload: dict, workspace_id: str | None):
    """contract.signed — обновить transmission status + estimate status."""
    version_id = payload.get("ismeta_version_id")
    contract_id = payload.get("contract_id")
    if not version_id:
        logger.warning("contract.signed: missing ismeta_version_id")
        return

    updated = Estimate.objects.filter(id=version_id).update(status="transmitted")
    if updated:
        logger.info("contract.signed: estimate %s → transmitted, contract %s", version_id, contract_id)

    SnapshotTransmission.objects.filter(
        estimate_id=version_id, status=TransmissionStatus.SENDING,
    ).update(status=TransmissionStatus.SUCCESS)


SUPPORTED_EVENTS = {
    "product.updated": handle_product_updated,
    "pricelist.updated": handle_pricelist_updated,
    "contract.signed": handle_contract_signed,
}
