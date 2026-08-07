import { createClient } from 'jsr:@supabase/supabase-js@2';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return json({ error: 'METHOD_NOT_ALLOWED' }, 405);
  }

  const expectedSecret = Deno.env.get('NOTIFICATION_CLEANUP_SECRET');
  if (!expectedSecret) {
    return json({ error: 'NOTIFICATION_CLEANUP_SECRET_NOT_CONFIGURED' }, 503);
  }

  const providedSecret = req.headers.get('x-cleanup-secret');
  if (!providedSecret || providedSecret !== expectedSecret) {
    return json({ error: 'UNAUTHORIZED' }, 401);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceRoleKey) {
    return json({ error: 'SERVER_MISCONFIGURED' }, 500);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await supabase.rpc('cleanup_expired_notifications');
  if (error) {
    return json({ error: 'CLEANUP_FAILED', details: error.message }, 500);
  }

  return json({ success: true, deletedCount: Number(data || 0), executedAt: new Date().toISOString() });
});
