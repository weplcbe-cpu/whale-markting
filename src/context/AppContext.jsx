/* oxlint-disable react/only-export-components */
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { FunctionsFetchError, FunctionsHttpError, FunctionsRelayError } from '@supabase/supabase-js';
import { supabase } from '../lib/supabaseClient';
import { rowToCamel, rowsToCamel, objToSnakeRow } from '../lib/caseMap';
import { inferPlanType, normalizePlanStatus } from '../utils/planStatus';
import { isDatabaseVisitPlanId, removeVisitPlanFromDraftCaches } from '../utils/visitPlanDraftCache';
import { normalizeDirectorFeedback, normalizeDirectorFeedbackList } from '../utils/directorFeedback';

const AppContext = createContext();
const AUTH_INITIALIZATION_TIMEOUT_MS = 10000;
const ADD_USER_FALLBACK_MESSAGE = 'Unable to create user. Please check the Edge Function logs and try again.';
const ADD_USER_ERROR_MESSAGES = {
  EMAIL_ALREADY_EXISTS: 'This email address is already registered.',
  EMPLOYEE_ID_ALREADY_EXISTS: 'This employee ID already exists.',
  USERNAME_ALREADY_EXISTS: 'This username already exists.',
  AUTH_CREATE_FAILED: 'Login account creation failed.',
  PROFILE_CREATE_FAILED: 'Employee profile creation failed. The login account was rolled back.',
  ORIGIN_NOT_ALLOWED: 'This production site is not allowed to call the user creation service.',
  FORBIDDEN: 'You do not have permission to create users.',
  UNAUTHENTICATED: 'Your session has expired. Please sign in again.',
};
const CREATE_USER_ROLE_MAP = {
  Admin: 'Admin',
  Director: 'Director',
  Marketing: 'Marketing',
  'Marketing Team': 'Marketing',
};

const UPDATE_USER_ERROR_MESSAGES = {
  UPDATE_USER_FORBIDDEN: 'You do not have permission to update this user.',
  USER_NOT_FOUND: 'The user record no longer exists.',
  INVALID_MOBILE: 'Invalid mobile number.',
  VISIT_PLACES_REQUIRED: 'Assign at least one visit place for a Marketing user.',
  VISIT_PLACES_UPDATE_FAILED: 'Failed to update assigned visit places.',
};

const inferUpdateHttpStatus = (error) => {
  if (Number.isInteger(error?.status)) return error.status;
  if (error?.code === 'PGRST301' || /jwt|session|token/i.test(error?.message || '')) return 401;
  if (error?.code === '42501' || error?.message === 'UPDATE_USER_FORBIDDEN') return 403;
  if (error?.code === '23505') return 409;
  return 400;
};

const getSafeUpdateUserMessage = (error) => {
  if (error?.code === 'PGRST301' || /jwt expired|invalid jwt|session.*expired/i.test(error?.message || '')) {
    return 'Your session has expired. Please log in again.';
  }
  if (error?.code === '42501' || error?.message === 'UPDATE_USER_FORBIDDEN') {
    return UPDATE_USER_ERROR_MESSAGES.UPDATE_USER_FORBIDDEN;
  }
  if (error?.code === '23505') {
    if (/email/i.test(error?.details || '')) return 'This email already exists.';
    if (/employee_id/i.test(error?.details || '')) return 'This employee ID already exists.';
    return 'This email or employee ID already exists.';
  }
  if (/mobile|INVALID_MOBILE/i.test(`${error?.message || ''} ${error?.details || ''}`)) {
    return UPDATE_USER_ERROR_MESSAGES.INVALID_MOBILE;
  }
  return UPDATE_USER_ERROR_MESSAGES[error?.message] || 'Unable to update this user. Please try again.';
};

const readableErrorText = (value) => {
  if (typeof value !== 'string') return null;
  const message = value.trim();
  return message && message !== '{}' ? message : null;
};

const getErrorMessage = async (error) => {
  if (!error) return ADD_USER_FALLBACK_MESSAGE;

  const directError = readableErrorText(error);
  if (directError) return directError;

  const directMessage = readableErrorText(error.message);
  const status = error.context?.status;

  try {
    if (error.context) {
      const response = typeof error.context.clone === 'function' ? error.context.clone() : error.context;
      const body = typeof response.json === 'function' ? await response.json() : response;
      const parts = [
        status ? `HTTP ${status}` : null,
        readableErrorText(body?.code),
        readableErrorText(body?.error),
        readableErrorText(body?.message),
        readableErrorText(body?.details),
      ].filter(Boolean);

      if (import.meta.env.DEV) console.error('admin-create-user Edge Function response:', { status: status ?? null, body });
      if (parts.length > 0) return parts.join(' — ');
    }
  } catch (parseError) {
    if (import.meta.env.DEV) console.error('Failed to parse Edge Function error:', parseError);
  }

  return [status ? `HTTP ${status}` : null, directMessage].filter(Boolean).join(' — ') || ADD_USER_FALLBACK_MESSAGE;
};

const getAddUserErrorMessage = async (error) => {
  if (error instanceof FunctionsFetchError) return 'Unable to connect to the user creation service. Please check the server connection and try again.';
  if (error instanceof FunctionsRelayError) return 'Network connection lost.';

  const status = error?.context?.status;
  if (error instanceof FunctionsHttpError && error.context) {
    try {
      const response = typeof error.context.clone === 'function' ? error.context.clone() : error.context;
      const body = typeof response.json === 'function' ? await response.json() : response;
      if (import.meta.env.DEV) console.error('admin-create-user HTTP response:', { status, body });
      if (ADD_USER_ERROR_MESSAGES[body?.code]) return ADD_USER_ERROR_MESSAGES[body.code];
      if (status === 401) return ADD_USER_ERROR_MESSAGES.UNAUTHENTICATED;
      if (status === 403) return ADD_USER_ERROR_MESSAGES.FORBIDDEN;
      if (body?.code === 'PROFILE_CREATE_FAILED' && /permission|policy|rls/i.test(`${body?.error || ''} ${body?.details || ''}`)) {
        return ADD_USER_ERROR_MESSAGES.FORBIDDEN;
      }
      const serverMessage = readableErrorText(body?.error) || readableErrorText(body?.message);
      if (serverMessage) return serverMessage;
    } catch (parseError) {
      if (import.meta.env.DEV) console.error('Unable to parse admin-create-user HTTP error response:', parseError);
    }
  }

  const fallbackMessage = await getErrorMessage(error);
  if (/failed to fetch|failed to send a request|networkerror|load failed/i.test(fallbackMessage)) {
    return 'Unable to connect to the user creation service. Please check the server connection and try again.';
  }
  return fallbackMessage;
};

// Canonical role values used throughout routing/permissions. Login must
// never be blocked by a harmless case difference (e.g. 'admin' vs 'Admin')
// coming from the database, so every profile's role is normalized here.
const VALID_ROLES = ['Admin', 'Director', 'Marketing Team'];
function normalizeRole(role) {
  if (!role) return null;
  if (String(role).trim().toLowerCase() === 'marketing') return 'Marketing Team';
  const match = VALID_ROLES.find(r => r.toLowerCase() === String(role).trim().toLowerCase());
  return match || role;
}
const normalizeProfileData = (profile) => ({
  ...profile,
  role: normalizeRole(profile.role),
  fullName: profile.fullName || profile.username || 'Not provided',
  employeeName: profile.fullName || profile.employeeName || profile.username || 'Not provided',
  mobileNumber: profile.mobileNumber || profile.mobile || 'Not provided',
  mobile: profile.mobileNumber || profile.mobile || 'Not provided'
});
const normalizeVisitPlan = (plan) => ({ ...plan, rawStatus: plan.rawStatus || plan.status, status: normalizePlanStatus(plan.status), planType: inferPlanType(plan), products: Array.isArray(plan.products) ? plan.products : plan.productName ? [plan.productName] : plan.products ? [plan.products] : [] });

export const AppProvider = ({ children }) => {
  // Auth / profile state
  const [currentUser, setCurrentUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authError, setAuthError] = useState(null);

  // Business data (populated from Supabase once a session is available)
  const [users, setUsers] = useState([]);
  const [products, setProducts] = useState([]);
  const [orgTypes, setOrgTypes] = useState([]);
  const [purposes, setPurposes] = useState([]);
  const [visitPlans, setVisitPlans] = useState([]);
  const [visitReports, setVisitReports] = useState([]);
  const [dailyReports, setDailyReports] = useState([]);
  const [followUps, setFollowUps] = useState([]);
  const [employeeVisitPlaces, setEmployeeVisitPlaces] = useState([]);
  const [districts, setDistricts] = useState([]);
  const [locations, setLocations] = useState([]);
  const [directorComments, setDirectorComments] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [activityLogs, setActivityLogs] = useState([]);
  const [companyInfo, setCompanyInfo] = useState(null);
  const [dataLoading, setDataLoading] = useState(false);
  const [assignedPlacesLoading, setAssignedPlacesLoading] = useState(false);
  const [dataError, setDataError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);

  const [theme, setTheme] = useState(() => localStorage.getItem('kw_vmm_theme') || 'dark');
  const [toasts, setToasts] = useState([]);
  const currentRole = currentUser ? normalizeRole(currentUser.role) : null;

  useEffect(() => {
    localStorage.setItem('kw_vmm_theme', theme);
    const isDarkTheme = theme === 'dark';
    document.documentElement.classList.toggle('dark', isDarkTheme);
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
    document.body.dataset.theme = theme;
    document.body.classList.toggle('theme-light', !isDarkTheme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => (prev === 'dark' ? 'light' : 'dark'));
  };

  // Toast Alert System
  const showToast = useCallback((message, type = 'info') => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4000);
  }, []);

  // Activity Log System — persisted to Supabase, best-effort (never blocks the UI).
  const logActivity = useCallback((action, module = 'General') => {
    if (!currentUser) return;
    const label = `${currentUser.employeeName} (${currentUser.employeeId})`;
    const timestamp = new Date().toLocaleString();
    supabase.from('activity_logs').insert({ user_label: label, module, action, timestamp })
      .then(({ error }) => { if (error) console.error('logActivity failed', error); });
    setActivityLogs(prev => [{ id: `local-${Date.now()}`, userLabel: label, module, action, timestamp }, ...prev]);
  }, [currentUser]);

  // ---------------------------------------------------------------------
  // Auth: fetch the profile (role/employee metadata) for a Supabase session
  // ---------------------------------------------------------------------
  const loadProfile = useCallback(async (authUserId) => {
    try {
      const { data, error } = await supabase.from('profiles').select('*').eq('id', authUserId).single();
      if (error) {
        // PGRST116 = "no rows found" — the profile simply doesn't exist yet,
        // which is an expected state, not an unexpected failure.
        if (error.code !== 'PGRST116') {
          console.error('Profile query failed:', error);
          throw error;
        }
        return null;
      }
      if (!data) return null;
      return normalizeProfileData(rowToCamel(data));
    } catch (err) {
      console.error('Unexpected error while loading profile:', err);
      throw err;
    }
  }, []);

  useEffect(() => {
    let isMounted = true;
    let sessionVersion = 0;
    let initializationTimer;

    const applySession = async (session, version) => {
      if (!isMounted || version !== sessionVersion) return;

      // Postgres Changes authorization is evaluated with the Realtime socket's
      // access token. Keep it aligned with the restored/refreshed Auth session.
      await supabase.realtime.setAuth(session?.access_token ?? null);

      if (!session?.user) {
        if (isMounted && version === sessionVersion) {
          setCurrentUser(null);
          setAuthError(null);
        }
        return;
      }

      const profile = await loadProfile(session.user.id);
      if (!isMounted || version !== sessionVersion) return;
      if (!profile) {
        throw new Error('No profile found for this account. Contact Admin.');
      }

      setCurrentUser(profile);
      setAuthError(null);
    };

    const initializeAuth = async () => {
      const version = ++sessionVersion;
      try {
        const timeout = new Promise((_, reject) => {
          initializationTimer = window.setTimeout(() => {
            reject(new Error('Unable to load the application. Retry or sign out.'));
          }, AUTH_INITIALIZATION_TIMEOUT_MS);
        });

        await Promise.race([
          (async () => {
            const { data, error } = await supabase.auth.getSession();
            if (error) throw error;
            await applySession(data?.session, version);
          })(),
          timeout
        ]);
      } catch (err) {
        console.error('Auth initialization failed:', err);
        sessionVersion += 1;
        if (isMounted) {
          setAuthError(err.message || 'Unable to load the application. Retry or sign out.');
        }
      } finally {
        window.clearTimeout(initializationTimer);
        if (isMounted) setAuthLoading(false);
      }
    };

    // Keep this callback synchronous. Supabase documents that awaiting another
    // client call inside onAuthStateChange can deadlock the client. Profile work
    // is deferred until after the callback returns.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'INITIAL_SESSION') return;

      supabase.realtime.setAuth(session?.access_token ?? null).catch((error) => {
        console.error('[Realtime auth] unable to update access token', error);
      });

      const version = ++sessionVersion;
      window.setTimeout(() => {
        applySession(session, version).catch((err) => {
          console.error('Auth state change handling failed:', err);
          if (isMounted && version === sessionVersion) {
            setAuthError(err.message || 'Failed to restore your session. Please try logging in again.');
            setAuthLoading(false);
          }
        });
      }, 0);
    });

    initializeAuth();

    return () => {
      isMounted = false;
      sessionVersion += 1;
      window.clearTimeout(initializationTimer);
      subscription?.unsubscribe();
    };
  }, [loadProfile]);

  // ---------------------------------------------------------------------
  // Data loading: once a user is authenticated, load all app data (RLS
  // automatically scopes each table to what that user/role is allowed to see).
  // Every query is independent (Promise.allSettled) so one failing/missing
  // table never blocks the rest of the dashboard from loading.
  // ---------------------------------------------------------------------
  const loadAllData = useCallback(async () => {
    setDataLoading(true);
    setAssignedPlacesLoading(true);
    setDataError(null);
    const assignedPlaceQueryPayload = {
      employee_id: currentUser?.role === 'Marketing Team' ? currentUser.employeeId : null,
      is_active: true,
    };
    let assignedPlaceQuery = supabase
      .from('employee_visit_places')
      .select('employee_id, place_name, is_active')
      .eq('is_active', true)
      .order('place_name', { ascending: true });
    if (assignedPlaceQueryPayload.employee_id) {
      assignedPlaceQuery = assignedPlaceQuery.eq('employee_id', assignedPlaceQueryPayload.employee_id);
    }
    if (import.meta.env.DEV) {
      console.log('Marketing assigned places currentUser.employeeId', currentUser?.employeeId);
      console.log('Marketing assigned places currentUser.id', currentUser?.id);
      console.log('Marketing assigned place query payload', assignedPlaceQueryPayload);
    }
    const locationMasterQueries = [
      ['districts', supabase.from('districts').select('id, district_name, active').order('district_name')],
      ['locations', supabase.from('locations').select('id, district_id, location_name, location_type, active, districts(id, district_name, active)').order('location_name')],
    ];
    const queries = [
      ['users', supabase.from('profiles').select('*')],
      ['products', supabase.from('products').select('*').order('display_order')],
      ['orgTypes', supabase.from('org_types').select('*').order('name')],
      ['purposes', supabase.from('purposes').select('*').order('name')],
      ['visitPlans', supabase.from('visit_plans').select('*').order('visit_date', { ascending: false })],
      ['visitReports', supabase.from('visit_reports').select('*').order('submitted_at', { ascending: false })],
      ['dailyReports', supabase.from('daily_reports').select('*').order('submitted_at', { ascending: false })],
      ['followUps', supabase.from('follow_ups').select('*').order('follow_up_date', { ascending: false })],
      ['employeeVisitPlaces', assignedPlaceQuery],
      ...locationMasterQueries,
      ['directorComments', supabase.from('director_comments').select('*').order('created_at', { ascending: false })],
      ['notifications', supabase.from('notifications').select('*').order('created_at', { ascending: false })],
      ['activityLogs', supabase.from('activity_logs').select('*').order('created_at', { ascending: false })],
      ['companyInfo', supabase.from('company_info').select('*').eq('id', 1).single()]
    ];

    const settled = await Promise.allSettled(queries.map(([, query]) => query));

    const results = {};
    settled.forEach((outcome, i) => {
      const [key] = queries[i];
      if (outcome.status === 'fulfilled') {
        const { data, error } = outcome.value;
        if (error) {
          console.error(`Failed to load "${key}":`, error);
          results[key] = null;
        } else {
          results[key] = data;
        }
      } else {
        console.error(`Failed to load "${key}":`, outcome.reason);
        results[key] = null;
      }
    });

    setUsers(rowsToCamel(results.users).map(normalizeProfileData));
    setProducts(rowsToCamel(results.products));
    setOrgTypes((results.orgTypes || []).map(r => r.name));
    setPurposes((results.purposes || []).map(r => r.name));
    setVisitPlans(rowsToCamel(results.visitPlans).map(normalizeVisitPlan));
    setVisitReports(rowsToCamel(results.visitReports));
    setDailyReports(rowsToCamel(results.dailyReports));
    setFollowUps(rowsToCamel(results.followUps));
    if (import.meta.env.DEV) console.log('Marketing assigned place returned rows', results.employeeVisitPlaces || []);
    setEmployeeVisitPlaces(rowsToCamel(results.employeeVisitPlaces));
    setAssignedPlacesLoading(false);
    setDistricts(rowsToCamel(results.districts));
    setLocations((results.locations || []).map((location) => ({
      ...rowToCamel(location),
      district: rowToCamel(location.districts),
    })));
    setDirectorComments(normalizeDirectorFeedbackList(rowsToCamel(results.directorComments)));
    setNotifications(rowsToCamel(results.notifications));
    setActivityLogs(rowsToCamel(results.activityLogs));
    setCompanyInfo(results.companyInfo ? rowToCamel(results.companyInfo) : null);
    const failed = Object.entries(results).filter(([, value]) => value === null).map(([key]) => key);
    setDataError(failed.length ? `Unable to refresh: ${failed.join(', ')}` : null);
    setLastUpdated(new Date());
    setDataLoading(false);
  }, [currentUser?.employeeId, currentUser?.id, currentUser?.role]);

  const refreshEntity = useCallback(async (table) => {
    const config = {
      profiles: [() => supabase.from('profiles').select('*'), setUsers],
      visit_plans: [() => supabase.from('visit_plans').select('*').order('visit_date', { ascending: false }), setVisitPlans],
      visit_reports: [() => supabase.from('visit_reports').select('*').order('submitted_at', { ascending: false }), setVisitReports],
      daily_reports: [() => supabase.from('daily_reports').select('*').order('submitted_at', { ascending: false }), setDailyReports],
      follow_ups: [() => supabase.from('follow_ups').select('*').order('follow_up_date', { ascending: false }), setFollowUps],
      employee_visit_places: [() => {
        let query = supabase
          .from('employee_visit_places')
          .select('employee_id, place_name, is_active')
          .eq('is_active', true)
          .order('place_name', { ascending: true });
        if (currentUser?.role === 'Marketing Team' && currentUser.employeeId) {
          query = query.eq('employee_id', currentUser.employeeId);
        }
        return query;
      }, setEmployeeVisitPlaces],
      districts: [() => supabase.from('districts').select('id, district_name, active').order('district_name'), setDistricts],
      locations: [() => supabase.from('locations').select('id, district_id, location_name, location_type, active, districts(id, district_name, active)').order('location_name'), setLocations],
      director_comments: [() => supabase.from('director_comments').select('*').order('created_at', { ascending: false }), setDirectorComments],
      notifications: [() => supabase.from('notifications').select('*').order('created_at', { ascending: false }), setNotifications],
      activity_logs: [() => supabase.from('activity_logs').select('*').order('created_at', { ascending: false }), setActivityLogs],
      company_info: [() => supabase.from('company_info').select('*').eq('id', 1), setCompanyInfo]
    };
    const entry = config[table];
    if (!entry) return;
    const [query, setter] = entry;
    if (table === 'employee_visit_places') setAssignedPlacesLoading(true);
    const { data, error } = await query();
    if (table === 'employee_visit_places') setAssignedPlacesLoading(false);
    if (error) { console.error(`Failed to refresh ${table}:`, error); setDataError(`Unable to refresh ${table.replaceAll('_', ' ')}.`); return; }
    const mapped = rowsToCamel(data);
    const normalized = table === 'profiles'
      ? mapped.map(normalizeProfileData)
      : table === 'visit_plans'
        ? mapped.map(normalizeVisitPlan)
        : table === 'director_comments'
          ? normalizeDirectorFeedbackList(mapped)
            : table === 'locations'
              ? (data || []).map((location) => ({
                ...rowToCamel(location),
                district: rowToCamel(location.districts),
              }))
          : table === 'company_info'
            ? (mapped[0] || null)
            : mapped;
    setter(normalized);
    setDataError(null);
    setLastUpdated(new Date());
    return normalized;
  }, [currentUser?.employeeId, currentUser?.role]);

  useEffect(() => {
    if (currentUser) {
      loadAllData();
    } else {
      // Logged out — clear all previously loaded data from memory.
      setUsers([]); setProducts([]); setOrgTypes([]); setPurposes([]);
      setVisitPlans([]); setVisitReports([]); setDailyReports([]);
      setFollowUps([]); setEmployeeVisitPlaces([]); setDistricts([]); setLocations([]); setDirectorComments([]); setNotifications([]);
      setAssignedPlacesLoading(false);
      setActivityLogs([]); setCompanyInfo(null);
    }
    // Depend on the user's id (not the whole object) — a token refresh
    // produces a brand new `currentUser` object reference for the same
    // person, which would otherwise re-trigger a full data reload for no
    // reason (duplicate network requests with no data change).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?.id, loadAllData]);

  useEffect(() => {
    if (!currentUser?.id) return undefined;
    // Keep this channel limited to tables that are actually in the Realtime
    // publication. visit_plans has its own isolated subscription below.
    const tables = ['director_comments', 'notifications', 'visit_reports', 'daily_reports', 'follow_ups', 'employee_visit_places'];
    const pending = new Map();
    let channel = supabase.channel(`portal-live-${currentUser.id}`);

    tables.forEach((table) => {
      channel = channel.on('postgres_changes', { event: '*', schema: 'public', table }, () => {
        window.clearTimeout(pending.get(table));
        pending.set(table, window.setTimeout(() => refreshEntity(table), 150));
      });
    });
    channel.subscribe((subscriptionStatus) => {
      if (import.meta.env.DEV) console.log('Realtime channel status', subscriptionStatus);
      if (subscriptionStatus === 'SUBSCRIBED') {
        refreshEntity('notifications');
      }
      if (subscriptionStatus === 'CHANNEL_ERROR' || subscriptionStatus === 'TIMED_OUT') {
        console.error(`Realtime subscription ${subscriptionStatus.toLowerCase()}`);
      }
    });
    return () => {
      pending.forEach((timer) => window.clearTimeout(timer));
      pending.clear();
      supabase.removeChannel(channel);
    };
  }, [currentUser?.id, refreshEntity]);

  useEffect(() => {
    if (!currentUser?.id) return undefined;

    let reconciliationTimer;
    let reconnectTimer;
    let visitPlansChannel;
    let stopped = false;
    let reconnectAttempts = 0;
    const maxReconnectAttempts = 3;
    const reconcileVisitPlans = () => {
      window.clearTimeout(reconciliationTimer);
      reconciliationTimer = window.setTimeout(() => refreshEntity('visit_plans'), 150);
    };

    const handleVisitPlanChange = (payload) => {
      const eventType = payload.eventType;
      const normalized = eventType === 'DELETE'
        ? null
        : normalizeVisitPlan(rowToCamel(payload.new));

      console.log('[Realtime visit_plans] event payload', payload);
      if (normalized) console.log('[Realtime visit_plans] normalized row', normalized);

      setVisitPlans((previous) => {
        let next = previous;
        if (eventType === 'INSERT') {
          next = [normalized, ...previous.filter((plan) => plan.id !== normalized.id)];
        } else if (eventType === 'UPDATE') {
          const exists = previous.some((plan) => plan.id === normalized.id);
          next = exists
            ? previous.map((plan) => plan.id === normalized.id ? normalized : plan)
            : [normalized, ...previous];
        } else if (eventType === 'DELETE') {
          next = previous.filter((plan) => plan.id !== payload.old?.id);
        }

        console.log('[Realtime visit_plans] state counts', {
          previous: previous.length,
          updated: next.length,
        });
        return next;
      });

      reconcileVisitPlans();
    };

    const removeVisitPlansChannel = async () => {
      if (!visitPlansChannel) return;
      const channel = visitPlansChannel;
      visitPlansChannel = undefined;
      await supabase.removeChannel(channel);
    };

    const createVisitPlansChannel = async () => {
      if (stopped) return;

      const { data, error } = await supabase.auth.getSession();
      if (error || !data?.session?.access_token) {
        console.error('[Realtime visit_plans] session unavailable', error);
        return;
      }
      await supabase.realtime.setAuth(data.session.access_token);
      if (stopped) return;

      console.log('[Realtime visit_plans] channel creating', {
        userId: currentUser.id,
        employeeId: currentUser.employeeId,
        role: currentRole,
      });

      visitPlansChannel = supabase
        .channel(`visit-plans-live:${currentUser.id}`)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'visit_plans' },
          handleVisitPlanChange
        )
        .subscribe((subscriptionStatus) => {
          console.log('[Realtime visit_plans] channel status', subscriptionStatus);
          if (subscriptionStatus === 'SUBSCRIBED') {
            reconnectAttempts = 0;
            reconcileVisitPlans();
            return;
          }
          if (subscriptionStatus === 'CHANNEL_ERROR' || subscriptionStatus === 'TIMED_OUT') {
            console.error('[Realtime visit_plans] subscription failure', {
              status: subscriptionStatus,
              attempt: reconnectAttempts + 1,
            });
            if (!stopped && reconnectAttempts < maxReconnectAttempts) {
              reconnectAttempts += 1;
              window.clearTimeout(reconnectTimer);
              reconnectTimer = window.setTimeout(async () => {
                await removeVisitPlansChannel();
                await createVisitPlansChannel();
              }, reconnectAttempts * 1000);
            }
          }
        });
    };

    createVisitPlansChannel().catch((error) => {
      console.error('[Realtime visit_plans] channel creation failed', error);
    });

    return () => {
      stopped = true;
      window.clearTimeout(reconciliationTimer);
      window.clearTimeout(reconnectTimer);
      removeVisitPlansChannel();
    };
  }, [currentUser?.employeeId, currentUser?.id, currentRole, refreshEntity]);

  // ---------------------------------------------------------------------
  // Auth actions
  // ---------------------------------------------------------------------
  const login = async (email, password) => {
    try {
      setAuthError(null);
      const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (error || !data?.user) {
        return { success: false, error: error?.message || 'Invalid email or password' };
      }

      const profile = await loadProfile(data.user.id);
      if (!profile) {
        await supabase.auth.signOut();
        return { success: false, error: 'No profile found for this account. Contact Admin.' };
      }
      if (profile.status === 'Inactive') {
        await supabase.auth.signOut();
        return { success: false, error: 'Your account is inactive. Contact Admin.' };
      }

      setCurrentUser(profile);
      showToast(`Welcome back, ${profile.employeeName}!`, 'success');
      return { success: true, role: profile.role };
    } catch (err) {
      console.error('Login failed:', err);
      return { success: false, error: err.message || 'Login failed. Please try again.' };
    }
  };

  const logout = async () => {
    if (currentUser) {
      logActivity(`User ${currentUser.employeeName} logged out`, 'Authentication');
    }
    try {
      await supabase.auth.signOut();
    } catch (err) {
      console.error('Logout failed:', err);
    } finally {
      setCurrentUser(null);
      setAuthError(null);
      setAuthLoading(false);
      showToast('Logged out successfully', 'info');
    }
  };

  // ---------------------------------------------------------------------
  // User management (Admin) — user creation/deletion require elevated
  // privileges and go through Supabase Edge Functions (service_role key
  // never reaches the browser). See supabase/functions/.
  // ---------------------------------------------------------------------
  const syncEmployeeVisitPlaces = async (employeeId, places = []) => {
    const normalizedPlaces = [...new Set(places.map((place) => String(place).trim()).filter(Boolean))];
    const { error } = await supabase.rpc('admin_replace_employee_visit_places', {
      p_employee_id: employeeId,
      p_visit_places: normalizedPlaces,
    });
    if (error) throw error;
    await refreshEntity('employee_visit_places');
  };

  const manageLocationMaster = async (action, record) => {
    const { data, error } = await supabase.rpc('admin_manage_location_master', {
      p_action: action,
      p_record: record,
    });
    if (error) throw error;
    await Promise.all([refreshEntity('districts'), refreshEntity('locations')]);
    showToast(action.startsWith('set_') ? 'Location status updated.' : 'Location master saved.', 'success');
    return data;
  };

  const addUser = async (userData) => {
    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession();

    if (import.meta.env.DEV) {
      console.log('Session exists:', Boolean(session));
      console.log('Access token exists:', Boolean(session?.access_token));
    }

    if (sessionError || !session?.access_token) {
      const message = 'Your session has expired. Please sign in again.';
      throw new Error(message);
    }

    const normalizedRole = CREATE_USER_ROLE_MAP[userData.role];
    const requestBody = {
      employeeName: userData.employeeName.trim(),
      employeeId: userData.employeeId.trim(),
      mobileNumber: userData.mobile.trim(),
      email: userData.email.trim().toLowerCase(),
      role: normalizedRole || userData.role,
      username: userData.username.trim(),
      password: userData.password,
      designation: userData.designation.trim(),
    };
    const { data, error } = await supabase.functions.invoke('admin-create-user', {
      body: requestBody
    });

    if (error) {
      if (import.meta.env.DEV) {
        console.error('admin-create-user invocation failed:', {
          code: error?.context?.status,
          name: error?.name,
          message: error?.message,
        });
      }

      const message = await getAddUserErrorMessage(error);
      throw new Error(message);
    }

    if (data?.success === false) {
      if (import.meta.env.DEV) console.error('admin-create-user application error:', { code: data?.code });
      const message = ADD_USER_ERROR_MESSAGES[data?.code] ||
        readableErrorText(data?.error) ||
        readableErrorText(data?.message) ||
        'Unable to create user.';
      throw new Error(message);
    }

    await syncEmployeeVisitPlaces(
      data?.user?.employee_id || userData.employeeId.trim(),
      normalizedRole === 'Marketing' ? userData.assignedVisitPlaces : [],
    );

    logActivity(`Added new user: ${userData.employeeName} (${userData.role})`, 'User Management');
    showToast(`User ${userData.employeeName} created successfully`, 'success');
    await loadAllData();
    return { success: true };
  };

  const updateUser = async (id, updatedFields) => {
    const { assignedVisitPlaces = [], ...profileUpdates } = updatedFields;
    const normalizedVisitPlaces = assignedVisitPlaces
      .map((place) => String(place).trim())
      .filter(Boolean)
      .filter((place, index, places) => places.findIndex(
        (candidate) => candidate.toLocaleLowerCase() === place.toLocaleLowerCase(),
      ) === index);
    const profileRow = objToSnakeRow({
      ...profileUpdates,
      role: CREATE_USER_ROLE_MAP[profileUpdates.role] || profileUpdates.role,
    });
    const payload = {
      p_user_id: id,
      p_profile: profileRow,
      p_visit_places: normalizeRole(profileUpdates.role) === 'Marketing Team' ? normalizedVisitPlaces : [],
    };
    if (import.meta.env.DEV) {
      console.log('Admin update RPC visit places payload', payload.p_visit_places);
      console.log('Admin update RPC payload', payload);
    }
    let result;
    try {
      result = await supabase.rpc('admin_update_user_with_visit_places', payload);
    } catch (error) {
      if (import.meta.env.DEV) {
        console.log('Admin update RPC result', result?.data);
        console.log('Admin update RPC error', error);
      }
      const safeMessage = getSafeUpdateUserMessage(error);
      showToast(safeMessage, 'error');
      const updateError = new Error(safeMessage);
      updateError.cause = error;
      throw updateError;
    }
    const { data, error } = result;
    if (import.meta.env.DEV) {
      console.log('Admin update RPC result', data);
      console.log('Admin update RPC error', error);
    }
    if (error || data?.success === false) {
      const rpcError = error || data;
      const httpStatus = inferUpdateHttpStatus(rpcError);
      if (import.meta.env.DEV) {
        console.error('Save User Record request failed:', {
          request: 'POST /rest/v1/rpc/admin_update_user_with_visit_places',
          step: rpcError.message === 'VISIT_PLACES_UPDATE_FAILED' ? 'employee_visit_places' : 'profiles',
          message: rpcError.message,
          code: rpcError.code,
          details: rpcError.details,
          hint: rpcError.hint,
          httpStatus,
          error: rpcError,
        });
      }
      const safeMessage = getSafeUpdateUserMessage(rpcError);
      showToast(safeMessage, 'error');
      const updateError = new Error(safeMessage);
      updateError.cause = rpcError;
      throw updateError;
    }
    setUsers(prev => prev.map(u => u.id === id ? { ...u, ...profileUpdates } : u));
    await refreshEntity('employee_visit_places');
    logActivity(`Updated user details for ID ${id}`, 'User Management');
    const successResult = { success: true };
    if (successResult.success === true) showToast('User updated successfully', 'success');
    return successResult;
  };

  const toggleUserStatus = async (id) => {
    const target = users.find(u => u.id === id);
    if (!target) return;
    const nextStatus = target.status === 'Active' ? 'Inactive' : 'Active';
    const { error } = await supabase.from('profiles').update({ status: nextStatus }).eq('id', id);
    if (error) {
      showToast('Failed to update status', 'error');
      return;
    }
    setUsers(prev => prev.map(u => u.id === id ? { ...u, status: nextStatus } : u));
    logActivity(`Changed status of ${target.employeeName} to ${nextStatus}`, 'User Management');
  };

  const deleteUser = async (id) => {
    const target = users.find(u => u.id === id);
    const { data: { session } } = await supabase.auth.getSession();
    const { data, error } = await supabase.functions.invoke('admin-delete-user', {
      body: { userId: id },
      headers: { Authorization: `Bearer ${session?.access_token}` }
    });
    if (error || data?.error) {
      showToast(data?.error || error.message || 'Failed to delete user', 'error');
      return;
    }
    setUsers(prev => prev.filter(u => u.id !== id));
    if (target) {
      logActivity(`Deleted user: ${target.employeeName} (${target.role})`, 'User Management');
      showToast(`User ${target.employeeName} deleted`, 'warning');
    }
  };

  // ---------------------------------------------------------------------
  // Products
  // ---------------------------------------------------------------------
  const addProduct = async (prodData) => {
    const { data, error } = await supabase.from('products').insert({
      name: prodData.name, code: prodData.code, category: prodData.category,
      status: 'Active', display_order: products.length + 1
    }).select().single();
    if (error) {
      showToast('Failed to add product', 'error');
      return;
    }
    setProducts(prev => [...prev, rowToCamel(data)]);
    logActivity(`Added new product: ${prodData.name}`, 'Product Management');
    showToast(`Product ${prodData.name} added`, 'success');
  };

  const toggleProductStatus = async (id) => {
    const target = products.find(p => p.id === id);
    if (!target) return;
    const next = target.status === 'Active' ? 'Disabled' : 'Active';
    const { error } = await supabase.from('products').update({ status: next }).eq('id', id);
    if (error) {
      showToast('Failed to update product', 'error');
      return;
    }
    setProducts(prev => prev.map(p => p.id === id ? { ...p, status: next } : p));
    logActivity(`Changed status of product ${target.name} to ${next}`, 'Product Management');
  };

  const updateCompanyInfo = async (updates) => {
    const { data, error } = await supabase
      .from('company_info')
      .update(objToSnakeRow(updates))
      .eq('id', 1)
      .select()
      .single();
    if (error) {
      showToast('Failed to save system settings', 'error');
      return false;
    }
    setCompanyInfo(rowToCamel(data));
    await refreshEntity('company_info');
    logActivity('Updated system settings', 'Settings');
    showToast('System settings updated successfully', 'success');
    return true;
  };

  // ---------------------------------------------------------------------
  // Visit Plans
  // ---------------------------------------------------------------------
  const addVisitPlan = async (planData) => {
    const submissionKey = planData.submissionKey || crypto.randomUUID();
    const payload = {
      visitDate: planData.visitDate,
      expectedTime: planData.expectedTime,
      destinationType: planData.destinationType,
      customerId: planData.customerId || null,
      customerName: planData.customerName || null,
      organizationName: planData.organizationName || null,
      organizationType: planData.organizationType || null,
      contactPerson: planData.contactPerson || null,
      mobileNumber: planData.mobileNumber || planData.mobile || null,
      area: planData.area,
      city: planData.city || null,
      district: planData.district || null,
      state: planData.state || null,
      visitPurpose: planData.visitPurpose,
      products: Array.isArray(planData.products) ? planData.products : [],
      requirement: planData.requirement,
      priority: planData.priority || 'Medium',
      notes: planData.notes || null
    };
    const { data, error } = await supabase.rpc('submit_marketing_visit_plan', {
      p_plan: payload,
      p_submission_key: submissionKey
    });
    if (error) {
      console.error('Visit plan submission failed:', error);
      throw new Error(error.message || 'Failed to submit visit plan.');
    }
    if (!data?.success || !data.plan) throw new Error('The database did not confirm the visit plan submission.');
    if (data.notificationError) console.error('Director visit plan notification failed:', data.notificationError);
    const saved = normalizeVisitPlan(rowToCamel(data.plan));
    setVisitPlans((previous) => {
      const next = [saved, ...previous.filter((plan) => plan.id !== saved.id)];
      if (import.meta.env.DEV) console.log('visit_plans AppContext state update', next);
      return next;
    });
    await Promise.all([refreshEntity('visit_plans'), refreshEntity('notifications')]);
    logActivity(`Submitted visit plan for ${planData.area} on ${planData.visitDate}`, 'Visit Plan');
    return saved;
  };

  const toTourPlanRow = (plan, { planType, periodFrom, periodTo, status }) => objToSnakeRow({
    employeeId: currentUser?.employeeId,
    fullName: currentUser?.fullName || currentUser?.employeeName,
    visitDate: plan.visitDate,
    expectedTime: plan.expectedTime || null,
    customerId: plan.customerId || null,
    customerName: plan.customerName || null,
    organizationType: plan.organizationType || null,
    contactPerson: plan.contactPerson || null,
    mobileNumber: plan.mobileNumber || null,
    state: plan.state || null,
    district: plan.district || plan.area || null,
    city: plan.city || plan.area || null,
    area: plan.area || null,
    fullAddress: plan.fullAddress || null,
    visitPurpose: plan.visitPurpose || null,
    products: Array.isArray(plan.products) ? plan.products : [],
    requirement: plan.requirement || null,
    priority: plan.priority || 'Medium',
    notes: plan.notes || null,
    planType,
    periodFrom,
    periodTo,
    status,
    rescheduleHistory: plan.rescheduleHistory || []
  });

  const saveTourPlanDraft = async ({ rows, planType, periodFrom, periodTo }) => {
    const editableStatuses = new Set(['Draft', 'Changes Requested']);
    const savedRows = [];
    for (const row of rows) {
      const existing = visitPlans.find((plan) => plan.id === row.id);
      const existingStatus = normalizePlanStatus(existing?.status);
      if (existing && !editableStatuses.has(existingStatus)) {
        const error = new Error('Only Draft or Changes Requested entries can be saved.');
        showToast(error.message, 'error');
        throw error;
      }
      const status = existing && editableStatuses.has(existingStatus) ? existingStatus : 'Draft';
      const payload = toTourPlanRow(row, { planType, periodFrom, periodTo, status });
      const query = existing
        ? supabase.from('visit_plans').update(payload).eq('id', existing.id)
        : supabase.from('visit_plans').insert(payload);
      const { data, error } = await query.select().single();
      if (error) {
        showToast('Unable to save the weekly plan draft. Please try again.', 'error');
        throw error;
      }
      savedRows.push(normalizeVisitPlan(rowToCamel(data)));
    }
    await refreshEntity('visit_plans');
    logActivity(`Saved ${planType.toLowerCase()} plan draft with ${savedRows.length} entries`, 'Tour Plan');
    return savedRows;
  };

  const deleteVisitPlanEntry = async (entryId) => {
    if (!isDatabaseVisitPlanId(entryId)) throw new Error('Unable to delete this visit plan.');
    const target = visitPlans.find((plan) => plan.id === entryId);
    if (!target) throw new Error('Visit entry was not found. Refresh and try again.');
    const status = normalizePlanStatus(target.status);
    const rawStatus = String(target.rawStatus || target.status || '').trim().toLowerCase();
    const legacyStatuses = new Set([
      'approved',
      'rejected',
      'changes requested',
      'pending approval',
      'submitted for director approval'
    ]);
    const deletableStatuses = new Set(['Draft', 'Submitted', 'Rescheduled', 'Cancelled']);
    const role = normalizeRole(currentUser?.role);
    if (role !== 'Marketing Team') {
      throw new Error('You do not have permission to delete this visit plan.');
    }
    if (target.employeeId !== currentUser?.employeeId) {
      throw new Error('You do not have permission to delete this visit plan.');
    }
    if (!deletableStatuses.has(status) && !legacyStatuses.has(rawStatus)) {
      throw new Error('This visit plan status cannot be deleted.');
    }
    const { data: deletedRow, error } = await supabase
      .from('visit_plans')
      .delete()
      .eq('id', entryId)
      .eq('employee_id', currentUser.employeeId)
      .select('id')
      .single();
    if (error) {
      const noRowDeleted = error.code === 'PGRST116';
      const permissionDenied = error.code === '42501' || /permission|row-level security|rls/i.test(error.message || '');
      const deleteError = new Error(permissionDenied
        ? 'You do not have permission to delete this visit plan.'
        : noRowDeleted
          ? 'Unable to delete this visit plan.'
          : 'Unable to delete this visit plan.');
      throw deleteError;
    }
    if (deletedRow?.id !== entryId) {
      const deleteError = new Error('Unable to delete this visit plan.');
      throw deleteError;
    }
    setVisitPlans((previous) => previous.filter((plan) => plan.id !== entryId));
    removeVisitPlanFromDraftCaches({
      id: entryId,
      databaseId: entryId,
      clientId: target.clientId,
      localId: target.localId,
      submissionKey: target.submissionKey,
      batchId: target.batchId,
    });
    await refreshEntity('visit_plans');
    logActivity(`Deleted visit entry ID ${entryId}`, 'Tour Plan');
    return true;
  };

  const inspectCompletedVisitDelete = async (entryId) => {
    if (!isDatabaseVisitPlanId(entryId)) throw new Error('Unable to inspect this completed visit.');
    const { data, error } = await supabase.rpc('completed_visit_delete_impact', {
      p_visit_plan_id: entryId,
    });
    if (error) {
      const safeErrors = {
        VISIT_DELETE_AUTH_REQUIRED: 'Please sign in again before deleting this visit.',
        VISIT_DELETE_PROFILE_INACTIVE: 'Your active employee profile could not be verified.',
        VISIT_DELETE_NOT_AUTHORIZED: 'You do not have permission to delete completed visits.',
        VISIT_DELETE_NOT_OWNED: 'You can only delete your own completed visits.',
        VISIT_DELETE_NOT_COMPLETED: 'Only completed visits can be deleted here.',
      };
      throw new Error(safeErrors[error.message] || 'Unable to inspect this completed visit. Please try again.');
    }
    return rowToCamel(data || {});
  };

  const getVisitReportForPlan = async (visitPlanId, directReportId = null) => {
    if (!isDatabaseVisitPlanId(visitPlanId)) throw new Error('VISIT_REPORT_INVALID_PLAN');
    let query = supabase.from('visit_reports').select('*');
    query = isDatabaseVisitPlanId(directReportId)
      ? query.or(`visit_plan_id.eq.${visitPlanId},id.eq.${directReportId}`)
      : query.eq('visit_plan_id', visitPlanId);
    const { data, error } = await query.limit(1).maybeSingle();
    if (error) {
      if (error.code === '42501' || /permission|row-level security|rls/i.test(error.message || '')) {
        throw new Error('VISIT_REPORT_ACCESS_DENIED');
      }
      throw new Error('VISIT_REPORT_LOOKUP_FAILED');
    }
    return data ? rowToCamel(data) : null;
  };

  const deleteCompletedVisit = async (entryId) => {
    if (!isDatabaseVisitPlanId(entryId)) throw new Error('Unable to delete this completed visit.');
    const target = visitPlans.find((plan) => plan.id === entryId);
    const role = normalizeRole(currentUser?.role);
    if (!target || role !== 'Marketing Team' || target.employeeId !== currentUser?.employeeId) {
      throw new Error('You can only delete your own completed visits.');
    }
    if (normalizePlanStatus(target.status) !== 'Completed') {
      throw new Error('Only completed visits can be deleted here.');
    }

    const { data, error } = await supabase.rpc('delete_completed_visit', {
      p_visit_plan_id: entryId,
    });
    if (error || data?.success !== true) {
      const safeErrors = {
        VISIT_DELETE_AUTH_REQUIRED: 'Please sign in again before deleting this visit.',
        VISIT_DELETE_PROFILE_INACTIVE: 'Your active employee profile could not be verified.',
        VISIT_DELETE_NOT_AUTHORIZED: 'You do not have permission to delete completed visits.',
        VISIT_DELETE_NOT_OWNED: 'You can only delete your own completed visits.',
        VISIT_DELETE_NOT_COMPLETED: 'Only completed visits can be deleted here.',
        VISIT_DELETE_HAS_STORED_FILES: 'This visit has stored files and cannot be safely deleted yet.',
      };
      throw new Error(safeErrors[error?.message] || 'Unable to delete this completed visit. No data was removed.');
    }

    const reportId = data.report_id;
    const notificationIds = new Set(data.notification_ids || []);
    const followUpIds = new Set(data.follow_up_ids || []);
    const commentIds = new Set(data.comment_ids || []);
    setVisitPlans((previous) => previous.filter((plan) => plan.id !== entryId));
    if (reportId) setVisitReports((previous) => previous.filter((report) => report.id !== reportId));
    if (notificationIds.size) setNotifications((previous) => previous.filter((item) => !notificationIds.has(item.id)));
    if (followUpIds.size) setFollowUps((previous) => previous.filter((item) => !followUpIds.has(item.id)));
    if (commentIds.size) setDirectorComments((previous) => previous.filter((item) => !commentIds.has(item.id)));
    removeVisitPlanFromDraftCaches({ id: entryId, databaseId: entryId });
    await Promise.all([
      refreshEntity('visit_plans'),
      refreshEntity('visit_reports'),
      refreshEntity('notifications'),
      refreshEntity('follow_ups'),
      refreshEntity('director_comments'),
    ]);
    return data;
  };

  const updateEditableVisitPlan = async (entryId, updates) => {
    const target = visitPlans.find((plan) => plan.id === entryId);
    if (!target) throw new Error('Visit plan not found.');
    const status = normalizePlanStatus(target.status);
    if (!['Draft', 'Rejected', 'Changes Requested'].includes(status)) {
      throw new Error('This visit plan can no longer be edited.');
    }
    if (target.employeeId !== currentUser?.employeeId) {
      throw new Error('You can only edit your own visit plans.');
    }
    const payload = objToSnakeRow({
      visitDate: updates.visitDate,
      expectedTime: updates.expectedTime,
      area: updates.area,
      city: updates.city || updates.area,
      visitPurpose: updates.visitPurpose,
      requirement: updates.requirement || null,
      notes: updates.notes || null
    });
    const { data, error } = await supabase
      .from('visit_plans')
      .update(payload)
      .eq('id', entryId)
      .eq('employee_id', currentUser.employeeId)
      .select()
      .single();
    if (error) {
      showToast('Unable to update the visit plan.', 'error');
      throw error;
    }
    await refreshEntity('visit_plans');
    showToast('Visit plan updated successfully.', 'success');
    return normalizeVisitPlan(rowToCamel(data));
  };

  const resubmitVisitPlan = async (entryId) => {
    const target = visitPlans.find((plan) => plan.id === entryId);
    if (!target || target.employeeId !== currentUser?.employeeId) {
      throw new Error('Visit plan not found.');
    }
    if (!['Draft', 'Changes Requested'].includes(normalizePlanStatus(target.status))) {
      throw new Error('Only a Draft or Changes Requested plan can be submitted.');
    }
    const { data, error } = await supabase
      .from('visit_plans')
      .update({ status: 'Submitted', submitted_at: new Date().toISOString() })
      .eq('id', entryId)
      .eq('employee_id', currentUser.employeeId)
      .select()
      .single();
    if (error) {
      showToast('Unable to submit the visit plan.', 'error');
      throw error;
    }
    await refreshEntity('visit_plans');
    showToast('Visit Plan Submitted Successfully.', 'success');
    return normalizeVisitPlan(rowToCamel(data));
  };

  const addTourPlanBatch = async ({ rows, planType, periodFrom, periodTo }) => {
    const batchId = crypto.randomUUID();
    const submittedAt = new Date().toISOString();
    const status = 'Submitted';
    const payload = rows.map((plan) => objToSnakeRow({
      employeeId: currentUser?.employeeId,
      fullName: currentUser?.fullName || currentUser?.employeeName,
      visitDate: plan.visitDate,
      expectedTime: plan.expectedTime || null,
      customerId: plan.customerId || null,
      customerName: plan.customerName || null,
      organizationType: plan.organizationType || null,
      contactPerson: plan.contactPerson || null,
      mobileNumber: plan.mobileNumber || null,
      state: plan.state || null,
      district: plan.district || null,
      city: plan.city || null,
      area: plan.area || null,
      fullAddress: plan.fullAddress || null,
      visitPurpose: plan.visitPurpose || null,
      products: Array.isArray(plan.products) ? plan.products : [],
      requirement: plan.requirement || null,
      priority: plan.priority || 'Medium',
      notes: plan.notes || null,
      batchId,
      planType,
      periodFrom,
      periodTo,
      status,
      submittedAt,
      rescheduleHistory: plan.rescheduleHistory || []
    }));

    if (import.meta.env.DEV) console.log('Tour plan submission:', { batchId, planType, periodFrom, periodTo, employeeId: currentUser?.employeeId, entries: payload.length });
    const { data, error } = await supabase.from('visit_plans').insert(payload).select();
    if (error) {
      console.error('Tour plan submission failed:', error);
      showToast('Failed to submit tour plan. Your entries have been preserved.', 'error');
      throw error;
    }

    const saved = rowsToCamel(data).map(normalizeVisitPlan);
    if (import.meta.env.DEV) console.log('Tour plan saved:', { batchId, status, employeeId: currentUser?.employeeId, entries: saved.length });
    setVisitPlans((current) => [...saved, ...current]);
    await refreshEntity('visit_plans');

    const directorIds = users.filter((user) => user.role === 'Director' && user.status === 'Active').map((user) => user.employeeId).filter(Boolean);
    if (directorIds.length) {
      const notificationsToCreate = directorIds.slice(0, 1).map((userId) => ({ user_id: userId, title: `${planType} tour plan submitted`, message: `${currentUser?.fullName || currentUser?.employeeName || currentUser?.employeeId} submitted ${saved.length} plan entries.`, timestamp: new Date().toLocaleString(), is_read: false, type: 'plan' }));
      const { error: notificationError } = await supabase.from('notifications').insert(notificationsToCreate);
      if (notificationError) console.error('Director plan notification failed:', notificationError);
    }
    logActivity(`Submitted ${planType.toLowerCase()} tour plan with ${saved.length} entries`, 'Tour Plan');
    return { batchId, rows: saved };
  };

  const updateVisitPlanStatus = async (id, newStatus, extra = {}) => {
    const target = visitPlans.find(p => p.id === id);
    if (!target) return;
    const { error } = await supabase.from('visit_plans').update(objToSnakeRow({ status: newStatus, ...extra })).eq('id', id);
    if (error) {
      showToast('Failed to update visit status', 'error');
      return;
    }
    setVisitPlans(prev => prev.map(p => p.id === id ? { ...p, status: newStatus, ...extra } : p));
    await refreshEntity('visit_plans');
    logActivity(`Updated visit status to ${newStatus} for ${target.customerName}`, 'Visit Status');
    showToast(`Visit status updated to ${newStatus}`, 'info');
  };

  const markVisitPlanImportant = async (id, isImportant = true) => {
    const { error } = await supabase.from('visit_plans').update({ is_important: isImportant }).eq('id', id);
    if (error) throw error;
    setVisitPlans((previous) => previous.map((plan) => plan.id === id ? { ...plan, isImportant } : plan));
    await refreshEntity('visit_plans');
    showToast(isImportant ? 'Visit plan marked important.' : 'Important mark removed.', 'success');
    return true;
  };

  const updateTourPlanBatchStatus = async (batchId, newStatus, extra = {}) => {
    const status = normalizePlanStatus(newStatus);
    const batch = visitPlans.filter((plan) => (plan.batchId || plan.id) === batchId);
    if (!batch.length) return false;
    const historyEntry = { status, comment: extra.reviewComment || '', reviewedBy: currentUser?.employeeId, reviewedAt: new Date().toISOString() };
    const update = objToSnakeRow({ status, reviewedAt: historyEntry.reviewedAt, reviewedBy: currentUser?.employeeId, reviewComment: extra.reviewComment || null, reviewHistory: [...(batch[0].reviewHistory || []), historyEntry] });
    const query = supabase.from('visit_plans').update(update);
    const { error } = batch[0].batchId ? await query.eq('batch_id', batchId) : await query.eq('id', batch[0].id);
    if (error) { showToast('Failed to update tour plan review', 'error'); return false; }
    await refreshEntity('visit_plans');
    const targetEmployeeId = batch[0].employeeId;
    const { error: notificationError } = await supabase.from('notifications').insert({ user_id: targetEmployeeId, title: `Tour plan ${status}`, message: extra.reviewComment || `Your ${inferPlanType(batch[0]).toLowerCase()} tour plan is ${status.toLowerCase()}.`, timestamp: new Date().toLocaleString(), is_read: false, type: 'plan' });
    if (notificationError) console.error('Tour plan review notification failed:', notificationError);
    logActivity(`${status} ${inferPlanType(batch[0]).toLowerCase()} tour plan for ${batch[0].fullName || batch[0].employeeId}`, 'Tour Plan Review');
    return true;
  };

  const requestTourPlanChanges = async (batchId, comment) => {
    const { data, error } = await supabase.rpc('request_tour_plan_changes', {
      p_batch_id: batchId,
      p_comment: comment
    });
    if (error) throw error;
    await refreshEntity('visit_plans');
    return data;
  };

  const reviewTourPlanBatch = async (batchId, action, comment = '') => {
    const { data, error } = await supabase.rpc('review_tour_plan_batch', {
      p_batch_id: batchId,
      p_action: action,
      p_comment: comment || null
    });
    if (error) throw error;
    await refreshEntity('visit_plans');
    return data;
  };

  const rescheduleVisitPlan = async (id, newDate, newTime, reason) => {
    const target = visitPlans.find(p => p.id === id);
    if (!target) return;
    const historyItem = {
      oldDate: target.visitDate, oldTime: target.expectedTime,
      newDate, newTime, reason, timestamp: new Date().toLocaleString()
    };
    const rescheduleHistory = [historyItem, ...(target.rescheduleHistory || [])];
    const { error } = await supabase.from('visit_plans').update({
      visit_date: newDate, expected_time: newTime, status: 'Rescheduled', reschedule_history: rescheduleHistory
    }).eq('id', id);
    if (error) {
      showToast('Failed to reschedule visit', 'error');
      return;
    }
    setVisitPlans(prev => prev.map(p => p.id === id
      ? { ...p, visitDate: newDate, expectedTime: newTime, status: 'Rescheduled', rescheduleHistory }
      : p));
    await refreshEntity('visit_plans');
    logActivity(`Rescheduled visit for ${target.customerName} to ${newDate}`, 'Visit Plan');
    showToast('Visit rescheduled successfully', 'warning');
  };

  // ---------------------------------------------------------------------
  // Visit Reports / Daily Reports / Follow-ups / Director Comments
  // ---------------------------------------------------------------------
  const submitVisitReport = async (reportData) => {
    const row = objToSnakeRow({
      employeeId: currentUser?.employeeId,
      fullName: currentUser?.fullName || currentUser?.employeeName || currentUser?.username || 'Marketing Employee',
      submittedAt: new Date().toISOString(),
      isLocked: false,
      ...reportData
    });
    if (import.meta.env.DEV) console.log('Payload', row);
    const response = await supabase.rpc('submit_visit_report', {
      p_visit_plan_id: reportData.visitPlanId,
      p_report: row,
    }).single();
    const { data, error } = response;
    if (import.meta.env.DEV) console.log('RPC', response);
    if (error) {
      console.log('Error', error);
      const safeErrors = {
        DISCUSSION_NOTES_REQUIRED: 'Discussion Notes is required.',
        FOLLOW_UP_DATE_REQUIRED: 'Please select a follow-up date.',
        INVALID_VISIT_REPORT_PAYLOAD: 'The visit report contains an invalid value.',
        VISIT_PLAN_NOT_STARTED: 'Only a started visit can be completed.',
        VISIT_PLAN_NOT_OWNED: 'This visit is not available for completion.',
        REPORT_MARKETING_ONLY: 'Only Marketing employees can submit visit reports.',
        REPORT_PROFILE_INACTIVE: 'Your active employee profile could not be verified.',
        REPORT_AUTH_REQUIRED: 'Please sign in again before submitting the report.',
        NO_ACTIVE_DIRECTOR: 'No active Director is available to receive this report.',
      };
      const message = safeErrors[error.message] || 'Unable to submit the visit report. Please try again.';
      showToast(message, 'error');
      throw new Error(message);
    }
    const saved = rowToCamel(data);
    setVisitReports((previous) => [saved, ...previous.filter((report) => report.id !== saved.id)]);
    setVisitPlans((previous) => previous.map((plan) => plan.id === reportData.visitPlanId
      ? { ...plan, status: 'Completed' }
      : plan));
    await Promise.all([
      refreshEntity('visit_reports'),
      refreshEntity('visit_plans'),
      refreshEntity('notifications'),
      refreshEntity('follow_ups'),
    ]);

    logActivity(`Submitted visit report for ${reportData.customerName}`, 'Daily Report');
    showToast('Visit report submitted successfully!', 'success');
    return saved;
  };

  const submitDailyReport = async (dReportData) => {
    const row = objToSnakeRow({
      employeeId: currentUser?.employeeId,
      fullName: currentUser?.fullName || currentUser?.employeeName || currentUser?.username,
      submittedAt: new Date().toISOString(),
      status: 'Submitted',
      isLocked: false,
      ...dReportData
    });
    const { data, error } = await supabase.from('daily_reports').insert(row).select().single();
    if (error) {
      const message = error.code === '42501'
        ? 'You do not have permission to submit this daily report.'
        : 'Unable to submit the daily report. Please try again.';
      showToast(message, 'error');
      throw new Error(message);
    }
    setDailyReports(prev => [rowToCamel(data), ...prev]);
    await refreshEntity('daily_reports');
    logActivity(`Submitted daily summary report for ${dReportData.date}`, 'Daily Report');
    showToast('Daily summary report submitted', 'success');
  };

  const toggleDailyReportLock = async (id) => {
    const target = dailyReports.find(r => r.id === id);
    if (!target) return;
    const nextLock = !target.isLocked;
    const nextStatus = nextLock ? 'Locked' : 'Submitted';
    const { error } = await supabase.from('daily_reports').update({ is_locked: nextLock, status: nextStatus }).eq('id', id);
    if (error) {
      showToast('Failed to update lock status', 'error');
      return;
    }
    setDailyReports(prev => prev.map(r => r.id === id ? { ...r, isLocked: nextLock, status: nextStatus } : r));
    await refreshEntity('daily_reports');
    logActivity(`${nextLock ? 'Locked' : 'Reopened'} daily report ID ${id}`, 'Daily Report Management');
    showToast('Report lock status updated', 'info');
  };

  const addFollowUp = async (folData) => {
    const row = objToSnakeRow({
      employeeId: currentUser?.employeeId,
      fullName: currentUser?.fullName || currentUser?.employeeName || currentUser?.username,
      status: 'Pending',
      ...folData
    });
    const { data, error } = await supabase.from('follow_ups').insert(row).select().single();
    if (error) {
      showToast('Failed to add follow-up', 'error');
      return;
    }
    setFollowUps(prev => [rowToCamel(data), ...prev]);
    await refreshEntity('follow_ups');
    logActivity(`Added follow-up for ${folData.customerName} on ${folData.followUpDate}`, 'Follow-up Management');
    showToast('Follow-up scheduled', 'success');
  };

  const addDirectorComment = async (commentData) => {
    const submissionKey = commentData.submissionKey || crypto.randomUUID();
    const { data, error } = await supabase.rpc('create_director_feedback', {
      p_target_employee_id: commentData.employeeId || commentData.targetEmployeeId,
      p_target_type: commentData.targetType || commentData.targetModule || 'General',
      p_target_id: commentData.targetId || commentData.referenceId || null,
      p_target_title: commentData.targetTitle || null,
      p_message: commentData.message,
      p_comment_type: commentData.commentType || 'General Comment',
      p_submission_key: submissionKey,
    }).single();
    if (error) {
      showToast(error.message || 'Failed to post feedback', 'error');
      throw error;
    }
    const feedback = normalizeDirectorFeedback(rowToCamel(data));
    setDirectorComments((previous) => normalizeDirectorFeedbackList([feedback, ...previous]));
    await refreshEntity('director_comments');
    await refreshEntity('notifications');
    logActivity(`Director posted feedback for ${commentData.targetEmployeeName || commentData.employeeId}`, 'Director Comments');
    showToast('Feedback posted successfully', 'success');
    return feedback;
  };

  const markDirectorFeedbackRead = async (ids) => {
    const requested = Array.isArray(ids) ? ids : [ids];
    const unreadIds = requested.filter(Boolean).filter((id) =>
      directorComments.some((feedback) => feedback.id === id && !feedback.isRead));
    if (!unreadIds.length) return true;
    setDirectorComments((previous) => previous.map((feedback) =>
      unreadIds.includes(feedback.id)
        ? { ...feedback, isRead: true, readAt: new Date().toISOString() }
        : feedback));
    const readAt = new Date().toISOString();
    const { error } = await supabase
      .from('director_comments')
      .update({ is_read: true, read_at: readAt })
      .in('id', unreadIds);
    if (error) {
      await refreshEntity('director_comments');
      showToast('Unable to mark feedback as read', 'error');
      return false;
    }
    return true;
  };

  const markNotificationRead = async (id) => {
    const { error } = await supabase.from('notifications').update({ is_read: true }).eq('id', id);
    if (error) { showToast('Unable to mark notification as read', 'error'); return; }
    setNotifications(prev => prev.map(item => item.id === id ? { ...item, isRead: true } : item));
  };

  const value = {
    currentUser,
    currentRole,
    authLoading,
    authError,
    dataLoading,
    assignedPlacesLoading,
    dataError,
    lastUpdated,
    refreshEntity,
    refreshAllData: loadAllData,
    users,
    products,
    orgTypes,
    purposes,
    visitPlans,
    visitReports,
    dailyReports,
    followUps,
    employeeVisitPlaces,
    districts,
    locations,
    directorComments,
    notifications,
    activityLogs,
    companyInfo,
    toasts,
    theme,
    toggleTheme,
    login,
    logout,
    showToast,
    logActivity,
    addUser,
    updateUser,
    manageLocationMaster,
    toggleUserStatus,
    deleteUser,
    addProduct,
    toggleProductStatus,
    updateCompanyInfo,
    addVisitPlan,
    saveTourPlanDraft,
    addTourPlanBatch,
    deleteVisitPlanEntry,
    inspectCompletedVisitDelete,
    getVisitReportForPlan,
    deleteCompletedVisit,
    updateEditableVisitPlan,
    resubmitVisitPlan,
    updateVisitPlanStatus,
    markVisitPlanImportant,
    updateTourPlanBatchStatus,
    requestTourPlanChanges,
    reviewTourPlanBatch,
    rescheduleVisitPlan,
    submitVisitReport,
    submitDailyReport,
    toggleDailyReportLock,
    addFollowUp,
    addDirectorComment,
    markDirectorFeedbackRead,
    markNotificationRead
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};

export const useApp = () => useContext(AppContext);
