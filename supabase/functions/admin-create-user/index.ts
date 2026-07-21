// Supabase Edge Function: admin-create-user
//
// Creates a real Supabase Auth user (email + password) plus a matching
// `profiles` row, so an Admin can provision new employee logins from the
// User Management screen without ever exposing the service_role key to
// the browser.
//
// Deploy with the Supabase CLI:
//   supabase functions deploy admin-create-user
//
// No manual secrets are required — SUPABASE_URL, SUPABASE_ANON_KEY and
// SUPABASE_SERVICE_ROLE_KEY are automatically available to Edge Functions.

import { createClient } from 'jsr:@supabase/supabase-js@2';

Deno.serve(async (req) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  };

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization') ?? '';

    // Client scoped to the caller's JWT — used only to verify who is calling.
    const callerClient = createClient(
      Deno.env.get('SUPABASE_URL'),
      Deno.env.get('SUPABASE_ANON_KEY'),
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user: callerUser }, error: callerErr } = await callerClient.auth.getUser();
    if (callerErr || !callerUser) {
      return new Response(JSON.stringify({ error: 'Not authenticated' }), { status: 401, headers: corsHeaders });
    }

    const { data: callerProfile } = await callerClient
      .from('profiles')
      .select('role')
      .eq('id', callerUser.id)
      .single();

    if (!callerProfile || callerProfile.role !== 'Admin') {
      return new Response(JSON.stringify({ error: 'Only Admin can create users' }), { status: 403, headers: corsHeaders });
    }

    const body = await req.json();
    const { employeeName, employeeId, mobile, email, role, username, password, department, designation } = body;

    if (!email || !password || !employeeName || !employeeId || !role) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), { status: 400, headers: corsHeaders });
    }

    // Admin client using the service_role key — never exposed to the browser.
    const adminClient = createClient(
      Deno.env.get('SUPABASE_URL'),
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'),
    );

    const { data: created, error: createErr } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    if (createErr) {
      return new Response(JSON.stringify({ error: createErr.message }), { status: 400, headers: corsHeaders });
    }

    const { error: profileErr } = await adminClient.from('profiles').insert({
      id: created.user.id,
      employee_id: employeeId,
      employee_name: employeeName,
      username: username || email,
      role,
      mobile,
      email,
      status: 'Active',
      department,
      designation,
    });

    if (profileErr) {
      // Roll back the auth user if the profile insert failed, so we don't
      // leave an orphaned login with no profile.
      await adminClient.auth.admin.deleteUser(created.user.id);
      return new Response(JSON.stringify({ error: profileErr.message }), { status: 400, headers: corsHeaders });
    }

    return new Response(JSON.stringify({ success: true, userId: created.user.id }), { status: 200, headers: corsHeaders });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message || 'Unexpected error' }), { status: 500, headers: corsHeaders });
  }
});
