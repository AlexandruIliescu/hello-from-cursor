import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom/client';
import {
  createCheckoutSession,
  fetchTeamSeats,
  verifyLicense,
} from '../../lib/license';
import {
  getLicense,
  getPacks,
  getPendingSync,
  getSettings,
  getTeamSeats,
  saveSettings,
  saveTeamSeats,
  clearPendingSync,
} from '../../lib/storage';
import { syncPacks } from '../../lib/license';
import { makePack } from '../../lib/capture';
import type {
  AppSettings,
  ContextPack,
  DestinationId,
  LicenseState,
  TeamSeat,
  TemplateId,
} from '../../lib/types';
import { TEMPLATE_LABELS } from '../../lib/templates';
import { DESTINATION_LABELS } from '../../lib/destinations';
import './options.css';

function OptionsApp() {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [license, setLicense] = useState<LicenseState | null>(null);
  const [licenseKey, setLicenseKey] = useState('');
  const [packs, setPacks] = useState<ContextPack[]>([]);
  const [seats, setSeats] = useState<TeamSeat[]>([]);
  const [pending, setPending] = useState(0);
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  const [multiTabPreview, setMultiTabPreview] = useState('');

  async function reload() {
    const [s, l, p, pend, t] = await Promise.all([
      getSettings(),
      getLicense(),
      getPacks(),
      getPendingSync(),
      getTeamSeats(),
    ]);
    setSettings(s);
    setLicense(l);
    setLicenseKey(l.licenseKey ?? '');
    setPacks(p);
    setPending(pend.length);
    setSeats(t);
  }

  useEffect(() => {
    void reload();
  }, []);

  async function updateSettings(partial: Partial<AppSettings>) {
    const next = await saveSettings(partial);
    setSettings(next);
  }

  async function onVerify() {
    setBusy(true);
    setStatus('');
    try {
      const state = await verifyLicense(licenseKey.trim());
      setLicense(state);
      setStatus(state.valid ? `License OK — ${state.tier}` : 'License invalid');
      if (state.valid && state.tier === 'team') {
        try {
          const remote = await fetchTeamSeats();
          await saveTeamSeats(remote);
          setSeats(remote);
        } catch {
          /* server may be offline */
        }
      }
    } catch (err) {
      setStatus(`Verify failed: ${(err as Error).message}. Is the API running?`);
    } finally {
      setBusy(false);
    }
  }

  async function onCheckout(plan: 'pro_monthly' | 'pro_yearly' | 'team') {
    setBusy(true);
    setStatus('');
    try {
      const url = await createCheckoutSession(plan);
      window.open(url, '_blank', 'noopener,noreferrer');
      setStatus('Checkout opened. After payment, paste your license key here.');
    } catch (err) {
      setStatus(`Checkout unavailable: ${(err as Error).message}`);
    } finally {
      setBusy(false);
    }
  }

  async function onSync() {
    setBusy(true);
    setStatus('');
    try {
      const pend = await getPendingSync();
      if (!pend.length) {
        setStatus('Nothing to sync.');
        return;
      }
      const { syncedIds } = await syncPacks(pend);
      await clearPendingSync(syncedIds);
      setPending(0);
      setStatus(`Synced ${syncedIds.length} packs.`);
      await reload();
    } catch (err) {
      setStatus(String((err as Error).message));
    } finally {
      setBusy(false);
    }
  }

  async function buildMultiTabPack() {
    setBusy(true);
    setStatus('');
    try {
      if (!license || license.tier === 'free' || !license.valid) {
        setStatus('Multi-tab research packs are a Pro feature.');
        return;
      }
      const tabs = await browser.tabs.query({ currentWindow: true });
      const httpTabs = tabs.filter((t) => t.id && t.url?.startsWith('http'));
      const chunks: string[] = [];
      for (const tab of httpTabs.slice(0, 8)) {
        const results = await browser.scripting.executeScript({
          target: { tabId: tab.id! },
          func: () => ({
            title: document.title,
            url: location.href,
            text: (document.querySelector('article, main, body') as HTMLElement)?.innerText
              ?.slice(0, 4000) ?? '',
          }),
        });
        const r = results[0]?.result as { title: string; url: string; text: string } | undefined;
        if (r) {
          chunks.push(`## ${r.title}\nSource: ${r.url}\n\n${r.text.trim()}`);
        }
      }
      const prompt = `You are helping with a multi-tab research session. Synthesize themes, conflicts, and next questions across these sources.\n\n${chunks.join('\n\n---\n\n')}`;
      setMultiTabPreview(prompt);
      const capture = {
        title: `Research pack (${chunks.length} tabs)`,
        url: httpTabs[0]?.url ?? 'multi-tab',
        selection: '',
        mainText: chunks.join('\n\n'),
        capturedAt: new Date().toISOString(),
      };
      await makePack(capture, 'article');
      setStatus(`Built research pack from ${chunks.length} tabs.`);
      await reload();
    } catch (err) {
      setStatus(String((err as Error).message));
    } finally {
      setBusy(false);
    }
  }

  if (!settings) {
    return <div className="options">Loading…</div>;
  }

  return (
    <div className="options">
      <header>
        <h1>ContextDrop</h1>
        <p>Capture clean page context and send it to ChatGPT, Claude, or Gemini.</p>
      </header>

      <section>
        <h2>Defaults</h2>
        <label>
          Default destination
          <select
            value={settings.defaultDestination}
            onChange={(e) =>
              void updateSettings({ defaultDestination: e.target.value as DestinationId })
            }
          >
            {(Object.keys(DESTINATION_LABELS) as DestinationId[]).map((id) => (
              <option key={id} value={id}>
                {DESTINATION_LABELS[id]}
              </option>
            ))}
          </select>
        </label>
        <label>
          Default template
          <select
            value={settings.defaultTemplate}
            onChange={(e) =>
              void updateSettings({ defaultTemplate: e.target.value as TemplateId })
            }
          >
            {(Object.keys(TEMPLATE_LABELS) as TemplateId[]).map((id) => (
              <option key={id} value={id}>
                {TEMPLATE_LABELS[id]}
              </option>
            ))}
          </select>
        </label>
        <label>
          Custom template (use {'{{title}}'}, {'{{url}}'}, {'{{body}}'})
          <textarea
            value={settings.customTemplate ?? ''}
            onChange={(e) => void updateSettings({ customTemplate: e.target.value })}
            rows={5}
            placeholder="Analyze {{title}} from {{url}}:\n\n{{body}}"
          />
        </label>
      </section>

      <section>
        <h2>Pro &amp; billing</h2>
        <p className="muted">
          Free: 10 sends/day, 20 history items. Pro ($7.99/mo or $59/yr): unlimited sends, sync,
          custom templates, multi-tab packs. Team: $12–15/seat.
        </p>
        <div className="row">
          <button type="button" disabled={busy} onClick={() => void onCheckout('pro_monthly')}>
            Upgrade Pro monthly
          </button>
          <button type="button" disabled={busy} onClick={() => void onCheckout('pro_yearly')}>
            Upgrade Pro yearly
          </button>
          <button type="button" disabled={busy} onClick={() => void onCheckout('team')}>
            Team plan
          </button>
        </div>
        <label>
          License key
          <input
            value={licenseKey}
            onChange={(e) => setLicenseKey(e.target.value)}
            placeholder="cd_live_…"
          />
        </label>
        <button type="button" disabled={busy} onClick={() => void onVerify()}>
          Verify license (server-side)
        </button>
        <p className="muted">
          Current: {license?.tier ?? 'free'}
          {license?.valid ? ' (valid)' : ' (not validated)'}
          {license?.email ? ` · ${license.email}` : ''}
        </p>
      </section>

      <section>
        <h2>Cloud sync</h2>
        <label className="check">
          <input
            type="checkbox"
            checked={settings.syncEnabled}
            onChange={(e) => void updateSettings({ syncEnabled: e.target.checked })}
          />
          Enable sync for Pro/Team (requires API)
        </label>
        <label>
          API base URL
          <input
            value={settings.apiBaseUrl}
            onChange={(e) => void updateSettings({ apiBaseUrl: e.target.value })}
          />
        </label>
        <button type="button" disabled={busy} onClick={() => void onSync()}>
          Sync now ({pending} pending)
        </button>
      </section>

      <section>
        <h2>Multi-tab research pack (Pro)</h2>
        <p className="muted">Bundle up to 8 open HTTP tabs into one prompt pack.</p>
        <button type="button" disabled={busy} onClick={() => void buildMultiTabPack()}>
          Build from open tabs
        </button>
        {multiTabPreview && (
          <textarea readOnly value={multiTabPreview} rows={8} className="mono" />
        )}
      </section>

      <section>
        <h2>Team seats</h2>
        {seats.length === 0 ? (
          <p className="muted">No seats loaded. Verify a Team license to fetch seats from the API.</p>
        ) : (
          <ul className="seats">
            {seats.map((s) => (
              <li key={s.id}>
                <strong>{s.email}</strong> · {s.role}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2>History ({packs.length})</h2>
        <ul className="history">
          {packs.slice(0, 30).map((p) => (
            <li key={p.id}>
              <div>
                <strong>{p.title}</strong>
                <div className="muted">{p.url}</div>
              </div>
              <span className="muted">{p.synced ? 'synced' : 'local'}</span>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2>MCP / API (platform layer)</h2>
        <p className="muted">
          The companion server exposes <code>GET /v1/mcp/packs</code> and an MCP-compatible tool list
          so Claude/Cursor can pull your synced packs. See <code>server/</code> in the repo.
        </p>
      </section>

      {status && <div className="status">{status}</div>}
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <OptionsApp />
  </React.StrictMode>,
);
