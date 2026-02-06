// ============================================================================
// EVENTS DASHBOARD - Main component that assembles all dashboard pieces
// ============================================================================
// This file was refactored from 4,148 lines to ~350 lines!
// All logic is now in useEventsDashboard.js
// All UI components are in their own files in the EventsDashboard folder
// ============================================================================

import React, { Suspense, lazy } from 'react';
import { CheckCircle, ChevronUp, Plus, Loader } from 'lucide-react';

// Custom hook with all state and logic
import useEventsDashboard from './EventsDashboard/useEventsDashboard';

// Constants and utilities
import { theme } from './EventsDashboard/constants';

// Components
import DashboardHeader, { ActionButtons } from './EventsDashboard/DashboardHeader';
import BulkPortalOpener from './EventsDashboard/BulkPortalOpener';
import MonthlyRequirementsTable from './EventsDashboard/MonthlyRequirementsTable';
import CalendarControls, { CalendarViewToggle, CalendarLegend } from './EventsDashboard/CalendarControls';
import CalendarGrid from './EventsDashboard/CalendarGrid';
import TableView from './EventsDashboard/TableView';
import EventDetailPanel from './EventsDashboard/EventDetailPanel';

// Lazy-loaded modals (only load when needed)
const AddEventModal = lazy(() => import('./EventsDashboard/AddEventModal'));
const BulkImportModal = lazy(() => import('./EventsDashboard/BulkImportModal'));
const SyncModal = lazy(() => import('./EventsDashboard/SyncModal'));
const ExportModal = lazy(() => import('./EventsDashboard/ExportModal'));
const DismissRuleModal = lazy(() => import('./EventsDashboard/DismissRuleModal'));
const AdminDashboard = lazy(() => import('./AdminDashboard/AdminDashboard'));

// Loading fallback for lazy components
const ModalLoader = () => (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
    <div className="bg-white rounded-lg p-6">
      <Loader className="w-8 h-8 animate-spin text-gray-500" />
    </div>
  </div>
);

// ============================================================================
// MAIN COMPONENT
// ============================================================================

const EventsDashboard = () => {
  // Get all state and functions from our custom hook
  const dashboard = useEventsDashboard();

  // Destructure for cleaner JSX
  const {
    // Data
    events, gymsList, eventTypes, monthlyRequirements, gymLinks,
    // Loading
    loading,
    // View state
    currentMonth, currentYear, calendarView, viewMode, displayDates,
    setCalendarView, setViewMode,
    // Filters
    selectedGym, setSelectedGym, selectedEventType, setSelectedEventType,
    searchTerm, setSearchTerm,
    // Computed
    allGyms, allGymsFromList, uniqueGymsWithEvents, eventTypesFromEvents, filteredEvents,
    // Modals
    showAddEventModal, setShowAddEventModal,
    showBulkImportModal, setShowBulkImportModal,
    showSyncModal, setShowSyncModal,
    showExportModal, setShowExportModal,
    showAdminPortal, setShowAdminPortal,
    showAuditHistory, setShowAuditHistory,
    dismissModalState, setDismissModalState,
    // Event editing
    editingEvent, setEditingEvent, newEvent, setNewEvent,
    // Bulk import
    rawEventListings, setRawEventListings, selectedGymId, setSelectedGymId,
    validationResults, setValidationResults, importTiming, setImportTiming,
    bulkImportData, setBulkImportData,
    // Panel
    selectedEventForPanel, setSelectedEventForPanel, copiedUrl, setCopiedUrl,
    // Audit
    auditHistory, loadingAudit, loadAuditHistory,
    // UI feedback
    copySuccess, showBackToTop, showToast, toastMessage,
    // Refs
    topRef, calendarRef, gymRefs,
    // Functions
    getEventCounts, getMissingEventTypes, getGymLinkUrl, isMatchedByRule,
    goToPreviousMonth, goToNextMonth, handleCalendarViewChange, scrollToGym, scrollToTop,
    getAllUrlsForEventType, openMultipleTabs, handleMagicControlClick,
    handleAddEvent, handleEditEvent, handleDeleteEvent,
    acknowledgeValidationError, resetAcknowledgedErrors,
  } = dashboard;

  // Show loading state
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: theme.colors.background }}>
        <div className="text-center">
          <Loader className="w-12 h-12 animate-spin text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600">Loading events...</p>
        </div>
      </div>
    );
  }

  // Full-page Admin Dashboard - replaces calendar view when active
  if (showAdminPortal) {
    return (
      <Suspense fallback={<ModalLoader />}>
        <AdminDashboard
          gyms={gymsList}
          onClose={() => setShowAdminPortal(false)}
          onOpenSyncModal={() => {
            setShowAdminPortal(false);
            setTimeout(() => setShowSyncModal(true), 100);
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
    );
  }

  return (
    <div className="min-h-screen pb-16" style={{ backgroundColor: theme.colors.background }}>

      {/* Copy Success Notification */}
      {copySuccess && (
        <div className="fixed top-4 right-4 z-50 bg-green-500 text-white px-4 py-2 rounded-lg shadow-lg flex items-center gap-2">
          <CheckCircle className="w-4 h-4" />
          {copySuccess}
        </div>
      )}

      {/* ==================== MODALS ==================== */}

      {showAddEventModal && (
        <Suspense fallback={<ModalLoader />}>
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

      {showBulkImportModal && (
        <Suspense fallback={<ModalLoader />}>
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
            onClose={() => setShowBulkImportModal(false)}
            onReset={() => {
              setBulkImportData('');
              setRawEventListings('');
              setSelectedGymId('');
              setValidationResults(null);
              setImportTiming({ convertMs: null, importMs: null, totalMs: null });
            }}
          />
        </Suspense>
      )}

      {showSyncModal && (
        <Suspense fallback={<ModalLoader />}>
          <SyncModal
            theme={theme}
            onClose={() => setShowSyncModal(false)}
            onBack={() => {
              setShowSyncModal(false);
              setTimeout(() => setShowAdminPortal(true), 100);
            }}
            gyms={gymsList}
          />
        </Suspense>
      )}

      {showExportModal && (
        <Suspense fallback={<ModalLoader />}>
          <ExportModal
            onClose={() => setShowExportModal(false)}
            events={events}
            gyms={gymsList}
            monthlyRequirements={monthlyRequirements}
            currentMonth={currentMonth}
            currentYear={currentYear}
          />
        </Suspense>
      )}

      {dismissModalState && (
        <Suspense fallback={<ModalLoader />}>
          <DismissRuleModal
            errorMessage={dismissModalState.errorMessage}
            gymId={dismissModalState.gymId}
            ruleEligible={dismissModalState.ruleEligible}
            ruleInfo={dismissModalState.ruleInfo}
            onCancel={() => setDismissModalState(null)}
            onDismiss={async (note) => {
              await acknowledgeValidationError(dismissModalState.eventId, dismissModalState.errorMessage, note);
              setDismissModalState(null);
            }}
            onDismissAndRule={async (note, label) => {
              await acknowledgeValidationError(dismissModalState.eventId, dismissModalState.errorMessage, note, true);
              // The rule creation logic would go here - keeping it simple for now
              setDismissModalState(null);
            }}
          />
        </Suspense>
      )}

      {/* Audit History Modal */}
      {showAuditHistory && (
        <AuditHistoryModal
          auditHistory={auditHistory}
          loadingAudit={loadingAudit}
          onClose={() => setShowAuditHistory(false)}
        />
      )}

      {/* ==================== MAIN CONTENT ==================== */}

      <div ref={topRef} className="relative z-10 w-full">
        <div className="w-full">

          {/* Dashboard Header */}
          <DashboardHeader
            currentMonth={currentMonth}
            currentYear={currentYear}
            onPreviousMonth={goToPreviousMonth}
            onNextMonth={goToNextMonth}
            events={events}
            uniqueGymsWithEvents={uniqueGymsWithEvents}
            allGyms={allGyms}
            getMissingEventTypes={getMissingEventTypes}
            setViewMode={setViewMode}
            setSelectedGym={setSelectedGym}
            setSelectedEventType={setSelectedEventType}
            setCalendarView={setCalendarView}
            loadAuditHistory={loadAuditHistory}
            setShowAuditHistory={setShowAuditHistory}
          />

          {/* Action Buttons (Sync & Export) */}
          <ActionButtons
            onOpenAdminPortal={() => setShowAdminPortal(true)}
            onOpenExportModal={() => setShowExportModal(true)}
          />

          {/* Bulk Portal Opener */}
          <BulkPortalOpener
            getAllUrlsForEventType={getAllUrlsForEventType}
            openMultipleTabs={openMultipleTabs}
          />

          {/* Monthly Requirements Table */}
          <MonthlyRequirementsTable
            currentMonth={currentMonth}
            currentYear={currentYear}
            onPreviousMonth={goToPreviousMonth}
            onNextMonth={goToNextMonth}
            allGyms={allGyms}
            events={events}
            eventTypes={eventTypes}
            monthlyRequirements={monthlyRequirements}
            gymLinks={gymLinks}
            scrollToGym={scrollToGym}
            getGymLinkUrl={getGymLinkUrl}
            handleMagicControlClick={handleMagicControlClick}
            getEventCounts={getEventCounts}
          />

          {/* Calendar Controls */}
          <CalendarControls
            currentMonth={currentMonth}
            currentYear={currentYear}
            onPreviousMonth={goToPreviousMonth}
            onNextMonth={goToNextMonth}
            calendarView={calendarView}
            onCalendarViewChange={handleCalendarViewChange}
            viewMode={viewMode}
            onViewModeToggle={() => setViewMode(viewMode === 'calendar' ? 'table' : 'calendar')}
            selectedGym={selectedGym}
            onGymChange={setSelectedGym}
            selectedEventType={selectedEventType}
            onEventTypeChange={setSelectedEventType}
            searchTerm={searchTerm}
            onSearchChange={setSearchTerm}
            gymsList={gymsList}
            eventTypesFromEvents={eventTypesFromEvents}
            onAddEvent={() => setShowAddEventModal(true)}
          />

          {/* Table View */}
          {viewMode === 'table' && (
            <TableView filteredEvents={filteredEvents} />
          )}

          {/* Calendar View */}
          {viewMode === 'calendar' && (
            <div className="space-y-2">
              {/* Secret Admin Access Button */}
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

              {/* Calendar View Toggle */}
              <CalendarViewToggle
                calendarView={calendarView}
                onCalendarViewChange={handleCalendarViewChange}
                theme={theme}
              />

              {/* Calendar Legend */}
              <CalendarLegend theme={theme} />

              {/* Calendar Grid */}
              <CalendarGrid
                displayDates={displayDates}
                allGymsFromList={allGymsFromList}
                gymsList={gymsList}
                filteredEvents={filteredEvents}
                eventTypes={eventTypes}
                currentMonth={currentMonth}
                currentYear={currentYear}
                calendarRef={calendarRef}
                gymRefs={gymRefs}
                selectedEventForPanel={selectedEventForPanel}
                onEventSelect={setSelectedEventForPanel}
              />

              {/* Bottom Navigation & Add Event */}
              <BottomNavigation
                currentMonth={currentMonth}
                currentYear={currentYear}
                onPreviousMonth={goToPreviousMonth}
                onNextMonth={goToNextMonth}
                onAddEvent={() => setShowAddEventModal(true)}
              />

              {/* Event Detail Panel */}
              {selectedEventForPanel && (
                <EventDetailPanel
                  event={selectedEventForPanel}
                  gymsList={gymsList}
                  gymLinks={gymLinks}
                  copiedUrl={copiedUrl}
                  onClose={() => setSelectedEventForPanel(null)}
                  onCopyUrl={setCopiedUrl}
                  onEditEvent={handleEditEvent}
                  onDismissError={setDismissModalState}
                  onResetAcknowledgedErrors={resetAcknowledgedErrors}
                  isMatchedByRule={isMatchedByRule}
                />
              )}
            </div>
          )}
        </div>
      </div>

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

      {/* Toast Notification */}
      {showToast && (
        <div
          className="fixed top-20 left-1/2 transform -translate-x-1/2 z-50 px-6 py-3 rounded-lg shadow-xl backdrop-blur-sm"
          style={{
            backgroundColor: 'rgba(255, 255, 255, 0.95)',
            border: `2px solid ${theme.colors.primary}`,
          }}
        >
          <div className="flex items-center gap-2 text-sm font-medium" style={{ color: theme.colors.textPrimary }}>
            {toastMessage}
          </div>
        </div>
      )}
    </div>
  );
};

// ============================================================================
// HELPER COMPONENTS
// ============================================================================

// Bottom navigation component
function BottomNavigation({ currentMonth, currentYear, onPreviousMonth, onNextMonth, onAddEvent }) {
  return (
    <>
      <div className="flex justify-center items-center gap-4 mb-4 mt-6">
        <button
          onClick={onPreviousMonth}
          className="flex items-center gap-1 px-3 py-1 rounded-full text-white transition-all duration-200 hover:scale-105 hover:shadow-md text-sm"
          style={{ backgroundColor: theme.colors.primary }}
        >
          Previous
        </button>
        <div className="text-base font-bold" style={{ color: theme.colors.textPrimary }}>
          {new Date(currentYear, currentMonth).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
        </div>
        <button
          onClick={onNextMonth}
          className="flex items-center gap-1 px-3 py-1 rounded-full text-white transition-all duration-200 hover:scale-105 hover:shadow-md text-sm"
          style={{ backgroundColor: theme.colors.primary }}
        >
          Next
        </button>
      </div>

      <div className="flex justify-center mb-6">
        <button
          onClick={onAddEvent}
          className="flex items-center gap-2 px-4 py-2 rounded-lg transition-all duration-200 hover:scale-105 shadow-md font-medium text-sm"
          style={{ backgroundColor: theme.colors.primary, color: 'white' }}
        >
          <Plus className="w-4 h-4" />
          ADD EVENT
        </button>
      </div>
    </>
  );
}

// Audit History Modal component
function AuditHistoryModal({ auditHistory, loadingAudit, onClose }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-4xl mx-4 max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-bold text-gray-800">🔍 Event Change History</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700 text-xl">✕</button>
        </div>

        {loadingAudit ? (
          <div className="flex items-center justify-center py-12">
            <Loader className="w-8 h-8 animate-spin text-gray-500" />
          </div>
        ) : auditHistory.length === 0 ? (
          <div className="text-center py-12 text-gray-500">No change history found</div>
        ) : (
          <div className="overflow-y-auto flex-1">
            {auditHistory.map((audit, idx) => (
              <div key={idx} className="mb-6 pb-6 border-b last:border-b-0">
                <div className="flex justify-between items-start mb-2">
                  <div className="text-sm text-gray-500">
                    {new Date(audit.changed_at).toLocaleString()}
                  </div>
                  <span className={`px-2 py-1 rounded text-xs font-medium ${
                    audit.action === 'CREATE' ? 'bg-green-100 text-green-800' :
                    audit.action === 'UPDATE' ? 'bg-blue-100 text-blue-800' :
                    'bg-red-100 text-red-800'
                  }`}>
                    {audit.action}
                  </span>
                </div>
                <div className="font-medium text-gray-800 mb-1">{audit.event_title || 'Unknown Event'}</div>
                <div className="text-sm text-gray-600">{audit.gym_id} • {audit.event_date}</div>
              </div>
            ))}
          </div>
        )}

        <div className="mt-4 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

export default EventsDashboard;
