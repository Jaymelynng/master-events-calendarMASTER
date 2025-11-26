import React from 'react';
import { Analytics } from '@vercel/analytics/react';
import EventsDashboard from './components/EventsDashboard';
import './App.css';

function App() {
  return (
    <div className="App">
      <EventsDashboard />
      <Analytics />
    </div>
  );
}

export default App; 