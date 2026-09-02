/**
 * ContextDrop API — license verification, Stripe checkout stubs, sync, team seats, MCP tools.
 * Dev mode uses an in-memory store. Set STRIPE_SECRET_KEY for live checkout sessions.
 */
import http from 'node:http';
import { randomUUID } from 'node:crypto';
import { URL } from 'node:url';

const PORT = Number(process.env.PORT || 8787);
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || '';
const APP_URL = process.env.APP_URL || 'http://localhost:8787';

/** @typedef {{ key: string, tier: 'pro'|'team', email: string, expiresAt: string, seats?: Array<{id:string,email:string,role:string}> }} License */

/** @type {Map<string, License>} */
const licenses = new Map();
/** @type {Map<string, Array<Record<string, unknown>>>} */
const packsByLicense = new Map();

// Seed demo licenses for local Pro / Team testing
licenses.set('cd_live_demo_pro', {
  key: 'cd_live_demo_pro',
  tier: 'pro',
  email: 'pro@example.com',
  expiresAt: new Date(Date.now() + 365 * 864e5).toISOString(),
});
licenses.set('cd_live_demo_team', {
  key: 'cd_live_demo_team',
  tier: 'team',
  email: 'owner@example.com',
  expiresAt: new Date(Date.now() + 365 * 864e5).toISOString(),
  seats: [
    { id: '1', email: 'owner@example.com', role: 'owner' },
    { id: '2', email: 'member@example.com', role: 'member' },
  ],
});

function json(res, status, body) {
  const data = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
  });
  res.end(data);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8');
      if (!raw) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch (err) {
        reject(err);
      }
    });
    req.on('error', reject);
  });
}

function authLicense(req) {
  const header = req.headers.authorization || '';
  const key = header.startsWith('Bearer ') ? header.slice(7) : '';
  return licenses.get(key) || null;
}

async function createStripeCheckout(plan) {
  if (!STRIPE_SECRET_KEY) {
    // Dev stub: pretend checkout and return a page explaining demo keys
    return `${APP_URL}/dev-checkout?plan=${encodeURIComponent(plan)}`;
  }
  const Stripe = (await import('stripe')).default;
  const stripe = new Stripe(STRIPE_SECRET_KEY);
  const priceMap = {
    pro_monthly: process.env.STRIPE_PRICE_PRO_MONTHLY,
    pro_yearly: process.env.STRIPE_PRICE_PRO_YEARLY,
    team: process.env.STRIPE_PRICE_TEAM,
  };
  const price = priceMap[plan];
  if (!price) throw new Error(`Missing Stripe price for ${plan}`);
  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    line_items: [{ price, quantity: 1 }],
    success_url: `${APP_URL}/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${APP_URL}/cancel`,
    metadata: { plan },
  });
  return session.url;
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || '/', `http://${req.headers.host}`);

  if (req.method === 'OPTIONS') {
    return json(res, 204, {});
  }

  try {
    if (req.method === 'GET' && url.pathname === '/health') {
      return json(res, 200, { ok: true, service: 'contextdrop-api' });
    }

    if (req.method === 'GET' && url.pathname === '/dev-checkout') {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(`<!doctype html><html><body style="font-family:sans-serif;padding:2rem">
        <h1>ContextDrop checkout (dev)</h1>
        <p>Plan: <code>${url.searchParams.get('plan')}</code></p>
        <p>Use demo license keys in the extension Options page:</p>
        <ul>
          <li><code>cd_live_demo_pro</code></li>
          <li><code>cd_live_demo_team</code></li>
        </ul>
      </body></html>`);
      return;
    }

    if (req.method === 'POST' && url.pathname === '/v1/license/verify') {
      const body = await readBody(req);
      const license = licenses.get(String(body.licenseKey || ''));
      if (!license || new Date(license.expiresAt).getTime() < Date.now()) {
        return json(res, 200, { valid: false, tier: 'free', message: 'Invalid or expired' });
      }
      return json(res, 200, {
        valid: true,
        tier: license.tier,
        email: license.email,
        expiresAt: license.expiresAt,
        seats: license.seats || [],
      });
    }

    if (req.method === 'POST' && url.pathname === '/v1/billing/checkout') {
      const body = await readBody(req);
      const plan = body.plan || 'pro_monthly';
      const checkoutUrl = await createStripeCheckout(plan);
      return json(res, 200, { url: checkoutUrl });
    }

    if (req.method === 'POST' && url.pathname === '/v1/billing/webhook') {
      // Production: verify Stripe signature, create license key, email user.
      const body = await readBody(req);
      const key = `cd_live_${randomUUID().replace(/-/g, '').slice(0, 16)}`;
      licenses.set(key, {
        key,
        tier: body.tier === 'team' ? 'team' : 'pro',
        email: body.email || 'user@example.com',
        expiresAt: new Date(Date.now() + 31 * 864e5).toISOString(),
        seats:
          body.tier === 'team'
            ? [{ id: '1', email: body.email || 'user@example.com', role: 'owner' }]
            : undefined,
      });
      return json(res, 200, { received: true, licenseKey: key });
    }

    if (req.method === 'POST' && url.pathname === '/v1/sync/packs') {
      const license = authLicense(req);
      if (!license) return json(res, 401, { error: 'Unauthorized' });
      const body = await readBody(req);
      const incoming = Array.isArray(body.packs) ? body.packs : [];
      const existing = packsByLicense.get(license.key) || [];
      const byId = new Map(existing.map((p) => [p.id, p]));
      for (const p of incoming) byId.set(p.id, p);
      const merged = [...byId.values()];
      packsByLicense.set(license.key, merged);
      return json(res, 200, { syncedIds: incoming.map((p) => p.id) });
    }

    if (req.method === 'GET' && url.pathname === '/v1/sync/packs') {
      const license = authLicense(req);
      if (!license) return json(res, 401, { error: 'Unauthorized' });
      return json(res, 200, { packs: packsByLicense.get(license.key) || [] });
    }

    if (req.method === 'GET' && url.pathname === '/v1/teams/seats') {
      const license = authLicense(req);
      if (!license) return json(res, 401, { error: 'Unauthorized' });
      if (license.tier !== 'team') return json(res, 403, { error: 'Team plan required' });
      return json(res, 200, { seats: license.seats || [] });
    }

    // MCP-compatible tool discovery + pack fetch for agents
    if (req.method === 'GET' && url.pathname === '/v1/mcp/tools') {
      return json(res, 200, {
        tools: [
          {
            name: 'list_context_packs',
            description: 'List synced ContextDrop prompt packs for the authenticated user',
            inputSchema: { type: 'object', properties: {} },
          },
          {
            name: 'get_context_pack',
            description: 'Fetch one ContextDrop pack by id',
            inputSchema: {
              type: 'object',
              properties: { id: { type: 'string' } },
              required: ['id'],
            },
          },
        ],
      });
    }

    if (req.method === 'GET' && url.pathname === '/v1/mcp/packs') {
      const license = authLicense(req);
      if (!license) return json(res, 401, { error: 'Unauthorized' });
      return json(res, 200, { packs: packsByLicense.get(license.key) || [] });
    }

    if (req.method === 'POST' && url.pathname === '/v1/mcp/call') {
      const license = authLicense(req);
      if (!license) return json(res, 401, { error: 'Unauthorized' });
      const body = await readBody(req);
      const packs = packsByLicense.get(license.key) || [];
      if (body.name === 'list_context_packs') {
        return json(res, 200, {
          content: packs.map((p) => ({ id: p.id, title: p.title, url: p.url })),
        });
      }
      if (body.name === 'get_context_pack') {
        const pack = packs.find((p) => p.id === body.arguments?.id);
        return json(res, 200, { content: pack || null });
      }
      return json(res, 400, { error: 'Unknown tool' });
    }

    return json(res, 404, { error: 'Not found' });
  } catch (err) {
    console.error(err);
    return json(res, 500, { error: String(err?.message || err) });
  }
});

export { server, licenses, packsByLicense };

// Tests set CONTEXTDROP_LISTEN=0 before importing this module.
if (process.env.CONTEXTDROP_LISTEN !== '0') {
  server.listen(PORT, () => {
    console.log(`ContextDrop API on http://localhost:${PORT}`);
  });
}

