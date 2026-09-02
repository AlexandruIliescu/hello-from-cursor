import { buildPrompt, detectTemplate, extractPageContent } from './templates';
import { sendToDestination } from './destinations';
import {
  canSend,
  getSettings,
  incrementSendCount,
  savePack,
} from './storage';
import type { ContextPack, DestinationId, PageCapture, TemplateId } from './types';

function uid(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export async function captureActiveTab(): Promise<PageCapture> {
  const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) throw new Error('No active tab');
  if (!tab.url || tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://')) {
    throw new Error('Cannot capture this page. Open a normal website tab.');
  }

  const results = await browser.scripting.executeScript({
    target: { tabId: tab.id },
    func: extractPageContent,
  });

  const capture = results[0]?.result as PageCapture | undefined;
  if (!capture) throw new Error('Failed to extract page content');
  return capture;
}

export async function makePack(
  capture: PageCapture,
  templateId?: TemplateId,
): Promise<ContextPack> {
  const settings = await getSettings();
  const tpl =
    templateId ??
    detectTemplate(capture.url, Boolean(capture.selection)) ??
    settings.defaultTemplate;
  const prompt = buildPrompt(capture, tpl, settings.customTemplate);
  const pack: ContextPack = {
    id: uid(),
    title: capture.title,
    url: capture.url,
    templateId: tpl,
    prompt,
    createdAt: new Date().toISOString(),
  };
  await savePack(pack);
  return pack;
}

export async function captureAndSend(
  destination?: DestinationId,
  templateId?: TemplateId,
): Promise<{ pack: ContextPack; mode: string; remaining: number }> {
  const gate = await canSend();
  if (!gate.ok) {
    throw new Error(
      `Daily free limit reached (${gate.limit}/day). Upgrade to Pro for unlimited sends.`,
    );
  }

  const settings = await getSettings();
  const dest = destination ?? settings.defaultDestination;
  const capture = await captureActiveTab();
  const pack = await makePack(capture, templateId);
  const result = await sendToDestination(dest, pack.prompt);
  const usage = await incrementSendCount();
  const remaining = Number.isFinite(gate.limit)
    ? Math.max(0, gate.limit - usage.sends)
    : Infinity;

  return { pack, mode: result.mode, remaining };
}
