import React, { useState, useEffect, lazy, Suspense } from 'react';
import { useApp } from './context/AppContext';
import { Sidebar } from './components/common/Sidebar';
import { Navbar } from './components/common/Navbar';
import { MobileBottomNav } from './components/common/MobileBottomNav';
import { ToastContainer } from './components/common/ToastContainer';
import { LoginPage } from './components/auth/LoginPage';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { directorRoutes, marketingRoutes, routes } from './routes';

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
        <div className="app-loading-screen app-error-screen">
          <p>Something went wrong while loading this page.</p>
          <p className="app-error-detail">{this.state.error?.message || String(this.state.error)}</p>
          <button type="button" onClick={() => window.location.reload()}>Reload</button>
        </div>
      );
    }
    return this.props.children;
  }
}

export function AppContent() {
  const { currentUser, currentRole, authLoading, authError, dataError, dataLoading, refreshAllData, logout } = useApp();
  const location = useLocation();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  // Whenever the logged-in user (or their role) changes — fresh login, logout
  // + different account, or a role change — reset to that role's default
  // dashboard tab instead of keeping a stale activeTab from a previous session.
  useEffect(() => {
    setActiveTab('dashboard');
  }, [currentUser?.id, currentRole]);

  const toggleSidebar = () => {
    setIsMobileSidebarOpen(prev => !prev);
  };

  if (authLoading) {
    return <div className="app-loading-screen">Loading...</div>;
  }

  if (authError) {
    return (
      <div className="app-loading-screen app-error-screen">
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
  const marketingRoute = marketingRoutes.find(route => route.path === location.pathname);
  const directorRoute = directorRoutes.find(route => matchesConfiguredPath(route.path, location.pathname));
  const currentTab = isMarketingUser ? (marketingRoute?.id || '') : isDirectorUser ? (directorRoute?.id || '') : activeTab;

  const renderMarketingRoutes = () => (
    <Routes>
      {marketingRoutes.map(route => {
        const Component = getLazyComponent(route);
        return (
          <Route
            key={route.path}
            path={route.path}
            element={(
              <Suspense fallback={<div className="app-loading-screen">Loading...</div>}>
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
        return <Route key={route.path} path={route.path} element={<Suspense fallback={<div className="app-loading-screen">Loading...</div>}><Component /></Suspense>} />;
      })}
      <Route path="*" element={<Navigate to="/director" replace />} />
    </Routes>
  );

  // Consolidated route definitions are imported from routes.js
  const renderContent = () => {
    const match = routes.find(r => r.role === currentRole && r.id === activeTab);
    const Component = match ? getLazyComponent(match) : null;
    if (Component) {
      return (
        <Suspense fallback={<div className="app-loading-screen">Loading...</div>}>
          <Component setActiveTab={setActiveTab} />
        </Suspense>
      );
    }
    // Fallback to default dashboard for the role
    const defaultRoute = routes.find(r => r.role === currentRole && r.id === 'dashboard');
    const DefaultComponent = defaultRoute ? getLazyComponent(defaultRoute) : null;
    if (DefaultComponent) {
      return (
        <Suspense fallback={<div className="app-loading-screen">Loading...</div>}>
          <DefaultComponent setActiveTab={setActiveTab} />
        </Suspense>
      );
    }
    // No route exists at all for this role — never silently render nothing.
    console.error(`No route found for role "${currentRole}" and tab "${activeTab}"`);
    return (
      <div className="app-loading-screen app-error-screen">
        <p>No dashboard is configured for your account role ({currentRole || 'unknown'}).</p>
        <p className="app-error-detail">Contact your Admin to verify your account setup.</p>
      </div>
    );
  };

  return (
    <div className="app-container">
      <div className="main-layout">
        {/* Role Specific Streamlined Sidebar */}
        <Sidebar
          activeTab={currentTab}
          setActiveTab={setActiveTab}
          isMobileOpen={isMobileSidebarOpen}
          toggleSidebar={toggleSidebar}
        />

        <div className="content-area">
          {/* Top Navbar */}
          <Navbar
            activeTab={currentTab}
            setActiveTab={setActiveTab}
            toggleSidebar={toggleSidebar}
          />

          {/* Main Dynamic View */}
          <main className="main-view-wrapper">
            {dataError && <div className="ds-error" role="alert"><span>{dataError}</span><button type="button" className="btn btn-secondary btn-sm" onClick={refreshAllData}>Retry</button></div>}
            {dataLoading && <div className="director-live-status" role="status">Refreshing portal data…</div>}
            <ErrorBoundary key={(isMarketingUser || isDirectorUser) ? location.pathname : activeTab}>
              {isMarketingUser ? renderMarketingRoutes() : isDirectorUser ? renderDirectorRoutes() : renderContent()}
            </ErrorBoundary>
          </main>
        </div>
      </div>

      {/* Mobile Native 1-Thumb Bottom Navigation */}
      <MobileBottomNav
        activeTab={currentTab}
        setActiveTab={setActiveTab}
        toggleSidebar={toggleSidebar}
      />

      <ToastContainer />
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <AppContent />
    </ErrorBoundary>
  );
}
