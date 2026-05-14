import { getUpstreams, getHealth, setHealth } from './config.js';

const DEFAULT_HEALTH_TIMEOUT_MS = 5000;

function withTimeout(promise, timeoutMs) {
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      setTimeout(() => reject(new Error(`Timeout after ${timeoutMs}ms`)), timeoutMs);
    })
  ]);
}

function toHealthMap(records) {
  return new Map((Array.isArray(records) ? records : []).map((item) => [item.url, item]));
}

function getHealthTimeoutMs(env) {
  const value = Number(env.HEALTH_TIMEOUT_MS);
  return Number.isFinite(value) && value > 0 ? value : DEFAULT_HEALTH_TIMEOUT_MS;
}

function buildUrl(upstreamUrl, pathname) {
  const url = new URL(upstreamUrl);
  url.pathname = pathname;
  url.search = '';
  return url.toString();
}

function isHealthyStatus(status) {
  return status === 200;
}

async function fetchRootHealth(url, timeoutMs) {
  const headResponse = await withTimeout(fetch(new Request(url, { method: 'HEAD' })), timeoutMs);

  if (headResponse.status === 405) {
    return {
      response: await withTimeout(fetch(new Request(url, { method: 'GET' })), timeoutMs),
      source: '/ (GET)'
    };
  }

  return {
    response: headResponse,
    source: '/ (HEAD)'
  };
}

async function checkEmbyHealth(upstreamUrl, timeoutMs) {
  const response = await withTimeout(fetch(new Request(buildUrl(upstreamUrl, '/health'), { method: 'GET' })), timeoutMs);

  if (!isHealthyStatus(response.status)) {
    return null;
  }

  let payload = null;
  try {
    payload = await response.json();
  } catch {
    return null;
  }

  if (String(payload?.Status || '').toLowerCase() !== 'healthy') {
    return null;
  }

  return {
    healthy: true,
    status: response.status,
    details: payload
  };
}

async function checkUpstream(upstreamUrl, timeoutMs) {
  const startedAt = Date.now();
  const lastCheck = new Date().toISOString();

  try {
    const embyHealth = await checkEmbyHealth(upstreamUrl, timeoutMs);
    if (embyHealth) {
      return {
        url: upstreamUrl,
        healthy: true,
        latency: Date.now() - startedAt,
        lastCheck,
        status: embyHealth.status,
        healthStatus: embyHealth.details?.Status || 'Healthy',
        version: embyHealth.details?.Version || '',
        source: '/health'
      };
    }

    const rootUrl = buildUrl(upstreamUrl, '/');
    const { response: rootResponse, source } = await fetchRootHealth(rootUrl, timeoutMs);

    return {
      url: upstreamUrl,
      healthy: isHealthyStatus(rootResponse.status),
      latency: Date.now() - startedAt,
      lastCheck,
      status: rootResponse.status,
      source
    };
  } catch (error) {
    console.error(`Health check failed for ${upstreamUrl}:`, error);

    return {
      url: upstreamUrl,
      healthy: false,
      latency: -1,
      lastCheck,
      error: error.message,
      status: 0,
      source: '/health'
    };
  }
}

export async function runHealthChecks(env) {
  const upstreams = await getUpstreams(env);

  if (upstreams.length === 0) {
    console.warn('Health check skipped: no upstreams configured');
    await setHealth(env, []);
    return [];
  }

  const timeoutMs = getHealthTimeoutMs(env);
  const results = await Promise.all(
    upstreams.map(async (entry) => {
      const upstreamUrl = typeof entry === 'object' ? entry.url : entry;
      return checkUpstream(upstreamUrl, timeoutMs);
    })
  );

  await setHealth(env, results);
  return results;
}

export async function chooseUpstreams(env) {
  const upstreams = await getUpstreams(env);
  const health = await getHealth(env);
  const healthMap = toHealthMap(health);

  if (upstreams.length === 0) {
    throw new Error('No upstreams configured');
  }

  const ranked = upstreams
    .map((entry, index) => {
      const url = typeof entry === 'object' ? entry.url : entry;
      const item = healthMap.get(url);
      return {
        url,
        index,
        healthy: item?.healthy === true,
        hasHealth: Boolean(item),
        latency: Number.isFinite(item?.latency) && item.latency >= 0 ? item.latency : Number.POSITIVE_INFINITY
      };
    })
    .sort((a, b) => {
      if (a.healthy !== b.healthy) {
        return a.healthy ? -1 : 1;
      }

      if (a.hasHealth !== b.hasHealth) {
        return a.hasHealth ? -1 : 1;
      }

      if (a.latency !== b.latency) {
        return a.latency - b.latency;
      }

      return a.index - b.index;
    });

  return ranked.map((item) => item.url);
}
