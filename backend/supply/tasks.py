import logging
from celery import shared_task

logger = logging.getLogger(__name__)


@shared_task(bind=True, max_retries=3, default_retry_delay=30)
def process_bitrix_deal(self, deal_id: int, integration_id: int):
    """
    Основная Celery-задача обработки сделки из Битрикс24.

    1. Загружает данные сделки через BitrixAPIClient
    2. Проверяет стадию
    3. Создаёт SupplyRequest и Invoice(s)
    4. Запускает LLM-распознавание для каждого счёта
    """
    from supply.services.deal_processor import DealProcessor
    from supply.models import BitrixIntegration

    try:
        integration = BitrixIntegration.objects.get(id=integration_id, is_active=True)
    except BitrixIntegration.DoesNotExist:
        logger.error('process_bitrix_deal: integration %s not found or inactive', integration_id)
        return

    processor = DealProcessor(integration)
    try:
        processor.process_deal(deal_id)
    except Exception as exc:
        logger.exception('process_bitrix_deal: error processing deal %s', deal_id)
        raise self.retry(exc=exc)


@shared_task(bind=True, max_retries=2, default_retry_delay=30)
def recognize_invoice(
    self, invoice_id: int, auto_counterparty: bool = True,
):
    """
    Celery-задача LLM-распознавания конкретного счёта.

    Единый pipeline для single и batch upload.
    Вызывает InvoiceService.recognize() для перевода
    Invoice из RECOGNITION в REVIEW.
    """
    from payments.services import InvoiceService
    from llm_services.services.exceptions import RateLimitError

    try:
        InvoiceService.recognize(
            invoice_id,
            auto_counterparty=auto_counterparty,
        )
    except RateLimitError as exc:
        raise self.retry(exc=exc, countdown=60)
    except Exception:
        logger.exception(
            'recognize_invoice: error for invoice %s', invoice_id,
        )


@shared_task
def finalize_bulk_import(session_id: int):
    """
    Проверяет, все ли файлы в сессии обработаны.
    Если да — ставит статус COMPLETED/COMPLETED_WITH_ERRORS.
    """
    from payments.models import BulkImportSession, Invoice

    try:
        session = BulkImportSession.objects.get(id=session_id)
    except BulkImportSession.DoesNotExist:
        logger.error(
            'finalize_bulk_import: session %s not found', session_id,
        )
        return

    pending = session.invoices.filter(
        status=Invoice.Status.RECOGNITION,
    ).count()
    if pending > 0:
        return  # Ещё не все обработаны

    if session.failed > 0:
        new_status = BulkImportSession.Status.COMPLETED_WITH_ERRORS
    else:
        new_status = BulkImportSession.Status.COMPLETED

    session.status = new_status
    session.save(update_fields=['status', 'updated_at'])
    logger.info(
        'finalize_bulk_import: session %s → %s',
        session_id, new_status,
    )


@shared_task
def generate_recurring_invoices():
    """
    Ежедневная задача (Celery Beat): генерация счетов из периодических платежей.

    Проверяет RecurringPayment с next_generation_date <= today + 30 дней
    и создаёт Invoice для каждого.
    """
    from payments.services import InvoiceService

    try:
        count = InvoiceService.generate_recurring()
        logger.info('generate_recurring_invoices: created %d invoices', count)
    except Exception:
        logger.exception('generate_recurring_invoices: error')
