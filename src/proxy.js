import { chooseUpstreams } from './upstream.js';

const HOP_BY_HOP_HEADERS = [
  'connection',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade',
  'host'
];

const RESPONSE_BLOCKED_HEADERS = ['cf-cache-status', 'cf-ray', 'server'];
const MAX_RETRIES = 3;
const DEFAULT_REQUEST_TIMEOUT_MS = 10000;

function isWebSocketRequest(request) {
  return request.headers.get('Upgrade')?.toLowerCase() === 'websocket';
}

function copyHeaders(headers, blocked = []) {
  const output = new Headers();

  for (const [key, value] of headers.entries()) {
    if (blocked.includes(key.toLowerCase())) {
      continue;
    }

    output.set(key, value);
  }

  return output;
}

function buildForwardedHeaders(request, upstream) {
  const headers = copyHeaders(request.headers, HOP_BY_HOP_HEADERS);
  const clientUrl = new URL(request.url);
  const upstreamUrl = new URL(upstream);

  headers.set('Host', upstreamUrl.host);
  headers.set('X-Forwarded-Host', clientUrl.host);
  headers.set('X-Forwarded-Proto', clientUrl.protocol.replace(':', ''));
  headers.set('X-Forwarded-For', request.headers.get('CF-Connecting-IP') || '0.0.0.0');

  if (isWebSocketRequest(request)) {
    headers.set('Connection', 'Upgrade');
    headers.set('Upgrade', 'websocket');
  }

  return headers;
}

function createTargetUrl(request, upstream) {
  const clientUrl = new URL(request.url);
  const targetUrl = new URL(upstream);

  targetUrl.pathname = clientUrl.pathname;
  targetUrl.search = clientUrl.search;

  return targetUrl;
}

function withTimeout(promise, timeoutMs) {
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      setTimeout(() => reject(new Error(`Timeout after ${timeoutMs}ms`)), timeoutMs);
    })
  ]);
}

function shouldRetry(response, error) {
  if (error) {
    return true;
  }

  return Boolean(response) && response.status >= 500;
}

function getRequestTimeoutMs(env) {
  const value = Number(env.REQUEST_TIMEOUT_MS);
  return Number.isFinite(value) && value > 0 ? value : DEFAULT_REQUEST_TIMEOUT_MS;
}

function cloneRequestBody(bodyBuffer) {
  return bodyBuffer ? bodyBuffer.slice(0) : undefined;
}

async function fetchUpstream(request, upstream, init, timeoutMs) {
  const targetUrl = createTargetUrl(request, upstream).toString();
  const responsePromise = fetch(targetUrl, init);

  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    return responsePromise;
  }

  return withTimeout(responsePromise, timeoutMs);
}

function createProxyInit(request, upstream, bodyBuffer, redirectMode, allowStreamingBody = false) {
  const init = {
    method: request.method,
    headers: buildForwardedHeaders(request, upstream),
    redirect: redirectMode
  };

  if (request.method !== 'GET' && request.method !== 'HEAD') {
    if (bodyBuffer) {
      init.body = cloneRequestBody(bodyBuffer);
    } else if (allowStreamingBody && request.body) {
      init.body = request.body;
    }
  }

  return init;
}

function createResponse(response) {
  const headers = copyHeaders(response.headers, RESPONSE_BLOCKED_HEADERS);

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers
  });
}

function errorResponse(errors) {
  return new Response(
    JSON.stringify(
      {
        error: 'All upstreams failed',
        attempts: errors
      },
      null,
      2
    ),
    {
      status: 502,
      headers: {
        'content-type': 'application/json; charset=utf-8'
      }
    }
  );
}

async function handleMediaProxyRequest(request, env, orderedUpstreams) {
  const upstream = orderedUpstreams[0];

  if (!upstream) {
    throw new Error('No upstreams configured');
  }

  const init = createProxyInit(request, upstream, null, 'follow', true);
  const response = await fetchUpstream(request, upstream, init, 0);

  if (isWebSocketRequest(request)) {
    if (response.status === 101 && response.webSocket) {
      return response;
    }

    return errorResponse([{ upstream, status: response.status, error: 'WebSocket upgrade failed' }]);
  }

  return createResponse(response);
}

async function handleApiProxyRequest(request, env, orderedUpstreams) {
  const attempts = orderedUpstreams.slice(0, MAX_RETRIES);
  const errors = [];
  const bodyBuffer = request.method !== 'GET' && request.method !== 'HEAD' ? await request.arrayBuffer() : null;
  const timeoutMs = getRequestTimeoutMs(env);

  for (const upstream of attempts) {
    try {
      const init = createProxyInit(request, upstream, bodyBuffer, 'follow');
      const response = await fetchUpstream(request, upstream, init, timeoutMs);

      if (shouldRetry(response, null)) {
        errors.push({ upstream, status: response.status });
        continue;
      }

      if (isWebSocketRequest(request)) {
        if (response.status === 101 && response.webSocket) {
          return response;
        }

        errors.push({ upstream, status: response.status, error: 'WebSocket upgrade failed' });
        continue;
      }

      return createResponse(response);
    } catch (error) {
      console.error(`Proxy attempt failed for ${upstream}:`, error);
      errors.push({ upstream, error: error.message });
    }
  }

  return errorResponse(errors);
}

export async function handleProxyRequest(request, env, route) {
  const orderedUpstreams = await chooseUpstreams(env);

  if (route?.type === 'media') {
    return handleMediaProxyRequest(request, env, orderedUpstreams);
  }

  return handleApiProxyRequest(request, env, orderedUpstreams);
}
