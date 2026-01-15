import React from 'react';
import { Analytics } from '@vercel/analytics/react';
import EventsDashboard from './components/EventsDashboard';
import ErrorBoundary from './components/ErrorBoundary';
import './App.css';

function App() {
  return (
    <ErrorBoundary>
      <div className="App">
        <EventsDashboard />
        <Analytics />
      </div>
    </ErrorBoundary>
  );
}

export default App; 