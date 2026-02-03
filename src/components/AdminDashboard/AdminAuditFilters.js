import React from 'react';

export default function AdminAuditFilters({
  gyms,
  selectedGym,
  onGymChange,
  selectedMonth,
  onMonthChange,
  selectedCategory,
  onCategoryChange,
  selectedProgramType,
  onProgramTypeChange,
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

  const categoryButtons = [
    { value: 'all', label: 'ALL', color: 'bg-gray-600', activeColor: 'bg-gray-700' },
    { value: 'data_error', label: `DATA${counts.data ? ` (${counts.data})` : ''}`, color: 'bg-red-500', activeColor: 'bg-red-600' },
    { value: 'formatting', label: `FORMAT${counts.format ? ` (${counts.format})` : ''}`, color: 'bg-orange-500', activeColor: 'bg-orange-600' },
    { value: 'description', label: `DESC${counts.desc ? ` (${counts.desc})` : ''}`, color: 'bg-gray-500', activeColor: 'bg-gray-600' },
  ];

  return (
    <div className="bg-white rounded-xl border-2 border-gray-200 p-4 space-y-3">
      <div className="flex flex-wrap gap-3 items-end">
        {/* Gym Dropdown */}
        <div className="flex-1 min-w-[200px]">
          <label className="block text-xs font-semibold text-gray-600 mb-1">Gym</label>
          <select
            value={selectedGym}
            onChange={(e) => onGymChange(e.target.value)}
            className="w-full px-3 py-2.5 border-2 border-gray-200 rounded-lg text-sm font-medium focus:border-purple-400 focus:outline-none"
          >
            <option value="">Select a gym to review...</option>
            {gymList.map(g => (
              <option key={g.id} value={g.id}>{g.name}</option>
            ))}
          </select>
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

      {/* Category Toggle Buttons */}
      {selectedGym && (
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
