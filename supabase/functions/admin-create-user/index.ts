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
// Optional secret to extend the strict CORS allowlist:
//   supabase secrets set APP_ALLOWED_ORIGINS=https://your-production-domain.com
// (http://localhost:5173 is always allowed for local development.)

import { createClient } from 'jsr:@supabase/supabase-js@2';

const DEFAULT_ALLOWED_ORIGINS = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'https://localhost',
  'https://kaiserwhalemarkting.vercel.app',
];

function configuredAllowedOrigins() {
  const configuredOrigins = (Deno.env.get('APP_ALLOWED_ORIGINS') || '')
    .split(',')
    .map((value) => value.trim())
    .filter((value) => {
      try {
        const parsed = new URL(value);
        return parsed.origin === value && (parsed.protocol === 'https:' || value.startsWith('http://localhost:') || value.startsWith('http://127.0.0.1:'));
      } catch {
        return false;
      }
    });
  return new Set([...DEFAULT_ALLOWED_ORIGINS, ...configuredOrigins]);
}

function getCorsHeaders(req) {
  const origin = req.headers.get('Origin') ?? '';
  const headers: Record<string, string> = {
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
  if (configuredAllowedOrigins().has(origin)) {
    headers['Access-Control-Allow-Origin'] = origin;
  }
  return headers;
}

function jsonResponse(body, status, corsHeaders) {
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
  const requestId = crypto.randomUUID();
  const origin = req.headers.get('Origin') ?? '';
  const corsHeaders = getCorsHeaders(req);
  const log = (stage, status, code, context = {}) => console.log(JSON.stringify({
    requestId,
    origin,
    stage,
    status,
    code,
    ...context,
  }));

  try {
    if (origin && !configuredAllowedOrigins().has(origin)) {
      log('origin_check', 403, 'ORIGIN_NOT_ALLOWED');
      return jsonResponse({ success: false, code: 'ORIGIN_NOT_ALLOWED', error: 'This application origin is not allowed.' }, 403, corsHeaders);
    }

    if (req.method === 'OPTIONS') {
      log('preflight', 204, 'PREFLIGHT_OK');
      return new Response(null, { status: 204, headers: corsHeaders });
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
      log('jwt_validation', 401, 'UNAUTHENTICATED');
      return jsonResponse({ success: false, error: 'Your session has expired. Please log in again.', code: 'UNAUTHENTICATED' }, 401, corsHeaders);
    }

    // Never trust a role claimed by the frontend — always re-check the
    // caller's real role/status from the database.
    const { data: callerProfile, error: callerProfileErr } = await supabaseUser
      .from('profiles')
      .select('employee_id, role, status')
      .eq('id', user.id)
      .single();

    if (callerProfileErr || !callerProfile) {
      log('admin_authorization', 403, 'FORBIDDEN', { callerUserId: user.id });
      return jsonResponse({ success: false, error: 'No profile found for your account.', code: 'FORBIDDEN' }, 403, corsHeaders);
    }
    if (callerProfile.role !== 'Admin' || callerProfile.status !== 'Active') {
      log('admin_authorization', 403, 'FORBIDDEN', { callerUserId: user.id, callerEmployeeId: callerProfile.employee_id, callerRole: callerProfile.role, callerStatus: callerProfile.status });
      return jsonResponse({ success: false, error: 'Only an active Admin can create users.', code: 'FORBIDDEN' }, 403, corsHeaders);
    }

    let body;
    try {
      body = await req.json();
    } catch {
      return jsonResponse({ success: false, error: 'Request body must be valid JSON.', code: 'INVALID_BODY' }, 400, corsHeaders);
    }

    const fullName = (body.employeeName ?? body.full_name ?? '').toString().trim();
    const employeeId = (body.employeeId ?? body.employee_id ?? '').toString().trim();
    const email = (body.email ?? '').toString().trim().toLowerCase();
    const mobileNumber = (body.mobileNumber ?? body.mobile_number ?? '').toString().trim();
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
    if (missing.length > 0) {
      return jsonResponse(
        { success: false, error: `Missing required field(s): ${missing.join(', ')}`, code: 'INVALID_REQUEST' },
        400,
        corsHeaders
      );
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return jsonResponse({ success: false, error: 'Please provide a valid email address.', code: 'INVALID_REQUEST' }, 400, corsHeaders);
    }
    if (password.length < 6) {
      return jsonResponse({ success: false, error: 'Password must be at least 6 characters.', code: 'INVALID_REQUEST' }, 400, corsHeaders);
    }
    if (!/^\+?[0-9][0-9\s-]{6,19}$/.test(mobileNumber)) {
      return jsonResponse({ success: false, error: 'Please provide a valid mobile number.', code: 'INVALID_REQUEST' }, 400, corsHeaders);
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
      log('duplicate_check', 409, 'EMAIL_ALREADY_EXISTS', { callerUserId: user.id, requestedEmployeeId: employeeId, requestedRole: role });
      return jsonResponse({ success: false, error: 'This email address is already registered.', code: 'EMAIL_ALREADY_EXISTS' }, 409, corsHeaders);
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
      log('duplicate_check', 409, 'EMPLOYEE_ID_ALREADY_EXISTS', { callerUserId: user.id, requestedEmployeeId: employeeId, requestedRole: role });
      return jsonResponse({ success: false, error: 'This employee ID already exists.', code: 'EMPLOYEE_ID_ALREADY_EXISTS' }, 409, corsHeaders);
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
      log('duplicate_check', 409, 'USERNAME_ALREADY_EXISTS', { callerUserId: user.id, requestedEmployeeId: employeeId, requestedRole: role });
      return jsonResponse({ success: false, error: 'This username already exists.', code: 'USERNAME_ALREADY_EXISTS' }, 409, corsHeaders);
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

      const authDuplicateEmail = /already registered|already exists|email_exists|user_already_exists/i.test(`${authError.code || ''} ${authError.message || ''}`);
      if (authDuplicateEmail) {
        log('auth_create', 409, 'EMAIL_ALREADY_EXISTS', { callerUserId: user.id, requestedEmployeeId: employeeId, requestedRole: role });
        return jsonResponse({
          success: false,
          code: 'EMAIL_ALREADY_EXISTS',
          error: 'This email address is already registered.',
        }, 409, corsHeaders);
      }

      log('auth_create', authError.status || 400, 'AUTH_CREATE_FAILED', { callerUserId: user.id, requestedEmployeeId: employeeId, requestedRole: role });
      return jsonResponse({
        success: false,
        code: 'AUTH_CREATE_FAILED',
        error: 'Login account creation failed.',
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
        console.error('admin-create-user rollback failed:', {
          requestId,
          stage: 'auth_rollback',
          createdUserId: created.user.id,
          code: rollbackErr.code,
          status: rollbackErr.status,
          message: rollbackErr.message,
        });
      }
      return jsonResponse({
        success: false,
        code: 'PROFILE_CREATE_FAILED',
        error: 'Employee profile creation failed. The login account was rolled back.',
      }, 400, corsHeaders);
    }

    log('complete', 200, 'USER_CREATED', { callerUserId: user.id, callerEmployeeId: callerProfile.employee_id, requestedEmployeeId: employeeId, requestedRole: role });
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
