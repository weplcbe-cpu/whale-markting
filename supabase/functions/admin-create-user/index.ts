// Supabase Edge Function: admin-create-user
//
// Securely creates a Supabase Auth user (email + password) plus a matching
// `profiles` row, so an Admin can provision new employee logins from the
// User Management screen without ever exposing the service_role key to
// the browser. The service_role key exists ONLY inside this function.
//
// Deploy with the Supabase CLI:
//   supabase functions deploy admin-create-user
//
// Required secrets (usually auto-injected by the Supabase platform, but set
// explicitly if `SERVER_MISCONFIGURED` errors occur):
//   supabase secrets set SUPABASE_URL=<project-url> SUPABASE_SERVICE_ROLE_KEY=<service-role-key>
//
// Optional secret to lock CORS down to your real production domain:
//   supabase secrets set ALLOWED_ORIGIN=https://your-production-domain.com
// (http://localhost:5173 is always allowed for local development.)

import { createClient } from 'jsr:@supabase/supabase-js@2';

const DEFAULT_ALLOWED_ORIGINS = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'https://kaiserwhalemarketing.vercel.app',
  'https://whale-marketing.vercel.app',
];

function buildCorsHeaders(req) {
  const origin = req.headers.get('Origin') ?? '';
  const configuredOrigins = (Deno.env.get('ALLOWED_ORIGINS') || Deno.env.get('ALLOWED_ORIGIN') || '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
  const allowedOrigins = [...new Set([...DEFAULT_ALLOWED_ORIGINS, ...configuredOrigins])];
  const allowOrigin = allowedOrigins.includes(origin) ? origin : DEFAULT_ALLOWED_ORIGINS[0];

  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    Vary: 'Origin',
  };
}

function jsonResponse(body, status, corsHeaders) {
  if (status >= 400) {
    console.error('admin-create-user response:', JSON.stringify({ status, body }));
  }
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

const VALID_ROLES = ['Admin', 'Director', 'Marketing'];

// Accepts common variants ('Marketing', 'marketing team', etc.) and maps
// them to the exact value the `profiles.role` check constraint requires.
function normalizeRole(role) {
  if (!role || typeof role !== 'string') return null;
  const trimmed = role.trim().toLowerCase();
  if (trimmed === 'admin') return 'Admin';
  if (trimmed === 'director') return 'Director';
  if (trimmed === 'marketing' || trimmed === 'marketing team') return 'Marketing';
  const exact = VALID_ROLES.find((r) => r.toLowerCase() === trimmed);
  return exact ?? null;
}

Deno.serve(async (req) => {
  let corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    Vary: 'Origin',
  };

  try {
    corsHeaders = buildCorsHeaders(req);

    if (req.method === 'OPTIONS') {
      return jsonResponse({ success: true }, 200, corsHeaders);
    }

    if (req.method !== 'POST') {
      return jsonResponse({ success: false, error: 'Method not allowed', code: 'METHOD_NOT_ALLOWED' }, 405, corsHeaders);
    }

    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return jsonResponse({ success: false, error: 'Missing or invalid Authorization header', code: 'UNAUTHENTICATED' }, 401, corsHeaders);
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !anonKey || !serviceRoleKey) {
      console.error('admin-create-user: missing SUPABASE_URL / SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY env vars');
      return jsonResponse({ success: false, error: 'Server is not configured correctly. Contact Admin.', code: 'SERVER_MISCONFIGURED' }, 500, corsHeaders);
    }

    // Client scoped to the caller's JWT — used only to verify who is calling.
    const supabaseUser = createClient(supabaseUrl, anonKey, {
      global: {
        headers: {
          Authorization: authHeader,
        },
      },
    });

    const { data: { user }, error: userError } = await supabaseUser.auth.getUser();
    if (userError || !user) {
      return jsonResponse({ success: false, error: 'Your session has expired. Please log in again.', code: 'UNAUTHENTICATED' }, 401, corsHeaders);
    }

    // Never trust a role claimed by the frontend — always re-check the
    // caller's real role/status from the database.
    const { data: callerProfile, error: callerProfileErr } = await supabaseUser
      .from('profiles')
      .select('role, status')
      .eq('id', user.id)
      .single();

    if (callerProfileErr || !callerProfile) {
      return jsonResponse({ success: false, error: 'No profile found for your account.', code: 'FORBIDDEN' }, 403, corsHeaders);
    }
    if (callerProfile.role !== 'Admin' || callerProfile.status !== 'Active') {
      return jsonResponse({ success: false, error: 'Only an active Admin can create users.', code: 'FORBIDDEN' }, 403, corsHeaders);
    }

    let body;
    try {
      body = await req.json();
    } catch {
      return jsonResponse({ success: false, error: 'Request body must be valid JSON.', code: 'INVALID_BODY' }, 400, corsHeaders);
    }

    const fullName = (body.full_name ?? '').toString().trim();
    const employeeId = (body.employee_id ?? '').toString().trim();
    const email = (body.email ?? '').toString().trim().toLowerCase();
    const mobileNumber = (body.mobile_number ?? '').toString().trim();
    const password = (body.password ?? '').toString();
    const username = (body.username ?? '').toString().trim();
    const designation = (body.designation ?? '').toString().trim();
    const role = normalizeRole(body.role);

    const missing = [];
    if (!fullName) missing.push('full_name');
    if (!employeeId) missing.push('employee_id');
    if (!mobileNumber) missing.push('mobile_number');
    if (!email) missing.push('email');
    if (!role) missing.push('role');
    if (!username) missing.push('username');
    if (!password) missing.push('password');
    if (!designation) missing.push('designation');
    if (missing.length > 0) {
      return jsonResponse(
        { success: false, error: `Missing required field(s): ${missing.join(', ')}`, code: 'VALIDATION_ERROR' },
        400,
        corsHeaders
      );
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return jsonResponse({ success: false, error: 'Please provide a valid email address.', code: 'VALIDATION_ERROR' }, 400, corsHeaders);
    }
    if (password.length < 6) {
      return jsonResponse({ success: false, error: 'Password must be at least 6 characters.', code: 'WEAK_PASSWORD' }, 400, corsHeaders);
    }
    // Admin client using the service_role key — never exposed to the browser.
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    // Reject duplicates up front for a clear, specific error message
    // (auth.admin.createUser would also reject a duplicate email, but this
    // gives a nicer error and also covers employee_id, which Auth doesn't
    // know about).
    const { data: existingByEmail, error: emailLookupErr } = await adminClient
      .from('profiles')
      .select('id')
      .ilike('email', email)
      .maybeSingle();
    if (emailLookupErr) {
      return jsonResponse({
        success: false,
        error: 'Failed to check for an existing email',
        details: emailLookupErr.message,
        code: 'DUPLICATE_CHECK_FAILED',
      }, 500, corsHeaders);
    }
    if (existingByEmail) {
      return jsonResponse({ success: false, error: `A user with email "${email}" already exists.`, code: 'DUPLICATE_EMAIL' }, 409, corsHeaders);
    }

    const { data: existingByEmployeeId, error: employeeIdLookupErr } = await adminClient
      .from('profiles')
      .select('id')
      .eq('employee_id', employeeId)
      .maybeSingle();
    if (employeeIdLookupErr) {
      return jsonResponse({
        success: false,
        error: 'Failed to check for an existing employee ID',
        details: employeeIdLookupErr.message,
        code: 'DUPLICATE_CHECK_FAILED',
      }, 500, corsHeaders);
    }
    if (existingByEmployeeId) {
      return jsonResponse({ success: false, error: `Employee ID "${employeeId}" is already in use.`, code: 'DUPLICATE_EMPLOYEE_ID' }, 409, corsHeaders);
    }

    const { data: existingByUsername, error: usernameLookupErr } = await adminClient
      .from('profiles')
      .select('id')
      .ilike('username', username)
      .maybeSingle();
    if (usernameLookupErr) {
      return jsonResponse({
        success: false,
        error: 'Failed to check for an existing username',
        details: usernameLookupErr.message,
        code: 'DUPLICATE_CHECK_FAILED',
      }, 500, corsHeaders);
    }
    if (existingByUsername) {
      return jsonResponse({ success: false, error: `Username "${username}" is already in use.`, code: 'DUPLICATE_USERNAME' }, 409, corsHeaders);
    }

    const { data: created, error: authError } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: fullName,
        employee_id: employeeId,
        username,
        role,
        mobile_number: mobileNumber,
        designation,
        profile_creation_source: 'edge_function',
      },
    });

    if (authError) {
      console.error('Auth create failed:', {
        message: authError.message,
        status: authError.status,
        code: authError.code,
        name: authError.name,
      });

      return jsonResponse({
        success: false,
        code: 'AUTH_CREATE_FAILED',
        error: authError.message,
        details: {
          status: authError.status,
          code: authError.code,
          name: authError.name,
        },
      }, authError.status || 400, corsHeaders);
    }

    if (!created?.user) {
      return jsonResponse({
        success: false,
        code: 'AUTH_CREATE_FAILED',
        error: 'Supabase Auth did not return the created user.',
      }, 400, corsHeaders);
    }

    const { error: profileErr } = await adminClient.from('profiles').insert({
      id: created.user.id,
      full_name: fullName,
      employee_id: employeeId,
      email,
      mobile_number: mobileNumber,
      role,
      status: 'Active',
      username,
      department: null,
      designation,
    });

    if (profileErr) {
      console.error('Profile insert failed:', {
        message: profileErr.message,
        code: profileErr.code,
        details: profileErr.details,
        hint: profileErr.hint,
      });
      // Roll back the auth user if the profile insert failed, so we never
      // leave an orphaned login with no profile.
      const { error: rollbackErr } = await adminClient.auth.admin.deleteUser(created.user.id);
      if (rollbackErr) {
        console.error('admin-create-user: failed to roll back orphaned auth user', created.user.id, rollbackErr);
      }
      return jsonResponse({
        success: false,
        code: 'PROFILE_INSERT_FAILED',
        error: 'Failed to create profile',
        details: profileErr.message,
      }, 400, corsHeaders);
    }

    return jsonResponse(
      {
        success: true,
        user: { id: created.user.id, email, employee_id: employeeId },
      },
      200,
      corsHeaders
    );
  } catch (err) {
    console.error('admin-create-user: unexpected error', err);
    const message = err instanceof Error ? err.message : 'Unexpected server error';
    return jsonResponse({ success: false, error: message, code: 'INTERNAL_ERROR' }, 500, corsHeaders);
  }
});
