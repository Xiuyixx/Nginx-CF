import { getAdminHTML } from './admin-ui.js';
import {
  completeSetup,
  getHealth,
  getStoredAdminToken,
  getUpstreams,
  isSetupDone,
  setUpstreams
} from './config.js';
import { handleProxyRequest } from './proxy.js';
import { runHealthChecks } from './upstream.js';

let startupChecked = false;

function json(data, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8'
    }
  });
}

function timingSafeEqual(a, b) {
  const left = String(a || '');
  const right = String(b || '');
  const maxLen = Math.max(left.length, right.length);

  let diff = left.length ^ right.length;
  for (let i = 0; i < maxLen; i += 1) {
    diff |= (left.charCodeAt(i) || 0) ^ (right.charCodeAt(i) || 0);
  }

  return diff === 0;
}

function isLocalRequest(request) {
  const clientIp = request.headers.get('CF-Connecting-IP') || '';
  return clientIp === '127.0.0.1' || clientIp === '::1';
}

async function getActiveAdminToken(env) {
  const kvToken = await getStoredAdminToken(env);
  if (kvToken) {
    return kvToken;
  }

  return String(env.ADMIN_TOKEN || '');
}

async function isAuthorized(request, env) {
  const configuredToken = await getActiveAdminToken(env);
  const incomingToken = request.headers.get('X-Admin-Token') || '';

  if (!configuredToken) {
    return isLocalRequest(request);
  }

  return timingSafeEqual(incomingToken, configuredToken);
}

function checkStartupSecurity(env) {
  if (startupChecked) {
    return;
  }

  startupChecked = true;

  if (!env.KV) {
    console.warn('[WARN] KV is not configured. Setup wizard and persistent state will not work.');
  }
}

async function handleAdmin(request, env) {
  const url = new URL(request.url);

  if (request.method === 'GET' && (url.pathname === '/_admin' || url.pathname === '/_admin/')) {
    return new Response(getAdminHTML(), {
      headers: {
        'content-type': 'text/html; charset=utf-8'
      }
    });
  }

  if (request.method === 'GET' && url.pathname === '/_admin/setup-status') {
    const setupDone = await isSetupDone(env);
    const hasEnvToken = Boolean(String(env.ADMIN_TOKEN || '').trim());
    return json({ setupDone, hasEnvToken });
  }

  if (request.method === 'POST' && url.pathname === '/_admin/setup') {
    const setupDone = await isSetupDone(env);

    if (setupDone) {
      return json({ error: 'Setup already completed' }, 409);
    }

    let payload;
    try {
      payload = await request.json();
    } catch {
      return json({ error: 'Invalid JSON body' }, 400);
    }

    const token = String(payload?.token || '').trim();
    if (token.length < 8) {
      return json({ error: 'Token must be at least 8 characters' }, 400);
    }

    try {
      await completeSetup(env, token);
      if (upstreams.length > 0) await setUpstreams(env, upstreams);
    } catch (error) {
      return json({ error: error.message }, 400);
    }

    return json({ ok: true, memoryMode: !env.KV, setupDone: true });
  }

  if (!(await isAuthorized(request, env))) {
    return json({ error: 'Unauthorized' }, 401);
  }

  if (request.method === 'GET' && url.pathname === '/_admin/status') {
    const [upstreams, health] = await Promise.all([getUpstreams(env), getHealth(env)]);
    return json({ upstreams, health, now: new Date().toISOString() });
  }

  if (request.method === 'POST' && url.pathname === '/_admin/trigger-health') {
    const health = await runHealthChecks(env);
    return json({ ok: true, health, triggeredAt: new Date().toISOString() });
  }

  if (request.method === 'POST' && url.pathname === '/_admin/upstreams') {
    let payload;

    try {
      payload = await request.json();
    } catch {
      return json({ error: 'Invalid JSON body' }, 400);
    }

    if (!Array.isArray(payload?.upstreams) || payload.upstreams.length === 0) {
      return json({ error: 'Body must include a non-empty upstreams array' }, 400);
    }

    await setUpstreams(env, payload.upstreams);
    const upstreams = await getUpstreams(env);
    return json({ ok: true, upstreams });
  }

  return json({ error: 'Not found' }, 404);
}

export default {
  async fetch(request, env, ctx) {
    checkStartupSecurity(env);

    const url = new URL(request.url);

    if (url.pathname === '/_admin' || url.pathname.startsWith('/_admin/')) {
      return handleAdmin(request, env, ctx);
    }

    try {
      return await handleProxyRequest(request, env, ctx);
    } catch (error) {
      console.error('Unhandled proxy error:', error);
      return json({ error: 'Internal Server Error', message: error.message }, 500);
    }
  },

  async scheduled(event, env, ctx) {
    ctx.waitUntil(runHealthChecks(env));
  }
};
