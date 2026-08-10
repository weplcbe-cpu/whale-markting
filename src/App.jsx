import React, { useState, useEffect, lazy, Suspense } from 'react';
import { useApp } from './context/AppContext';
import { Sidebar } from './components/common/Sidebar';
import { Navbar } from './components/common/Navbar';
import { MobileBottomNav } from './components/common/MobileBottomNav';
import { ToastContainer } from './components/common/ToastContainer';
import { RealtimeNotificationToasts } from './components/common/RealtimeNotificationToasts';
import { PwaStatus } from './components/common/PwaStatus';
import { AppShell } from './components/ui';
import { LoginPage } from './components/auth/LoginPage';
import { BrandedLoadingScreen, CompanyLogo } from './components/common/CompanyLogo';
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { adminRoutes, directorRoutes, marketingRoutes } from './routes';

// Cache lazy-loaded components per route so `lazy()` is only ever created once
// per route instead of on every render (calling lazy() inside render is a
// React anti-pattern that causes remounts/loading loops and, under Vite Fast
// Refresh, a "Cannot convert object to primitive value" crash).
const lazyComponentCache = new Map();
function getLazyComponent(route) {
  if (!lazyComponentCache.has(route)) {
    lazyComponentCache.set(route, lazy(route.component));
  }
  return lazyComponentCache.get(route);
}

const matchesConfiguredPath = (routePath, pathname) => {
  const basePath = routePath.split('/:')[0];
  return routePath.includes('/:')
    ? pathname.startsWith(`${basePath}/`)
    : routePath === pathname;
};

// Catches render-time errors anywhere below it (e.g. a lazy-loaded dashboard
// throwing while rendering) and shows a visible error screen instead of
// letting React unmount the whole tree to a blank white page.
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('Unhandled error while rendering the app:', error, info?.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="app-loading-screen app-error-screen" role="alert">
          <CompanyLogo className="app-loading-logo" />
          <h1>Application failed to load.</h1>
          {import.meta.env.DEV && <p className="app-error-detail">{this.state.error?.message || String(this.state.error)}</p>}
          <div className="app-error-actions">
            <button type="button" onClick={() => this.setState({ error: null })}>Retry</button>
            <button type="button" onClick={() => window.location.reload()}>Reload</button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

function AppContent() {
  const { currentUser, currentRole, authLoading, authError, dataError, dataLoading, refreshAllData, logout } = useApp();
  const location = useLocation();
  const navigate = useNavigate();
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  // Whenever the logged-in user (or their role) changes — fresh login, logout
  // + different account, or a role change — reset to that role's default
  // dashboard tab instead of keeping a stale activeTab from a previous session.
  useEffect(() => {
    if (authLoading) return;
    if (!currentUser) {
      if (location.pathname !== '/login') navigate('/login', { replace: true });
      return;
    }
    if (location.pathname === '/' || location.pathname === '/login') {
      const dashboardPath = currentRole === 'Director' ? '/director' : currentRole === 'Marketing Team' ? '/marketing' : '/admin';
      navigate(dashboardPath, { replace: true });
    }
  }, [authLoading, currentRole, currentUser, location.pathname, navigate]);

  const toggleSidebar = () => {
    setIsMobileSidebarOpen(prev => !prev);
  };

  if (authLoading) {
    return <BrandedLoadingScreen />;
  }

  if (authError) {
    return (
      <div className="app-loading-screen app-error-screen">
        <CompanyLogo className="app-loading-logo" />
        <p>Unable to load the application. Retry or sign out.</p>
        <p className="app-error-detail">{authError}</p>
        <div className="app-error-actions">
          <button type="button" onClick={() => window.location.reload()}>Retry</button>
          <button type="button" onClick={logout}>Sign out</button>
        </div>
      </div>
    );
  }

  if (!currentUser) {
    return <LoginPage />;
  }

  const isMarketingUser = currentRole === 'Marketing Team';
  const isDirectorUser = currentRole === 'Director';
  const isAdminUser = currentRole === 'Admin';
  const marketingRoute = marketingRoutes.find(route => matchesConfiguredPath(route.path, location.pathname));
  const directorRoute = directorRoutes.find(route => matchesConfiguredPath(route.path, location.pathname));
  const adminRoute = adminRoutes.find(route => route.path === location.pathname);
  const currentTab = isMarketingUser ? (marketingRoute?.id || '') : isDirectorUser ? (directorRoute?.id || '') : (adminRoute?.id || 'dashboard');
  const selectAdminTab = (id) => navigate(adminRoutes.find(route => route.id === id)?.path || '/admin');

  const renderMarketingRoutes = () => (
    <Routes>
      {marketingRoutes.map(route => {
        const Component = getLazyComponent(route);
        return (
          <Route
            key={route.path}
            path={route.path}
            element={(
              <Suspense fallback={<BrandedLoadingScreen label="Loading page…" />}>
                <Component />
              </Suspense>
            )}
          />
        );
      })}
      <Route path="*" element={<Navigate to="/marketing" replace />} />
    </Routes>
  );

  const renderDirectorRoutes = () => (
    <Routes>
      {directorRoutes.map(route => {
        const Component = getLazyComponent(route);
        return <Route key={route.path} path={route.path} element={<Suspense fallback={<BrandedLoadingScreen label="Loading page…" />}><Component /></Suspense>} />;
      })}
      <Route path="*" element={<Navigate to="/director" replace />} />
    </Routes>
  );

  const renderAdminRoutes = () => (
    <Routes>
      {adminRoutes.map(route => {
        const Component = getLazyComponent(route);
        return <Route key={route.path} path={route.path} element={<Suspense fallback={<BrandedLoadingScreen label="Loading page…" />}><Component setActiveTab={selectAdminTab} /></Suspense>} />;
      })}
      <Route path="*" element={<Navigate to="/admin/master-data" replace />} />
    </Routes>
  );


  return (
    <>
      <AppShell
        sidebar={<Sidebar activeTab={currentTab} setActiveTab={selectAdminTab} isMobileOpen={isMobileSidebarOpen} toggleSidebar={toggleSidebar} />}
        navbar={<Navbar activeTab={currentTab} setActiveTab={selectAdminTab} toggleSidebar={toggleSidebar} />}
      >
        {dataError && <div className="ds-error" role="alert"><span>{dataError}</span><button type="button" className="btn btn-secondary btn-sm" onClick={refreshAllData}>Retry</button></div>}
        {dataLoading && <div className="portal-refresh-progress" role="status" aria-live="polite" aria-label="Refreshing portal data" />}
        <ErrorBoundary key={location.pathname}>
          {isMarketingUser ? renderMarketingRoutes() : isDirectorUser ? renderDirectorRoutes() : isAdminUser ? renderAdminRoutes() : <Navigate to="/login" replace />}
        </ErrorBoundary>
      </AppShell>

      {/* Mobile Native 1-Thumb Bottom Navigation */}
      <MobileBottomNav activeTab={currentTab} setActiveTab={selectAdminTab} toggleSidebar={toggleSidebar} />
      <ToastContainer />
      <RealtimeNotificationToasts />
    </>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <PwaStatus />
      <AppContent />
    </ErrorBoundary>
  );
}
