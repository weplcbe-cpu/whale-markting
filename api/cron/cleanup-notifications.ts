const SUPABASE_CLEANUP_URL = process.env.SUPABASE_CLEANUP_URL;
const NOTIFICATION_CLEANUP_SECRET = process.env.NOTIFICATION_CLEANUP_SECRET;
const CRON_SECRET = process.env.CRON_SECRET;

const sendJson = (res, status, body) => {
  res.status(status).setHeader('Content-Type', 'application/json');
  res.send(JSON.stringify(body));
};

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return sendJson(res, 405, { success: false, error: 'METHOD_NOT_ALLOWED' });
  }

  if (!SUPABASE_CLEANUP_URL || !NOTIFICATION_CLEANUP_SECRET || !CRON_SECRET) {
    return sendJson(res, 500, { success: false, error: 'MISSING_SERVER_CONFIGURATION' });
  }

  const authHeader = req.headers.authorization || '';
  if (authHeader !== `Bearer ${CRON_SECRET}`) {
    return sendJson(res, 401, { success: false, error: 'UNAUTHORIZED' });
  }

  try {
    const upstream = await fetch(SUPABASE_CLEANUP_URL, {
      method: 'POST',
      headers: {
        'x-cleanup-secret': NOTIFICATION_CLEANUP_SECRET,
      },
    });

    const payload = await upstream.json().catch(() => ({}));
    if (!upstream.ok) {
      console.error('cleanup-expired-notifications upstream failure', {
        status: upstream.status,
        payload,
      });
      return sendJson(res, 502, {
        success: false,
        error: 'UPSTREAM_CLEANUP_FAILED',
        upstreamStatus: upstream.status,
        upstreamPayload: payload,
      });
    }

    console.log('cleanup-expired-notifications success', payload);
    return sendJson(res, 200, {
      success: true,
      source: 'vercel-cron',
      upstreamPayload: payload,
      executedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('cleanup-expired-notifications request error', error);
    return sendJson(res, 500, {
      success: false,
      error: 'CLEANUP_REQUEST_FAILED',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
