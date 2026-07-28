/* oxlint-disable react/only-export-components */
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabaseClient';
import { rowToCamel, rowsToCamel, objToSnakeRow } from '../lib/caseMap';
import { inferPlanType, normalizePlanStatus } from '../utils/planStatus';

const AppContext = createContext();
const AUTH_INITIALIZATION_TIMEOUT_MS = 10000;
const ADD_USER_FALLBACK_MESSAGE = 'Unable to create user. Please check the Edge Function logs and try again.';
const CREATE_USER_ROLE_MAP = {
  Admin: 'Admin',
  Director: 'Director',
  Marketing: 'Marketing',
  'Marketing Team': 'Marketing',
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

      console.error('admin-create-user Edge Function response:', { status: status ?? null, body });
      if (parts.length > 0) return parts.join(' — ');
    }
  } catch (parseError) {
    console.error('Failed to parse Edge Function error:', parseError);
  }

  return [status ? `HTTP ${status}` : null, directMessage].filter(Boolean).join(' — ') || ADD_USER_FALLBACK_MESSAGE;
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
const normalizeVisitPlan = (plan) => ({ ...plan, status: normalizePlanStatus(plan.status), planType: inferPlanType(plan), products: Array.isArray(plan.products) ? plan.products : plan.productName ? [plan.productName] : plan.products ? [plan.products] : [] });

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
  const [customers, setCustomers] = useState([]);
  const [visitPlans, setVisitPlans] = useState([]);
  const [visitReports, setVisitReports] = useState([]);
  const [dailyReports, setDailyReports] = useState([]);
  const [followUps, setFollowUps] = useState([]);
  const [tenders, setTenders] = useState([]);
  const [directorComments, setDirectorComments] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [activityLogs, setActivityLogs] = useState([]);
  const [companyInfo, setCompanyInfo] = useState(null);
  const [dataLoading, setDataLoading] = useState(false);
  const [dataError, setDataError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);

  const [theme, setTheme] = useState(() => localStorage.getItem('kw_vmm_theme') || 'dark');
  const [toasts, setToasts] = useState([]);

  useEffect(() => {
    localStorage.setItem('kw_vmm_theme', theme);
    document.documentElement.classList.toggle('dark', theme === 'dark');
    document.documentElement.style.colorScheme = theme;
    document.body.classList.remove('theme-light');
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
    setDataError(null);
    const queries = [
      ['users', supabase.from('profiles').select('*')],
      ['products', supabase.from('products').select('*').order('display_order')],
      ['orgTypes', supabase.from('org_types').select('*').order('name')],
      ['purposes', supabase.from('purposes').select('*').order('name')],
      ['customers', supabase.from('customers').select('*').order('created_date', { ascending: false })],
      ['visitPlans', supabase.from('visit_plans').select('*').order('visit_date', { ascending: false })],
      ['visitReports', supabase.from('visit_reports').select('*').order('submitted_at', { ascending: false })],
      ['dailyReports', supabase.from('daily_reports').select('*').order('submitted_at', { ascending: false })],
      ['followUps', supabase.from('follow_ups').select('*').order('follow_up_date', { ascending: false })],
      ['tenders', supabase.from('tenders').select('*')],
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
    setCustomers(rowsToCamel(results.customers));
    setVisitPlans(rowsToCamel(results.visitPlans).map(normalizeVisitPlan));
    setVisitReports(rowsToCamel(results.visitReports));
    setDailyReports(rowsToCamel(results.dailyReports));
    setFollowUps(rowsToCamel(results.followUps));
    setTenders(rowsToCamel(results.tenders));
    setDirectorComments(rowsToCamel(results.directorComments));
    setNotifications(rowsToCamel(results.notifications));
    setActivityLogs(rowsToCamel(results.activityLogs));
    setCompanyInfo(results.companyInfo ? rowToCamel(results.companyInfo) : null);
    const failed = Object.entries(results).filter(([, value]) => value === null).map(([key]) => key);
    setDataError(failed.length ? `Unable to refresh: ${failed.join(', ')}` : null);
    setLastUpdated(new Date());
    setDataLoading(false);
  }, []);

  const refreshEntity = useCallback(async (table) => {
    const config = {
      profiles: [() => supabase.from('profiles').select('*'), setUsers],
      customers: [() => supabase.from('customers').select('*').order('created_date', { ascending: false }), setCustomers],
      visit_plans: [() => supabase.from('visit_plans').select('*').order('visit_date', { ascending: false }), setVisitPlans],
      visit_reports: [() => supabase.from('visit_reports').select('*').order('submitted_at', { ascending: false }), setVisitReports],
      daily_reports: [() => supabase.from('daily_reports').select('*').order('submitted_at', { ascending: false }), setDailyReports],
      follow_ups: [() => supabase.from('follow_ups').select('*').order('follow_up_date', { ascending: false }), setFollowUps],
      tenders: [() => supabase.from('tenders').select('*'), setTenders],
      director_comments: [() => supabase.from('director_comments').select('*').order('created_at', { ascending: false }), setDirectorComments],
      notifications: [() => supabase.from('notifications').select('*').order('created_at', { ascending: false }), setNotifications],
      activity_logs: [() => supabase.from('activity_logs').select('*').order('created_at', { ascending: false }), setActivityLogs],
      company_info: [() => supabase.from('company_info').select('*').eq('id', 1), setCompanyInfo]
    };
    const entry = config[table];
    if (!entry) return;
    const [query, setter] = entry;
    const { data, error } = await query();
    if (error) { console.error(`Failed to refresh ${table}:`, error); setDataError(`Unable to refresh ${table.replaceAll('_', ' ')}.`); return; }
    const mapped = rowsToCamel(data);
    setter(table === 'profiles' ? mapped.map(normalizeProfileData) : table === 'visit_plans' ? mapped.map(normalizeVisitPlan) : table === 'company_info' ? (mapped[0] || null) : mapped);
    setDataError(null);
    setLastUpdated(new Date());
  }, []);

  useEffect(() => {
    if (currentUser) {
      loadAllData();
    } else {
      // Logged out — clear all previously loaded data from memory.
      setUsers([]); setProducts([]); setOrgTypes([]); setPurposes([]);
      setCustomers([]); setVisitPlans([]); setVisitReports([]); setDailyReports([]);
      setFollowUps([]); setTenders([]); setDirectorComments([]); setNotifications([]);
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
    const tables = ['profiles', 'customers', 'visit_plans', 'visit_reports', 'daily_reports', 'follow_ups', 'tenders', 'director_comments', 'notifications', 'activity_logs'];
    const pending = new Map();
    let channel = supabase.channel(`portal-live-${currentUser.id}`);
    tables.forEach((table) => {
      channel = channel.on('postgres_changes', { event: '*', schema: 'public', table }, () => {
        window.clearTimeout(pending.get(table));
        pending.set(table, window.setTimeout(() => refreshEntity(table), 150));
      });
    });
    channel.subscribe((subscriptionStatus) => {
      if (subscriptionStatus === 'CHANNEL_ERROR' || subscriptionStatus === 'TIMED_OUT') {
        console.error(`Realtime subscription ${subscriptionStatus.toLowerCase()}`);
        setDataError('Live updates are temporarily unavailable. Use Refresh to retry.');
      }
    });
    return () => {
      pending.forEach((timer) => window.clearTimeout(timer));
      pending.clear();
      supabase.removeChannel(channel);
    };
  }, [currentUser?.id, refreshEntity]);

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
      const message = 'Your session has expired. Please log in again.';
      showToast(message, 'error');
      throw new Error(message);
    }

    const normalizedRole = CREATE_USER_ROLE_MAP[userData.role];
    const requestBody = {
      full_name: userData.employeeName,
      employee_id: userData.employeeId,
      mobile_number: userData.mobile,
      email: userData.email,
      role: normalizedRole || userData.role,
      username: userData.username,
      password: userData.password,
      designation: userData.designation,
    };
    const { data, error } = await supabase.functions.invoke('admin-create-user', {
      body: requestBody,
      headers: { Authorization: `Bearer ${session.access_token}` }
    });

    if (error) {
      if (import.meta.env.DEV) {
        console.error('Raw Edge Function error:', error);
      }

      const message = await getErrorMessage(error);
      showToast(message, 'error');
      throw new Error(message);
    }

    if (data?.success === false) {
      const message = readableErrorText(data?.error) ||
        readableErrorText(data?.message) ||
        'Unable to create user.';
      showToast(message, 'error');
      throw new Error(message);
    }

    logActivity(`Added new user: ${userData.employeeName} (${userData.role})`, 'User Management');
    showToast(`User ${userData.employeeName} created successfully`, 'success');
    await loadAllData();
    return { success: true };
  };

  const updateUser = async (id, updatedFields) => {
    const { error } = await supabase.from('profiles').update(objToSnakeRow(updatedFields)).eq('id', id);
    if (error) {
      showToast('Failed to update user', 'error');
      return;
    }
    setUsers(prev => prev.map(u => u.id === id ? { ...u, ...updatedFields } : u));
    logActivity(`Updated user details for ID ${id}`, 'User Management');
    showToast('User updated successfully', 'success');
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
  // Customers
  // ---------------------------------------------------------------------
  const addCustomer = async (custData) => {
    const row = objToSnakeRow({
      ...custData,
      createdBy: currentUser?.employeeId,
      createdByName: currentUser?.employeeName,
      status: 'Pending Verification',
      createdDate: new Date().toISOString().split('T')[0]
    });
    const { data, error } = await supabase.from('customers').insert(row).select().single();
    if (error) {
      showToast('Failed to submit customer', 'error');
      return null;
    }
    const newCust = rowToCamel(data);
    setCustomers(prev => [newCust, ...prev]);
    await refreshEntity('customers');
    logActivity(`Created new customer: ${custData.organizationName}`, 'Customer Management');
    showToast(`Customer "${custData.organizationName}" submitted for approval`, 'success');
    return newCust;
  };

  const approveCustomer = async (id) => {
    const target = customers.find(c => c.id === id);
    if (!target) return;
    const { error } = await supabase.from('customers').update({ status: 'Approved' }).eq('id', id);
    if (error) {
      showToast('Failed to approve customer', 'error');
      return;
    }
    setCustomers(prev => prev.map(c => c.id === id ? { ...c, status: 'Approved' } : c));
    await refreshEntity('customers');
    logActivity(`Approved customer: ${target.organizationName}`, 'Customer Management');
    showToast(`Approved customer ${target.organizationName}`, 'success');
  };

  const rejectCustomer = async (id) => {
    const target = customers.find(c => c.id === id);
    if (!target) return;
    const { error } = await supabase.from('customers').update({ status: 'Rejected' }).eq('id', id);
    if (error) {
      showToast('Failed to reject customer', 'error');
      return;
    }
    setCustomers(prev => prev.map(c => c.id === id ? { ...c, status: 'Rejected' } : c));
    await refreshEntity('customers');
    logActivity(`Rejected customer: ${target.organizationName}`, 'Customer Management');
    showToast(`Rejected customer ${target.organizationName}`, 'warning');
  };

  // ---------------------------------------------------------------------
  // Visit Plans
  // ---------------------------------------------------------------------
  const addVisitPlan = async (planData) => {
    const row = objToSnakeRow({
      ...planData,
      employeeId: currentUser?.employeeId,
      fullName: currentUser?.fullName || currentUser?.employeeName,
      status: normalizePlanStatus(planData.status || 'Planned'),
      rescheduleHistory: []
    });
    const { data, error } = await supabase.from('visit_plans').insert(row).select().single();
    if (error) {
      showToast('Failed to create visit plan', 'error');
      return;
    }
    setVisitPlans(prev => [rowToCamel(data), ...prev]);
    await refreshEntity('visit_plans');
    logActivity(`Created visit plan for ${planData.customerName} on ${planData.visitDate}`, 'Visit Plan');
    return normalizeVisitPlan(rowToCamel(data));
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
    isTenderRelated: Boolean(plan.isTenderRelated),
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
    if (!entryId) throw new Error('Visit entry ID is missing.');
    const target = visitPlans.find((plan) => plan.id === entryId);
    if (!target) throw new Error('Visit entry was not found. Refresh and try again.');
    const status = normalizePlanStatus(target.status);
    const role = normalizeRole(currentUser?.role);
    if (role === 'Director' || (!['Admin', 'Marketing Team'].includes(role))) {
      throw new Error('You do not have permission to delete this visit entry.');
    }
    if (role !== 'Admin' && target.employeeId !== currentUser?.employeeId) {
      throw new Error('You can only delete your own visit entries.');
    }
    if (role !== 'Admin' && !['Draft', 'Changes Requested'].includes(status)) {
      throw new Error('Only Draft or Changes Requested entries can be deleted.');
    }
    const { error } = await supabase.from('visit_plans').delete().eq('id', entryId);
    if (error) {
      showToast('Unable to delete the visit entry. Please try again.', 'error');
      throw error;
    }
    await refreshEntity('visit_plans');
    logActivity(`Deleted visit entry ID ${entryId}`, 'Tour Plan');
    return true;
  };

  const addTourPlanBatch = async ({ rows, planType, periodFrom, periodTo }) => {
    const batchId = crypto.randomUUID();
    const submittedAt = new Date().toISOString();
    const status = 'Pending Approval';
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
      isTenderRelated: Boolean(plan.isTenderRelated),
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
      const notificationsToCreate = directorIds.map((userId) => ({ user_id: userId, title: `${planType} tour plan awaiting review`, message: `${currentUser?.fullName || currentUser?.employeeName || currentUser?.employeeId} submitted ${saved.length} plan entries.`, timestamp: new Date().toLocaleString(), is_read: false, type: 'plan' }));
      const { error: notificationError } = await supabase.from('notifications').insert(notificationsToCreate);
      if (notificationError) console.error('Director plan notification failed:', notificationError);
    }
    logActivity(`Submitted ${planType.toLowerCase()} tour plan with ${saved.length} entries for Director approval`, 'Tour Plan');
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
  // Visit Reports / Daily Reports / Follow-ups / Tenders / Director Comments
  // ---------------------------------------------------------------------
  const submitVisitReport = async (reportData) => {
    const row = objToSnakeRow({
      employeeId: currentUser?.employeeId,
      employeeName: currentUser?.employeeName,
      submittedAt: new Date().toISOString(),
      isLocked: false,
      ...reportData
    });
    const { data, error } = await supabase.from('visit_reports').insert(row).select().single();
    if (error) {
      showToast('Failed to submit visit report', 'error');
      return;
    }
    setVisitReports(prev => [rowToCamel(data), ...prev]);
    await refreshEntity('visit_reports');

    if (reportData.visitPlanId) {
      await updateVisitPlanStatus(reportData.visitPlanId, 'Completed');
    }

    logActivity(`Submitted visit report for ${reportData.customerName}`, 'Daily Report');
    showToast('Visit report submitted successfully!', 'success');
  };

  const submitDailyReport = async (dReportData) => {
    const row = objToSnakeRow({
      employeeId: currentUser?.employeeId,
      employeeName: currentUser?.employeeName,
      submittedAt: new Date().toISOString(),
      status: 'Submitted',
      isLocked: false,
      ...dReportData
    });
    const { data, error } = await supabase.from('daily_reports').insert(row).select().single();
    if (error) {
      showToast('Failed to submit daily report', 'error');
      return;
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
      employeeName: currentUser?.employeeName,
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

  const addTender = async (tendData) => {
    const row = objToSnakeRow({
      assignedEmployeeId: currentUser?.employeeId,
      assignedEmployeeName: currentUser?.employeeName,
      status: 'New Enquiry',
      documents: [],
      ...tendData
    });
    const { data, error } = await supabase.from('tenders').insert(row).select().single();
    if (error) {
      showToast('Failed to add tender', 'error');
      return;
    }
    setTenders(prev => [rowToCamel(data), ...prev]);
    await refreshEntity('tenders');
    logActivity(`Added new tender enquiry: ${tendData.tenderName}`, 'Tender Management');
    showToast('Tender enquiry added', 'success');
  };

  const addDirectorComment = async (commentData) => {
    const row = objToSnakeRow({
      author: currentUser?.employeeName,
      authorRole: currentUser?.role,
      createdAt: new Date().toISOString(),
      isRead: false,
      replies: [],
      ...commentData
    });
    const { data, error } = await supabase.from('director_comments').insert(row).select().single();
    if (error) {
      showToast('Failed to post comment', 'error');
      return;
    }
    setDirectorComments(prev => [rowToCamel(data), ...prev]);
    await refreshEntity('director_comments');

    const notifRow = {
      user_id: commentData.targetEmployeeId,
      title: `${currentUser?.role || 'Director'} Comment Added`,
      message: `${currentUser?.employeeName}: "${commentData.message}"`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      is_read: false,
      type: 'comment'
    };
    const { data: notifData, error: notifErr } = await supabase.from('notifications').insert(notifRow).select().single();
    if (!notifErr) {
      setNotifications(prev => [rowToCamel(notifData), ...prev]);
    }

    logActivity(`Director posted comment for ${commentData.targetEmployeeName}`, 'Director Comments');
    showToast('Comment posted successfully', 'success');
  };

  const markNotificationRead = async (id) => {
    const { error } = await supabase.from('notifications').update({ is_read: true }).eq('id', id);
    if (error) { showToast('Unable to mark notification as read', 'error'); return; }
    setNotifications(prev => prev.map(item => item.id === id ? { ...item, isRead: true } : item));
  };

  const value = {
    currentUser,
    currentRole: currentUser ? normalizeRole(currentUser.role) : null,
    authLoading,
    authError,
    dataLoading,
    dataError,
    lastUpdated,
    refreshEntity,
    refreshAllData: loadAllData,
    users,
    products,
    orgTypes,
    purposes,
    customers,
    visitPlans,
    visitReports,
    dailyReports,
    followUps,
    tenders,
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
    toggleUserStatus,
    deleteUser,
    addProduct,
    toggleProductStatus,
    updateCompanyInfo,
    addCustomer,
    approveCustomer,
    rejectCustomer,
    addVisitPlan,
    saveTourPlanDraft,
    addTourPlanBatch,
    deleteVisitPlanEntry,
    updateVisitPlanStatus,
    updateTourPlanBatchStatus,
    requestTourPlanChanges,
    reviewTourPlanBatch,
    rescheduleVisitPlan,
    submitVisitReport,
    submitDailyReport,
    toggleDailyReportLock,
    addFollowUp,
    addTender,
    addDirectorComment,
    markNotificationRead
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};

export const useApp = () => useContext(AppContext);
