import {
  DEFAULT_SETTINGS,
  FREE_DAILY_SEND_LIMIT,
  FREE_HISTORY_LIMIT,
  PRO_HISTORY_LIMIT,
  isPaidTier,
  type AppSettings,
  type ContextPack,
  type LicenseState,
  type TeamSeat,
  type UsageDay,
} from './types';

const KEYS = {
  packs: 'packs',
  settings: 'settings',
  usage: 'usage',
  license: 'license',
  teamSeats: 'teamSeats',
  pendingSync: 'pendingSync',
} as const;

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export async function getSettings(): Promise<AppSettings> {
  const { [KEYS.settings]: settings } = await browser.storage.local.get(KEYS.settings);
  return { ...DEFAULT_SETTINGS, ...(settings as AppSettings | undefined) };
}

export async function saveSettings(partial: Partial<AppSettings>): Promise<AppSettings> {
  const current = await getSettings();
  const next = { ...current, ...partial };
  await browser.storage.local.set({ [KEYS.settings]: next });
  return next;
}

export async function getLicense(): Promise<LicenseState> {
  const { [KEYS.license]: license } = await browser.storage.local.get(KEYS.license);
  return (
    (license as LicenseState | undefined) ?? {
      tier: 'free',
      valid: true,
    }
  );
}

export async function saveLicense(license: LicenseState): Promise<void> {
  await browser.storage.local.set({ [KEYS.license]: license });
}

export async function getUsage(): Promise<UsageDay> {
  const { [KEYS.usage]: usage } = await browser.storage.local.get(KEYS.usage);
  const u = usage as UsageDay | undefined;
  if (!u || u.date !== today()) {
    const fresh = { date: today(), sends: 0 };
    await browser.storage.local.set({ [KEYS.usage]: fresh });
    return fresh;
  }
  return u;
}

export async function incrementSendCount(): Promise<UsageDay> {
  const usage = await getUsage();
  const next = { ...usage, sends: usage.sends + 1 };
  await browser.storage.local.set({ [KEYS.usage]: next });
  return next;
}

export async function getSendLimit(): Promise<number> {
  const license = await getLicense();
  if (isPaidTier(license)) return Number.POSITIVE_INFINITY;
  return FREE_DAILY_SEND_LIMIT;
}

export async function canSend(): Promise<{ ok: boolean; remaining: number; limit: number }> {
  const limit = await getSendLimit();
  const usage = await getUsage();
  if (!Number.isFinite(limit)) {
    return { ok: true, remaining: Infinity, limit };
  }
  const remaining = Math.max(0, limit - usage.sends);
  return { ok: remaining > 0, remaining, limit };
}

export async function getPacks(): Promise<ContextPack[]> {
  const { [KEYS.packs]: packs } = await browser.storage.local.get(KEYS.packs);
  return (packs as ContextPack[] | undefined) ?? [];
}

export async function savePack(pack: ContextPack): Promise<ContextPack[]> {
  const license = await getLicense();
  const limit = isPaidTier(license) ? PRO_HISTORY_LIMIT : FREE_HISTORY_LIMIT;
  const packs = await getPacks();
  const next = [pack, ...packs.filter((p) => p.id !== pack.id)].slice(0, limit);
  await browser.storage.local.set({ [KEYS.packs]: next });

  const pending = ((await browser.storage.local.get(KEYS.pendingSync))[
    KEYS.pendingSync
  ] as ContextPack[] | undefined) ?? [];
  await browser.storage.local.set({
    [KEYS.pendingSync]: [pack, ...pending.filter((p) => p.id !== pack.id)].slice(0, 100),
  });

  return next;
}

export async function deletePack(id: string): Promise<ContextPack[]> {
  const packs = (await getPacks()).filter((p) => p.id !== id);
  await browser.storage.local.set({ [KEYS.packs]: packs });
  return packs;
}

export async function getTeamSeats(): Promise<TeamSeat[]> {
  const { [KEYS.teamSeats]: seats } = await browser.storage.local.get(KEYS.teamSeats);
  return (seats as TeamSeat[] | undefined) ?? [];
}

export async function saveTeamSeats(seats: TeamSeat[]): Promise<void> {
  await browser.storage.local.set({ [KEYS.teamSeats]: seats });
}

export async function getPendingSync(): Promise<ContextPack[]> {
  const { [KEYS.pendingSync]: pending } = await browser.storage.local.get(KEYS.pendingSync);
  return (pending as ContextPack[] | undefined) ?? [];
}

export async function clearPendingSync(ids: string[]): Promise<void> {
  const pending = await getPendingSync();
  await browser.storage.local.set({
    [KEYS.pendingSync]: pending.filter((p) => !ids.includes(p.id)),
  });
  const packs = await getPacks();
  await browser.storage.local.set({
    [KEYS.packs]: packs.map((p) =>
      ids.includes(p.id) ? { ...p, synced: true } : p,
    ),
  });
}
