import React, { useState } from 'react';

export default function RuleWizard({ gyms, onSave, onCancel, prefill = {} }) {
  const [step, setStep] = useState(1);
  const [isPermanent, setIsPermanent] = useState(prefill.is_permanent !== false);
  const [endDate, setEndDate] = useState(prefill.end_date || '');
  const [selectedGyms, setSelectedGyms] = useState(prefill.gym_ids || ['ALL']);
  const [program, setProgram] = useState(prefill.program || 'ALL');
  const [campSeason, setCampSeason] = useState(prefill.camp_season || null);
  const [scope, setScope] = useState(prefill.scope || 'all_events');
  const [keyword, setKeyword] = useState(prefill.keyword || '');
  const [ruleType, setRuleType] = useState(prefill.rule_type || 'valid_price');
  const [value, setValue] = useState(prefill.value || '');
  const [valueKid2, setValueKid2] = useState(prefill.value_kid2 || '');
  const [valueKid3, setValueKid3] = useState(prefill.value_kid3 || '');
  const [label, setLabel] = useState(prefill.label || '');
  const [note, setNote] = useState(prefill.note || '');

  const programs = ['ALL', 'CAMP', 'CLINIC', 'OPEN GYM', 'KIDS NIGHT OUT'];
  const ruleTypes = [
    { value: 'valid_price', label: 'Valid Price', desc: 'This price is correct for this program' },
    { value: 'sibling_price', label: 'Sibling Pricing', desc: 'Different prices per kid (1st, 2nd, 3rd)' },
    { value: 'valid_time', label: 'Valid Time', desc: 'This time is correct (e.g., before care at 8:30 AM)' },
    { value: 'program_synonym', label: 'Program Name', desc: 'This name means a specific program (e.g., "Gym Fun Friday" = KNO)' },
    { value: 'requirement_exception', label: 'Requirement Exception', desc: 'This gym is excused from this monthly requirement (e.g., internal clinic, staff shortage)' },
    { value: 'exception', label: 'Exception', desc: 'This specific situation is OK, don\'t flag it' },
  ];

  const toggleGym = (gymId) => {
    if (gymId === 'ALL') {
      setSelectedGyms(['ALL']);
    } else {
      setSelectedGyms(prev => {
        const without = prev.filter(g => g !== 'ALL' && g !== gymId);
        if (prev.includes(gymId)) return without.length === 0 ? ['ALL'] : without;
        return [...without, gymId];
      });
    }
  };

  const handleSave = () => {
    onSave({
      is_permanent: isPermanent,
      end_date: isPermanent ? null : endDate || null,
      gym_ids: selectedGyms,
      program,
      camp_season: program === 'CAMP' ? campSeason : null,
      scope,
      keyword: scope === 'keyword' ? keyword : null,
      rule_type: ruleType,
      value,
      value_kid2: ruleType === 'sibling_price' ? valueKid2 : null,
      value_kid3: ruleType === 'sibling_price' ? valueKid3 : null,
      label,
      note: note || null,
    });
  };

  const canProceed = () => {
    if (step === 1) return true;
    if (step === 2) return selectedGyms.length > 0;
    if (step === 3) return program !== '';
    if (step === 4) {
      if (scope === 'keyword' && !keyword.trim()) return false;
      return true;
    }
    if (step === 5) return ruleType && value.trim();
    return false;
  };

  const getSummary = () => {
    const parts = [];
    parts.push(isPermanent ? 'Permanent rule' : `Temporary (ends ${endDate || '?'})`);
    parts.push(selectedGyms.includes('ALL') ? 'All gyms' : selectedGyms.join(', '));
    parts.push(program === 'ALL' ? 'All programs' : program);
    if (scope === 'keyword') parts.push(`Title contains "${keyword}"`);
    if (scope === 'single_event') parts.push('Single event only');
    parts.push(`${ruleType}: ${value}`);
    if (ruleType === 'sibling_price') parts.push(`Kid 2: ${valueKid2}, Kid 3: ${valueKid3}`);
    return parts.join(' → ');
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black bg-opacity-60" onClick={onCancel}>
      <div className="bg-white rounded-xl p-6 w-full max-w-lg mx-4 shadow-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-bold text-gray-800">
            {prefill.id ? 'Edit Rule' : 'New Rule'} — Step {step} of 5
          </h3>
          <button onClick={onCancel} className="text-gray-400 hover:text-gray-600 text-xl font-bold w-8 h-8 rounded-full flex items-center justify-center">×</button>
        </div>

        <div className="flex gap-1 mb-6">
          {[1,2,3,4,5].map(s => (
            <div key={s} className={`h-1.5 flex-1 rounded-full ${s <= step ? 'bg-purple-500' : 'bg-gray-200'}`} />
          ))}
        </div>

        {step === 1 && (
          <div>
            <h4 className="font-semibold text-gray-700 mb-3">Is this permanent or temporary?</h4>
            <div className="flex gap-3">
              <button
                onClick={() => { setIsPermanent(true); setEndDate(''); }}
                className={`flex-1 p-4 rounded-lg border-2 text-left transition-all ${isPermanent ? 'border-purple-500 bg-purple-50' : 'border-gray-200 hover:border-purple-300'}`}
              >
                <div className="font-bold text-gray-800">Permanent</div>
                <div className="text-xs text-gray-500 mt-1">Stays until you delete it</div>
              </button>
              <button
                onClick={() => setIsPermanent(false)}
                className={`flex-1 p-4 rounded-lg border-2 text-left transition-all ${!isPermanent ? 'border-purple-500 bg-purple-50' : 'border-gray-200 hover:border-purple-300'}`}
              >
                <div className="font-bold text-gray-800">Temporary</div>
                <div className="text-xs text-gray-500 mt-1">Expires on a date you set</div>
              </button>
            </div>
            {!isPermanent && (
              <div className="mt-4">
                <label className="text-sm text-gray-600 block mb-1">End date:</label>
                <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="px-3 py-2 border border-gray-300 rounded-lg w-full" />
              </div>
            )}
          </div>
        )}

        {step === 2 && (
          <div>
            <h4 className="font-semibold text-gray-700 mb-3">Which gym(s)?</h4>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => toggleGym('ALL')}
                className={`px-4 py-2 rounded-lg border-2 font-medium text-sm transition-all ${selectedGyms.includes('ALL') ? 'border-purple-500 bg-purple-100 text-purple-800' : 'border-gray-200 hover:border-purple-300'}`}
              >
                All Gyms
              </button>
              {(gyms || []).map(gym => (
                <button
                  key={gym.id}
                  onClick={() => toggleGym(gym.id)}
                  className={`px-3 py-2 rounded-lg border-2 text-sm font-medium transition-all ${selectedGyms.includes(gym.id) ? 'border-purple-500 bg-purple-100 text-purple-800' : 'border-gray-200 hover:border-purple-300'}`}
                >
                  {gym.id}
                </button>
              ))}
            </div>
          </div>
        )}

        {step === 3 && (
          <div>
            <h4 className="font-semibold text-gray-700 mb-3">Which program?</h4>
            <div className="flex flex-wrap gap-2">
              {programs.map(p => (
                <button
                  key={p}
                  onClick={() => setProgram(p)}
                  className={`px-4 py-2 rounded-lg border-2 font-medium text-sm transition-all ${program === p ? 'border-purple-500 bg-purple-100 text-purple-800' : 'border-gray-200 hover:border-purple-300'}`}
                >
                  {p === 'KIDS NIGHT OUT' ? 'KNO' : p}
                </button>
              ))}
            </div>
            {program === 'CAMP' && (
              <div className="mt-4">
                <label className="text-sm text-gray-600 block mb-2">Camp season:</label>
                <div className="flex gap-2">
                  {[{v: null, l: 'Both'}, {v: 'school_year', l: 'School Year'}, {v: 'summer', l: 'Summer'}].map(opt => (
                    <button
                      key={opt.l}
                      onClick={() => setCampSeason(opt.v)}
                      className={`px-3 py-2 rounded-lg border-2 text-sm font-medium transition-all ${campSeason === opt.v ? 'border-purple-500 bg-purple-100' : 'border-gray-200 hover:border-purple-300'}`}
                    >
                      {opt.l}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {step === 4 && (
          <div>
            <h4 className="font-semibold text-gray-700 mb-3">How specific?</h4>
            <div className="space-y-3">
              <button
                onClick={() => { setScope('all_events'); setKeyword(''); }}
                className={`w-full p-4 rounded-lg border-2 text-left transition-all ${scope === 'all_events' ? 'border-purple-500 bg-purple-50' : 'border-gray-200 hover:border-purple-300'}`}
              >
                <div className="font-bold text-gray-800">All events in this program</div>
                <div className="text-xs text-gray-500 mt-1">Applies to every event matching above selections</div>
              </button>
              <button
                onClick={() => setScope('keyword')}
                className={`w-full p-4 rounded-lg border-2 text-left transition-all ${scope === 'keyword' ? 'border-purple-500 bg-purple-50' : 'border-gray-200 hover:border-purple-300'}`}
              >
                <div className="font-bold text-gray-800">Events with a specific keyword in the title</div>
                <div className="text-xs text-gray-500 mt-1">Only events whose title contains a word you specify</div>
              </button>
            </div>
            {scope === 'keyword' && (
              <div className="mt-4">
                <label className="text-sm text-gray-600 block mb-1">Title must contain:</label>
                <input
                  type="text"
                  value={keyword}
                  onChange={e => setKeyword(e.target.value)}
                  placeholder='e.g., "homeschool" or "movie night"'
                  className="px-3 py-2 border border-gray-300 rounded-lg w-full text-sm"
                  autoFocus
                />
              </div>
            )}
          </div>
        )}

        {step === 5 && (
          <div>
            <h4 className="font-semibold text-gray-700 mb-3">What's the rule?</h4>
            <div className="flex flex-wrap gap-2 mb-4">
              {ruleTypes.map(rt => (
                <button
                  key={rt.value}
                  onClick={() => setRuleType(rt.value)}
                  className={`px-3 py-2 rounded-lg border-2 text-sm font-medium transition-all ${ruleType === rt.value ? 'border-purple-500 bg-purple-100 text-purple-800' : 'border-gray-200 hover:border-purple-300'}`}
                >
                  {rt.label}
                </button>
              ))}
            </div>
            <div className="text-xs text-gray-500 mb-4">
              {ruleTypes.find(r => r.value === ruleType)?.desc}
            </div>

            {ruleType === 'valid_price' && (
              <div>
                <label className="text-sm text-gray-600 block mb-1">Valid price (Kid 1):</label>
                <input type="text" value={value} onChange={e => setValue(e.target.value)} placeholder="e.g., 10" className="px-3 py-2 border border-gray-300 rounded-lg w-full text-sm" autoFocus />
              </div>
            )}

            {ruleType === 'sibling_price' && (
              <div className="space-y-3">
                <div>
                  <label className="text-sm text-gray-600 block mb-1">Kid 1 price:</label>
                  <input type="text" value={value} onChange={e => setValue(e.target.value)} placeholder="e.g., 40" className="px-3 py-2 border border-gray-300 rounded-lg w-full text-sm" autoFocus />
                </div>
                <div>
                  <label className="text-sm text-gray-600 block mb-1">Kid 2 price:</label>
                  <input type="text" value={valueKid2} onChange={e => setValueKid2(e.target.value)} placeholder="e.g., 35" className="px-3 py-2 border border-gray-300 rounded-lg w-full text-sm" />
                </div>
                <div>
                  <label className="text-sm text-gray-600 block mb-1">Kid 3 price:</label>
                  <input type="text" value={valueKid3} onChange={e => setValueKid3(e.target.value)} placeholder="e.g., 35" className="px-3 py-2 border border-gray-300 rounded-lg w-full text-sm" />
                </div>
              </div>
            )}

            {ruleType === 'valid_time' && (
              <div>
                <label className="text-sm text-gray-600 block mb-1">Valid time:</label>
                <input type="text" value={value} onChange={e => setValue(e.target.value)} placeholder="e.g., 8:30 AM" className="px-3 py-2 border border-gray-300 rounded-lg w-full text-sm" autoFocus />
              </div>
            )}

            {ruleType === 'program_synonym' && (
              <div className="space-y-3">
                <div>
                  <label className="text-sm text-gray-600 block mb-1">The name/keyword:</label>
                  <input type="text" value={value} onChange={e => setValue(e.target.value)} placeholder='e.g., "gym fun friday"' className="px-3 py-2 border border-gray-300 rounded-lg w-full text-sm" autoFocus />
                </div>
                <div>
                  <label className="text-sm text-gray-600 block mb-1">Means this program:</label>
                  <div className="flex gap-2">
                    {['KIDS NIGHT OUT', 'CLINIC', 'OPEN GYM', 'CAMP'].map(p => (
                      <button key={p} onClick={() => setLabel(p)} className={`px-3 py-1.5 rounded-lg border-2 text-xs font-medium ${label === p ? 'border-purple-500 bg-purple-100' : 'border-gray-200'}`}>
                        {p === 'KIDS NIGHT OUT' ? 'KNO' : p}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {ruleType === 'requirement_exception' && (
              <div>
                <label className="text-sm text-gray-600 block mb-1">Why is this gym excused?</label>
                <input type="text" value={value} onChange={e => setValue(e.target.value)} placeholder="e.g., Internal competitive clinic - students sign up directly" className="px-3 py-2 border border-gray-300 rounded-lg w-full text-sm" autoFocus />
              </div>
            )}

            {ruleType === 'exception' && (
              <div>
                <label className="text-sm text-gray-600 block mb-1">What's the exception?</label>
                <input type="text" value={value} onChange={e => setValue(e.target.value)} placeholder="Describe what's OK about this" className="px-3 py-2 border border-gray-300 rounded-lg w-full text-sm" autoFocus />
              </div>
            )}

            <div className="mt-4">
              <label className="text-sm text-gray-600 block mb-1">Label (short description):</label>
              <input type="text" value={label} onChange={e => setLabel(e.target.value)} placeholder="e.g., Homeschool Open Gym pricing" className="px-3 py-2 border border-gray-300 rounded-lg w-full text-sm" />
            </div>

            <div className="mt-3">
              <label className="text-sm text-gray-600 block mb-1">Note (optional):</label>
              <input type="text" value={note} onChange={e => setNote(e.target.value)} placeholder="Any additional context" className="px-3 py-2 border border-gray-300 rounded-lg w-full text-sm" />
            </div>

            <div className="mt-4 p-3 bg-gray-50 rounded-lg text-xs text-gray-600">
              <div className="font-semibold mb-1">Summary:</div>
              {getSummary()}
            </div>
          </div>
        )}

        <div className="flex justify-between mt-6 pt-4 border-t border-gray-200">
          <button
            onClick={() => step > 1 ? setStep(step - 1) : onCancel()}
            className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-800"
          >
            {step > 1 ? '← Back' : 'Cancel'}
          </button>
          {step < 5 ? (
            <button
              onClick={() => setStep(step + 1)}
              disabled={!canProceed()}
              className={`px-6 py-2 rounded-lg text-sm font-semibold transition-all ${canProceed() ? 'bg-purple-600 text-white hover:bg-purple-700' : 'bg-gray-200 text-gray-400 cursor-not-allowed'}`}
            >
              Next →
            </button>
          ) : (
            <button
              onClick={handleSave}
              disabled={!canProceed()}
              className={`px-6 py-2 rounded-lg text-sm font-semibold transition-all ${canProceed() ? 'bg-green-600 text-white hover:bg-green-700' : 'bg-gray-200 text-gray-400 cursor-not-allowed'}`}
            >
              Save Rule
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
