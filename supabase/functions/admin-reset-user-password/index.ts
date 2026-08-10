// Supabase Edge Function: admin-reset-user-password
//
// Securely updates an existing Supabase Auth user's password from the Admin
// portal. The service_role key exists ONLY inside this function.
//
// Deploy with the Supabase CLI:
//   supabase functions deploy admin-reset-user-password
//
// Required secrets:
//   supabase secrets set SUPABASE_URL=<project-url> SUPABASE_SERVICE_ROLE_KEY=<service-role-key>
//
// Optional secret to extend the strict CORS allowlist:
//   supabase secrets set APP_ALLOWED_ORIGINS=https://your-production-domain.com

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

function normalizeEmail(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
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
      return jsonResponse({ success: false, error: 'This application origin is not allowed.', code: 'ORIGIN_NOT_ALLOWED' }, 403, corsHeaders);
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
      console.error('admin-reset-user-password: missing SUPABASE_URL / SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY env vars');
      return jsonResponse({ success: false, error: 'Server is not configured correctly. Contact Admin.', code: 'SERVER_MISCONFIGURED' }, 500, corsHeaders);
    }

    const callerClient = createClient(supabaseUrl, anonKey, {
      global: {
        headers: {
          Authorization: authHeader,
        },
      },
    });

    const { data: { user }, error: userError } = await callerClient.auth.getUser();
    if (userError || !user) {
      log('jwt_validation', 401, 'UNAUTHENTICATED');
      return jsonResponse({ success: false, error: 'Your session has expired. Please log in again.', code: 'UNAUTHENTICATED' }, 401, corsHeaders);
    }

    const { data: callerProfile, error: callerProfileErr } = await callerClient
      .from('profiles')
      .select('id, employee_id, full_name, role, status')
      .eq('id', user.id)
      .single();

    if (callerProfileErr || !callerProfile) {
      log('admin_authorization', 403, 'FORBIDDEN', { callerUserId: user.id });
      return jsonResponse({ success: false, error: 'You do not have permission to reset this password.', code: 'FORBIDDEN' }, 403, corsHeaders);
    }

    if (callerProfile.role !== 'Admin' || callerProfile.status !== 'Active') {
      log('admin_authorization', 403, 'FORBIDDEN', {
        callerUserId: user.id,
        callerEmployeeId: callerProfile.employee_id,
        callerRole: callerProfile.role,
        callerStatus: callerProfile.status,
      });
      return jsonResponse({ success: false, error: 'You do not have permission to reset this password.', code: 'FORBIDDEN' }, 403, corsHeaders);
    }

    let body;
    try {
      body = await req.json();
    } catch {
      return jsonResponse({ success: false, error: 'Request body must be valid JSON.', code: 'INVALID_REQUEST' }, 400, corsHeaders);
    }

    const targetUserId = (body.targetUserId ?? body.target_user_id ?? '').toString().trim();
    const newPassword = (body.newPassword ?? body.new_password ?? '').toString();

    if (!targetUserId || !newPassword) {
      return jsonResponse({ success: false, error: 'Missing required field(s): targetUserId, newPassword', code: 'INVALID_REQUEST' }, 400, corsHeaders);
    }

    if (newPassword.length < 8) {
      return jsonResponse({ success: false, error: 'Password must contain at least 8 characters.', code: 'PASSWORD_TOO_SHORT' }, 400, corsHeaders);
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const { data: targetProfile, error: targetProfileErr } = await adminClient
      .from('profiles')
      .select('id, employee_id, full_name, email, status, role, username')
      .eq('id', targetUserId)
      .single();

    if (targetProfileErr || !targetProfile) {
      return jsonResponse({ success: false, error: 'Authentication account not found for this employee.', code: 'AUTH_ACCOUNT_NOT_FOUND' }, 404, corsHeaders);
    }

    if (targetProfile.status !== 'Active') {
      return jsonResponse({ success: false, error: 'This employee account is inactive.', code: 'TARGET_USER_INACTIVE' }, 400, corsHeaders);
    }

    const targetEmail = normalizeEmail(targetProfile.email || targetProfile.username);
    const { data: targetAuthUser, error: targetAuthErr } = await adminClient.auth.admin.getUserById(targetUserId);

    if (targetAuthErr || !targetAuthUser?.user) {
      return jsonResponse({ success: false, error: 'Authentication account not found for this employee.', code: 'AUTH_ACCOUNT_NOT_FOUND' }, 404, corsHeaders);
    }

    const authEmail = normalizeEmail(targetAuthUser.user.email);
    if (!targetEmail || !authEmail || authEmail !== targetEmail) {
      return jsonResponse({ success: false, error: 'Authentication account not found for this employee.', code: 'AUTH_ACCOUNT_NOT_FOUND' }, 404, corsHeaders);
    }

    const { data: updated, error: updateErr } = await adminClient.auth.admin.updateUserById(targetUserId, {
      password: newPassword,
    });

    if (updateErr || !updated?.user) {
      console.error('admin-reset-user-password update failed:', {
        requestId,
        targetUserId,
        code: updateErr?.code,
        status: updateErr?.status,
        message: updateErr?.message,
      });
      return jsonResponse({ success: false, error: 'Unable to update password. Please try again.', code: 'AUTH_UPDATE_FAILED' }, 400, corsHeaders);
    }

    try {
      await adminClient.from('activity_logs').insert({
        user_label: `${callerProfile.full_name || 'Admin'} (${callerProfile.employee_id})`,
        module: 'User Management',
        action: `Admin reset password for ${targetProfile.full_name || targetProfile.username || 'User'} (${targetProfile.employee_id})`,
        timestamp: new Date().toLocaleString(),
      });
    } catch (logError) {
      console.error('admin-reset-user-password audit log failed:', logError);
    }

    log('complete', 200, 'PASSWORD_UPDATED', {
      callerUserId: user.id,
      callerEmployeeId: callerProfile.employee_id,
      targetUserId,
      targetEmployeeId: targetProfile.employee_id,
    });

    return jsonResponse(
      {
        success: true,
        employeeName: targetProfile.full_name || targetProfile.username || 'Employee',
        employeeId: targetProfile.employee_id,
      },
      200,
      corsHeaders
    );
  } catch (err) {
    console.error('admin-reset-user-password: unexpected error', err);
    const message = err instanceof Error ? err.message : 'Unexpected server error';
    return jsonResponse({ success: false, error: message, code: 'INTERNAL_ERROR' }, 500, corsHeaders);
  }
});
