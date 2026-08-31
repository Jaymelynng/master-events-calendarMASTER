// ============================================================================
// REQUIREMENT EXCEPTIONS — "this gym is excused from this monthly requirement"
// ============================================================================
// A gym mid-onboarding should not read as failing. The four merger gyms (AAG,
// EAG, MGC, PLG) are excused from Clinic / KNO / Open Gym until their setup is
// settled, so they show "excused", not "+1 CLINIC +2 KNO +1 OPEN GYM" in angry
// red next to gyms that genuinely missed.
//
// The exceptions live in the `rules` table as rule_type = 'requirement_exception'
// (12 rows: 4 gyms x 3 programs). They were already there and being displayed in
// Admin > Gym Rules with a yellow "Exception" badge — but NOTHING that computed
// "missing" read them, so every screen still showed those gyms short.
//
// Three separate copies of the missing-check existed:
//   useEventsDashboard.js        -> the header's "N/14 Requirements Met"
//   MonthlyRequirementsTable.js  -> the Status column on the gym table
//   EventStats/StatsTable.js     -> the stats table
// All three now call this, so an exception means the same thing everywhere.
//
// One trap this exists to absorb: the rules store a gym CODE ('AAG'), while the
// missing-check is handed a gym NAME ('All Around Gymnastic Academy'). Callers
// pass gymsList and this resolves either form.
// ============================================================================

/**
 * Is this exception rule in force right now?
 * Permanent rules always are. Dated ones only inside their window.
 */
function isRuleLive(rule, today) {
  if (!rule || rule.is_active === false) return false;
  if (rule.is_permanent) return true;
  if (rule.start_date && rule.start_date > today) return false;
  if (rule.end_date && rule.end_date < today) return false;
  return true;
}

/**
 * Resolve a gym name OR code to its code. Returns whatever it was given if the
 * gym is not in the list, so a lookup miss can never silently excuse a gym.
 */
export function resolveGymCode(gymNameOrCode, gymsList = []) {
  if (!gymNameOrCode) return gymNameOrCode;
  const hit = (gymsList || []).find(
    g => g.name === gymNameOrCode || g.id === gymNameOrCode
  );
  return hit ? hit.id : gymNameOrCode;
}

/**
 * Is this gym excused from this monthly requirement?
 *
 * @param {Array}  rules      every row from the rules table
 * @param {string} gym        gym name or code
 * @param {string} program    'CLINIC' | 'KIDS NIGHT OUT' | 'OPEN GYM' | ...
 * @param {Array}  gymsList   gyms, used to turn a name into a code
 */
export function isExcusedFrom(rules, gym, program, gymsList = []) {
  if (!rules || !rules.length || !gym || !program) return false;
  const code = resolveGymCode(gym, gymsList);
  const today = new Date().toISOString().slice(0, 10);

  return rules.some(r => {
    if (r.rule_type !== 'requirement_exception') return false;
    if (!isRuleLive(r, today)) return false;
    const ids = r.gym_ids || [];
    const gymMatches = ids.includes(code) || ids.includes('ALL');
    const programMatches = r.program === program || r.program === 'ALL';
    return gymMatches && programMatches;
  });
}

/**
 * Every program this gym is excused from — for showing "excused" on screen
 * instead of just quietly dropping the gym out of the short list.
 */
export function excusedPrograms(rules, gym, gymsList = []) {
  if (!rules || !rules.length || !gym) return [];
  const code = resolveGymCode(gym, gymsList);
  const today = new Date().toISOString().slice(0, 10);

  return [...new Set(
    rules
      .filter(r => r.rule_type === 'requirement_exception' && isRuleLive(r, today))
      .filter(r => (r.gym_ids || []).includes(code) || (r.gym_ids || []).includes('ALL'))
      .map(r => r.program)
  )];
}
