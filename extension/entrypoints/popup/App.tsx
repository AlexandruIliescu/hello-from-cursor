import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { captureActiveTab, makePack } from '../../lib/capture';
import { sendToDestination, DESTINATION_LABELS } from '../../lib/destinations';
import { TEMPLATE_LABELS } from '../../lib/templates';
import {
  canSend,
  getPacks,
  getSettings,
  getLicense,
  incrementSendCount,
  saveSettings,
} from '../../lib/storage';
import type {
  ContextPack,
  DestinationId,
  LicenseState,
  TemplateId,
} from '../../lib/types';
import { isPaidTier } from '../../lib/types';

export default function App() {
  const [license, setLicense] = useState<LicenseState | null>(null);
  const [packs, setPacks] = useState<ContextPack[]>([]);
  const [preview, setPreview] = useState('');
  const [packMeta, setPackMeta] = useState<{ title: string; url: string } | null>(null);
  const [templateId, setTemplateId] = useState<TemplateId>('article');
  const [destination, setDestination] = useState<DestinationId>('chatgpt');
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  const [remaining, setRemaining] = useState<number | null>(null);

  const refresh = useCallback(async () => {
    const [s, l, p, gate] = await Promise.all([
      getSettings(),
      getLicense(),
      getPacks(),
      canSend(),
    ]);
    setLicense(l);
    setPacks(p.slice(0, 8));
    setTemplateId(
      s.defaultTemplate === 'custom' && !isPaidTier(l) ? 'article' : s.defaultTemplate,
    );
    setDestination(s.defaultDestination);
    setRemaining(gate.remaining);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const tierLabel = useMemo(() => {
    if (!license) return '…';
    if (license.tier === 'pro' && license.valid) return 'Pro';
    if (license.tier === 'team' && license.valid) return 'Team';
    return 'Free';
  }, [license]);

  const paid = license ? isPaidTier(license) : false;
  const templateOptions = useMemo(
    () =>
      (Object.keys(TEMPLATE_LABELS) as TemplateId[]).filter(
        (id) => id !== 'custom' || paid,
      ),
    [paid],
  );

  async function onCapture() {
    setBusy(true);
    setStatus('');
    try {
      const capture = await captureActiveTab();
      const pack = await makePack(capture, templateId);
      setPreview(pack.prompt);
      setPackMeta({ title: pack.title, url: pack.url });
      setPacks(await getPacks().then((x) => x.slice(0, 8)));
      setStatus('Captured. Ready to send.');
    } catch (err) {
      setStatus(String((err as Error).message ?? err));
    } finally {
      setBusy(false);
    }
  }

  async function onSend() {
    setBusy(true);
    setStatus('');
    try {
      const gate = await canSend();
      if (!gate.ok) {
        setStatus(`Daily free limit reached (${gate.limit}/day). Upgrade in Options.`);
        return;
      }
      let prompt = preview;
      if (!prompt) {
        const capture = await captureActiveTab();
        const pack = await makePack(capture, templateId);
        prompt = pack.prompt;
        setPreview(prompt);
        setPackMeta({ title: pack.title, url: pack.url });
      }
      const result = await sendToDestination(destination, prompt);
      const usage = await incrementSendCount();
      setRemaining(
        Number.isFinite(gate.limit) ? Math.max(0, gate.limit - usage.sends) : Infinity,
      );
      setStatus(
        result.mode === 'injected'
          ? `Sent to ${DESTINATION_LABELS[destination]}.`
          : `Copied + opened ${DESTINATION_LABELS[destination]}. Paste if needed.`,
      );
      await saveSettings({ defaultDestination: destination, defaultTemplate: templateId });
      setPacks(await getPacks().then((x) => x.slice(0, 8)));
    } catch (err) {
      setStatus(String((err as Error).message ?? err));
    } finally {
      setBusy(false);
    }
  }

  async function onCopy() {
    setBusy(true);
    try {
      let prompt = preview;
      if (!prompt) {
        const capture = await captureActiveTab();
        const pack = await makePack(capture, templateId);
        prompt = pack.prompt;
        setPreview(prompt);
      }
      await navigator.clipboard.writeText(prompt);
      setStatus('Prompt pack copied.');
    } catch (err) {
      setStatus(String((err as Error).message ?? err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="popup">
      <header className="header">
        <div>
          <div className="brand">ContextDrop</div>
          <div className="tagline">Web → AI context packs</div>
        </div>
        <button type="button" className="badge" onClick={() => browser.runtime.openOptionsPage()}>
          {tierLabel}
        </button>
      </header>

      <label className="field">
        <span>Template</span>
        <select value={templateId} onChange={(e) => setTemplateId(e.target.value as TemplateId)}>
          {templateOptions.map((id) => (
            <option key={id} value={id}>
              {TEMPLATE_LABELS[id]}
            </option>
          ))}
        </select>
      </label>

      <label className="field">
        <span>Send to</span>
        <select
          value={destination}
          onChange={(e) => setDestination(e.target.value as DestinationId)}
        >
          {(Object.keys(DESTINATION_LABELS) as DestinationId[]).map((id) => (
            <option key={id} value={id}>
              {DESTINATION_LABELS[id]}
            </option>
          ))}
        </select>
      </label>

      {packMeta && (
        <div className="meta">
          <strong>{packMeta.title}</strong>
          <span>{packMeta.url}</span>
        </div>
      )}

      <textarea
        className="preview"
        value={preview}
        onChange={(e) => setPreview(e.target.value)}
        placeholder="Capture a page to preview the prompt pack…"
        spellCheck={false}
      />

      <div className="actions">
        <button type="button" className="btn secondary" disabled={busy} onClick={onCapture}>
          Capture
        </button>
        <button type="button" className="btn primary" disabled={busy} onClick={onSend}>
          Send
        </button>
        <button type="button" className="btn ghost" disabled={busy} onClick={onCopy}>
          Copy
        </button>
      </div>

      <div className="footer-row">
        <span className="remaining">
          {remaining == null
            ? ''
            : Number.isFinite(remaining)
              ? `${remaining} free sends left today`
              : 'Unlimited sends'}
        </span>
        <button type="button" className="link" onClick={() => browser.runtime.openOptionsPage()}>
          Options
        </button>
      </div>

      {status && <div className="status">{status}</div>}

      {packs.length > 0 && (
        <section className="history">
          <h2>Recent</h2>
          <ul>
            {packs.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => {
                    setPreview(p.prompt);
                    setPackMeta({ title: p.title, url: p.url });
                    setTemplateId(p.templateId);
                  }}
                >
                  <span className="h-title">{p.title}</span>
                  <span className="h-meta">{new Date(p.createdAt).toLocaleString()}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
