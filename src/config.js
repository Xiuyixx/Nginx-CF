const UPSTREAMS_KEY = 'upstreams';
const HEALTH_KEY = 'upstream_health';
const ADMIN_TOKEN_KEY = 'admin_token';
const SETUP_DONE_KEY = 'setup_done';

function parseJson(text, fallback) {
  if (!text) {
    return fallback;
  }

  try {
    return JSON.parse(text);
  } catch (error) {
    console.error('Failed to parse KV JSON:', error);
    return fallback;
  }
}

function normalizeUpstreams(list) {
  return (Array.isArray(list) ? list : [])
    .map((item) => String(item || '').trim())
    .filter(Boolean);
}

function getMemoryState(env) {
  if (!env.__MEMORY_STATE__) {
    env.__MEMORY_STATE__ = {
      upstreams: null,
      health: []
    };
  }

  return env.__MEMORY_STATE__;
}

function hasKV(env) {
  return Boolean(env?.KV && typeof env.KV.get === 'function' && typeof env.KV.put === 'function');
}

function readEnvUpstreams(env) {
  return normalizeUpstreams(String(env.UPSTREAMS || '').split(','));
}

export async function getUpstreams(env) {
  if (hasKV(env)) {
    const kvText = await env.KV.get(UPSTREAMS_KEY);
    const kvList = normalizeUpstreams(parseJson(kvText, []));

    if (kvList.length > 0) {
      return kvList;
    }
  }

  const memory = getMemoryState(env);
  if (Array.isArray(memory.upstreams) && memory.upstreams.length > 0) {
    return memory.upstreams;
  }

  return readEnvUpstreams(env);
}

export async function getHealth(env) {
  if (hasKV(env)) {
    const kvText = await env.KV.get(HEALTH_KEY);
    const data = parseJson(kvText, []);
    return Array.isArray(data) ? data : [];
  }

  const memory = getMemoryState(env);
  return Array.isArray(memory.health) ? memory.health : [];
}

export async function setHealth(env, data) {
  const safeData = Array.isArray(data) ? data : [];

  if (!hasKV(env)) {
    console.warn('KV not bound: saving health data in memory mode (will reset on restart)');
    getMemoryState(env).health = safeData;
    return;
  }

  await env.KV.put(HEALTH_KEY, JSON.stringify(safeData));
}

export async function setUpstreams(env, list) {
  const normalized = normalizeUpstreams(list);

  if (!hasKV(env)) {
    console.warn('KV not bound: saving upstreams in memory mode (will reset on restart)');
    getMemoryState(env).upstreams = normalized;
    return;
  }

  await env.KV.put(UPSTREAMS_KEY, JSON.stringify(normalized));
}

export async function getStoredAdminToken(env) {
  if (!hasKV(env)) {
    return null;
  }

  const token = await env.KV.get(ADMIN_TOKEN_KEY);
  return token ? String(token) : null;
}

export async function isSetupDone(env) {
  if (!hasKV(env)) {
    return Boolean(env.ADMIN_TOKEN);
  }

  const flag = await env.KV.get(SETUP_DONE_KEY);
  return String(flag || '').toLowerCase() === 'true';
}

export async function completeSetup(env, token) {
  if (!hasKV(env)) {
    throw new Error('KV binding is required for setup wizard');
  }

  const safeToken = String(token || '').trim();
  if (!safeToken) {
    throw new Error('Admin token cannot be empty');
  }

  await env.KV.put(ADMIN_TOKEN_KEY, safeToken);
  await env.KV.put(SETUP_DONE_KEY, 'true');
}
