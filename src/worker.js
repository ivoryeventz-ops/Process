// Ivory Hub push worker.
// - Serves the hub site (public/) as before; only /api/* reaches this code.
// - Keeps each phone's push subscription in KV (binding SUBS).
// - Every morning (cron) asks the Apps Script app what is due and sends one digest notification.
// Secrets/vars (Cloudflare dashboard): PUSH_KEY (secret). In wrangler.jsonc: APPS_SCRIPT_URL, VAPID_SUBJECT.

const enc = new TextEncoder();

/* ---------- small helpers ---------- */

const b64u = (buf) => {
  const b = new Uint8Array(buf);
  let s = '';
  for (let i = 0; i < b.length; i++) s += String.fromCharCode(b[i]);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};
const unb64u = (s) => {
  s = String(s).replace(/-/g, '+').replace(/_/g, '/');
  while (s.length % 4) s += '=';
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
};
const concat = (...arrs) => {
  const out = new Uint8Array(arrs.reduce((n, a) => n + a.length, 0));
  let o = 0;
  arrs.forEach((a) => { out.set(a, o); o += a.length; });
  return out;
};
const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });

const sha256hex = async (s) =>
  [...new Uint8Array(await crypto.subtle.digest('SHA-256', enc.encode(s)))].map((x) => x.toString(16).padStart(2, '0')).join('');

function sameKey(a, b) {
  a = String(a || ''); b = String(b || '');
  if (!a || a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

/* ---------- VAPID keys (made once, kept in KV, so there is nothing to paste) ---------- */

async function vapidKeys(env) {
  const saved = await env.SUBS.get('vapid', 'json');
  if (saved) return saved;
  const kp = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
  const keys = {
    pub: b64u(await crypto.subtle.exportKey('raw', kp.publicKey)),
    priv: await crypto.subtle.exportKey('jwk', kp.privateKey),
  };
  await env.SUBS.put('vapid', JSON.stringify(keys));
  return keys;
}

async function vapidHeader(env, endpoint) {
  const keys = await vapidKeys(env);
  const aud = new URL(endpoint).origin;
  const head = b64u(enc.encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })));
  const body = b64u(enc.encode(JSON.stringify({
    aud,
    exp: Math.floor(Date.now() / 1000) + 12 * 3600,
    sub: env.VAPID_SUBJECT || 'https://ivory-events.pages.dev',
  })));
  const key = await crypto.subtle.importKey('jwk', keys.priv, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, enc.encode(head + '.' + body));
  return 'vapid t=' + head + '.' + body + '.' + b64u(sig) + ', k=' + keys.pub;
}

/* ---------- Web Push payload encryption (RFC 8291, aes128gcm) ---------- */

async function hkdf(salt, ikm, info, bytes) {
  const k = await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits']);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt, info }, k, bytes * 8));
}

export async function encryptPayload(sub, plaintext) {
  const uaPub = unb64u(sub.keys.p256dh);   // 65 bytes
  const auth = unb64u(sub.keys.auth);      // 16 bytes
  const eph = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
  const asPub = new Uint8Array(await crypto.subtle.exportKey('raw', eph.publicKey));
  const uaKey = await crypto.subtle.importKey('raw', uaPub, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const shared = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: uaKey }, eph.privateKey, 256));

  const ikm = await hkdf(auth, shared, concat(enc.encode('WebPush: info\0'), uaPub, asPub), 32);
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const cek = await hkdf(salt, ikm, enc.encode('Content-Encoding: aes128gcm\0'), 16);
  const nonce = await hkdf(salt, ikm, enc.encode('Content-Encoding: nonce\0'), 12);

  const aes = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['encrypt']);
  const data = concat(enc.encode(plaintext), new Uint8Array([2]));   // 0x02 = last (only) record
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, aes, data));

  const rs = new Uint8Array([0, 0, 0x10, 0]);   // record size 4096
  return concat(salt, rs, new Uint8Array([asPub.length]), asPub, ct);
}

/* ---------- sending ---------- */

// Returns 'ok', 'gone' (subscription no longer valid) or 'fail'.
async function sendOne(env, sub, payloadObj) {
  const body = await encryptPayload(sub, JSON.stringify(payloadObj));
  const res = await fetch(sub.endpoint, {
    method: 'POST',
    headers: {
      Authorization: await vapidHeader(env, sub.endpoint),
      'Content-Encoding': 'aes128gcm',
      'Content-Type': 'application/octet-stream',
      TTL: '86400',
      Urgency: 'normal',
    },
    body,
  });
  if (res.status === 404 || res.status === 410) return 'gone';
  return res.ok ? 'ok' : 'fail';
}

async function allSubs(env) {
  const out = [];
  let cursor;
  do {
    const page = await env.SUBS.list({ prefix: 'sub:', cursor });
    for (const k of page.keys) {
      const v = await env.SUBS.get(k.name, 'json');
      if (v && v.sub) out.push({ id: k.name, ...v });
    }
    cursor = page.list_complete ? undefined : page.cursor;
  } while (cursor);
  return out;
}

async function sendToAll(env, payloadObj) {
  const subs = await allSubs(env);
  let ok = 0, failed = 0, removed = 0;
  for (const s of subs) {
    try {
      const r = await sendOne(env, s.sub, payloadObj);
      if (r === 'ok') ok++;
      else if (r === 'gone') { await env.SUBS.delete(s.id); removed++; }
      else failed++;
    } catch (e) { failed++; }
  }
  return { devices: subs.length, ok, failed, removed };
}

/* ---------- the morning digest ---------- */

async function runDigest(env) {
  if (!env.APPS_SCRIPT_URL || !env.PUSH_KEY) return { error: 'APPS_SCRIPT_URL or PUSH_KEY missing' };
  const res = await fetch(env.APPS_SCRIPT_URL + '?push=due&key=' + encodeURIComponent(env.PUSH_KEY), { redirect: 'follow' });
  let due;
  try { due = await res.json(); } catch (e) { return { error: 'Apps Script did not return JSON (is the new Code.gs deployed?)' }; }
  if (!due || due.error) return { error: (due && due.error) || 'Apps Script error' };
  if (!due.count) return { sent: false, reason: 'nothing due' };
  const out = await sendToAll(env, { title: due.title, body: due.body, tag: 'ivory-digest', url: './' });
  return { sent: true, count: due.count, ...out };
}

/* ---------- routes ---------- */

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    if (!url.pathname.startsWith('/api/')) return env.ASSETS.fetch(req);

    try {
      if (url.pathname === '/api/vapid' && req.method === 'GET') {
        return json({ key: (await vapidKeys(env)).pub });
      }
      if (req.method !== 'POST') return json({ error: 'POST only' }, 405);
      const p = await req.json().catch(() => ({}));
      if (!env.PUSH_KEY) return json({ error: 'PUSH_KEY is not set on the Worker yet' }, 500);
      if (!sameKey(p.key, env.PUSH_KEY)) return json({ error: 'Wrong notification key' }, 401);

      if (url.pathname === '/api/subscribe') {
        const s = p.sub;
        if (!s || !s.endpoint || !s.keys || !s.keys.p256dh || !s.keys.auth) return json({ error: 'Bad subscription' }, 400);
        if (!/^https:\/\//.test(s.endpoint)) return json({ error: 'Bad endpoint' }, 400);
        const id = 'sub:' + (await sha256hex(s.endpoint));
        await env.SUBS.put(id, JSON.stringify({ sub: s, who: String(p.who || '').slice(0, 40), at: new Date().toISOString() }));
        const r = p.quiet ? 'skipped' : await sendOne(env, s, { title: 'Ivory reminders are on', body: 'You will get a morning note when something is due.', tag: 'ivory-welcome', url: './' });
        return json({ ok: true, welcome: r });
      }
      if (url.pathname === '/api/unsubscribe') {
        const s = p.sub;
        if (s && s.endpoint) await env.SUBS.delete('sub:' + (await sha256hex(s.endpoint)));
        return json({ ok: true });
      }
      if (url.pathname === '/api/test') {
        return json(await sendToAll(env, { title: 'Ivory test', body: 'Push notifications are working.', tag: 'ivory-test', url: './' }));
      }
      if (url.pathname === '/api/run') {
        return json(await runDigest(env));   // same as the morning job, on demand
      }
      return json({ error: 'Not found' }, 404);
    } catch (e) {
      return json({ error: String((e && e.message) || e) }, 500);
    }
  },

  async scheduled(event, env, ctx) {
    ctx.waitUntil(runDigest(env));
  },
};
