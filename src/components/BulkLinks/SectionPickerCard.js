// ============================================================================
// SectionPickerCard — The TOP bulk-picker section card.
// ============================================================================
// One card per section. Each shows the section's fields as checkable pills.
// Toggling a field here selects it globally (drives the top action bar and
// every gym card's per-card counters).
//
// Classes copied verbatim from BLP's SectionCard in DynamicPage.tsx (lines
// 429-484).
// ============================================================================

import React from 'react';

const SectionPickerCard = ({ section, selectedFieldIds, onToggleField, onSelectAllInSection }) => {
  const allSelected = section.fields.length > 0 && section.fields.every((f) => selectedFieldIds.has(f.id));

  return (
    <div
      className="bg-white rounded-xl border border-[#d4c4b8] overflow-hidden transition-shadow duration-200"
      style={{ boxShadow: '0 6px 16px -4px rgba(107, 84, 68, 0.18), 0 2px 6px -2px rgba(107, 84, 68, 0.12)' }}
    >
      <div className="bg-gradient-to-r from-[#e8ddd3] to-[#f0e8e0] px-2 py-1.5 flex items-center justify-between border-b border-[#d4c4b8]">
        <h3 className="text-xs font-bold text-[#6b5444]">
          {section.emoji ? `${section.emoji} ` : ''}
          {section.title}
        </h3>
        <button
          onClick={() => onSelectAllInSection(section.id)}
          className={`h-5 text-[10px] px-1.5 rounded ${
            allSelected
              ? 'bg-[#8b7355] hover:bg-[#6b5444] text-white'
              : 'border border-[#b48f8f] text-[#6b5444] hover:bg-[#f5f0eb]'
          }`}
        >
          {allSelected ? '✓' : 'All'}
        </button>
      </div>

      <div className="p-2 grid grid-cols-1 lg:grid-cols-2 gap-1.5">
        {section.fields.map((field) => {
          const isChecked = selectedFieldIds.has(field.id);
          return (
            <label
              key={field.id}
              title={field.label}
              className={`flex items-center gap-2 px-2.5 py-2 rounded-lg cursor-pointer transition-all duration-200 text-xs border ${
                isChecked
                  ? 'bg-[#b48f8f]/10 border-[#b48f8f] ring-1 ring-[#b48f8f]/20'
                  : 'bg-white border-[#e5ddd5] hover:border-[#d4c4b8]'
              }`}
              style={
                isChecked
                  ? { boxShadow: '0 4px 12px -2px rgba(180, 143, 143, 0.35), 0 2px 4px -1px rgba(180, 143, 143, 0.2)' }
                  : { boxShadow: '0 2px 6px -1px rgba(107, 84, 68, 0.15), 0 1px 3px -1px rgba(107, 84, 68, 0.1)' }
              }
            >
              <input
                type="checkbox"
                checked={isChecked}
                onChange={() => onToggleField(field.id)}
                className="border-2 border-[#b48f8f] accent-[#b48f8f] h-4 w-4 flex-shrink-0 transition-all duration-150"
                aria-label={`Select ${field.label}`}
              />
              {field.emoji && <span className="text-sm flex-shrink-0">{field.emoji}</span>}
              <span
                className={`lg:truncate min-w-0 ${
                  isChecked ? 'text-[#6b5444] font-semibold' : 'text-[#6b5444]'
                }`}
              >
                {field.label}
              </span>
            </label>
          );
        })}
      </div>
    </div>
  );
};

export default SectionPickerCard;
