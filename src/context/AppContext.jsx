import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabaseClient';
import { rowToCamel, rowsToCamel, objToSnakeRow } from '../lib/caseMap';

const AppContext = createContext();

export const AppProvider = ({ children }) => {
  // Auth / profile state
  const [currentUser, setCurrentUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

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

  const [theme, setTheme] = useState(() => localStorage.getItem('kw_vmm_theme') || 'dark');
  const [toasts, setToasts] = useState([]);

  useEffect(() => {
    localStorage.setItem('kw_vmm_theme', theme);
    if (theme === 'light') {
      document.body.classList.add('theme-light');
    } else {
      document.body.classList.remove('theme-light');
    }
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
    setActivityLogs(prev => [{ id: `local-${Date.now()}`, user: label, module, action, timestamp }, ...prev]);
  }, [currentUser]);

  // ---------------------------------------------------------------------
  // Auth: fetch the profile (role/employee metadata) for a Supabase session
  // ---------------------------------------------------------------------
  const loadProfile = useCallback(async (authUserId) => {
    const { data, error } = await supabase.from('profiles').select('*').eq('id', authUserId).single();
    if (error || !data) return null;
    return rowToCamel(data);
  }, []);

  useEffect(() => {
    let isMounted = true;

    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        const profile = await loadProfile(session.user.id);
        if (isMounted) setCurrentUser(profile);
      }
      if (isMounted) setAuthLoading(false);
    };
    init();

    const { data: subscription } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session?.user) {
        const profile = await loadProfile(session.user.id);
        if (isMounted) setCurrentUser(profile);
      } else {
        if (isMounted) setCurrentUser(null);
      }
    });

    return () => {
      isMounted = false;
      subscription?.subscription?.unsubscribe();
    };
  }, [loadProfile]);

  // ---------------------------------------------------------------------
  // Data loading: once a user is authenticated, load all app data (RLS
  // automatically scopes each table to what that user/role is allowed to see).
  // ---------------------------------------------------------------------
  const loadAllData = useCallback(async () => {
    const [
      usersRes, productsRes, orgTypesRes, purposesRes, customersRes,
      visitPlansRes, visitReportsRes, dailyReportsRes, followUpsRes,
      tendersRes, directorCommentsRes, notificationsRes, activityLogsRes, companyInfoRes
    ] = await Promise.all([
      supabase.from('profiles').select('*'),
      supabase.from('products').select('*').order('display_order'),
      supabase.from('org_types').select('*').order('name'),
      supabase.from('purposes').select('*').order('name'),
      supabase.from('customers').select('*').order('created_date', { ascending: false }),
      supabase.from('visit_plans').select('*').order('visit_date', { ascending: false }),
      supabase.from('visit_reports').select('*').order('submitted_at', { ascending: false }),
      supabase.from('daily_reports').select('*').order('submitted_at', { ascending: false }),
      supabase.from('follow_ups').select('*').order('follow_up_date', { ascending: false }),
      supabase.from('tenders').select('*'),
      supabase.from('director_comments').select('*').order('created_at', { ascending: false }),
      supabase.from('notifications').select('*').order('created_at', { ascending: false }),
      supabase.from('activity_logs').select('*').order('created_at', { ascending: false }),
      supabase.from('company_info').select('*').eq('id', 1).single()
    ]);

    setUsers(rowsToCamel(usersRes.data));
    setProducts(rowsToCamel(productsRes.data));
    setOrgTypes((orgTypesRes.data || []).map(r => r.name));
    setPurposes((purposesRes.data || []).map(r => r.name));
    setCustomers(rowsToCamel(customersRes.data));
    setVisitPlans(rowsToCamel(visitPlansRes.data));
    setVisitReports(rowsToCamel(visitReportsRes.data));
    setDailyReports(rowsToCamel(dailyReportsRes.data));
    setFollowUps(rowsToCamel(followUpsRes.data));
    setTenders(rowsToCamel(tendersRes.data));
    setDirectorComments(rowsToCamel(directorCommentsRes.data));
    setNotifications(rowsToCamel(notificationsRes.data));
    setActivityLogs(rowsToCamel(activityLogsRes.data));
    setCompanyInfo(companyInfoRes.data ? rowToCamel(companyInfoRes.data) : null);
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
  }, [currentUser, loadAllData]);

  // ---------------------------------------------------------------------
  // Auth actions
  // ---------------------------------------------------------------------
  const login = async (email, password) => {
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
  };

  const logout = async () => {
    if (currentUser) {
      logActivity(`User ${currentUser.employeeName} logged out`, 'Authentication');
    }
    await supabase.auth.signOut();
    setCurrentUser(null);
    showToast('Logged out successfully', 'info');
  };

  // ---------------------------------------------------------------------
  // User management (Admin) — user creation/deletion require elevated
  // privileges and go through Supabase Edge Functions (service_role key
  // never reaches the browser). See supabase/functions/.
  // ---------------------------------------------------------------------
  const addUser = async (userData) => {
    const { data: { session } } = await supabase.auth.getSession();
    const { data, error } = await supabase.functions.invoke('admin-create-user', {
      body: userData,
      headers: { Authorization: `Bearer ${session?.access_token}` }
    });
    if (error || data?.error) {
      showToast(data?.error || error.message || 'Failed to create user', 'error');
      return;
    }
    logActivity(`Added new user: ${userData.employeeName} (${userData.role})`, 'User Management');
    showToast(`User ${userData.employeeName} created successfully`, 'success');
    await loadAllData();
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
    logActivity(`Rejected customer: ${target.organizationName}`, 'Customer Management');
    showToast(`Rejected customer ${target.organizationName}`, 'warning');
  };

  // ---------------------------------------------------------------------
  // Visit Plans
  // ---------------------------------------------------------------------
  const addVisitPlan = async (planData) => {
    const row = objToSnakeRow({
      employeeId: currentUser?.employeeId,
      employeeName: currentUser?.employeeName,
      status: 'Planned',
      rescheduleHistory: [],
      ...planData
    });
    const { data, error } = await supabase.from('visit_plans').insert(row).select().single();
    if (error) {
      showToast('Failed to create visit plan', 'error');
      return;
    }
    setVisitPlans(prev => [rowToCamel(data), ...prev]);
    logActivity(`Created visit plan for ${planData.customerName} on ${planData.visitDate}`, 'Visit Plan');
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
    logActivity(`Updated visit status to ${newStatus} for ${target.customerName}`, 'Visit Status');
    showToast(`Visit status updated to ${newStatus}`, 'info');
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

  const value = {
    currentUser,
    currentRole: currentUser ? currentUser.role : null,
    authLoading,
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
    addCustomer,
    approveCustomer,
    rejectCustomer,
    addVisitPlan,
    updateVisitPlanStatus,
    rescheduleVisitPlan,
    submitVisitReport,
    submitDailyReport,
    toggleDailyReportLock,
    addFollowUp,
    addTender,
    addDirectorComment
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};

export const useApp = () => useContext(AppContext);
