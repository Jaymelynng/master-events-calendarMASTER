import React from 'react';

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

  const categoryButtons = [
    { value: 'all', label: 'ALL', color: 'bg-gray-600', activeColor: 'bg-gray-700' },
    { value: 'data_error', label: `DATA${counts.data ? ` (${counts.data})` : ''}`, color: 'bg-red-500', activeColor: 'bg-red-600' },
    { value: 'formatting', label: `FORMAT${counts.format ? ` (${counts.format})` : ''}`, color: 'bg-orange-500', activeColor: 'bg-orange-600' },
    { value: 'description', label: `DESC${counts.desc ? ` (${counts.desc})` : ''}`, color: 'bg-gray-500', activeColor: 'bg-gray-600' },
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

      {/* Filters Row */}
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

        {/* Status Filter */}
        <div className="min-w-[150px]">
          <label className="block text-xs font-semibold text-gray-600 mb-1">Status</label>
          <select
            value={statusFilter}
            onChange={(e) => onStatusFilterChange(e.target.value)}
            className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg text-sm focus:border-purple-400 focus:outline-none"
          >
            <option value="active">Active Only</option>
            <option value="all">All (Active + Resolved)</option>
            <option value="resolved">Resolved Only</option>
          </select>
        </div>
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
