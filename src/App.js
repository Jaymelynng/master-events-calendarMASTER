import React from 'react';
import { Analytics } from '@vercel/analytics/react';
import EventsDashboard from './components/EventsDashboard_REFACTORED';
import ErrorBoundary from './components/ErrorBoundary';
import CampsPage from './components/CampsPage';
import './App.css';

// teamcalendar.mygymtools.com/camps = the summer camp view alone (vercel.json already sends every address to
// this app); every other address is the calendar.
const isCampsPage = /^\/camps\/?$/i.test(window.location.pathname);

function App() {
  return (
    <ErrorBoundary>
      <div className="App">
        {isCampsPage ? <CampsPage /> : <EventsDashboard />}
        <Analytics />
      </div>
    </ErrorBoundary>
  );
}

export default App;
