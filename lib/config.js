// Configuration, read from the environment.

function envOr(key, fallback) {
  const v = process.env[key];
  return v !== undefined && v !== '' ? v : fallback;
}

function detectServerless() {
  for (const key of ['VERCEL', 'AWS_LAMBDA_FUNCTION_NAME', 'FUNCTION_TARGET']) {
    if (process.env[key]) return true;
  }
  return false;
}

export function loadConfig() {
  const c = {
    databaseUrl: process.env.DATABASE_URL ?? '',
    port: envOr('PORT', '8080'),
    env: envOr('APP_ENV', process.env.VERCEL ? 'prod' : 'dev'),

    // 'db' (default, works anywhere) or 'disk'.
    mediaBackend: envOr('MEDIA_BACKEND', 'db').toLowerCase(),
    uploadDir: envOr('UPLOAD_DIR', './uploads'),

    // What gets encoded into printed QR labels. Left empty, each label mirrors
    // the host the browser used to request it — fine on a home network, wrong
    // once the app is reachable at a stable address.
    publicBaseURL: process.env.PUBLIC_BASE_URL ?? '',

    // Shared passcode gating the whole app. Empty leaves it open.
    passcode: process.env.APP_PASSCODE ?? '',

    // Bearer token for the MCP endpoint (/mcp). Empty disables the endpoint
    // entirely — an external AI is a deliberate opt-in.
    mcpToken: process.env.MCP_TOKEN ?? '',

    // Trims the connection pool and shortens startup retries. Detected from the
    // platform's own variables so a deployment needs no extra configuration.
    serverless: detectServerless(),
  };

  if (!c.databaseUrl) throw new Error('DATABASE_URL is required');
  if (c.mediaBackend !== 'db' && c.mediaBackend !== 'disk') {
    throw new Error(`MEDIA_BACKEND must be db or disk, got "${c.mediaBackend}"`);
  }
  if (c.passcode !== '' && c.passcode.length < 8) {
    throw new Error('APP_PASSCODE must be at least 8 characters');
  }
  if (c.mcpToken !== '' && c.mcpToken.length < 16) {
    throw new Error('MCP_TOKEN must be at least 16 characters');
  }
  // Vercel gives every deployment its URL but no scheme.
  if (c.publicBaseURL === '') {
    const host = process.env.VERCEL_PROJECT_PRODUCTION_URL;
    if (host) c.publicBaseURL = `https://${host}`;
  }
  return c;
}
