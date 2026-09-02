import type { PageCapture, TemplateId } from './types';

function clip(text: string, max = 12000): string {
  const t = text.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max)}\n\n[…truncated for length…]`;
}

export const TEMPLATE_LABELS: Record<TemplateId, string> = {
  article: 'Article / blog',
  docs: 'Docs',
  github: 'GitHub',
  product: 'Product page',
  selection: 'Selection only',
  custom: 'Custom template',
};

export function detectTemplate(url: string, hasSelection: boolean): TemplateId {
  if (hasSelection) return 'selection';
  try {
    const host = new URL(url).hostname;
    if (host.includes('github.com')) return 'github';
    if (
      host.includes('docs.') ||
      host.includes('developer.') ||
      url.includes('/docs/') ||
      url.includes('/documentation/')
    ) {
      return 'docs';
    }
    if (
      host.includes('amazon.') ||
      host.includes('shop') ||
      url.includes('/product/') ||
      url.includes('/dp/')
    ) {
      return 'product';
    }
  } catch {
    /* ignore */
  }
  return 'article';
}

export function buildPrompt(
  capture: PageCapture,
  templateId: TemplateId,
  customTemplate?: string,
  allowCustom = false,
): string {
  const body = clip(
    templateId === 'selection' && capture.selection
      ? capture.selection
      : capture.selection || capture.mainText,
  );

  if (templateId === 'custom' && allowCustom && customTemplate?.trim()) {
    return customTemplate
      .replaceAll('{{title}}', capture.title)
      .replaceAll('{{url}}', capture.url)
      .replaceAll('{{body}}', body)
      .replaceAll('{{selection}}', capture.selection || body);
  }

  switch (templateId) {
    case 'docs':
      return `Explain this documentation and give a minimal working example.\n\n# ${capture.title}\nSource: ${capture.url}\n\n${body}`;
    case 'github':
      return `Review this GitHub content. List issues, TODOs, and suggested next steps.\n\n# ${capture.title}\nSource: ${capture.url}\n\n${body}`;
    case 'product':
      return `Extract product features, pricing signals, and differentiators. Call out risks or missing info.\n\n# ${capture.title}\nSource: ${capture.url}\n\n${body}`;
    case 'selection':
      return `Focus only on the selected passage from ${capture.url}:\n\n${body}`;
    case 'article':
    default:
      return `Summarize the key claims, evidence, and risks. Cite the source URL.\n\n# ${capture.title}\nSource: ${capture.url}\n\n${body}`;
  }
}

/** Runs in the page context via chrome.scripting.executeScript */
export function extractPageContent(): PageCapture {
  const selection = window.getSelection()?.toString()?.trim() ?? '';

  const clone = document.body.cloneNode(true) as HTMLElement;
  for (const sel of [
    'script',
    'style',
    'noscript',
    'iframe',
    'nav',
    'footer',
    'header',
    'aside',
    '[role="navigation"]',
    '[role="banner"]',
    '[role="contentinfo"]',
    '.cookie',
    '#cookie',
    '[class*="cookie"]',
    '[class*="newsletter"]',
    '[class*="sidebar"]',
  ]) {
    clone.querySelectorAll(sel).forEach((el) => el.remove());
  }

  let mainText =
    (
      document.querySelector('article') ||
      document.querySelector('main') ||
      document.querySelector('[role="main"]') ||
      clone
    )?.textContent?.replace(/\s+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim() ??
    '';

  if (mainText.length < 40) {
    mainText = document.body.innerText.trim();
  }

  return {
    title: document.title || 'Untitled page',
    url: location.href,
    selection,
    mainText: mainText.slice(0, 50000),
    capturedAt: new Date().toISOString(),
  };
}
