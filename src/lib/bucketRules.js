// ============================================================================
// BUCKET RULES - which bucket an iClass Event Type name lands in.
// The one copy the screens use; the sync has the same order in
// automation/f12_collect_and_import.py (resolve_type_mapping). Rules are Jayme's rows in
// event_type_mappings, edited on Admin > Buckets.
//   1. exact name, this gym   2. exact name, every gym
//   3. word rule (match_type 'word'), this gym, then every gym - the longest word wins
//   4. nothing -> null (Needs a home)
// (The sync also matches a renamed category by its iClass type id; screens never need that,
//  because the names they resolve come from events the sync already filed.)
// ============================================================================

export const lower = (s) => (s || '').trim().toLowerCase();
export const isWordRule = (r) => r.match_type === 'word';

// Whole word or phrase, any capitals, plural "s" allowed.
export const wordMatches = (name, word) => {
  const w = lower(word).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(^|[^a-z])${w}s?($|[^a-z])`).test(lower(name));
};

// The rule row a category name resolves to at one gym, or null.
export const resolveRule = (name, gymId, rules) => {
  const active = (rules || []).filter(r => r.is_active);
  const exact = active.filter(r => !isWordRule(r) && lower(r.iclass_type_name) === lower(name));
  const rule = exact.find(r => r.gym_id === gymId) || exact.find(r => !r.gym_id);
  if (rule) return rule;
  for (const g of [gymId, null]) {
    const hits = active.filter(r => isWordRule(r) && (r.gym_id || null) === g && wordMatches(name, r.iclass_type_name));
    if (hits.length) return hits.sort((a, b) => b.iclass_type_name.length - a.iclass_type_name.length)[0];
  }
  return null;
};
