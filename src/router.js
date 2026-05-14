const MEDIA_PATTERNS = [
  /^\/videos\/[^/]+\/stream/i,
  /^\/Items\/[^/]+\/Download/i,
  /^\/Audio\/[^/]+\/stream/i,
  /^\/Videos\/[^/]+\/original/i,
  /^\/LiveTv\/LiveStreamFiles\//i,
  /^\/Sync\/JobItems\/[^/]+\/File/i
];

export function isMediaRequest(request) {
  const pathname = new URL(request.url).pathname;
  return MEDIA_PATTERNS.some((pattern) => pattern.test(pathname));
}

export function classifyRequest(request) {
  return {
    type: isMediaRequest(request) ? 'media' : 'api'
  };
}
