/** Canlı sunucu — site kökü */
export const API_BASE_URL = 'https://mystoneinn.com/api/mobile';
export const SITE_URL = 'https://mystoneinn.com';

export function normalizeAdminUsername(value) {
  const raw = String(value || '').trim();
  return raw.startsWith('@') ? raw.slice(1).trim() : raw;
}
