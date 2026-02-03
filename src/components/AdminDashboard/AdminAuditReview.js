import React, { useState, useCallback, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { gymValidValuesApi } from '../../lib/api';
import { inferErrorCategory, isErrorAcknowledged, canAddAsRule, extractRuleValue } from '../../lib/validationHelpers';
import AdminAuditFilters from './AdminAuditFilters';
import AdminAuditErrorCard from './AdminAuditErrorCard';
import DismissRuleModal from '../EventsDashboard/DismissRuleModal';

export default function AdminAuditReview({ gyms }) {
  const [selectedGyms, setSelectedGyms] = useState([]);
  const [selectedMonth, setSelectedMonth] = useState('all');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedProgramType, setSelectedProgramType] = useState('all');
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [dismissModalState, setDismissModalState] = useState(null);
  const [dismissingError, setDismissingError] = useState(null);
  const [showDismissed, setShowDismissed] = useState(true);

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

  // Now apply category filter
  const filteredEvents = preFilteredEvents.filter(event => {
    if (selectedCategory === 'all') return true;

    const errors = (event.validation_errors || []).filter(err => err.type !== 'sold_out');
    const acknowledged = event.acknowledged_errors || [];

    if (selectedCategory === 'description') {
      return event.description_status === 'none' || event.description_status === 'flyer_only';
    }

    const hasActiveInCategory = errors.some(e =>
      inferErrorCategory(e) === selectedCategory &&
      !isErrorAcknowledged(acknowledged, e.message)
    );
    const hasDismissedInCategory = showDismissed && errors.some(e =>
      inferErrorCategory(e) === selectedCategory &&
      isErrorAcknowledged(acknowledged, e.message)
    );
    return hasActiveInCategory || hasDismissedInCategory;
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

    try {
      const isProgramSynonym = ruleInfo.ruleType === 'program_synonym';
      await gymValidValuesApi.create({
        gym_id: gymId,
        rule_type: ruleInfo.ruleType,
        value: isProgramSynonym ? ruleInfo.value.toLowerCase() : ruleInfo.value,
        label: label,
        event_type: isProgramSynonym ? label.toUpperCase() : 'CAMP'
      });

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
      alert('Dismissed OK, but failed to add rule. Add it manually in Gym Rules tab.');
    }

    setDismissingError(null);
    setDismissModalState(null);
  };

  const gymNames = selectedGyms.map(id => gyms?.find(g => g.id === id)?.name || id);

  return (
    <div className="space-y-4">
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
        counts={counts}
      />

      {/* Results Header */}
      {selectedGyms.length > 0 && !loading && (
        <div className="flex items-center justify-between">
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
                {counts.format > 0 && (
                  <span className="px-2 py-0.5 bg-orange-500 text-white text-xs font-bold rounded">{counts.format} FORMAT</span>
                )}
                {counts.desc > 0 && (
                  <span className="px-2 py-0.5 bg-gray-500 text-white text-xs font-bold rounded">{counts.desc} DESC</span>
                )}
              </div>
            )}
          </div>
          <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
            <input
              type="checkbox"
              checked={showDismissed}
              onChange={(e) => setShowDismissed(e.target.checked)}
              className="rounded"
            />
            Show resolved
          </label>
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
          <p className="text-sm text-gray-500">Choose one or more gyms from the dropdown above to see all validation issues</p>
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
                        onDismissError={handleDismissError}
                        dismissingError={dismissingError}
                        showDismissedErrors={showDismissed}
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
                  onDismissError={handleDismissError}
                  dismissingError={dismissingError}
                  showDismissedErrors={showDismissed}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Help text */}
      {selectedGyms.length > 0 && !loading && filteredEvents.length > 0 && (
        <div className="text-center py-2 text-xs text-gray-500">
          💡 "✓ OK" = dismiss once | "+ Rule" = teach the system for this gym
        </div>
      )}

      {/* DismissRuleModal */}
      {dismissModalState && (
        <DismissRuleModal
          isOpen={true}
          onClose={() => setDismissModalState(null)}
          errorMessage={dismissModalState.errorMessage}
          ruleEligible={dismissModalState.ruleEligible}
          ruleInfo={dismissModalState.ruleInfo}
          onAcceptException={handleAcceptException}
          onDismissAndRule={handleDismissAndRule}
        />
      )}
    </div>
  );
}
