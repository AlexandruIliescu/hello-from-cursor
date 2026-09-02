import { getLicense, getSettings, saveLicense } from './storage';
import type { ContextPack, LicenseState, TeamSeat } from './types';
import { isPaidTier } from './types';

export interface LicenseVerifyResponse {
  valid: boolean;
  tier: 'free' | 'pro' | 'team';
  email?: string;
  expiresAt?: string;
  seats?: TeamSeat[];
  message?: string;
}

async function apiUrl(path: string): Promise<string> {
  const settings = await getSettings();
  return `${settings.apiBaseUrl.replace(/\/$/, '')}${path}`;
}

/** Server-side license validation — never trust client-only flags for Pro. */
export async function verifyLicense(licenseKey: string): Promise<LicenseState> {
  const url = await apiUrl('/v1/license/verify');
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ licenseKey }),
    });
    const data = (await res.json()) as LicenseVerifyResponse;
    const state: LicenseState = {
      tier: data.valid ? data.tier : 'free',
      licenseKey,
      email: data.email,
      expiresAt: data.expiresAt,
      lastCheckedAt: new Date().toISOString(),
      valid: Boolean(data.valid),
    };
    await saveLicense(state);
    return state;
  } catch (err) {
    const existing = await getLicense();
    // Soft-fail: keep last known good Pro for 72h offline grace
    if (
      existing.licenseKey === licenseKey &&
      existing.valid &&
      existing.lastCheckedAt &&
      Date.now() - new Date(existing.lastCheckedAt).getTime() < 72 * 3600_000
    ) {
      return existing;
    }
    const failed: LicenseState = {
      tier: 'free',
      licenseKey,
      valid: false,
      lastCheckedAt: new Date().toISOString(),
    };
    await saveLicense(failed);
    throw err;
  }
}

export async function createCheckoutSession(plan: 'pro_monthly' | 'pro_yearly' | 'team'): Promise<string> {
  const url = await apiUrl('/v1/billing/checkout');
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ plan }),
  });
  if (!res.ok) throw new Error('Checkout failed');
  const data = (await res.json()) as { url: string };
  return data.url;
}

export async function syncPacks(
  packs: ContextPack[],
): Promise<{ syncedIds: string[] }> {
  const license = await getLicense();
  if (!isPaidTier(license) || !license.licenseKey) {
    throw new Error('Pro or Team required for sync');
  }
  const url = await apiUrl('/v1/sync/packs');
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${license.licenseKey}`,
    },
    body: JSON.stringify({ packs }),
  });
  if (!res.ok) throw new Error('Sync failed');
  return (await res.json()) as { syncedIds: string[] };
}

export async function fetchTeamSeats(): Promise<TeamSeat[]> {
  const license = await getLicense();
  if (!license.licenseKey) return [];
  const url = await apiUrl('/v1/teams/seats');
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${license.licenseKey}` },
  });
  if (!res.ok) throw new Error('Failed to load seats');
  const data = (await res.json()) as { seats: TeamSeat[] };
  return data.seats;
}
