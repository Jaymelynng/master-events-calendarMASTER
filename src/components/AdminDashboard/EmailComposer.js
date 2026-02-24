import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';

export default function EmailComposer({ gyms, events, monthlyRequirements, currentMonth, currentYear, onClose }) {
  const [selectedGyms, setSelectedGyms] = useState([]);
  const [emailType, setEmailType] = useState('missing');
  const [customNote, setCustomNote] = useState('');
  const [sending, setSending] = useState(false);
  const [sentResults, setSentResults] = useState([]);
  const [previewGym, setPreviewGym] = useState(null);
  const [step, setStep] = useState(1);

  const monthName = new Date(currentYear, currentMonth).toLocaleString('default', { month: 'long', year: 'numeric' });

  const getGymData = (gym) => {
    const gymEvents = (events || []).filter(e => e.gym_id === gym.id);
    const clinicCount = gymEvents.filter(e => e.type === 'CLINIC').length;
    const knoCount = gymEvents.filter(e => e.type === 'KIDS NIGHT OUT').length;
    const openGymCount = gymEvents.filter(e => e.type === 'OPEN GYM').length;
    const clinicReq = monthlyRequirements?.['CLINIC'] || 1;
    const knoReq = monthlyRequirements?.['KIDS NIGHT OUT'] || 2;
    const ogReq = monthlyRequirements?.['OPEN GYM'] || 1;

    const missing = [];
    if (clinicCount < clinicReq) missing.push({ type: 'CLINIC', need: clinicReq - clinicCount });
    if (knoCount < knoReq) missing.push({ type: 'KNO', need: knoReq - knoCount });
    if (openGymCount < ogReq) missing.push({ type: 'OPEN GYM', need: ogReq - openGymCount });

    const dataErrors = gymEvents.filter(e => {
      const errors = (e.validation_errors || []).filter(err => err.type !== 'sold_out');
      return errors.some(err => {
        const cat = err.category || (err.type?.includes('mismatch') ? 'data_error' : 'formatting');
        return cat === 'data_error';
      });
    });

    return { clinicCount, knoCount, openGymCount, clinicReq, knoReq, ogReq, missing, dataErrors, meetsRequirements: missing.length === 0 };
  };

  const gymsWithIssues = (gyms || []).filter(g => {
    const data = getGymData(g);
    if (emailType === 'missing') return data.missing.length > 0;
    if (emailType === 'audit') return data.dataErrors.length > 0;
    return data.missing.length > 0 || data.dataErrors.length > 0;
  });

  const toggleGym = (gymId) => {
    setSelectedGyms(prev => prev.includes(gymId) ? prev.filter(g => g !== gymId) : [...prev, gymId]);
  };

  const selectAllWithIssues = () => {
    setSelectedGyms(gymsWithIssues.map(g => g.id));
  };

  const generateEmailHTML = (gym) => {
    const data = getGymData(gym);
    const hasMissing = data.missing.length > 0;
    const hasErrors = data.dataErrors.length > 0;

    return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<!--[if mso]><style>table,td{font-family:Arial,sans-serif!important}</style><![endif]-->
</head><body style="margin:0;padding:0;background-color:#f5f1f1;font-family:Arial,'Helvetica Neue',Helvetica,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f5f1f1;padding:20px 0;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">

<!-- Header -->
<tr><td style="background:linear-gradient(135deg,#b48f8f 0%,#8b6f6f 100%);padding:30px 40px;text-align:center;">
<h1 style="color:#ffffff;margin:0;font-size:22px;font-weight:700;letter-spacing:0.5px;">Monthly Events Update</h1>
<p style="color:rgba(255,255,255,0.85);margin:8px 0 0;font-size:14px;">${monthName} — ${gym.name}</p>
</td></tr>

<!-- Greeting -->
<tr><td style="padding:30px 40px 15px;">
<p style="color:#2a2a2a;font-size:15px;line-height:1.6;margin:0;">Hi ${gym.manager_name || 'Team'},</p>
<p style="color:#555;font-size:14px;line-height:1.6;margin:10px 0 0;">I just ran the ${monthName} compliance check for your location. Here's what I found:</p>
</td></tr>

${hasMissing && (emailType === 'missing' || emailType === 'both') ? `
<!-- Missing Events Section -->
<tr><td style="padding:0 40px 20px;">
<table width="100%" cellpadding="0" cellspacing="0" style="background-color:#fef2f2;border-radius:8px;border-left:4px solid #c27878;overflow:hidden;">
<tr><td style="padding:20px;">
<h2 style="color:#991b1b;font-size:15px;margin:0 0 12px;font-weight:700;">Missing Events for ${monthName}</h2>
<table width="100%" cellpadding="0" cellspacing="0">
<tr style="background-color:#fee2e2;">
<td style="padding:8px 12px;font-size:12px;font-weight:700;color:#991b1b;border-bottom:1px solid #fecaca;">Event Type</td>
<td style="padding:8px 12px;font-size:12px;font-weight:700;color:#991b1b;border-bottom:1px solid #fecaca;text-align:center;">Needed</td>
<td style="padding:8px 12px;font-size:12px;font-weight:700;color:#991b1b;border-bottom:1px solid #fecaca;text-align:center;">Have</td>
<td style="padding:8px 12px;font-size:12px;font-weight:700;color:#991b1b;border-bottom:1px solid #fecaca;text-align:center;">Short</td>
</tr>
${data.missing.map(m => {
  const have = m.type === 'CLINIC' ? data.clinicCount : m.type === 'KNO' ? data.knoCount : data.openGymCount;
  const req = m.type === 'CLINIC' ? data.clinicReq : m.type === 'KNO' ? data.knoReq : data.ogReq;
  return `<tr>
<td style="padding:10px 12px;font-size:13px;color:#2a2a2a;border-bottom:1px solid #fecaca;font-weight:600;">${m.type}</td>
<td style="padding:10px 12px;font-size:13px;color:#555;border-bottom:1px solid #fecaca;text-align:center;">${req}</td>
<td style="padding:10px 12px;font-size:13px;color:#555;border-bottom:1px solid #fecaca;text-align:center;">${have}</td>
<td style="padding:10px 12px;font-size:13px;color:#dc2626;border-bottom:1px solid #fecaca;text-align:center;font-weight:700;">+${m.need}</td>
</tr>`;
}).join('')}
</table>
<p style="color:#991b1b;font-size:12px;margin:12px 0 0;line-height:1.5;">Please set these up in iClassPro as soon as possible so they're live for parents to register.</p>
</td></tr>
</table>
</td></tr>` : ''}

${hasErrors && (emailType === 'audit' || emailType === 'both') ? `
<!-- Data Errors Section -->
<tr><td style="padding:0 40px 20px;">
<table width="100%" cellpadding="0" cellspacing="0" style="background-color:#fffbeb;border-radius:8px;border-left:4px solid #d97706;overflow:hidden;">
<tr><td style="padding:20px;">
<h2 style="color:#92400e;font-size:15px;margin:0 0 12px;font-weight:700;">Data Issues Found (${data.dataErrors.length} event${data.dataErrors.length !== 1 ? 's' : ''})</h2>
${data.dataErrors.slice(0, 5).map(event => {
  const errors = (event.validation_errors || []).filter(e => e.type !== 'sold_out' && (e.category === 'data_error' || e.type?.includes('mismatch')));
  return `<div style="background:#ffffff;border:1px solid #fde68a;border-radius:6px;padding:12px;margin-bottom:8px;">
<div style="font-size:13px;font-weight:600;color:#2a2a2a;margin-bottom:4px;">${(event.title || '').substring(0, 60)}</div>
<div style="font-size:11px;color:#888;margin-bottom:6px;">${event.date} • ${event.type}</div>
${errors.map(err => `<div style="font-size:12px;color:#dc2626;padding:4px 0;border-top:1px solid #fef3c7;">• ${err.message}</div>`).join('')}
</div>`;
}).join('')}
${data.dataErrors.length > 5 ? `<p style="color:#92400e;font-size:12px;margin:8px 0 0;">...and ${data.dataErrors.length - 5} more. Full report available in the admin dashboard.</p>` : ''}
</td></tr>
</table>
</td></tr>` : ''}

${customNote ? `
<!-- Custom Note -->
<tr><td style="padding:0 40px 20px;">
<table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f0f4ff;border-radius:8px;border-left:4px solid #6366f1;overflow:hidden;">
<tr><td style="padding:20px;">
<p style="color:#312e81;font-size:14px;margin:0;line-height:1.6;">${customNote.replace(/\n/g, '<br>')}</p>
</td></tr>
</table>
</td></tr>` : ''}

<!-- Monthly Requirements Reference -->
<tr><td style="padding:0 40px 20px;">
<table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f8f9fa;border-radius:8px;overflow:hidden;">
<tr><td style="padding:16px 20px;">
<h3 style="color:#555;font-size:12px;margin:0 0 8px;text-transform:uppercase;letter-spacing:0.5px;">Monthly Requirements</h3>
<p style="color:#888;font-size:12px;margin:0;line-height:1.8;">
${data.clinicReq} Clinic${data.clinicReq !== 1 ? 's' : ''} &nbsp;•&nbsp;
${data.knoReq} KNO${data.knoReq !== 1 ? 's' : ''} &nbsp;•&nbsp;
${data.ogReq} Open Gym${data.ogReq !== 1 ? 's' : ''}
</p>
</td></tr>
</table>
</td></tr>

<!-- CTA -->
<tr><td style="padding:0 40px 25px;">
<p style="color:#555;font-size:13px;line-height:1.6;margin:0;">If there's something I'm missing or a reason these aren't set up, just let me know so I can note it on my end.</p>
</td></tr>

<!-- Sign off -->
<tr><td style="padding:0 40px 30px;">
<p style="color:#2a2a2a;font-size:14px;margin:0;">Thanks,<br><strong>Jayme</strong></p>
</td></tr>

<!-- Footer -->
<tr><td style="background-color:#f5f1f1;padding:20px 40px;text-align:center;border-top:1px solid #e8e0e0;">
<p style="color:#999;font-size:11px;margin:0;">Sent from Team Calendar • Master Events Hub</p>
</td></tr>

</table>
</td></tr>
</table>
</body></html>`;
  };

  const generateSubject = (gym) => {
    const data = getGymData(gym);
    if (emailType === 'missing') return `${monthName} — Missing Events for ${gym.name}`;
    if (emailType === 'audit') return `${monthName} — Data Audit for ${gym.name}`;
    return `${monthName} — Events Update for ${gym.name}`;
  };

  const handleSendAll = async () => {
    setSending(true);
    const results = [];
    const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';
    const API_KEY = process.env.REACT_APP_API_KEY || '';
    const headers = { 'Content-Type': 'application/json' };
    if (API_KEY) headers['X-API-Key'] = API_KEY;

    for (const gymId of selectedGyms) {
      const gym = gyms.find(g => g.id === gymId);
      if (!gym || !gym.manager_email) {
        results.push({ gymId, success: false, error: 'No manager email' });
        continue;
      }

      try {
        const response = await fetch(`${API_URL}/send-email`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            to: gym.manager_email,
            to_name: gym.manager_name,
            subject: generateSubject(gym),
            html_body: generateEmailHTML(gym),
            cc: 'jgibson@powersgym.com',
          })
        });
        const data = await response.json();
        results.push({ gymId, gymName: gym.name, manager: gym.manager_name, ...data });
      } catch (err) {
        results.push({ gymId, gymName: gym.name, success: false, error: err.message });
      }
    }

    setSentResults(results);
    setSending(false);
    setStep(4);
  };

  const previewHTML = previewGym ? generateEmailHTML(previewGym) : '';

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black bg-opacity-50 overflow-y-auto p-4">
      <div className="bg-white rounded-xl w-full max-w-4xl my-4 shadow-2xl">
        {/* Header */}
        <div className="flex justify-between items-center px-6 py-4 border-b" style={{ backgroundColor: '#faf5f5' }}>
          <div>
            <h2 className="text-xl font-bold" style={{ color: '#8b6f6f' }}>Email Managers</h2>
            <p className="text-sm text-gray-500">{monthName}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl font-bold">×</button>
        </div>

        <div className="p-6">
          {/* Step 1: What to send */}
          {step === 1 && (
            <div>
              <h3 className="font-semibold text-gray-700 mb-4">What do you want to send?</h3>
              <div className="grid grid-cols-3 gap-3 mb-6">
                {[
                  { v: 'missing', l: 'Missing Events', d: 'Which events are missing for the month', icon: '📋' },
                  { v: 'audit', l: 'Data Errors', d: 'Wrong prices, times, dates in their events', icon: '🔍' },
                  { v: 'both', l: 'Both', d: 'Missing events + data errors combined', icon: '📊' },
                ].map(opt => (
                  <button
                    key={opt.v}
                    onClick={() => { setEmailType(opt.v); setSelectedGyms([]); }}
                    className={`p-4 rounded-xl border-2 text-left transition-all ${emailType === opt.v ? 'border-purple-500 bg-purple-50' : 'border-gray-200 hover:border-purple-300'}`}
                  >
                    <div className="text-2xl mb-2">{opt.icon}</div>
                    <div className="font-bold text-sm text-gray-800">{opt.l}</div>
                    <div className="text-xs text-gray-500 mt-1">{opt.d}</div>
                  </button>
                ))}
              </div>

              <div className="mb-4">
                <h4 className="font-semibold text-gray-700 mb-1 text-sm">Custom note to include (optional):</h4>
                <textarea
                  value={customNote}
                  onChange={e => setCustomNote(e.target.value)}
                  placeholder="e.g., Reminder: VIP email going out Monday with 50% off clinics. Early Bird and Flexible Camp discounts end this weekend."
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg text-sm resize-none h-24 focus:border-purple-400 focus:outline-none"
                />
              </div>

              <div className="flex justify-end">
                <button
                  onClick={() => { setStep(2); selectAllWithIssues(); }}
                  className="px-6 py-2.5 bg-purple-600 text-white rounded-lg font-semibold hover:bg-purple-700 transition-colors"
                >
                  Next — Select Gyms →
                </button>
              </div>
            </div>
          )}

          {/* Step 2: Select gyms */}
          {step === 2 && (
            <div>
              <h3 className="font-semibold text-gray-700 mb-4">
                {gymsWithIssues.length} gym{gymsWithIssues.length !== 1 ? 's' : ''} with {emailType === 'missing' ? 'missing events' : emailType === 'audit' ? 'data errors' : 'issues'}
              </h3>

              <div className="space-y-2 mb-6">
                {gymsWithIssues.map(gym => {
                  const data = getGymData(gym);
                  return (
                    <label key={gym.id} className={`flex items-center gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all ${selectedGyms.includes(gym.id) ? 'border-purple-400 bg-purple-50' : 'border-gray-200 hover:border-purple-200'}`}>
                      <input
                        type="checkbox"
                        checked={selectedGyms.includes(gym.id)}
                        onChange={() => toggleGym(gym.id)}
                        className="w-4 h-4 text-purple-600"
                      />
                      <div className="flex-1">
                        <div className="font-medium text-sm text-gray-800">{gym.name}</div>
                        <div className="text-xs text-gray-500">
                          {gym.manager_name || 'No manager'} • {gym.manager_email || 'No email'}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        {data.missing.length > 0 && (
                          <span className="px-2 py-0.5 rounded text-xs font-medium" style={{ backgroundColor: '#fee2e2', color: '#991b1b' }}>
                            {data.missing.map(m => `+${m.need} ${m.type}`).join(', ')}
                          </span>
                        )}
                        {data.dataErrors.length > 0 && (
                          <span className="px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-800">
                            {data.dataErrors.length} errors
                          </span>
                        )}
                      </div>
                    </label>
                  );
                })}
                {gymsWithIssues.length === 0 && (
                  <div className="text-center py-8 text-gray-500">
                    <div className="text-3xl mb-2">✅</div>
                    <div>All gyms are compliant! Nothing to send.</div>
                  </div>
                )}
              </div>

              <div className="flex justify-between">
                <button onClick={() => setStep(1)} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">← Back</button>
                <button
                  onClick={() => setStep(3)}
                  disabled={selectedGyms.length === 0}
                  className={`px-6 py-2.5 rounded-lg font-semibold transition-colors ${selectedGyms.length > 0 ? 'bg-purple-600 text-white hover:bg-purple-700' : 'bg-gray-200 text-gray-400 cursor-not-allowed'}`}
                >
                  Preview Emails ({selectedGyms.length}) →
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Preview */}
          {step === 3 && (
            <div>
              <h3 className="font-semibold text-gray-700 mb-4">Preview & Send</h3>

              <div className="flex gap-3 mb-4 flex-wrap">
                {selectedGyms.map(gymId => {
                  const gym = gyms.find(g => g.id === gymId);
                  return (
                    <button
                      key={gymId}
                      onClick={() => setPreviewGym(gym)}
                      className={`px-3 py-2 rounded-lg border-2 text-sm font-medium transition-all ${previewGym?.id === gymId ? 'border-purple-500 bg-purple-100' : 'border-gray-200 hover:border-purple-300'}`}
                    >
                      {gym?.id} — {gym?.manager_name}
                    </button>
                  );
                })}
              </div>

              {previewGym && (
                <div className="mb-4">
                  <div className="flex items-center gap-3 mb-2 text-sm text-gray-600">
                    <span><strong>To:</strong> {previewGym.manager_name} &lt;{previewGym.manager_email}&gt;</span>
                    <span><strong>CC:</strong> jgibson@powersgym.com</span>
                  </div>
                  <div className="text-sm text-gray-600 mb-3">
                    <strong>Subject:</strong> {generateSubject(previewGym)}
                  </div>
                  <div className="border rounded-lg overflow-hidden" style={{ maxHeight: '400px', overflowY: 'auto' }}>
                    <iframe
                      srcDoc={generateEmailHTML(previewGym)}
                      title="Email Preview"
                      style={{ width: '100%', height: '400px', border: 'none' }}
                    />
                  </div>

                  <div className="flex gap-2 mt-3">
                    <button
                      onClick={() => {
                        const subject = encodeURIComponent(generateSubject(previewGym));
                        const to = encodeURIComponent(previewGym.manager_email || '');
                        const cc = encodeURIComponent('jgibson@powersgym.com');
                        const body = encodeURIComponent(
                          `Hi ${previewGym.manager_name || 'Team'},\n\n` +
                          (getGymData(previewGym).missing.length > 0 ? 
                            `I just ran the ${monthName} compliance check and noticed ${previewGym.name} is missing:\n` +
                            getGymData(previewGym).missing.map(m => `  - ${m.need} more ${m.type}`).join('\n') + '\n\n' +
                            `Our monthly requirements are ${monthlyRequirements?.['CLINIC'] || 1} Clinic, ${monthlyRequirements?.['KIDS NIGHT OUT'] || 2} KNO, and ${monthlyRequirements?.['OPEN GYM'] || 1} Open Gym.\n\n`
                          : '') +
                          (getGymData(previewGym).dataErrors.length > 0 ?
                            `I also found ${getGymData(previewGym).dataErrors.length} data issue${getGymData(previewGym).dataErrors.length !== 1 ? 's' : ''} that need attention. I'll send details separately.\n\n`
                          : '') +
                          (customNote ? customNote + '\n\n' : '') +
                          `If there's a reason something isn't set up that I should know about, just let me know.\n\nThanks,\nJayme`
                        );
                        window.open(`https://outlook.office.com/mail/deeplink/compose?to=${to}&cc=${cc}&subject=${subject}&body=${body}`, '_blank');
                      }}
                      className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors flex items-center justify-center gap-2 text-sm"
                    >
                      Open in Outlook
                    </button>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(generateEmailHTML(previewGym));
                        alert('HTML copied! Paste into an email using "Insert as HTML" or use the Outlook button instead.');
                      }}
                      className="px-4 py-2.5 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 transition-colors text-sm"
                    >
                      Copy HTML
                    </button>
                    <button
                      onClick={() => {
                        const subject = generateSubject(previewGym);
                        const to = previewGym.manager_email || '';
                        navigator.clipboard.writeText(`To: ${to}\nCC: jgibson@powersgym.com\nSubject: ${subject}`);
                        alert(`Copied!\nTo: ${to}\nSubject: ${subject}`);
                      }}
                      className="px-4 py-2.5 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 transition-colors text-sm"
                    >
                      Copy Details
                    </button>
                  </div>
                </div>
              )}

              {selectedGyms.length > 1 && previewGym && (
                <div className="mb-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
                  <div className="text-sm text-blue-800 font-medium mb-2">Quick open all in Outlook:</div>
                  <div className="flex flex-wrap gap-2">
                    {selectedGyms.map(gymId => {
                      const gym = gyms.find(g => g.id === gymId);
                      if (!gym) return null;
                      return (
                        <button
                          key={gymId}
                          onClick={() => {
                            const subject = encodeURIComponent(generateSubject(gym));
                            const to = encodeURIComponent(gym.manager_email || '');
                            const cc = encodeURIComponent('jgibson@powersgym.com');
                            const data = getGymData(gym);
                            const body = encodeURIComponent(
                              `Hi ${gym.manager_name || 'Team'},\n\n` +
                              (data.missing.length > 0 ?
                                `I just ran the ${monthName} compliance check and noticed ${gym.name} is missing:\n` +
                                data.missing.map(m => `  - ${m.need} more ${m.type}`).join('\n') + '\n\n' +
                                `Our monthly requirements are ${monthlyRequirements?.['CLINIC'] || 1} Clinic, ${monthlyRequirements?.['KIDS NIGHT OUT'] || 2} KNO, and ${monthlyRequirements?.['OPEN GYM'] || 1} Open Gym.\n\n`
                              : '') +
                              (data.dataErrors.length > 0 ?
                                `I also found ${data.dataErrors.length} data issue${data.dataErrors.length !== 1 ? 's' : ''} that need attention.\n\n`
                              : '') +
                              (customNote ? customNote + '\n\n' : '') +
                              `If there's a reason something isn't set up that I should know about, just let me know.\n\nThanks,\nJayme`
                            );
                            window.open(`https://outlook.office.com/mail/deeplink/compose?to=${to}&cc=${cc}&subject=${subject}&body=${body}`, '_blank');
                          }}
                          className="px-3 py-1.5 bg-blue-600 text-white rounded text-xs font-medium hover:bg-blue-700 transition-colors"
                        >
                          Open {gym.id} →
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="flex justify-between">
                <button onClick={() => setStep(2)} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">← Back</button>
                <button
                  onClick={handleSendAll}
                  disabled={sending}
                  className="px-8 py-3 bg-green-600 text-white rounded-lg font-bold hover:bg-green-700 transition-colors flex items-center gap-2"
                  title="Requires Resend or Power Automate setup"
                >
                  {sending ? (
                    <><span className="animate-spin">⏳</span> Sending...</>
                  ) : (
                    <>Send {selectedGyms.length} Email{selectedGyms.length !== 1 ? 's' : ''} (Auto)</>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Step 4: Results */}
          {step === 4 && (
            <div>
              <h3 className="font-semibold text-gray-700 mb-4">Sent!</h3>
              <div className="space-y-2 mb-6">
                {sentResults.map((r, i) => (
                  <div key={i} className={`flex items-center gap-3 p-3 rounded-lg border ${r.success ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                    <span className="text-xl">{r.success ? '✅' : '❌'}</span>
                    <div>
                      <div className="font-medium text-sm">{r.gymName} — {r.manager}</div>
                      <div className="text-xs text-gray-500">{r.success ? r.message : r.error}</div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex justify-end">
                <button onClick={onClose} className="px-6 py-2.5 bg-purple-600 text-white rounded-lg font-semibold hover:bg-purple-700">Done</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
