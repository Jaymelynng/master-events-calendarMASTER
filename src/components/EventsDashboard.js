import React, { useState, useMemo, useRef, useEffect, Suspense, lazy } from 'react';
import { 
  Calendar, Clock, DollarSign, MapPin, Filter, Search, Grid, List, Plus, 
  ChevronUp, ChevronLeft, ChevronRight, AlertCircle, Loader, Copy, CheckCircle
} from 'lucide-react';

// Import real API functions
import { gymsApi, eventsApi, eventTypesApi, monthlyRequirementsApi } from '../lib/api';
import { gymLinksApi } from '../lib/gymLinksApi';
import { cachedApi, cache } from '../lib/cache';
import { supabase } from '../lib/supabase';
import AdminPortalModal from './EventsDashboard/AdminPortalModal';

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

  return { gyms, loading, error };
};

const useGymLinks = () => {
  const [gymLinks, setGymLinks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchGymLinks = async () => {
      try {
        const data = await cachedApi.getGymLinks();
        setGymLinks(data || []);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchGymLinks();
  }, []);

  return { gymLinks, loading, error };
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
  
  // ✨ Sparkle Hover Toggle State
  const [hoverEnabled, setHoverEnabled] = useState(true);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  
  // ✨ Per-Event Expansion State
  const [expandedEvents, setExpandedEvents] = useState(new Set());
  
  // Refs
  const topRef = useRef(null);
  const calendarRef = useRef(null);
  const gymRefs = useRef({});
  const monthNavRef = useRef(null);

  // Fetch data
  const { gyms: gymsList, loading: gymsLoading, error: gymsError } = useGyms();
  const { gymLinks, loading: gymLinksLoading, error: gymLinksError } = useGymLinks();
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
      // Optional extras for one-offs
      'camps_holiday': 'camps_holiday',
      'special_events': 'special_events'
    };
    
    const linkTypeId = linkTypeMap[eventType];
    
    // Find gym by name, then find link by gym_id + link_type
    const gym = gymsList.find(g => g.name === gymName);
    if (!gym) return null;
    
    const link = gymLinks.find(gl => 
      (gl.gym_id === gym.gym_code || gl.gym_id === gym.id) && 
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

  // ✨ Toggle hover mode function
  const toggleHoverMode = () => {
    const newState = !hoverEnabled;
    setHoverEnabled(newState);
    setToastMessage(newState ? '✨ Hover mode ON' : 'Hover mode OFF');
    setShowToast(true);
    setTimeout(() => setShowToast(false), 2000);
    // When turning off hover, also collapse all expanded events
    if (!newState) {
      setExpandedEvents(new Set());
    }
  };
  
  // ✨ Toggle individual event expansion - Shows full detail popup
  // Removed toggleEventExpansion - now using side panel on click
  
  // Helper to format time in short format (6:30-9:30)
  const formatTimeShort = (timeString) => {
    if (!timeString) return '';
    // Remove AM/PM and spaces for compact display
    return timeString.replace(/ AM| PM/g, '').replace(' - ', '-');
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
    try {
      const container = document.createElement('div');
      container.style.position = 'fixed';
      container.style.left = '-9999px';
      container.style.top = '-9999px';
      document.body.appendChild(container);

      uniqueUrls.forEach((url) => {
        const a = document.createElement('a');
        a.href = url;
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
        container.appendChild(a);
        a.click(); // Synchronous click within the user gesture
      });

      // Cleanup DOM container
      setTimeout(() => {
        try { container.remove(); } catch (_) {}
      }, 0);
    } catch (err) {
      // Fallback: direct window.open loop with secure features
      uniqueUrls.forEach((url) => {
        try {
          window.open(url, '_blank', 'noopener,noreferrer');
        } catch (_) {}
      });
    }

    // Completion toast
    setTimeout(() => {
      setCopySuccess(doneMessage);
      setTimeout(() => setCopySuccess(''), 4000);
    }, 150);
  };

  // Open all special event pages for a given gym (Clinic, KNO, Open Gym, Camps)
  const handleOpenAllForGym = (gymName) => {
    try {
      const urlsToOpen = [
        // Standard special-event categories (use link_type_id from gym_links table)
        getGymLinkUrl(gymName, 'skill_clinics'),
        getGymLinkUrl(gymName, 'kids_night_out'),
        getGymLinkUrl(gymName, 'open_gym'),
        // Camps (optional, only if present for the gym)
        getGymLinkUrl(gymName, 'camps'),
        getGymLinkUrl(gymName, 'camps_half'),
        // Special events (RBA only)
        getGymLinkUrl(gymName, 'special_events')
      ].filter(Boolean);

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
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear(currentYear - 1);
    } else {
      setCurrentMonth(currentMonth - 1);
    }
    setCalendarView('full');
  };

  const goToNextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear(currentYear + 1);
    } else {
      setCurrentMonth(currentMonth + 1);
    }
    setCalendarView('full');
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
      trackedTypes.forEach(type => {
        counts[gym][type] = currentMonthEvents.filter(
          event => (event.gym_name || event.gym_code) === gym && event.type === type
        ).length;
      });
      
      counts[gym].total = currentMonthEvents.filter(
        event => (event.gym_name || event.gym_code) === gym && trackedTypes.includes(event.type)
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
        // Extract portal slug from the first URL we find in gymLinks
        const gymLink = gymLinks.find(gl => gl.gym_name === gym.name);
        let portalSlug = '';
        if (gymLink && gymLink.url) {
          const urlMatch = gymLink.url.match(/portal\.iclasspro\.com\/([^\/]+)/);
          if (urlMatch) {
            portalSlug = urlMatch[1];
          }
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
      const freshEventsFromDB = await eventsApi.getAll(startDate, endDate);
      console.log(`📊 Found ${freshEventsFromDB.length} existing events in database`);
      
      // Check for existing events to detect duplicates
      let existingCount = 0;
      const existingUrlSet = new Set(
        (freshEventsFromDB || []).map(ev => {
          if (!ev.event_url) return null;
          // Remove query parameters for comparison
          return ev.event_url.split('?')[0];
        }).filter(url => url)
      );
      
      processedEvents.forEach(newEvent => {
        const newUrlBase = newEvent.event_url.split('?')[0];
        if (existingUrlSet.has(newUrlBase)) {
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
      const freshEventsFromDB = await eventsApi.getAll(startDate, endDate);
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
        
        // Find existing event by URL or composite key
        if (newEvent.event_url) {
          const urlKey = newEvent.event_url.split('?')[0];
          existingEvent = existingEventsMap.get(urlKey);
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
        let startDate = processedDate;
        let endDate = processedDate;
        
        // Extract date range from camp titles (e.g., "Oct 13-17", "Nov 24-26", "Dec 22-Jan 5")
        if (event.type === 'CAMP' && event.title) {
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
      
      {/* Magic Control Portal - Secret Feature (Shift+Click) */}
      {showAdminPortal && (
        <Suspense fallback={<div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50"><div className="bg-white rounded-lg p-6">Loading...</div></div>}>
          <AdminPortalModal
            theme={theme}
            onClose={() => setShowAdminPortal(false)}
            onOpenAddEvent={() => {
                        setShowAdminPortal(false);
                        setTimeout(() => setShowAddEventModal(true), 100);
                      }}
            onOpenBulkImport={() => {
                        setShowAdminPortal(false);
                        setTimeout(() => setShowBulkImportModal(true), 100);
                      }}
            onOpenAuditHistory={() => {
              setShowAdminPortal(false);
              setTimeout(() => {
                loadAuditHistory();
                setShowAuditHistory(true);
              }, 100);
            }}
          />
        </Suspense>
      )}

      {/* Audit History Modal - Secret Feature */}
      {showAuditHistory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-4xl mx-4 max-h-[90vh] overflow-hidden flex flex-col">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-bold text-gray-800">
                🔍 Event Change History
              </h2>
              <button
                onClick={() => setShowAuditHistory(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
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

          {/* ✨ Secret Sparkle Button - TOP SECTION (Shift+Click) */}
          <div className="flex justify-center mb-2">
            <button
              onClick={(e) => {
                if (e.shiftKey) {
                  setShowAdminPortal(true);
                }
              }}
              className="flex items-center justify-center w-8 h-8 bg-white rounded border border-pink-300 hover:border-pink-500 hover:bg-pink-50 transition-all duration-200 group opacity-70 hover:opacity-100"
              title="Shift+Click for Magic Control Portal"
            >
              <span className="text-lg group-hover:scale-125 transition-transform">✨</span>
            </button>
          </div>

          {/* 🚀 BULK ACTION BUTTONS - Open All Gyms for Each Event Type */}
          <div className="bg-white rounded shadow p-2 mb-3 mx-2" style={{ borderColor: '#cec4c1', borderWidth: '1px' }}>
            <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded p-2 mb-2 border border-blue-200">
              <h3 className="text-sm font-medium text-gray-900 mb-2 flex items-center gap-2">
                🚀 Bulk Actions - Open All Gyms
                <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">One-Click Access</span>
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                <button
                  onClick={() => {
                    const clinicUrls = getAllUrlsForEventType('CLINIC');
                    openMultipleTabs(
                      clinicUrls,
                      `🚀 Opening ${clinicUrls.length} clinic pages... (allow pop-ups!)`,
                      `✨ Successfully opened all ${clinicUrls.length} clinic pages!`
                    );
                  }}
                  className="flex flex-col items-center justify-center gap-0.5 px-2 py-1.5 bg-white rounded border border-purple-200 hover:border-purple-400 hover:bg-purple-50 transition-all duration-200 group text-center"
                >
                  <span className="text-base group-hover:scale-110 transition-transform">⭐</span>
                  <div>
                    <div className="text-xs font-semibold text-purple-800">All Clinics</div>
                    <div className="text-xs text-purple-600">Open all skill clinic pages</div>
                  </div>
                </button>

                <button
                  onClick={() => {
                    const knoUrls = getAllUrlsForEventType('KIDS NIGHT OUT');
                    openMultipleTabs(
                      knoUrls,
                      `🌙 Opening ${knoUrls.length} Kids Night Out pages... (allow pop-ups!)`,
                      `✨ Successfully opened all ${knoUrls.length} Kids Night Out pages!`
                    );
                  }}
                  className="flex flex-col items-center justify-center gap-0.5 px-2 py-1.5 bg-white rounded border border-pink-200 hover:border-pink-400 hover:bg-pink-50 transition-all duration-200 group text-center"
                >
                  <span className="text-base group-hover:scale-110 transition-transform">🌙</span>
                  <div>
                    <div className="text-xs font-semibold text-pink-800">All Kids Night Out</div>
                    <div className="text-xs text-pink-600">Open all KNO pages</div>
                  </div>
                </button>

                <button
                  onClick={() => {
                    const openGymUrls = getAllUrlsForEventType('OPEN GYM');
                    openMultipleTabs(
                      openGymUrls,
                      `🎯 Opening ${openGymUrls.length} open gym pages... (allow pop-ups!)`,
                      `✨ Successfully opened all ${openGymUrls.length} open gym pages!`
                    );
                  }}
                  className="flex flex-col items-center justify-center gap-0.5 px-2 py-1.5 bg-white rounded border border-green-200 hover:border-green-400 hover:bg-green-50 transition-all duration-200 group text-center"
                >
                  <span className="text-base group-hover:scale-110 transition-transform">🎯</span>
                  <div>
                    <div className="text-xs font-semibold text-green-800">All Open Gym</div>
                    <div className="text-xs text-green-600">Open all open gym pages</div>
                  </div>
                </button>

                <button
                  onClick={() => {
                    const bookingUrls = getAllUrlsForEventType('BOOKING');
                    openMultipleTabs(
                      bookingUrls,
                      `🌐 Opening ${bookingUrls.length} gym booking pages... (allow pop-ups!)`,
                      `✨ Successfully opened all ${bookingUrls.length} gym booking pages!`
                    );
                  }}
                  className="flex flex-col items-center justify-center gap-0.5 px-2 py-1.5 bg-white rounded border border-orange-200 hover:border-orange-400 hover:bg-orange-50 transition-all duration-200 group text-center"
                >
                  <span className="text-base group-hover:scale-110 transition-transform">🌐</span>
                  <div>
                    <div className="text-xs font-semibold text-orange-800">All Booking</div>
                    <div className="text-xs text-orange-600">Open all gym booking pages</div>
                  </div>
                </button>

                <div className="flex flex-col gap-1.5">
                  <button
                    onClick={() => {
                      const campUrls = getAllUrlsForEventType('camps');
                      openMultipleTabs(
                        campUrls,
                        `🏕️ Opening ${campUrls.length} full day camp pages... (allow pop-ups!)`,
                        `✨ Successfully opened all ${campUrls.length} full day camp pages!`
                      );
                    }}
                    className="flex flex-col items-center justify-center gap-0.5 px-2 py-1.5 bg-white rounded border border-teal-200 hover:border-teal-400 hover:bg-teal-50 transition-all duration-200 group text-center"
                  >
                    <span className="text-base group-hover:scale-110 transition-transform">🏕️</span>
                    <div>
                      <div className="text-xs font-semibold text-teal-800">School Year Camps (Full Day)</div>
                      <div className="text-xs text-teal-600">Full day camps</div>
                    </div>
                  </button>

                  <button
                    onClick={() => {
                      const halfDayCampUrls = getAllUrlsForEventType('camps_half');
                      openMultipleTabs(
                        halfDayCampUrls,
                        `🕐 Opening ${halfDayCampUrls.length} half day camp pages... (allow pop-ups!)`,
                        `✨ Successfully opened all ${halfDayCampUrls.length} half day camp pages!`
                      );
                    }}
                    className="flex flex-col items-center justify-center gap-0.5 px-2 py-1.5 bg-white rounded border border-amber-200 hover:border-amber-400 hover:bg-amber-50 transition-all duration-200 group text-center"
                  >
                    <span className="text-base group-hover:scale-110 transition-transform">🕐</span>
                    <div>
                      <div className="text-xs font-semibold text-amber-800">Half Day Camps</div>
                      <div className="text-xs text-amber-600">Half day options</div>
                    </div>
                  </button>

                </div>
              </div>
              
              <div className="mt-3 text-xs text-gray-600 flex items-center gap-1">
                <span>💡</span>
                <span>Pro tip: Each button opens multiple tabs - make sure your browser allows pop-ups!</span>
              </div>
            </div>
          </div>

          {/* Special Event Statistics by Gym */}
          <div className="bg-white rounded shadow p-2 mb-2 mx-2" style={{ borderColor: '#cec4c1', borderWidth: '1px' }}>
            {/* Table Header */}
            <div className="mb-2">
              <h2 className="text-lg font-bold mb-1" style={{ color: theme.colors.textPrimary }}>
                Special Event Statistics by Gym
                <span className="text-sm font-normal ml-2" style={{ color: theme.colors.textSecondary }}>
                  (Click counts to view event pages)
                </span>
              </h2>
              <div className="flex items-center justify-between">
                <div className="text-xs bg-gray-50 px-2 py-1 rounded border">
                  <span className="font-semibold text-gray-700">Monthly: </span>
                  <span className="text-gray-600">
                    {monthlyRequirements['CLINIC']} Clinic • {monthlyRequirements['KIDS NIGHT OUT']} KNO • {monthlyRequirements['OPEN GYM']} Open Gym
                  </span>
                </div>
                <div className="text-sm font-medium" style={{ color: theme.colors.textSecondary }}>
                  {new Date(currentYear, currentMonth).toLocaleDateString('en-US', { 
                    month: 'long', 
                    year: 'numeric' 
                  })}
                </div>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full border border-gray-200">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="p-1 border text-sm text-center" style={{ color: theme.colors.textPrimary }}>
                      Gym
                    </th>
                    {eventTypes.filter(et => et.is_tracked).map((eventType, i) => (
                      <th key={i} className="p-1 border text-sm text-center" style={{ color: theme.colors.textPrimary }}>
                        {eventType.display_name || eventType.name}
                      </th>
                    ))}
                    <th className="p-1 border text-sm text-center" style={{ color: theme.colors.textPrimary }}>Total Tracked</th>
                    <th className="p-1 border text-sm text-center" style={{ color: theme.colors.textPrimary }}>Missing</th>
                    <th className="p-1 border text-sm text-center" style={{ color: theme.colors.textPrimary }}>CAMPS</th>
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
                            const totalCount = counts[gym]?.total || 0;
                            const classesUrl = getGymLinkUrl(gym, 'Classes') || getGymLinkUrl(gym, 'Programs') || getGymLinkUrl(gym, 'Booking (Special Events)');
                            
                            // Calculate if gym meets total monthly requirements
                            const totalRequired = Object.values(monthlyRequirements).reduce((sum, req) => sum + req, 0);
                            const isDeficient = totalCount < totalRequired;
                            
                            // Use booking page from Supabase data
                            const finalUrl = classesUrl || getGymLinkUrl(gym, 'BOOKING') || '#';
                            
                            return (
                              <a 
                                href={finalUrl} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className={`font-bold inline-flex items-center justify-center gap-1 px-3 py-2 rounded transition-all duration-200 hover:scale-105 hover:shadow-md min-w-[48px] h-[40px] ${
                                  isDeficient ? 'text-red-700' : 'text-gray-700'
                                }`}
                                style={{ backgroundColor: isDeficient ? 'transparent' : 'transparent' }}
                                title={`View all programs at ${gym} (${totalCount}/${totalRequired})`}
                              >
                                <span className="text-lg font-bold">{totalCount}</span>
                                <svg className="w-3 h-3 opacity-60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                </svg>
                              </a>
                            );
                          })()}
                        </td>
                        <td className="p-1 border text-xs text-center">
                          {getMissingEventTypes(gym).length > 0 ? (
                            <span style={{ color: theme.colors.error }}>
                              {getMissingEventTypes(gym).join(', ')}
                            </span>
                          ) : (
                            <span style={{ color: theme.colors.success }}>
                              ✅ All events in
                            </span>
                          )}
                        </td>
                        <td className="p-1 border text-center text-xs">
                          {(() => {
                            // Link presence
                            const hasFullDay = gymLinks.some(gl => 
                              (gl.gym_id === gym.gym_code || gl.gym_id === gym.id) && gl.link_type_id === 'camps'
                            );
                            const hasHalfDay = gymLinks.some(gl => 
                              (gl.gym_id === gym.gym_code || gl.gym_id === gym.id) && gl.link_type_id === 'camps_half'
                            );
                            const hasHoliday = gymLinks.some(gl => 
                              (gl.gym_id === gym.gym_code || gl.gym_id === gym.id) && gl.link_type_id === 'camps_holiday'
                            );
                            const hasSpecial = gymLinks.some(gl => 
                              (gl.gym_id === gym.gym_code || gl.gym_id === gym.id) && gl.link_type_id === 'special_events'
                            );

                            const fullDayUrl = gymLinks.find(gl => 
                              (gl.gym_id === gym.gym_code || gl.gym_id === gym.id) && gl.link_type_id === 'camps'
                            )?.url;
                            const halfDayUrl = gymLinks.find(gl => 
                              (gl.gym_id === gym.gym_code || gl.gym_id === gym.id) && gl.link_type_id === 'camps_half'
                            )?.url;
                            const holidayUrl = gymLinks.find(gl => 
                              (gl.gym_id === gym.gym_code || gl.gym_id === gym.id) && gl.link_type_id === 'camps_holiday'
                            )?.url;
                            const specialUrl = gymLinks.find(gl => 
                              (gl.gym_id === gym.gym_code || gl.gym_id === gym.id) && gl.link_type_id === 'special_events'
                            )?.url;

                            // Count actual camp events for current month (does not affect tracked totals)
                            // Need to match gym name against event's gym_id by finding the gym object
                            const gymObj = gymsList.find(g => g.name === gym);
                            const campEvents = events.filter(event => 
                              (event.gym_name === gym || event.gym_id === gymObj?.id) &&
                              (
                                (event.type && event.type.toLowerCase().includes('camp')) ||
                                (event.title && event.title.toLowerCase().includes('camp'))
                              )
                            );

                            let fullCount = 0, halfCount = 0, holidayCount = 0, specialCount = 0;
                            const holidayRegex = /(thanksgiving|holiday|winter break|spring break|fall break|mlk|presidents|labor day|memorial|veterans|new year|christmas)/i;
                            const halfRegex = /half[-\s]?day|1\/2\s*day/i;
                            const specialRegex = /special\s*event/i;

                            campEvents.forEach(ev => {
                              const t = (ev.title || '').toLowerCase();
                              if (halfRegex.test(t)) {
                                halfCount += 1;
                              } else if (holidayRegex.test(t)) {
                                holidayCount += 1;
                              } else if (specialRegex.test(t)) {
                                specialCount += 1;
                              } else {
                                fullCount += 1;
                              }
                            });

                            const chips = [];
                            if (fullCount > 0 || hasFullDay) {
                              chips.push(
                                <a key="full" href={fullDayUrl || '#'} target="_blank" rel="noopener noreferrer"
                                   className="px-2 py-1 rounded text-sm font-semibold hover:bg-blue-100 transition-colors cursor-pointer"
                                   style={{ backgroundColor: '#f0f9ff', color: '#0369a1' }} title="Full Day Camps">
                                  🏕️ {fullCount}
                                </a>
                              );
                            }
                            if (halfCount > 0 || hasHalfDay) {
                              chips.push(
                                <a key="half" href={halfDayUrl || '#'} target="_blank" rel="noopener noreferrer"
                                   className="px-2 py-1 rounded text-sm font-semibold hover:bg-amber-100 transition-colors cursor-pointer"
                                   style={{ backgroundColor: '#fef3c7', color: '#d97706' }} title="Half Day Camps">
                                  🕐 {halfCount}
                                </a>
                              );
                            }
                            if (holidayCount > 0 || hasHoliday) {
                              chips.push(
                                <a key="holiday" href={holidayUrl || '#'} target="_blank" rel="noopener noreferrer"
                                   className="px-2 py-1 rounded text-sm font-semibold hover:bg-green-100 transition-colors cursor-pointer"
                                   style={{ backgroundColor: '#ecfccb', color: '#166534' }} title="Holiday/Break Camps">
                                  🍂 {holidayCount}
                                </a>
                              );
                            }
                            if (specialCount > 0 || hasSpecial) {
                              chips.push(
                                <a key="special" href={specialUrl || '#'} target="_blank" rel="noopener noreferrer"
                                   className="px-2 py-1 rounded text-sm font-semibold hover:bg-purple-100 transition-colors cursor-pointer"
                                   style={{ backgroundColor: '#f5f3ff', color: '#6d28d9' }} title="Special Events">
                                  ✨ {specialCount}
                                </a>
                              );
                            }

                            if (chips.length === 0) {
                              return (
                                <span className="px-2 py-1 rounded text-sm" style={{ backgroundColor: '#f3f4f6', color: '#6b7280' }}>-</span>
                              );
                            }

                            return <div className="flex items-center justify-center gap-1">{chips}</div>;
                          })()}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p className="text-xs mt-2 flex items-center gap-1" style={{ color: theme.colors.textSecondary }}>
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
              Click gym names or event counts to view their special event pages • ☀️ Summer camps are shown for reference but not required
            </p>
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
              {/* 🪄 Magic Control - BEFORE CALENDAR VIEW (Shift+Click) */}
              <div className="flex justify-center mb-2">
                <button
                  onClick={(e) => {
                    if (e.shiftKey) {
                      setShowAdminPortal(true);
                    }
                  }}
                  className="flex items-center justify-center w-8 h-8 bg-white rounded border border-purple-300 hover:border-purple-500 hover:bg-purple-50 transition-all duration-200 group opacity-70 hover:opacity-100"
                  title="Shift+Click for Magic Control Portal"
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
                  <p>• Click sparkles (✨) on event cards to view full details</p>
                  <p>• Click gym buttons above to quickly jump to that gym's calendar section</p>
              </div>

              {/* ✨ Hover Toggle - Positioned above calendar */}
              <div className="flex justify-center items-center gap-2 mt-4 mb-2">
                <span className="text-sm" style={{ color: theme.colors.textSecondary }}>Quick Preview:</span>
                <button
                  onClick={toggleHoverMode}
                  className="flex items-center gap-2 px-4 py-2 rounded-full transition-all duration-300 hover:scale-105 hover:shadow-lg"
                  style={{ 
                    backgroundColor: hoverEnabled ? theme.colors.primary : theme.colors.accent,
                    opacity: hoverEnabled ? 1 : 0.6
                  }}
                  title={hoverEnabled ? "Hover previews ON (click to disable)" : "Hover previews OFF (click to enable)"}
                >
                  <span className="text-base" style={{ 
                    filter: hoverEnabled ? 'none' : 'grayscale(100%)',
                    transition: 'all 0.3s ease'
                  }}>
                    ✨
                  </span>
                  <span className="text-sm font-medium text-white">
                    {hoverEnabled ? 'Hover ON' : 'Hover OFF'}
                  </span>
                </button>
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
                      const gymEvents = filteredEvents.filter(e => (e.gym_name || e.gym_code) === gym);
                      
                      
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
                              if (event.start_date && event.end_date) {
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
                                      // 🏕️ GROUP CAMP EVENTS BY BASE NAME (Display-only consolidation)
                                      const groupCampEventsForDisplay = (events) => {
                                        const campGroups = new Map();
                                        const regularEvents = [];
                                        
                                        events.forEach(event => {
                                          if (event.type === 'CAMP') {
                                            // Extract base camp name by removing option identifiers
                                            let baseName = event.title;
                                            
                                            // Handle titles that START with activity type (e.g., "Girls Gymnastics Fall Break Camp...")
                                            baseName = baseName
                                              .replace(/^Girls?\s+Gymnastics\s+/i, '')
                                              .replace(/^Co-ed\s+Ninja\s+Warrior\s+/i, '')
                                              .replace(/^Parkour\s*&\s*Ninja\s+/i, '')
                                              .replace(/^Ninja\s+Warrior\s+/i, '')
                                              .replace(/^COED\s+Ninja\s+/i, '');
                                            
                                            // Handle titles with activity AFTER pipe (e.g., "Winter Camp | Gymnastics | ...")
                                            baseName = baseName
                                              .replace(/\s*\|\s*(Girls?\s*)?(Co-ed\s*|COED\s*)?Gymnastics\s*Camp.*$/i, '')
                                              .replace(/\s*\|\s*(Parkour\s*&\s*)?Ninja\s*(Warrior\s*)?Camp.*$/i, '')
                                              .replace(/\s*\|\s*Gymnastics\s*\|.*$/i, '')
                                              .replace(/\s*\|\s*Ninja\s*\|.*$/i, '')
                                              .replace(/\s*\|\s*Full\s*Day.*$/i, '')
                                              .replace(/\s*\|\s*Half\s*Day.*$/i, '')
                                              .trim();
                                            
                                            // Group key: gym + base name + start date + end date
                                            const startDate = event.start_date || event.date;
                                            const endDate = event.end_date || event.date;
                                            const groupKey = `${event.gym_id}-${baseName}-${startDate}-${endDate}`;
                                            
                                            // Debug log
                                            if (event.title.includes('Fall Break')) {
                                              console.log('Base name extraction:', {
                                                original: event.title,
                                                baseName: baseName,
                                                groupKey: groupKey
                                              });
                                            }
                                            
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
                                          className="text-xs rounded text-gray-700 text-center font-medium transition-all duration-200 border p-2 hover:shadow-md hover:scale-105"
                                          style={{ 
                                            backgroundColor: getEventTypeColor(eventTypeName),
                                            borderColor: 'rgba(0,0,0,0.1)'
                                          }}
                                        >
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
                            <div className="text-sm text-gray-500 italic">Price not in title</div>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    {/* Quick Access - Check gym_links table for what THIS gym offers */}
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
                    
                    {/* Registration Options - Detect from ACTUAL grouped event titles */}
                    <div className="border-t pt-4" style={{ borderColor: theme.colors.secondary }}>
                      {selectedEventForPanel.isGrouped && selectedEventForPanel.groupedEvents ? (
                         // Multiple options - detect activity/duration from actual titles
                        <div className="space-y-3">
                          <p className="font-semibold text-gray-800 mb-3">📝 Register for THIS Camp:</p>
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
                            📝 Register Now
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