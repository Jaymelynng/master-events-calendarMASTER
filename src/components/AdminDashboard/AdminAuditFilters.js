import React from 'react';
import { getErrorLabel } from '../../lib/validationHelpers';

export default function AdminAuditFilters({
  gyms,
  selectedGyms,
  onGymsChange,
  selectedMonth,
  onMonthChange,
  selectedCategory,
  onCategoryChange,
  selectedProgramType,
  onProgramTypeChange,
  statusFilter,
  onStatusFilterChange,
  counts,
  groupBy,
  onGroupByChange,
  selectedErrorType,
  onErrorTypeChange,
  errorTypeCounts = {},
}) {
  // Generate month options: current month ± 6 months
  const monthOptions = [];
  const now = new Date();
  for (let i = -3; i <= 6; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const label = d.toLocaleString('default', { month: 'long', year: 'numeric' });
    monthOptions.push({ value, label });
  }

  const gymList = (gyms || []).map(g => ({ id: g.id, name: g.name })).sort((a, b) => a.name.localeCompare(b.name));

  const allSelected = gymList.length > 0 && selectedGyms.length === gymList.length;

  const toggleGym = (gymId) => {
    if (selectedGyms.includes(gymId)) {
      onGymsChange(selectedGyms.filter(id => id !== gymId));
    } else {
      onGymsChange([...selectedGyms, gymId]);
    }
  };

  const toggleAll = () => {
    if (allSelected) {
      onGymsChange([]);
    } else {
      onGymsChange(gymList.map(g => g.id));
    }
  };

  const formatTotal = (counts.format || 0) + (counts.desc || 0);
  const categoryButtons = [
    { value: 'all', label: 'ALL', color: 'bg-gray-600', activeColor: 'bg-gray-700' },
    { value: 'data_error', label: `DATA${counts.data ? ` (${counts.data})` : ''}`, color: 'bg-red-500', activeColor: 'bg-red-600' },
    { value: 'formatting', label: `FORMAT${formatTotal ? ` (${formatTotal})` : ''}`, color: 'bg-orange-500', activeColor: 'bg-orange-600' },
  ];

  // Build error type pills from counts (only types that have errors)
  const totalErrorCount = Object.values(errorTypeCounts).reduce((sum, n) => sum + n, 0);
  const errorTypeButtons = Object.entries(errorTypeCounts)
    .sort(([, a], [, b]) => b - a) // Sort by count descending
    .map(([type, count]) => ({
      value: type,
      label: getErrorLabel(type).replace(/^[^\w]*/, ''), // Remove leading emoji
      count,
    }));

  // Status pill buttons (replace dropdown)
  const statusButtons = [
    { value: 'active', label: 'Needs Review', icon: '!' },
    { value: 'verified', label: 'Confirmed', icon: '✓' },
    { value: 'bugs', label: 'Bugs', icon: '✗' },
    { value: 'resolved', label: 'Dismissed', icon: '✓' },
    { value: 'all', label: 'All', icon: '' },
  ];

  return (
    <div className="bg-white rounded-xl border-2 border-gray-200 p-4 space-y-3">
      {/* Gym Checkboxes - always visible */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide">Gyms</label>
          <span className="text-xs text-gray-400">{selectedGyms.length} of {gymList.length} selected</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-1">
          {/* All Gyms checkbox */}
          <label className={`flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-colors ${
            allSelected ? 'bg-purple-100 border border-purple-300' : 'bg-gray-50 border border-transparent hover:bg-gray-100'
          }`}>
            <input
              type="checkbox"
              checked={allSelected}
              onChange={toggleAll}
              className="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
            />
            <span className={`text-sm font-semibold ${allSelected ? 'text-purple-700' : 'text-gray-600'}`}>All Gyms</span>
          </label>
          {gymList.map(g => {
            const isSelected = selectedGyms.includes(g.id);
            return (
              <label key={g.id} className={`flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-colors ${
                isSelected ? 'bg-purple-50 border border-purple-200' : 'bg-gray-50 border border-transparent hover:bg-gray-100'
              }`}>
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => toggleGym(g.id)}
                  className="rounded border-gray-300 text-purple-600 focus:ring-purple-500 flex-shrink-0"
                />
                <span className={`text-sm truncate ${isSelected ? 'text-gray-900 font-medium' : 'text-gray-500'}`}>{g.name}</span>
              </label>
            );
          })}
        </div>
      </div>

      {/* Filters Row - Month + Program dropdowns */}
      <div className="flex flex-wrap gap-3 items-end pt-1 border-t border-gray-100">
        {/* Month Filter */}
        <div className="min-w-[180px]">
          <label className="block text-xs font-semibold text-gray-600 mb-1">Month</label>
          <select
            value={selectedMonth}
            onChange={(e) => onMonthChange(e.target.value)}
            className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg text-sm focus:border-purple-400 focus:outline-none"
          >
            <option value="all">All Months</option>
            {monthOptions.map(m => (
              <option key={m.value} value={m.value}>{m.label}</option>
            ))}
          </select>
        </div>

        {/* Program Type Filter */}
        <div className="min-w-[150px]">
          <label className="block text-xs font-semibold text-gray-600 mb-1">Program</label>
          <select
            value={selectedProgramType}
            onChange={(e) => onProgramTypeChange(e.target.value)}
            className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg text-sm focus:border-purple-400 focus:outline-none"
          >
            <option value="all">All Programs</option>
            <option value="CAMP">CAMP</option>
            <option value="CLINIC">CLINIC</option>
            <option value="OPEN GYM">OPEN GYM</option>
            <option value="KIDS NIGHT OUT">KIDS NIGHT OUT</option>
            <option value="SPECIAL EVENT">SPECIAL EVENT</option>
          </select>
        </div>
      </div>

      {/* Status Pills */}
      {selectedGyms.length > 0 && (
        <div className="pt-1 border-t border-gray-100">
          <label className="block text-xs font-semibold text-gray-600 mb-1.5">Status</label>
          <div className="flex flex-wrap gap-1.5">
            {statusButtons.map(btn => (
              <button
                key={btn.value}
                onClick={() => onStatusFilterChange(btn.value)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  statusFilter === btn.value
                    ? 'bg-purple-600 text-white ring-2 ring-offset-1 ring-purple-300 scale-105'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {btn.icon && <span className="mr-1">{btn.icon}</span>}
                {btn.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Group By Toggle + Category Buttons */}
      {selectedGyms.length > 0 && (
        <div className="flex flex-wrap items-center gap-4 pt-1 border-t border-gray-100">
          {/* Group By Toggle */}
          <div className="flex items-center gap-2">
            <label className="text-xs font-semibold text-gray-600">Group by:</label>
            <div className="flex rounded-lg overflow-hidden border border-gray-300">
              <button
                onClick={() => onGroupByChange('gym')}
                className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                  groupBy === 'gym'
                    ? 'bg-purple-600 text-white'
                    : 'bg-white text-gray-600 hover:bg-gray-50'
                }`}
              >
                By Gym
              </button>
              <button
                onClick={() => onGroupByChange('error_type')}
                className={`px-3 py-1.5 text-xs font-medium transition-colors border-l border-gray-300 ${
                  groupBy === 'error_type'
                    ? 'bg-purple-600 text-white'
                    : 'bg-white text-gray-600 hover:bg-gray-50'
                }`}
              >
                By Error Type
              </button>
            </div>
          </div>

          {/* Category Toggle Buttons */}
          <div className="flex gap-2">
            {categoryButtons.map(btn => (
              <button
                key={btn.value}
                onClick={() => onCategoryChange(btn.value)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold text-white transition-all ${
                  selectedCategory === btn.value
                    ? `${btn.activeColor} ring-2 ring-offset-1 ring-gray-400 scale-105`
                    : `${btn.color} opacity-60 hover:opacity-80`
                }`}
              >
                {btn.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Error Type Filter Pills */}
      {selectedGyms.length > 0 && errorTypeButtons.length > 0 && (
        <div className="pt-1 border-t border-gray-100">
          <label className="block text-xs font-semibold text-gray-600 mb-1.5">Error Type</label>
          <div className="flex flex-wrap gap-1.5">
            {/* All button */}
            <button
              onClick={() => onErrorTypeChange('all')}
              className={`px-2.5 py-1 rounded-full text-xs font-medium transition-all ${
                selectedErrorType === 'all'
                  ? 'bg-gray-700 text-white ring-2 ring-offset-1 ring-gray-400 scale-105'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              All ({totalErrorCount})
            </button>
            {errorTypeButtons.map(btn => (
              <button
                key={btn.value}
                onClick={() => onErrorTypeChange(selectedErrorType === btn.value ? 'all' : btn.value)}
                className={`px-2.5 py-1 rounded-full text-xs font-medium transition-all ${
                  selectedErrorType === btn.value
                    ? 'bg-red-600 text-white ring-2 ring-offset-1 ring-red-300 scale-105'
                    : 'bg-red-50 text-red-700 hover:bg-red-100'
                }`}
              >
                {btn.label} ({btn.count})
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
