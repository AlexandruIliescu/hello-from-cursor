export type DestinationId = 'chatgpt' | 'claude' | 'gemini' | 'copy';

export type TemplateId =
  | 'article'
  | 'docs'
  | 'github'
  | 'product'
  | 'selection'
  | 'custom';

export interface PageCapture {
  title: string;
  url: string;
  selection: string;
  mainText: string;
  capturedAt: string;
}

export interface ContextPack {
  id: string;
  title: string;
  url: string;
  templateId: TemplateId;
  prompt: string;
  createdAt: string;
  synced?: boolean;
}

export interface UsageDay {
  date: string; // YYYY-MM-DD
  sends: number;
}

export interface LicenseState {
  tier: 'free' | 'pro' | 'team';
  licenseKey?: string;
  email?: string;
  expiresAt?: string;
  lastCheckedAt?: string;
  valid: boolean;
}

export interface TeamSeat {
  id: string;
  email: string;
  role: 'owner' | 'admin' | 'member';
}

export interface AppSettings {
  defaultDestination: DestinationId;
  defaultTemplate: TemplateId;
  customTemplate?: string;
  apiBaseUrl: string;
  syncEnabled: boolean;
  teamId?: string;
}

export const FREE_DAILY_SEND_LIMIT = 10;
export const FREE_HISTORY_LIMIT = 20;
export const PRO_HISTORY_LIMIT = 500;

export const DEFAULT_SETTINGS: AppSettings = {
  defaultDestination: 'chatgpt',
  defaultTemplate: 'article',
  apiBaseUrl: 'http://localhost:8787',
  syncEnabled: false,
};
