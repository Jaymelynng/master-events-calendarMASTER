// ============================================================================
// GymProfileCard — Per-gym card on a Bulk Links page.
// ============================================================================
// Classes copied VERBATIM from Bulk Link PRO's GymCard in
// client/src/pages/DynamicPage.tsx so the look matches exactly. The only
// substitutions are: native <input type="checkbox"> instead of shadcn
// <Checkbox>, and native <button> instead of shadcn <Button>, since
// Calendar doesn't have shadcn installed. All Tailwind / colour values
// (`#b48f8f`, `#d4c4b8`, `#e8ddd3`→`#f0e8e0`, `#f5f0eb`, `#6b5444`,
// `#8b7355`, `#1a73e8`) are kept identical.
// ============================================================================

import React, { useState, useMemo } from 'react';
import { ExternalLink, Copy, Check } from 'lucide-react';
import { getCopyValue, getOpenUrl } from '../../lib/bulkLinksApi';

const GymProfileCard = ({
  gym,                         // { id, name, logo_url, brand_colors }
  sections,                    // [{ id, title, emoji, fields: [...] }]
  valuesByFieldAndLocation,    // { [fieldId]: { [gymId]: FieldValue[] } }
  selectedFieldIds,            // Set<string> — global selection (drives top-bar counter)
  onToggleField,               // (fieldId) => void — toggle global selection
  onCopySingleValue,           // (gymId, field, value) => void
  copiedKey,                   // string | null — last single-copy id
  isSelected,                  // bool — is this gym ticked in the sidebar?
}) => {
  const [expandedSections, setExpandedSections] = useState(new Set());

  const primaryColor = (gym.brand_colors && gym.brand_colors[0]) || '#b48f8f';
  const secondaryColor = (gym.brand_colors && gym.brand_colors[1]) || primaryColor;

  const getValues = (fieldId) =>
    (valuesByFieldAndLocation[fieldId] && valuesByFieldAndLocation[fieldId][gym.id]) || [];

  const toggleSection = (sectionId) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      next.has(sectionId) ? next.delete(sectionId) : next.add(sectionId);
      return next;
    });
  };

  // Per-card counters drive the in-header Open/Copy buttons.
  const { openCount, copyCount } = useMemo(() => {
    let open = 0;
    let copy = 0;
    sections.forEach((section) => {
      section.fields.forEach((field) => {
        if (!selectedFieldIds.has(field.id)) return;
        const values = getValues(field.id);
        values.forEach((v) => {
          if (getOpenUrl(field, v)) open++;
          if (getCopyValue(field, v)) copy++;
        });
      });
    });
    return { openCount: open, copyCount: copy };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sections, selectedFieldIds, valuesByFieldAndLocation, gym.id]);

  const handleOpenAll = () => {
    if (openCount === 0) return;
    const urls = [];
    sections.forEach((section) => {
      section.fields.forEach((field) => {
        if (!selectedFieldIds.has(field.id)) return;
        getValues(field.id).forEach((v) => {
          const url = getOpenUrl(field, v);
          if (url) urls.push(url);
        });
      });
    });
    urls.forEach((url) => window.open(url, '_blank', 'noopener,noreferrer'));
  };

  const handleCopyAll = async () => {
    if (copyCount === 0) return;
    let output = `${'═'.repeat(40)}\n${gym.name} (${gym.id})\n`;
    sections.forEach((section) => {
      const inSection = section.fields.filter((f) => selectedFieldIds.has(f.id));
      if (inSection.length === 0) return;
      output += `${section.title}\n`;
      inSection.forEach((field) => {
        const values = getValues(field.id);
        if (values.length === 0) return;
        if (values.length === 1) {
          const cv = getCopyValue(field, values[0]);
          if (cv) output += `${field.emoji || ''} ${field.label}: ${cv}\n`;
        } else {
          output += `${field.emoji || ''} ${field.label}:\n`;
          values.forEach((v) => {
            const cv = getCopyValue(field, v);
            if (cv) output += `  ${v.label ? v.label + ': ' : ''}${cv}\n`;
          });
        }
      });
    });
    try {
      await navigator.clipboard.writeText(output.trim());
    } catch (err) {
      console.error('Clipboard write failed', err);
    }
  };

  return (
    <div
      className={`bg-white rounded-xl overflow-hidden transition-shadow duration-200 ${
        isSelected
          ? 'ring-2 ring-[#b48f8f] border-2 border-[#b48f8f]'
          : 'border border-[#d4c4b8]'
      }`}
      style={{
        boxShadow: isSelected
          ? '0 14px 32px -6px rgba(180, 143, 143, 0.4), 0 6px 14px -4px rgba(180, 143, 143, 0.25)'
          : '0 10px 24px -6px rgba(107, 84, 68, 0.25), 0 4px 10px -3px rgba(107, 84, 68, 0.15)',
      }}
    >
      {/* Header — brand-color gradient */}
      <div
        className="px-4 py-3 flex items-center justify-between"
        style={{ background: `linear-gradient(135deg, ${primaryColor}, ${secondaryColor})` }}
      >
        <div className="flex items-center gap-3">
          {gym.logo_url ? (
            <img
              src={gym.logo_url}
              alt={gym.name}
              className="w-10 h-10 rounded-lg bg-white p-1 object-contain"
            />
          ) : (
            <div className="w-10 h-10 rounded-lg bg-white/20 flex items-center justify-center text-xs font-bold text-white">
              {gym.id}
            </div>
          )}
          <div className="text-white">
            <h3 className="font-bold text-lg leading-tight">{gym.id}</h3>
            <p className="text-sm opacity-90 leading-tight">{gym.name}</p>
          </div>
        </div>

        <div className="flex gap-2">
          <button
            onClick={handleOpenAll}
            disabled={openCount === 0}
            className="bg-white/20 hover:bg-white/30 text-white gap-1 disabled:opacity-50 shadow-md hover:shadow-lg active:shadow-sm active:translate-y-px transition-all duration-200 inline-flex items-center px-3 py-1.5 rounded-md text-sm font-medium"
          >
            <ExternalLink className="h-3.5 w-3.5" /> Open ({openCount})
          </button>
          <button
            onClick={handleCopyAll}
            disabled={copyCount === 0}
            className="bg-white/20 hover:bg-white/30 text-white gap-1 disabled:opacity-50 shadow-md hover:shadow-lg active:shadow-sm active:translate-y-px transition-all duration-200 inline-flex items-center px-3 py-1.5 rounded-md text-sm font-medium"
          >
            <Copy className="h-3.5 w-3.5" /> Copy ({copyCount})
          </button>
        </div>
      </div>

      {/* Sections — 3-column grid inside the card */}
      <div className="p-3 space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {sections.map((section) => {
            const fieldsWithValues = section.fields.filter(
              (f) => getValues(f.id).length > 0
            );
            if (fieldsWithValues.length === 0) return null;
            const isExpanded = expandedSections.has(section.id);

            return (
              <div
                key={section.id}
                className="bg-white rounded-xl border border-[#d4c4b8] overflow-hidden transition-shadow duration-200"
                style={{ boxShadow: '0 6px 16px -4px rgba(107, 84, 68, 0.22), 0 2px 6px -2px rgba(107, 84, 68, 0.14)' }}
              >
                <button
                  onClick={() => toggleSection(section.id)}
                  className="w-full bg-gradient-to-r from-[#e8ddd3] to-[#f0e8e0] px-3 py-2 flex items-center justify-between border-b border-[#d4c4b8] hover:from-[#e0d5c9] hover:to-[#e8e0d8] transition-colors"
                  aria-expanded={isExpanded}
                >
                  <h3 className="text-sm font-bold text-[#6b5444] text-left">
                    {isExpanded ? '▼' : '▶'} {section.emoji ? `${section.emoji} ` : ''}
                    {section.title}
                  </h3>
                  <span className="text-xs text-[#8b7355] bg-white/50 px-2 py-0.5 rounded">
                    {fieldsWithValues.length}
                  </span>
                </button>

                {isExpanded && (
                  <div className="p-2 space-y-1">
                    {fieldsWithValues.map((field) => {
                      const values = getValues(field.id);
                      const isMulti = values.length > 1;
                      const isFieldSelected = selectedFieldIds.has(field.id);

                      if (isMulti) {
                        return (
                          <div key={field.id} className="space-y-0.5">
                            <div
                              className={`flex items-center gap-2 p-1.5 rounded ${
                                isFieldSelected ? 'bg-[#f5f0eb]' : ''
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={isFieldSelected}
                                onChange={() => onToggleField(field.id)}
                                className="w-4 h-4 rounded border-2 border-[#b48f8f] accent-[#b48f8f]"
                                aria-label={`Select ${field.label}`}
                              />
                              <span className="text-base">{field.emoji || ''}</span>
                              <span className="text-sm font-semibold text-[#6b5444]">
                                {field.label} ({values.length})
                              </span>
                            </div>
                            <div className="ml-8 space-y-0.5">
                              {values.map((v) => {
                                const displayVal = v.value || '';
                                const isLink = displayVal.startsWith('http');
                                const key = `${gym.id}-${field.id}-${v.id}`;
                                const isCopied = copiedKey === key;
                                return (
                                  <div
                                    key={v.id}
                                    className="flex items-center gap-2 py-0.5 group text-xs"
                                  >
                                    {v.label && (
                                      <span className="text-[#8b7355] min-w-[80px]">
                                        {v.label}:
                                      </span>
                                    )}
                                    {isLink ? (
                                      <a
                                        href={displayVal}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-[#1a73e8] hover:underline truncate flex-1"
                                      >
                                        {displayVal}
                                      </a>
                                    ) : (
                                      <span className="text-[#6b5444] truncate flex-1">
                                        {displayVal}
                                      </span>
                                    )}
                                    <button
                                      onClick={() => onCopySingleValue(gym.id, field, v)}
                                      className="h-5 w-5 p-0 opacity-0 group-hover:opacity-100 inline-flex items-center justify-center"
                                      aria-label={`Copy ${field.label}`}
                                    >
                                      {isCopied ? (
                                        <Check className="h-3 w-3 text-green-600" />
                                      ) : (
                                        <Copy className="h-3 w-3 text-[#8b7355]" />
                                      )}
                                    </button>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        );
                      }

                      // Single-value field
                      const v = values[0];
                      const displayVal = v?.value || '';
                      const isLink =
                        displayVal.startsWith('http') || displayVal.startsWith('mailto:');
                      const key = `${gym.id}-${field.id}-${v?.id}`;
                      const isCopied = copiedKey === key;

                      return (
                        <div
                          key={field.id}
                          className={`flex items-center gap-2 p-1.5 rounded hover:bg-[#f5f0eb] group ${
                            isFieldSelected ? 'bg-[#f5f0eb]' : ''
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isFieldSelected}
                            onChange={() => onToggleField(field.id)}
                            className="w-4 h-4 rounded border-2 border-[#b48f8f] accent-[#b48f8f]"
                            aria-label={`Select ${field.label}`}
                          />
                          <span className="text-base">{field.emoji || ''}</span>
                          {isLink ? (
                            <a
                              href={displayVal}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex-1 text-sm text-[#1a73e8] hover:underline truncate"
                              title={displayVal}
                            >
                              {field.label}
                            </a>
                          ) : (
                            <span
                              className="flex-1 text-sm text-[#6b5444] truncate"
                              title={displayVal}
                            >
                              {displayVal || field.label}
                            </span>
                          )}
                          <button
                            onClick={() => onCopySingleValue(gym.id, field, v)}
                            className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 inline-flex items-center justify-center"
                            aria-label={`Copy ${field.label}`}
                          >
                            {isCopied ? (
                              <Check className="h-3 w-3 text-green-600" />
                            ) : (
                              <Copy className="h-3 w-3 text-[#8b7355]" />
                            )}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default GymProfileCard;
