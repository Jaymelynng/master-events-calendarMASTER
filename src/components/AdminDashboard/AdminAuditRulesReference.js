import React, { useState } from 'react';

// Complete inventory of all validation checks in f12_collect_and_import.py
// Each entry maps to the actual code in convert_event_dicts_to_flat()
const AUDIT_RULES = [
  // === COMPLETENESS CHECKS (formatting) ===
  {
    id: 1, error_type: 'missing_age_in_title', category: 'completeness',
    severity: 'warning', section: 'Completeness',
    description: 'Title does not contain an age (e.g., "Ages 5+")',
    compares: 'Title text', against: 'Age pattern regex',
    source: 'hardcoded', appliesTo: 'ALL except SPECIAL EVENT',
    pyLine: '~1164-1172',
  },
  {
    id: 2, error_type: 'missing_date_in_title', category: 'completeness',
    severity: 'warning', section: 'Completeness',
    description: 'Title does not contain a date (e.g., "March 15")',
    compares: 'Title text', against: 'Date pattern regex',
    source: 'hardcoded', appliesTo: 'ALL except SPECIAL EVENT',
    pyLine: '~1174-1182',
  },
  {
    id: 3, error_type: 'missing_program_in_title', category: 'completeness',
    severity: 'warning', section: 'Completeness',
    description: 'Title does not mention its program type (e.g., "Clinic", "Kids Night Out")',
    compares: 'Title text', against: 'Program keywords',
    source: 'hardcoded + program_synonym rules', appliesTo: 'ALL except SPECIAL EVENT',
    pyLine: '~1211-1218',
  },
  {
    id: 4, error_type: 'missing_age_in_description', category: 'completeness',
    severity: 'warning', section: 'Completeness',
    description: 'Description does not contain an age reference',
    compares: 'Description text', against: 'Age pattern regex',
    source: 'hardcoded', appliesTo: 'ALL except SPECIAL EVENT',
    pyLine: '~1223-1231',
  },
  {
    id: 5, error_type: 'missing_datetime_in_description', category: 'completeness',
    severity: 'warning', section: 'Completeness',
    description: 'Description does not contain any date OR time',
    compares: 'Description text', against: 'Date/time pattern regex',
    source: 'hardcoded', appliesTo: 'ALL except SPECIAL EVENT',
    pyLine: '~1233-1241',
  },
  {
    id: 6, error_type: 'missing_time_in_description', category: 'completeness',
    severity: 'warning', section: 'Completeness',
    description: 'Description does not mention a time (or "Full Day"/"Half Day" for camps)',
    compares: 'Description text', against: 'Time pattern regex',
    source: 'hardcoded', appliesTo: 'ALL except SPECIAL EVENT',
    pyLine: '~1245-1253',
  },
  {
    id: 7, error_type: 'missing_program_in_description', category: 'completeness',
    severity: 'warning', section: 'Completeness',
    description: 'Description does not mention its program type keyword',
    compares: 'Description text', against: 'Program keywords',
    source: 'hardcoded + program_synonym rules', appliesTo: 'ALL except SPECIAL EVENT',
    pyLine: '~1255-1263',
  },
  {
    id: 8, error_type: 'clinic_missing_skill', category: 'completeness',
    severity: 'info', section: 'Completeness',
    description: 'Clinic event has no skill mentioned (e.g., "back handspring", "tumbling")',
    compares: 'Title + Description', against: 'Hardcoded skills list',
    source: 'hardcoded (skills list appears 2x in code)', appliesTo: 'CLINIC only',
    pyLine: '~1268-1285',
  },

  // === DATE & TIME ACCURACY ===
  {
    id: 9, error_type: 'date_mismatch', category: 'accuracy',
    severity: 'error', section: 'Date & Time',
    description: 'Event end date is before start date (structural error)',
    compares: 'iClass startDate', against: 'iClass endDate',
    source: 'hardcoded (logic check)', appliesTo: 'ALL except SPECIAL EVENT',
    pyLine: '~1310-1318',
  },
  {
    id: 10, error_type: 'date_mismatch', category: 'accuracy',
    severity: 'error', section: 'Date & Time',
    description: 'Month mentioned in description doesn\'t match event date range',
    compares: 'iClass start/end date months', against: 'Month names in description (first 200 chars)',
    source: 'hardcoded', appliesTo: 'ALL except SPECIAL EVENT',
    pyLine: '~1320-1379',
  },
  {
    id: 11, error_type: 'year_mismatch', category: 'accuracy',
    severity: 'error', section: 'Date & Time',
    description: 'Year in TITLE doesn\'t match event year (e.g., title says 2025 but event is 2026)',
    compares: 'iClass startDate year', against: '4-digit years in title',
    source: 'hardcoded', appliesTo: 'ALL except SPECIAL EVENT',
    pyLine: '~1383-1396',
    gap: 'Does NOT check description for wrong year',
  },
  {
    id: 12, error_type: 'time_mismatch', category: 'accuracy',
    severity: 'warning', section: 'Date & Time',
    description: 'Time found in title doesn\'t match the event\'s scheduled time',
    compares: 'iClass schedule time', against: 'Times in title (first 200 chars)',
    source: 'hardcoded + valid_time rules from database', appliesTo: 'ALL except SPECIAL EVENT',
    pyLine: '~1464-1477',
  },
  {
    id: 13, error_type: 'time_mismatch', category: 'accuracy',
    severity: 'warning', section: 'Date & Time',
    description: 'Time found in description doesn\'t match the event\'s scheduled time',
    compares: 'iClass schedule time', against: 'Times in description (first 300 chars)',
    source: 'hardcoded + valid_time rules from database', appliesTo: 'ALL except SPECIAL EVENT',
    pyLine: '~1479-1492',
  },

  // === AGE ACCURACY ===
  {
    id: 14, error_type: 'age_mismatch', category: 'accuracy',
    severity: 'warning', section: 'Age',
    description: 'Minimum age in title doesn\'t match iClass age setting',
    compares: 'iClass age_min', against: 'Min age extracted from title',
    source: 'hardcoded', appliesTo: 'ALL except SPECIAL EVENT',
    pyLine: '~1514-1523',
  },
  {
    id: 15, error_type: 'age_mismatch', category: 'accuracy',
    severity: 'warning', section: 'Age',
    description: 'Minimum age in description doesn\'t match iClass age setting',
    compares: 'iClass age_min', against: 'Min age extracted from description',
    source: 'hardcoded', appliesTo: 'ALL except SPECIAL EVENT',
    pyLine: '~1525-1534',
  },
  {
    id: 16, error_type: 'age_mismatch', category: 'accuracy',
    severity: 'warning', section: 'Age',
    description: 'Age in title doesn\'t match age in description',
    compares: 'Title age', against: 'Description age',
    source: 'hardcoded', appliesTo: 'ALL except SPECIAL EVENT',
    pyLine: '~1536-1545',
  },

  // === DAY OF WEEK ===
  {
    id: 17, error_type: 'day_mismatch', category: 'accuracy',
    severity: 'warning', section: 'Day of Week',
    description: 'Day of week in description doesn\'t match event\'s actual day',
    compares: 'Calculated day from iClass startDate', against: 'Day names in description (first 200 chars)',
    source: 'hardcoded', appliesTo: 'ALL except CAMP and SPECIAL EVENT',
    pyLine: '~1549-1585',
  },

  // === PROGRAM TYPE: iClass vs Title ===
  {
    id: 18, error_type: 'program_mismatch', category: 'accuracy',
    severity: 'error', section: 'Program Type',
    description: 'iClass says KNO but title contains "Clinic"',
    compares: 'iClass event_type (KNO)', against: 'Title keywords',
    source: 'hardcoded', appliesTo: 'KIDS NIGHT OUT',
    pyLine: '~1612-1621',
  },
  {
    id: 19, error_type: 'program_mismatch', category: 'accuracy',
    severity: 'error', section: 'Program Type',
    description: 'iClass says KNO but title contains "Open Gym"',
    compares: 'iClass event_type (KNO)', against: 'Title keywords',
    source: 'hardcoded + program_synonym rules', appliesTo: 'KIDS NIGHT OUT',
    pyLine: '~1622-1629',
  },
  {
    id: 20, error_type: 'program_mismatch', category: 'accuracy',
    severity: 'error', section: 'Program Type',
    description: 'iClass says CLINIC but title contains "KNO" keywords',
    compares: 'iClass event_type (CLINIC)', against: 'Title keywords',
    source: 'hardcoded', appliesTo: 'CLINIC',
    pyLine: '~1631-1638',
  },
  {
    id: 21, error_type: 'program_mismatch', category: 'accuracy',
    severity: 'error', section: 'Program Type',
    description: 'iClass says CLINIC but title contains "Open Gym"',
    compares: 'iClass event_type (CLINIC)', against: 'Title keywords',
    source: 'hardcoded + program_synonym rules', appliesTo: 'CLINIC',
    pyLine: '~1640-1647',
  },
  {
    id: 22, error_type: 'program_mismatch', category: 'accuracy',
    severity: 'error', section: 'Program Type',
    description: 'iClass says OPEN GYM but title contains "KNO" keywords',
    compares: 'iClass event_type (OPEN GYM)', against: 'Title keywords',
    source: 'hardcoded', appliesTo: 'OPEN GYM',
    pyLine: '~1649-1656',
  },
  {
    id: 23, error_type: 'program_mismatch', category: 'accuracy',
    severity: 'error', section: 'Program Type',
    description: 'iClass says OPEN GYM but title contains "Clinic"',
    compares: 'iClass event_type (OPEN GYM)', against: 'Title keywords',
    source: 'hardcoded', appliesTo: 'OPEN GYM',
    pyLine: '~1658-1665',
  },

  // === PROGRAM TYPE: iClass vs Description ===
  {
    id: 24, error_type: 'program_mismatch', category: 'accuracy',
    severity: 'warning', section: 'Program Type',
    description: 'iClass says KNO but description doesn\'t mention "Kids Night Out" or "KNO"',
    compares: 'iClass event_type (KNO)', against: 'KNO keywords in description',
    source: 'hardcoded (description keywords NOT database-extendable)', appliesTo: 'KIDS NIGHT OUT',
    pyLine: '~1668-1687',
  },
  {
    id: 25, error_type: 'program_mismatch', category: 'accuracy',
    severity: 'error', section: 'Program Type',
    description: 'iClass says KNO but description says "Clinic"',
    compares: 'iClass event_type (KNO)', against: 'Description keywords',
    source: 'hardcoded', appliesTo: 'KIDS NIGHT OUT',
    pyLine: '~1689-1696',
  },
  {
    id: 26, error_type: 'program_mismatch', category: 'accuracy',
    severity: 'warning', section: 'Program Type',
    description: 'iClass says CLINIC but description doesn\'t mention "Clinic"',
    compares: 'iClass event_type (CLINIC)', against: 'Description keywords',
    source: 'hardcoded (description keywords NOT database-extendable)', appliesTo: 'CLINIC',
    pyLine: '~1711-1718',
  },
  {
    id: 27, error_type: 'program_mismatch', category: 'accuracy',
    severity: 'error', section: 'Program Type',
    description: 'iClass says CLINIC but description says "Kids Night Out"',
    compares: 'iClass event_type (CLINIC)', against: 'Description keywords',
    source: 'hardcoded', appliesTo: 'CLINIC',
    pyLine: '~1720-1727',
  },
  {
    id: 28, error_type: 'program_mismatch', category: 'accuracy',
    severity: 'error', section: 'Program Type',
    description: 'iClass says CLINIC but description starts with "Open Gym"',
    compares: 'iClass event_type (CLINIC)', against: 'Description start text',
    source: 'hardcoded', appliesTo: 'CLINIC',
    pyLine: '~1729-1736',
  },
  {
    id: 29, error_type: 'skill_mismatch', category: 'accuracy',
    severity: 'error', section: 'Program Type',
    description: 'Clinic skill in title differs from skill in description',
    compares: 'First skill in title', against: 'First skill in description (first 150 chars)',
    source: 'hardcoded (skills list)', appliesTo: 'CLINIC only',
    pyLine: '~1738-1772',
  },
  {
    id: 30, error_type: 'program_mismatch', category: 'accuracy',
    severity: 'warning', section: 'Program Type',
    description: 'iClass says OPEN GYM but description doesn\'t mention "Open Gym" or synonyms',
    compares: 'iClass event_type (OPEN GYM)', against: 'Description keywords',
    source: 'hardcoded + program_synonym rules', appliesTo: 'OPEN GYM',
    pyLine: '~1798-1805',
  },
  {
    id: 31, error_type: 'program_mismatch', category: 'accuracy',
    severity: 'error', section: 'Program Type',
    description: 'iClass says OPEN GYM but description says "Clinic"',
    compares: 'iClass event_type (OPEN GYM)', against: 'Description keywords',
    source: 'hardcoded', appliesTo: 'OPEN GYM',
    pyLine: '~1807-1814',
  },
  {
    id: 32, error_type: 'program_mismatch', category: 'accuracy',
    severity: 'error', section: 'Program Type',
    description: 'iClass says OPEN GYM but description says "Kids Night Out"',
    compares: 'iClass event_type (OPEN GYM)', against: 'Description keywords',
    source: 'hardcoded', appliesTo: 'OPEN GYM',
    pyLine: '~1816-1823',
  },
  {
    id: 33, error_type: 'program_mismatch', category: 'accuracy',
    severity: 'error', section: 'Program Type',
    description: 'iClass says CAMP but description starts with "Clinic"',
    compares: 'iClass event_type (CAMP)', against: 'Description start text (first 50-100 chars)',
    source: 'hardcoded', appliesTo: 'CAMP',
    pyLine: '~1837-1844',
  },
  {
    id: 34, error_type: 'program_mismatch', category: 'accuracy',
    severity: 'error', section: 'Program Type',
    description: 'iClass says CAMP but description starts with "Kids Night Out"',
    compares: 'iClass event_type (CAMP)', against: 'Description start text',
    source: 'hardcoded', appliesTo: 'CAMP',
    pyLine: '~1846-1853',
  },
  {
    id: 35, error_type: 'program_mismatch', category: 'accuracy',
    severity: 'error', section: 'Program Type',
    description: 'iClass says CAMP but title contains "Kids Night Out"',
    compares: 'iClass event_type (CAMP)', against: 'Title keywords',
    source: 'hardcoded', appliesTo: 'CAMP',
    pyLine: '~1856-1863',
  },
  {
    id: 36, error_type: 'program_mismatch', category: 'accuracy',
    severity: 'error', section: 'Program Type',
    description: 'iClass says CAMP but title contains "Clinic"',
    compares: 'iClass event_type (CAMP)', against: 'Title keywords',
    source: 'hardcoded', appliesTo: 'CAMP',
    pyLine: '~1865-1872',
  },

  // === TITLE vs DESCRIPTION CROSS-CHECK ===
  {
    id: 37, error_type: 'title_desc_mismatch', category: 'accuracy',
    severity: 'error', section: 'Title vs Description',
    description: 'Title says "Clinic" but description says "Kids Night Out"',
    compares: 'Title keywords', against: 'Description keywords',
    source: 'hardcoded', appliesTo: 'ALL except SPECIAL EVENT',
    pyLine: '~1907-1915',
  },
  {
    id: 38, error_type: 'title_desc_mismatch', category: 'accuracy',
    severity: 'error', section: 'Title vs Description',
    description: 'Title says "Kids Night Out" but description says "Clinic"',
    compares: 'Title keywords', against: 'Description keywords',
    source: 'hardcoded', appliesTo: 'ALL except SPECIAL EVENT',
    pyLine: '~1917-1925',
  },
  {
    id: 39, error_type: 'title_desc_mismatch', category: 'accuracy',
    severity: 'error', section: 'Title vs Description',
    description: 'Title says "Open Gym" but description says "Kids Night Out"',
    compares: 'Title keywords', against: 'Description keywords',
    source: 'hardcoded + program_synonym rules', appliesTo: 'ALL except SPECIAL EVENT',
    pyLine: '~1927-1935',
  },
  {
    id: 40, error_type: 'title_desc_mismatch', category: 'accuracy',
    severity: 'error', section: 'Title vs Description',
    description: 'Title says "Kids Night Out" but description starts with "Open Gym"',
    compares: 'Title keywords', against: 'Description start text',
    source: 'hardcoded', appliesTo: 'ALL except SPECIAL EVENT',
    pyLine: '~1937-1945',
  },
  {
    id: 41, error_type: 'title_desc_mismatch', category: 'accuracy',
    severity: 'error', section: 'Title vs Description',
    description: 'Title says "Clinic" but description starts with "Open Gym"',
    compares: 'Title keywords', against: 'Description start text',
    source: 'hardcoded', appliesTo: 'ALL except SPECIAL EVENT',
    pyLine: '~1947-1955',
  },
  {
    id: 42, error_type: 'title_desc_mismatch', category: 'accuracy',
    severity: 'error', section: 'Title vs Description',
    description: 'Title says "Open Gym" but description says "Clinic"',
    compares: 'Title keywords', against: 'Description keywords',
    source: 'hardcoded + program_synonym rules', appliesTo: 'ALL except SPECIAL EVENT',
    pyLine: '~1957-1965',
  },

  // === PRICING ===
  {
    id: 43, error_type: 'missing_price_in_description', category: 'completeness',
    severity: 'warning', section: 'Pricing',
    description: 'No price ($) found in description',
    compares: 'Description text', against: '$ symbol presence',
    source: 'hardcoded', appliesTo: 'ALL except SPECIAL EVENT',
    pyLine: '~1972-1980',
  },
  {
    id: 44, error_type: 'price_mismatch', category: 'accuracy',
    severity: 'error', section: 'Pricing',
    description: 'Price in title doesn\'t match price in description (within $1)',
    compares: 'Title $prices', against: 'Description $prices',
    source: 'hardcoded', appliesTo: 'ALL except SPECIAL EVENT',
    pyLine: '~1982-1995',
  },
  {
    id: 45, error_type: 'camp_price_mismatch', category: 'accuracy',
    severity: 'warning', section: 'Pricing',
    description: 'Camp price in title/description doesn\'t match camp_pricing table',
    compares: 'Title+Description $prices', against: 'camp_pricing table (full/half day daily/weekly)',
    source: 'database (camp_pricing) + price rules', appliesTo: 'CAMP only',
    pyLine: '~2003-2053',
  },
  {
    id: 46, error_type: 'event_price_mismatch', category: 'accuracy',
    severity: 'error', section: 'Pricing',
    description: 'Event price doesn\'t match event_pricing table (within $1)',
    compares: 'Title+Description $prices', against: 'event_pricing table (with effective_date)',
    source: 'database (event_pricing) + price rules', appliesTo: 'CLINIC, KNO, OPEN GYM',
    pyLine: '~2063-2103',
  },

  // === REGISTRATION STATUS ===
  {
    id: 47, error_type: 'registration_closed', category: 'status',
    severity: 'warning', section: 'Registration',
    description: 'Registration has closed but event hasn\'t started yet',
    compares: 'Registration end_date', against: 'Today + event start_date',
    source: 'hardcoded (date comparison)', appliesTo: 'ALL',
    pyLine: '~2111-2125',
  },
  {
    id: 48, error_type: 'registration_not_open', category: 'status',
    severity: 'info', section: 'Registration',
    description: 'Registration hasn\'t opened yet (start date is in the future)',
    compares: 'Registration start_date', against: 'Today',
    source: 'hardcoded (date comparison)', appliesTo: 'ALL',
    pyLine: '~2130-2142',
  },
];

// Known validation gaps - things NOT yet checked
const KNOWN_GAPS = [
  { what: 'Year in description', risk: 'HIGH', details: 'Year mismatch only checks title. Description could say "2025" while event is 2026.', status: 'Fix planned' },
  { what: 'Month in title', risk: 'Medium', details: 'Month validation only checks description, not title.', status: 'Not started' },
  { what: 'Max age', risk: 'Low', details: 'Only minimum age is compared. Maximum age is ignored.', status: 'Not started' },
  { what: 'program_ignore rule', risk: 'Medium', details: 'Can\'t ignore "open gym" when it\'s used as an activity name inside KNO.', status: 'Not started' },
  { what: 'Spelling/grammar', risk: 'Low', details: 'No spell check or grammar check on event text.', status: 'Not planned' },
  { what: 'Consecutive day validation', risk: 'Low', details: 'Doesn\'t verify camps run Mon-Fri or any specific day sequence.', status: 'Not planned' },
  { what: 'Flyer-only events', risk: 'Low', details: 'Events with only an image/flyer and no text can\'t be validated.', status: 'Known limitation' },
  { what: 'Day abbreviations', risk: 'Low', details: 'day_abbrevs variable is defined but never actually used in validation.', status: 'Not started' },
];

export default function AdminAuditRulesReference() {
  const [filterSection, setFilterSection] = useState('all');
  const [filterSource, setFilterSource] = useState('all');
  const [showGaps, setShowGaps] = useState(false);
  const [expandedRule, setExpandedRule] = useState(null);

  const sections = [...new Set(AUDIT_RULES.map(r => r.section))];

  const filtered = AUDIT_RULES.filter(r => {
    if (filterSection !== 'all' && r.section !== filterSection) return false;
    if (filterSource === 'hardcoded' && r.source.includes('database')) return false;
    if (filterSource === 'database' && !r.source.includes('database')) return false;
    if (filterSource === 'has_gap' && !r.gap) return false;
    return true;
  });

  const hardcodedCount = AUDIT_RULES.filter(r => !r.source.includes('database')).length;
  const dbCount = AUDIT_RULES.filter(r => r.source.includes('database')).length;
  const gapCount = AUDIT_RULES.filter(r => r.gap).length;

  const severityBadge = (sev) => {
    if (sev === 'error') return 'bg-red-100 text-red-700';
    if (sev === 'warning') return 'bg-orange-100 text-orange-700';
    return 'bg-blue-100 text-blue-600';
  };

  const sourceColor = (src) => {
    if (src.includes('database')) return 'text-green-600';
    if (src.includes('program_synonym')) return 'text-yellow-600';
    return 'text-gray-500';
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-gray-800">Audit Rules Reference</h2>
        <p className="text-sm text-gray-500 mt-0.5">
          All {AUDIT_RULES.length} validation checks that run during sync, where they live, and what they compare
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <div className="bg-white rounded-lg border p-3 text-center">
          <div className="text-2xl font-bold text-gray-800">{AUDIT_RULES.length}</div>
          <div className="text-xs text-gray-500">Total Checks</div>
        </div>
        <div className="bg-white rounded-lg border p-3 text-center">
          <div className="text-2xl font-bold text-gray-500">{hardcodedCount}</div>
          <div className="text-xs text-gray-500">Hardcoded</div>
        </div>
        <div className="bg-white rounded-lg border p-3 text-center">
          <div className="text-2xl font-bold text-green-600">{dbCount}</div>
          <div className="text-xs text-gray-500">Database-Driven</div>
        </div>
        <div className="bg-white rounded-lg border p-3 text-center">
          <div className="text-2xl font-bold text-red-500">{KNOWN_GAPS.length}</div>
          <div className="text-xs text-gray-500">Known Gaps</div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <div className="flex gap-1">
          <button
            onClick={() => setFilterSection('all')}
            className={`px-2.5 py-1 text-xs font-semibold rounded-lg ${filterSection === 'all' ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
          >
            All Sections
          </button>
          {sections.map(s => (
            <button
              key={s}
              onClick={() => setFilterSection(s)}
              className={`px-2.5 py-1 text-xs font-semibold rounded-lg ${filterSection === s ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
            >
              {s}
            </button>
          ))}
        </div>
        <div className="flex gap-1">
          <button
            onClick={() => setFilterSource('all')}
            className={`px-2.5 py-1 text-xs font-semibold rounded-lg ${filterSource === 'all' ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
          >
            All Sources
          </button>
          <button
            onClick={() => setFilterSource('hardcoded')}
            className={`px-2.5 py-1 text-xs font-semibold rounded-lg ${filterSource === 'hardcoded' ? 'bg-gray-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
          >
            Hardcoded Only
          </button>
          <button
            onClick={() => setFilterSource('database')}
            className={`px-2.5 py-1 text-xs font-semibold rounded-lg ${filterSource === 'database' ? 'bg-green-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
          >
            Database-Driven
          </button>
          <button
            onClick={() => setFilterSource('has_gap')}
            className={`px-2.5 py-1 text-xs font-semibold rounded-lg ${filterSource === 'has_gap' ? 'bg-red-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
          >
            Has Gap
          </button>
        </div>
      </div>

      {/* Rules Table */}
      <div className="bg-white rounded-xl border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-gray-50 border-b">
                <th className="px-3 py-2 text-left font-semibold text-gray-600">#</th>
                <th className="px-3 py-2 text-left font-semibold text-gray-600">Error Type</th>
                <th className="px-3 py-2 text-left font-semibold text-gray-600">Severity</th>
                <th className="px-3 py-2 text-left font-semibold text-gray-600 hidden sm:table-cell">What It Checks</th>
                <th className="px-3 py-2 text-left font-semibold text-gray-600 hidden md:table-cell">Compares</th>
                <th className="px-3 py-2 text-left font-semibold text-gray-600">Source</th>
                <th className="px-3 py-2 text-left font-semibold text-gray-600 hidden lg:table-cell">Applies To</th>
                <th className="px-3 py-2 text-left font-semibold text-gray-600 hidden lg:table-cell">Python Line</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((rule, idx) => (
                <React.Fragment key={rule.id}>
                  <tr
                    className={`border-b hover:bg-gray-50 cursor-pointer ${rule.gap ? 'bg-red-50/50' : ''} ${idx % 2 === 0 ? '' : 'bg-gray-50/30'}`}
                    onClick={() => setExpandedRule(expandedRule === rule.id ? null : rule.id)}
                  >
                    <td className="px-3 py-2 text-gray-400 font-mono">{rule.id}</td>
                    <td className="px-3 py-2 font-mono font-semibold text-gray-700">
                      {rule.error_type}
                      {rule.gap && <span className="ml-1 text-red-500" title="Has a gap">*</span>}
                    </td>
                    <td className="px-3 py-2">
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${severityBadge(rule.severity)}`}>
                        {rule.severity}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-gray-600 hidden sm:table-cell max-w-xs truncate">
                      {rule.description}
                    </td>
                    <td className="px-3 py-2 text-gray-500 hidden md:table-cell">
                      <span className="text-gray-700">{rule.compares}</span>
                      <span className="text-gray-400"> vs </span>
                      <span className="text-gray-700">{rule.against}</span>
                    </td>
                    <td className={`px-3 py-2 font-semibold ${sourceColor(rule.source)}`}>
                      {rule.source.includes('database') ? 'DB' : rule.source.includes('synonym') ? 'Mixed' : 'Code'}
                    </td>
                    <td className="px-3 py-2 text-gray-500 hidden lg:table-cell">{rule.appliesTo}</td>
                    <td className="px-3 py-2 text-gray-400 font-mono hidden lg:table-cell">{rule.pyLine}</td>
                  </tr>
                  {expandedRule === rule.id && (
                    <tr className="bg-blue-50/50">
                      <td colSpan={8} className="px-4 py-3">
                        <div className="space-y-1 text-xs">
                          <div><span className="font-semibold text-gray-600">Description:</span> {rule.description}</div>
                          <div><span className="font-semibold text-gray-600">Compares:</span> {rule.compares} <span className="text-gray-400">vs</span> {rule.against}</div>
                          <div><span className="font-semibold text-gray-600">Source:</span> <span className={sourceColor(rule.source)}>{rule.source}</span></div>
                          <div><span className="font-semibold text-gray-600">Applies to:</span> {rule.appliesTo}</div>
                          <div><span className="font-semibold text-gray-600">Python location:</span> <code className="bg-gray-100 px-1 rounded">f12_collect_and_import.py</code> lines {rule.pyLine}</div>
                          {rule.gap && (
                            <div className="mt-1 p-2 bg-red-50 border border-red-200 rounded text-red-700">
                              <span className="font-bold">Gap:</span> {rule.gap}
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Known Gaps Section */}
      <div>
        <button
          onClick={() => setShowGaps(!showGaps)}
          className="flex items-center gap-2 text-sm font-bold text-red-700 hover:text-red-800"
        >
          <span>{showGaps ? '\u25BC' : '\u25B6'}</span>
          Known Validation Gaps ({KNOWN_GAPS.length})
        </button>
        {showGaps && (
          <div className="mt-2 bg-white rounded-xl border overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-red-50 border-b">
                  <th className="px-3 py-2 text-left font-semibold text-red-700">What</th>
                  <th className="px-3 py-2 text-left font-semibold text-red-700">Risk</th>
                  <th className="px-3 py-2 text-left font-semibold text-red-700">Details</th>
                  <th className="px-3 py-2 text-left font-semibold text-red-700">Status</th>
                </tr>
              </thead>
              <tbody>
                {KNOWN_GAPS.map((gap, i) => (
                  <tr key={i} className="border-b hover:bg-red-50/30">
                    <td className="px-3 py-2 font-semibold text-gray-700">{gap.what}</td>
                    <td className="px-3 py-2">
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                        gap.risk === 'HIGH' ? 'bg-red-100 text-red-700' :
                        gap.risk === 'Medium' ? 'bg-orange-100 text-orange-700' :
                        'bg-gray-100 text-gray-600'
                      }`}>
                        {gap.risk}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-gray-600">{gap.details}</td>
                    <td className="px-3 py-2 text-gray-500">{gap.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="bg-gray-50 rounded-lg p-3 text-xs text-gray-500 space-y-1">
        <div className="font-semibold text-gray-600 mb-1">Legend</div>
        <div><span className="text-gray-500 font-bold">Code</span> = Hardcoded in Python (requires code deploy to change)</div>
        <div><span className="text-green-600 font-bold">DB</span> = Database-driven (manageable from Admin Dashboard)</div>
        <div><span className="text-yellow-600 font-bold">Mixed</span> = Hardcoded defaults + extendable via database rules (program_synonym)</div>
        <div><span className="text-red-500">*</span> = Has a known gap or limitation</div>
        <div className="mt-2 text-gray-400">All rules live in <code>automation/f12_collect_and_import.py</code> inside the <code>convert_event_dicts_to_flat()</code> function (lines ~874-2189)</div>
      </div>
    </div>
  );
}
