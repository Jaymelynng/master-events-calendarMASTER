// /camps - the Camp Data view on its own address, to hand to managers (Jayme 2026-11-12: "it to be its own url so
// i can give them the url and it just shows this" · "All gyms, one link"). Same screen as Admin > Camp Data,
// read-only, live from Supabase; no calendar, no Admin, nothing to edit, no parent names (counts only).
import React, { useEffect, useState } from 'react';
import { gymsApi } from '../lib/api';
import AdminCampData from './AdminDashboard/AdminCampData';

export default function CampsPage() {
  const [gyms, setGyms] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    document.title = 'Summer Camps';
    gymsApi.getAll().then(setGyms).catch((e) => setError(e.message));
  }, []);

  return (
    <div style={{ minHeight: '100vh', background: '#e9edf3', padding: '18px max(16px, env(safe-area-inset-left, 0px))' }}>
      <h1 style={{ margin: '0 0 14px', fontSize: 24, fontWeight: 800, color: '#14181f' }}>Summer Camps</h1>
      {error && <div style={{ background: '#fde2e2', color: '#8a1616', borderRadius: 10, padding: '10px 12px', fontWeight: 700 }}>Could not load the gyms: {error}</div>}
      {!gyms && !error && <p style={{ color: '#3f4857' }}>Loading…</p>}
      {gyms && <AdminCampData gyms={gyms} />}
    </div>
  );
}
