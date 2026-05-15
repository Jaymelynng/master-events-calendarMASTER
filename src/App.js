import React, { useState, useEffect, useCallback, Suspense, lazy } from 'react';
import { Analytics } from '@vercel/analytics/react';
import EventsDashboard from './components/EventsDashboard_REFACTORED';
import ErrorBoundary from './components/ErrorBoundary';
import './App.css';

// Bulk Links — port of Bulk Link PRO into Calendar (Slice 1 May 14 2026).
// Lazy-loaded so it only ships when a user actually opens it.
const BulkLinksHub = lazy(() => import('./components/BulkLinks/BulkLinksHub'));

// Master tabs that sit above everything. Adding a new "app" later
// (Email tools, Star Chart, etc.) just means adding a row here.
// `path` is the URL path the tab owns. The browser URL stays in sync with
// the active tab so links/bookmarks/share work AND so we can redirect the
// old bulklinkpro.mygymtools.com domain straight to /bulk-links.
const TABS = [
  { id: 'calendar',   label: 'Calendar',     emoji: '📅', path: '/' },
  { id: 'bulk-links', label: 'Bulk Links',   emoji: '📦', path: '/bulk-links' },
];

// Map a URL pathname (window.location.pathname) to a tab id. Anything
// that isn't a known tab path falls back to the calendar.
function pathToViewId(pathname) {
  const norm = (pathname || '/').toLowerCase();
  if (norm === '/bulk-links' || norm === '/bulk-links/' || norm.startsWith('/bulk-links/')) {
    return 'bulk-links';
  }
  return 'calendar';
}

function MasterNav({ view, onChange }) {
  return (
    <nav
      className="w-full bg-white border-b border-gray-200 px-4 flex items-center gap-1 sticky top-0 z-40 shadow-sm"
      aria-label="Master navigation"
    >
      {TABS.map((tab) => {
        const isActive = view === tab.id;
        return (
          <a
            key={tab.id}
            href={tab.path}
            onClick={(e) => {
              // Plain left-click → switch via SPA routing.
              // Ctrl/Cmd/middle-click → let the browser open in a new tab as normal.
              if (e.metaKey || e.ctrlKey || e.shiftKey || e.button === 1) return;
              e.preventDefault();
              onChange(tab.id);
            }}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-semibold border-b-2 -mb-px transition-colors no-underline ${
              isActive
                ? 'border-pink-500 text-pink-600'
                : 'border-transparent text-gray-500 hover:text-gray-800 hover:border-gray-300'
            }`}
            aria-current={isActive ? 'page' : undefined}
          >
            <span>{tab.emoji}</span>
            <span>{tab.label}</span>
          </a>
        );
      })}
    </nav>
  );
}

function App() {
  // Initial view = whatever URL we landed on. So:
  //   teamcalendar.mygymtools.com/             → Calendar
  //   teamcalendar.mygymtools.com/bulk-links   → Bulk Links
  // And a future bulklinkpro.mygymtools.com → /bulk-links redirect lands here.
  const [view, setView] = useState(() => pathToViewId(window.location.pathname));

  // Keep URL in sync when the user clicks a tab.
  const handleViewChange = useCallback((nextId) => {
    setView(nextId);
    const tab = TABS.find((t) => t.id === nextId);
    if (!tab) return;
    if (window.location.pathname !== tab.path) {
      window.history.pushState({ view: nextId }, '', tab.path);
    }
  }, []);

  // Keep tab in sync when the user hits browser back/forward.
  useEffect(() => {
    const onPop = () => setView(pathToViewId(window.location.pathname));
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  return (
    <ErrorBoundary>
      <div className="App">
        <MasterNav view={view} onChange={handleViewChange} />

        {view === 'calendar' && <EventsDashboard />}

        {view === 'bulk-links' && (
          <Suspense
            fallback={
              <div className="min-h-[60vh] flex items-center justify-center bg-gray-50">
                <p className="text-gray-500 text-sm">Loading Bulk Links…</p>
              </div>
            }
          >
            {/* onClose just flips back to calendar; the master nav also does it */}
            <BulkLinksHub onClose={() => handleViewChange('calendar')} />
          </Suspense>
        )}

        <Analytics />
      </div>
    </ErrorBoundary>
  );
}

export default App;
