import React, { useState, useCallback, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { gymValidValuesApi } from '../../lib/api';
import { inferErrorCategory, isErrorAcknowledged, canAddAsRule, extractRuleValue, computeAccuracyStats, getErrorLabel } from '../../lib/validationHelpers';
import AdminAuditFilters from './AdminAuditFilters';
import AdminAuditErrorCard from './AdminAuditErrorCard';
import DismissRuleModal from '../EventsDashboard/DismissRuleModal';

export default function AdminAuditReview({ gyms }) {
  const [selectedGyms, setSelectedGyms] = useState([]);
  const [selectedMonth, setSelectedMonth] = useState('all');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedProgramType, setSelectedProgramType] = useState('all');
  const [selectedErrorType, setSelectedErrorType] = useState('all');
  const [groupBy, setGroupBy] = useState('gym');
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [dismissModalState, setDismissModalState] = useState(null);
  const [dismissingError, setDismissingError] = useState(null);
  const [statusFilter, setStatusFilter] = useState('active');
  const [collapsedSections, setCollapsedSections] = useState({});
  const [showBackToTop, setShowBackToTop] = useState(false);

  // Back to top scroll listener
  useEffect(() => {
    const handleScroll = () => setShowBackToTop(window.scrollY > 400);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Load events with validation errors for selected gyms
  const loadEvents = useCallback(async (gymIds) => {
    if (!gymIds || gymIds.length === 0) {
      setEvents([]);
      return;
    }
    setLoading(true);
    try {
      let query = supabase
        .from('events_with_gym')
        .select('*')
        .in('gym_id', gymIds)
        .is('deleted_at', null)
        .order('date', { ascending: true });

      const { data, error } = await query;
      if (error) throw error;

      // Filter to only events with validation issues
      const eventsWithIssues = (data || []).filter(event => {
        const errors = event.validation_errors || [];
        const realErrors = errors.filter(err => err.type !== 'sold_out');
        return realErrors.length > 0 ||
               event.description_status === 'none' ||
               event.description_status === 'flyer_only';
      });

      setEvents(eventsWithIssues);
    } catch (err) {
      console.error('Error loading events:', err);
      setEvents([]);
    }
    setLoading(false);
  }, []);

  // Reload when selected gyms change
  useEffect(() => {
    loadEvents(selectedGyms);
  }, [selectedGyms, loadEvents]);

  const handleGymsChange = (newGyms) => {
    setSelectedGyms(newGyms);
  };

  // Apply month + program filters first (before category)
  const preFilteredEvents = events.filter(event => {
    if (selectedMonth !== 'all') {
      const eventDate = event.date || event.start_date || '';
      if (!eventDate.startsWith(selectedMonth)) return false;
    }
    if (selectedProgramType !== 'all') {
      if (event.type !== selectedProgramType) return false;
    }
    return true;
  });

  // Count errors from pre-filtered events (so counts stay stable across category switches)
  const counts = preFilteredEvents.reduce((acc, event) => {
    const errors = (event.validation_errors || []).filter(err => err.type !== 'sold_out');
    const acknowledged = event.acknowledged_errors || [];
    errors.forEach(e => {
      if (isErrorAcknowledged(acknowledged, e.message)) return;
      const cat = inferErrorCategory(e);
      if (cat === 'data_error') acc.data++;
      else if (cat === 'formatting') acc.format++;
    });
    if (event.description_status === 'none' || event.description_status === 'flyer_only') acc.desc++;
    return acc;
  }, { data: 0, format: 0, desc: 0 });

  // Count errors by type for the error type pills
  const errorTypeCounts = preFilteredEvents.reduce((acc, event) => {
    const errors = (event.validation_errors || []).filter(err => err.type !== 'sold_out');
    const acknowledged = event.acknowledged_errors || [];
    const verified = event.verified_errors || [];
    errors.forEach(e => {
      // Respect status filter for counts
      const isDismissed = isErrorAcknowledged(acknowledged, e.message);
      const isVerifiedAccurate = verified.some(v => v.message === e.message && v.verdict === 'correct');
      const isBug = verified.some(v => v.message === e.message && v.verdict === 'incorrect');

      if (statusFilter === 'active' && (isDismissed || isVerifiedAccurate || isBug)) return;
      if (statusFilter === 'verified' && !isVerifiedAccurate) return;
      if (statusFilter === 'bugs' && !isBug) return;
      if (statusFilter === 'resolved' && !isDismissed) return;

      // Respect category filter
      if (selectedCategory !== 'all' && inferErrorCategory(e) !== selectedCategory) return;

      acc[e.type] = (acc[e.type] || 0) + 1;
    });
    return acc;
  }, {});

  // Now apply category + status + error type filters
  const filteredEvents = preFilteredEvents.filter(event => {
    const errors = (event.validation_errors || []).filter(err => err.type !== 'sold_out');
    const acknowledged = event.acknowledged_errors || [];
    const verified = event.verified_errors || [];

    // Check if event has active or resolved errors (respecting category filter)
    const matchCategory = (e) => selectedCategory === 'all' || inferErrorCategory(e) === selectedCategory;
    const matchErrorType = (e) => selectedErrorType === 'all' || e.type === selectedErrorType;

    // Helper to check if an error is verified as accurate or marked as bug
    const isVerifiedAccurate = (msg) => verified.some(v => v.message === msg && v.verdict === 'correct');
    const isMarkedBug = (msg) => verified.some(v => v.message === msg && v.verdict === 'incorrect');

    // Active = not acknowledged AND not verified accurate (still needs review)
    const hasActive = errors.some(e => matchCategory(e) && matchErrorType(e) && !isErrorAcknowledged(acknowledged, e.message) && !isVerifiedAccurate(e.message));

    // Resolved = dismissed via temp override or permanent rule
    const hasResolved = errors.some(e => matchCategory(e) && matchErrorType(e) && isErrorAcknowledged(acknowledged, e.message));

    // Verified = marked as accurate (system caught real error)
    const hasVerified = errors.some(e => matchCategory(e) && matchErrorType(e) && isVerifiedAccurate(e.message));

    // Bugs = marked as invalid/bug (needs code fix)
    const hasBugs = errors.some(e => matchCategory(e) && matchErrorType(e) && isMarkedBug(e.message));

    // Description issues (only if no specific error type filter)
    const hasDescIssue = selectedErrorType === 'all' &&
      (selectedCategory === 'all' || selectedCategory === 'formatting') &&
      (event.description_status === 'none' || event.description_status === 'flyer_only');
    const descMsg = `description:${event.description_status}`;
    const descVerifiedAccurate = isVerifiedAccurate(descMsg);
    const descMarkedBug = isMarkedBug(descMsg);

    // For active, exclude description issues that have been verified
    const hasActiveDescIssue = hasDescIssue && !descVerifiedAccurate && !descMarkedBug;

    if (statusFilter === 'active' && (hasActive || hasActiveDescIssue)) return true;
    if (statusFilter === 'verified' && (hasVerified || (hasDescIssue && descVerifiedAccurate))) return true;
    if (statusFilter === 'bugs' && (hasBugs || (hasDescIssue && descMarkedBug))) return true;
    if (statusFilter === 'resolved' && hasResolved) return true;
    if (statusFilter === 'all') return true;
    return false;
  });

  // Group filtered events by gym for display
  const eventsByGym = {};
  filteredEvents.forEach(event => {
    const gymId = event.gym_id;
    if (!eventsByGym[gymId]) eventsByGym[gymId] = [];
    eventsByGym[gymId].push(event);
  });

  // Group by error type - flatten errors across all events
  const errorsByType = {};
  if (groupBy === 'error_type') {
    filteredEvents.forEach(event => {
      const errors = (event.validation_errors || []).filter(err => err.type !== 'sold_out');
      const acknowledged = event.acknowledged_errors || [];
      const verified = event.verified_errors || [];

      errors.forEach(error => {
        // Apply category filter
        if (selectedCategory !== 'all' && inferErrorCategory(error) !== selectedCategory) return;
        // Apply error type filter
        if (selectedErrorType !== 'all' && error.type !== selectedErrorType) return;

        // Apply status filter per-error
        const isDismissed = isErrorAcknowledged(acknowledged, error.message);
        const isVerified = verified.some(v => v.message === error.message && v.verdict === 'correct');
        const isBug = verified.some(v => v.message === error.message && v.verdict === 'incorrect');

        if (statusFilter === 'active' && (isDismissed || isVerified || isBug)) return;
        if (statusFilter === 'verified' && !isVerified) return;
        if (statusFilter === 'bugs' && !isBug) return;
        if (statusFilter === 'resolved' && !isDismissed) return;

        const errType = error.type || 'unknown';
        if (!errorsByType[errType]) errorsByType[errType] = [];
        errorsByType[errType].push({ event, error });
      });
    });
  }

  // Get gym stats for section headers
  const getGymStats = (gymEvents) => {
    let dataCount = 0;
    let formatCount = 0;
    gymEvents.forEach(event => {
      const errors = (event.validation_errors || []).filter(err => err.type !== 'sold_out');
      errors.forEach(e => {
        const cat = inferErrorCategory(e);
        if (cat === 'data_error') dataCount++;
        else if (cat === 'formatting') formatCount++;
      });
    });
    return { dataCount, formatCount, total: dataCount + formatCount };
  };

  // Toggle section collapse
  const toggleSection = (sectionId) => {
    setCollapsedSections(prev => ({ ...prev, [sectionId]: !prev[sectionId] }));
  };

  // Handle dismiss error - opens DismissRuleModal
  const handleDismissError = (event, errorMessage, errorObj = null) => {
    const gymId = event.gym_id;
    const ruleEligible = errorObj ? canAddAsRule(errorObj.type) : false;
    const ruleInfo = errorObj ? extractRuleValue(errorObj, event) : null;
    setDismissModalState({ event, eventId: event.id, errorMessage, errorObj, gymId, ruleEligible, ruleInfo });
  };

  // Accept exception (dismiss once)
  const handleAcceptException = async (note) => {
    if (!dismissModalState) return;
    const { eventId, errorMessage } = dismissModalState;
    setDismissingError(`${eventId}-${errorMessage}`);

    try {
      const { data: currentEvent, error: fetchError } = await supabase
        .from('events')
        .select('acknowledged_errors')
        .eq('id', eventId)
        .single();

      if (fetchError) throw fetchError;

      const currentAcknowledged = currentEvent?.acknowledged_errors || [];
      const alreadyAcknowledged = currentAcknowledged.some(ack =>
        typeof ack === 'string' ? ack === errorMessage : ack.message === errorMessage
      );

      if (!alreadyAcknowledged) {
        const acknowledgment = {
          message: errorMessage,
          note: note || null,
          dismissed_at: new Date().toISOString(),
        };
        const updatedAcknowledged = [...currentAcknowledged, acknowledgment];

        const { error: updateError } = await supabase
          .from('events')
          .update({ acknowledged_errors: updatedAcknowledged })
          .eq('id', eventId);

        if (updateError) throw updateError;

        // Update local state
        setEvents(prev => prev.map(e =>
          e.id === eventId ? { ...e, acknowledged_errors: updatedAcknowledged } : e
        ));
      }
    } catch (err) {
      console.error('Error dismissing error:', err);
      alert('Failed to dismiss error. Please try again.');
    }

    setDismissingError(null);
    setDismissModalState(null);
  };

  // Dismiss and create rule
  const handleDismissAndRule = async (note, label) => {
    if (!dismissModalState) return;
    const { eventId, errorMessage, gymId, ruleInfo } = dismissModalState;
    setDismissingError(`${eventId}-${errorMessage}`);

    let ruleCreated = false;
    try {
      const isProgramSynonym = ruleInfo.ruleType === 'program_synonym';
      await gymValidValuesApi.create({
        gym_id: gymId,
        rule_type: ruleInfo.ruleType,
        value: isProgramSynonym ? ruleInfo.value.toLowerCase() : ruleInfo.value,
        label: label,
        event_type: isProgramSynonym ? label.toUpperCase() : 'CAMP'
      });
      ruleCreated = true;

      const { data: currentEvent, error: fetchError } = await supabase
        .from('events')
        .select('acknowledged_errors')
        .eq('id', eventId)
        .single();

      if (fetchError) throw fetchError;

      const currentAcknowledged = currentEvent?.acknowledged_errors || [];
      const acknowledgment = {
        message: errorMessage,
        note: note || `Rule created: ${ruleInfo.value} = ${label}`,
        dismissed_at: new Date().toISOString(),
        has_rule: true,
      };
      const updatedAcknowledged = [...currentAcknowledged, acknowledgment];

      const { error: updateError } = await supabase
        .from('events')
        .update({ acknowledged_errors: updatedAcknowledged })
        .eq('id', eventId);

      if (updateError) throw updateError;

      setEvents(prev => prev.map(e =>
        e.id === eventId ? { ...e, acknowledged_errors: updatedAcknowledged } : e
      ));

    } catch (err) {
      console.error('Error creating rule:', err);
      if (ruleCreated) {
        console.log('Rule was created successfully, but failed to update event acknowledgment');
      } else {
        alert('Failed to create rule. Please try again or add it manually in Gym Rules tab.');
      }
    }

    setDismissingError(null);
    setDismissModalState(null);
  };

  // Handle verify error - set verdict ('correct', 'incorrect', or null to remove)
  const handleVerifyError = async (event, errorMessage, verdict, errorObj = null, note = null) => {
    try {
      const { data: currentEvent, error: fetchError } = await supabase
        .from('events')
        .select('verified_errors')
        .eq('id', event.id)
        .single();

      if (fetchError) throw fetchError;

      const currentVerified = currentEvent?.verified_errors || [];
      // Remove existing entry for this message
      const filtered = currentVerified.filter(v => v.message !== errorMessage);

      // If setting a verdict, add new entry
      if (verdict) {
        const entry = {
          message: errorMessage,
          verified_at: new Date().toISOString(),
          category: errorObj ? inferErrorCategory(errorObj) : 'formatting',
          verdict: verdict, // 'correct' or 'incorrect'
        };
        // Only add note if provided and non-empty
        if (note && note.trim()) {
          entry.note = note.trim();
        }
        filtered.push(entry);
      }

      const { error: updateError } = await supabase
        .from('events')
        .update({ verified_errors: filtered })
        .eq('id', event.id);

      if (updateError) throw updateError;

      // Update local state
      setEvents(prev => prev.map(e =>
        e.id === event.id ? { ...e, verified_errors: filtered } : e
      ));
    } catch (err) {
      console.error('Error verifying error:', err);
    }
  };

  // Handle undo dismiss - remove from acknowledged_errors
  const handleUndoDismiss = async (event, errorMessage) => {
    try {
      const { data: currentEvent, error: fetchError } = await supabase
        .from('events')
        .select('acknowledged_errors')
        .eq('id', event.id)
        .single();

      if (fetchError) throw fetchError;

      const currentAcknowledged = currentEvent?.acknowledged_errors || [];
      // Remove the acknowledgment for this error
      const filtered = currentAcknowledged.filter(ack =>
        typeof ack === 'string' ? ack !== errorMessage : ack.message !== errorMessage
      );

      const { error: updateError } = await supabase
        .from('events')
        .update({ acknowledged_errors: filtered })
        .eq('id', event.id);

      if (updateError) throw updateError;

      // Update local state
      setEvents(prev => prev.map(e =>
        e.id === event.id ? { ...e, acknowledged_errors: filtered } : e
      ));
    } catch (err) {
      console.error('Error undoing dismiss:', err);
      alert('Failed to undo. Please try again.');
    }
  };

  // Compute accuracy stats from pre-filtered events
  const accuracyStats = computeAccuracyStats(preFilteredEvents);

  // Get sorted section keys for jump-to nav
  const sectionKeys = groupBy === 'error_type'
    ? Object.keys(errorsByType).sort()
    : Object.keys(eventsByGym).sort();

  return (
    <div className="space-y-4">
      {/* Sticky Filter Bar */}
      <div className="sticky top-0 z-30 -mx-1 px-1 pt-1 pb-2 bg-gradient-to-b from-gray-50 via-gray-50 to-transparent">
        <AdminAuditFilters
          gyms={gyms}
          selectedGyms={selectedGyms}
          onGymsChange={handleGymsChange}
          selectedMonth={selectedMonth}
          onMonthChange={setSelectedMonth}
          selectedCategory={selectedCategory}
          onCategoryChange={setSelectedCategory}
          selectedProgramType={selectedProgramType}
          onProgramTypeChange={setSelectedProgramType}
          statusFilter={statusFilter}
          onStatusFilterChange={setStatusFilter}
          counts={counts}
          groupBy={groupBy}
          onGroupByChange={setGroupBy}
          selectedErrorType={selectedErrorType}
          onErrorTypeChange={setSelectedErrorType}
          errorTypeCounts={errorTypeCounts}
        />
      </div>

      {/* Results Header */}
      {selectedGyms.length > 0 && !loading && (
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-sm text-gray-500">
            {filteredEvents.length} event{filteredEvents.length !== 1 ? 's' : ''} with issues
            {selectedGyms.length > 1 ? ` across ${selectedGyms.length} gyms` : ''}
          </span>
          {(counts.data > 0 || counts.format > 0 || counts.desc > 0) && (
            <div className="flex gap-1.5">
              {counts.data > 0 && (
                <span className="px-2 py-0.5 bg-red-500 text-white text-xs font-bold rounded">{counts.data} DATA</span>
              )}
              {(counts.format > 0 || counts.desc > 0) && (
                <span className="px-2 py-0.5 bg-orange-500 text-white text-xs font-bold rounded">{(counts.format || 0) + (counts.desc || 0)} FORMAT</span>
              )}
            </div>
          )}
          {/* Accuracy Score */}
          {accuracyStats.total > 0 && (
            <div className="flex items-center gap-2 ml-auto bg-gray-50 border border-gray-200 rounded-lg px-3 py-1.5">
              <span className="text-xs text-gray-500">Accuracy:</span>
              {accuracyStats.total >= 5 ? (
                <>
                  <div className="w-16 bg-gray-200 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full ${accuracyStats.accuracyPct >= 80 ? 'bg-green-500' : accuracyStats.accuracyPct >= 50 ? 'bg-yellow-500' : 'bg-red-500'}`}
                      style={{ width: `${accuracyStats.accuracyPct}%` }}
                    ></div>
                  </div>
                  <span className="text-xs font-bold text-gray-700">{accuracyStats.accuracyPct}%</span>
                  <span className="text-[10px] text-gray-400">({accuracyStats.verified}✓ / {accuracyStats.incorrect}✗ of {accuracyStats.total} rated)</span>
                </>
              ) : (
                <span className="text-[10px] text-gray-400">{accuracyStats.total}/5 rated — keep going!</span>
              )}
            </div>
          )}
        </div>
      )}

      {/* Jump-to Navigation */}
      {selectedGyms.length > 0 && !loading && sectionKeys.length > 1 && (
        <div className="flex flex-wrap gap-1.5 py-1">
          <span className="text-xs text-gray-400 self-center mr-1">Jump to:</span>
          {sectionKeys.map(key => {
            const label = groupBy === 'error_type'
              ? getErrorLabel(key)
              : (gyms?.find(g => g.id === key)?.name || key);
            const count = groupBy === 'error_type'
              ? errorsByType[key]?.length || 0
              : eventsByGym[key]?.length || 0;
            const pillColor = groupBy === 'error_type'
              ? 'bg-red-50 text-red-700 hover:bg-red-100'
              : 'bg-purple-50 text-purple-700 hover:bg-purple-100';
            return (
              <button
                key={key}
                onClick={() => document.getElementById(`section-${key}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                className={`px-2.5 py-1 text-xs rounded-full transition-colors font-medium ${pillColor}`}
              >
                {label} ({count})
              </button>
            );
          })}
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mx-auto mb-3"></div>
          <p className="text-sm text-gray-500">Loading events...</p>
        </div>
      )}

      {/* No Gym Selected */}
      {selectedGyms.length === 0 && !loading && (
        <div className="text-center py-16 bg-gray-50 rounded-xl border-2 border-dashed border-gray-300">
          <div className="text-4xl mb-3">📋</div>
          <h3 className="text-lg font-semibold text-gray-700 mb-1">Select gyms to review</h3>
          <p className="text-sm text-gray-500">Choose one or more gyms from the checkboxes above to see all validation issues</p>
        </div>
      )}

      {/* No Issues */}
      {selectedGyms.length > 0 && !loading && filteredEvents.length === 0 && (
        <div className="text-center py-12 bg-green-50 rounded-xl border-2 border-green-200">
          <div className="text-4xl mb-3">✅</div>
          <h3 className="text-lg font-semibold text-green-700 mb-1">All clear!</h3>
          <p className="text-sm text-green-600">No validation issues found for the selected filters</p>
        </div>
      )}

      {/* Event Error Cards */}
      {selectedGyms.length > 0 && !loading && filteredEvents.length > 0 && (
        <div className="space-y-4">
          {groupBy === 'error_type' ? (
            // GROUP BY ERROR TYPE
            Object.keys(errorsByType).sort().map(errorType => {
              const items = errorsByType[errorType];
              const label = getErrorLabel(errorType);
              const category = inferErrorCategory({ type: errorType });
              const uniqueGyms = [...new Set(items.map(i => i.event.gym_id))];
              const isCollapsed = collapsedSections[errorType];

              return (
                <div key={errorType} id={`section-${errorType}`}>
                  {/* Error Type Header */}
                  <div
                    className={`flex items-center gap-2 mb-2 pb-2 border-b-2 cursor-pointer rounded-t-lg px-3 py-2 transition-colors ${
                      category === 'data_error'
                        ? 'border-red-300 hover:bg-red-50'
                        : category === 'status'
                          ? 'border-blue-300 hover:bg-blue-50'
                          : 'border-orange-300 hover:bg-orange-50'
                    }`}
                    onClick={() => toggleSection(errorType)}
                  >
                    <span className={`text-sm transition-transform duration-200 ${isCollapsed ? '-rotate-90' : ''}`}>
                      ▼
                    </span>
                    <h3 className={`font-bold text-lg ${
                      category === 'data_error' ? 'text-red-800' : category === 'status' ? 'text-blue-800' : 'text-orange-800'
                    }`}>
                      {label}
                    </h3>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      category === 'data_error' ? 'bg-red-100 text-red-600' : category === 'status' ? 'bg-blue-100 text-blue-600' : 'bg-orange-100 text-orange-600'
                    }`}>
                      {items.length} error{items.length !== 1 ? 's' : ''}
                    </span>
                    <span className="text-xs text-gray-400">
                      across {uniqueGyms.length} gym{uniqueGyms.length !== 1 ? 's' : ''}
                    </span>
                  </div>
                  {!isCollapsed && (
                    <div className="space-y-3">
                      {items.map(({ event }) => (
                        <AdminAuditErrorCard
                          key={`${event.id}-${errorType}`}
                          event={event}
                          showGymName={true}
                          gymName={gyms?.find(g => g.id === event.gym_id)?.name || event.gym_id}
                          onDismissError={handleDismissError}
                          onVerifyError={handleVerifyError}
                          onUndoDismiss={handleUndoDismiss}
                          dismissingError={dismissingError}
                          statusFilter={statusFilter}
                          selectedCategory={selectedCategory}
                          selectedErrorType={selectedErrorType}
                        />
                      ))}
                    </div>
                  )}
                </div>
              );
            })
          ) : (
            // GROUP BY GYM
            selectedGyms.length > 1 ? (
              Object.keys(eventsByGym).sort().map(gymId => {
                const gymName = gyms?.find(g => g.id === gymId)?.name || gymId;
                const gymEvents = eventsByGym[gymId];
                const stats = getGymStats(gymEvents);
                const isCollapsed = collapsedSections[gymId];

                return (
                  <div key={gymId} id={`section-${gymId}`}>
                    {/* Gym Header - clickable to collapse */}
                    <div
                      className="flex items-center gap-2 mb-2 pb-2 border-b-2 border-purple-300 cursor-pointer hover:bg-purple-50 rounded-t-lg px-3 py-2 transition-colors"
                      onClick={() => toggleSection(gymId)}
                    >
                      <span className={`text-sm text-purple-400 transition-transform duration-200 ${isCollapsed ? '-rotate-90' : ''}`}>
                        ▼
                      </span>
                      <h3 className="font-bold text-purple-800 text-lg">{gymName}</h3>
                      <span className="text-xs bg-purple-100 text-purple-600 px-2 py-0.5 rounded-full font-medium">
                        {gymEvents.length} event{gymEvents.length !== 1 ? 's' : ''}
                      </span>
                      {stats.dataCount > 0 && (
                        <span className="text-xs bg-red-100 text-red-600 px-1.5 py-0.5 rounded font-medium">
                          {stats.dataCount} data
                        </span>
                      )}
                      {stats.formatCount > 0 && (
                        <span className="text-xs bg-orange-100 text-orange-600 px-1.5 py-0.5 rounded font-medium">
                          {stats.formatCount} format
                        </span>
                      )}
                    </div>
                    {!isCollapsed && (
                      <div className="space-y-3">
                        {gymEvents.map(event => (
                          <AdminAuditErrorCard
                            key={event.id}
                            event={event}
                            onDismissError={handleDismissError}
                            onVerifyError={handleVerifyError}
                            onUndoDismiss={handleUndoDismiss}
                            dismissingError={dismissingError}
                            statusFilter={statusFilter}
                            selectedCategory={selectedCategory}
                            selectedErrorType={selectedErrorType}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                );
              })
            ) : (
              // Single gym: flat list
              <div className="space-y-3">
                {filteredEvents.map(event => (
                  <AdminAuditErrorCard
                    key={event.id}
                    event={event}
                    onDismissError={handleDismissError}
                    onVerifyError={handleVerifyError}
                    onUndoDismiss={handleUndoDismiss}
                    dismissingError={dismissingError}
                    statusFilter={statusFilter}
                    selectedCategory={selectedCategory}
                    selectedErrorType={selectedErrorType}
                  />
                ))}
              </div>
            )
          )}
        </div>
      )}

      {/* Help text */}
      {selectedGyms.length > 0 && !loading && filteredEvents.length > 0 && (
        <div className="text-center py-2 text-xs text-gray-500">
          <span className="text-green-600">✓</span> = verified accurate (real error) | <span className="text-red-600">✗</span> = bug (needs code fix) | "✓ OK" = temp override | "+ Rule" = permanent rule
        </div>
      )}

      {/* Back to Top Button */}
      {showBackToTop && (
        <button
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          className="fixed bottom-6 right-6 w-12 h-12 bg-purple-600 text-white rounded-full shadow-lg hover:bg-purple-700 hover:scale-105 transition-all z-40 flex items-center justify-center"
          title="Back to top"
        >
          <span className="text-xl">↑</span>
        </button>
      )}

      {/* DismissRuleModal */}
      {dismissModalState && (
        <DismissRuleModal
          errorMessage={dismissModalState.errorMessage}
          gymId={dismissModalState.gymId}
          ruleEligible={dismissModalState.ruleEligible}
          ruleInfo={dismissModalState.ruleInfo}
          onDismiss={handleAcceptException}
          onDismissAndRule={handleDismissAndRule}
          onCancel={() => setDismissModalState(null)}
        />
      )}
    </div>
  );
}
