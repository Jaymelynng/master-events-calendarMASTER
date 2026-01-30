import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';

export default function ExportModal({ onClose, events, gyms, monthlyRequirements, currentMonth, currentYear }) {
  // NOTE: The 'events' prop is received but not used - component fetches its own data from database
  // based on the date range selector, which allows exporting any date range (not just current view)
  const [selectedGyms, setSelectedGyms] = useState(gyms.map(g => g.id)); // All selected by default
  const [selectedTypes, setSelectedTypes] = useState(['CLINIC', 'KIDS NIGHT OUT', 'OPEN GYM', 'CAMP', 'SPECIAL EVENT']);
  const [exportFormat, setExportFormat] = useState('csv');
  const [includeEvents, setIncludeEvents] = useState(true);
  const [includeAnalytics, setIncludeAnalytics] = useState(false);
  const [includeMissing, setIncludeMissing] = useState(false);
  const [includeAuditCheck, setIncludeAuditCheck] = useState(false);
  const [includeSyncHistory, setIncludeSyncHistory] = useState(false);
  const [includeDismissedWarnings, setIncludeDismissedWarnings] = useState(false);
  
  // Admin check for Sync History (hidden feature)
  // PIN from environment variable (fallback for local dev)
  const SUPER_ADMIN_PIN = process.env.REACT_APP_ADMIN_PIN || '1426';
  const [isAdmin, setIsAdmin] = useState(() => {
    // Check if admin was unlocked in this session (stored in sessionStorage)
    return sessionStorage.getItem('export_admin_unlocked') === 'true';
  });
  
  // Date range - default to current month
  const [startDate, setStartDate] = useState(`${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-01`);
  const [endDate, setEndDate] = useState(new Date(currentYear, currentMonth + 1, 0).toISOString().split('T')[0]);
  
  // Events fetched from database based on date range
  const [fetchedEvents, setFetchedEvents] = useState([]);
  const [loadingEvents, setLoadingEvents] = useState(true);
  const [syncLog, setSyncLog] = useState([]);
  const [loadingSyncLog, setLoadingSyncLog] = useState(false);

  // Quick preset selected
  const [activePreset, setActivePreset] = useState(null);

  const eventTypes = ['CLINIC', 'KIDS NIGHT OUT', 'OPEN GYM', 'CAMP', 'SPECIAL EVENT'];

  // Fetch events when date range changes
  useEffect(() => {
    fetchEventsForDateRange();
  }, [startDate, endDate]);

  // Fetch sync log when needed
  useEffect(() => {
    if (includeSyncHistory && syncLog.length === 0) {
      fetchSyncLog();
    }
  }, [includeSyncHistory]);

  const fetchEventsForDateRange = async () => {
    setLoadingEvents(true);
    try {
      // Use events_with_gym view to include both active AND archived events
      const { data, error } = await supabase
        .from('events_with_gym')
        .select('*')
        .gte('date', startDate)
        .lte('date', endDate)
        .is('deleted_at', null)
        .order('date', { ascending: true });
      
      if (error) throw error;
      setFetchedEvents(data || []);
    } catch (err) {
      console.error('Error fetching events:', err);
      setFetchedEvents([]);
    }
    setLoadingEvents(false);
  };

  const fetchSyncLog = async () => {
    setLoadingSyncLog(true);
    try {
      const { data, error } = await supabase
        .from('sync_log')
        .select('*')
        .order('last_synced', { ascending: false })
        .limit(100);
      
      if (error) throw error;
      setSyncLog(data || []);
    } catch (err) {
      console.error('Error fetching sync log:', err);
      setSyncLog([]);
    }
    setLoadingSyncLog(false);
  };

  // Data flow:
  // - activeEvents: All events in selected date range (unfiltered by user selections)
  // - filteredEvents: Events matching user's gym AND event type selections
  // All export functions should use filteredEvents to respect user selections
  const activeEvents = fetchedEvents;

  const toggleGym = (gymId) => {
    setActivePreset(null);
    setSelectedGyms(prev => 
      prev.includes(gymId) 
        ? prev.filter(id => id !== gymId)
        : [...prev, gymId]
    );
  };

  const toggleType = (type) => {
    setActivePreset(null);
    setSelectedTypes(prev => 
      prev.includes(type) 
        ? prev.filter(t => t !== type)
        : [...prev, type]
    );
  };

  const selectAllGyms = () => { setActivePreset(null); setSelectedGyms(gyms.map(g => g.id)); };
  const selectNoGyms = () => { setActivePreset(null); setSelectedGyms([]); };
  const selectAllTypes = () => { setActivePreset(null); setSelectedTypes([...eventTypes]); };
  const selectNoTypes = () => { setActivePreset(null); setSelectedTypes([]); };

  // Admin unlock for Sync History (hidden feature)
  const unlockAdmin = () => {
    const pin = prompt('Enter PIN to unlock Sync History:');
    if (pin === SUPER_ADMIN_PIN) {
      setIsAdmin(true);
      sessionStorage.setItem('export_admin_unlocked', 'true');
    } else if (pin !== null) {
      alert('Incorrect PIN');
    }
  };

  // Listen for * key to unlock admin
  useEffect(() => {
    if (isAdmin) return; // Already unlocked, no need to listen
    
    const handleKeyDown = (e) => {
      if (e.key === '*') {
        const pin = prompt('Enter PIN to unlock Sync History:');
        if (pin === SUPER_ADMIN_PIN) {
          setIsAdmin(true);
          sessionStorage.setItem('export_admin_unlocked', 'true');
        } else if (pin !== null) {
          alert('Incorrect PIN');
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isAdmin]);

  // ===== QUICK PRESETS =====
  const applyPreset = (presetName) => {
    setActivePreset(presetName);
    
    switch (presetName) {
      case 'monthly-compliance':
        setIncludeEvents(false);
        setIncludeAnalytics(true);
        setIncludeMissing(true);
        setIncludeAuditCheck(false);
        setIncludeSyncHistory(false);
        setSelectedGyms(gyms.map(g => g.id));
        setSelectedTypes(['CLINIC', 'KIDS NIGHT OUT', 'OPEN GYM']);
        setExportFormat('csv');
        break;
      case 'full-backup':
        setIncludeEvents(true);
        setIncludeAnalytics(true);
        setIncludeMissing(true);
        setIncludeAuditCheck(true);
        setIncludeSyncHistory(isAdmin); // Only include if admin unlocked
        setSelectedGyms(gyms.map(g => g.id));
        setSelectedTypes([...eventTypes]);
        setExportFormat('json');
        break;
      case 'printable-report':
        setIncludeEvents(false);
        setIncludeAnalytics(true);
        setIncludeMissing(true);
        setIncludeAuditCheck(false);
        setIncludeSyncHistory(false);
        setSelectedGyms(gyms.map(g => g.id));
        setSelectedTypes(['CLINIC', 'KIDS NIGHT OUT', 'OPEN GYM']);
        setExportFormat('html');
        break;
      case 'audit-check':
        setIncludeEvents(false);
        setIncludeAnalytics(false);
        setIncludeMissing(false);
        setIncludeAuditCheck(true);
        setIncludeSyncHistory(false);
        setSelectedGyms(gyms.map(g => g.id));
        setSelectedTypes([...eventTypes]);
        setExportFormat('csv');
        break;
      case 'sync-status':
        if (!isAdmin) {
          alert('Sync History requires admin access. Press * key to unlock.');
          return;
        }
        setIncludeEvents(false);
        setIncludeAnalytics(false);
        setIncludeMissing(false);
        setIncludeAuditCheck(false);
        setIncludeSyncHistory(true);
        setSelectedGyms(gyms.map(g => g.id));
        setSelectedTypes([...eventTypes]);
        setExportFormat('csv');
        break;
      default:
        break;
    }
  };

  // Filter events based on selections
  const filteredEvents = activeEvents.filter(e => 
    selectedGyms.includes(e.gym_id) && selectedTypes.includes(e.type)
  );

  // Helper: Check if an error message is acknowledged (supports both old string format and new object format)
  const isErrorAcknowledged = (acknowledgedErrors, errorMessage) => {
    if (!acknowledgedErrors || !Array.isArray(acknowledgedErrors)) return false;
    return acknowledgedErrors.some(ack => 
      typeof ack === 'string' ? ack === errorMessage : ack.message === errorMessage
    );
  };

  // Helper: Infer category from error type (for legacy data that doesn't have category field)
  const inferErrorCategory = (error) => {
    if (error.category) return error.category;
    const dataErrorTypes = [
      'year_mismatch', 'date_mismatch', 'time_mismatch', 'age_mismatch',
      'day_mismatch', 'program_mismatch', 'skill_mismatch', 'price_mismatch',
      'title_desc_mismatch', 'camp_price_mismatch'
    ];
    const statusErrorTypes = ['registration_closed', 'registration_not_open', 'sold_out'];
    if (dataErrorTypes.includes(error.type)) return 'data_error';
    if (statusErrorTypes.includes(error.type)) return 'status';
    return 'formatting';
  };

  // Get events with audit check failures (validation errors, missing descriptions, etc.)
  // This matches the "Audit Check" column in the main dashboard table
  // NOTE: Sold out (type: 'sold_out') is excluded - it's informational, not a data quality issue
  const getAuditCheckIssues = () => {
    return filteredEvents.filter(e => {
      const errors = e.validation_errors || [];
      const acknowledged = e.acknowledged_errors || [];
      // Filter out sold_out type AND acknowledged errors (supports both formats)
      const unacknowledged = errors.filter(err => 
        err.type !== 'sold_out' && !isErrorAcknowledged(acknowledged, err.message)
      );
      return unacknowledged.length > 0 || 
             e.description_status === 'none' || 
             e.description_status === 'flyer_only';
    }).map(e => {
      const errors = e.validation_errors || [];
      const acknowledged = e.acknowledged_errors || [];
      // Only include unacknowledged errors (not sold_out)
      const unacknowledgedErrors = errors.filter(err => 
        err.type !== 'sold_out' && !isErrorAcknowledged(acknowledged, err.message)
      );
      
      // Separate by category for better display
      const dataErrors = unacknowledgedErrors.filter(err => inferErrorCategory(err) === 'data_error');
      const formattingErrors = unacknowledgedErrors.filter(err => inferErrorCategory(err) === 'formatting');
      
      return {
        gym_id: e.gym_id,
        gym_name: e.gym_name || e.gym_id,
        title: e.title,
        date: e.date,
        type: e.type,
        // Categorized issue counts
        data_error_count: dataErrors.length,
        formatting_error_count: formattingErrors.length,
        // All issues as formatted strings
        issues: [
          ...dataErrors.map(err => `[DATA ERROR] ${err.message}`),
          ...formattingErrors.map(err => `[FORMATTING] ${err.message}`),
          e.description_status === 'none' ? '[MISSING] No description' : null,
          e.description_status === 'flyer_only' ? '[INCOMPLETE] Flyer only (no text)' : null
        ].filter(Boolean),
        has_flyer: e.has_flyer || false,
        flyer_url: e.flyer_url || null,
        event_url: e.event_url
      };
    });
  };

  // Get events with dismissed warnings (for "View All Exceptions" feature)
  const getDismissedWarnings = () => {
    return filteredEvents.filter(e => {
      const acknowledged = e.acknowledged_errors || [];
      return acknowledged.length > 0;
    }).map(e => {
      const acknowledged = e.acknowledged_errors || [];
      return {
        gym_id: e.gym_id,
        gym_name: e.gym_name || e.gym_id,
        title: e.title,
        date: e.date,
        type: e.type,
        event_url: e.event_url,
        dismissed_count: acknowledged.length,
        dismissed_warnings: acknowledged.map(ack => {
          if (typeof ack === 'string') {
            return { message: ack, note: null, dismissed_at: null };
          }
          return {
            message: ack.message,
            note: ack.note || null,
            dismissed_at: ack.dismissed_at || null
          };
        })
      };
    });
  };

  // Calculate analytics for selected gyms
  // NOTE: Uses filteredEvents to respect both gym AND event type selections
  // Analytics shows ALL gyms with their counts and whether they meet requirements
  const getAnalytics = () => {
    const analytics = [];
    selectedGyms.forEach(gymId => {
      const gym = gyms.find(g => g.id === gymId);
      // FIX: Use filteredEvents instead of activeEvents to respect event type selections
      const gymEvents = filteredEvents.filter(e => e.gym_id === gymId);
      
      const stats = {
        gym_id: gymId,
        gym_name: gym?.name || gymId,
        clinic_count: gymEvents.filter(e => e.type === 'CLINIC').length,
        kno_count: gymEvents.filter(e => e.type === 'KIDS NIGHT OUT').length,
        open_gym_count: gymEvents.filter(e => e.type === 'OPEN GYM').length,
        camp_count: gymEvents.filter(e => e.type === 'CAMP').length,
        special_event_count: gymEvents.filter(e => e.type === 'SPECIAL EVENT').length,
        total_events: gymEvents.length,
        clinic_required: monthlyRequirements?.['CLINIC'] || 1,
        kno_required: monthlyRequirements?.['KIDS NIGHT OUT'] || 2,
        open_gym_required: monthlyRequirements?.['OPEN GYM'] || 1,
        meets_requirements: true,
        missing: []
      };

      // Check requirements
      if (stats.clinic_count < stats.clinic_required) {
        stats.meets_requirements = false;
        stats.missing.push(`${stats.clinic_required - stats.clinic_count} CLINIC`);
      }
      if (stats.kno_count < stats.kno_required) {
        stats.meets_requirements = false;
        stats.missing.push(`${stats.kno_required - stats.kno_count} KNO`);
      }
      if (stats.open_gym_count < stats.open_gym_required) {
        stats.meets_requirements = false;
        stats.missing.push(`${stats.open_gym_required - stats.open_gym_count} OPEN GYM`);
      }

      analytics.push(stats);
    });
    return analytics;
  };

  // Get only gyms with missing requirements
  // NOTE: This is a filtered subset of Analytics - only shows gyms that DON'T meet requirements
  // Analytics = all gyms with counts, Missing Requirements = only failing gyms
  const getMissingGyms = () => {
    return getAnalytics().filter(a => !a.meets_requirements);
  };

  const handleExport = () => {
    const dateRangeLabel = `${startDate} to ${endDate}`;
    const timestamp = new Date().toISOString().split('T')[0];
    
    if (exportFormat === 'csv') {
      exportCSV(dateRangeLabel, timestamp);
    } else if (exportFormat === 'json') {
      exportJSON(dateRangeLabel, timestamp);
    } else if (exportFormat === 'html') {
      exportHTML(dateRangeLabel, timestamp);
    }
    onClose();
  };

  const exportCSV = (monthName, timestamp) => {
    let csvContent = '';
    
    // Events section
    if (includeEvents && filteredEvents.length > 0) {
      csvContent += `EVENTS - ${monthName}\n`;
      csvContent += 'Gym,Gym ID,Title,Type,Date,Day,Time,Price,Ages,Description Status,Has Openings,URL\n';
      filteredEvents.forEach(event => {
        const gym = gyms.find(g => g.id === event.gym_id);
        csvContent += [
          `"${(gym?.name || event.gym_id).replace(/"/g, '""')}"`,
          event.gym_id || '',
          `"${(event.title || '').replace(/"/g, '""')}"`,
          event.type || '',
          event.date || '',
          event.day_of_week || '',
          event.time || '',
          event.price || '',
          event.age_min && event.age_max ? `${event.age_min}-${event.age_max}` : (event.age_min ? `${event.age_min}+` : ''),
          event.description_status || 'unknown',
          event.has_openings === false ? 'SOLD OUT' : 'Available',
          event.event_url || ''
        ].join(',') + '\n';
      });
      csvContent += '\n';
    }

    // Analytics section
    if (includeAnalytics) {
      const analytics = getAnalytics();
      csvContent += `ANALYTICS - ${monthName}\n`;
      csvContent += 'Gym,Gym ID,Clinics,Clinics Req,KNO,KNO Req,Open Gym,Open Gym Req,Camps,Special Events,Total,Meets Requirements,Missing\n';
      analytics.forEach(stat => {
        csvContent += [
          `"${stat.gym_name}"`,
          stat.gym_id,
          stat.clinic_count,
          stat.clinic_required,
          stat.kno_count,
          stat.kno_required,
          stat.open_gym_count,
          stat.open_gym_required,
          stat.camp_count,
          stat.special_event_count,
          stat.total_events,
          stat.meets_requirements ? 'YES' : 'NO',
          `"${stat.missing.join(', ')}"`
        ].join(',') + '\n';
      });
      csvContent += '\n';
    }

    // Missing section
    if (includeMissing) {
      const missing = getMissingGyms();
      csvContent += `GYMS WITH MISSING REQUIREMENTS - ${monthName}\n`;
      csvContent += 'Gym,Gym ID,Missing Events,Clinics Have,KNO Have,Open Gym Have\n';
      missing.forEach(stat => {
        csvContent += [
          `"${stat.gym_name}"`,
          stat.gym_id,
          `"${stat.missing.join(', ')}"`,
          stat.clinic_count,
          stat.kno_count,
          stat.open_gym_count
        ].join(',') + '\n';
      });
      csvContent += '\n';
    }

    // Audit Check section (matches "Audit Check" column in main dashboard)
    if (includeAuditCheck) {
      const issues = getAuditCheckIssues();
      csvContent += `AUDIT CHECK ISSUES - ${monthName}\n`;
      csvContent += `Total events with issues: ${issues.length} out of ${filteredEvents.length} events\n`;
      const totalDataErrors = issues.reduce((sum, i) => sum + i.data_error_count, 0);
      const totalFormattingErrors = issues.reduce((sum, i) => sum + i.formatting_error_count, 0);
      csvContent += `Data Errors (wrong info): ${totalDataErrors} | Formatting Issues (missing info): ${totalFormattingErrors}\n\n`;
      
      if (issues.length > 0) {
        csvContent += 'Gym,Title,Date,Type,Data Errors,Formatting Issues,All Issues,Event URL\n';
        issues.forEach(issue => {
          csvContent += [
            `"${issue.gym_name}"`,
            `"${(issue.title || '').replace(/"/g, '""')}"`,
            issue.date,
            issue.type,
            issue.data_error_count,
            issue.formatting_error_count,
            `"${issue.issues.join('; ')}"`,
            issue.event_url || ''
          ].join(',') + '\n';
        });
      } else {
        csvContent += 'Status,Message\n';
        csvContent += `"✅ No Issues Found","All ${filteredEvents.length} events in the selected date range have complete descriptions and no validation errors."\n`;
      }
      csvContent += '\n';
    }

    // Sync History section
    if (includeSyncHistory && syncLog.length > 0) {
      csvContent += `SYNC HISTORY - Last 100 Syncs\n`;
      csvContent += 'Gym ID,Event Type,Last Synced,Events Found,Events Imported\n';
      syncLog.forEach(log => {
        csvContent += [
          log.gym_id,
          log.event_type,
          new Date(log.last_synced).toLocaleString(),
          log.events_found,
          log.events_imported
        ].join(',') + '\n';
      });
      csvContent += '\n';
    }

    // Dismissed Warnings section (View All Exceptions)
    if (includeDismissedWarnings) {
      const dismissed = getDismissedWarnings();
      csvContent += `DISMISSED WARNINGS (EXCEPTIONS) - ${monthName}\n`;
      if (dismissed.length > 0) {
        csvContent += 'Gym,Title,Date,Type,Dismissed Warning,Note,Dismissed Date,Event URL\n';
        dismissed.forEach(event => {
          event.dismissed_warnings.forEach(warning => {
            csvContent += [
              `"${event.gym_name}"`,
              `"${(event.title || '').replace(/"/g, '""')}"`,
              event.date,
              event.type,
              `"${(warning.message || '').replace(/"/g, '""')}"`,
              `"${(warning.note || '').replace(/"/g, '""')}"`,
              warning.dismissed_at ? new Date(warning.dismissed_at).toLocaleDateString() : '',
              event.event_url || ''
            ].join(',') + '\n';
          });
        });
      } else {
        csvContent += 'Status,Message\n';
        csvContent += `"✅ No Exceptions","No dismissed warnings found in the selected date range."\n`;
      }
      csvContent += '\n';
    }

    downloadFile(csvContent, `export-${timestamp}.csv`, 'text/csv');
  };

  const exportJSON = (monthName, timestamp) => {
    const exportData = {
      exportDate: new Date().toISOString(),
      dateRange: monthName,
      filters: {
        gyms: selectedGyms,
        eventTypes: selectedTypes
      },
      summary: {
        totalEvents: filteredEvents.length,
        totalGyms: selectedGyms.length,
        gymsMeetingRequirements: getAnalytics().filter(a => a.meets_requirements).length,
        gymsWithIssues: getMissingGyms().length,
        auditCheckIssues: getAuditCheckIssues().length
      }
    };

    if (includeEvents) {
      exportData.events = filteredEvents.map(e => ({
        ...e,
        gym_name: gyms.find(g => g.id === e.gym_id)?.name || e.gym_id
      }));
      exportData.eventCount = filteredEvents.length;
    }

    if (includeAnalytics) {
      exportData.analytics = getAnalytics();
    }

    if (includeMissing) {
      exportData.missingRequirements = getMissingGyms();
    }

    if (includeAuditCheck) {
      exportData.auditCheckIssues = getAuditCheckIssues();
    }

    if (includeSyncHistory) {
      exportData.syncHistory = syncLog;
    }

    if (includeDismissedWarnings) {
      exportData.dismissedWarnings = getDismissedWarnings();
    }

    const json = JSON.stringify(exportData, null, 2);
    downloadFile(json, `export-${timestamp}.json`, 'application/json');
  };

  // NEW: HTML Report for Boss/Email
  const exportHTML = (monthName, timestamp) => {
    const analytics = getAnalytics();
    const missing = getMissingGyms();
    const auditCheckCount = getAuditCheckIssues().length;
    const gymsMet = analytics.filter(a => a.meets_requirements).length;
    const totalGyms = analytics.length;
    const compliancePercent = totalGyms > 0 ? Math.round((gymsMet / totalGyms) * 100) : 0;

    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Master Events Calendar Report - ${monthName}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { 
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      background: #f8f9fa; 
      color: #333;
      line-height: 1.6;
    }
    .container { max-width: 900px; margin: 0 auto; padding: 20px; }
    .header {
      background: linear-gradient(135deg, #b48f8f 0%, #8f93a0 100%);
      color: white;
      padding: 30px;
      border-radius: 12px;
      text-align: center;
      margin-bottom: 24px;
      box-shadow: 0 4px 6px rgba(0,0,0,0.1);
    }
    .header h1 { font-size: 28px; margin-bottom: 8px; }
    .header .date-range { font-size: 16px; opacity: 0.9; }
    .header .generated { font-size: 12px; opacity: 0.7; margin-top: 8px; }
    
    .summary-cards {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
      gap: 16px;
      margin-bottom: 24px;
    }
    .summary-card {
      background: white;
      border-radius: 10px;
      padding: 20px;
      text-align: center;
      box-shadow: 0 2px 4px rgba(0,0,0,0.08);
    }
    .summary-card .number { font-size: 36px; font-weight: bold; }
    .summary-card .label { font-size: 14px; color: #666; margin-top: 4px; }
    .summary-card.green .number { color: #22c55e; }
    .summary-card.red .number { color: #ef4444; }
    .summary-card.blue .number { color: #3b82f6; }
    .summary-card.purple .number { color: #8b5cf6; }
    
    .section {
      background: white;
      border-radius: 10px;
      padding: 24px;
      margin-bottom: 20px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.08);
    }
    .section h2 { 
      font-size: 18px; 
      margin-bottom: 16px; 
      padding-bottom: 12px;
      border-bottom: 2px solid #f0f0f0;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    
    table { width: 100%; border-collapse: collapse; font-size: 14px; }
    th, td { padding: 12px; text-align: left; border-bottom: 1px solid #eee; }
    th { background: #f8f9fa; font-weight: 600; color: #555; }
    tr:hover { background: #f8f9fa; }
    
    .badge {
      display: inline-block;
      padding: 4px 10px;
      border-radius: 20px;
      font-size: 12px;
      font-weight: 600;
    }
    .badge.success { background: #dcfce7; color: #166534; }
    .badge.danger { background: #fee2e2; color: #991b1b; }
    .badge.warning { background: #fef3c7; color: #92400e; }
    
    .progress-bar {
      background: #e5e7eb;
      border-radius: 10px;
      height: 20px;
      overflow: hidden;
      margin-top: 8px;
    }
    .progress-fill {
      height: 100%;
      background: linear-gradient(90deg, #22c55e, #16a34a);
      transition: width 0.3s;
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      font-size: 12px;
      font-weight: bold;
    }
    
    .footer {
      text-align: center;
      padding: 20px;
      color: #888;
      font-size: 12px;
    }
    
    @media print {
      body { background: white; }
      .container { max-width: 100%; }
      .section { box-shadow: none; border: 1px solid #ddd; }
    }
    
    .email-copy {
      background: #fffbeb;
      border: 1px solid #fcd34d;
      border-radius: 8px;
      padding: 16px;
      margin-bottom: 24px;
    }
    .email-copy h3 { font-size: 14px; color: #92400e; margin-bottom: 8px; }
    .email-copy pre {
      background: white;
      padding: 12px;
      border-radius: 4px;
      font-size: 13px;
      white-space: pre-wrap;
      font-family: inherit;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>✨ Master Events Calendar Report</h1>
      <div class="date-range">📅 ${monthName}</div>
      <div class="generated">Generated: ${new Date().toLocaleString()}</div>
    </div>
    
    <!-- Email-Ready Summary -->
    <div class="email-copy">
      <h3>📧 Copy-Paste Email Summary:</h3>
      <pre>Monthly Events Report (${monthName})

✅ Compliance: ${gymsMet}/${totalGyms} gyms meeting requirements (${compliancePercent}%)
📊 Total Events: ${filteredEvents.length}
${missing.length > 0 ? `\n⚠️ Gyms Needing Attention:\n${missing.map(m => `   • ${m.gym_name}: needs ${m.missing.join(', ')}`).join('\n')}` : '✅ All gyms are compliant!'}
${auditCheckCount > 0 ? `\n🔍 ${auditCheckCount} events have audit check issues` : ''}</pre>
    </div>
    
    <div class="summary-cards">
      <div class="summary-card blue">
        <div class="number">${filteredEvents.length}</div>
        <div class="label">Total Events</div>
      </div>
      <div class="summary-card ${compliancePercent === 100 ? 'green' : compliancePercent >= 80 ? 'purple' : 'red'}">
        <div class="number">${compliancePercent}%</div>
        <div class="label">Compliance Rate</div>
      </div>
      <div class="summary-card green">
        <div class="number">${gymsMet}</div>
        <div class="label">Gyms Compliant</div>
      </div>
      <div class="summary-card ${missing.length > 0 ? 'red' : 'green'}">
        <div class="number">${missing.length}</div>
        <div class="label">Gyms Needing Action</div>
      </div>
    </div>
    
    <div class="section">
      <h2>📊 Compliance Progress</h2>
      <div class="progress-bar">
        <div class="progress-fill" style="width: ${compliancePercent}%">${compliancePercent}%</div>
      </div>
      <p style="margin-top: 8px; font-size: 14px; color: #666;">
        ${gymsMet} of ${totalGyms} gyms have met their monthly event requirements
      </p>
    </div>
    
    <div class="section">
      <h2>🏢 Gym Performance Summary</h2>
      <table>
        <thead>
          <tr>
            <th>Gym</th>
            <th style="text-align:center">Clinics</th>
            <th style="text-align:center">KNO</th>
            <th style="text-align:center">Open Gym</th>
            <th style="text-align:center">Total</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          ${analytics.map(stat => `
          <tr>
            <td><strong>${stat.gym_name}</strong><br><small style="color:#888">${stat.gym_id}</small></td>
            <td style="text-align:center">${stat.clinic_count}/${stat.clinic_required}</td>
            <td style="text-align:center">${stat.kno_count}/${stat.kno_required}</td>
            <td style="text-align:center">${stat.open_gym_count}/${stat.open_gym_required}</td>
            <td style="text-align:center">${stat.total_events}</td>
            <td>
              ${stat.meets_requirements 
                ? '<span class="badge success">✅ Complete</span>' 
                : `<span class="badge danger">❌ Missing: ${stat.missing.join(', ')}</span>`}
            </td>
          </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
    
    ${missing.length > 0 ? `
    <div class="section" style="border-left: 4px solid #ef4444;">
      <h2>⚠️ Action Required</h2>
      <p style="margin-bottom: 16px; color: #666;">The following gyms need additional events to meet monthly requirements:</p>
      <table>
        <thead>
          <tr>
            <th>Gym</th>
            <th>Missing</th>
          </tr>
        </thead>
        <tbody>
          ${missing.map(m => `
          <tr>
            <td><strong>${m.gym_name}</strong></td>
            <td><span class="badge warning">${m.missing.join(', ')}</span></td>
          </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
    ` : `
    <div class="section" style="border-left: 4px solid #22c55e;">
      <h2>🎉 All Gyms Compliant!</h2>
      <p>Every gym has met their monthly event requirements. Great work!</p>
    </div>
    `}
    
    ${includeAuditCheck ? `
    <div class="section" style="border-left: 4px solid #f59e0b;">
      <h2>🔍 Audit Check Issues (${getAuditCheckIssues().length} events)</h2>
      ${getAuditCheckIssues().length > 0 ? `
      <p style="margin-bottom: 16px; color: #666;">Events with data errors, formatting issues, or missing descriptions:</p>
      <table>
        <thead>
          <tr>
            <th>Gym</th>
            <th>Event</th>
            <th>Date</th>
            <th style="text-align:center">Data Errors</th>
            <th style="text-align:center">Formatting</th>
            <th>Issues</th>
          </tr>
        </thead>
        <tbody>
          ${getAuditCheckIssues().slice(0, 100).map(issue => `
          <tr>
            <td><small style="color:#888">${issue.gym_id}</small></td>
            <td><strong>${issue.title?.substring(0, 40)}${issue.title?.length > 40 ? '...' : ''}</strong></td>
            <td>${issue.date}</td>
            <td style="text-align:center">${issue.data_error_count > 0 ? `<span class="badge danger">${issue.data_error_count}</span>` : '-'}</td>
            <td style="text-align:center">${issue.formatting_error_count > 0 ? `<span class="badge warning">${issue.formatting_error_count}</span>` : '-'}</td>
            <td><small>${issue.issues.slice(0, 2).join('; ')}${issue.issues.length > 2 ? '...' : ''}</small></td>
          </tr>
          `).join('')}
        </tbody>
      </table>
      ${getAuditCheckIssues().length > 100 ? `<p style="margin-top: 12px; color: #888; font-size: 12px;">Showing first 100 of ${getAuditCheckIssues().length} issues. Export to CSV for full list.</p>` : ''}
      ` : `
      <p style="color: #22c55e;">✅ No audit issues found! All events have complete descriptions and no validation errors.</p>
      `}
    </div>
    ` : ''}
    
    <div class="footer">
      <p>Master Events Calendar • Report generated automatically</p>
      <p style="margin-top: 4px;">
        <button onclick="window.print()" style="padding: 8px 16px; background: #3b82f6; color: white; border: none; border-radius: 6px; cursor: pointer;">
          🖨️ Print Report
        </button>
      </p>
    </div>
  </div>
</body>
</html>
    `;

    // Open in new tab for viewing/printing
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
  };

  const downloadFile = (content, filename, mimeType) => {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const canExport = (includeEvents || includeAnalytics || includeMissing || includeAuditCheck || includeSyncHistory || includeDismissedWarnings) && 
                   (selectedGyms.length > 0 || includeMissing || includeSyncHistory || includeDismissedWarnings);

  // Calculate audit check issues count for display (matches "Audit Check" column in main dashboard)
  const auditCheckCount = getAuditCheckIssues().length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
      <div className="bg-white rounded-lg p-6 w-full max-w-3xl mx-4 max-h-[95vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            📤 Export & Reports
          </h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700 text-2xl font-bold">×</button>
        </div>

        {/* Quick Presets - NEW */}
        <div className="mb-6 p-4 bg-gradient-to-r from-purple-50 to-indigo-50 rounded-lg border border-purple-200">
          <h3 className="font-semibold text-purple-800 mb-3 flex items-center gap-2">
            ⚡ Quick Presets
            <span className="text-xs font-normal text-purple-600">(One-click export configurations)</span>
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
            <button
              onClick={() => applyPreset('monthly-compliance')}
              className={`p-3 rounded-lg border-2 transition-all text-center ${
                activePreset === 'monthly-compliance' 
                  ? 'border-purple-500 bg-purple-100' 
                  : 'border-gray-200 bg-white hover:border-purple-300'
              }`}
            >
              <div className="text-xl mb-1">📊</div>
              <div className="text-xs font-semibold text-gray-800">Monthly Compliance</div>
            </button>
            <button
              onClick={() => applyPreset('printable-report')}
              className={`p-3 rounded-lg border-2 transition-all text-center ${
                activePreset === 'printable-report' 
                  ? 'border-purple-500 bg-purple-100' 
                  : 'border-gray-200 bg-white hover:border-purple-300'
              }`}
            >
              <div className="text-xl mb-1">🖨️</div>
              <div className="text-xs font-semibold text-gray-800">Printable Report</div>
              <div className="text-xs text-purple-600">HTML</div>
            </button>
            <button
              onClick={() => applyPreset('full-backup')}
              className={`p-3 rounded-lg border-2 transition-all text-center ${
                activePreset === 'full-backup' 
                  ? 'border-purple-500 bg-purple-100' 
                  : 'border-gray-200 bg-white hover:border-purple-300'
              }`}
            >
              <div className="text-xl mb-1">💾</div>
              <div className="text-xs font-semibold text-gray-800">Full Backup</div>
              <div className="text-xs text-blue-600">JSON</div>
            </button>
            <button
              onClick={() => applyPreset('audit-check')}
              className={`p-3 rounded-lg border-2 transition-all text-center ${
                activePreset === 'audit-check' 
                  ? 'border-purple-500 bg-purple-100' 
                  : 'border-gray-200 bg-white hover:border-purple-300'
              }`}
            >
              <div className="text-xl mb-1">🔍</div>
              <div className="text-xs font-semibold text-gray-800">Audit Check</div>
              {auditCheckCount > 0 && (
                <div className="text-xs text-red-600">{auditCheckCount} issues</div>
              )}
            </button>
            {/* Sync History Preset - Admin Only */}
            {isAdmin && (
              <button
                onClick={() => applyPreset('sync-status')}
                className={`p-3 rounded-lg border-2 transition-all text-center ${
                  activePreset === 'sync-status' 
                    ? 'border-purple-500 bg-purple-100' 
                    : 'border-gray-200 bg-white hover:border-purple-300'
                }`}
              >
                <div className="text-xl mb-1">🔄</div>
                <div className="text-xs font-semibold text-gray-800">Sync History</div>
              </button>
            )}
          </div>
        </div>

        {/* Date Range Selection */}
        <div className="mb-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
          <h3 className="font-semibold text-gray-800 mb-3">📅 Date Range:</h3>
          
          {/* Quick date range buttons */}
          <div className="flex flex-wrap gap-2 mb-3">
            <button
              onClick={() => {
                const today = new Date();
                const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
                const lastOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
                setStartDate(firstOfMonth.toISOString().split('T')[0]);
                setEndDate(lastOfMonth.toISOString().split('T')[0]);
              }}
              className="px-3 py-1.5 text-xs bg-gray-200 hover:bg-gray-300 rounded-lg transition-colors"
            >
              📆 This Month
            </button>
            <button
              onClick={() => {
                const today = new Date();
                setStartDate(today.toISOString().split('T')[0]);
                // Set end date to Dec 31 of next year (covers all future events)
                const endOfNextYear = new Date(today.getFullYear() + 1, 11, 31);
                setEndDate(endOfNextYear.toISOString().split('T')[0]);
              }}
              className="px-3 py-1.5 text-xs bg-blue-100 hover:bg-blue-200 text-blue-700 rounded-lg transition-colors font-medium"
            >
              🚀 All Future (from today)
            </button>
            <button
              onClick={() => {
                const today = new Date();
                const startOfYear = new Date(today.getFullYear(), 0, 1);
                const endOfYear = new Date(today.getFullYear(), 11, 31);
                setStartDate(startOfYear.toISOString().split('T')[0]);
                setEndDate(endOfYear.toISOString().split('T')[0]);
              }}
              className="px-3 py-1.5 text-xs bg-gray-200 hover:bg-gray-300 rounded-lg transition-colors"
            >
              📅 Full Year {new Date().getFullYear()}
            </button>
            <button
              onClick={() => {
                // Everything in database - Jan 2024 to Dec 2027
                setStartDate('2024-01-01');
                setEndDate('2027-12-31');
              }}
              className="px-3 py-1.5 text-xs bg-purple-100 hover:bg-purple-200 text-purple-700 rounded-lg transition-colors"
            >
              💾 Entire Database
            </button>
          </div>
          
          <div className="flex flex-wrap items-center gap-4">
            <div>
              <label className="text-xs text-gray-500 block mb-1">From:</label>
              <input 
                type="date" 
                value={startDate}
                onChange={(e) => { setStartDate(e.target.value); setActivePreset(null); }}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">To:</label>
              <input 
                type="date" 
                value={endDate}
                onChange={(e) => { setEndDate(e.target.value); setActivePreset(null); }}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none"
              />
            </div>
            {loadingEvents && (
              <div className="text-sm text-blue-600 flex items-center gap-2 self-end pb-2">
                <span className="animate-spin">⏳</span> Loading...
              </div>
            )}
          </div>
          {!loadingEvents && (
            <div className="mt-2 text-sm text-gray-600">
              Found <span className="font-semibold text-blue-600">{activeEvents.length}</span> events in selected range
            </div>
          )}
        </div>

        {/* What to Export */}
        <div className="mb-4 p-4 bg-amber-50 rounded-lg border border-amber-200">
          <h3 className="font-semibold text-amber-800 mb-3">What to export:</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            <label className="flex items-center gap-2 cursor-pointer p-2 rounded hover:bg-amber-100">
              <input 
                type="checkbox" 
                checked={includeEvents} 
                onChange={(e) => { setIncludeEvents(e.target.checked); setActivePreset(null); }}
                className="w-4 h-4 text-amber-600"
              />
              <span className="text-gray-700">
                📋 Event Details 
                <span className="text-xs text-gray-500 ml-1">
                  {loadingEvents ? '(loading...)' : `(${filteredEvents.length} events)`}
                </span>
              </span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer p-2 rounded hover:bg-amber-100">
              <input 
                type="checkbox" 
                checked={includeAnalytics} 
                onChange={(e) => { setIncludeAnalytics(e.target.checked); setActivePreset(null); }}
                className="w-4 h-4 text-amber-600"
              />
              <span className="text-gray-700">📊 Analytics Dashboard</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer p-2 rounded hover:bg-amber-100">
              <input 
                type="checkbox" 
                checked={includeMissing} 
                onChange={(e) => { setIncludeMissing(e.target.checked); setActivePreset(null); }}
                className="w-4 h-4 text-amber-600"
              />
              <span className="text-gray-700">⚠️ Missing Requirements</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer p-2 rounded hover:bg-amber-100">
              <input 
                type="checkbox" 
                checked={includeAuditCheck} 
                onChange={(e) => { setIncludeAuditCheck(e.target.checked); setActivePreset(null); }}
                className="w-4 h-4 text-amber-600"
              />
              <span className="text-gray-700">🔍 Audit Check (validation errors, missing descriptions)</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer p-2 rounded hover:bg-amber-100">
              <input 
                type="checkbox" 
                checked={includeDismissedWarnings} 
                onChange={(e) => { setIncludeDismissedWarnings(e.target.checked); setActivePreset(null); }}
                className="w-4 h-4 text-amber-600"
              />
              <span className="text-gray-700">
                ✓ Dismissed Warnings (exceptions with notes)
                {!loadingEvents && getDismissedWarnings().length > 0 && (
                  <span className="text-xs text-green-600 ml-1">({getDismissedWarnings().length} events)</span>
                )}
              </span>
            </label>
            {/* Sync History - Admin Only */}
            {isAdmin ? (
              <label className="flex items-center gap-2 cursor-pointer p-2 rounded hover:bg-amber-100">
                <input 
                  type="checkbox" 
                  checked={includeSyncHistory} 
                  onChange={(e) => { setIncludeSyncHistory(e.target.checked); setActivePreset(null); }}
                  className="w-4 h-4 text-amber-600"
                />
                <span className="text-gray-700">
                  🔄 Sync History
                  {loadingSyncLog && <span className="text-xs text-blue-600 ml-1">(loading...)</span>}
                  {!loadingSyncLog && syncLog.length > 0 && (
                    <span className="text-xs text-gray-500 ml-1">({syncLog.length} records)</span>
                  )}
                </span>
              </label>
            ) : (
              <div className="flex items-center gap-2 p-2 rounded opacity-50 cursor-not-allowed">
                <span className="text-gray-400 text-sm">
                  🔒 Sync History (Admin Only - Press * to unlock)
                </span>
              </div>
            )}
          </div>

          {/* Preview of missing gyms - ONLY shows when checkbox is checked */}
          {includeMissing && !loadingEvents && (
            <div className={`mt-3 p-2 rounded border text-xs ${getMissingGyms().length > 0 ? 'bg-red-50 border-red-200' : 'bg-green-50 border-green-200'}`}>
              <div className="font-semibold text-gray-600 mb-1">
                📅 Checking date range: {startDate} to {endDate}
              </div>
              {getMissingGyms().length > 0 ? (
                <>
                  <div className="font-semibold text-red-700 mb-1">
                    ⚠️ {getMissingGyms().length} gym{getMissingGyms().length !== 1 ? 's' : ''} missing requirements:
                  </div>
                  {getMissingGyms().map(gym => (
                    <div key={gym.gym_id} className="text-red-600">
                      • {gym.gym_id}: needs {gym.missing.join(', ')}
                    </div>
                  ))}
                </>
              ) : (
                <div className="font-semibold text-green-700">
                  ✅ All {selectedGyms.length} gyms meet requirements for this date range!
                </div>
              )}
            </div>
          )}

          {/* Preview of audit check issues - ONLY shows when checkbox is checked */}
          {includeAuditCheck && !loadingEvents && (
            <div className={`mt-3 p-2 rounded border text-xs ${getAuditCheckIssues().length > 0 ? 'bg-orange-50 border-orange-200' : 'bg-green-50 border-green-200'}`}>
              <div className="font-semibold text-gray-600 mb-1">
                📅 Checking date range: {startDate} to {endDate}
              </div>
              <div className="text-gray-500 mb-2 text-xs italic">
                Checks for: validation errors, missing descriptions, flyer-only descriptions
              </div>
              {getAuditCheckIssues().length > 0 ? (
                <>
                  <div className="font-semibold text-orange-700 mb-1">
                    ⚠️ Found {getAuditCheckIssues().length} event{getAuditCheckIssues().length !== 1 ? 's' : ''} with audit check issues
                  </div>
                  <div className="text-orange-600 text-xs">
                    Export will include: event details + specific issues found
                  </div>
                </>
              ) : (
                <div className="font-semibold text-green-700">
                  ✅ No audit check issues found! All {filteredEvents.length} events have complete descriptions and no validation errors.
                </div>
              )}
            </div>
          )}

          {/* Preview of dismissed warnings - ONLY shows when checkbox is checked */}
          {includeDismissedWarnings && !loadingEvents && (
            <div className={`mt-3 p-2 rounded border text-xs ${getDismissedWarnings().length > 0 ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-200'}`}>
              <div className="font-semibold text-gray-600 mb-1">
                📅 Checking date range: {startDate} to {endDate}
              </div>
              {getDismissedWarnings().length > 0 ? (
                <>
                  <div className="font-semibold text-green-700 mb-1">
                    ✓ Found {getDismissedWarnings().length} event{getDismissedWarnings().length !== 1 ? 's' : ''} with dismissed warnings
                  </div>
                  <div className="text-green-600 text-xs mb-2">
                    Export will include: event details + dismissed warnings + notes
                  </div>
                  <div className="max-h-32 overflow-y-auto">
                    {getDismissedWarnings().slice(0, 5).map((event, idx) => (
                      <div key={idx} className="text-green-700 text-xs mb-1">
                        • {event.gym_name}: {event.title?.substring(0, 40)}... ({event.dismissed_count} dismissed)
                      </div>
                    ))}
                    {getDismissedWarnings().length > 5 && (
                      <div className="text-green-500 text-xs italic">
                        ... and {getDismissedWarnings().length - 5} more
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <div className="font-semibold text-gray-500">
                  No dismissed warnings found in the selected date range.
                </div>
              )}
            </div>
          )}
        </div>

        {/* Gyms Selection */}
        <div className="mb-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
          <div className="flex justify-between items-center mb-3">
            <h3 className="font-semibold text-blue-800">Select Gyms:</h3>
            <div className="flex gap-2">
              <button onClick={selectAllGyms} className="text-xs px-2 py-1 bg-blue-200 hover:bg-blue-300 rounded">All</button>
              <button onClick={selectNoGyms} className="text-xs px-2 py-1 bg-gray-200 hover:bg-gray-300 rounded">None</button>
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {gyms.map(gym => (
              <label key={gym.id} className="flex items-center gap-2 cursor-pointer text-sm hover:bg-blue-100 p-1 rounded">
                <input 
                  type="checkbox" 
                  checked={selectedGyms.includes(gym.id)} 
                  onChange={() => toggleGym(gym.id)}
                  className="w-4 h-4 text-blue-600"
                />
                <span className="text-gray-700 truncate">{gym.id} - {gym.name?.split(' ').slice(0, 2).join(' ')}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Event Types Selection */}
        <div className="mb-4 p-4 bg-purple-50 rounded-lg border border-purple-200">
          <div className="flex justify-between items-center mb-3">
            <h3 className="font-semibold text-purple-800">Select Event Types:</h3>
            <div className="flex gap-2">
              <button onClick={selectAllTypes} className="text-xs px-2 py-1 bg-purple-200 hover:bg-purple-300 rounded">All</button>
              <button onClick={selectNoTypes} className="text-xs px-2 py-1 bg-gray-200 hover:bg-gray-300 rounded">None</button>
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            {eventTypes.map(type => {
              const isRequired = ['CLINIC', 'KIDS NIGHT OUT', 'OPEN GYM'].includes(type);
              return (
                <label key={type} className={`flex items-center gap-2 cursor-pointer text-sm hover:bg-purple-100 p-1 rounded ${!isRequired ? 'opacity-60' : ''}`}>
                  <input 
                    type="checkbox" 
                    checked={selectedTypes.includes(type)} 
                    onChange={() => toggleType(type)}
                    className="w-4 h-4 text-purple-600"
                  />
                  <span className="text-gray-700">
                    {type}
                    {isRequired && <span className="text-red-500 ml-0.5">*</span>}
                  </span>
                </label>
              );
            })}
          </div>
          <div className="mt-2 text-xs text-gray-500">
            <span className="text-red-500">*</span> = Required for monthly compliance
          </div>
        </div>

        {/* Format Selection */}
        <div className="mb-6 p-4 bg-green-50 rounded-lg border border-green-200">
          <h3 className="font-semibold text-green-800 mb-3">Export Format:</h3>
          <div className="flex flex-wrap gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input 
                type="radio" 
                name="format" 
                value="csv" 
                checked={exportFormat === 'csv'} 
                onChange={() => { setExportFormat('csv'); setActivePreset(null); }}
                className="w-4 h-4 text-green-600"
              />
              <span className="text-gray-700">📊 CSV <span className="text-xs text-gray-500">(Excel, Sheets)</span></span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input 
                type="radio" 
                name="format" 
                value="json" 
                checked={exportFormat === 'json'} 
                onChange={() => { setExportFormat('json'); setActivePreset(null); }}
                className="w-4 h-4 text-green-600"
              />
              <span className="text-gray-700">📋 JSON <span className="text-xs text-gray-500">(Data backup)</span></span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input 
                type="radio" 
                name="format" 
                value="html" 
                checked={exportFormat === 'html'} 
                onChange={() => { setExportFormat('html'); setActivePreset(null); }}
                className="w-4 h-4 text-green-600"
              />
              <span className="text-gray-700">🖨️ HTML Report <span className="text-xs text-purple-600">(Print/Email)</span></span>
            </label>
          </div>
          {exportFormat === 'html' && (
            <div className="mt-3 p-2 bg-green-100 rounded text-xs text-green-800">
              📧 HTML report includes a copy-paste email summary and print button
            </div>
          )}
        </div>

        {/* Export Button */}
        <div className="flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleExport}
            disabled={!canExport}
            className={`px-6 py-3 rounded-lg font-semibold transition-all ${
              canExport 
                ? 'bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white shadow-lg hover:shadow-xl' 
                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
            }`}
          >
            📤 Export {exportFormat.toUpperCase()}
          </button>
        </div>
      </div>
    </div>
  );
}
