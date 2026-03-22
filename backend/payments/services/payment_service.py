"""
Сервисный слой для операций с платежами.
Вынесено из PaymentSerializer для соблюдения принципа Single Responsibility.
"""
import json
import logging
from datetime import date, timedelta
from decimal import Decimal
from django.db import transaction
from django.utils import timezone
from rest_framework import serializers
from typing import List, Dict, Any, Optional

from catalog.services import ProductMatcher
from catalog.models import ProductPriceHistory
from payments.models import (
    Payment, PaymentRegistry, PaymentItem,
    Invoice, InvoiceItem, InvoiceEvent,
    RecurringPayment, IncomeRecord,
)

logger = logging.getLogger(__name__)

# Максимальное количество позиций в одном платеже
MAX_PAYMENT_ITEMS = 200


class PaymentService:
    """Сервис для создания и обработки платежей"""

    @staticmethod
    def validate_payment_data(data: Dict[str, Any], *, is_create: bool = False,
                              has_file_in_request: bool = False,
                              item_create_serializer_class=None) -> Dict[str, Any]:
        """
        Валидация бизнес-правил платежа.

        Args:
            data: validated_data из сериализатора
            is_create: True если это POST (создание)
            has_file_in_request: True если в request.FILES есть scan_file
            item_create_serializer_class: класс сериализатора для валидации позиций

        Returns:
            data (возможно мутированный — items_input десериализован из строки)

        Raises:
            serializers.ValidationError
        """
        category = data.get('category')
        contract = data.get('contract')

        # Бизнес-правило: категория требует договор
        if category and category.requires_contract and not contract:
            raise serializers.ValidationError({
                'contract_id': f'Категория "{category.name}" требует указания договора'
            })

        # Бизнес-правило: файл обязателен при создании
        if is_create:
            if not data.get('scan_file') and not has_file_in_request:
                raise serializers.ValidationError({
                    'scan_file': 'Документ (счёт или акт) обязателен для создания платежа'
                })

        # Валидация items_input
        items_input = data.get('items_input')
        if items_input is not None:
            if isinstance(items_input, str):
                try:
                    items_input = json.loads(items_input)
                    data['items_input'] = items_input
                except json.JSONDecodeError:
                    raise serializers.ValidationError({
                        'items_input': 'Неверный формат JSON'
                    })

            if not isinstance(items_input, list):
                raise serializers.ValidationError({
                    'items_input': 'Должен быть список'
                })

            if len(items_input) > MAX_PAYMENT_ITEMS:
                raise serializers.ValidationError({
                    'items_input': f'Слишком много позиций ({len(items_input)}). '
                                   f'Максимум: {MAX_PAYMENT_ITEMS}'
                })

            # Валидируем каждую позицию через переданный сериализатор
            if item_create_serializer_class is not None:
                item_serializer = item_create_serializer_class(data=items_input, many=True)
                if not item_serializer.is_valid():
                    raise serializers.ValidationError({
                        'items_input': item_serializer.errors
                    })

        return data

    @staticmethod
    @transaction.atomic
    def create_payment(
        validated_data: Dict[str, Any],
        items_data: List[Dict[str, Any]],
        user
    ) -> Payment:
        """
        Создание платежа с учётом типа:
        - income: сразу статус 'paid'
        - expense: статус 'pending', автоматически создаётся запись в Реестре
        
        Args:
            validated_data: Валидированные данные платежа
            items_data: Список позиций платежа
            user: Пользователь, создающий платёж
            
        Returns:
            Payment: Созданный платёж
        """
        payment_type = validated_data.get('payment_type')
        
        # Устанавливаем статус в зависимости от типа платежа
        if payment_type == Payment.PaymentType.INCOME:
            validated_data['status'] = Payment.Status.PAID
        else:  # expense
            validated_data['status'] = Payment.Status.PENDING
        
        # Создаём платёж
        payment = Payment.objects.create(**validated_data)
        
        # Для расходного платежа создаём запись в Реестре
        if payment_type == Payment.PaymentType.EXPENSE:
            registry_entry = PaymentService._create_registry_entry(payment, user)
            payment.payment_registry = registry_entry
            payment.save(update_fields=['payment_registry'])
        
        # Создаём позиции платежа
        if items_data:
            PaymentService._create_payment_items(payment, items_data)
        
        return payment
    
    @staticmethod
    def _create_registry_entry(payment: Payment, user) -> PaymentRegistry:
        """Создаёт запись в Реестре платежей"""
        initiator = user.get_full_name() or user.username if user else 'System'
        
        return PaymentRegistry.objects.create(
            account=payment.account,
            category=payment.category,
            contract=payment.contract,
            planned_date=payment.payment_date,
            amount=payment.amount_gross or payment.amount,
            status=PaymentRegistry.Status.PLANNED,
            initiator=initiator,
            comment=payment.description,
            invoice_file=payment.scan_file,
        )
    
    @staticmethod
    def _create_payment_items(payment: Payment, items_data: List[Dict[str, Any]]) -> None:
        """
        Создаёт позиции платежа и связанные записи в каталоге.
        
        Args:
            payment: Платёж
            items_data: Список данных позиций
        """
        matcher = ProductMatcher()
        counterparty = payment.contract.counterparty if payment.contract else None
        
        for item_data in items_data:
            # Конвертируем строковые значения в Decimal
            quantity = Decimal(str(item_data['quantity']))
            price_per_unit = Decimal(str(item_data['price_per_unit']))
            vat_amount = (
                Decimal(str(item_data.get('vat_amount', 0)))
                if item_data.get('vat_amount') else None
            )
            
            # Ищем или создаём товар в каталоге
            product, created = matcher.find_or_create_product(
                name=item_data['raw_name'],
                unit=item_data.get('unit', 'шт'),
                payment=payment
            )
            
            # Создаём позицию платежа
            PaymentItem.objects.create(
                payment=payment,
                product=product,
                raw_name=item_data['raw_name'],
                quantity=quantity,
                unit=item_data.get('unit', 'шт'),
                price_per_unit=price_per_unit,
                vat_amount=vat_amount
            )
            
            # Записываем историю цен (update_or_create для избежания дубликатов)
            if counterparty:
                ProductPriceHistory.objects.update_or_create(
                    product=product,
                    counterparty=counterparty,
                    invoice_date=payment.payment_date,
                    unit=item_data.get('unit', 'шт'),
                    defaults={
                        'price': price_per_unit,
                        'invoice_number': payment.description or '',
                        'payment': payment
                    }
                )


# =============================================================================
# InvoiceService — workflow счетов (новая система)
# =============================================================================

