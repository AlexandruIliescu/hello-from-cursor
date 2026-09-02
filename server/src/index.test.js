import assert from 'node:assert/strict';
import test from 'node:test';

process.env.CONTEXTDROP_LISTEN = '0';
const { licenses, packsByLicense, server } = await import('./index.js');

function listen() {
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address();
      resolve(typeof addr === 'object' && addr ? addr.port : 8787);
    });
  });
}

test('license verify + sync + mcp flow', async (t) => {
  const port = await listen();
  const base = `http://127.0.0.1:${port}`;

  t.after(() => {
    server.close();
  });

  const verify = await fetch(`${base}/v1/license/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ licenseKey: 'cd_live_demo_pro' }),
  }).then((r) => r.json());
  assert.equal(verify.valid, true);
  assert.equal(verify.tier, 'pro');

  const pack = {
    id: 'pack-1',
    title: 'Test',
    url: 'https://example.com',
    templateId: 'article',
    prompt: 'hello',
    createdAt: new Date().toISOString(),
  };

  const sync = await fetch(`${base}/v1/sync/packs`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer cd_live_demo_pro',
    },
    body: JSON.stringify({ packs: [pack] }),
  }).then((r) => r.json());
  assert.deepEqual(sync.syncedIds, ['pack-1']);
  assert.equal(packsByLicense.get('cd_live_demo_pro')?.length, 1);

  const tools = await fetch(`${base}/v1/mcp/tools`).then((r) => r.json());
  assert.ok(tools.tools.some((x) => x.name === 'list_context_packs'));

  const listed = await fetch(`${base}/v1/mcp/call`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer cd_live_demo_pro',
    },
    body: JSON.stringify({ name: 'list_context_packs', arguments: {} }),
  }).then((r) => r.json());
  assert.equal(listed.content[0].id, 'pack-1');

  assert.ok(licenses.has('cd_live_demo_team'));
});
