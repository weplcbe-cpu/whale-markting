import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { RootErrorBoundary, StartupFailure } from './components/common/StartupBoundary.jsx';
import { BrandedLoadingScreen } from './components/common/CompanyLogo.jsx';
import './index.css';

const rootElement = document.getElementById('root');
const root = ReactDOM.createRoot(rootElement);

const bootstrap = async () => {
  try {
    const [{ default: App }, { AppProvider }] = await Promise.all([
      import('./App.jsx'),
      import('./context/AppContext.jsx')
    ]);

    root.render(
      <React.StrictMode>
        <RootErrorBoundary>
          <BrowserRouter>
            <AppProvider>
              <App />
            </AppProvider>
          </BrowserRouter>
        </RootErrorBoundary>
      </React.StrictMode>
    );
  } catch (error) {
    console.error('Application startup failed:', error);
    root.render(<StartupFailure error={error} onRetry={bootstrap} />);
  }
};

root.render(<BrandedLoadingScreen />);
bootstrap();
