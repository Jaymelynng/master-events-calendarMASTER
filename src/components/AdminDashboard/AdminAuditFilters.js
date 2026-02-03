import React, { useState, useRef, useEffect } from 'react';

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
  counts,
}) {
  const [gymDropdownOpen, setGymDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setGymDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

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

  const toggleGym = (gymId) => {
    if (selectedGyms.includes(gymId)) {
      onGymsChange(selectedGyms.filter(id => id !== gymId));
    } else {
      onGymsChange([...selectedGyms, gymId]);
    }
  };

  const selectAll = () => {
    onGymsChange(gymList.map(g => g.id));
  };

  const clearAll = () => {
    onGymsChange([]);
  };

  const categoryButtons = [
    { value: 'all', label: 'ALL', color: 'bg-gray-600', activeColor: 'bg-gray-700' },
    { value: 'data_error', label: `DATA${counts.data ? ` (${counts.data})` : ''}`, color: 'bg-red-500', activeColor: 'bg-red-600' },
    { value: 'formatting', label: `FORMAT${counts.format ? ` (${counts.format})` : ''}`, color: 'bg-orange-500', activeColor: 'bg-orange-600' },
    { value: 'description', label: `DESC${counts.desc ? ` (${counts.desc})` : ''}`, color: 'bg-gray-500', activeColor: 'bg-gray-600' },
  ];

  // Display text for gym selector
  const gymDisplayText = selectedGyms.length === 0
    ? 'Select gyms to review...'
    : selectedGyms.length === gymList.length
      ? `All Gyms (${gymList.length})`
      : selectedGyms.length === 1
        ? gymList.find(g => g.id === selectedGyms[0])?.name || selectedGyms[0]
        : `${selectedGyms.length} gyms selected`;

  return (
    <div className="bg-white rounded-xl border-2 border-gray-200 p-4 space-y-3">
      <div className="flex flex-wrap gap-3 items-end">
        {/* Multi-Select Gym Picker */}
        <div className="flex-1 min-w-[280px] relative" ref={dropdownRef}>
          <label className="block text-xs font-semibold text-gray-600 mb-1">Gyms</label>
          <button
            onClick={() => setGymDropdownOpen(!gymDropdownOpen)}
            className="w-full px-3 py-2.5 border-2 border-gray-200 rounded-lg text-sm font-medium text-left focus:border-purple-400 focus:outline-none bg-white flex items-center justify-between"
          >
            <span className={selectedGyms.length === 0 ? 'text-gray-400' : 'text-gray-800'}>
              {gymDisplayText}
            </span>
            <span className="text-gray-400">{gymDropdownOpen ? '▲' : '▼'}</span>
          </button>

          {gymDropdownOpen && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-white border-2 border-purple-300 rounded-lg shadow-xl z-50 max-h-72 overflow-hidden">
              {/* Select All / Clear buttons */}
              <div className="flex gap-2 px-3 py-2 bg-gray-50 border-b border-gray-200 sticky top-0">
                <button
                  onClick={selectAll}
                  className="px-2.5 py-1 text-xs bg-purple-100 hover:bg-purple-200 text-purple-700 rounded-md font-medium transition-colors"
                >
                  Select All
                </button>
                <button
                  onClick={clearAll}
                  className="px-2.5 py-1 text-xs bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-md font-medium transition-colors"
                >
                  Clear
                </button>
                <span className="text-xs text-gray-400 ml-auto self-center">
                  {selectedGyms.length}/{gymList.length} selected
                </span>
              </div>
              {/* Gym list */}
              <div className="max-h-56 overflow-y-auto">
                {gymList.map(g => (
                  <label
                    key={g.id}
                    className="flex items-center gap-3 px-3 py-2 hover:bg-purple-50 cursor-pointer transition-colors"
                  >
                    <input
                      type="checkbox"
                      checked={selectedGyms.includes(g.id)}
                      onChange={() => toggleGym(g.id)}
                      className="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                    />
                    <span className="text-sm text-gray-800">{g.name}</span>
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Month Filter */}
        <div className="min-w-[180px]">
          <label className="block text-xs font-semibold text-gray-600 mb-1">Month</label>
          <select
            value={selectedMonth}
            onChange={(e) => onMonthChange(e.target.value)}
            className="w-full px-3 py-2.5 border-2 border-gray-200 rounded-lg text-sm focus:border-purple-400 focus:outline-none"
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
            className="w-full px-3 py-2.5 border-2 border-gray-200 rounded-lg text-sm focus:border-purple-400 focus:outline-none"
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

      {/* Selected gym chips */}
      {selectedGyms.length > 0 && selectedGyms.length < gymList.length && (
        <div className="flex flex-wrap gap-1.5 pt-1">
          {selectedGyms.map(gymId => {
            const gym = gymList.find(g => g.id === gymId);
            return (
              <span
                key={gymId}
                className="inline-flex items-center gap-1 px-2 py-1 bg-purple-100 text-purple-700 rounded-full text-xs font-medium"
              >
                {gym?.name || gymId}
                <button
                  onClick={() => toggleGym(gymId)}
                  className="hover:text-purple-900 font-bold"
                >
                  ×
                </button>
              </span>
            );
          })}
        </div>
      )}

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
