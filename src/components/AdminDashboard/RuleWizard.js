import React, { useState } from 'react';

export default function RuleWizard({ gyms, onSave, onCancel, prefill = {} }) {
  // Step 0: What are you doing?
  const [purpose, setPurpose] = useState(prefill.rule_type === 'requirement_exception' ? 'requirement' : (prefill.rule_type ? 'validation' : ''));
  
  // Requirement exception fields
  const [reqGym, setReqGym] = useState(prefill.gym_ids?.[0] || '');
  const [reqProgram, setReqProgram] = useState(prefill.program || '');
  const [reqStartDate, setReqStartDate] = useState(prefill.start_date || '');
  const [reqEndDate, setReqEndDate] = useState(prefill.end_date || '');
  const [reqReason, setReqReason] = useState(prefill.value || '');
  const [reqStep, setReqStep] = useState(1);

  // Validation rule fields
  const [step, setStep] = useState(1);
  const [isPermanent, setIsPermanent] = useState(prefill.is_permanent !== false);
  const [startDate, setStartDate] = useState(prefill.start_date || '');
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
  const reqPrograms = ['CLINIC', 'KIDS NIGHT OUT', 'OPEN GYM'];
  
  const ruleTypes = [
    { value: 'valid_price', label: 'Valid Price', desc: 'This price is correct for this program' },
    { value: 'sibling_price', label: 'Sibling Pricing', desc: 'Different prices per kid (1st, 2nd, 3rd)' },
    { value: 'valid_time', label: 'Valid Time', desc: 'This time is correct (e.g., before care at 8:30 AM)' },
    { value: 'program_synonym', label: 'Program Name', desc: 'This name means a specific program (e.g., "Gym Fun Friday" = KNO)' },
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

  // Quick month presets
  const getMonthPresets = () => {
    const now = new Date();
    const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const monthAfter = new Date(now.getFullYear(), now.getMonth() + 2, 1);
    
    const fmt = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const lastDay = (d) => new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().split('T')[0];
    const monthName = (d) => d.toLocaleString('default', { month: 'long', year: 'numeric' });
    
    return [
      { label: monthName(thisMonth), start: `${fmt(thisMonth)}-01`, end: lastDay(thisMonth) },
      { label: monthName(nextMonth), start: `${fmt(nextMonth)}-01`, end: lastDay(nextMonth) },
      { label: monthName(monthAfter), start: `${fmt(monthAfter)}-01`, end: lastDay(monthAfter) },
    ];
  };

  const handleSaveRequirement = () => {
    onSave({
      is_permanent: false,
      start_date: reqStartDate || null,
      end_date: reqEndDate || null,
      gym_ids: [reqGym],
      program: reqProgram,
      scope: 'all_events',
      rule_type: 'requirement_exception',
      value: reqReason,
      label: `${reqProgram} excused for ${reqGym}`,
      note: null,
    });
  };

  const handleSaveValidation = () => {
    onSave({
      is_permanent: isPermanent,
      start_date: isPermanent ? null : startDate || null,
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

  // ============ PURPOSE SELECTION ============
  if (!purpose) {
    return (
      <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black bg-opacity-60" onClick={onCancel}>
        <div className="bg-white rounded-xl p-6 w-full max-w-md mx-4 shadow-2xl" onClick={e => e.stopPropagation()}>
          <div className="flex justify-between items-center mb-5">
            <h3 className="text-lg font-bold text-gray-800">What do you need?</h3>
            <button onClick={onCancel} className="text-gray-400 hover:text-gray-600 text-xl font-bold w-8 h-8 rounded-full flex items-center justify-center">×</button>
          </div>
          
          <div className="space-y-3">
            <button
              onClick={() => setPurpose('requirement')}
              className="w-full p-5 rounded-xl text-left transition-all hover:translate-y-[-2px]"
              style={{ background: 'linear-gradient(135deg, #f8f5ff, #f0ecff)', border: '2px solid rgba(139,111,111,0.15)', boxShadow: '0 2px 10px rgba(0,0,0,0.05)' }}
              onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 4px 20px rgba(139,111,111,0.15)'; e.currentTarget.style.borderColor = 'rgba(139,111,111,0.3)'; }}
              onMouseLeave={e => { e.currentTarget.style.boxShadow = '0 2px 10px rgba(0,0,0,0.05)'; e.currentTarget.style.borderColor = 'rgba(139,111,111,0.15)'; }}
            >
              <div className="font-bold text-gray-800 text-base">Requirement Exception</div>
              <div className="text-sm text-gray-500 mt-1">A gym is excused from a monthly requirement (clinic, KNO, open gym)</div>
              <div className="text-xs text-gray-400 mt-2 italic">Example: TIG doesn't need a clinic this month because it's internal</div>
            </button>
            
            <button
              onClick={() => setPurpose('validation')}
              className="w-full p-5 rounded-xl text-left transition-all hover:translate-y-[-2px]"
              style={{ background: 'linear-gradient(135deg, #f5f8f5, #ecf0ec)', border: '2px solid rgba(107,142,107,0.15)', boxShadow: '0 2px 10px rgba(0,0,0,0.05)' }}
              onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 4px 20px rgba(107,142,107,0.15)'; e.currentTarget.style.borderColor = 'rgba(107,142,107,0.3)'; }}
              onMouseLeave={e => { e.currentTarget.style.boxShadow = '0 2px 10px rgba(0,0,0,0.05)'; e.currentTarget.style.borderColor = 'rgba(107,142,107,0.15)'; }}
            >
              <div className="font-bold text-gray-800 text-base">Validation Rule</div>
              <div className="text-sm text-gray-500 mt-1">Set a valid price, time, or program name to prevent false errors</div>
              <div className="text-xs text-gray-400 mt-2 italic">Example: Homeschool Open Gym at EST is $10, before care at RBA is 8:30 AM</div>
            </button>
          </div>
          
          <div className="mt-4 pt-3 border-t">
            <button onClick={onCancel} className="text-sm text-gray-500 hover:text-gray-700">Cancel</button>
          </div>
        </div>
      </div>
    );
  }

  // ============ REQUIREMENT EXCEPTION FLOW (3 steps) ============
  if (purpose === 'requirement') {
    return (
      <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black bg-opacity-60" onClick={onCancel}>
        <div className="bg-white rounded-xl p-6 w-full max-w-md mx-4 shadow-2xl" onClick={e => e.stopPropagation()}>
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-bold text-gray-800">Requirement Exception — Step {reqStep} of 3</h3>
            <button onClick={onCancel} className="text-gray-400 hover:text-gray-600 text-xl font-bold w-8 h-8 rounded-full flex items-center justify-center">×</button>
          </div>
          
          <div className="flex gap-1 mb-6">
            {[1,2,3].map(s => (
              <div key={s} className={`h-1.5 flex-1 rounded-full ${s <= reqStep ? 'bg-purple-500' : 'bg-gray-200'}`} />
            ))}
          </div>

          {reqStep === 1 && (
            <div>
              <h4 className="font-semibold text-gray-700 mb-3">Which gym and requirement?</h4>
              <div className="mb-4">
                <label className="text-sm text-gray-600 block mb-2">Gym:</label>
                <div className="flex flex-wrap gap-2">
                  {(gyms || []).sort((a,b) => a.id.localeCompare(b.id)).map(gym => (
                    <button
                      key={gym.id}
                      onClick={() => setReqGym(gym.id)}
                      className={`px-3 py-2 rounded-lg border-2 text-sm font-medium transition-all ${reqGym === gym.id ? 'border-purple-500 bg-purple-100 text-purple-800' : 'border-gray-200 hover:border-purple-300'}`}
                    >
                      {gym.id}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-sm text-gray-600 block mb-2">Excused from which requirement?</label>
                <div className="flex gap-2">
                  {reqPrograms.map(p => (
                    <button
                      key={p}
                      onClick={() => setReqProgram(p)}
                      className={`px-4 py-2 rounded-lg border-2 font-medium text-sm transition-all ${reqProgram === p ? 'border-purple-500 bg-purple-100 text-purple-800' : 'border-gray-200 hover:border-purple-300'}`}
                    >
                      {p === 'KIDS NIGHT OUT' ? 'KNO' : p}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {reqStep === 2 && (
            <div>
              <h4 className="font-semibold text-gray-700 mb-3">What month?</h4>
              <div className="flex gap-2 mb-4">
                {getMonthPresets().map(preset => (
                  <button
                    key={preset.label}
                    onClick={() => { setReqStartDate(preset.start); setReqEndDate(preset.end); }}
                    className={`px-4 py-2 rounded-lg border-2 text-sm font-medium transition-all ${reqStartDate === preset.start ? 'border-purple-500 bg-purple-100 text-purple-800' : 'border-gray-200 hover:border-purple-300'}`}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
              <div className="text-xs text-gray-500 mt-2">Or set custom dates:</div>
              <div className="flex gap-3 mt-2">
                <div className="flex-1">
                  <label className="text-xs text-gray-500 block mb-1">Start:</label>
                  <input type="date" value={reqStartDate} onChange={e => setReqStartDate(e.target.value)} className="px-3 py-2 border border-gray-300 rounded-lg w-full text-sm" />
                </div>
                <div className="flex-1">
                  <label className="text-xs text-gray-500 block mb-1">End:</label>
                  <input type="date" value={reqEndDate} onChange={e => setReqEndDate(e.target.value)} className="px-3 py-2 border border-gray-300 rounded-lg w-full text-sm" />
                </div>
              </div>
            </div>
          )}

          {reqStep === 3 && (
            <div>
              <h4 className="font-semibold text-gray-700 mb-3">Why is {reqGym} excused from {reqProgram === 'KIDS NIGHT OUT' ? 'KNO' : reqProgram}?</h4>
              <input
                type="text"
                value={reqReason}
                onChange={e => setReqReason(e.target.value)}
                placeholder="e.g., Internal competitive clinic - students sign up directly"
                className="px-3 py-3 border border-gray-300 rounded-lg w-full text-sm"
                autoFocus
              />
              
              <div className="mt-4 p-3 bg-gray-50 rounded-lg text-xs text-gray-600">
                <div className="font-semibold mb-1">Summary:</div>
                <div>{reqGym} is excused from {reqProgram === 'KIDS NIGHT OUT' ? 'KNO' : reqProgram} requirement</div>
                <div>{reqStartDate} to {reqEndDate}</div>
                {reqReason && <div>Reason: {reqReason}</div>}
              </div>
            </div>
          )}

          <div className="flex justify-between mt-6 pt-4 border-t border-gray-200">
            <button
              onClick={() => reqStep > 1 ? setReqStep(reqStep - 1) : setPurpose('')}
              className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-800"
            >
              ← Back
            </button>
            {reqStep < 3 ? (
              <button
                onClick={() => setReqStep(reqStep + 1)}
                disabled={reqStep === 1 ? (!reqGym || !reqProgram) : (!reqStartDate || !reqEndDate)}
                className={`px-6 py-2 rounded-lg text-sm font-semibold transition-all ${(reqStep === 1 ? (reqGym && reqProgram) : (reqStartDate && reqEndDate)) ? 'bg-purple-600 text-white hover:bg-purple-700' : 'bg-gray-200 text-gray-400 cursor-not-allowed'}`}
              >
                Next →
              </button>
            ) : (
              <button
                onClick={handleSaveRequirement}
                disabled={!reqReason.trim()}
                className={`px-6 py-2 rounded-lg text-sm font-semibold transition-all ${reqReason.trim() ? 'bg-green-600 text-white hover:bg-green-700' : 'bg-gray-200 text-gray-400 cursor-not-allowed'}`}
              >
                Save Exception
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ============ VALIDATION RULE FLOW (5 steps) ============
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
    parts.push(isPermanent ? 'Permanent' : `${startDate || '?'} to ${endDate || '?'}`);
    parts.push(selectedGyms.includes('ALL') ? 'All gyms' : selectedGyms.join(', '));
    parts.push(program === 'ALL' ? 'All programs' : program);
    if (scope === 'keyword') parts.push(`"${keyword}"`);
    parts.push(`${ruleType}: ${value}`);
    return parts.join(' → ');
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black bg-opacity-60" onClick={onCancel}>
      <div className="bg-white rounded-xl p-6 w-full max-w-lg mx-4 shadow-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-bold text-gray-800">Validation Rule — Step {step} of 5</h3>
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
                onClick={() => { setIsPermanent(true); setStartDate(''); setEndDate(''); }}
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
                <div className="text-xs text-gray-500 mt-1">Has a start and end date</div>
              </button>
            </div>
            {!isPermanent && (
              <div className="mt-4 space-y-3">
                <div className="flex gap-2">
                  {getMonthPresets().map(preset => (
                    <button key={preset.label} type="button" onClick={() => { setStartDate(preset.start); setEndDate(preset.end); }} className={`px-3 py-1.5 text-xs rounded-lg font-medium transition-all ${startDate === preset.start ? 'bg-purple-100 border-purple-400 border-2' : 'bg-gray-100 hover:bg-gray-200 border-2 border-transparent'}`}>
                      {preset.label}
                    </button>
                  ))}
                </div>
                <div className="flex gap-3">
                  <div className="flex-1">
                    <label className="text-xs text-gray-500 block mb-1">Start:</label>
                    <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="px-3 py-2 border border-gray-300 rounded-lg w-full text-sm" />
                  </div>
                  <div className="flex-1">
                    <label className="text-xs text-gray-500 block mb-1">End:</label>
                    <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="px-3 py-2 border border-gray-300 rounded-lg w-full text-sm" />
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {step === 2 && (
          <div>
            <h4 className="font-semibold text-gray-700 mb-3">Which gym(s)?</h4>
            <div className="flex flex-wrap gap-2">
              <button onClick={() => toggleGym('ALL')} className={`px-4 py-2 rounded-lg border-2 font-medium text-sm transition-all ${selectedGyms.includes('ALL') ? 'border-purple-500 bg-purple-100 text-purple-800' : 'border-gray-200 hover:border-purple-300'}`}>All Gyms</button>
              {(gyms || []).sort((a,b) => a.id.localeCompare(b.id)).map(gym => (
                <button key={gym.id} onClick={() => toggleGym(gym.id)} className={`px-3 py-2 rounded-lg border-2 text-sm font-medium transition-all ${selectedGyms.includes(gym.id) ? 'border-purple-500 bg-purple-100 text-purple-800' : 'border-gray-200 hover:border-purple-300'}`}>{gym.id}</button>
              ))}
            </div>
          </div>
        )}

        {step === 3 && (
          <div>
            <h4 className="font-semibold text-gray-700 mb-3">Which program?</h4>
            <div className="flex flex-wrap gap-2">
              {programs.map(p => (
                <button key={p} onClick={() => setProgram(p)} className={`px-4 py-2 rounded-lg border-2 font-medium text-sm transition-all ${program === p ? 'border-purple-500 bg-purple-100 text-purple-800' : 'border-gray-200 hover:border-purple-300'}`}>{p === 'KIDS NIGHT OUT' ? 'KNO' : p}</button>
              ))}
            </div>
            {program === 'CAMP' && (
              <div className="mt-4">
                <label className="text-sm text-gray-600 block mb-2">Camp season:</label>
                <div className="flex gap-2">
                  {[{v: null, l: 'Both'}, {v: 'school_year', l: 'School Year'}, {v: 'summer', l: 'Summer'}].map(opt => (
                    <button key={opt.l} onClick={() => setCampSeason(opt.v)} className={`px-3 py-2 rounded-lg border-2 text-sm font-medium transition-all ${campSeason === opt.v ? 'border-purple-500 bg-purple-100' : 'border-gray-200 hover:border-purple-300'}`}>{opt.l}</button>
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
              <button onClick={() => { setScope('all_events'); setKeyword(''); }} className={`w-full p-4 rounded-lg border-2 text-left transition-all ${scope === 'all_events' ? 'border-purple-500 bg-purple-50' : 'border-gray-200 hover:border-purple-300'}`}>
                <div className="font-bold text-gray-800">All events in this program</div>
                <div className="text-xs text-gray-500 mt-1">Applies to every event matching above selections</div>
              </button>
              <button onClick={() => setScope('keyword')} className={`w-full p-4 rounded-lg border-2 text-left transition-all ${scope === 'keyword' ? 'border-purple-500 bg-purple-50' : 'border-gray-200 hover:border-purple-300'}`}>
                <div className="font-bold text-gray-800">Events with a specific keyword in the title</div>
                <div className="text-xs text-gray-500 mt-1">Only events whose title contains a word you specify</div>
              </button>
            </div>
            {scope === 'keyword' && (
              <div className="mt-4">
                <label className="text-sm text-gray-600 block mb-1">Title must contain:</label>
                <input type="text" value={keyword} onChange={e => setKeyword(e.target.value)} placeholder='e.g., "homeschool" or "movie night"' className="px-3 py-2 border border-gray-300 rounded-lg w-full text-sm" autoFocus />
              </div>
            )}
          </div>
        )}

        {step === 5 && (
          <div>
            <h4 className="font-semibold text-gray-700 mb-3">What's the rule?</h4>
            <div className="flex flex-wrap gap-2 mb-4">
              {ruleTypes.map(rt => (
                <button key={rt.value} onClick={() => setRuleType(rt.value)} className={`px-3 py-2 rounded-lg border-2 text-sm font-medium transition-all ${ruleType === rt.value ? 'border-purple-500 bg-purple-100 text-purple-800' : 'border-gray-200 hover:border-purple-300'}`}>{rt.label}</button>
              ))}
            </div>
            <div className="text-xs text-gray-500 mb-4">{ruleTypes.find(r => r.value === ruleType)?.desc}</div>

            {(ruleType === 'valid_price' || ruleType === 'price') && (
              <div>
                <label className="text-sm text-gray-600 block mb-1">Valid price (Kid 1):</label>
                <input type="text" value={value} onChange={e => setValue(e.target.value)} placeholder="e.g., 10" className="px-3 py-2 border border-gray-300 rounded-lg w-full text-sm" autoFocus />
              </div>
            )}
            {ruleType === 'sibling_price' && (
              <div className="space-y-3">
                <div><label className="text-sm text-gray-600 block mb-1">Kid 1 price:</label><input type="text" value={value} onChange={e => setValue(e.target.value)} placeholder="e.g., 40" className="px-3 py-2 border border-gray-300 rounded-lg w-full text-sm" autoFocus /></div>
                <div><label className="text-sm text-gray-600 block mb-1">Kid 2 price:</label><input type="text" value={valueKid2} onChange={e => setValueKid2(e.target.value)} placeholder="e.g., 35" className="px-3 py-2 border border-gray-300 rounded-lg w-full text-sm" /></div>
                <div><label className="text-sm text-gray-600 block mb-1">Kid 3 price:</label><input type="text" value={valueKid3} onChange={e => setValueKid3(e.target.value)} placeholder="e.g., 35" className="px-3 py-2 border border-gray-300 rounded-lg w-full text-sm" /></div>
              </div>
            )}
            {(ruleType === 'valid_time' || ruleType === 'time') && (
              <div><label className="text-sm text-gray-600 block mb-1">Valid time:</label><input type="text" value={value} onChange={e => setValue(e.target.value)} placeholder="e.g., 8:30 AM" className="px-3 py-2 border border-gray-300 rounded-lg w-full text-sm" autoFocus /></div>
            )}
            {ruleType === 'program_synonym' && (
              <div className="space-y-3">
                <div><label className="text-sm text-gray-600 block mb-1">The name/keyword:</label><input type="text" value={value} onChange={e => setValue(e.target.value)} placeholder='e.g., "gym fun friday"' className="px-3 py-2 border border-gray-300 rounded-lg w-full text-sm" autoFocus /></div>
                <div><label className="text-sm text-gray-600 block mb-1">Means this program:</label>
                  <div className="flex gap-2">{['KIDS NIGHT OUT', 'CLINIC', 'OPEN GYM', 'CAMP'].map(p => (<button key={p} onClick={() => setLabel(p)} className={`px-3 py-1.5 rounded-lg border-2 text-xs font-medium ${label === p ? 'border-purple-500 bg-purple-100' : 'border-gray-200'}`}>{p === 'KIDS NIGHT OUT' ? 'KNO' : p}</button>))}</div>
                </div>
              </div>
            )}
            {ruleType === 'exception' && (
              <div><label className="text-sm text-gray-600 block mb-1">What's the exception?</label><input type="text" value={value} onChange={e => setValue(e.target.value)} placeholder="Describe what's OK about this" className="px-3 py-2 border border-gray-300 rounded-lg w-full text-sm" autoFocus /></div>
            )}

            <div className="mt-4"><label className="text-sm text-gray-600 block mb-1">Label:</label><input type="text" value={label} onChange={e => setLabel(e.target.value)} placeholder="Short description" className="px-3 py-2 border border-gray-300 rounded-lg w-full text-sm" /></div>
            <div className="mt-3"><label className="text-sm text-gray-600 block mb-1">Note (optional):</label><input type="text" value={note} onChange={e => setNote(e.target.value)} placeholder="Additional context" className="px-3 py-2 border border-gray-300 rounded-lg w-full text-sm" /></div>
            <div className="mt-4 p-3 bg-gray-50 rounded-lg text-xs text-gray-600"><div className="font-semibold mb-1">Summary:</div>{getSummary()}</div>
          </div>
        )}

        <div className="flex justify-between mt-6 pt-4 border-t border-gray-200">
          <button onClick={() => step > 1 ? setStep(step - 1) : setPurpose('')} className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-800">{step > 1 ? '← Back' : '← Back'}</button>
          {step < 5 ? (
            <button onClick={() => setStep(step + 1)} disabled={!canProceed()} className={`px-6 py-2 rounded-lg text-sm font-semibold transition-all ${canProceed() ? 'bg-purple-600 text-white hover:bg-purple-700' : 'bg-gray-200 text-gray-400 cursor-not-allowed'}`}>Next →</button>
          ) : (
            <button onClick={handleSaveValidation} disabled={!canProceed()} className={`px-6 py-2 rounded-lg text-sm font-semibold transition-all ${canProceed() ? 'bg-green-600 text-white hover:bg-green-700' : 'bg-gray-200 text-gray-400 cursor-not-allowed'}`}>Save Rule</button>
          )}
        </div>
      </div>
    </div>
  );
}
