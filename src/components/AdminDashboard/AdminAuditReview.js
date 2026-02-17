import React, { useState, useCallback, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { gymValidValuesApi, acknowledgedPatternsApi } from '../../lib/api';
import { inferErrorCategory, isErrorAcknowledged, matchesAcknowledgedPattern, canAddAsRule, extractRuleValue, computeAccuracyStats } from '../../lib/validationHelpers';
import AdminAuditFilters from './AdminAuditFilters';
import AdminAuditErrorCard from './AdminAuditErrorCard';
import DismissRuleModal from '../EventsDashboard/DismissRuleModal';

export default function AdminAuditReview({ gyms, initialMonth }) {
  const [selectedGyms, setSelectedGyms] = useState([]);
  const [selectedMonth, setSelectedMonth] = useState(initialMonth || 'all');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedProgramType, setSelectedProgramType] = useState('all');
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [dismissModalState, setDismissModalState] = useState(null);
  const [dismissingError, setDismissingError] = useState(null);
  const [statusFilter, setStatusFilter] = useState('active');
  const [acknowledgedPatterns, setAcknowledgedPatterns] = useState([]);

  // Load acknowledged patterns (temp overrides for "all in program")
  const loadAcknowledgedPatterns = useCallback(async () => {
    try {
      const data = await acknowledgedPatternsApi.getAll();
      setAcknowledgedPatterns(data || []);
    } catch (err) {
      console.error('Error loading acknowledged patterns:', err);
      setAcknowledgedPatterns([]);
    }
  }, []);

  useEffect(() => {
    loadAcknowledgedPatterns();
  }, [loadAcknowledgedPatterns]);

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

  const isDismissedForEvent = (event, errorMessage) => {
    const pm = matchesAcknowledgedPattern(acknowledgedPatterns, event.gym_id, event.type, errorMessage);
    return isErrorAcknowledged(event.acknowledged_errors || [], errorMessage, pm);
  };

  // Count errors from pre-filtered events (so counts stay stable across category switches)
  const counts = preFilteredEvents.reduce((acc, event) => {
    const errors = (event.validation_errors || []).filter(err => err.type !== 'sold_out');
    errors.forEach(e => {
      if (isDismissedForEvent(event, e.message)) return;
      const cat = inferErrorCategory(e);
      if (cat === 'data_error') acc.data++;
      else if (cat === 'formatting') acc.format++;
    });
    if (event.description_status === 'none' || event.description_status === 'flyer_only') acc.desc++;
    return acc;
  }, { data: 0, format: 0, desc: 0 });

  // Now apply category + status filters
  // Status options: active, verified, bugs, resolved, all

  const filteredEvents = preFilteredEvents.filter(event => {
    const errors = (event.validation_errors || []).filter(err => err.type !== 'sold_out');
    const acknowledged = event.acknowledged_errors || [];
    const verified = event.verified_errors || [];

    // Check if event has active or resolved errors (respecting category filter)
    const matchCategory = (e) => selectedCategory === 'all' || inferErrorCategory(e) === selectedCategory;

    // Helper to check if an error is verified as accurate or marked as bug
    const isVerifiedAccurate = (msg) => verified.some(v => v.message === msg && v.verdict === 'correct');
    const isMarkedBug = (msg) => verified.some(v => v.message === msg && v.verdict === 'incorrect');

    const dismissed = (e) => {
      const pm = matchesAcknowledgedPattern(acknowledgedPatterns, event.gym_id, event.type, e.message);
      return isErrorAcknowledged(acknowledged, e.message, pm);
    };
    // Active = not acknowledged, not verified, not marked bug — still needs review
    const hasActive = errors.some(e => matchCategory(e) && !dismissed(e) && !isVerifiedAccurate(e.message) && !isMarkedBug(e.message));

    // Resolved = dismissed via temp override or permanent rule
    const hasResolved = errors.some(e => matchCategory(e) && dismissed(e));

    // Verified = marked as accurate (system caught real error)
    const hasVerified = errors.some(e => matchCategory(e) && isVerifiedAccurate(e.message));

    // Bugs = marked as invalid/bug (needs code fix)
    const hasBugs = errors.some(e => matchCategory(e) && isMarkedBug(e.message));

    // Description issues
    const hasDescIssue = (selectedCategory === 'all' || selectedCategory === 'formatting') &&
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

  // Handle dismiss error - opens DismissRuleModal
  const handleDismissError = (event, errorMessage, errorObj = null) => {
    const gymId = event.gym_id;
    const ruleEligible = errorObj ? canAddAsRule(errorObj.type) : false;
    const ruleInfo = errorObj ? extractRuleValue(errorObj, event) : null;
    setDismissModalState({ event, eventId: event.id, errorMessage, errorObj, gymId, ruleEligible, ruleInfo });
  };

  // Accept exception (dismiss once) - scope: 'event_only' | 'all_in_program'
  const handleAcceptException = async (note, scope = 'event_only') => {
    if (!dismissModalState) return;
    const { eventId, errorMessage, gymId, event } = dismissModalState;
    const eventType = event?.type || 'CAMP';
    setDismissingError(`${eventId}-${errorMessage}`);

    try {
      if (scope === 'all_in_program') {
        await acknowledgedPatternsApi.create({
          gym_id: gymId,
          event_type: (eventType || 'CAMP').toUpperCase(),
          error_message: errorMessage,
          note: note || null
        });
        const updated = await acknowledgedPatternsApi.getAll();
        setAcknowledgedPatterns(updated);
      } else {
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

          setEvents(prev => prev.map(e =>
            e.id === eventId ? { ...e, acknowledged_errors: updatedAcknowledged } : e
          ));
        }
      }
    } catch (err) {
      console.error('Error dismissing error:', err);
      alert('Failed to dismiss error. Please try again.');
    }

    setDismissingError(null);
    setDismissModalState(null);
  };

  // Dismiss and create rule
  const handleDismissAndRule = async (note, label, ruleEventType) => {
    if (!dismissModalState) return;
    const { eventId, errorMessage, gymId, ruleInfo, event } = dismissModalState;
    setDismissingError(`${eventId}-${errorMessage}`);

    let ruleCreated = false;
    try {
      const isProgramSynonym = ruleInfo.ruleType === 'program_synonym';
      const eventType = ruleEventType || event?.type || 'CAMP';
      await gymValidValuesApi.create({
        gym_id: gymId,
        rule_type: ruleInfo.ruleType,
        value: isProgramSynonym ? ruleInfo.value.toLowerCase() : ruleInfo.value,
        label: label,
        event_type: isProgramSynonym ? label.toUpperCase() : eventType
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
        // Rule was created but updating event failed - just log it, rule is saved
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

  // Handle undo pattern - remove from acknowledged_patterns
  const handleUndoPattern = async (gymId, eventType, errorMessage) => {
    try {
      const pattern = acknowledgedPatterns.find(
        p => p.gym_id === gymId && p.event_type === eventType && p.error_message === errorMessage
      );
      if (!pattern) return;
      await acknowledgedPatternsApi.delete(pattern.id);
      setAcknowledgedPatterns(prev => prev.filter(p => p.id !== pattern.id));
    } catch (err) {
      console.error('Error undoing pattern:', err);
      alert('Failed to undo. Please try again.');
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

  return (
    <div className="space-y-5">
      {/* Filters */}
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
      />

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
              <span className="text-xs text-gray-500">📊 Accuracy:</span>
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

      {/* Loading State */}
      {loading && (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mx-auto mb-3"></div>
          <p className="text-sm text-gray-500">Loading events...</p>
        </div>
      )}

      {/* No Gym Selected */}
      {selectedGyms.length === 0 && !loading && (
        <div className="text-center py-20 px-6 bg-white/60 backdrop-blur rounded-2xl border border-gray-200 shadow-inner">
          <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-purple-100 flex items-center justify-center text-2xl">📋</div>
          <h3 className="text-lg font-semibold text-gray-800 mb-1">Select gyms to review</h3>
          <p className="text-sm text-gray-500 max-w-sm mx-auto">Choose one or more gyms above to load validation issues for review</p>
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

      {/* Event Error Cards - grouped by gym when multiple selected */}
      {selectedGyms.length > 0 && !loading && filteredEvents.length > 0 && (
        <div className="space-y-6">
          {selectedGyms.length > 1 ? (
            // Multiple gyms: group by gym with headers
            Object.keys(eventsByGym).sort().map(gymId => {
              const gymName = gyms?.find(g => g.id === gymId)?.name || gymId;
              const gymEvents = eventsByGym[gymId];
              return (
                <div key={gymId}>
                  <div className="flex items-center gap-2 mb-3 pb-2 border-b-2 border-purple-200">
                    <h3 className="font-bold text-purple-800 text-lg">{gymName}</h3>
                    <span className="text-xs bg-purple-100 text-purple-600 px-2 py-0.5 rounded-full font-medium">
                      {gymEvents.length} event{gymEvents.length !== 1 ? 's' : ''}
                    </span>
                  </div>
                  <div className="space-y-3">
                    {gymEvents.map(event => (
                      <AdminAuditErrorCard
                        key={event.id}
                        event={event}
                        acknowledgedPatterns={acknowledgedPatterns}
                        onDismissError={handleDismissError}
                        onVerifyError={handleVerifyError}
                        onUndoDismiss={handleUndoDismiss}
                        onUndoPattern={handleUndoPattern}
                        dismissingError={dismissingError}
                        statusFilter={statusFilter}
                        selectedCategory={selectedCategory}
                      />
                    ))}
                  </div>
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
                  acknowledgedPatterns={acknowledgedPatterns}
                  onDismissError={handleDismissError}
                  onVerifyError={handleVerifyError}
                  onUndoDismiss={handleUndoDismiss}
                  onUndoPattern={handleUndoPattern}
                  dismissingError={dismissingError}
                  statusFilter={statusFilter}
                  selectedCategory={selectedCategory}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Help text */}
      {selectedGyms.length > 0 && !loading && filteredEvents.length > 0 && (
        <div className="text-center py-2 text-xs text-gray-500">
          💡 <span className="text-green-600">✓</span> = verified accurate (real error) | <span className="text-red-600">✗</span> = bug (needs code fix) | "✓ OK" = temp override | "+ Rule" = permanent rule
        </div>
      )}

      {/* DismissRuleModal */}
      {dismissModalState && (
        <DismissRuleModal
          errorMessage={dismissModalState.errorMessage}
          gymId={dismissModalState.gymId}
          eventType={dismissModalState.event?.type}
          ruleEligible={dismissModalState.ruleEligible}
          ruleInfo={dismissModalState.ruleInfo}
          scopeOptions="both"
          onDismiss={handleAcceptException}
          onDismissAndRule={handleDismissAndRule}
          onCancel={() => setDismissModalState(null)}
        />
      )}
    </div>
  );
}
