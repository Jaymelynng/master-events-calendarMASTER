import React, { useState } from 'react';

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
  errorTypeFilter,
  onErrorTypeFilterChange,
  hidePrices,
  onHidePricesChange,
  counts,
}) {
  // Month options: 3 months back, 6 months forward from today (shifts automatically as time passes)
  // When opened from calendar, initialMonth is pre-selected to match the calendar view
  const monthOptions = [];
  const now = new Date();
  for (let i = -3; i <= 6; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const label = d.toLocaleString('default', { month: 'long', year: 'numeric' });
    monthOptions.push({ value, label });
  }

  const [showAdvanced, setShowAdvanced] = useState(false);
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

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-md p-5 space-y-4">
      {/* Gym Checkboxes - always visible */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider">Gyms</label>
          <span className="text-xs text-gray-400 tabular-nums">{selectedGyms.length} of {gymList.length} selected</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-1">
          {/* All Gyms checkbox */}
          <label className={`flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-colors border ${
            allSelected ? 'bg-purple-50 border-purple-200 text-purple-700' : 'bg-gray-50/80 border-gray-100 hover:bg-gray-100'
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
                isSelected ? 'bg-purple-50 border border-purple-200' : 'bg-gray-50/80 border border-gray-100 hover:bg-gray-100'
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

      {/* Filters Row — button groups, no dropdowns */}
      <div className="space-y-2 pt-1 border-t border-gray-100">
        <div>
          <span className="text-xs font-semibold text-gray-600">Month:</span>
          <div className="flex flex-wrap gap-1 mt-1">
            <button
              onClick={() => onMonthChange('all')}
              className={`px-2 py-1 rounded text-xs font-medium ${selectedMonth === 'all' ? 'bg-purple-600 text-white' : 'bg-gray-200 text-gray-600 hover:bg-gray-300'}`}
            >
              All
            </button>
            {monthOptions.map(m => (
              <button
                key={m.value}
                onClick={() => onMonthChange(m.value)}
                className={`px-2 py-1 rounded text-xs font-medium whitespace-nowrap ${selectedMonth === m.value ? 'bg-purple-600 text-white' : 'bg-gray-200 text-gray-600 hover:bg-gray-300'}`}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>
        <div>
          <span className="text-xs font-semibold text-gray-600">Program:</span>
          <div className="flex flex-wrap gap-1 mt-1">
            {[
              { value: 'all', label: 'All' },
              { value: 'CAMP', label: 'CAMP' },
              { value: 'CLINIC', label: 'CLINIC' },
              { value: 'OPEN GYM', label: 'OPEN GYM' },
              { value: 'KIDS NIGHT OUT', label: 'KNO' },
              { value: 'SPECIAL EVENT', label: 'Special' },
            ].map(opt => (
              <button
                key={opt.value}
                onClick={() => onProgramTypeChange(opt.value)}
                className={`px-2 py-1 rounded text-xs font-medium ${selectedProgramType === opt.value ? 'bg-indigo-600 text-white' : 'bg-gray-200 text-gray-600 hover:bg-gray-300'}`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
        {/* Advanced Filters Toggle */}
        <div>
          <button
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="text-xs text-gray-400 hover:text-gray-600 font-medium"
          >
            {showAdvanced ? '▾ Hide advanced filters' : '▸ More filters (status, error type...)'}
          </button>
        </div>
        {showAdvanced && (
          <>
            <div>
              <span className="text-xs font-semibold text-gray-600">Status:</span>
              <div className="flex flex-wrap gap-1 mt-1">
                {[
                  { value: 'active', label: 'Needs Review' },
                  { value: 'verified', label: 'Confirmed' },
                  { value: 'bugs', label: 'Bugs' },
                  { value: 'resolved', label: 'Dismissed' },
                  { value: 'all', label: 'All' },
                ].map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => onStatusFilterChange(opt.value)}
                    className={`px-2 py-1 rounded text-xs font-medium ${statusFilter === opt.value ? 'bg-amber-600 text-white' : 'bg-gray-200 text-gray-600 hover:bg-gray-300'}`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <span className="text-xs font-semibold text-gray-600">Error Type:</span>
              <div className="flex flex-wrap gap-1 mt-1 items-center">
                {[
                  { value: 'all', label: 'All' },
                  { value: 'price', label: 'Price' },
                  { value: 'time', label: 'Time' },
                  { value: 'age', label: 'Age' },
                  { value: 'date', label: 'Date' },
                  { value: 'program', label: 'Program' },
                  { value: 'format', label: 'Missing Info' },
                ].map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => onErrorTypeFilterChange(opt.value)}
                    className={`px-2 py-1 rounded text-xs font-medium ${errorTypeFilter === opt.value ? 'bg-teal-600 text-white' : 'bg-gray-200 text-gray-600 hover:bg-gray-300'}`}
                  >
                    {opt.label}
                  </button>
                ))}
                <span className="mx-1 text-gray-300">|</span>
                <button
                  onClick={() => onHidePricesChange(!hidePrices)}
                  className={`px-2 py-1 rounded text-xs font-medium border ${
                    hidePrices
                      ? 'bg-red-100 border-red-300 text-red-700'
                      : 'bg-gray-100 border-gray-200 text-gray-500 hover:bg-gray-200'
                  }`}
                >
                  {hidePrices ? 'Prices Hidden' : 'Hide Prices'}
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Category Toggle Buttons */}
      {selectedGyms.length > 0 && (
        <div className="flex gap-2 pt-1">
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
      )}
    </div>
  );
}
