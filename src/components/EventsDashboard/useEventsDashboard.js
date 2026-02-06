// ============================================================================
// USE EVENTS DASHBOARD HOOK - All state and logic for the Events Dashboard
// ============================================================================
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { eventsApi, gymsApi, eventTypesApi, monthlyRequirementsApi, auditLogApi, gymValidValuesApi } from '../../lib/api';
import { useRealtimeEvents, useRealtimeGymLinks, useRealtimeGyms } from '../../lib/useRealtimeEvents';
import { cache } from '../../lib/cache';
import { defaultMonthlyRequirements } from './constants';
import { getDisplayDates } from './utils';

export default function useEventsDashboard() {
  // ==================== STATE ====================

  // Data state
  const [events, setEvents] = useState([]);
  const [gymsList, setGymsList] = useState([]);
  const [eventTypes, setEventTypes] = useState([]);
  const [monthlyRequirements, setMonthlyRequirements] = useState(defaultMonthlyRequirements);
  const [gymRules, setGymRules] = useState([]);

  // UI state
  const [loading, setLoading] = useState(true);
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth());
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
  const [selectedGym, setSelectedGym] = useState('all');
  const [selectedEventType, setSelectedEventType] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState('calendar');
  const [calendarView, setCalendarView] = useState('full');

  // Modal state
  const [showAddEventModal, setShowAddEventModal] = useState(false);
  const [showBulkImportModal, setShowBulkImportModal] = useState(false);
  const [showSyncModal, setShowSyncModal] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [showAdminPortal, setShowAdminPortal] = useState(false);
  const [showAuditHistory, setShowAuditHistory] = useState(false);
  const [dismissModalState, setDismissModalState] = useState(null);

  // Event editing state
  const [editingEvent, setEditingEvent] = useState(null);
  const [newEvent, setNewEvent] = useState({
    title: '',
    date: '',
    time: '',
    price: '',
    type: 'CLINIC',
    gym_id: '',
    event_url: ''
  });

  // Bulk import state
  const [rawEventListings, setRawEventListings] = useState('');
  const [selectedGymId, setSelectedGymId] = useState('');
  const [validationResults, setValidationResults] = useState(null);
  const [importTiming, setImportTiming] = useState({ convertMs: null, importMs: null, totalMs: null });
  const [bulkImportData, setBulkImportData] = useState('');

  // Panel state
  const [selectedEventForPanel, setSelectedEventForPanel] = useState(null);
  const [copiedUrl, setCopiedUrl] = useState(null);

  // Audit history state
  const [auditHistory, setAuditHistory] = useState([]);
  const [loadingAudit, setLoadingAudit] = useState(false);

  // UI feedback state
  const [copySuccess, setCopySuccess] = useState('');
  const [showBackToTop, setShowBackToTop] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');

  // Refs
  const topRef = useRef(null);
  const calendarRef = useRef(null);
  const gymRefs = useRef({});
  const monthNavRef = useRef(null);

  // ==================== REAL-TIME SUBSCRIPTIONS ====================

  const gymLinks = useRealtimeGymLinks();
  useRealtimeGyms(setGymsList);
  useRealtimeEvents(currentMonth, currentYear, setEvents, gymsList);

  // ==================== DATA FETCHING ====================

  const fetchEvents = useCallback(async () => {
    try {
      const data = await eventsApi.getAll(currentMonth + 1, currentYear);
      setEvents(data || []);
    } catch (error) {
      console.error('Error fetching events:', error);
    }
  }, [currentMonth, currentYear]);

  const refetchEvents = useCallback(async () => {
    cache.clear('events');
    await fetchEvents();
  }, [fetchEvents]);

  // Initial data load
  useEffect(() => {
    const fetchAllData = async () => {
      setLoading(true);
      try {
        const [gymsData, typesData, reqsData, rulesData] = await Promise.all([
          gymsApi.getAll(),
          eventTypesApi.getAll(),
          monthlyRequirementsApi.getAll(),
          gymValidValuesApi.getAll()
        ]);

        setGymsList(gymsData || []);
        setEventTypes(typesData || []);
        setGymRules(rulesData || []);

        // Transform requirements
        if (reqsData && reqsData.length > 0) {
          const reqMap = {};
          reqsData.forEach(req => {
            reqMap[req.event_type] = req.required_count;
          });
          setMonthlyRequirements(reqMap);
        }

        await fetchEvents();
      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchAllData();
  }, [fetchEvents]);

  // ==================== COMPUTED VALUES ====================

  // Display dates based on calendar view
  const displayDates = useMemo(() =>
    getDisplayDates(calendarView, currentYear, currentMonth),
    [calendarView, currentYear, currentMonth]
  );

  // All gyms list (from data or derived from events)
  const allGyms = useMemo(() => {
    if (gymsList.length > 0) {
      return gymsList.map(g => g.name).sort();
    }
    return [...new Set(events.map(e => e.gym_name || e.gym_code))].filter(Boolean).sort();
  }, [gymsList, events]);

  const allGymsFromList = useMemo(() =>
    gymsList.map(g => g.name).sort(),
    [gymsList]
  );

  // Unique gyms that have events this month
  const uniqueGymsWithEvents = useMemo(() =>
    [...new Set(events.map(e => e.gym_name || e.gym_code))].filter(Boolean),
    [events]
  );

  // Event types from current events
  const eventTypesFromEvents = useMemo(() =>
    [...new Set(events.map(e => e.type || e.event_type))].filter(Boolean).sort(),
    [events]
  );

  // Filtered events based on selections
  const filteredEvents = useMemo(() => {
    return events.filter(event => {
      const matchesGym = selectedGym === 'all' ||
        (event.gym_name || event.gym_code) === selectedGym;
      const matchesType = selectedEventType === 'all' ||
        (event.type || event.event_type) === selectedEventType;
      const matchesSearch = !searchTerm ||
        (event.title || '').toLowerCase().includes(searchTerm.toLowerCase());
      return matchesGym && matchesType && matchesSearch;
    });
  }, [events, selectedGym, selectedEventType, searchTerm]);

  // ==================== HELPER FUNCTIONS ====================

  // Get event counts per gym per type
  const getEventCounts = useCallback(() => {
    const counts = {};
    events.forEach(event => {
      const gymName = event.gym_name || event.gym_code;
      const eventType = event.type || event.event_type;
      if (!gymName) return;

      if (!counts[gymName]) {
        counts[gymName] = {};
      }
      counts[gymName][eventType] = (counts[gymName][eventType] || 0) + 1;
    });
    return counts;
  }, [events]);

  // Get missing event types for a gym
  const getMissingEventTypes = useCallback((gym) => {
    const counts = getEventCounts();
    const missing = [];
    Object.keys(monthlyRequirements).forEach(eventType => {
      const requiredCount = monthlyRequirements[eventType];
      const currentCount = counts[gym]?.[eventType] || 0;
      if (currentCount < requiredCount) {
        missing.push(eventType);
      }
    });
    return missing;
  }, [getEventCounts, monthlyRequirements]);

  // Get gym link URL
  const getGymLinkUrl = useCallback((gymName, linkType) => {
    const gym = gymsList.find(g => g.name === gymName);
    if (!gym) return null;

    const link = gymLinks.find(gl =>
      gl.gym_id === gym.id &&
      (gl.link_type_id === linkType || gl.link_type_id === linkType.toUpperCase())
    );
    return link?.url || null;
  }, [gymsList, gymLinks]);

  // Check if a validation error is matched by a rule
  const isMatchedByRule = useCallback((errorMessage, gymId) => {
    if (!gymId || !gymRules.length) return false;

    // Extract value from error message for comparison
    const priceMatch = errorMessage.match(/\$(\d+)/);
    const timeMatch = errorMessage.match(/(\d{1,2}:\d{2}\s*(?:AM|PM)?)/i);

    return gymRules.some(rule => {
      if (rule.gym_id !== gymId && rule.gym_id !== 'ALL') return false;

      if (rule.rule_type === 'price' && priceMatch) {
        return rule.value === priceMatch[1];
      }
      if (rule.rule_type === 'time' && timeMatch) {
        return rule.value.toLowerCase() === timeMatch[1].toLowerCase();
      }
      return false;
    });
  }, [gymRules]);

  // ==================== NAVIGATION FUNCTIONS ====================

  const goToPreviousMonth = useCallback(() => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear(currentYear - 1);
    } else {
      setCurrentMonth(currentMonth - 1);
    }
  }, [currentMonth, currentYear]);

  const goToNextMonth = useCallback(() => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear(currentYear + 1);
    } else {
      setCurrentMonth(currentMonth + 1);
    }
  }, [currentMonth, currentYear]);

  const handleCalendarViewChange = useCallback((view) => {
    setCalendarView(view);
  }, []);

  const scrollToGym = useCallback((gymName) => {
    const gymElement = gymRefs.current[gymName];
    if (gymElement) {
      gymElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, []);

  const scrollToTop = useCallback(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  // ==================== URL FUNCTIONS ====================

  const getAllUrlsForEventType = useCallback((eventType) => {
    const urls = [];
    gymsList.forEach(gym => {
      const link = gymLinks.find(gl => gl.gym_id === gym.id && gl.link_type_id === eventType);
      if (link?.url) urls.push(link.url);
    });
    return urls;
  }, [gymsList, gymLinks]);

  const openMultipleTabs = useCallback((urls, loadingMessage, successMessage) => {
    setToastMessage(loadingMessage);
    setShowToast(true);

    urls.forEach((url, index) => {
      setTimeout(() => {
        window.open(url, '_blank');
      }, index * 100);
    });

    setTimeout(() => {
      setToastMessage(successMessage);
      setTimeout(() => setShowToast(false), 2000);
    }, urls.length * 100);
  }, []);

  const handleMagicControlClick = useCallback((gymName) => {
    const urls = [];
    const gym = gymsList.find(g => g.name === gymName);
    if (!gym) return;

    ['CLINIC', 'KIDS NIGHT OUT', 'OPEN GYM', 'camps', 'camps_half'].forEach(type => {
      const link = gymLinks.find(gl => gl.gym_id === gym.id && gl.link_type_id === type);
      if (link?.url) urls.push(link.url);
    });

    if (urls.length > 0) {
      openMultipleTabs(urls, `Opening ${gymName} portals...`, `Opened ${urls.length} pages!`);
    }
  }, [gymsList, gymLinks, openMultipleTabs]);

  const copyToClipboard = useCallback((url, id) => {
    navigator.clipboard.writeText(url);
    setCopiedUrl(id);
    setTimeout(() => setCopiedUrl(null), 2000);
  }, []);

  // ==================== EVENT CRUD FUNCTIONS ====================

  const handleAddEvent = useCallback(async (eventData) => {
    try {
      await eventsApi.create(eventData);
      cache.clear('events');
      await refetchEvents();
      setShowAddEventModal(false);
      setNewEvent({
        title: '',
        date: '',
        time: '',
        price: '',
        type: 'CLINIC',
        gym_id: '',
        event_url: ''
      });
      setCopySuccess('✅ Event added successfully!');
      setTimeout(() => setCopySuccess(''), 4000);
    } catch (error) {
      console.error('Error adding event:', error);
      setCopySuccess('❌ Error adding event');
      setTimeout(() => setCopySuccess(''), 3000);
    }
  }, [refetchEvents]);

  const handleEditEvent = useCallback((event) => {
    setEditingEvent(event);
    setNewEvent({
      title: event.title || '',
      date: event.date || '',
      time: event.time || '',
      price: event.price || '',
      type: event.type || 'CLINIC',
      gym_id: event.gym_id || '',
      event_url: event.event_url || ''
    });
    setShowAddEventModal(true);
    setSelectedEventForPanel(null);
  }, []);

  const handleDeleteEvent = useCallback(async (eventId, eventTitle) => {
    try {
      await eventsApi.delete(eventId);
      cache.clear('events');
      await refetchEvents();
      setShowAddEventModal(false);
      setEditingEvent(null);
      setCopySuccess(`✅ "${eventTitle}" deleted successfully!`);
      setTimeout(() => setCopySuccess(''), 4000);
    } catch (error) {
      console.error('Error deleting event:', error);
      setCopySuccess('❌ Error deleting event');
      setTimeout(() => setCopySuccess(''), 3000);
    }
  }, [refetchEvents]);

  // ==================== VALIDATION FUNCTIONS ====================

  const acknowledgeValidationError = useCallback(async (eventId, errorMessage, note = '', addAsRule = false) => {
    try {
      const event = events.find(e => e.id === eventId);
      if (!event) return;

      const existingAcknowledged = event.acknowledged_errors || [];
      const newAcknowledgment = {
        message: errorMessage,
        note: note,
        dismissed_at: new Date().toISOString(),
        has_rule: addAsRule
      };

      const updatedAcknowledged = [...existingAcknowledged, newAcknowledgment];

      await eventsApi.update(eventId, {
        acknowledged_errors: updatedAcknowledged
      });

      // Update local state
      setEvents(prevEvents =>
        prevEvents.map(e =>
          e.id === eventId
            ? { ...e, acknowledged_errors: updatedAcknowledged }
            : e
        )
      );

      // Update panel if open
      if (selectedEventForPanel?.id === eventId) {
        setSelectedEventForPanel(prev => ({
          ...prev,
          acknowledged_errors: updatedAcknowledged
        }));
      }
    } catch (error) {
      console.error('Error acknowledging error:', error);
    }
  }, [events, selectedEventForPanel]);

  const resetAcknowledgedErrors = useCallback(async (eventId) => {
    try {
      await eventsApi.update(eventId, { acknowledged_errors: [] });

      setEvents(prevEvents =>
        prevEvents.map(e =>
          e.id === eventId ? { ...e, acknowledged_errors: [] } : e
        )
      );

      if (selectedEventForPanel?.id === eventId) {
        setSelectedEventForPanel(prev => ({ ...prev, acknowledged_errors: [] }));
      }
    } catch (error) {
      console.error('Error resetting acknowledged errors:', error);
    }
  }, [selectedEventForPanel]);

  // ==================== AUDIT HISTORY ====================

  const loadAuditHistory = useCallback(async () => {
    setLoadingAudit(true);
    try {
      const data = await auditLogApi.getRecent(100);
      setAuditHistory(data || []);
    } catch (error) {
      console.error('Error loading audit history:', error);
    } finally {
      setLoadingAudit(false);
    }
  }, []);

  // ==================== SCROLL LISTENER ====================

  useEffect(() => {
    const handleScroll = () => {
      setShowBackToTop(window.scrollY > 500);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // ==================== RETURN ALL VALUES ====================

  return {
    // Data
    events,
    setEvents,
    gymsList,
    eventTypes,
    monthlyRequirements,
    gymLinks,
    gymRules,
    setGymRules,

    // Loading
    loading,

    // Current view
    currentMonth,
    setCurrentMonth,
    currentYear,
    setCurrentYear,
    calendarView,
    setCalendarView,
    viewMode,
    setViewMode,
    displayDates,

    // Filters
    selectedGym,
    setSelectedGym,
    selectedEventType,
    setSelectedEventType,
    searchTerm,
    setSearchTerm,

    // Computed
    allGyms,
    allGymsFromList,
    uniqueGymsWithEvents,
    eventTypesFromEvents,
    filteredEvents,

    // Modals
    showAddEventModal,
    setShowAddEventModal,
    showBulkImportModal,
    setShowBulkImportModal,
    showSyncModal,
    setShowSyncModal,
    showExportModal,
    setShowExportModal,
    showAdminPortal,
    setShowAdminPortal,
    showAuditHistory,
    setShowAuditHistory,
    dismissModalState,
    setDismissModalState,

    // Event editing
    editingEvent,
    setEditingEvent,
    newEvent,
    setNewEvent,

    // Bulk import
    rawEventListings,
    setRawEventListings,
    selectedGymId,
    setSelectedGymId,
    validationResults,
    setValidationResults,
    importTiming,
    setImportTiming,
    bulkImportData,
    setBulkImportData,

    // Panel
    selectedEventForPanel,
    setSelectedEventForPanel,
    copiedUrl,
    setCopiedUrl,

    // Audit
    auditHistory,
    loadingAudit,
    loadAuditHistory,

    // UI feedback
    copySuccess,
    setCopySuccess,
    showBackToTop,
    showToast,
    toastMessage,
    setShowToast,
    setToastMessage,

    // Refs
    topRef,
    calendarRef,
    gymRefs,
    monthNavRef,

    // Functions
    refetchEvents,
    getEventCounts,
    getMissingEventTypes,
    getGymLinkUrl,
    isMatchedByRule,
    goToPreviousMonth,
    goToNextMonth,
    handleCalendarViewChange,
    scrollToGym,
    scrollToTop,
    getAllUrlsForEventType,
    openMultipleTabs,
    handleMagicControlClick,
    copyToClipboard,
    handleAddEvent,
    handleEditEvent,
    handleDeleteEvent,
    acknowledgeValidationError,
    resetAcknowledgedErrors,
  };
}
