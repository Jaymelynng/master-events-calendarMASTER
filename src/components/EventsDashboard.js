import React, { useState, useMemo, useRef, useEffect, Suspense, lazy } from 'react';
import { 
  Calendar, Clock, DollarSign, MapPin, Filter, Search, Grid, List, Plus, 
  ChevronUp, ChevronLeft, ChevronRight, AlertCircle, Loader, Copy, CheckCircle, Users
} from 'lucide-react';

// Import real API functions
import { gymsApi, eventsApi, eventTypesApi, monthlyRequirementsApi, gymValidValuesApi } from '../lib/api';
import { gymLinksApi } from '../lib/gymLinksApi';
import { cachedApi, cache } from '../lib/cache';
import { supabase } from '../lib/supabase';
import { useRealtimeEvents, useRealtimeGymLinks, useRealtimeGyms } from '../lib/useRealtimeEvents';
import AdminPortalModal from './EventsDashboard/AdminPortalModal';
import SyncModal from './EventsDashboard/SyncModal';
import ExportModal from './EventsDashboard/ExportModal';

// Exact Color Theme from user's specification
const theme = {
  colors: {
    primary: '#b48f8f',        // Blush pink - primary brand highlight
    secondary: '#cec4c1',      // Neutral gray-beige - cards, secondary elements
    accent: '#8f93a0',         // Gray-blue - subtle highlights
    textPrimary: '#4a4a4a',    // Dark gray - main text (enhanced)
    textSecondary: '#8f93a0',  // Medium gray - secondary text (enhanced)
    success: '#22c55e',        // Green - success states
    warning: '#f59e0b',        // Orange - warnings
    error: '#ef4444',          // Red - errors
    background: '#f9fafb',     // Light background (enhanced)
  },
  gradients: {
    background: 'linear-gradient(135deg, #fdf7f7 0%, #f5f1f1 50%, #f0ebeb 100%)',
    card: 'linear-gradient(135deg, rgba(255,255,255,0.9) 0%, rgba(255,255,255,0.7) 100%)',
  }
};

// Gym logo placeholder colors (until real logos are added)
const gymColors = {
  'CCP': '#1f53a3',  // Blue
  'CPF': '#1f53a3',  // Blue
  'CRR': '#ff1493',  // Pink
  'HGA': '#c91724',  // Red
  'RBA': '#1a3c66',  // Dark blue
  'RBK': '#1a3c66',  // Dark blue
  'EST': '#011837',  // Navy
  'OAS': '#3eb29f',  // Teal
  'SGT': '#c72b12',  // Orange-red
  'TIG': '#f57f20',  // Orange
};

// Event types and requirements will be loaded from database

// Safely parse a 'YYYY-MM-DD' date string in LOCAL time to avoid UTC shifts
const parseYmdLocal = (ymd) => {
  if (!ymd || typeof ymd !== 'string') return new Date(ymd);
  const parts = ymd.split('-');
  if (parts.length !== 3) return new Date(ymd);
  const [y, m, d] = parts.map(Number);
  if (!y || !m || !d) return new Date(ymd);
  return new Date(y, m - 1, d);
};

// Utility function to convert 24-hour time to 12-hour format
const formatTime = (timeString) => {
  if (!timeString) return 'No time set';
  
  // If it's already in 12-hour format (contains AM/PM), return as is
  if (timeString.includes('AM') || timeString.includes('PM')) {
    return timeString;
  }
  
  // Handle 24-hour format (HH:MM)
  const [hours, minutes] = timeString.split(':');
  const hour24 = parseInt(hours);
  const hour12 = hour24 === 0 ? 12 : hour24 > 12 ? hour24 - 12 : hour24;
  const ampm = hour24 >= 12 ? 'PM' : 'AM';
  
  return `${hour12}:${minutes} ${ampm}`;
};

// ALL DATA NOW COMES FROM SUPABASE - NO HARDCODED LINKS

// Monthly requirements will now be fetched live from Supabase

// Custom hooks
const useGyms = () => {
  const [gyms, setGyms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchGyms = async () => {
      try {
        const data = await cachedApi.getGyms();
        setGyms(data || []);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchGyms();
  }, []);

  // 🔴 REAL-TIME: Subscribe to gyms table changes
  useRealtimeGyms((payload) => {
    console.log('🔴 Gym changed in database:', payload.eventType);
    
    // Invalidate cache and refetch
    cache.invalidate('gyms');
    
    const refreshGyms = async () => {
      try {
        const data = await gymsApi.getAll();
        setGyms(data || []);
      } catch (err) {
        console.error('Error refreshing gyms:', err);
      }
    };
    
    refreshGyms();
  });

  return { gyms, loading, error };
};

const useGymLinks = () => {
  const [gymLinks, setGymLinks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refreshGymLinks = async () => {
    try {
      const data = await gymLinksApi.getAllLinksDetailed();
      setGymLinks(data || []);
      setError(null);
    } catch (err) {
      console.error('Error refreshing gym links:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshGymLinks();
  }, []);

  // 🔴 REAL-TIME: Subscribe to gym_links table changes
  useRealtimeGymLinks((payload) => {
    console.log('🔴 Gym link changed in database:', payload.eventType);
    
    // Invalidate cache and refetch
    cache.invalidate('gymLinks');
    refreshGymLinks();
  });

  return { gymLinks, loading, error, refreshGymLinks };
};

const useEventTypes = () => {
  const [eventTypes, setEventTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchEventTypes = async () => {
      try {
        const data = await cachedApi.getEventTypes();
        setEventTypes(data || []);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchEventTypes();
  }, []);

  return { eventTypes, loading, error };
};

const useEvents = (startDate, endDate) => {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Fetch events initially
  useEffect(() => {
    const fetchEvents = async () => {
      try {
        setLoading(true);
        const data = await cachedApi.getEvents(startDate, endDate);
        setEvents(data || []);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    if (startDate && endDate) {
      fetchEvents();
    }
  }, [startDate, endDate]);

  // 🔴 REAL-TIME: Subscribe to events table changes
  // This makes the app "attached" to Supabase - changes appear automatically!
  useRealtimeEvents((payload) => {
    console.log('🔴 Event changed in database:', payload.eventType);
    
    // When ANY event changes, refresh the data (invalidate cache)
    cache.invalidate('events');
    
    // Refetch events to get the latest data
    const refreshEvents = async () => {
      try {
        const data = await eventsApi.getAll(startDate, endDate);
        setEvents(data || []);
      } catch (err) {
        console.error('Error refreshing events:', err);
      }
    };
    
    refreshEvents();
  });

  const refetch = async () => {
    try {
      setLoading(true);
      const data = await eventsApi.getAll(startDate, endDate);
      setEvents(data || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return { events, loading, error, refetch };
};

const useMonthlyRequirements = () => {
  const [requirements, setRequirements] = useState({});
  useEffect(() => {
    const fetchRequirements = async () => {
      try {
        const data = await monthlyRequirementsApi.getAll();
        const map = {};
        (data || []).forEach((row) => {
          map[row.event_type] = row.required_count;
        });
        setRequirements(map);
      } catch (err) {
        console.error('Error fetching monthly requirements:', err.message);
      }
    };
    fetchRequirements();
  }, []);
  return requirements;
};

// Lazy-loaded admin modals to reduce initial bundle size
const AddEventModal = lazy(() => import('./EventsDashboard/AddEventModal'));
const BulkImportModal = lazy(() => import('./EventsDashboard/BulkImportModal'));

const EventsDashboard = () => {
  // State management
  const [selectedGym, setSelectedGym] = useState('all');
  const [selectedEventType, setSelectedEventType] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState('calendar');
  // Dynamic month - starts with current month
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth()); // Current month (0-indexed)  
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear()); // Current year
  const [calendarView, setCalendarView] = useState('full'); // Start with full month view
  const [selectedEventForPanel, setSelectedEventForPanel] = useState(null);
  const [showBackToTop, setShowBackToTop] = useState(false);

  const [copiedUrl, setCopiedUrl] = useState(null);
  const [copySuccess, setCopySuccess] = useState('');

  const [showAddEventModal, setShowAddEventModal] = useState(false);
  const [showBulkImportModal, setShowBulkImportModal] = useState(false);
  const [showSyncModal, setShowSyncModal] = useState(false);
  const [editingEvent, setEditingEvent] = useState(null);
  const [bulkImportData, setBulkImportData] = useState('');
  const [rawEventListings, setRawEventListings] = useState('');
  const [bulkImportEventType, setBulkImportEventType] = useState('AUTO_DETECT');
  const [validationResults, setValidationResults] = useState(null);
  // Admin timing metrics for benchmarking the workflow
  const [importTiming, setImportTiming] = useState({ convertMs: null, importMs: null, totalMs: null });
  const [showAuditHistory, setShowAuditHistory] = useState(false);
  const [auditHistory, setAuditHistory] = useState([]);
  const [loadingAudit, setLoadingAudit] = useState(false);
  const [selectedGymId, setSelectedGymId] = useState('');
  
  // New Admin Portal State (safe addition)
  const [showAdminPortal, setShowAdminPortal] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [newEvent, setNewEvent] = useState({
    gym_id: '',
    title: '',
    date: '',
    time: '',
    price: '',
    type: '',
    event_url: ''
  });
  
  // Lock body scroll when modals are open
  useEffect(() => {
    if (showAdminPortal || showBulkImportModal || showAddEventModal) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    
    // Cleanup on unmount
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [showAdminPortal, showBulkImportModal, showAddEventModal]);
  
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  
  // Refs
  const topRef = useRef(null);
  const calendarRef = useRef(null);
  const gymRefs = useRef({});
  const monthNavRef = useRef(null);

  // Fetch data
  const { gyms: gymsList, loading: gymsLoading, error: gymsError } = useGyms();
  const { gymLinks, loading: gymLinksLoading, error: gymLinksError, refreshGymLinks } = useGymLinks();
  const { eventTypes, loading: eventTypesLoading, error: eventTypesError } = useEventTypes();
  
  const startDate = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-01`;
  const endDate = new Date(currentYear, currentMonth + 1, 0).toISOString().split('T')[0];
  const { events, loading: eventsLoading, error: eventsError, refetch: refetchEvents } = useEvents(startDate, endDate);

  const monthlyRequirements = useMonthlyRequirements();


  // Helper function to get URLs from main Supabase database
  const getGymLinkUrl = (gymName, eventType) => {
    // Map event types to link types in main database
    const linkTypeMap = {
      'CLINIC': 'skill_clinics',
      'KIDS NIGHT OUT': 'kids_night_out',
      'OPEN GYM': 'open_gym', 
      'BOOKING': 'booking',
      'camps': 'camps',
      'camps_half': 'camps_half',
      'camps_summer_full': 'camps_summer_full',
      'camps_summer_half': 'camps_summer_half',
      'camps_holiday': 'camps_holiday',
      'special_events': 'special_events'
    };
    
    const linkTypeId = linkTypeMap[eventType] || eventType;
    
    // Find gym by name, then find link by gym_id (gyms table only has id and name)
    const gym = gymsList.find(g => g.name === gymName);
    if (!gym) return null;
    
    const link = gymLinks.find(gl => 
      gl.gym_id === gym.id && 
      gl.link_type_id === linkTypeId
    );
    return link?.url;
  };

  // Helper function to get all URLs for a specific event type from Supabase links data
  const getAllUrlsForEventType = (eventType) => {
    const urls = [];
    gymsList.forEach(gym => {
      const url = getGymLinkUrl(gym.name, eventType);
      if (url) urls.push(url);
    });
    console.log(`Getting URLs for ${eventType} from Supabase:`, urls);
    return urls;
  };

  // Helper: Check if an error message is acknowledged (supports both old string format and new object format)
  const isErrorAcknowledged = (acknowledgedErrors, errorMessage) => {
    if (!acknowledgedErrors || !Array.isArray(acknowledgedErrors)) return false;
    return acknowledgedErrors.some(ack => 
      typeof ack === 'string' ? ack === errorMessage : ack.message === errorMessage
    );
  };

  // Helper: Infer category from error type (for legacy data that doesn't have category field)
  // DATA ERRORS = wrong information that affects customers
  // FORMATTING = missing/incomplete information
  const inferErrorCategory = (error) => {
    if (error.category) return error.category; // Use existing category if present
    
    // Data errors - these are WRONG information (mismatches)
    const dataErrorTypes = [
      'year_mismatch', 'date_mismatch', 'time_mismatch', 'age_mismatch',
      'day_mismatch', 'program_mismatch', 'skill_mismatch', 'price_mismatch',
      'title_desc_mismatch', 'camp_price_mismatch'
    ];
    
    // Status errors - informational
    const statusErrorTypes = ['registration_closed', 'registration_not_open', 'sold_out'];
    
    if (dataErrorTypes.includes(error.type)) return 'data_error';
    if (statusErrorTypes.includes(error.type)) return 'status';
    return 'formatting'; // Default to formatting for missing_* types
  };

  // Helper: Get the acknowledgment details for an error (note, timestamp)
  const getAcknowledgmentDetails = (acknowledgedErrors, errorMessage) => {
    if (!acknowledgedErrors || !Array.isArray(acknowledgedErrors)) return null;
    const found = acknowledgedErrors.find(ack => 
      typeof ack === 'object' && ack.message === errorMessage
    );
    return found || null;
  };

  // Acknowledge/dismiss a validation error - saves to database so it doesn't reappear
  // Now supports optional note and stores timestamp
  const acknowledgeValidationError = async (eventId, errorMessage, note = null) => {
    try {
      // Get current acknowledged errors for this event
      const { data: currentEvent, error: fetchError } = await supabase
        .from('events')
        .select('acknowledged_errors')
        .eq('id', eventId)
        .single();
      
      if (fetchError) throw fetchError;
      
      const currentAcknowledged = currentEvent?.acknowledged_errors || [];
      
      // Check if already acknowledged (support both old string format and new object format)
      const alreadyAcknowledged = currentAcknowledged.some(ack => 
        typeof ack === 'string' ? ack === errorMessage : ack.message === errorMessage
      );
      
      if (!alreadyAcknowledged) {
        // New format: store as object with message, note, and timestamp
        const acknowledgment = {
          message: errorMessage,
          note: note || null,
          dismissed_at: new Date().toISOString()
        };
        
        const updatedAcknowledged = [...currentAcknowledged, acknowledgment];
        
        const { error: updateError } = await supabase
          .from('events')
          .update({ acknowledged_errors: updatedAcknowledged })
          .eq('id', eventId);
        
        if (updateError) throw updateError;
        
        // Update the selected event panel immediately
        if (selectedEventForPanel && selectedEventForPanel.id === eventId) {
          setSelectedEventForPanel({
            ...selectedEventForPanel,
            acknowledged_errors: updatedAcknowledged
          });
        }
        
        // Refresh events to update the UI
        refetchEvents();
        
        console.log(`✅ Acknowledged error for event ${eventId}: "${errorMessage}"${note ? ` (Note: ${note})` : ''}`);
      }
    } catch (error) {
      console.error('Error acknowledging validation error:', error);
      alert('Failed to dismiss error. Please try again.');
    }
  };

  // Reset all acknowledged errors for an event (undo dismissals)
  const resetAcknowledgedErrors = async (eventId) => {
    try {
      const { error: updateError } = await supabase
        .from('events')
        .update({ acknowledged_errors: [] })
        .eq('id', eventId);
      
      if (updateError) throw updateError;
      
      // Update the selected event panel immediately
      if (selectedEventForPanel && selectedEventForPanel.id === eventId) {
        setSelectedEventForPanel({
          ...selectedEventForPanel,
          acknowledged_errors: []
        });
      }
      
      // Refresh events
      refetchEvents();
      
      console.log(`🔄 Reset acknowledged errors for event ${eventId}`);
    } catch (error) {
      console.error('Error resetting acknowledged errors:', error);
      alert('Failed to reset. Please try again.');
    }
  };

  // Check if an error type supports "Add as Rule"
  const canAddAsRule = (errorType) => {
    return errorType === 'camp_price_mismatch' || errorType === 'time_mismatch';
  };

  // Extract rule value from an error object (price or time)
  const extractRuleValue = (errorObj) => {
    if (errorObj.type === 'camp_price_mismatch') {
      const priceMatch = errorObj.message.match(/\$(\d+(?:\.\d{2})?)/);
      return priceMatch ? { ruleType: 'price', value: priceMatch[1] } : null;
    } else if (errorObj.type === 'time_mismatch') {
      const timeMatch = errorObj.message.match(/(?:description|title) says (\d{1,2}(?::\d{2})?\s*(?:am|pm|a|p))/i);
      return timeMatch ? { ruleType: 'time', value: timeMatch[1].trim() } : null;
    }
    return null;
  };

  // ✨ Toggle individual event expansion - Shows full detail popup
  // Removed toggleEventExpansion - now using side panel on click
  
  // Helper to format time in short format (6:30-9:30)
  const formatTimeShort = (timeString) => {
    if (!timeString) return '';
    // Remove AM/PM and spaces for compact display
    return timeString.replace(/ AM| PM/g, '').replace(' - ', '-');
  };

  // Export functions
  const exportToCSV = (events, gyms) => {
    if (!events || events.length === 0) {
      alert('No events to export');
      return;
    }
    
    const headers = ['Gym', 'Title', 'Type', 'Date', 'Time', 'Price', 'Ages', 'URL'];
    const rows = events.map(event => {
      const gym = gyms.find(g => g.id === event.gym_id);
      return [
        gym?.name || event.gym_id,
        `"${(event.title || '').replace(/"/g, '""')}"`,
        event.type || '',
        event.date || '',
        event.time || '',
        event.price || '',
        event.age_min && event.age_max ? `${event.age_min}-${event.age_max}` : (event.age_min ? `${event.age_min}+` : ''),
        event.event_url || ''
      ].join(',');
    });
    
    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `events-export-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const exportToJSON = (events) => {
    if (!events || events.length === 0) {
      alert('No events to export');
      return;
    }
    
    const exportData = {
      exportDate: new Date().toISOString(),
      totalEvents: events.length,
      events: events
    };
    
    const json = JSON.stringify(exportData, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `events-backup-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Helper to open multiple tabs with best compatibility (avoids pop-up blockers)
  const openMultipleTabs = (urls, startingMessage, doneMessage) => {
    if (!urls || urls.length === 0) {
      setCopySuccess('No links found.');
      setTimeout(() => setCopySuccess(''), 2500);
      return;
    }

    // Deduplicate and clamp to a safe maximum of 10 per click
    const uniqueUrls = Array.from(new Set(urls.filter(Boolean))).slice(0, 10);
    if (uniqueUrls.length === 0) {
      setCopySuccess('No valid links found.');
      setTimeout(() => setCopySuccess(''), 2500);
      return;
    }

    setCopySuccess(startingMessage);

    // Synchronous anchor-click strategy (most reliable under popup blockers)
    let openedCount = 0;
    try {
      uniqueUrls.forEach((url, index) => {
        setTimeout(() => {
          const newWindow = window.open(url, '_blank', 'noopener,noreferrer');
          if (newWindow && !newWindow.closed) {
            openedCount++;
          }
        }, index * 100); // Stagger by 100ms to help with pop-up blockers
      });
      
      // Check if any were blocked after attempting to open
      setTimeout(() => {
        if (openedCount < uniqueUrls.length) {
          // Only show this alert once
          const hasSeenBlockerAlert = localStorage.getItem('hasSeenBlockerAlert');
          if (!hasSeenBlockerAlert) {
            alert(`🚫 Pop-up Blocker Active!\n\nTrying to open ${uniqueUrls.length} pages, but your browser is blocking them.\n\n✅ How to fix:\n1. Look for the pop-up blocked icon in your address bar (usually top-right)\n2. Click it and select "Always allow pop-ups from this site"\n3. Click the ✨ sparkle button again\n\nThis is a one-time setup - after allowing pop-ups, all pages will open instantly!`);
            localStorage.setItem('hasSeenBlockerAlert', 'true');
          }
        }
      }, uniqueUrls.length * 100 + 500);
      
    } catch (err) {
      // Only show this alert once
      const hasSeenCatchAlert = localStorage.getItem('hasSeenCatchAlert');
      if (!hasSeenCatchAlert) {
        alert(`🚫 Pop-up Blocker Active!\n\nYour browser is blocking multiple tabs from opening.\n\n✅ How to fix:\n1. Look for the pop-up blocked icon in your address bar\n2. Click it and select "Always allow pop-ups from this site"\n3. Try again\n\nThis is a one-time setup!`);
        localStorage.setItem('hasSeenCatchAlert', 'true');
      }
    }

    // Completion toast
    setTimeout(() => {
      setCopySuccess(doneMessage);
      setTimeout(() => setCopySuccess(''), 4000);
    }, 150);
  };

  // Open all special event pages for a given gym (Booking, Clinic, KNO, Open Gym, Camps)
  const handleOpenAllForGym = (gymName) => {
    try {
      const urlsToOpen = [
        // All link types that gym might have
        getGymLinkUrl(gymName, 'BOOKING'),
        getGymLinkUrl(gymName, 'CLINIC'),
        getGymLinkUrl(gymName, 'KIDS NIGHT OUT'),
        getGymLinkUrl(gymName, 'OPEN GYM'),
        getGymLinkUrl(gymName, 'camps'),
        getGymLinkUrl(gymName, 'camps_half'),
        getGymLinkUrl(gymName, 'special_events')
      ].filter(Boolean);

      // Check if user has seen the pop-up alert before
      const hasSeenPopupAlert = localStorage.getItem('hasSeenSparklePopupAlert');
      
      console.log('🔍 Sparkle popup check:', { hasSeenPopupAlert, willShow: !hasSeenPopupAlert });
      
      // Show one-time alert BEFORE opening anything
      if (!hasSeenPopupAlert) {
        const userConfirmed = window.confirm(
          `🚀 Allow Pop-ups Required\n\n` +
          `This will open ${urlsToOpen.length} tabs at once to access all gym portals.\n\n` +
          `⚠️ Important: Allow Pop-ups\n\n` +
          `1. Your browser may block the tabs from opening\n` +
          `2. Look for a pop-up blocked icon in your address bar (usually top-right)\n` +
          `3. Click it and select "Always allow pop-ups from this site"\n` +
          `4. Then try clicking the ✨ sparkle again\n\n` +
          `This is a one-time setup. After allowing pop-ups, all bulk actions will work instantly!\n\n` +
          `Click OK to continue.`
        );
        
        // Remember they've seen this alert (even if they cancel)
        localStorage.setItem('hasSeenSparklePopupAlert', 'true');
        console.log('✅ Saved to localStorage - popup should not show again');
        
        if (!userConfirmed) {
          return; // User cancelled
        }
      } else {
        console.log('✅ User has seen popup before - skipping alert');
      }

      // Now open the tabs (either first time after clicking OK, or subsequent times)
      openMultipleTabs(
        urlsToOpen,
        `Opening ${gymName} event pages...`,
        `Opened ${urlsToOpen.length} pages for ${gymName}.`
      );
    } catch (_) {
      // No-op: openMultipleTabs already reports issues to the user via toasts
    }
  };

  // Small visual effect near cursor for non-Shift clicks
  const showFairyDust = (event) => {
    try {
      const dust = document.createElement('div');
      dust.textContent = '✨';
      dust.style.position = 'fixed';
      dust.style.left = `${event.clientX}px`;
      dust.style.top = `${event.clientY}px`;
      dust.style.transform = 'translate(-50%, -50%)';
      dust.style.pointerEvents = 'none';
      dust.style.fontSize = '18px';
      dust.style.transition = 'transform 400ms ease-out, opacity 400ms ease-out';
      dust.style.opacity = '1';
      document.body.appendChild(dust);
      requestAnimationFrame(() => {
        dust.style.transform = 'translate(-50%, -90%) scale(1.3)';
        dust.style.opacity = '0';
      });
      setTimeout(() => { try { dust.remove(); } catch(_){} }, 450);
    } catch (_) {}
  };

  

  // Magic Control: one-click opens all (no Shift required)
  const handleMagicControlClick = (gymName) => {
    handleOpenAllForGym(gymName);
  };

  // Helper functions
  const getDaysInMonth = (year, month) => {
    return new Date(year, month + 1, 0).getDate();
  };

  const displayDates = useMemo(() => {
    const totalDays = getDaysInMonth(currentYear, currentMonth);
    
    switch (calendarView) {
      case 'firstHalf':
        return Array.from({ length: 15 }, (_, i) => i + 1);
      case 'secondHalf':
        return Array.from({ length: totalDays - 15 }, (_, i) => i + 16);
      case 'full':
        return Array.from({ length: totalDays }, (_, i) => i + 1);
      case 'week1':
        return Array.from({ length: 7 }, (_, i) => i + 1);
      case 'week2':
        return Array.from({ length: 7 }, (_, i) => i + 8);
      case 'week3':
        return Array.from({ length: 7 }, (_, i) => i + 15);
      case 'week4':
        return Array.from({ length: Math.min(7, totalDays - 21) }, (_, i) => i + 22);
      default:
        return Array.from({ length: 15 }, (_, i) => i + 1);
    }
  }, [calendarView, currentYear, currentMonth]);

  const goToPreviousMonth = () => {
    // Save current scroll position
    const currentScrollY = window.scrollY;
    
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear(currentYear - 1);
    } else {
      setCurrentMonth(currentMonth - 1);
    }
    setCalendarView('full');
    
    // Restore scroll position after state updates
    setTimeout(() => {
      window.scrollTo(0, currentScrollY);
    }, 0);
  };

  const goToNextMonth = () => {
    // Save current scroll position
    const currentScrollY = window.scrollY;
    
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear(currentYear + 1);
    } else {
      setCurrentMonth(currentMonth + 1);
    }
    setCalendarView('full');
    
    // Restore scroll position after state updates
    setTimeout(() => {
      window.scrollTo(0, currentScrollY);
    }, 0);
  };

  const scrollToGym = (gym) => {
    const gymElement = gymRefs.current[gym];
    if (gymElement) {
      gymElement.scrollIntoView({ 
        behavior: 'smooth', 
        block: 'center' 
      });
      // Add a visual highlight effect
      gymElement.style.backgroundColor = theme.colors.secondary;
      setTimeout(() => {
        gymElement.style.backgroundColor = '';
      }, 2000);
    }
  };

  const scrollToTop = () => {
    topRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Calendar view change handler
  const handleCalendarViewChange = (newView) => {
    setCalendarView(newView);
  };

  // Scroll listener for back to top button and calendar view detection
  useEffect(() => {
    const handleScroll = () => {
      const scrollY = window.scrollY;
      setShowBackToTop(scrollY > 400);
      
      // Calendar view detection removed since it was unused
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Data processing - event types from events for dropdown
  // EXCLUDE CAMPS - Only count tracked event types (Clinics, KNO, Open Gym)
  const eventTypesFromEvents = useMemo(() => {
    const types = [...new Set(events.map(event => event.type))];
    // Filter out camp types and only include tracked types
    const trackedTypes = eventTypes.filter(et => et.is_tracked).map(et => et.name);
    return types.filter(type => type && trackedTypes.includes(type)).sort();
  }, [events, eventTypes]);

  const filteredEvents = useMemo(() => {
    return events.filter(event => {
      const matchesGym = selectedGym === 'all' || 
        event.gym_id === selectedGym || 
        event.gym_code === selectedGym || 
        event.gym_name === selectedGym;
      const matchesType = selectedEventType === 'all' || event.type === selectedEventType || (!event.type && selectedEventType === 'all');
      const matchesSearch = searchTerm === '' || 
        event.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        event.type?.toLowerCase().includes(searchTerm.toLowerCase());
      
      return matchesGym && matchesType && matchesSearch;
    });
  }, [events, selectedGym, selectedEventType, searchTerm]);

  const uniqueGymsWithEvents = useMemo(() => {
    const gymCodes = [...new Set(events.map(event => event.gym_id))];
    return gymCodes.filter(Boolean).sort();
  }, [events]);

  // Get all gyms (from gymsList) for calendar display, or gyms with events for statistics
  const allGymsFromList = useMemo(() => gymsList.map(gym => gym.name).sort(), [gymsList]);
  const allGyms = useMemo(() => {
    const gymsWithEvents = [...new Set(filteredEvents.map(event => event.gym_name || event.gym_code).filter(Boolean))];
    // For calendar display, show all gyms; for statistics, show only gyms with events
    return allGymsFromList.length > 0 ? allGymsFromList : gymsWithEvents;
  }, [filteredEvents, allGymsFromList]);

  // Statistics calculation functions - COUNT ONLY EVENTS IN CURRENT MONTH
  const getEventCounts = () => {
    const counts = {};
    // Get tracked event types from database
    const trackedTypes = eventTypes.filter(et => et.is_tracked).map(et => et.name);
    
    // Filter events to current month/year being viewed
    const currentMonthEvents = events.filter(event => {
      if (!event.date) return false;
      const eventDate = parseYmdLocal(event.date);
      return eventDate.getMonth() === currentMonth && eventDate.getFullYear() === currentYear;
    });
    
    allGyms.forEach(gym => {
      counts[gym] = {};
      // Find the gym_id for this gym name
      const gymData = gymsList.find(g => g.name === gym);
      const gymId = gymData?.gym_code || gymData?.id;
      
      trackedTypes.forEach(type => {
        counts[gym][type] = currentMonthEvents.filter(
          event => {
            // Match by gym_id primarily, fallback to gym_name or gym_code
            const eventGym = event.gym_id || event.gym_code || event.gym_name;
            return (eventGym === gymId || eventGym === gym) && event.type === type;
          }
        ).length;
      });
      
      counts[gym].total = currentMonthEvents.filter(
        event => {
          const eventGym = event.gym_id || event.gym_code || event.gym_name;
          return (eventGym === gymId || eventGym === gym) && trackedTypes.includes(event.type);
        }
      ).length;
    });
    
    return counts;
  };



  const getMissingEventTypes = (gym) => {
    const missing = [];
    const counts = getEventCounts(); // Gets counts for CURRENT MONTH only
    
    // Use source of truth requirements
    Object.keys(monthlyRequirements).forEach(eventType => {
      const requiredCount = monthlyRequirements[eventType];
      const currentCount = counts[gym]?.[eventType] || 0;
      const deficit = requiredCount - currentCount;
      
      if (deficit > 0) {
        const shortLabel = eventType === 'KIDS NIGHT OUT' ? 'KNO' : eventType;
        missing.push(`+${deficit} ${shortLabel}`);
      }
    });
    
    return missing;
  };

  const getEventTypeColor = (eventType) => {
    const colors = {
      // Required Events (Tracked) - Light background colors
      'CLINIC': '#F3E8FF',                    // Light lavender
      'KIDS NIGHT OUT': '#FFCCCB',           // Coral rose  
      'OPEN GYM': '#C8E6C9',                 // Sage green
      
      // Camps - Your specified color
      'CAMP': '#fde685',                     // Warm yellow
      'CAMPS': '#fde685',                    // Warm yellow (alternative name)
      
      // Summer Camps (Optional) - Light background colors
      'SUMMER CAMP': '#E1F5FE',              // Ice blue
      'SUMMER CAMP - GYMNASTICS': '#B2DFDB', // Seafoam
      'SUMMER CAMP - NINJA': '#DCEDC8',      // Light lime
      
      // Other event types
      'BIRTHDAY PARTY': '#fce7f3',           // Light pink background
      'SPECIAL EVENT': '#fef2f2',            // Light red background
      'WORKSHOP': '#eef2ff',                 // Light indigo background
    };
    return colors[eventType] || '#f5f1f1'; // Default to light blush background
  };

  const copyToClipboard = async (text, eventId) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedUrl(eventId);
      setTimeout(() => setCopiedUrl(null), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  // Loading states
  if (gymsLoading || eventsLoading || gymLinksLoading || eventTypesLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen" style={{ backgroundColor: theme.colors.background }}>
        <div className="text-center">
          <Loader className="w-8 h-8 animate-spin mx-auto mb-4" style={{ color: theme.colors.primary }} />
          <p style={{ color: theme.colors.textSecondary }}>Loading events data...</p>
        </div>
      </div>
    );
  }

  if (gymsError || eventsError || gymLinksError || eventTypesError) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center text-red-600">
          <AlertCircle className="w-8 h-8 mx-auto mb-4" />
          <p>Error loading data: {gymsError || eventsError || gymLinksError || eventTypesError}</p>
        </div>
      </div>
    );
  }

  // Add Event Function
  const handleAddEvent = async () => {
    try {
      // Calculate day of week
      const eventDate = new Date(newEvent.date);
      const dayOfWeek = eventDate.toLocaleDateString('en-US', { weekday: 'long' });
      
      const eventData = {
        ...newEvent,
        day_of_week: dayOfWeek,
        price: newEvent.price ? parseFloat(newEvent.price) : null
      };
      
      const result = await eventsApi.create(eventData);
      
      // Log to audit system
      if (result && result.id) {
        await logEventChange(
          result.id,
          eventData.gym_id,
          'CREATE',
          null,
          null,
          null,
          'Manual Add', // This identifies it was manually added
          eventData.title,
          eventData.date
        );
      }
      
      // Refresh events list
      cache.clear('events');
      await refetchEvents();
      
      // Close modal and reset form
      setShowAddEventModal(false);
      setNewEvent({
        gym_id: '',
        title: '',
        date: '',
        time: '',
        price: '',
        type: '',
        event_url: ''
      });
      
      setCopySuccess('✅ Event added successfully!');
      setTimeout(() => setCopySuccess(''), 3000);
    } catch (error) {
      console.error('Error adding event:', error);
      setCopySuccess('❌ Error adding event');
      setTimeout(() => setCopySuccess(''), 3000);
    }
  };

  // Open Edit Modal for Event
  const handleEditEvent = (event) => {
    setEditingEvent(event);
    setNewEvent({
      gym_id: event.gym_id,
      title: event.title,
      date: event.date,
      time: event.time,
      price: event.price || '',
      type: event.type,
      event_url: event.event_url
    });
    setShowAddEventModal(true);
  };

  // Convert iClassPro JSON to import format
  const convertRawDataToJson = async () => {
    const t0 = performance.now();
    
    try {
      // Validate input data
      if (!rawEventListings.trim()) {
        throw new Error('JSON data is empty');
      }
      if (!selectedGymId) {
        throw new Error('Please select a gym');
      }
      
      // Parse the JSON from iClassPro
      let jsonData;
      try {
        jsonData = JSON.parse(rawEventListings);
      } catch (e) {
        throw new Error('Invalid JSON format. Please paste the exact response from F12');
      }
      
      // Validate JSON structure
      if (!jsonData.data || !Array.isArray(jsonData.data)) {
        throw new Error('Invalid JSON structure. Expected "data" array');
      }
      
      if (jsonData.data.length === 0) {
        throw new Error('No events found in the JSON data');
      }
      
      // Get gym details
      const gym = gymsList.find(g => g.id === selectedGymId);
      if (!gym) {
        throw new Error('Selected gym not found');
      }
      
      // Convert iClassPro events to our database format
      const processedEvents = jsonData.data.flatMap(event => {
        // Extract portal slug from ANY link for this gym in gymLinks
        const gymLink = gymLinks.find(gl => gl.gym_id === selectedGymId);
        let portalSlug = '';
        if (gymLink && gymLink.url) {
          const urlMatch = gymLink.url.match(/portal\.iclasspro\.com\/([^\/]+)/);
          if (urlMatch) {
            portalSlug = urlMatch[1];
          }
        }
        
        // Debug log to help troubleshoot
        if (!portalSlug) {
          console.warn(`⚠️ Could not find portal slug for gym ${selectedGymId}. URL will be UNKNOWN.`);
        }
        
        // Construct the event URL
        const eventUrl = portalSlug 
          ? `https://portal.iclasspro.com/${portalSlug}/camp-details/${event.id}`
          : `https://portal.iclasspro.com/UNKNOWN/camp-details/${event.id}`;
        
        // Determine event type from campTypeName or event name
        let eventType = 'OPEN GYM';
        const typeName = (jsonData.campTypeName || event.name || '').toUpperCase();
        if (typeName.includes('KIDS NIGHT OUT') || typeName.includes('KNO')) {
            eventType = 'KIDS NIGHT OUT';
        } else if (typeName.includes('CLINIC')) {
          eventType = 'CLINIC';
        } else if (typeName.includes('OPEN GYM')) {
            eventType = 'OPEN GYM';
        } else if (typeName.includes('CAMP') || typeName.includes('SCHOOL YEAR')) {
          eventType = 'CAMP';
        }
        
        // Extract time from schedule
        let time = '10:00 AM - 11:30 AM'; // Default
        if (event.schedule && event.schedule.length > 0) {
          const schedule = event.schedule[0];
          time = `${schedule.startTime} - ${schedule.endTime}`;
        }
        
        // Clean up the title
        let title = event.name || 'Untitled Event';
        // Remove multiple spaces and clean up
        title = title.replace(/\s+/g, ' ').trim();
        
        // Extract price from title (e.g., "$67/day", "$35", "$5")
        let price = null;
        const priceMatch = title.match(/\$(\d+(?:\.\d{2})?)/);
        if (priceMatch) {
          price = parseFloat(priceMatch[1]);
        }
        
        return [{
          gym_id: selectedGymId,
          title: title,
          date: event.startDate,
          start_date: event.startDate,
          end_date: event.endDate || event.startDate,
          time: time,
          price: price,
          type: eventType,
          event_url: eventUrl,
          age_min: event.minAge || null,
          age_max: event.maxAge || null
        }];
      });
      
      // CRITICAL FIX: Fetch fresh data from database instead of using stale client state
      // This prevents the "1 duplicate will be skipped" message from being inaccurate
      console.log('🔍 Fetching fresh events from database for duplicate detection...');
      // FIXED: Fetch ALL events (wide date range) to properly detect duplicates for future camps
      const allStartDate = '2024-01-01'; // Start from beginning of 2024
      const allEndDate = '2026-12-31'; // Through end of 2026
      const freshEventsFromDB = await eventsApi.getAll(allStartDate, allEndDate);
      console.log(`📊 Found ${freshEventsFromDB.length} existing events in database`);
      
      // Check for existing events to detect duplicates
      let existingCount = 0;
      // FIXED: Store both URL and gym_id to avoid false duplicates with UNKNOWN URLs
      const existingEventsCheck = (freshEventsFromDB || []).map(ev => ({
        url: ev.event_url ? ev.event_url.split('?')[0] : null,
        gym_id: ev.gym_id
      })).filter(ev => ev.url);
      
      processedEvents.forEach(newEvent => {
        const newUrlBase = newEvent.event_url.split('?')[0];
        // URL match must ALSO match gym_id
        const isDuplicate = existingEventsCheck.some(existing => 
          existing.url === newUrlBase && existing.gym_id === newEvent.gym_id
        );
        if (isDuplicate) {
          existingCount++;
        }
      });
      
      // Set the bulk import data
      setBulkImportData(JSON.stringify(processedEvents, null, 2));
      
      // Set validation results for display
      setValidationResults({
        eventsFound: processedEvents.length,
        urlsFound: processedEvents.length,
        duplicateUrls: existingCount,
        warnings: existingCount > 0 ? [`${existingCount} Already in DB`] : [],
        gymDetected: gym.name,
        gymId: selectedGymId,
        eventTypeMode: 'AUTO_DETECT',
        note: existingCount > 0 ? `${existingCount} events already in database` : 'All events are new'
      });

      // Timing
      const convertMs = Math.round(performance.now() - t0);
      setImportTiming(prev => ({ ...prev, convertMs, totalMs: convertMs != null && prev.importMs != null ? convertMs + prev.importMs : convertMs }));
      
      setCopySuccess(`✅ Converted ${processedEvents.length} events from JSON! ${existingCount > 0 ? `(${existingCount} duplicates will be skipped)` : ''}`);
      // Keep success message visible longer
      setTimeout(() => setCopySuccess(''), 20000); // 20 seconds
      
    } catch (error) {
      console.error('Convert error:', error);
      alert(`Conversion Error: ${error.message}`);
      setCopySuccess(`❌ Error: ${error.message}`);
      setTimeout(() => setCopySuccess(''), 6000);
      
      // Clear validation results on error
      setValidationResults(null);
    }
  };

  // Load audit history
  const loadAuditHistory = async () => {
    setLoadingAudit(true);
    try {
      const { data, error } = await supabase
        .from('event_audit_log')
        .select('*')
        .order('changed_at', { ascending: false })
        .limit(100);
      
      if (error) throw error;
      setAuditHistory(data || []);
    } catch (error) {
      console.error('Error loading audit history:', error);
      alert('Error loading audit history');
    } finally {
      setLoadingAudit(false);
    }
  };

  // Log event changes to audit table
  const logEventChange = async (eventId, gymId, action, fieldChanged, oldValue, newValue, eventTitle, eventDate) => {
    try {
      const { error } = await supabase
        .from('event_audit_log')
        .insert([{
          event_id: eventId,
          gym_id: gymId,
          action: action,
          field_changed: fieldChanged,
          old_value: oldValue,
          new_value: newValue,
          changed_by: 'Bulk Import',
          event_title: eventTitle,
          event_date: eventDate
        }]);
      
      if (error) {
        console.error('Error logging audit:', error);
      }
    } catch (error) {
      console.error('Error in audit logging:', error);
    }
  };

  // Bulk Import Function for Admin
  // Consolidate camp events that belong to the same camp
  const consolidateCampEvents = async (events) => {
    const campGroups = {};
    const nonCampEvents = [];
    
    // Group camp events by gym and camp name
    events.forEach(event => {
      if (event.type === 'CAMP') {
        // Extract base camp name (everything before first |)
        const campName = event.title.split('|')[0].trim();
        const groupKey = `${event.gym_id}-${campName}`;
        
        if (!campGroups[groupKey]) {
          campGroups[groupKey] = [];
        }
        campGroups[groupKey].push(event);
        } else {
        nonCampEvents.push(event);
      }
    });
    
    // Consolidate each camp group
    const consolidatedCamps = [];
    Object.entries(campGroups).forEach(([groupKey, campEvents]) => {
      if (campEvents.length === 1) {
        // Single day camp - use as is
        consolidatedCamps.push(campEvents[0]);
      } else {
        // Multi-day camp - merge into single event
        const sortedEvents = campEvents.sort((a, b) => new Date(a.date) - new Date(b.date));
        const firstEvent = sortedEvents[0];
        const lastEvent = sortedEvents[sortedEvents.length - 1];
        
        // Create consolidated event
        const consolidatedEvent = {
          ...firstEvent,
          title: firstEvent.title.replace(/\|\s*\w+day,\s*\w+\s+\d{1,2}(?:st|nd|rd|th)?,\s*\d{4}/, `| ${getDateRangeString(firstEvent.date, lastEvent.date)}`),
          start_date: firstEvent.date,
          end_date: lastEvent.date,
          day_of_week: (() => {
            const [year, month, day] = firstEvent.date.split('-').map(Number);
            const dateObj = new Date(year, month - 1, day);
            return dateObj.toLocaleDateString('en-US', { weekday: 'long' });
          })()
        };
        
        consolidatedCamps.push(consolidatedEvent);
      }
    });
    
    return [...consolidatedCamps, ...nonCampEvents];
  };
  
  // Helper function to format date ranges
  const getDateRangeString = (startDate, endDate) => {
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    const startMonth = start.toLocaleDateString('en-US', { month: 'short' });
    const startDay = start.getDate();
    const endMonth = end.toLocaleDateString('en-US', { month: 'short' });
    const endDay = end.getDate();
    const year = start.getFullYear();
    
    if (start.getMonth() === end.getMonth()) {
      // Same month: "Oct 16-17, 2025"
      return `${startMonth} ${startDay}-${endDay}, ${year}`;
    } else {
      // Different months: "Dec 22, 2025 - Jan 5, 2026"
      return `${startMonth} ${startDay}, ${year} - ${endMonth} ${endDay}, ${end.getFullYear()}`;
    }
  };

  const handleBulkImport = async () => {
    const t0 = performance.now();
    let validatedEvents = []; // Declare at function scope
    try {
      // Parse JSON data from AI-organized format
      const newEvents = JSON.parse(bulkImportData);
      
      // PRE-IMPORT VALIDATION
      const importWarnings = [];
      
      // Check for duplicate events within the import batch
      const eventKeys = newEvents.map(e => `${e.gym_id}-${e.date}-${e.time}-${e.type}`);
      const uniqueKeys = [...new Set(eventKeys)];
      if (uniqueKeys.length !== eventKeys.length) {
        importWarnings.push(`⚠️ DUPLICATE EVENTS: Found ${eventKeys.length - uniqueKeys.length} duplicate event(s) in import batch`);
      }
      
      // Check for missing required fields
      const missingFields = [];
      newEvents.forEach((event, index) => {
        if (!event.gym_id) missingFields.push(`Event ${index + 1}: gym_id`);
        if (!event.title) missingFields.push(`Event ${index + 1}: title`);
        if (!event.date) missingFields.push(`Event ${index + 1}: date`);
        if (!event.time) missingFields.push(`Event ${index + 1}: time`);
        if (!event.type) missingFields.push(`Event ${index + 1}: type`);
        if (!event.event_url) missingFields.push(`Event ${index + 1}: event_url`);
      });
      
      if (missingFields.length > 0) {
        importWarnings.push(`❌ MISSING FIELDS: ${missingFields.join(', ')}`);
      }
      
      // Check against existing events in database (current events state)
      const existingDuplicates = [];
      for (const newEvent of newEvents) {
        // Check if this new event matches any existing event in the database
        const duplicate = events.find(existingEvent => 
          existingEvent && 
          existingEvent.gym_id === newEvent.gym_id &&
          existingEvent.date === newEvent.date &&
          existingEvent.time === newEvent.time &&
          existingEvent.type === newEvent.type
        );
        
        if (duplicate) {
          existingDuplicates.push(`${newEvent.title || 'Event'} on ${newEvent.date}`);
        }
      }
      
      if (existingDuplicates.length > 0) {
        importWarnings.push(`⚠️ POTENTIAL DATABASE DUPLICATES: ${existingDuplicates.slice(0, 3).join(', ')}${existingDuplicates.length > 3 ? '...' : ''}`);
      }
      
      // Don't show warnings for duplicates - they'll be automatically skipped
      // Only show warnings for actual problems
      const realProblems = importWarnings.filter(w => 
        !w.includes('DUPLICATE') && 
        !w.includes('DATABASE DUPLICATES')
      );
      
      if (realProblems.length > 0) {
        const warningMessage = realProblems.join('\n\n');
        const shouldContinue = window.confirm(`🚨 IMPORT VALIDATION ISSUES DETECTED:\n\n${warningMessage}\n\nDo you want to continue importing anyway?`);
        
        if (!shouldContinue) {
          setCopySuccess('❌ Import cancelled by user');
          setTimeout(() => setCopySuccess(''), 3000);
          return;
        }
      }
      
      // Validate and process events
      // 1) De-duplicate within the pasted batch by unique key
      const seenKeys = new Set();
      const batchUnique = [];
      let skippedInBatch = 0;
      for (const event of newEvents) {
        const key = `${event.gym_id}-${event.date}-${event.time}-${event.type}`;
        if (!seenKeys.has(key)) {
          seenKeys.add(key);
          batchUnique.push(event);
        } else {
          skippedInBatch++;
        }
      }

      // 2) Check for existing events and detect changes
      // CRITICAL: Fetch fresh data from database, NOT stale client-side events state
      // This prevents duplicate imports when clicking import multiple times
      console.log('Fetching fresh events from database for duplicate detection...');
      // FIXED: Fetch ALL events (wide date range) to properly detect duplicates for future camps
      const allStartDate = '2024-01-01'; // Start from beginning of 2024
      const allEndDate = '2026-12-31'; // Through end of 2026
      const freshEventsFromDB = await eventsApi.getAll(allStartDate, allEndDate);
      console.log(`Found ${freshEventsFromDB.length} existing events in database`);
      
      const existingEventsMap = new Map();
      (freshEventsFromDB || []).forEach(ev => {
        // Map by URL without query params
        if (ev.event_url) {
          const urlKey = ev.event_url.split('?')[0];
          existingEventsMap.set(urlKey, ev);
        }
        // Also map by composite key
        const compositeKey = `${ev.gym_id}-${ev.date}-${ev.time}-${ev.type}`;
        existingEventsMap.set(compositeKey, ev);
      });
      
      const skippedEvents = [];
      const changedEvents = [];
      const onlyNew = [];
      
      for (const newEvent of batchUnique) {
        let existingEvent = null;
        
        // Find existing event by URL (must also match gym_id) or composite key
        if (newEvent.event_url) {
          const urlKey = newEvent.event_url.split('?')[0];
          const urlMatch = existingEventsMap.get(urlKey);
          // FIXED: URL match must ALSO match gym_id to avoid false duplicates with UNKNOWN URLs
          if (urlMatch && urlMatch.gym_id === newEvent.gym_id) {
            existingEvent = urlMatch;
          }
        }
        
        if (!existingEvent) {
          const compositeKey = `${newEvent.gym_id}-${newEvent.date}-${newEvent.time}-${newEvent.type}`;
          existingEvent = existingEventsMap.get(compositeKey);
        }
        
        if (existingEvent) {
          // Check for changes
          const changes = [];
          
          if (existingEvent.price !== newEvent.price && 
              (existingEvent.price !== null || newEvent.price !== null)) {
            changes.push({
              field: 'price',
              old: existingEvent.price || 'not listed',
              new: newEvent.price || 'not listed'
            });
          }
          
          if (existingEvent.time !== newEvent.time) {
            changes.push({
              field: 'time',  
              old: existingEvent.time,
              new: newEvent.time
            });
          }
          
          if (existingEvent.date !== newEvent.date) {
            changes.push({
              field: 'date',
              old: existingEvent.date,
              new: newEvent.date
            });
          }
          
          if (existingEvent.title !== newEvent.title) {
            changes.push({
              field: 'title',
              old: existingEvent.title,
              new: newEvent.title
            });
          }
          
          if (changes.length > 0) {
            changedEvents.push({
              existing: existingEvent,
              new: newEvent,
              changes: changes
            });
          } else {
            skippedEvents.push(`${newEvent.title} on ${newEvent.date}`);
          }
        } else {
          onlyNew.push(newEvent);
        }
      }

      // Show clear summary of what will happen
      const importSummary = `
IMPORT SUMMARY:
✅ New events to add: ${onlyNew.length}
🔄 Events to update: ${changedEvents.length}
⏭️ Unchanged events skipped: ${skippedEvents.length}
${changedEvents.length > 0 ? `\nUpdating:\n${changedEvents.slice(0, 3).map(e => `- ${e.new.title}: ${e.changes.map(c => c.field).join(', ')}`).join('\n')}${changedEvents.length > 3 ? `\n... and ${changedEvents.length - 3} more` : ''}` : ''}

The system will add new events and update any changed events automatically.`;
      
      console.log(importSummary);
      setCopySuccess(importSummary);
      setTimeout(() => setCopySuccess(''), 8000);

      // Process new events
      validatedEvents = onlyNew.map(event => {
        console.log('Processing event for import:', event);
        
        // Ensure date is valid
        let processedDate = event.date;
        try {
          const dateTest = new Date(event.date);
          if (isNaN(dateTest.getTime())) {
            throw new Error('Invalid date');
          }
        } catch (e) {
          console.error(`Invalid date for event: ${event.title}`, e);
          processedDate = new Date().toISOString().split('T')[0]; // Fallback to today
        }

        // Parse date range for camps - CRITICAL FIX for day count badges!
        // BUT: Only parse title if end_date wasn't already provided (F12 import provides correct dates)
        let startDate = event.start_date || processedDate;
        let endDate = event.end_date || processedDate;
        
        // Extract date range from camp titles ONLY if not already set
        if (event.type === 'CAMP' && event.title && !event.end_date) {
          // Match patterns like: "Oct 13-17", "November 24-26", "Dec 22nd-26th"
          const simpleRangeMatch = event.title.match(/([A-Za-z]+)\s+(\d{1,2})(?:st|nd|rd|th)?\s*[-–]\s*(\d{1,2})(?:st|nd|rd|th)?/);
          
          if (simpleRangeMatch) {
            const month = simpleRangeMatch[1];
            const startDay = simpleRangeMatch[2];
            const endDay = simpleRangeMatch[3];
            const year = processedDate.split('-')[0]; // Use the event's year
            
            // Parse the end date
            const endDateStr = `${month} ${endDay}, ${year}`;
            const parsedEndDate = new Date(endDateStr);
            
            if (!isNaN(parsedEndDate.getTime())) {
              endDate = parsedEndDate.toISOString().split('T')[0];
            }
          }
          
          // Also handle cross-month ranges like "Dec 22-Jan 5"
          const crossMonthMatch = event.title.match(/([A-Za-z]+)\s+(\d{1,2})(?:st|nd|rd|th)?\s*[-–]\s*([A-Za-z]+)\s+(\d{1,2})(?:st|nd|rd|th)?/);
          
          if (crossMonthMatch) {
            const endMonth = crossMonthMatch[3];
            const endDay = crossMonthMatch[4];
            let year = processedDate.split('-')[0];
            
            // If crossing from Dec to Jan, increment year
            if (crossMonthMatch[1].toLowerCase().includes('dec') && endMonth.toLowerCase().includes('jan')) {
              year = parseInt(year) + 1;
            }
            
            const endDateStr = `${endMonth} ${endDay}, ${year}`;
            const parsedEndDate = new Date(endDateStr);
            
            if (!isNaN(parsedEndDate.getTime())) {
              endDate = parsedEndDate.toISOString().split('T')[0];
            }
          }
        }

        const finalEvent = {
          gym_id: event.gym_id || '',
          title: event.title || 'Untitled Event',
          date: processedDate,
          start_date: startDate,
          end_date: endDate,
          time: event.time || '12:00 PM - 1:00 PM',
          price: event.price ? parseFloat(event.price) : null,
          type: event.type || 'OPEN GYM',
          event_url: event.event_url || '',
          day_of_week: (() => {
            // Parse date without timezone issues
            const [year, month, day] = processedDate.split('-').map(Number);
            const dateObj = new Date(year, month - 1, day);
            return dateObj.toLocaleDateString('en-US', { weekday: 'long' });
          })()
        };
        
        console.log('Final event to import:', finalEvent);
        return finalEvent;
      });
      
      // Import new events directly without consolidation
      const consolidatedEvents = validatedEvents;

      // Import new events
      console.log('Starting bulk import with consolidated events:', consolidatedEvents);
      let importResult = null;
      if (consolidatedEvents.length > 0) {
        try {
          importResult = await eventsApi.bulkImport(consolidatedEvents);
          console.log('Import result:', importResult);
          
          // Log CREATE actions for new events
          for (const newEvent of importResult || consolidatedEvents) {
            await logEventChange(
              newEvent.id || 'new',
              newEvent.gym_id,
              'CREATE',
              'all',
              null,
              `${newEvent.title} on ${newEvent.date}`,
              newEvent.title,
              newEvent.date
            );
          }
        } catch (error) {
          // Handle database constraint errors gracefully
          if (error.message && error.message.includes('duplicate key value violates unique constraint')) {
            console.error('⚠️ Duplicate URL detected by database constraint:', error);
            alert('⚠️ Some events were rejected because they already exist in the database (duplicate URLs detected). This is expected behavior - the database is protecting your data integrity.');
            // Continue with the rest of the import process
          } else {
            // Re-throw other errors
            throw error;
          }
        }
      }
      
      // Update changed events
      let updateCount = 0;
      for (const changeEvent of changedEvents) {
        try {
          await eventsApi.update(changeEvent.existing.id, {
            ...changeEvent.existing,
            ...changeEvent.new,
            id: changeEvent.existing.id // Preserve the ID
          });
          
          // Log each field change
          for (const change of changeEvent.changes) {
            await logEventChange(
              changeEvent.existing.id,
              changeEvent.existing.gym_id,
              'UPDATE',
              change.field,
              String(change.old),
              String(change.new),
              changeEvent.new.title,
              changeEvent.new.date
            );
          }
          
          updateCount++;
        } catch (error) {
          console.error('Error updating event:', error);
        }
      }
      
      console.log('Refreshing events data...');
      cache.clear('events');
      await refetchEvents();
      console.log('Events refresh completed');
      
      // Keep modal open for multiple imports
      // setShowBulkImportModal(false);
      setBulkImportData('');
      setRawEventListings('');
      setSelectedGymId('');
      setValidationResults(null);
      
      const successMsg = `✅ Successfully imported ${validatedEvents.length} new event(s)${updateCount > 0 ? ` and updated ${updateCount} event(s)` : ''}. ${skippedEvents.length} unchanged events were skipped.`;
      setCopySuccess(successMsg);
      // Timing
      const importMs = Math.round(performance.now() - t0);
      setImportTiming(prev => ({ ...prev, importMs, totalMs: prev.convertMs != null ? prev.convertMs + importMs : importMs }));
      // Keep success message visible longer
      setTimeout(() => setCopySuccess(''), 20000); // 20 seconds instead of 4
    } catch (error) {
      console.error('Bulk import error:', error);
      let errorMessage = 'Unknown import error';
      
      if (error.message) {
        errorMessage = error.message;
      } else if (error.name === 'SyntaxError') {
        errorMessage = 'Invalid JSON format in import data';
      } else if (error.code) {
        errorMessage = `Database error (${error.code}): ${error.message}`;
      }
      
      // Show detailed error in both console and UI
      console.error('❌ DETAILED IMPORT ERROR:', {
        error: error,
        message: errorMessage,
        stack: error.stack,
        validatedEvents: validatedEvents || 'Not created'
      });
      
      alert(`Import Failed!\n\nError: ${errorMessage}\n\nCheck browser console (F12) for details.`);
      setCopySuccess(`❌ Import Error: ${errorMessage}`);
      setTimeout(() => setCopySuccess(''), 8000);
    }
  };

  // Delete Event Function with Logging
  const handleDeleteEvent = async (eventId, eventTitle) => {
    if (!window.confirm(`Are you sure you want to delete "${eventTitle}"? This action cannot be undone.`)) {
      return;
    }
    
    try {
      // Get the event details before deletion
      const eventToDelete = events.find(e => e.id === eventId);
      
      // Log the deletion to audit table
      if (eventToDelete) {
        await logEventChange(
          eventId,
          eventToDelete.gym_id,
          'DELETE',
          'all',
          eventTitle,
          'DELETED',
          eventTitle,
          eventToDelete.date
        );
      }
      
      console.log('🗑️ EVENT DELETION LOG:', {
        event_id: eventId,
        event_title: eventTitle,
        deleted_at: new Date().toISOString()
      });
      
      await eventsApi.delete(eventId);
      
      // Refresh events list
      cache.clear('events');
      await refetchEvents();
      
      // Close modal
      setShowAddEventModal(false);
      setEditingEvent(null);
      
      setCopySuccess(`✅ "${eventTitle}" deleted successfully!`);
      setTimeout(() => setCopySuccess(''), 4000);
    } catch (error) {
      console.error('Error deleting event:', error);
      setCopySuccess('❌ Error deleting event');
      setTimeout(() => setCopySuccess(''), 3000);
    }
  };

  return (
    <div className="min-h-screen pb-16" style={{ backgroundColor: theme.colors.background }}>
      
      {/* Copy Success Notification */}
      {copySuccess && (
        <div className="fixed top-4 right-4 z-50 bg-green-500 text-white px-4 py-2 rounded-lg shadow-lg flex items-center gap-2">
          <CheckCircle className="w-4 h-4" />
          {copySuccess}
        </div>
      )}
      
      {/* Add Event Modal */}
      {showAddEventModal && (
        <Suspense fallback={<div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50"><div className="bg-white rounded-lg p-6">Loading...</div></div>}>
          <AddEventModal
            theme={theme}
            gymsList={gymsList}
            newEvent={newEvent}
            setNewEvent={setNewEvent}
            editingEvent={editingEvent}
            setEditingEvent={setEditingEvent}
            onClose={() => setShowAddEventModal(false)}
            onAdd={handleAddEvent}
            onDelete={handleDeleteEvent}
          />
        </Suspense>
      )}

      {/* Bulk Import Modal - Admin Only */}
      {showBulkImportModal && (
        <Suspense fallback={<div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50"><div className="bg-white rounded-lg p-6">Loading...</div></div>}>
          <BulkImportModal
            theme={theme}
            gymsList={gymsList}
            rawEventListings={rawEventListings}
            setRawEventListings={setRawEventListings}
            selectedGymId={selectedGymId}
            setSelectedGymId={setSelectedGymId}
            validationResults={validationResults}
            importTiming={importTiming}
            bulkImportData={bulkImportData}
            setBulkImportData={setBulkImportData}
            onConvert={convertRawDataToJson}
            onClose={() => setShowBulkImportModal(false)}
            onReset={() => {
                  setBulkImportData('');
                  setRawEventListings('');
                  setSelectedGymId('');
                  setValidationResults(null);
                  setImportTiming({ convertMs: null, importMs: null, totalMs: null });
                }}
            onImport={handleBulkImport}
          />
        </Suspense>
      )}
      
      {/* Admin Control Center */}
      {showAdminPortal && (
        <Suspense fallback={<div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50"><div className="bg-white rounded-lg p-6">Loading...</div></div>}>
          <AdminPortalModal
            onClose={() => setShowAdminPortal(false)}
            onOpenBulkImport={() => {
              setShowAdminPortal(false);
              setTimeout(() => setShowBulkImportModal(true), 100);
            }}
            onOpenSyncModal={() => {
              setShowAdminPortal(false);
              setTimeout(() => setShowSyncModal(true), 100);
            }}
            onOpenAuditHistory={() => {
              setShowAdminPortal(false);
              setTimeout(() => {
                loadAuditHistory();
                setShowAuditHistory(true);
              }, 100);
            }}
            gyms={gymsList}
          />
        </Suspense>
      )}

      {/* Automated Sync Modal */}
      {showSyncModal && (
        <SyncModal
          theme={theme}
          onClose={() => setShowSyncModal(false)}
          onBack={() => {
            setShowSyncModal(false);
            setTimeout(() => setShowAdminPortal(true), 100);
          }}
          gyms={gymsList}
        />
      )}

      {/* Export Modal */}
      {showExportModal && (
        <ExportModal
          onClose={() => setShowExportModal(false)}
          events={events}
          gyms={gymsList}
          monthlyRequirements={monthlyRequirements}
          currentMonth={currentMonth}
          currentYear={currentYear}
        />
      )}

      {/* Audit History Modal - Secret Feature */}
      {showAuditHistory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-4xl mx-4 max-h-[90vh] overflow-hidden flex flex-col">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-bold text-gray-800">
                🔍 Event Change History
              </h2>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    // Download audit history as CSV
                    if (auditHistory.length === 0) return;
                    const headers = ['Date/Time', 'Action', 'Event Title', 'Gym', 'Event Date', 'Field Changed', 'Old Value', 'New Value', 'Changed By'];
                    const rows = auditHistory.map(audit => [
                      new Date(audit.changed_at).toLocaleString(),
                      audit.action,
                      audit.event_title || '',
                      audit.gym_id || '',
                      audit.event_date || '',
                      audit.field_changed || '',
                      audit.old_value || '',
                      audit.new_value || '',
                      audit.changed_by || ''
                    ]);
                    const csvContent = [headers, ...rows]
                      .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
                      .join('\n');
                    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
                    const url = URL.createObjectURL(blob);
                    const link = document.createElement('a');
                    link.href = url;
                    link.download = `event-change-history-${new Date().toISOString().split('T')[0]}.csv`;
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                    URL.revokeObjectURL(url);
                  }}
                  className="px-3 py-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-medium flex items-center gap-1"
                  title="Download as CSV"
                >
                  📥 Download CSV
                </button>
                <button
                  onClick={() => setShowAuditHistory(false)}
                  className="text-gray-500 hover:text-gray-700 text-xl"
                >
                  ✕
                </button>
              </div>
            </div>
            
            {loadingAudit ? (
              <div className="flex items-center justify-center py-12">
                <Loader className="w-8 h-8 animate-spin text-gray-500" />
              </div>
            ) : auditHistory.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                No change history found
              </div>
            ) : (
              <div className="overflow-y-auto flex-1">
                {auditHistory.map((audit, idx) => (
                  <div key={idx} className="mb-6 pb-6 border-b last:border-b-0">
                    <div className="flex justify-between items-start mb-2">
                      <div className="text-sm text-gray-500">
                        {new Date(audit.changed_at).toLocaleString('en-US', {
                          month: 'long',
                          day: 'numeric',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </div>
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        audit.action === 'CREATE' ? 'bg-green-100 text-green-800' :
                        audit.action === 'UPDATE' ? 'bg-blue-100 text-blue-800' :
                        'bg-red-100 text-red-800'
                      }`}>
                        {audit.action}
                      </span>
                    </div>
                    
                    <div className="font-medium text-gray-800 mb-1">
                      {audit.event_title || 'Unknown Event'}
                    </div>
                    
                    <div className="text-sm text-gray-600">
                      {audit.gym_id} • {audit.event_date}
                    </div>
                    
                    {audit.field_changed && audit.field_changed !== 'all' && (
                      <div className="mt-2 text-sm">
                        <span className="font-medium">{audit.field_changed}:</span>{' '}
                        <span className="text-red-600 line-through">{audit.old_value}</span>
                        {' → '}
                        <span className="text-green-600">{audit.new_value}</span>
                      </div>
                    )}
                    
                    {audit.action === 'DELETE' && (
                      <div className="mt-2 text-sm text-red-600">
                        Event was deleted from the system
                      </div>
                    )}
                    
                    <div className="text-xs text-gray-400 mt-1">
                      Changed by: {audit.changed_by}
                    </div>
                  </div>
                ))}
              </div>
            )}
            
            <div className="mt-4 flex justify-end">
              <button
                onClick={() => setShowAuditHistory(false)}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
      
      <div ref={topRef} className="relative z-10 w-full">
        <div className="w-full">
          {/* Dashboard Header - Redesigned with dark background */}
          <div className="w-full mb-6 px-6 py-8 rounded-2xl shadow-2xl" style={{ backgroundColor: '#b48f8f' }}>
            
            {/* Title */}
          <div className="text-center mb-6">
              <h1 className="text-5xl font-bold text-white mb-3 drop-shadow-lg">
              ✨ Master Events Calendar ✨
            </h1>
              <p className="text-white text-lg opacity-90">All gyms special events in one place</p>
            
            {/* Secret audit history trigger - Ctrl+Click */}
            <div 
                className="text-sm text-white opacity-70 mt-3 cursor-default select-none hover:opacity-100 transition-opacity"
              onClick={(e) => {
                if (e.ctrlKey || e.metaKey) {
                  e.preventDefault();
                  loadAuditHistory();
                  setShowAuditHistory(true);
                }
              }}
              title="Ctrl+Click for secret features"
            >
              {new Date().toLocaleString('en-US', { 
                weekday: 'long', 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
              })}
              </div>
            </div>
            
            {/* Month Navigation */}
            <div className="flex justify-center items-center gap-6 mb-8">
              <button
                onClick={() => {
                  if (currentMonth === 0) {
                    setCurrentMonth(11);
                    setCurrentYear(currentYear - 1);
                  } else {
                    setCurrentMonth(currentMonth - 1);
                  }
                  setCalendarView('full');
                }}
                className="flex items-center gap-2 px-6 py-3 rounded-full bg-white text-gray-800 font-semibold transition-all duration-200 hover:scale-105 hover:shadow-xl min-w-[120px] justify-center"
                style={{ boxShadow: '0 4px 14px rgba(0,0,0,0.25)' }}
              >
                <ChevronLeft className="w-4 h-4" />
                Previous
              </button>
              
              <div className="flex-shrink-0">
                <h2 className="text-3xl font-bold px-10 py-4 rounded-full bg-white text-gray-800 text-center whitespace-nowrap"
                    style={{ boxShadow: '0 6px 20px rgba(0,0,0,0.3)' }}>
                  {new Date(currentYear, currentMonth).toLocaleDateString('en-US', { 
                    month: 'long', 
                    year: 'numeric' 
                  })}
                </h2>
              </div>
              
              <button
                onClick={() => {
                  if (currentMonth === 11) {
                    setCurrentMonth(0);
                    setCurrentYear(currentYear + 1);
                  } else {
                    setCurrentMonth(currentMonth + 1);
                  }
                  setCalendarView('full');
                }}
                className="flex items-center gap-2 px-6 py-3 rounded-full bg-white text-gray-800 font-semibold transition-all duration-200 hover:scale-105 hover:shadow-xl min-w-[120px] justify-center"
                style={{ boxShadow: '0 4px 14px rgba(0,0,0,0.25)' }}
              >
                Next
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            {/* Dashboard Stats Cards - Row 1: General Stats */}
            <div className="flex gap-3 justify-center max-w-4xl mx-auto mb-4">
            <button 
              onClick={() => setViewMode('calendar')}
                className="bg-white rounded-lg px-4 py-3 hover:shadow-2xl transition-all duration-200 text-center flex-1 min-w-[110px] hover:scale-105"
                style={{ boxShadow: '0 4px 12px rgba(0,0,0,0.2)' }}
            >
              <div className="text-xl font-bold" style={{ color: theme.colors.textPrimary }}>
                {events.length}
              </div>
              <div className="text-sm font-medium" style={{ color: theme.colors.textSecondary }}>
                Total Events
              </div>
              <div className="text-xs" style={{ color: theme.colors.textSecondary }}>
                  This Month
              </div>
            </button>
            
            <button 
              onClick={() => {
                setSelectedGym('all');
                setSelectedEventType('all');
                setViewMode('calendar');
              }}
                className="bg-white rounded-lg px-4 py-3 hover:shadow-2xl transition-all duration-200 text-center flex-1 min-w-[110px] hover:scale-105"
                style={{ boxShadow: '0 4px 12px rgba(0,0,0,0.2)' }}
            >
              <div className="text-xl font-bold" style={{ color: theme.colors.textPrimary }}>
                {uniqueGymsWithEvents.length}
              </div>
              <div className="text-sm font-medium" style={{ color: theme.colors.textSecondary }}>
                Active Gyms
              </div>
              <div className="text-xs" style={{ color: theme.colors.textSecondary }}>
                  This Month
              </div>
            </button>

            <button 
              onClick={() => {
                setViewMode('table');
              }}
                className="bg-white rounded-lg px-4 py-3 hover:shadow-2xl transition-all duration-200 text-center flex-1 min-w-[110px] hover:scale-105"
                style={{ boxShadow: '0 4px 12px rgba(0,0,0,0.2)' }}
            >
              <div className="text-xl font-bold" style={{ color: theme.colors.textPrimary }}>
                  {allGyms.filter(gym => getMissingEventTypes(gym).length === 0).length}/{allGyms.length}
              </div>
              <div className="text-sm font-medium" style={{ color: theme.colors.textSecondary }}>
                  Requirements Met
              </div>
              <div className="text-xs" style={{ color: theme.colors.textSecondary }}>
                  This Month
              </div>
            </button>
            </div>

            {/* Dashboard Stats Cards - Row 2: Event Types */}
            <div className="flex gap-3 justify-center max-w-3xl mx-auto">
            <button 
              onClick={() => {
                setSelectedEventType('CLINIC');
                setViewMode('calendar');
              }}
                className="rounded-lg px-4 py-3 hover:shadow-2xl transition-all duration-200 text-center flex-1 min-w-[110px] hover:scale-105"
                style={{ backgroundColor: '#e3f2fd', boxShadow: '0 4px 12px rgba(59,130,246,0.3)' }}
            >
                <div className="text-xl font-bold text-blue-800">
                {events.filter(e => e.type === 'CLINIC').length}
              </div>
                <div className="text-sm font-medium text-blue-700">
                Clinics
              </div>
                <div className="text-xs text-blue-600">
                This month
              </div>
            </button>

            <button 
              onClick={() => {
                setSelectedEventType('KIDS NIGHT OUT');
                setViewMode('calendar');
              }}
                className="rounded-lg px-4 py-3 hover:shadow-2xl transition-all duration-200 text-center flex-1 min-w-[110px] hover:scale-105"
                style={{ backgroundColor: '#f3e8ff', boxShadow: '0 4px 12px rgba(139,92,246,0.3)' }}
            >
                <div className="text-xl font-bold text-purple-800">
                {events.filter(e => e.type === 'KIDS NIGHT OUT').length}
              </div>
                <div className="text-sm font-medium text-purple-700">
                Kids Night Out
              </div>
                <div className="text-xs text-purple-600">
                This month
              </div>
            </button>

            <button 
              onClick={() => {
                setSelectedEventType('OPEN GYM');
                setViewMode('calendar');
              }}
                className="rounded-lg px-4 py-3 hover:shadow-2xl transition-all duration-200 text-center flex-1 min-w-[110px] hover:scale-105"
                style={{ backgroundColor: '#e8f5e9', boxShadow: '0 4px 12px rgba(16,185,129,0.3)' }}
            >
              <div className="text-xl font-bold text-green-800">
                {events.filter(e => e.type === 'OPEN GYM').length}
              </div>
              <div className="text-sm font-medium text-green-700">
                Open Gym
              </div>
              <div className="text-xs text-green-600">
                This month
              </div>
            </button>
            </div>

          </div>

          {/* ✨ Jayme's Command Center + Export - TOP SECTION */}
          <div className="flex justify-center items-center gap-4 mb-3">
            <button
              onClick={() => setShowAdminPortal(true)}
              style={{
                background: 'linear-gradient(180deg, #d4a5a5 0%, #c3a5a5 100%)',
                color: '#2a2a2a',
                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15), inset 0 1px 0 rgba(255, 255, 255, 0.3), inset 0 -1px 0 rgba(0, 0, 0, 0.1)',
                border: '2px solid #b38d8d',
                borderTopColor: '#e6c5c5',
                borderBottomColor: '#a87d7d',
                position: 'relative',
                overflow: 'hidden',
                textShadow: '0 1px 0 rgba(255, 255, 255, 0.3)'
              }}
              className="flex items-center gap-2 px-6 py-3 rounded-lg transition-all duration-200 text-base font-bold uppercase tracking-wide hover:scale-105 active:scale-95"
              title="Open Admin Control Center"
            >
              <span className="text-lg">🔄</span>
              <span>SYNC</span>
              {/* Sparkle overlay */}
              <div style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                background: 'radial-gradient(circle at 20% 30%, rgba(255, 255, 255, 0.3) 0%, transparent 50%), radial-gradient(circle at 80% 70%, rgba(255, 255, 255, 0.2) 0%, transparent 50%)',
                pointerEvents: 'none'
              }} />
            </button>

            {/* Export Button */}
            <button
              onClick={() => setShowExportModal(true)}
              style={{
                background: 'linear-gradient(180deg, #4a4a4a 0%, #3a3a3a 100%)',
                color: '#ffffff',
                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.2), inset 0 -1px 0 rgba(0, 0, 0, 0.3)',
                border: '2px solid #2a2a2a',
                borderTopColor: '#6a6a6a',
                borderBottomColor: '#1a1a1a',
                position: 'relative',
                overflow: 'hidden'
              }}
              className="flex items-center gap-2 px-6 py-3 rounded-lg transition-all duration-200 text-base font-semibold uppercase tracking-wide hover:scale-105 active:scale-95"
              title="Export Events Data"
            >
              <span className="text-white text-lg">⬇️</span>
              <span>EXPORT</span>
              {/* Sparkle overlay */}
              <div style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                background: 'radial-gradient(circle at 20% 30%, rgba(255, 255, 255, 0.15) 0%, transparent 50%), radial-gradient(circle at 80% 70%, rgba(255, 255, 255, 0.1) 0%, transparent 50%)',
                pointerEvents: 'none'
              }} />
            </button>
          </div>

          {/* 🚀 BULK ACTION BUTTONS - Open All Gyms for Each Event Type */}
          <div className="rounded-lg shadow-lg p-4 mb-3 mx-2" style={{ backgroundColor: '#e6e6e6', border: '1px solid #adb2c6' }}>
              <div className="flex flex-col items-center justify-center text-center mb-4">
                <div className="rounded-full px-6 py-2 shadow-md mb-2" style={{ backgroundColor: '#b48f8f' }}>
                  <span className="text-xl font-bold text-white">🚀 BULK PORTAL OPENER</span>
                </div>
                <p className="text-sm mb-2" style={{ color: '#737373' }}>Click any button below to open ALL gym portals for that event type at once</p>
                <div className="rounded-lg px-4 py-2" style={{ backgroundColor: '#f5ebe0', border: '1px solid #c3a5a5' }}>
                  <span className="text-sm font-bold" style={{ color: '#8b6f6f' }}>⚠️ IMPORTANT: Allow pop-ups in your browser for this to work!</span>
                </div>
              </div>
              <div className="grid grid-cols-4 md:grid-cols-8 gap-3">
                {/* All Clinics - Dusty Rose */}
                <button
                  onClick={() => {
                    const clinicUrls = getAllUrlsForEventType('CLINIC');
                    openMultipleTabs(clinicUrls, `Opening ${clinicUrls.length} clinic pages...`, `Opened ${clinicUrls.length} clinic pages!`);
                  }}
                  className="flex flex-col items-center justify-center gap-1 p-3 rounded-lg shadow-md hover:shadow-lg transition-all duration-200 cursor-pointer"
                  style={{ backgroundColor: '#b48f8f', border: '2px solid #9a7a7a' }}
                >
                  <span className="text-2xl">⭐</span>
                  <span className="text-xs font-bold text-white">All Clinics</span>
                </button>

                {/* All KNO - Warm Amber */}
                <button
                  onClick={() => {
                    const knoUrls = getAllUrlsForEventType('KIDS NIGHT OUT');
                    openMultipleTabs(knoUrls, `Opening ${knoUrls.length} KNO pages...`, `Opened ${knoUrls.length} KNO pages!`);
                  }}
                  className="flex flex-col items-center justify-center gap-1 p-3 rounded-lg shadow-md hover:shadow-lg transition-all duration-200 cursor-pointer"
                  style={{ backgroundColor: '#d4a574', border: '2px solid #b8956a' }}
                >
                  <span className="text-2xl">🌙</span>
                  <span className="text-xs font-bold text-white">All KNO</span>
                </button>

                {/* All Open Gym - Muted Green */}
                <button
                  onClick={() => {
                    const openGymUrls = getAllUrlsForEventType('OPEN GYM');
                    openMultipleTabs(openGymUrls, `Opening ${openGymUrls.length} Open Gym pages...`, `Opened ${openGymUrls.length} Open Gym pages!`);
                  }}
                  className="flex flex-col items-center justify-center gap-1 p-3 rounded-lg shadow-md hover:shadow-lg transition-all duration-200 cursor-pointer"
                  style={{ backgroundColor: '#6b8e6b', border: '2px solid #5a7a5a' }}
                >
                  <span className="text-2xl">🎯</span>
                  <span className="text-xs font-bold text-white">All Open Gym</span>
                </button>

                {/* All Booking - Teal */}
                <button
                  onClick={() => {
                    const bookingUrls = getAllUrlsForEventType('BOOKING');
                    openMultipleTabs(bookingUrls, `Opening ${bookingUrls.length} Booking pages...`, `Opened ${bookingUrls.length} Booking pages!`);
                  }}
                  className="flex flex-col items-center justify-center gap-1 p-3 rounded-lg shadow-md hover:shadow-lg transition-all duration-200 cursor-pointer"
                  style={{ backgroundColor: '#7a9a9e', border: '2px solid #6a8a8e' }}
                >
                  <span className="text-2xl">🌐</span>
                  <span className="text-xs font-bold text-white">All Booking</span>
                </button>

                {/* School Year Full - Coral */}
                <button
                  onClick={() => {
                    const campUrls = getAllUrlsForEventType('camps');
                    openMultipleTabs(campUrls, `Opening ${campUrls.length} School Year Full camp pages...`, `Opened ${campUrls.length} pages!`);
                  }}
                  className="flex flex-col items-center justify-center gap-1 p-3 rounded-lg shadow-md hover:shadow-lg transition-all duration-200 cursor-pointer"
                  style={{ backgroundColor: '#c4956b', border: '2px solid #a67b51' }}
                >
                  <span className="text-2xl">🏕️</span>
                  <span className="text-xs font-bold text-white">School Year Full</span>
                </button>

                {/* School Year Half - Gray */}
                <button
                  onClick={() => {
                    const halfDayCampUrls = getAllUrlsForEventType('camps_half');
                    openMultipleTabs(halfDayCampUrls, `Opening ${halfDayCampUrls.length} School Year Half camp pages...`, `Opened ${halfDayCampUrls.length} pages!`);
                  }}
                  className="flex flex-col items-center justify-center gap-1 p-3 rounded-lg shadow-md hover:shadow-lg transition-all duration-200 cursor-pointer"
                  style={{ backgroundColor: '#9e9e9e', border: '2px solid #8a8a8a' }}
                >
                  <span className="text-2xl">🕐</span>
                  <span className="text-xs font-bold text-white">School Year Half</span>
                </button>

                {/* Summer Full Day - Warm Orange */}
                <button
                  onClick={() => {
                    const summerFullUrls = getAllUrlsForEventType('camps_summer_full');
                    openMultipleTabs(summerFullUrls, `Opening ${summerFullUrls.length} Summer Full Day camp pages...`, `Opened ${summerFullUrls.length} pages!`);
                  }}
                  className="flex flex-col items-center justify-center gap-1 p-3 rounded-lg shadow-md hover:shadow-lg transition-all duration-200 cursor-pointer"
                  style={{ backgroundColor: '#d4a060', border: '2px solid #b88a4a' }}
                >
                  <span className="text-2xl">☀️</span>
                  <span className="text-xs font-bold text-white">Summer Full Day</span>
                </button>

                {/* Summer Half Day - Salmon */}
                <button
                  onClick={() => {
                    const summerHalfUrls = getAllUrlsForEventType('camps_summer_half');
                    openMultipleTabs(summerHalfUrls, `Opening ${summerHalfUrls.length} Summer Half Day camp pages...`, `Opened ${summerHalfUrls.length} pages!`);
                  }}
                  className="flex flex-col items-center justify-center gap-1 p-3 rounded-lg shadow-md hover:shadow-lg transition-all duration-200 cursor-pointer"
                  style={{ backgroundColor: '#c4856b', border: '2px solid #a66b51' }}
                >
                  <span className="text-2xl">🌤️</span>
                  <span className="text-xs font-bold text-white">Summer Half Day</span>
                </button>
              </div>
          </div>


        {/* Monthly Requirements */}
        <div className="rounded-lg shadow-lg p-3 mb-2 mx-2" style={{ backgroundColor: '#e6e6e6', border: '1px solid #adb2c6' }}>
            {/* Month Navigation */}
            <div className="flex justify-center items-center gap-4 mb-3">
              <button
                onClick={() => {
                  if (currentMonth === 0) {
                    setCurrentMonth(11);
                    setCurrentYear(currentYear - 1);
                  } else {
                    setCurrentMonth(currentMonth - 1);
                  }
                }}
                className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-gray-100 text-gray-700 text-sm font-medium transition-all duration-200 hover:bg-gray-200 hover:scale-105"
              >
                <ChevronLeft className="w-4 h-4" />
                Previous
              </button>
              
              <div className="text-center">
                <h2 className="text-lg font-bold" style={{ color: theme.colors.textPrimary }}>
                  {new Date(currentYear, currentMonth).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                </h2>
              </div>
              
              <button
                onClick={() => {
                  if (currentMonth === 11) {
                    setCurrentMonth(0);
                    setCurrentYear(currentYear + 1);
                  } else {
                    setCurrentMonth(currentMonth + 1);
                  }
                }}
                className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-gray-100 text-gray-700 text-sm font-medium transition-all duration-200 hover:bg-gray-200 hover:scale-105"
              >
                Next
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
            
            {/* Title */}
            <div className="text-center mb-2">
              <h3 className="text-sm font-semibold" style={{ color: '#737373' }}>
                📊 Monthly Requirements
              </h3>
            </div>
            
            {/* Monthly Goal centered under title */}
            <div className="flex justify-center mb-2 text-xs">
              <div className="bg-gray-50 px-3 py-2 rounded border">
                <span className="font-semibold text-gray-700">Monthly Goal: </span>
                <span className="text-gray-600">
                  {monthlyRequirements['CLINIC']} Clinic • {monthlyRequirements['KIDS NIGHT OUT']} KNO • {monthlyRequirements['OPEN GYM']} Open Gym
                </span>
              </div>
            </div>
            
            {/* Instructions - subtle, above table */}
            <div className="text-xs text-gray-500 text-center mb-2">
              📍 Gym → scroll | 🔢 Number → open page | ✨ Sparkle → open all
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full border border-gray-200">
                <thead>
                  <tr style={{ backgroundColor: '#8b6f6f' }}>
                    <th className="p-2 border text-sm text-center font-bold text-white">
                      Gym
                    </th>
                    {eventTypes.filter(et => et.is_tracked).map((eventType, i) => (
                      <th key={i} className="p-2 border text-sm text-center font-bold text-white">
                        {eventType.display_name || eventType.name}
                      </th>
                    ))}
                    <th className="p-2 border text-sm text-center font-bold text-white">Status</th>
                    <th className="p-2 border text-sm text-center font-bold text-white" title="Data quality issues">Issues</th>
                  </tr>
                </thead>
                <tbody>
                  {allGyms.map((gym, i) => {
                    const counts = getEventCounts();
                    
                    return (
                      <tr key={i} className="border-b hover:bg-gray-50 transition-colors">
                        <td className="p-1 border font-medium text-sm" style={{ color: theme.colors.textPrimary }}>
                          <div className="flex items-center justify-center">
                            <button
                              onClick={() => scrollToGym(gym)}
                              className="hover:underline inline-flex items-center gap-1 hover:bg-blue-50 px-2 py-1 rounded transition-colors font-bold cursor-pointer text-base"
                              style={{ color: '#4a4a4a' }}
                              title={`Jump to ${gym} in calendar`}
                            >
                              {gym}
                              <svg className="w-3 h-3 opacity-60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                              </svg>
                            </button>
                            {getGymLinkUrl(gym, 'Booking (Special Events)') && (
                              <a 
                                href={getGymLinkUrl(gym, 'Booking (Special Events)')} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 hover:scale-125 px-1 py-1 rounded transition-all text-xs"
                                title={`View all special events at ${gym}`}
                              >
                                ✨
                              </a>
                            )}
                            {/* Quick Access: one-click opens all */}
                            <button
                              onClick={() => handleMagicControlClick(gym)}
                              className="ml-1 inline-flex items-center justify-center px-2 py-1 rounded text-xs font-semibold hover:bg-purple-50 transition-colors hover:scale-110"
                              style={{ color: theme.colors.textPrimary }}
                              title={`Open Clinic, KNO, Open Gym${getGymLinkUrl(gym, 'camps') || getGymLinkUrl(gym, 'camps_half') ? ', Camps' : ''} for ${gym}`}
                            >
                              <span aria-hidden>✨</span>
                              <span className="sr-only">Open All Events</span>
                            </button>
                          </div>
                        </td>
                        {Object.keys(monthlyRequirements).map((eventType, j) => {
                          const count = counts[gym]?.[eventType] || 0;
                          const requiredCount = monthlyRequirements[eventType];
                          const isDeficient = count < requiredCount;
                          
                          // Get URL from Supabase gym links data
                          const url = getGymLinkUrl(gym, eventType) || getGymLinkUrl(gym, 'BOOKING') || '#';
                          const backgroundColor = getEventTypeColor(eventType);
                          
                          // Adjust background opacity for deficient counts
                          let adjustedBackgroundColor = backgroundColor;
                          if (isDeficient) {
                            // Make deficient counts lighter/more transparent
                            if (backgroundColor.startsWith('#')) {
                              // Convert hex to lighter version
                              const hex = backgroundColor.replace('#', '');
                              const r = parseInt(hex.substr(0, 2), 16);
                              const g = parseInt(hex.substr(2, 2), 16);
                              const b = parseInt(hex.substr(4, 2), 16);
                              adjustedBackgroundColor = `rgba(${r}, ${g}, ${b}, 0.3)`;
                            } else {
                              adjustedBackgroundColor = backgroundColor.replace(')', ', 0.3)').replace('rgb', 'rgba');
                            }
                          }
                          
                          return (
                            <td key={j} className="p-1 border text-center text-sm" style={{ color: theme.colors.textPrimary }}>
                              <a 
                                href={url} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="font-bold inline-flex items-center justify-center gap-1 px-3 py-2 rounded transition-all duration-200 hover:scale-105 hover:shadow-md text-gray-700 min-w-[48px] h-[40px]"
                                style={{ backgroundColor: adjustedBackgroundColor }}
                                title={`View ${eventType} page at ${gym} (${count}/${requiredCount})`}
                              >
                                <span className="text-lg font-bold">{count}</span>
                                <svg className="w-3 h-3 opacity-60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                </svg>
                              </a>
                            </td>
                          );
                        })}
                        <td className="p-1 border text-center text-sm" style={{ color: theme.colors.textPrimary }}>
                          {(() => {
                            // Check each requirement individually
                            let meetsAllRequirements = true;
                            let missingItems = [];
                            
                            Object.keys(monthlyRequirements).forEach(eventType => {
                              const requiredCount = monthlyRequirements[eventType];
                              const currentCount = counts[gym]?.[eventType] || 0;
                              if (currentCount < requiredCount) {
                                meetsAllRequirements = false;
                                const deficit = requiredCount - currentCount;
                                const shortLabel = eventType === 'KIDS NIGHT OUT' ? 'KNO' : eventType;
                                missingItems.push(`+${deficit} ${shortLabel}`);
                              }
                            });
                            
                            if (meetsAllRequirements) {
                              return (
                                <span className="font-bold px-3 py-1 rounded-lg shadow-sm text-white" style={{ backgroundColor: '#6b8e6b' }}>
                                  ✓ Complete
                                </span>
                              );
                            } else {
                              return (
                                <span className="font-bold px-3 py-1 rounded-lg shadow-sm text-white" style={{ backgroundColor: '#c27878' }}>
                                  {missingItems.join(' • ')}
                                </span>
                              );
                            }
                          })()}
                        </td>
                        {/* Quality Column - Data Issues */}
                        <td className="p-1 border text-center text-sm" style={{ color: theme.colors.textPrimary }}>
                          {(() => {
                            // Get events for this gym in current month
                            const gymEvents = events.filter(e => {
                              const eventDate = new Date(e.date);
                              return e.gym_name === gym && 
                                     eventDate.getMonth() === currentMonth && 
                                     eventDate.getFullYear() === currentYear;
                            });
                            
                            // Count issues only (not informational stuff) - respects dismissed warnings
                            // NOTE: sold_out type is excluded - it's informational, not an audit error
                            const errors = gymEvents.filter(e => {
                              const acknowledged = e.acknowledged_errors || [];
                              return (e.validation_errors || []).some(err => 
                                err.type !== 'sold_out' && !isErrorAcknowledged(acknowledged, err.message)
                              );
                            }).length;
                            const warnings = gymEvents.filter(e => e.description_status === 'flyer_only').length;
                            const missing = gymEvents.filter(e => e.description_status === 'none').length;
                            const soldOut = gymEvents.filter(e => e.has_openings === false).length;
                            const totalIssues = errors + warnings + missing;
                            
                            // Show sold out count even if otherwise clean (it's informational, not an error)
                            if (totalIssues === 0) {
                              return (
                                <span className="font-bold px-3 py-1 rounded-lg shadow-sm text-white text-xs" style={{ backgroundColor: '#6b8e6b' }}>
                                  ✓
                                </span>
                              );
                            }
                            
                            return (
                              <span 
                                className="font-bold px-3 py-1 rounded-lg shadow-sm text-white text-xs inline-flex items-center gap-1 cursor-pointer hover:shadow-md"
                                style={{ backgroundColor: '#c27878' }}
                                title={`${totalIssues} issues: ${errors} errors, ${warnings} warnings, ${missing} missing`}
                              >
                                {totalIssues}
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                </svg>
                              </span>
                            );
                          })()}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            </div>

          {/* Controls */}
          <div className="mb-2 space-y-2">
            {/* Month Navigation */}
            <div ref={monthNavRef} className="flex items-center justify-center gap-1 mb-2">
              <button
                onClick={goToPreviousMonth}
                className="flex items-center gap-1 px-3 py-1 rounded-full text-white transition-all duration-200 hover:scale-105 hover:shadow-md text-sm"
                style={{ backgroundColor: theme.colors.primary }}
              >
                <ChevronLeft className="w-4 h-4" />
                Previous
              </button>
              
              <h2 className="text-lg font-bold px-4 py-1 rounded-full text-white shadow-md"
                  style={{ backgroundColor: theme.colors.accent }}>
                {new Date(currentYear, currentMonth).toLocaleDateString('en-US', { 
                  month: 'long', 
                  year: 'numeric' 
                })}
              </h2>
              
              <button
                onClick={goToNextMonth}
                className="flex items-center gap-1 px-3 py-1 rounded-full text-white transition-all duration-200 hover:scale-105 hover:shadow-md text-sm"
                style={{ backgroundColor: theme.colors.primary }}
              >
                Next
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            {/* ADD EVENT - Centered Under Header */}
            <div className="flex justify-center mb-2">
              <button
                onClick={() => setShowAddEventModal(true)}
                className="flex items-center gap-2 px-4 py-2 rounded-lg transition-all duration-200 hover:scale-105 shadow-md font-medium text-sm"
                style={{ 
                  backgroundColor: theme.colors.primary,
                  color: 'white'
                }}
              >
                <Plus className="w-4 h-4" />
                ADD EVENT
              </button>
            </div>

            {/* All Controls in One Row */}
            <div className="flex justify-center items-end gap-3 mb-2">
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-2">Gym:</label>
                <select
                  value={selectedGym}
                  onChange={(e) => setSelectedGym(e.target.value)}
                  className="px-4 py-2 border rounded-lg focus:ring-2 focus:ring-pink-300 focus:border-pink-400 bg-white shadow-sm min-w-[140px]"
                >
                  <option value="all">All Gyms</option>
                  {gymsList.map(gym => (
                    <option key={gym.id} value={gym.name}>{gym.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-600 mb-2">Category:</label>
                <select
                  value={selectedEventType}
                  onChange={(e) => setSelectedEventType(e.target.value)}
                  className="px-4 py-2 border rounded-lg focus:ring-2 focus:ring-pink-300 focus:border-pink-400 bg-white shadow-sm min-w-[140px]"
                >
                  <option value="all">All Events</option>
                  {eventTypesFromEvents.map(type => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
              </div>

              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <input
                  type="text"
                  placeholder="Search events..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-pink-300 focus:border-pink-400 bg-white shadow-sm w-48"
                />
              </div>

              <button
                onClick={() => setViewMode(viewMode === 'calendar' ? 'table' : 'calendar')}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white border hover:bg-gray-50 transition-colors shadow-sm"
              >
                {viewMode === 'calendar' ? <List className="w-4 h-4" /> : <Grid className="w-4 h-4" />}
                {viewMode === 'calendar' ? 'Table View' : 'Calendar View'}
              </button>
            </div>

            {/* Event Types - All Filter Buttons */}
            <div className="flex justify-center items-center gap-2 mb-2">
              <button
                onClick={() => setSelectedEventType('all')}
                className={`flex items-center gap-1 px-3 py-1 rounded cursor-pointer border transition-all text-sm ${
                  selectedEventType === 'all' 
                    ? 'border-gray-500 shadow-md bg-gray-100 font-semibold' 
                    : 'border-gray-300 bg-white hover:bg-gray-50'
                }`}
              >
                ALL
              </button>

              <button
                onClick={() => setSelectedEventType('CLINIC')}
                className={`flex items-center gap-1 px-3 py-1 rounded cursor-pointer border transition-all text-sm ${
                  selectedEventType === 'CLINIC' ? 'border-purple-400 shadow-md' : 'border-transparent'
                }`} 
                style={{ backgroundColor: '#F3E8FF' }}
              >
                CLINIC
              </button>
              
              <button 
                onClick={() => setSelectedEventType('KIDS NIGHT OUT')}
                className={`flex items-center gap-1 px-3 py-1 rounded cursor-pointer border transition-all text-sm ${
                  selectedEventType === 'KIDS NIGHT OUT' ? 'border-pink-400 shadow-md' : 'border-transparent'
                }`} 
                style={{ backgroundColor: '#FFCCCB' }}
              >
                KNO
              </button>
              
              <button 
                onClick={() => setSelectedEventType('OPEN GYM')}
                className={`flex items-center gap-1 px-3 py-1 rounded cursor-pointer border transition-all text-sm ${
                  selectedEventType === 'OPEN GYM' ? 'border-green-400 shadow-md' : 'border-transparent'
                }`} 
                style={{ backgroundColor: '#C8E6C9' }}
              >
                OPEN GYM
              </button>
              
              <button 
                onClick={() => setSelectedEventType('CAMP')}
                className={`flex items-center gap-1 px-3 py-1 rounded cursor-pointer border transition-all text-sm ${
                  selectedEventType === 'CAMP' ? 'border-yellow-400 shadow-md' : 'border-transparent'
                }`} 
                style={{ backgroundColor: '#fde685' }}
              >
                CAMP
              </button>
            </div>

          </div>

        {/* Table View */}
        {viewMode === 'table' && (
          <div className="bg-white rounded-lg shadow-lg overflow-hidden">
            <div className="px-6 py-4 border-b bg-gray-50">
              <h3 className="text-lg font-semibold" style={{ color: theme.colors.textPrimary }}>
                Events Table View ({filteredEvents.length} events)
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Event</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Gym</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Time</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Price</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredEvents.length === 0 ? (
                    <tr>
                      <td colSpan="7" className="px-6 py-12 text-center text-gray-500">
                        <div className="flex flex-col items-center">
                          <div className="text-4xl mb-4">📅</div>
                          <div className="text-lg font-medium">No events found</div>
                          <div className="text-sm">Try adjusting your filters or check the database connection</div>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredEvents.map((event) => (
                      <tr key={event.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {new Date(event.date).toLocaleDateString()}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-900">
                          <div className="font-medium">{event.title || 'Untitled Event'}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span 
                            className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium"
                            style={{ 
                              backgroundColor: getEventTypeColor(event.type || event.event_type),
                              color: '#374151'
                            }}
                          >
                            {event.type || event.event_type || 'No Type'}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-900">
                          {event.gym_name || event.gym_code || 'Unknown Gym'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {formatTime(event.time || event.event_time)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {event.price ? `$${event.price}` : <span className="text-gray-500 italic">Price not in title</span>}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <div className="flex items-center space-x-2">
                            {event.event_url && (
                              <button
                                onClick={() => window.open(event.event_url, '_blank')}
                                className="text-blue-600 hover:text-blue-900"
                              >
                                View
                              </button>
                            )}
                            {event.registration_url && (
                              <button
                                onClick={() => window.open(event.registration_url, '_blank')}
                                className="text-green-600 hover:text-green-900"
                              >
                                Register
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Calendar View */}
        {viewMode === 'calendar' && (
            <div className="space-y-2">
              {/* 🪄 Jayme's Command Center - BEFORE CALENDAR VIEW */}
              <div className="flex justify-center mb-2">
                <button
                  onClick={(e) => {
                    if (e.shiftKey) {
                      setShowAdminPortal(true);
                    }
                  }}
                  className="flex items-center justify-center w-8 h-8 bg-white rounded border border-purple-300 hover:border-purple-500 hover:bg-purple-50 transition-all duration-200 group opacity-70 hover:opacity-100"
                  title="🔐 Jayme's Command Center"
                >
                  <span className="text-lg group-hover:scale-125 transition-transform">🪄</span>
                </button>
              </div>

              {/* Calendar Controls - Clean & Centered */}
              <div className="text-center mb-2">
                <h3 className="text-base font-semibold mb-2" style={{ color: theme.colors.textPrimary }}>
                  Calendar View:
                    </h3>
                
                {/* Main view buttons */}
                <div className="flex justify-center gap-2 mb-2">
                        <button
                          onClick={() => handleCalendarViewChange('firstHalf')}
                    className={`px-3 py-1 rounded-lg text-sm font-medium transition-all duration-200 ${
                      calendarView === 'firstHalf' ? 'text-white shadow-lg' : 'text-gray-600 bg-white border hover:shadow-md'
                          }`}
                          style={calendarView === 'firstHalf' ? { backgroundColor: theme.colors.primary } : {}}
                        >
                          Days 1-15
                        </button>
                        <button
                          onClick={() => handleCalendarViewChange('secondHalf')}
                    className={`px-3 py-1 rounded-lg text-sm font-medium transition-all duration-200 ${
                      calendarView === 'secondHalf' ? 'text-white shadow-lg' : 'text-gray-600 bg-white border hover:shadow-md'
                          }`}
                          style={calendarView === 'secondHalf' ? { backgroundColor: theme.colors.primary } : {}}
                        >
                    Days 16-30
                        </button>
                      <button
                        onClick={() => handleCalendarViewChange('full')}
                    className={`px-3 py-1 rounded-lg text-sm font-medium transition-all duration-200 ${
                      calendarView === 'full' ? 'text-white shadow-lg' : 'text-gray-600 bg-white border hover:shadow-md'
                        }`}
                        style={calendarView === 'full' ? { backgroundColor: theme.colors.primary } : {}}
                      >
                        Full Month
                      </button>
                </div>

                {/* Quick weeks */}
                <div className="flex justify-center items-center gap-2">
                  <span className="text-sm text-gray-600 mr-2">Quick:</span>
                        <button
                          onClick={() => handleCalendarViewChange('week1')}
                    className={`px-3 py-1 rounded text-sm font-medium transition-all duration-200 ${
                      calendarView === 'week1' ? 'text-white shadow-md' : 'text-gray-600 bg-gray-100 hover:bg-gray-200'
                          }`}
                          style={calendarView === 'week1' ? { backgroundColor: theme.colors.accent } : {}}
                        >
                          Week 1
                        </button>
                        <button
                          onClick={() => handleCalendarViewChange('week2')}
                    className={`px-3 py-1 rounded text-sm font-medium transition-all duration-200 ${
                      calendarView === 'week2' ? 'text-white shadow-md' : 'text-gray-600 bg-gray-100 hover:bg-gray-200'
                          }`}
                          style={calendarView === 'week2' ? { backgroundColor: theme.colors.accent } : {}}
                        >
                          Week 2
                        </button>
                        <button
                          onClick={() => handleCalendarViewChange('week3')}
                    className={`px-3 py-1 rounded text-sm font-medium transition-all duration-200 ${
                      calendarView === 'week3' ? 'text-white shadow-md' : 'text-gray-600 bg-gray-100 hover:bg-gray-200'
                          }`}
                          style={calendarView === 'week3' ? { backgroundColor: theme.colors.accent } : {}}
                        >
                          Week 3
                        </button>
                        <button
                          onClick={() => handleCalendarViewChange('week4')}
                    className={`px-3 py-1 rounded text-sm font-medium transition-all duration-200 ${
                      calendarView === 'week4' ? 'text-white shadow-md' : 'text-gray-600 bg-gray-100 hover:bg-gray-200'
                          }`}
                          style={calendarView === 'week4' ? { backgroundColor: theme.colors.accent } : {}}
                        >
                          Week 4+
                        </button>
                    </div>
                  </div>

              <div className="mt-4 text-xs text-center" style={{ color: theme.colors.textSecondary }}>
                  <p>• Click any event card to open the side panel with full details and registration links</p>
                  <div className="mt-2 flex items-center justify-center gap-4 text-[10px]">
                    <span className="flex items-center gap-1">
                      <span className="w-3 h-3 bg-red-500 rounded-full border border-red-700 inline-block"></span>
                      Data Error
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="w-2.5 h-2.5 bg-orange-400 rounded-full border border-orange-600 inline-block"></span>
                      Formatting
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="w-2.5 h-2.5 bg-red-500 rounded-full border border-red-700 inline-block"></span>
                      <span className="w-2 h-2 bg-orange-400 rounded-full border border-orange-600 inline-block -ml-1.5"></span>
                      Both
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="w-2 h-2 bg-gray-400 rounded-full inline-block"></span>
                      Flyer Only
                    </span>
                  </div>
              </div>


              {/* Calendar Grid - FULL WIDTH */}
              <div className={`mx-2 mb-20 pb-20 transition-all duration-300 ${selectedEventForPanel ? 'mr-[400px]' : ''}`}>
                <div ref={calendarRef} className="w-full overflow-x-auto overflow-y-visible rounded-xl shadow-lg" style={{ backgroundColor: 'rgba(255, 255, 255, 0.95)' }}>
                  <div className="min-w-full pb-8">
                  {/* Calendar Header */}
                  <div className="grid sticky top-0 z-50 border-b-2 shadow-lg" 
                       style={{ 
                         gridTemplateColumns: `100px repeat(${displayDates.length}, 1fr)`,
                         backgroundColor: theme.colors.secondary,
                         borderColor: theme.colors.primary
                       }}>
                    {/* Gym Header */}
                    <div className="p-2 font-bold text-center border-r-2" style={{ borderColor: theme.colors.primary }}>
                      Gym
                    </div>
                    
                    {/* Date Headers */}
                    {displayDates.map(date => (
                      <div key={date} className="p-2 text-center font-medium border-r border-gray-200 min-w-0">
                        <div className="text-sm font-bold">{date}</div>
                        <div className="text-xs text-gray-600">
                          {new Date(currentYear, currentMonth, date).toLocaleDateString('en-US', { weekday: 'short' })}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Calendar Body */}
                  <div className="divide-y divide-gray-200 relative">
                    {allGymsFromList.map(gym => {
                      // Find the gym data to get both name and id (gym code like "CRR")
                      const gymData = gymsList.find(g => g.name === gym);
                      const gymId = gymData?.id; // This is the gym_code like "CRR"
                      
                      // Match events by gym_name, gym_code, OR gym_id
                      const gymEvents = filteredEvents.filter(e => 
                        (e.gym_name || e.gym_code) === gym || 
                        e.gym_id === gymId
                      );
                      
                      
                      return (
                        <div
                          key={gym}
                          ref={el => gymRefs.current[gym] = el}
                          className="grid hover:bg-gray-50 transition-colors"
                          style={{ gridTemplateColumns: `100px repeat(${displayDates.length}, 1fr)` }}
                        >
                          {/* Gym Logo Column */}
                          <div 
                            className="p-2 font-medium border-r-2 bg-gray-50 flex flex-col items-center justify-center gap-1"
                            style={{ borderColor: theme.colors.primary }}
                            title={`${gym} - ${gymEvents.length} event${gymEvents.length !== 1 ? 's' : ''}`}
                          >
                            <div className="cursor-help flex flex-col items-center">
                              {/* Gym Logo - Shows image from Supabase Storage or colored placeholder */}
                              {(() => {
                                const gymData = gymsList.find(g => g.name === gym);
                                const gymId = gymData?.id;
                                const logoUrl = gymData?.logo_url; // Will use this when added to database
                                
                                return logoUrl ? (
                                  // Real logo from Supabase Storage
                                  <img 
                                    src={logoUrl}
                                    alt={gym}
                                    className="w-10 h-10 rounded-full object-cover shadow-md border-2 border-white"
                                    onError={(e) => {
                                      // Fallback to colored badge if image fails to load
                                      e.target.style.display = 'none';
                                      e.target.nextSibling.style.display = 'flex';
                                    }}
                                  />
                                ) : (
                                  // Colored placeholder badge
                                  <div 
                                    className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-xs shadow-md"
                                    style={{ 
                                      backgroundColor: gymColors[gymId] || theme.colors.accent 
                                    }}
                                  >
                                    {gymId || gym.substring(0, 2).toUpperCase()}
                                  </div>
                                );
                              })()}
                              {/* Gym Abbreviation Below Logo */}
                              <div className="text-xs text-gray-700 font-bold mt-1">
                                {gymsList.find(g => g.name === gym)?.id || gym.substring(0, 3).toUpperCase()}
                              </div>
                            </div>
                          </div>
                          
                          {/* Date Columns */}
                          {displayDates.map(date => {
                            const dateEvents = gymEvents.filter(event => {
                              if (!event.date) return false;
                              
                              // Helper: Extract actual end date from title if database end_date is wrong
                              const getActualEndDate = (event) => {
                                // Check if title has date range patterns like "11/24 - 11/26" or "Nov 24-26"
                                const title = event.title || '';
                                
                                // Pattern: "11/24 - 11/26" or "11/24-11/26"
                                const dateRangeMatch = title.match(/(\d{1,2})\/(\d{1,2})\s*-\s*(\d{1,2})\/(\d{1,2})/);
                                if (dateRangeMatch) {
                                  const [, startMonth, startDay, endMonth, endDay] = dateRangeMatch;
                                  const year = parseYmdLocal(event.start_date).getFullYear();
                                  return new Date(year, parseInt(endMonth) - 1, parseInt(endDay));
                                }
                                
                                // Pattern: "March 16th-20th" (same month, different days)
                                const sameMonthMatch = title.match(/(\d{1,2})(?:st|nd|rd|th)-(\d{1,2})(?:st|nd|rd|th)/);
                                if (sameMonthMatch) {
                                  const [, startDay, endDay] = sameMonthMatch;
                                  const startDate = parseYmdLocal(event.start_date);
                                  return new Date(startDate.getFullYear(), startDate.getMonth(), parseInt(endDay));
                                }
                                
                                // Fallback to database end_date
                                return event.end_date ? parseYmdLocal(event.end_date) : parseYmdLocal(event.start_date);
                              };
                              
                              // For multi-day events, check if current date falls within start_date and end_date range
                              // ONLY CAMPS can be multi-day. Clinics, Open Gym, and KNO are always single-day events.
                              const multiDayTypes = ['CAMP', 'CAMPS', 'SUMMER CAMP', 'SUMMER CAMP - GYMNASTICS', 'SUMMER CAMP - NINJA'];
                              const isMultiDayType = multiDayTypes.includes((event.type || '').toUpperCase());

                              if (isMultiDayType && event.start_date && event.end_date) {
                                const currentDate = new Date(currentYear, currentMonth, date);
                                const startDate = parseYmdLocal(event.start_date);
                                const endDate = getActualEndDate(event); // Use parsed end date

                                // Only treat as multi-day if start and end are actually different
                                if (startDate.getTime() !== endDate.getTime()) {
                                  // Check if current date is within the event's date range (inclusive)
                                  return currentDate >= startDate && currentDate <= endDate;
                                }
                              }
                              
                              // For single-day events, match by exact date
                              const eventDate = parseYmdLocal(event.date);
                              return eventDate.getFullYear() === currentYear && 
                                     eventDate.getMonth() === currentMonth && 
                                     eventDate.getDate() === date;
                            });
                            
                            // Debug: Log events for first gym to see what's happening
                            if (gym === allGymsFromList[0] && dateEvents.length > 0) {
                              console.log(`Date ${date}: Found ${dateEvents.length} events`, dateEvents);
                            }
                            
                            return (
                              <div key={`${gym}-${date}`} className="p-1 border-r border-gray-200 min-h-[100px] relative">
                                {/* Day indicator - visible even with events */}
                                <div className="absolute top-1 left-1 text-xs font-bold opacity-50 bg-white rounded px-1" 
                                     style={{ color: theme.colors.textPrimary, fontSize: '10px', zIndex: 10 }}>
                                  {date}
                                </div>
                                
                                
                                <div className="space-y-1 pt-1">
                                  {dateEvents.length > 0 ? (
                                    (() => {
                                      // 🏕️ GROUP CAMP EVENTS BY DATE (Display-only consolidation)
                                      // ALL camps on the same date for the same gym should group together
                                      const groupCampEventsForDisplay = (events) => {
                                        const campGroups = new Map();
                                        const regularEvents = [];
                                        
                                        events.forEach(event => {
                                          if (event.type === 'CAMP') {
                                            // SIMPLE: Group ALL camps by gym + date only
                                            // This ensures all camp options on the same day show together
                                            const eventDate = event.date;
                                            const groupKey = `${event.gym_id}-CAMP-${eventDate}`;
                                            
                                            if (!campGroups.has(groupKey)) {
                                              campGroups.set(groupKey, []);
                                            }
                                            campGroups.get(groupKey).push(event);
                                          } else {
                                            regularEvents.push(event);
                                          }
                                        });
                                        
                                        // Convert groups to consolidated display events
                                        const consolidatedCamps = [];
                                        campGroups.forEach((groupEvents, key) => {
                                          if (groupEvents.length === 1) {
                                            // Single option - show as-is
                                            consolidatedCamps.push({ ...groupEvents[0], isGrouped: false, groupedEvents: null });
                                          } else {
                                            // Multiple options - create consolidated event
                                            consolidatedCamps.push({
                                              ...groupEvents[0],
                                              isGrouped: true,
                                              groupedEvents: groupEvents,
                                              optionCount: groupEvents.length
                                            });
                                          }
                                        });
                                        
                                        return [...consolidatedCamps, ...regularEvents.map(e => ({ ...e, isGrouped: false, groupedEvents: null }))];
                                      };
                                      
                                      // Group the events for this date
                                      const displayEvents = groupCampEventsForDisplay(dateEvents);
                                      
                                      // Debug: Log grouping results
                                      if (dateEvents.some(e => e.type === 'CAMP')) {
                                        console.log('Date events:', dateEvents.filter(e => e.type === 'CAMP').map(e => ({
                                          title: e.title,
                                          gym: e.gym_id,
                                          start: e.start_date,
                                          end: e.end_date
                                        })));
                                        console.log('Display events:', displayEvents.filter(e => e.type === 'CAMP').map(e => ({
                                          title: e.title,
                                          isGrouped: e.isGrouped,
                                          count: e.optionCount
                                        })));
                                      }
                                      
                                      return displayEvents.map(event => {
                                        const eventTypeName = event.type || event.event_type;
                                        const eventTypeData = eventTypes.find(et => et.name === eventTypeName);
                                        const displayName = eventTypeData?.display_name || eventTypeName || 'Event';
                                      
                                      return (
                                      <div
                                        key={event.id}
                                        className="relative group cursor-pointer"
                                        onClick={() => setSelectedEventForPanel(event)}
                                      >
                                        <div
                                          className="text-xs rounded text-gray-700 text-center font-medium transition-all duration-200 border p-2 hover:shadow-md hover:scale-105 relative"
                                          style={{ 
                                            backgroundColor: getEventTypeColor(eventTypeName),
                                            borderColor: 'rgba(0,0,0,0.1)'
                                          }}
                                        >
                                          {/* SOLD OUT badge - top left */}
                                          {event.has_openings === false && (
                                            <span className="absolute -top-1 -left-1 bg-red-600 text-white text-[8px] font-bold px-1 rounded" title="SOLD OUT - no spots available">
                                              FULL
                                            </span>
                                          )}
                                          {/* Validation status indicator - only show problems (respects dismissed warnings) */}
                                          {/* NOTE: sold_out type is excluded - it's informational, not an audit error */}
                                          {/* Color coding: RED dot = data error, ORANGE dot = formatting, BOTH = red+orange */}
                                          {(() => {
                                            const acknowledged = event.acknowledged_errors || [];
                                            const activeErrors = (event.validation_errors || []).filter(
                                              err => err.type !== 'sold_out' && !isErrorAcknowledged(acknowledged, err.message)
                                            );
                                            // Separate by category (using inferErrorCategory for legacy data without category field)
                                            const dataErrors = activeErrors.filter(err => inferErrorCategory(err) === 'data_error');
                                            const formattingErrors = activeErrors.filter(err => inferErrorCategory(err) === 'formatting');
                                            const hasDataErrors = dataErrors.length > 0;
                                            const hasFormattingErrors = formattingErrors.length > 0;
                                            
                                            // Show colored dots based on error types
                                            if (hasDataErrors && hasFormattingErrors) {
                                              // Both types - show TWO dots: red + orange side by side
                                              return (
                                                <span className="absolute -top-1 -right-1 flex items-center" title={`DATA: ${dataErrors.length} | FORMAT: ${formattingErrors.length}`}>
                                                  <span className="w-2.5 h-2.5 bg-red-500 rounded-full shadow-sm inline-block border border-red-700"></span>
                                                  <span className="w-2 h-2 bg-orange-400 rounded-full shadow-sm inline-block border border-orange-600 -ml-1"></span>
                                                </span>
                                              );
                                            } else if (hasDataErrors) {
                                              // Data errors only - red dot
                                              return (
                                                <span className="absolute -top-1 -right-1" title={`${dataErrors.length} DATA ERROR(S) - wrong info!`}>
                                                  <span className="w-3 h-3 bg-red-500 rounded-full shadow-sm inline-block border border-red-700"></span>
                                                </span>
                                              );
                                            } else if (hasFormattingErrors) {
                                              // Formatting only - orange dot
                                              return (
                                                <span className="absolute -top-1 -right-1" title={`${formattingErrors.length} formatting issue(s) - incomplete info`}>
                                                  <span className="w-2.5 h-2.5 bg-orange-400 rounded-full shadow-sm inline-block border border-orange-600"></span>
                                                </span>
                                              );
                                            } else if (event.description_status === 'flyer_only') {
                                              // Flyer only - small gray dot
                                              return (
                                                <span className="absolute -top-1 -right-1" title="Has flyer but no text description">
                                                  <span className="w-2 h-2 bg-gray-400 rounded-full shadow-sm inline-block"></span>
                                                </span>
                                              );
                                            } else if (event.description_status === 'none') {
                                              // No description - hollow red circle
                                              return (
                                                <span className="absolute -top-1 -right-1" title="No description at all">
                                                  <span className="w-2.5 h-2.5 border-2 border-red-500 rounded-full inline-block bg-white"></span>
                                                </span>
                                              );
                                            }
                                            return null;
                                          })()}
                                          {/* Compact Card View */}
                                          <div className="font-semibold leading-tight text-sm">
                                            {displayName}
                                          </div>
                                          <div className="text-gray-600 mt-0.5 leading-tight text-xs">
                                            {event.isGrouped ? (
                                              <span className="text-gray-500 italic">{event.optionCount} options available</span>
                                            ) : (
                                              formatTimeShort(event.time || event.event_time)
                                            )}
                                          </div>
                                          
                                        </div>
                                      </div>
                                    );
                                      });
                                    })()
                                  ) : (
                                    // Show placeholder for debugging
                                    <div className="text-xs text-gray-400 p-1">
                                      {/* Empty */}
                                    </div>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Bottom Month Navigation - Mirror of Top */}
              <div className="flex justify-center items-center gap-4 mb-4 mt-6">
                <button
                  onClick={goToPreviousMonth}
                  className="flex items-center gap-1 px-3 py-1 rounded-full text-white transition-all duration-200 hover:scale-105 hover:shadow-md text-sm"
                  style={{ backgroundColor: theme.colors.primary }}
                >
                  <ChevronLeft className="w-4 h-4" />
                  Previous
                </button>
                <div className="text-base font-bold" style={{ color: theme.colors.textPrimary }}>
                  {new Date(currentYear, currentMonth).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                </div>
                <button
                  onClick={goToNextMonth}
                  className="flex items-center gap-1 px-3 py-1 rounded-full text-white transition-all duration-200 hover:scale-105 hover:shadow-md text-sm"
                  style={{ backgroundColor: theme.colors.primary }}
                >
                  Next
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>

              {/* Bottom ADD EVENT Button */}
              <div className="flex justify-center mb-6">
                <button
                  onClick={() => setShowAddEventModal(true)}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg transition-all duration-200 hover:scale-105 shadow-md font-medium text-sm"
                  style={{ 
                    backgroundColor: theme.colors.primary,
                    color: 'white'
                  }}
                >
                  <Plus className="w-4 h-4" />
                  ADD EVENT
                </button>
              </div>
              </div>

              {/* Event Detail Side Panel */}
              {selectedEventForPanel && (
                <div
                  className="fixed right-0 top-0 h-full w-96 bg-white shadow-2xl z-50 overflow-y-auto transform transition-transform duration-300 ease-in-out"
                  style={{
                    borderLeft: `4px solid ${theme.colors.primary}`
                  }}
                >
                  {/* Header with close button */}
                  <div className="sticky top-0 bg-white border-b p-4 flex items-center justify-between" style={{ borderColor: theme.colors.primary }}>
                    <h3 className="font-bold text-lg" style={{ color: theme.colors.textPrimary }}>Event Details</h3>
                    <button
                      onClick={() => setSelectedEventForPanel(null)}
                      className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 transition-all"
                      title="Close"
                    >
                      <span className="text-xl text-gray-600">×</span>
                    </button>
                  </div>

                  <div className="p-6">
                    {/* Event Type Badge */}
                    <div className="flex items-center justify-between mb-4">
                      <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium text-gray-700 border"
                            style={{ 
                              backgroundColor: getEventTypeColor(selectedEventForPanel.type || selectedEventForPanel.event_type),
                              borderColor: 'rgba(0,0,0,0.1)'
                            }}>
                        {selectedEventForPanel.type || selectedEventForPanel.event_type || 'EVENT'}
                      </span>
                      {selectedEventForPanel.isGrouped && (
                        <span className="text-sm text-gray-600 font-semibold">
                          {selectedEventForPanel.optionCount} options
                        </span>
                      )}
                    </div>
                    
                    {/* Event Title */}
                    <h4 className="font-bold text-xl mb-4 text-gray-800">
                      {selectedEventForPanel.title || `${selectedEventForPanel.type || selectedEventForPanel.event_type} Event`}
                    </h4>
                    
                    {/* Event Details */}
                    <div className="space-y-3 mb-6 text-sm text-gray-700">
                      <div className="flex items-start gap-3">
                        <MapPin className="w-5 h-5 text-gray-400 mt-0.5" />
                        <div>
                          <div className="font-semibold text-xs text-gray-500 uppercase mb-1">Location</div>
                          <div>{gymsList.find(g => g.gym_code === selectedEventForPanel.gym_code || g.id === selectedEventForPanel.gym_id)?.name || 
                               selectedEventForPanel.gym_name || selectedEventForPanel.gym_code}</div>
                        </div>
                      </div>
                      <div className="flex items-start gap-3">
                        <Calendar className="w-5 h-5 text-gray-400 mt-0.5" />
                        <div>
                          <div className="font-semibold text-xs text-gray-500 uppercase mb-1">Date</div>
                          <div>{parseYmdLocal(selectedEventForPanel.date).toLocaleDateString('en-US', { 
                            weekday: 'long', 
                            year: 'numeric', 
                            month: 'long', 
                            day: 'numeric' 
                          })}</div>
                        </div>
                      </div>
                      <div className="flex items-start gap-3">
                        <Clock className="w-5 h-5 text-gray-400 mt-0.5" />
                        <div>
                          <div className="font-semibold text-xs text-gray-500 uppercase mb-1">Time</div>
                          <div>{formatTime(selectedEventForPanel.time || selectedEventForPanel.event_time) || ''}</div>
                        </div>
                      </div>
                      <div className="flex items-start gap-3">
                        <DollarSign className="w-5 h-5 text-gray-400 mt-0.5" />
                        <div>
                          <div className="font-semibold text-xs text-gray-500 uppercase mb-1">Price</div>
                          {selectedEventForPanel.price ? (
                            <div className="font-bold text-lg" style={{ color: theme.colors.primary }}>${selectedEventForPanel.price}</div>
                          ) : (
                            <div className="text-sm text-gray-500 italic">Price not in event details</div>
                          )}
                        </div>
                      </div>
                      {/* Age Range */}
                      {(selectedEventForPanel.age_min || selectedEventForPanel.age_max) && (
                        <div className="flex items-start gap-3">
                          <Users className="w-5 h-5 text-gray-400 mt-0.5" />
                          <div>
                            <div className="font-semibold text-xs text-gray-500 uppercase mb-1">Ages</div>
                            <div>
                              {selectedEventForPanel.age_min && selectedEventForPanel.age_max 
                                ? `${selectedEventForPanel.age_min} - ${selectedEventForPanel.age_max} years`
                                : selectedEventForPanel.age_min 
                                  ? `${selectedEventForPanel.age_min}+ years`
                                  : `Up to ${selectedEventForPanel.age_max} years`
                              }
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                    
                    {/* Quick Access - MOVED ABOVE DESCRIPTION */}
                    {selectedEventForPanel.type === 'CAMP' && (() => {
                      const gymId = selectedEventForPanel.gym_id;
                      
                      // Find this gym's camp links from database
                      const fullDayLink = gymLinks.find(gl => gl.gym_id === gymId && gl.link_type_id === 'camps');
                      const halfDayLink = gymLinks.find(gl => gl.gym_id === gymId && gl.link_type_id === 'camps_half');
                      
                      // Only show section if gym has at least one camp link
                      if (!fullDayLink && !halfDayLink) return null;
                      
                      return (
                        <div className="border-t pt-4 mb-4" style={{ borderColor: theme.colors.secondary }}>
                          <p className="font-semibold text-xs text-gray-500 uppercase mb-3">🔗 Quick Access</p>
                          
                          <div className="flex gap-2">
                            {fullDayLink && (
                              <button
                                onClick={() => window.open(fullDayLink.url, '_blank')}
                                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-gradient-to-r from-orange-50 to-amber-50 hover:from-orange-100 hover:to-amber-100 border border-orange-200 hover:border-orange-400 transition-all hover:scale-105"
                                title="View all Full Day camps at this gym"
                              >
                                <span className="text-2xl">🏕️</span>
                                <span className="font-semibold text-sm text-orange-800">Full Day</span>
                              </button>
                            )}
                            
                            {halfDayLink && (
                              <button
                                onClick={() => window.open(halfDayLink.url, '_blank')}
                                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-gradient-to-r from-blue-50 to-indigo-50 hover:from-blue-100 hover:to-indigo-100 border border-blue-200 hover:border-blue-400 transition-all hover:scale-105"
                                title="View all Half Day camps at this gym"
                              >
                                <span className="text-2xl">🕐</span>
                                <span className="font-semibold text-sm text-blue-800">Half Day</span>
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })()}

                    {/* Availability Status - SOLD OUT or Registration Info */}
                    {(selectedEventForPanel.has_openings === false || selectedEventForPanel.registration_end_date) && (
                      <div className="border-t pt-4 mb-4" style={{ borderColor: theme.colors.secondary }}>
                        {selectedEventForPanel.has_openings === false && (
                          <div className="bg-red-100 border border-red-300 rounded-lg p-3 mb-2">
                            <div className="font-bold text-red-800 flex items-center gap-2">
                              🔴 SOLD OUT
                            </div>
                            <div className="text-sm text-red-700 mt-1">
                              This event is full - no spots available
                            </div>
                          </div>
                        )}
                        {selectedEventForPanel.registration_end_date && (
                          <div className="text-xs text-gray-600">
                            <span className="font-semibold">Registration closes:</span> {selectedEventForPanel.registration_end_date}
                            {(() => {
                              const regEnd = new Date(selectedEventForPanel.registration_end_date);
                              const today = new Date();
                              today.setHours(0, 0, 0, 0);
                              if (regEnd < today) {
                                return <span className="ml-2 text-red-600 font-medium">(Registration closed)</span>;
                              }
                              return null;
                            })()}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Validation Issues Alert */}
                    {/* NOTE: sold_out type is excluded - it's informational, not an audit error */}
                    {(() => {
                      // Filter out acknowledged errors AND sold_out type (it's info, not an error)
                      const acknowledgedErrors = selectedEventForPanel.acknowledged_errors || [];
                      const activeErrors = (selectedEventForPanel.validation_errors || []).filter(
                        error => error.type !== 'sold_out' && !isErrorAcknowledged(acknowledgedErrors, error.message)
                      );
                      const hasDescriptionIssue = selectedEventForPanel.description_status === 'flyer_only' || 
                                                  selectedEventForPanel.description_status === 'none';
                      
                      // Get dismissed errors with notes for display
                      const dismissedWithNotes = acknowledgedErrors.filter(ack => 
                        typeof ack === 'object' && ack.note
                      );
                      
                      if (activeErrors.length === 0 && !hasDescriptionIssue && dismissedWithNotes.length === 0) return null;
                      
                      // Helper to get friendly label for error type
                      const getErrorLabel = (type) => {
                        const labels = {
                          // Completeness errors (missing required fields)
                          'missing_age_in_title': '📝 Title Missing Age',
                          'missing_date_in_title': '📝 Title Missing Date',
                          'missing_program_in_title': '📝 Title Missing Program Type',
                          'missing_age_in_description': '📄 Description Missing Age',
                          'missing_datetime_in_description': '📄 Description Missing Date/Time',
                          'missing_time_in_description': '📄 Description Missing Time',
                          'missing_price_in_description': '💰 Description Missing Price',
                          'missing_program_in_description': '📄 Description Missing Program Type',
                          'clinic_missing_skill': '🏋️ Clinic Missing Skill',
                          // Accuracy errors (data mismatches)
                          'year_mismatch': '📅 Wrong Year in Title',
                          'date_mismatch': '📅 Date/Month Mismatch',
                          'time_mismatch': '🕐 Time Mismatch',
                          'age_mismatch': '👶 Age Mismatch',
                          'day_mismatch': '📅 Day of Week Mismatch',
                          'program_mismatch': '🏷️ Program Type Mismatch',
                          'skill_mismatch': '🎯 Skill Mismatch',
                          'price_mismatch': '💰 Price Mismatch',
                          'title_desc_mismatch': '📋 Title vs Description Conflict',
                          // Camp pricing validation
                          'camp_price_mismatch': '💰 Camp Price Mismatch',
                          'camp_type_not_offered': '🏕️ Camp Type Not Offered',
                          // Registration/availability (info, not errors)
                          'registration_closed': '🔒 Registration Closed',
                          'registration_not_open': '🔓 Registration Not Open Yet',
                        };
                        return labels[type] || type;
                      };
                      
                      // Handler for dismissing with optional note + optional rule creation
                      const handleDismissWithNote = async (eventId, errorMessage, errorObj = null) => {
                        const note = window.prompt(
                          'Optional: Add a note explaining why this is OK (or leave blank):',
                          ''
                        );
                        if (note === null) return; // User clicked Cancel

                        await acknowledgeValidationError(eventId, errorMessage, note || null);

                        // After dismissing, offer to add as permanent rule if eligible
                        if (errorObj && canAddAsRule(errorObj.type)) {
                          const ruleInfo = extractRuleValue(errorObj);
                          if (ruleInfo && selectedEventForPanel?.gym_id) {
                            const gymId = selectedEventForPanel.gym_id;
                            const displayValue = ruleInfo.ruleType === 'price' ? `$${ruleInfo.value}` : ruleInfo.value;

                            const wantRule = window.confirm(
                              `Done! Warning dismissed.\n\n` +
                              `Want to also make "${displayValue}" a permanent rule for ${gymId}?\n\n` +
                              `YES (OK) = Never flag this on ${gymId} camps again\n` +
                              `NO (Cancel) = Just dismiss this one time`
                            );

                            if (wantRule) {
                              const label = window.prompt(
                                `What is "${displayValue}"? (e.g. "Before Care", "After Care", "Early Dropoff"):`,
                                ''
                              );
                              if (label && label.trim()) {
                                try {
                                  await gymValidValuesApi.create({
                                    gym_id: gymId,
                                    rule_type: ruleInfo.ruleType,
                                    value: ruleInfo.value,
                                    label: label.trim(),
                                    event_type: 'CAMP'
                                  });
                                  alert(`Rule saved! "${displayValue}" is now valid for ${gymId} (${label.trim()}).`);
                                } catch (ruleErr) {
                                  console.error('Error adding rule:', ruleErr);
                                  alert('Dismissed OK, but failed to add rule. Add it manually in Admin → Gym Rules.');
                                }
                              }
                            }
                          }
                        }
                      };
                      
                      // Count total issues including description status
                      const totalIssues = activeErrors.length + (hasDescriptionIssue ? 1 : 0);
                      
                      // Separate by category (using inferErrorCategory for legacy data without category field)
                      const dataErrors = activeErrors.filter(e => inferErrorCategory(e) === 'data_error');
                      const formattingErrors = activeErrors.filter(e => inferErrorCategory(e) === 'formatting');
                      const statusErrors = activeErrors.filter(e => inferErrorCategory(e) === 'status');
                      // No more uncategorized - inferErrorCategory handles all cases
                      const uncategorizedErrors = []; // Keep for backwards compatibility but will always be empty
                      
                      return (
                        <div className="border-t pt-4 mb-4" style={{ borderColor: theme.colors.secondary }}>
                          {/* Active Issues */}
                          {(activeErrors.length > 0 || hasDescriptionIssue) && (
                            <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-3">
                              <div className="font-semibold text-red-800 mb-2 flex items-center justify-between">
                                <span className="flex items-center gap-2">
                                  🚨 Data Issues Detected
                                </span>
                                <span className="text-xs bg-red-200 text-red-800 px-2 py-1 rounded-full font-bold">
                                  {totalIssues} issue{totalIssues !== 1 ? 's' : ''} to fix
                                </span>
                              </div>
                              
                              <ul className="text-sm text-red-700 space-y-2">
                                {/* Description Status Issues */}
                                {selectedEventForPanel.description_status === 'none' && (
                                  <li className="flex items-center gap-2 p-2 bg-red-100 rounded">
                                    <span>❌ <strong>No description</strong> - Event has no description text</span>
                                  </li>
                                )}
                                {selectedEventForPanel.description_status === 'flyer_only' && (
                                  <li className="flex items-center gap-2 p-2 bg-yellow-100 rounded">
                                    <span>⚠️ <strong>Flyer only</strong> - Has image but no text description</span>
                                  </li>
                                )}
                                
                                {/* DATA ERRORS - High Priority (Red) */}
                                {dataErrors.length > 0 && (
                                  <li className="pt-1">
                                    <div className="text-xs font-semibold text-red-700 uppercase mb-1 flex items-center gap-1">
                                      <span className="bg-red-600 text-white px-1.5 py-0.5 rounded text-[10px]">HIGH PRIORITY</span>
                                      Data Errors (Wrong Info):
                                    </div>
                                    <ul className="space-y-1 ml-2">
                                      {dataErrors.map((error, idx) => (
                                        <li key={`data-${idx}`} className="flex items-center justify-between gap-2 p-1.5 bg-red-100 rounded border-l-4 border-red-500">
                                          <span className="flex-1">
                                            🚨 <strong>{getErrorLabel(error.type)}</strong>
                                            <span className="text-xs block text-red-600 mt-0.5">{error.message}</span>
                                          </span>
                                          <button
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              handleDismissWithNote(selectedEventForPanel.id, error.message, error);
                                            }}
                                            className="flex-shrink-0 px-2 py-1 text-xs bg-green-100 hover:bg-green-200 text-green-700 rounded-md transition-colors font-medium"
                                            title="Dismiss with optional note"
                                          >
                                            ✓ OK
                                          </button>
                                        </li>
                                      ))}
                                    </ul>
                                  </li>
                                )}
                                
                                {/* FORMATTING ERRORS - Lower Priority (Yellow/Orange) */}
                                {formattingErrors.length > 0 && (
                                  <li className="pt-1">
                                    <div className="text-xs font-semibold text-orange-700 uppercase mb-1 flex items-center gap-1">
                                      <span className="bg-orange-500 text-white px-1.5 py-0.5 rounded text-[10px]">FORMATTING</span>
                                      Missing/Incomplete Info:
                                    </div>
                                    <ul className="space-y-1 ml-2">
                                      {formattingErrors.map((error, idx) => (
                                        <li key={`fmt-${idx}`} className="flex items-center justify-between gap-2 p-1.5 bg-orange-50 rounded border-l-4 border-orange-400 text-orange-800">
                                          <span className="flex-1">
                                            {error.severity === 'info' ? 'ℹ️' : '⚠️'} <strong>{getErrorLabel(error.type)}</strong>
                                            <span className="text-xs block text-orange-600 mt-0.5">{error.message}</span>
                                          </span>
                                          <button
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              handleDismissWithNote(selectedEventForPanel.id, error.message);
                                            }}
                                            className="flex-shrink-0 px-2 py-1 text-xs bg-green-100 hover:bg-green-200 text-green-700 rounded-md transition-colors font-medium"
                                            title="Dismiss with optional note"
                                          >
                                            ✓ OK
                                          </button>
                                        </li>
                                      ))}
                                    </ul>
                                  </li>
                                )}
                                
                                {/* STATUS INFO - Informational (Blue) */}
                                {statusErrors.length > 0 && (
                                  <li className="pt-1">
                                    <div className="text-xs font-semibold text-blue-600 uppercase mb-1 flex items-center gap-1">
                                      <span className="bg-blue-500 text-white px-1.5 py-0.5 rounded text-[10px]">INFO</span>
                                      Registration Status:
                                    </div>
                                    <ul className="space-y-1 ml-2">
                                      {statusErrors.map((error, idx) => (
                                        <li key={`status-${idx}`} className="flex items-center justify-between gap-2 p-1.5 bg-blue-50 rounded border-l-4 border-blue-400 text-blue-800">
                                          <span className="flex-1">
                                            ℹ️ <strong>{getErrorLabel(error.type)}</strong>
                                            <span className="text-xs block text-blue-600 mt-0.5">{error.message}</span>
                                          </span>
                                          <button
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              handleDismissWithNote(selectedEventForPanel.id, error.message);
                                            }}
                                            className="flex-shrink-0 px-2 py-1 text-xs bg-green-100 hover:bg-green-200 text-green-700 rounded-md transition-colors font-medium"
                                            title="Dismiss with optional note"
                                          >
                                            ✓ OK
                                          </button>
                                        </li>
                                      ))}
                                    </ul>
                                  </li>
                                )}
                                
                                {/* UNCATEGORIZED - Legacy errors without category */}
                                {uncategorizedErrors.length > 0 && (
                                  <li className="pt-1">
                                    <div className="text-xs font-semibold text-gray-600 uppercase mb-1">Other Issues:</div>
                                    <ul className="space-y-1 ml-2">
                                      {uncategorizedErrors.map((error, idx) => (
                                        <li key={`other-${idx}`} className="flex items-center justify-between gap-2 p-1.5 bg-gray-100 rounded text-gray-800">
                                          <span className="flex-1">
                                            {error.severity === 'error' ? '🚨' : '⚠️'} <strong>{getErrorLabel(error.type)}</strong>
                                            <span className="text-xs block text-gray-600 mt-0.5">{error.message}</span>
                                          </span>
                                          <button
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              handleDismissWithNote(selectedEventForPanel.id, error.message);
                                            }}
                                            className="flex-shrink-0 px-2 py-1 text-xs bg-green-100 hover:bg-green-200 text-green-700 rounded-md transition-colors font-medium"
                                            title="Dismiss with optional note"
                                          >
                                            ✓ OK
                                          </button>
                                        </li>
                                      ))}
                                    </ul>
                                  </li>
                                )}
                              </ul>
                              
                              {/* Link to fix in iClassPro */}
                              {selectedEventForPanel.event_url && (
                                <a 
                                  href={selectedEventForPanel.event_url} 
                                  target="_blank" 
                                  rel="noopener noreferrer"
                                  className="mt-3 w-full flex items-center justify-center gap-2 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold transition-colors"
                                >
                                  🔗 View Event in iClassPro
                                </a>
                              )}
                            </div>
                          )}
                          
                          {/* Dismissed Errors with Notes */}
                          {acknowledgedErrors.length > 0 && (
                            <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                              <div className="font-semibold text-green-800 mb-2 flex items-center justify-between">
                                <span className="flex items-center gap-2">
                                  ✓ Dismissed Warnings ({acknowledgedErrors.length})
                                </span>
                                <button
                                  onClick={() => resetAcknowledgedErrors(selectedEventForPanel.id)}
                                  className="text-xs text-red-600 hover:text-red-800 underline"
                                  title="Restore all dismissed warnings"
                                >
                                  Undo all
                                </button>
                              </div>
                              
                              <ul className="text-sm text-green-700 space-y-1">
                                {acknowledgedErrors.map((ack, idx) => {
                                  const message = typeof ack === 'string' ? ack : ack.message;
                                  const note = typeof ack === 'object' ? ack.note : null;
                                  const dismissedAt = typeof ack === 'object' && ack.dismissed_at 
                                    ? new Date(ack.dismissed_at).toLocaleDateString() 
                                    : null;
                                  
                                  return (
                                    <li key={`ack-${idx}`} className="p-1.5 bg-green-100 rounded text-xs">
                                      <div className="flex items-center gap-1">
                                        <span className="text-green-600">✓</span>
                                        <span className="line-through text-green-600">{message}</span>
                                      </div>
                                      {note && (
                                        <div className="mt-1 ml-4 text-green-700 italic bg-green-50 p-1 rounded">
                                          📝 Note: {note}
                                        </div>
                                      )}
                                      {dismissedAt && (
                                        <div className="ml-4 text-green-500 text-[10px]">
                                          Dismissed on {dismissedAt}
                                        </div>
                                      )}
                                    </li>
                                  );
                                })}
                              </ul>
                            </div>
                          )}
                        </div>
                      );
                    })()}

                    {/* Description */}
                    {selectedEventForPanel.description && (
                      <div className="border-t pt-4 mb-4" style={{ borderColor: theme.colors.secondary }}>
                        <div className="font-semibold text-xs text-gray-500 uppercase mb-2">Description</div>
                        <div className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
                          {selectedEventForPanel.description}
                        </div>
                      </div>
                    )}

                    {/* Flyer Image */}
                    {selectedEventForPanel.flyer_url && (
                      <div className="border-t pt-4 mb-4" style={{ borderColor: theme.colors.secondary }}>
                        <div className="font-semibold text-xs text-gray-500 uppercase mb-2">🖼️ Event Flyer</div>
                        <div className="rounded-lg overflow-hidden border border-gray-200 shadow-sm">
                          <img 
                            src={selectedEventForPanel.flyer_url} 
                            alt={`Flyer for ${selectedEventForPanel.title}`}
                            className="w-full h-auto"
                            onError={(e) => {
                              e.target.style.display = 'none';
                              e.target.parentElement.innerHTML = '<div class="p-4 text-center text-gray-500 text-sm">Unable to load flyer image</div>';
                            }}
                          />
                        </div>
                        <a 
                          href={selectedEventForPanel.flyer_url} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-xs text-blue-600 hover:text-blue-800 mt-2 inline-block"
                        >
                          Open flyer in new tab →
                        </a>
                      </div>
                    )}
                    
                    {/* Registration Options - Detect from ACTUAL grouped event titles */}
                    <div className="border-t pt-4" style={{ borderColor: theme.colors.secondary }}>
                      {selectedEventForPanel.isGrouped && selectedEventForPanel.groupedEvents ? (
                         // Multiple options - detect activity/duration from actual titles
                        <div className="space-y-3">
                          <p className="font-semibold text-gray-800 mb-3">🔗 View This Event:</p>
                          {selectedEventForPanel.groupedEvents.map((option) => {
                             // Parse ACTUAL title to detect activity and duration
                             const title = option.title;
                             let icon = '📋';
                             let label = '';
                             
                             // Detect activity from title content
                             if (title.includes('Gymnastics') || title.includes('Girls Gymnastics')) {
                               icon = '🤸';
                               label = title.includes('Girls') ? 'Girls Gymnastics' : 'Gymnastics';
                             } else if (title.includes('Ninja')) {
                               icon = '🥷';
                               if (title.includes('Co-ed')) label = 'Co-ed Ninja';
                               else if (title.includes('Warrior')) label = 'Ninja Warrior';
                               else if (title.includes('Parkour')) label = 'Parkour & Ninja';
                               else if (title.includes('COED')) label = 'COED Ninja';
                               else label = 'Ninja';
                             }
                             
                             // Add duration if detected
                             if (title.includes('Full Day') || title.includes('FULL DAY')) {
                               label = label ? `${label} - Full Day` : 'Full Day';
                             } else if (title.includes('Half Day') || title.includes('HALF DAY')) {
                               label = label ? `${label} - Half Day` : 'Half Day';
                             }
                             
                             // If still no label, use first part of title
                             if (!label) {
                               const parts = title.split('|');
                               label = parts[0].trim();
                             }
                             
                             return (
                               <div key={option.id} className="flex gap-2 items-center">
                                 <button
                                   onClick={() => window.open(option.event_url, '_blank')}
                                   className="flex-1 text-left text-white text-sm font-medium py-2.5 px-3 rounded-lg transition-all hover:scale-102 hover:shadow-md flex items-center gap-2"
                                   style={{ backgroundColor: theme.colors.primary }}
                                 >
                                   <span className="text-xl flex-shrink-0">{icon}</span>
                                   <span className="flex-1">
                                     <span className="block font-semibold">{label}</span>
                                     <span className="block text-xs opacity-90 mt-0.5">
                                       {formatTimeShort(option.time)} {option.price && `• $${option.price}`}
                                     </span>
                                   </span>
                                   <span className="text-sm flex-shrink-0">→</span>
                                 </button>
                                 <button
                                   onClick={() => copyToClipboard(option.event_url, option.id)}
                                   className={`flex items-center justify-center w-10 h-10 rounded-lg transition-all ${
                                     copiedUrl === option.id 
                                       ? 'bg-green-100 text-green-700' 
                                       : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                                   }`}
                                   title="Copy registration link"
                                 >
                                   {copiedUrl === option.id ? <CheckCircle className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                                 </button>
                               </div>
                             );
                           })}
                         </div>
                      ) : (
                        // Single option - show regular buttons
                        <div className="space-y-3">
                          <button
                            onClick={() => {
                              const url = selectedEventForPanel.event_url || selectedEventForPanel.registration_url;
                              if (url) {
                                window.open(url, '_blank');
                              }
                            }}
                            className="w-full text-white font-semibold py-3 px-4 rounded-lg transition-all hover:scale-105 hover:shadow-lg flex items-center justify-center gap-2"
                            style={{ backgroundColor: theme.colors.primary }}
                          >
                            🔗 View Event Page
                          </button>
                          <button
                            onClick={() => {
                              const url = selectedEventForPanel.event_url || selectedEventForPanel.registration_url;
                              if (url) {
                                copyToClipboard(url, selectedEventForPanel.id);
                              }
                            }}
                            className={`w-full font-semibold py-3 px-4 rounded-lg transition-all flex items-center justify-center gap-2 ${
                              copiedUrl === selectedEventForPanel.id 
                                ? 'bg-green-100 text-green-700' 
                                : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                            }`}
                          >
                            {copiedUrl === selectedEventForPanel.id ? (
                              <>
                                <CheckCircle className="w-5 h-5" />
                                URL Copied!
                              </>
                            ) : (
                              <>
                                <Copy className="w-5 h-5" />
                                Copy Registration URL
                              </>
                            )}
                          </button>
                          
                          {/* Edit Button */}
                          <button
                            onClick={() => {
                              handleEditEvent(selectedEventForPanel);
                              setSelectedEventForPanel(null);
                            }}
                            className="w-full bg-blue-50 hover:bg-blue-100 text-blue-700 font-semibold py-3 px-4 rounded-lg transition-all flex items-center justify-center gap-2"
                          >
                            ✎ Edit Event
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Removed floating left calendar nav (redundant after relocating the panel above the grid) */}

      {/* Back to Top Button */}
      {showBackToTop && (
        <button
          onClick={scrollToTop}
          className="fixed bottom-6 right-6 w-12 h-12 rounded-full shadow-lg hover:scale-105 transition-transform duration-200 z-40"
          style={{ backgroundColor: theme.colors.primary }}
        >
          <ChevronUp className="w-6 h-6 text-white mx-auto" />
        </button>
      )}
      
      {/* ✨ Toast Notification */}
      {showToast && (
        <div 
          className="fixed top-20 left-1/2 transform -translate-x-1/2 z-50 px-6 py-3 rounded-lg shadow-xl backdrop-blur-sm animate-slide-down"
          style={{ 
            backgroundColor: 'rgba(255, 255, 255, 0.95)',
            border: `2px solid ${theme.colors.primary}`,
            animation: 'slideDown 0.3s ease-out'
          }}
        >
          <div className="flex items-center gap-2 text-sm font-medium" style={{ color: theme.colors.textPrimary }}>
            {toastMessage}
          </div>
        </div>
      )}
      
      <style>{`
        @keyframes slideDown {
          from {
            opacity: 0;
            transform: translate(-50%, -20px);
          }
          to {
            opacity: 1;
            transform: translate(-50%, 0);
          }
        }
      `}</style>
    </div>
  );
};

export default EventsDashboard; 