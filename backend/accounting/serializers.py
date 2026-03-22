from rest_framework import serializers
from decimal import Decimal

from .models import TaxSystem, LegalEntity, Account, AccountBalance, Counterparty

class TaxSystemSerializer(serializers.ModelSerializer):
    class Meta:
        model = TaxSystem
        fields = ['id', 'code', 'name', 'vat_rate', 'has_vat', 'description']
        read_only_fields = ['id', 'code']  # Код менять нельзя, это константа системы


class LegalEntitySerializer(serializers.ModelSerializer):
    tax_system_details = serializers.SerializerMethodField()

    class Meta:
        model = LegalEntity
        fields = ['id', 'name', 'short_name', 'inn', 'kpp', 'ogrn', 'tax_system', 'tax_system_details', 'is_active', 'created_at', 'updated_at']
        read_only_fields = ['id', 'created_at', 'updated_at']
    
    def get_tax_system_details(self, obj):
        """Получить детали системы налогообложения"""
        if obj.tax_system:
            return TaxSystemSerializer(obj.tax_system).data
        return None


class AccountSerializer(serializers.ModelSerializer):
    legal_entity_name = serializers.CharField(source='legal_entity.short_name', read_only=True, allow_null=True)
    current_balance = serializers.SerializerMethodField()
    bank_account_id = serializers.SerializerMethodField()
    bank_balance_latest = serializers.SerializerMethodField()
    bank_balance_date = serializers.SerializerMethodField()
    bank_delta = serializers.SerializerMethodField()

    class Meta:
        model = Account
        fields = [
            'id', 'legal_entity', 'legal_entity_name', 'name', 'number', 
            'account_type', 'bank_name', 'bik', 'currency', 
            'initial_balance', 'balance_date', 'location', 'description', 
            'is_active',
            'current_balance',
            'bank_account_id', 'bank_balance_latest', 'bank_balance_date', 'bank_delta',
            'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'current_balance', 'created_at', 'updated_at']
    
    def _cached_current_balance(self, obj):
        """Cache current balance per serializer call to avoid repeated DB queries."""
        cache_attr = '_cached_balance'
        if not hasattr(obj, cache_attr):
            try:
                setattr(obj, cache_attr, obj.get_current_balance())
            except Exception:
                setattr(obj, cache_attr, None)
        return getattr(obj, cache_attr)

    def _cached_bank_snapshot(self, obj):
        """Cache latest bank snapshot per serializer call to avoid repeated DB queries."""
        cache_attr = '_cached_bank_snap'
        if not hasattr(obj, cache_attr):
            try:
                snap = obj.balances.filter(
                    source=AccountBalance.Source.BANK_TOCHKA
                ).order_by('-balance_date', '-id').first()
            except Exception:
                snap = None
            setattr(obj, cache_attr, snap)
        return getattr(obj, cache_attr)

    def get_current_balance(self, obj):
        return self._cached_current_balance(obj)

    def get_bank_account_id(self, obj):
        bank_account = getattr(obj, 'bank_account', None)
        return getattr(bank_account, 'id', None)

    def get_bank_balance_latest(self, obj):
        snap = self._cached_bank_snapshot(obj)
        return getattr(snap, 'balance', None)

    def get_bank_balance_date(self, obj):
        snap = self._cached_bank_snapshot(obj)
        return getattr(snap, 'balance_date', None)

    def get_bank_delta(self, obj):
        snap = self._cached_bank_snapshot(obj)
        if not snap:
            return None
        internal = self._cached_current_balance(obj)
        if internal is None:
            return None
        try:
            return (Decimal(str(snap.balance)) - Decimal(str(internal)))
        except Exception:
            return None


class AccountBalanceSerializer(serializers.ModelSerializer):
    class Meta:
        model = AccountBalance
        fields = ['id', 'account', 'balance_date', 'source', 'balance']


class CounterpartySerializer(serializers.ModelSerializer):
    vendor_subtype_display = serializers.CharField(source='get_vendor_subtype_display', read_only=True)
    
    class Meta:
        model = Counterparty
        fields = [
            'id', 'name', 'short_name', 'type', 'vendor_subtype', 'vendor_subtype_display', 
            'legal_form', 'inn', 'kpp', 'ogrn', 'address', 'contact_info', 'notes', 'is_active', 'created_at'
        ]
        read_only_fields = ['id', 'vendor_subtype_display', 'created_at']
    
    def validate(self, data):
        """Валидация: vendor_subtype можно указывать только для type='vendor'"""
        vendor_subtype = data.get('vendor_subtype')
        counterparty_type = data.get('type') or (self.instance.type if self.instance else None)
        
        if vendor_subtype and counterparty_type != Counterparty.Type.VENDOR:
            raise serializers.ValidationError({
                'vendor_subtype': 'Подтип можно указывать только для контрагентов типа "Исполнитель/Поставщик"'
            })
        
        return data

