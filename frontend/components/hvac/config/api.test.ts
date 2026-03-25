import { describe, expect, it } from 'vitest';
import { API_CONFIG } from './api';

describe('HVAC API config', () => {
  it('uses internal BFF route for HVAC API calls', () => {
    expect(API_CONFIG.BASE_URL).toBe('/api/hvac-admin/api/hvac');
  });

  it('exposes dedicated admin path for HVAC admin endpoints', () => {
    expect(API_CONFIG.ADMIN_BASE_URL).toBe('/api/hvac-admin/hvac-admin');
  });
});
