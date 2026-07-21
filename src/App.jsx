import React, { useState, lazy, Suspense } from 'react';
import { useApp } from './context/AppContext';
import { Sidebar } from './components/common/Sidebar';
import { Navbar } from './components/common/Navbar';
import { MobileBottomNav } from './components/common/MobileBottomNav';
import { ToastContainer } from './components/common/ToastContainer';
import { LoginPage } from './components/auth/LoginPage';
import { routes } from './routes';

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

export function AppContent() {
  const { currentUser, currentRole, authLoading } = useApp();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  const toggleSidebar = () => {
    setIsMobileSidebarOpen(prev => !prev);
  };

  if (authLoading) {
    return <div className="app-loading-screen">Loading...</div>;
  }

  if (!currentUser) {
    return <LoginPage />;
  }

  // Consolidated route definitions are imported from routes.js
  const renderContent = () => {
    const match = routes.find(r => r.role === currentRole && r.id === activeTab);
    const Component = match ? getLazyComponent(match) : null;
    if (Component) {
      return (
        <Suspense fallback={<div>Loading...</div>}>
          <Component setActiveTab={setActiveTab} />
        </Suspense>
      );
    }
    // Fallback to default dashboard for the role
    const defaultRoute = routes.find(r => r.role === currentRole && r.id === 'dashboard');
    const DefaultComponent = defaultRoute ? getLazyComponent(defaultRoute) : null;
    return DefaultComponent ? (
      <Suspense fallback={<div>Loading...</div>}>
        <DefaultComponent setActiveTab={setActiveTab} />
      </Suspense>
    ) : null;
  };

  return (
    <div className="app-container">
      <div className="main-layout">
        {/* Role Specific Streamlined Sidebar */}
        <Sidebar
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          isMobileOpen={isMobileSidebarOpen}
          toggleSidebar={toggleSidebar}
        />

        <div className="content-area">
          {/* Top Navbar */}
          <Navbar
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            toggleSidebar={toggleSidebar}
          />

          {/* Main Dynamic View */}
          <main className="main-view-wrapper">
            {renderContent()}
          </main>
        </div>
      </div>

      {/* Mobile Native 1-Thumb Bottom Navigation */}
      <MobileBottomNav
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        toggleSidebar={toggleSidebar}
      />

      <ToastContainer />
    </div>
  );
}

export default function App() {
  return <AppContent />;
}
