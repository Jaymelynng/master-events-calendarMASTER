import React, { useState, useEffect, useCallback } from 'react';
import { auditLogApi } from '../../lib/api';

const PAGE_SIZE = 50;

export default function AdminChangeHistory({ gyms }) {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(0);

  // Filters
  const [selectedGyms, setSelectedGyms] = useState([]);
  const [selectedActions, setSelectedActions] = useState([]);

  // Gym name lookup
  const gymNameMap = {};
  (gyms || []).forEach(g => { gymNameMap[g.id] = g.name; });

  const loadEntries = useCallback(async () => {
    setLoading(true);
    try {
      const { data, count } = await auditLogApi.getFiltered({
        gymIds: selectedGyms,
        actions: selectedActions,
        limit: PAGE_SIZE,
        offset: page * PAGE_SIZE,
      });
      setEntries(data);
      setTotalCount(count);
    } catch (err) {
      console.error('Error loading change history:', err);
    } finally {
      setLoading(false);
    }
  }, [selectedGyms, selectedActions, page]);

  useEffect(() => {
    loadEntries();
  }, [loadEntries]);

  // Reset page when filters change
  const handleFilterChange = useCallback(() => {
    setPage(0);
  }, []);

  const toggleGym = (gymId) => {
    setSelectedGyms(prev =>
      prev.includes(gymId) ? prev.filter(g => g !== gymId) : [...prev, gymId]
    );
    handleFilterChange();
  };

  const toggleAction = (action) => {
    setSelectedActions(prev =>
      prev.includes(action) ? prev.filter(a => a !== action) : [...prev, action]
    );
    handleFilterChange();
  };

  const clearFilters = () => {
    setSelectedGyms([]);
    setSelectedActions([]);
    setPage(0);
  };

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);
  const showingFrom = totalCount === 0 ? 0 : page * PAGE_SIZE + 1;
  const showingTo = Math.min((page + 1) * PAGE_SIZE, totalCount);

  // CSV Export
  const handleExportCSV = async () => {
    try {
      // Fetch ALL filtered results (not just current page)
      const { data } = await auditLogApi.getFiltered({
        gymIds: selectedGyms,
        actions: selectedActions,
        limit: 5000,
        offset: 0,
      });
      if (!data || data.length === 0) return;

      const headers = ['Date/Time', 'Action', 'Event Title', 'Gym', 'Gym Name', 'Event Date', 'Field Changed', 'Old Value', 'New Value', 'Changed By'];
      const rows = data.map(audit => [
        new Date(audit.changed_at).toLocaleString(),
        audit.action,
        audit.event_title || '',
        audit.gym_id || '',
        gymNameMap[audit.gym_id] || audit.gym_id || '',
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
    } catch (err) {
      console.error('Error exporting CSV:', err);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
          📜 Event Change History
          <span className="text-sm font-normal text-gray-500">
            ({totalCount.toLocaleString()} total entries)
          </span>
        </h2>
        <button
          onClick={handleExportCSV}
          disabled={totalCount === 0}
          className="px-3 py-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-medium flex items-center gap-1 disabled:opacity-50"
        >
          📥 Download CSV
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border-2 border-gray-200 p-4 space-y-3">
        {/* Gym Filter */}
        <div>
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5 block">
            Filter by Gym
          </label>
          <div className="flex flex-wrap gap-1.5">
            {(gyms || []).map(gym => (
              <button
                key={gym.id}
                onClick={() => toggleGym(gym.id)}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all border ${
                  selectedGyms.includes(gym.id)
                    ? 'bg-purple-600 text-white border-purple-600'
                    : 'bg-white text-gray-600 border-gray-300 hover:border-purple-400 hover:text-purple-600'
                }`}
              >
                {gym.id}
              </button>
            ))}
          </div>
        </div>

        {/* Action Filter */}
        <div className="flex items-center gap-4">
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
            Action Type
          </label>
          <div className="flex gap-2">
            {[
              { id: 'CREATE', label: '+ Created', color: 'green' },
              { id: 'UPDATE', label: '~ Updated', color: 'blue' },
              { id: 'DELETE', label: '- Deleted', color: 'red' },
            ].map(action => (
              <button
                key={action.id}
                onClick={() => toggleAction(action.id)}
                className={`px-3 py-1 rounded-lg text-xs font-medium transition-all border ${
                  selectedActions.includes(action.id)
                    ? action.color === 'green' ? 'bg-green-600 text-white border-green-600'
                    : action.color === 'blue' ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-red-600 text-white border-red-600'
                    : 'bg-white text-gray-600 border-gray-300 hover:border-gray-400'
                }`}
              >
                {action.label}
              </button>
            ))}
          </div>
          {(selectedGyms.length > 0 || selectedActions.length > 0) && (
            <button
              onClick={clearFilters}
              className="text-xs text-purple-600 hover:text-purple-800 underline ml-2"
            >
              Clear all filters
            </button>
          )}
        </div>
      </div>

      {/* Results */}
      <div className="bg-white rounded-xl border-2 border-gray-200 overflow-hidden">
        {/* Results header */}
        <div className="px-4 py-2 bg-gray-50 border-b text-sm text-gray-600 flex justify-between items-center">
          <span>
            {totalCount === 0 ? 'No entries found' : `Showing ${showingFrom}-${showingTo} of ${totalCount.toLocaleString()}`}
          </span>
          {totalPages > 1 && (
            <span className="text-xs text-gray-500">Page {page + 1} of {totalPages}</span>
          )}
        </div>

        {/* Loading */}
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
          </div>
        ) : entries.length === 0 ? (
          <div className="text-center py-16 text-gray-500">
            No change history found
            {(selectedGyms.length > 0 || selectedActions.length > 0) && (
              <div className="text-sm mt-1">Try adjusting your filters</div>
            )}
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {entries.map((audit, idx) => (
              <div key={audit.id || idx} className="px-4 py-3 hover:bg-gray-50 transition-colors">
                <div className="flex justify-between items-start mb-1">
                  <div className="text-xs text-gray-400">
                    {new Date(audit.changed_at).toLocaleString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </div>
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                    audit.action === 'CREATE' ? 'bg-green-100 text-green-800' :
                    audit.action === 'UPDATE' ? 'bg-blue-100 text-blue-800' :
                    'bg-red-100 text-red-800'
                  }`}>
                    {audit.action}
                  </span>
                </div>

                <div className="font-medium text-gray-800 text-sm">
                  {audit.event_title || 'Unknown Event'}
                </div>

                <div className="text-xs text-gray-500 mt-0.5">
                  <span className="font-medium text-purple-700">{audit.gym_id}</span>
                  {gymNameMap[audit.gym_id] && (
                    <span className="text-gray-400"> ({gymNameMap[audit.gym_id]})</span>
                  )}
                  {audit.event_date && <span> • {audit.event_date}</span>}
                </div>

                {audit.field_changed && audit.field_changed !== 'all' && (
                  <div className="mt-1.5 text-sm bg-gray-50 rounded px-2 py-1 inline-block">
                    <span className="font-medium text-gray-600">{audit.field_changed}:</span>{' '}
                    <span className="text-red-600 line-through">{audit.old_value}</span>
                    {' → '}
                    <span className="text-green-600 font-medium">{audit.new_value}</span>
                  </div>
                )}

                {audit.action === 'CREATE' && audit.field_changed === 'all' && audit.new_value && (
                  <div className="mt-1.5 text-xs text-green-700 bg-green-50 rounded px-2 py-1 inline-block">
                    New event added
                  </div>
                )}

                {audit.action === 'DELETE' && (
                  <div className="mt-1.5 text-xs text-red-600 bg-red-50 rounded px-2 py-1 inline-block">
                    Event removed from system
                  </div>
                )}

                <div className="text-xs text-gray-400 mt-1">
                  by {audit.changed_by}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-4 py-3 bg-gray-50 border-t flex items-center justify-between">
            <button
              onClick={() => setPage(p => Math.max(0, p - 1))}
              disabled={page === 0}
              className="px-3 py-1.5 bg-white border border-gray-300 rounded-lg text-sm hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              ← Previous
            </button>
            <div className="flex gap-1">
              {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                // Show first pages, current area, and last page
                let pageNum;
                if (totalPages <= 7) {
                  pageNum = i;
                } else if (page < 3) {
                  pageNum = i < 5 ? i : i === 5 ? totalPages - 2 : totalPages - 1;
                } else if (page > totalPages - 4) {
                  pageNum = i < 2 ? i : totalPages - 5 + i;
                } else {
                  pageNum = i < 1 ? 0 : i === 1 ? page - 1 : i === 2 ? page : i === 3 ? page + 1 : i === 4 ? page + 2 : i === 5 ? totalPages - 2 : totalPages - 1;
                }
                return (
                  <button
                    key={pageNum}
                    onClick={() => setPage(pageNum)}
                    className={`w-8 h-8 rounded text-xs font-medium ${
                      page === pageNum
                        ? 'bg-purple-600 text-white'
                        : 'bg-white border border-gray-300 text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    {pageNum + 1}
                  </button>
                );
              })}
            </div>
            <button
              onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
              className="px-3 py-1.5 bg-white border border-gray-300 rounded-lg text-sm hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Next →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
