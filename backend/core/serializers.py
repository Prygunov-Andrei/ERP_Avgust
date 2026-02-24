from rest_framework import serializers
from django.contrib.auth.models import User
from django.contrib.auth.password_validation import validate_password
from .models import UserProfile


class UserSerializer(serializers.ModelSerializer):
    """Сериализатор для пользователя"""
    
    photo = serializers.ImageField(source='profile.photo', read_only=True)
    photo_url = serializers.SerializerMethodField()
    erp_permissions = serializers.SerializerMethodField()
    employee_id = serializers.SerializerMethodField()
    is_superuser = serializers.BooleanField(read_only=True)
    is_staff = serializers.BooleanField(read_only=True)
    
    class Meta:
        model = User
        fields = [
            'id', 'username', 'email', 'first_name', 'last_name',
            'date_joined', 'photo', 'photo_url',
            'is_superuser', 'is_staff', 'erp_permissions', 'employee_id',
        ]
        read_only_fields = [
            'id', 'date_joined', 'photo', 'photo_url',
            'is_superuser', 'is_staff',
        ]
    
    def get_photo_url(self, obj):
        if obj.profile and obj.profile.photo:
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(obj.profile.photo.url)
            return obj.profile.photo.url
        return None

    def get_erp_permissions(self, obj):
        employee = getattr(obj, 'employee', None)
        if employee:
            return employee.erp_permissions
        return {}

    def get_employee_id(self, obj):
        employee = getattr(obj, 'employee', None)
        return employee.id if employee else None


class RegisterSerializer(serializers.ModelSerializer):
    """Сериализатор для регистрации пользователя"""
    
    password = serializers.CharField(
        write_only=True,
        required=True,
        validators=[validate_password]
    )
    password_confirm = serializers.CharField(write_only=True, required=True)
    
    class Meta:
        model = User
        fields = ['username', 'email', 'password', 'password_confirm', 'first_name', 'last_name']
        extra_kwargs = {
            'email': {'required': True},
        }
    
    def validate(self, attrs):
        if attrs['password'] != attrs['password_confirm']:
            raise serializers.ValidationError({
                'password': 'Пароли не совпадают'
            })
        return attrs
    
    def create(self, validated_data):
        validated_data.pop('password_confirm')
        user = User.objects.create_user(
            username=validated_data['username'],
            email=validated_data.get('email', ''),
            password=validated_data['password'],
            first_name=validated_data.get('first_name', ''),
            last_name=validated_data.get('last_name', ''),
        )
        return user


class ChangePasswordSerializer(serializers.Serializer):
    """Сериализатор для смены пароля"""
    
    old_password = serializers.CharField(required=True, write_only=True)
    new_password = serializers.CharField(
        required=True,
        write_only=True,
        validators=[validate_password]
    )
    new_password_confirm = serializers.CharField(required=True, write_only=True)
    
    def validate(self, attrs):
        if attrs['new_password'] != attrs['new_password_confirm']:
            raise serializers.ValidationError({
                'new_password': 'Пароли не совпадают'
            })
        return attrs
    
    def validate_old_password(self, value):
        user = self.context['request'].user
        if not user.check_password(value):
            raise serializers.ValidationError('Неверный текущий пароль')
        return value

