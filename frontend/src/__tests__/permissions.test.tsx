import { describe, it, expect } from 'vitest';
import { buildPermissionsValue } from '../hooks/usePermissions';
import type { ERPPermissions } from '../lib/api';

describe('buildPermissionsValue', () => {
  describe('superuser', () => {
    it('grants full access to superuser', () => {
      const { hasAccess, canEdit, isSuperuser } = buildPermissionsValue({
        is_superuser: true,
        erp_permissions: { dashboard: 'none' } as ERPPermissions,
      });
      expect(isSuperuser).toBe(true);
      expect(hasAccess('dashboard')).toBe(true);
      expect(canEdit('dashboard')).toBe(true);
    });
  });

  describe('empty permissions', () => {
    it('grants access when no permissions set', () => {
      const { hasAccess } = buildPermissionsValue({ erp_permissions: {} as ERPPermissions });
      expect(hasAccess('dashboard')).toBe(true);
      expect(hasAccess('settings.personnel')).toBe(true);
    });

    it('grants access when user is null', () => {
      const { hasAccess } = buildPermissionsValue(null);
      expect(hasAccess('anything')).toBe(true);
    });
  });

  describe('direct key lookup', () => {
    const perms: ERPPermissions = {
      dashboard: 'read',
      commercial: 'edit',
      settings: 'read',
      'settings.personnel': 'none',
      'settings.goods': 'edit',
    };

    it('reads direct root key', () => {
      const { hasAccess } = buildPermissionsValue({ erp_permissions: perms });
      expect(hasAccess('dashboard')).toBe(true);
      expect(hasAccess('commercial')).toBe(true);
    });

    it('reads direct dotted key', () => {
      const { hasAccess } = buildPermissionsValue({ erp_permissions: perms });
      expect(hasAccess('settings.personnel')).toBe(false);
      expect(hasAccess('settings.goods')).toBe(true);
    });
  });

  describe('fallback to parent', () => {
    const perms: ERPPermissions = {
      finance: 'edit',
      commercial: 'none',
    };

    it('falls back to parent when subsection missing', () => {
      const { hasAccess, canEdit } = buildPermissionsValue({ erp_permissions: perms });
      expect(hasAccess('finance.payments')).toBe(true);
      expect(canEdit('finance.payments')).toBe(true);
    });

    it('inherits none from parent', () => {
      const { hasAccess } = buildPermissionsValue({ erp_permissions: perms });
      expect(hasAccess('commercial.kanban')).toBe(false);
    });
  });

  describe('subsection overrides parent', () => {
    const perms: ERPPermissions = {
      settings: 'edit',
      'settings.personnel': 'none',
      'settings.goods': 'read',
    };

    it('subsection none overrides parent edit', () => {
      const { hasAccess } = buildPermissionsValue({ erp_permissions: perms });
      expect(hasAccess('settings')).toBe(true);
      expect(hasAccess('settings.personnel')).toBe(false);
    });

    it('subsection read overrides parent edit for canEdit', () => {
      const { canEdit } = buildPermissionsValue({ erp_permissions: perms });
      expect(canEdit('settings')).toBe(true);
      expect(canEdit('settings.goods')).toBe(false);
    });
  });

  describe('minLevel parameter', () => {
    const perms: ERPPermissions = {
      objects: 'read',
    };

    it('read access with read level', () => {
      const { hasAccess } = buildPermissionsValue({ erp_permissions: perms });
      expect(hasAccess('objects', 'read')).toBe(true);
    });

    it('edit access denied with read level', () => {
      const { hasAccess } = buildPermissionsValue({ erp_permissions: perms });
      expect(hasAccess('objects', 'edit')).toBe(false);
    });
  });
});
