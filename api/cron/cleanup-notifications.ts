const SUPABASE_CLEANUP_URL = process.env.SUPABASE_CLEANUP_URL;
const NOTIFICATION_CLEANUP_SECRET = process.env.NOTIFICATION_CLEANUP_SECRET;
const CRON_SECRET = process.env.CRON_SECRET;

function json(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export default async function handler(request: Request): Promise<Response> {
  if (request.method !== 'GET') {
    return json(405, { success: false, error: 'METHOD_NOT_ALLOWED' });
  }

  if (!SUPABASE_CLEANUP_URL || !NOTIFICATION_CLEANUP_SECRET || !CRON_SECRET) {
    return json(500, { success: false, error: 'MISSING_SERVER_CONFIGURATION' });
  }

  const authHeader = request.headers.get('authorization') || '';
  if (authHeader !== `Bearer ${CRON_SECRET}`) {
    return json(401, { success: false, error: 'UNAUTHORIZED' });
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
      return json(502, {
        success: false,
        error: 'UPSTREAM_CLEANUP_FAILED',
        upstreamStatus: upstream.status,
        upstreamPayload: payload,
      });
    }

    console.log('cleanup-expired-notifications success', payload);
    return json(200, {
      success: true,
      source: 'vercel-cron',
      upstreamPayload: payload,
      executedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('cleanup-expired-notifications request error', error);
    return json(500, {
      success: false,
      error: 'CLEANUP_REQUEST_FAILED',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
