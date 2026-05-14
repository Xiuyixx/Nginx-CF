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
      health: [],
      adminToken: null,
      setupDone: false
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
  if (hasKV(env)) {
    const token = await env.KV.get(ADMIN_TOKEN_KEY);
    if (token) return String(token);
  }
  // 内存模式：返回内存中保存的 token
  return getMemoryState(env).adminToken || null;
}

export async function isSetupDone(env) {
  // 已通过环境变量配置 ADMIN_TOKEN，视为已初始化，跳过向导
  if (env.ADMIN_TOKEN) return true;

  if (hasKV(env)) {
    const flag = await env.KV.get(SETUP_DONE_KEY);
    return String(flag || '').toLowerCase() === 'true';
  }

  // 内存模式：检查内存中的 setupDone 标记
  return getMemoryState(env).setupDone === true;
}

export async function completeSetup(env, token) {
  const safeToken = String(token || '').trim();
  if (!safeToken) throw new Error('Admin token cannot be empty');

  if (hasKV(env)) {
    await env.KV.put(ADMIN_TOKEN_KEY, safeToken);
    await env.KV.put(SETUP_DONE_KEY, 'true');
  } else {
    // 无 KV 时存入内存（重启后丢失，但当次可用）
    console.warn('KV not bound: setup saved in memory mode (will reset on worker restart)');
    const mem = getMemoryState(env);
    mem.adminToken = safeToken;
    mem.setupDone = true;
  }
}
