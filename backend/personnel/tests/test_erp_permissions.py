import pytest
from django.contrib.auth.models import User
from django.test import RequestFactory

from personnel.models import (
    Employee,
    ERP_PERMISSION_TREE,
    get_all_permission_keys,
    default_erp_permissions,
    resolve_permission_level,
    PERMISSION_LEVELS,
)
from personnel.permissions import ERPSectionPermission
from personnel.serializers import EmployeeDetailSerializer


# ---------- get_all_permission_keys ----------

class TestGetAllPermissionKeys:
    def test_contains_root_sections(self):
        keys = get_all_permission_keys()
        for section_code in ERP_PERMISSION_TREE:
            assert section_code in keys

    def test_contains_dotted_subsections(self):
        keys = get_all_permission_keys()
        assert 'settings.personnel' in keys
        assert 'commercial.kanban' in keys
        assert 'finance.payments' in keys
        assert 'supply.warehouse' in keys
        assert 'goods.catalog' in keys
        assert 'goods.works' in keys
        assert 'goods.pricelists' in keys
        assert 'goods.grades' in keys
        assert 'goods.categories' in keys
        assert 'goods.moderation' in keys

    def test_no_duplicates(self):
        keys = get_all_permission_keys()
        assert len(keys) == len(set(keys))

    def test_leaf_sections_have_no_children(self):
        keys = get_all_permission_keys()
        for key in keys:
            if '.' not in key:
                data = ERP_PERMISSION_TREE[key]
                if not data['children']:
                    dotted = [k for k in keys if k.startswith(f'{key}.')]
                    assert dotted == []


# ---------- default_erp_permissions ----------

class TestDefaultErpPermissions:
    def test_all_keys_present(self):
        perms = default_erp_permissions()
        all_keys = get_all_permission_keys()
        for key in all_keys:
            assert key in perms, f'Missing key: {key}'

    def test_all_values_none(self):
        perms = default_erp_permissions()
        for key, level in perms.items():
            assert level == 'none', f'{key} should be none, got {level}'


# ---------- resolve_permission_level ----------

class TestResolvePermissionLevel:
    def test_direct_key(self):
        perms = {'settings.personnel': 'edit', 'settings': 'read'}
        assert resolve_permission_level(perms, 'settings.personnel') == 'edit'

    def test_fallback_to_parent(self):
        perms = {'settings': 'read'}
        assert resolve_permission_level(perms, 'settings.personnel') == 'read'

    def test_missing_parent_returns_none(self):
        perms = {}
        assert resolve_permission_level(perms, 'settings.personnel') == 'none'

    def test_root_key_direct(self):
        perms = {'dashboard': 'edit'}
        assert resolve_permission_level(perms, 'dashboard') == 'edit'

    def test_root_key_missing(self):
        perms = {}
        assert resolve_permission_level(perms, 'dashboard') == 'none'

    def test_subsection_overrides_parent(self):
        perms = {'finance': 'edit', 'finance.payments': 'none'}
        assert resolve_permission_level(perms, 'finance.payments') == 'none'
        assert resolve_permission_level(perms, 'finance') == 'edit'
        assert resolve_permission_level(perms, 'finance.dashboard') == 'edit'


# ---------- ERPSectionPermission ----------

@pytest.mark.django_db
class TestERPSectionPermission:
    @pytest.fixture
    def factory(self):
        return RequestFactory()

    @pytest.fixture
    def perm(self):
        return ERPSectionPermission()

    @pytest.fixture
    def user_with_perms(self):
        def _create(perms_override=None):
            perms = default_erp_permissions()
            if perms_override:
                perms.update(perms_override)
            user = User.objects.create_user(
                username=f'test_{User.objects.count()}', password='pass'
            )
            Employee.objects.create(
                full_name='Test', user=user, erp_permissions=perms
            )
            return user
        return _create

    def test_superuser_always_allowed(self, factory, perm):
        user = User.objects.create_superuser('su', 'su@t.com', 'pass')
        request = factory.get('/api/v1/personnel/')
        request.user = user
        assert perm.has_permission(request, None) is True

    def test_anonymous_denied(self, factory, perm):
        from django.contrib.auth.models import AnonymousUser
        request = factory.get('/api/v1/personnel/')
        request.user = AnonymousUser()
        assert perm.has_permission(request, None) is False

    def test_user_without_employee_allowed(self, factory, perm):
        user = User.objects.create_user('bare', password='pass')
        request = factory.get('/api/v1/personnel/')
        request.user = user
        assert perm.has_permission(request, None) is True

    def test_subsection_read_access(self, factory, perm, user_with_perms):
        user = user_with_perms({'settings.personnel': 'read'})
        request = factory.get('/api/v1/personnel/')
        request.user = user
        assert perm.has_permission(request, None) is True

    def test_subsection_no_access(self, factory, perm, user_with_perms):
        user = user_with_perms({'settings': 'read', 'settings.personnel': 'none'})
        request = factory.get('/api/v1/personnel/')
        request.user = user
        assert perm.has_permission(request, None) is False

    def test_subsection_write_denied_with_read(self, factory, perm, user_with_perms):
        user = user_with_perms({'settings.personnel': 'read'})
        request = factory.post('/api/v1/personnel/')
        request.user = user
        assert perm.has_permission(request, None) is False

    def test_subsection_write_allowed_with_edit(self, factory, perm, user_with_perms):
        user = user_with_perms({'settings.personnel': 'edit'})
        request = factory.post('/api/v1/personnel/')
        request.user = user
        assert perm.has_permission(request, None) is True

    def test_fallback_to_parent_section(self, factory, perm):
        """When subsection key is absent, fallback to parent."""
        user = User.objects.create_user(
            username='fallback_test', password='pass'
        )
        Employee.objects.create(
            full_name='Fallback',
            user=user,
            erp_permissions={'settings': 'edit'},
        )
        request = factory.get('/api/v1/personnel/')
        request.user = user
        assert perm.has_permission(request, None) is True

    def test_unmapped_url_allowed(self, factory, perm, user_with_perms):
        user = user_with_perms({})
        request = factory.get('/api/v1/users/me/')
        request.user = user
        assert perm.has_permission(request, None) is True

    def test_catalog_maps_to_goods_catalog(
        self, factory, perm, user_with_perms,
    ):
        user = user_with_perms({'goods.catalog': 'read'})
        req = factory.get('/api/v1/catalog/products/')
        req.user = user
        assert perm.has_permission(req, None) is True

    def test_catalog_denied_when_goods_catalog_none(
        self, factory, perm, user_with_perms,
    ):
        user = user_with_perms({
            'goods': 'edit', 'goods.catalog': 'none',
        })
        req = factory.get('/api/v1/catalog/products/')
        req.user = user
        assert perm.has_permission(req, None) is False

    def test_pricelists_maps_to_goods(
        self, factory, perm, user_with_perms,
    ):
        user = user_with_perms({'goods.pricelists': 'read'})
        req = factory.get('/api/v1/price-lists/')
        req.user = user
        assert perm.has_permission(req, None) is True

    def test_work_items_maps_to_goods_works(
        self, factory, perm, user_with_perms,
    ):
        user = user_with_perms({'goods.works': 'edit'})
        req = factory.post('/api/v1/work-items/')
        req.user = user
        assert perm.has_permission(req, None) is True

    def test_worker_grades_maps_to_goods(
        self, factory, perm, user_with_perms,
    ):
        user = user_with_perms({'goods.grades': 'read'})
        req = factory.get('/api/v1/worker-grades/')
        req.user = user
        assert perm.has_permission(req, None) is True

    def test_goods_fallback_to_parent(self, factory, perm):
        """Absent goods.catalog falls back to goods."""
        user = User.objects.create_user(
            username='goods_fallback', password='pass',
        )
        Employee.objects.create(
            full_name='GoodsFallback',
            user=user,
            erp_permissions={'goods': 'read'},
        )
        req = factory.get('/api/v1/catalog/products/')
        req.user = user
        assert perm.has_permission(req, None) is True

    def test_goods_subsection_override(
        self, factory, perm, user_with_perms,
    ):
        """goods.works=none overrides goods=edit."""
        user = user_with_perms({
            'goods': 'edit', 'goods.works': 'none',
        })
        req = factory.get('/api/v1/work-items/')
        req.user = user
        assert perm.has_permission(req, None) is False


# ---------- Serializer validation ----------

@pytest.mark.django_db
class TestSerializerValidation:
    def test_valid_dotted_key(self):
        data = {
            'full_name': 'Test',
            'erp_permissions': {'settings.personnel': 'edit', 'settings': 'read'},
        }
        serializer = EmployeeDetailSerializer(data=data)
        serializer.is_valid(raise_exception=False)
        assert 'erp_permissions' not in serializer.errors

    def test_invalid_key_rejected(self):
        data = {
            'full_name': 'Test',
            'erp_permissions': {'nonexistent.section': 'read'},
        }
        serializer = EmployeeDetailSerializer(data=data)
        is_valid = serializer.is_valid()
        assert not is_valid
        assert 'erp_permissions' in serializer.errors

    def test_invalid_level_rejected(self):
        data = {
            'full_name': 'Test',
            'erp_permissions': {'settings': 'admin'},
        }
        serializer = EmployeeDetailSerializer(data=data)
        is_valid = serializer.is_valid()
        assert not is_valid
        assert 'erp_permissions' in serializer.errors
