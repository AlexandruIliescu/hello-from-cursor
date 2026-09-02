import type { DestinationId } from './types';

export const DESTINATION_LABELS: Record<DestinationId, string> = {
  chatgpt: 'ChatGPT',
  claude: 'Claude',
  gemini: 'Gemini',
  copy: 'Copy only',
};

export const DESTINATION_URLS: Record<Exclude<DestinationId, 'copy'>, string> = {
  chatgpt: 'https://chatgpt.com/',
  claude: 'https://claude.ai/new',
  gemini: 'https://gemini.google.com/app',
};

export async function copyToClipboard(text: string): Promise<void> {
  await navigator.clipboard.writeText(text);
}

/**
 * Open the AI site and attempt to inject the prompt into the composer.
 * Falls back to clipboard + open tab if injection is blocked.
 */
export async function sendToDestination(
  destination: DestinationId,
  prompt: string,
): Promise<{ mode: 'injected' | 'copied' | 'opened' }> {
  if (destination === 'copy') {
    await copyToClipboard(prompt);
    return { mode: 'copied' };
  }

  await copyToClipboard(prompt);

  const url = DESTINATION_URLS[destination];
  const tab = await browser.tabs.create({ url, active: true });

  // Best-effort paste into known composers after load
  if (tab.id != null) {
    try {
      await waitForTabComplete(tab.id);
      await browser.scripting.executeScript({
        target: { tabId: tab.id },
        args: [prompt, destination],
        func: injectPrompt,
      });
      return { mode: 'injected' };
    } catch {
      return { mode: 'copied' };
    }
  }

  return { mode: 'opened' };
}

function waitForTabComplete(tabId: number, timeoutMs = 12000): Promise<void> {
  return new Promise((resolve) => {
    const started = Date.now();
    const timer = setInterval(async () => {
      try {
        const tab = await browser.tabs.get(tabId);
        if (tab.status === 'complete' || Date.now() - started > timeoutMs) {
          clearInterval(timer);
          // Small delay for SPA composers
          setTimeout(() => resolve(), 800);
        }
      } catch {
        clearInterval(timer);
        resolve();
      }
    }, 300);
  });
}

function injectPrompt(prompt: string, destination: string) {
  const selectors: Record<string, string[]> = {
    chatgpt: ['#prompt-textarea', 'div[contenteditable="true"]', 'textarea'],
    claude: ['div[contenteditable="true"]', 'textarea'],
    gemini: ['div[contenteditable="true"]', 'rich-textarea', 'textarea'],
  };
  const list = selectors[destination] ?? ['textarea', 'div[contenteditable="true"]'];

  for (const sel of list) {
    const el = document.querySelector(sel) as HTMLElement | null;
    if (!el) continue;
    if (el instanceof HTMLTextAreaElement) {
      el.focus();
      el.value = prompt;
      el.dispatchEvent(new Event('input', { bubbles: true }));
      return true;
    }
    el.focus();
    el.textContent = prompt;
    el.dispatchEvent(new InputEvent('input', { bubbles: true, data: prompt }));
    return true;
  }
  return false;
}
