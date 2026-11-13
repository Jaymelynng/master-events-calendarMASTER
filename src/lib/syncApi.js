/**
 * Sync API - Functions for syncing events with external sources
 *
 * This module handles communication with the automation API server
 * (either local or Railway-hosted) for automated event collection.
 *
 * Added May 2026 (triaged from old Copilot draft PR #7):
 * - fetchWithTimeout — wraps fetch in an AbortController so calls fail
 *   after a deadline instead of hanging forever when Railway is slow.
 * - retryWithBackoff — retries on transient network / 5xx errors with
 *   exponential backoff. 4xx client errors fail fast (no retry).
 */

// Timeouts per endpoint type (ms). Sync can take a while; reads should be snappy.
const TIMEOUTS = {
  sync: 120000,   // 2 min — single-gym sync can take ~30-90s
  import: 60000,  // 1 min — writing to Supabase
  read: 15000,    // 15 sec — gyms, event-types, health
};

const MAX_RETRIES = 2;          // total tries = 1 + MAX_RETRIES
const BASE_BACKOFF_MS = 1000;   // first retry waits 1s, then 2s

/**
 * Get the API URL from environment or default to localhost
 */
const getApiUrl = () => {
  return process.env.REACT_APP_API_URL || 'http://localhost:5000';
};

/**
 * Get API key for authenticated requests (if configured)
 */
const getApiKey = () => {
  return process.env.REACT_APP_API_KEY || '';
};

/**
 * Build headers for API requests
 */
const buildHeaders = () => {
  const headers = {
    'Content-Type': 'application/json',
  };

  const apiKey = getApiKey();
  if (apiKey) {
    headers['X-API-Key'] = apiKey;
  }

  return headers;
};

/**
 * fetch + AbortController — gives every API call a deadline.
 * Throws an Error with .name = 'AbortError' on timeout so callers can
 * distinguish "Railway hung" from "Railway returned 500".
 */
const fetchWithTimeout = async (url, options, timeoutMs) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    return response;
  } finally {
    clearTimeout(timeoutId);
  }
};

/**
 * Retry on transient failures. 4xx client errors fail fast (won't retry).
 * Network errors + 5xx + AbortError get retried up to MAX_RETRIES times
 * with exponential backoff.
 */
const retryWithBackoff = async (fn, label) => {
  let lastErr;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await fn();
      // 4xx — client error, don't retry, return the response so callers see the real error
      if (response.status >= 400 && response.status < 500) {
        return response;
      }
      // 5xx — server error, retry if we have attempts left
      if (response.status >= 500 && attempt < MAX_RETRIES) {
        const wait = BASE_BACKOFF_MS * Math.pow(2, attempt);
        console.warn(`[syncApi] ${label} got ${response.status}, retrying in ${wait}ms (attempt ${attempt + 1}/${MAX_RETRIES})`);
        await new Promise(r => setTimeout(r, wait));
        continue;
      }
      return response;
    } catch (err) {
      lastErr = err;
      // Network failure or timeout. Retry unless we're out of attempts.
      if (attempt < MAX_RETRIES) {
        const wait = BASE_BACKOFF_MS * Math.pow(2, attempt);
        console.warn(`[syncApi] ${label} threw "${err.message}", retrying in ${wait}ms (attempt ${attempt + 1}/${MAX_RETRIES})`);
        await new Promise(r => setTimeout(r, wait));
        continue;
      }
    }
  }
  throw lastErr;
};

/**
 * Sync events for a specific gym and event type
 *
 * @param {string} gymId - The gym ID (e.g., 'RBA', 'CCP')
 * @param {string} eventType - The event type (e.g., 'KIDS NIGHT OUT', 'CLINIC')
 * @returns {Promise<{success: boolean, events?: Array, error?: string}>}
 */
export const syncEvents = async (gymId, eventType) => {
  const API_URL = getApiUrl();

  try {
    const response = await retryWithBackoff(
      () => fetchWithTimeout(`${API_URL}/sync-events`, {
        method: 'POST',
        headers: buildHeaders(),
        body: JSON.stringify({ gymId, eventType })
      }, TIMEOUTS.sync),
      `syncEvents(${gymId}, ${eventType})`
    );

    const data = await response.json();

    if (data.success && data.events) {
      return {
        success: true,
        events: data.events,
        eventsFound: data.eventsFound,
        message: data.message
      };
    } else {
      return {
        success: false,
        error: data.error || 'No events found',
        events: []
      };
    }
  } catch (error) {
    const friendly = error.name === 'AbortError'
      ? `Sync timed out after ${TIMEOUTS.sync / 1000}s for ${gymId} / ${eventType}. Railway may be slow — try again in a moment.`
      : `Failed to connect to API server at ${API_URL}: ${error.message}`;
    return {
      success: false,
      error: friendly,
      events: []
    };
  }
};

/**
 * Import events to Supabase via the API server
 *
 * @param {string} gymId - The gym ID
 * @param {string} eventType - The event type
 * @param {Array} events - Array of events to import
 * @returns {Promise<{success: boolean, imported?: number, error?: string}>}
 */
export const importEvents = async (gymId, eventType, events) => {
  const API_URL = getApiUrl();

  try {
    const response = await retryWithBackoff(
      () => fetchWithTimeout(`${API_URL}/import-events`, {
        method: 'POST',
        headers: buildHeaders(),
        body: JSON.stringify({ gymId, eventType, events })
      }, TIMEOUTS.import),
      `importEvents(${gymId}, ${eventType}, ${events.length} events)`
    );

    const data = await response.json();
    return data;
  } catch (error) {
    const friendly = error.name === 'AbortError'
      ? `Import timed out after ${TIMEOUTS.import / 1000}s. Try again.`
      : `Failed to import events: ${error.message}`;
    return {
      success: false,
      error: friendly
    };
  }
};

/**
 * Ask Railway to read these gyms' iClass setup (signed-in, read-only: every camp's settings, each
 * day's enrollment, price tables, gym settings). Railway puts them in a line and reads SETUP_READERS (3) gyms at a
 * time (~1 min each); each result lands in the iclass_setup_reads table. Answers right away.
 *
 * @param {string[]} gymIds - gym codes, e.g. ['SGT']
 * @returns {Promise<{success: boolean, waiting?: string[], error?: string}>}
 */
export const startSetupRead = async (gymIds) => {
  const API_URL = getApiUrl();
  try {
    const response = await fetchWithTimeout(`${API_URL}/setup-read`, {
      method: 'POST',
      headers: buildHeaders(),
      body: JSON.stringify({ what: 'full', gyms: gymIds }),
    }, TIMEOUTS.read);
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.success) {
      return { success: false, error: data.error || `Railway answered ${response.status}` };
    }
    return data;
  } catch (error) {
    return { success: false, error: error.name === 'AbortError' ? 'Railway did not answer' : error.message };
  }
};

/**
 * Run camp audit (Admin > Camp Audit). Railway audits these gyms one at a time in the background
 * (automation/camp_audit_job.py) and writes each gym's progress and rows to camp_audit_runs /
 * camp_audit_gym_results, which the Camp Audit tab reads. Answers right away with the run id; a press while
 * a run is going answers with that run instead of starting a second one.
 *
 * @param {string[]} gymIds - calendar gym codes, e.g. ['AAG', 'SGT']
 * @returns {Promise<{success: boolean, started?: boolean, run_id?: number, reason?: string, error?: string}>}
 */
export const startCampAudit = async (gymIds) => {
  const API_URL = getApiUrl();
  try {
    const response = await fetchWithTimeout(`${API_URL}/camp-audit`, {
      method: 'POST',
      headers: buildHeaders(),
      body: JSON.stringify({ gyms: gymIds }),
    }, TIMEOUTS.read);
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.success) {
      return { success: false, error: data.error || `Railway answered ${response.status}` };
    }
    return data;
  } catch (error) {
    return { success: false, error: error.name === 'AbortError' ? 'Railway did not answer' : error.message };
  }
};

/**
 * Save an edit to one gym's audit email (Admin > Camp Audit). Railway writes it with its service key
 * (automation/camp_audit_job.py save_gym_edit), so the audit tables stay read-only to the public.
 *
 * @param {string} gymId - calendar gym code, e.g. 'AAG'
 * @param {object} patch - any of rows, hidden, subject, gm, intro, signoff, status
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export const saveCampAuditEdit = async (gymId, patch) => {
  const API_URL = getApiUrl();
  try {
    const response = await fetchWithTimeout(`${API_URL}/camp-audit/edit`, {
      method: 'POST',
      headers: buildHeaders(),
      body: JSON.stringify({ gym: gymId, patch }),
    }, TIMEOUTS.read);
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.success) return { success: false, error: data.error || `Railway answered ${response.status}` };
    return data;
  } catch (error) {
    return { success: false, error: error.name === 'AbortError' ? 'Railway did not answer' : error.message };
  }
};

/**
 * Get list of available gyms from the API
 *
 * @returns {Promise<{success: boolean, gyms?: Array, error?: string}>}
 */
export const getGyms = async () => {
  const API_URL = getApiUrl();

  try {
    const response = await fetchWithTimeout(`${API_URL}/gyms`, {}, TIMEOUTS.read);
    const data = await response.json();
    return data;
  } catch (error) {
    return {
      success: false,
      error: `Failed to fetch gyms: ${error.message}`
    };
  }
};

/**
 * Get available event types for a gym
 *
 * @param {string} gymId - Optional gym ID to filter event types
 * @returns {Promise<{success: boolean, eventTypes?: Array, error?: string}>}
 */
export const getEventTypes = async (gymId = null) => {
  const API_URL = getApiUrl();
  const url = gymId
    ? `${API_URL}/event-types?gymId=${gymId}`
    : `${API_URL}/event-types`;

  try {
    const response = await fetchWithTimeout(url, {}, TIMEOUTS.read);
    const data = await response.json();
    return data;
  } catch (error) {
    return {
      success: false,
      error: `Failed to fetch event types: ${error.message}`
    };
  }
};

/**
 * Check if the API server is healthy
 *
 * @returns {Promise<{ok: boolean, url: string, error?: string}>}
 */
export const checkHealth = async () => {
  const API_URL = getApiUrl();

  try {
    const response = await fetchWithTimeout(`${API_URL}/health`, {}, TIMEOUTS.read);
    const data = await response.json();
    return {
      ok: data.status === 'ok',
      url: API_URL,
      message: data.message
    };
  } catch (error) {
    return {
      ok: false,
      url: API_URL,
      error: error.message
    };
  }
};
