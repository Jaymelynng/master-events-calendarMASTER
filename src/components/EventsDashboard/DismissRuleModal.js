import React, { useState } from 'react';

/**
 * Custom modal that replaces window.confirm/prompt for dismissing validation errors.
 *
 * Flow:
 * 1. Shows the error being dismissed
 * 2. Note input (optional)
 * 3. Two clear action buttons:
 *    - "Accept Exception" = dismiss this one time only
 *    - "Make Permanent Rule" = dismiss + save as rule for this gym (only for eligible errors)
 *
 * Props:
 *   errorMessage - the error text being dismissed
 *   gymId - which gym this is for (e.g. "RBA")
 *   ruleEligible - boolean, whether this error type can become a rule
 *   ruleInfo - { ruleType: 'price'|'time', value: '20' } or null
 *   onDismiss(note, scope) - called when user wants to dismiss; scope: 'event_only' | 'all_in_program'
 *   onDismissAndRule(note, label) - called when user wants to dismiss AND create a rule
 *   onCancel() - called when user cancels entirely
 *   scopeOptions - 'both' = show "This event only" + "All in program"; 'event_only' = single Accept Exception button
 */
export default function DismissRuleModal({
  errorMessage,
  gymId,
  eventType,
  ruleEligible,
  ruleInfo,
  onDismiss,
  onDismissAndRule,
  onCancel,
  scopeOptions = 'event_only',
}) {
  const [note, setNote] = useState('');
  const [showLabelInput, setShowLabelInput] = useState(false);
  const [label, setLabel] = useState(ruleInfo?.suggestedLabel || '');

  const isProgramSynonym = ruleInfo?.ruleType === 'program_synonym';
  const displayValue = ruleInfo
    ? ruleInfo.ruleType === 'price'
      ? `$${ruleInfo.value}`
      : ruleInfo.value
    : '';

  const handleAcceptException = (scope) => {
    if (typeof onDismiss === 'function') {
      onDismiss(note || null, scope);
    } else {
      console.error('onDismiss is not a function:', onDismiss);
    }
  };

  const handleMakeRuleClick = () => {
    setShowLabelInput(true);
  };

  const handleSaveRule = () => {
    if (!label.trim()) {
      return; // Don't save without a label
    }
    onDismissAndRule(note || null, label.trim(), eventType);
  };

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black bg-opacity-60"
      onClick={onCancel}
    >
      <div
        className="bg-white rounded-xl p-6 w-full max-w-md mx-4 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex justify-between items-start mb-4">
          <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
            ✓ Dismiss Warning
          </h3>
          <button
            onClick={onCancel}
            className="text-gray-400 hover:text-gray-600 hover:bg-gray-100 text-xl font-bold leading-none w-8 h-8 rounded-full flex items-center justify-center cursor-pointer"
          >
            ×
          </button>
        </div>

        {/* Error being dismissed */}
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 mb-4 text-sm text-gray-700">
          {errorMessage}
        </div>

        {/* Note input */}
        <div className="mb-5">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Note <span className="text-gray-400 font-normal">(optional)</span>
          </label>
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Why is this OK? e.g. Before Care pricing"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !showLabelInput) {
                handleAcceptException('event_only');
              }
            }}
          />
        </div>

        {/* Label input for rule (shown after clicking "Make Permanent Rule") */}
        {showLabelInput && (
          <div className="mb-5 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <label className="block text-sm font-medium text-blue-800 mb-1">
              {isProgramSynonym
                ? `What program type is "${displayValue}"?`
                : `What is "${displayValue}"?`
              }
            </label>
            <input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder={isProgramSynonym ? 'e.g. OPEN GYM, CLINIC, KIDS NIGHT OUT' : 'e.g. Before Care, After Care, Early Dropoff'}
              className="w-full px-3 py-2 border border-blue-300 rounded-lg text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter' && label.trim()) {
                  handleSaveRule();
                }
              }}
            />
            <button
              onClick={handleSaveRule}
              disabled={!label.trim()}
              className={`mt-2 w-full px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
                label.trim()
                  ? 'bg-blue-600 text-white hover:bg-blue-700'
                  : 'bg-gray-200 text-gray-400 cursor-not-allowed'
              }`}
            >
              Save Rule for {gymId} ({eventType || 'CAMP'})
            </button>
          </div>
        )}

        {/* Action buttons */}
        {!showLabelInput && (
          <div className={`flex gap-3 ${ruleEligible ? '' : ''}`}>
            {scopeOptions === 'both' ? (
              <>
                <button
                  onClick={() => handleAcceptException('event_only')}
                  className="flex-1 px-3 py-2.5 bg-green-100 border-2 border-green-400 text-green-800 rounded-lg hover:bg-green-200 hover:border-green-500 transition-colors font-semibold text-sm cursor-pointer"
                >
                  This event only
                  <span className="block text-xs font-normal text-green-600 mt-0.5">
                    Dismiss for this one event
                  </span>
                </button>
                <button
                  onClick={() => handleAcceptException('all_in_program')}
                  className="flex-1 px-3 py-2.5 bg-teal-100 border-2 border-teal-400 text-teal-800 rounded-lg hover:bg-teal-200 hover:border-teal-500 transition-colors font-semibold text-sm cursor-pointer"
                >
                  All {eventType || 'events'} at {gymId}
                  <span className="block text-xs font-normal text-teal-600 mt-0.5">
                    Dismiss for this entire program at gym
                  </span>
                </button>
              </>
            ) : (
              <button
                onClick={() => handleAcceptException('event_only')}
                className="flex-1 px-4 py-3 bg-green-100 border-2 border-green-400 text-green-800 rounded-lg hover:bg-green-200 hover:border-green-500 transition-colors font-semibold text-sm cursor-pointer"
              >
                Accept Exception
                <span className="block text-xs font-normal text-green-600 mt-0.5">
                  Dismiss this one time
                </span>
              </button>
            )}

            {/* Only show Make Permanent Rule for eligible errors */}
            {ruleEligible && ruleInfo && (
              <button
                onClick={handleMakeRuleClick}
                className="flex-1 px-4 py-3 bg-blue-50 border-2 border-blue-300 text-blue-700 rounded-lg hover:bg-blue-100 hover:border-blue-400 transition-colors font-semibold text-sm"
              >
                Make Permanent Rule
                <span className="block text-xs font-normal text-blue-500 mt-0.5">
                  {isProgramSynonym
                    ? `Teach system "${displayValue}" = program type`
                    : `Never flag ${displayValue} on ${gymId}`
                  }
                </span>
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
