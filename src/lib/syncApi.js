/**
 * Sync API - Functions for syncing events with external sources
 * 
 * This module handles communication with the automation API server
 * (either local or Railway-hosted) for automated event collection.
 */

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
 * Sync events for a specific gym and event type
 * 
 * @param {string} gymId - The gym ID (e.g., 'RBA', 'CCP')
 * @param {string} eventType - The event type (e.g., 'KIDS NIGHT OUT', 'CLINIC')
 * @returns {Promise<{success: boolean, events?: Array, error?: string}>}
 */
export const syncEvents = async (gymId, eventType) => {
  const API_URL = getApiUrl();
  
  try {
    const response = await fetch(`${API_URL}/sync-events`, {
      method: 'POST',
      headers: buildHeaders(),
      body: JSON.stringify({
        gymId,
        eventType
      })
    });

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
    return {
      success: false,
      error: `Failed to connect to API server at ${API_URL}: ${error.message}`,
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
    const response = await fetch(`${API_URL}/import-events`, {
      method: 'POST',
      headers: buildHeaders(),
      body: JSON.stringify({
        gymId,
        eventType,
        events
      })
    });

    const data = await response.json();
    return data;
  } catch (error) {
    return {
      success: false,
      error: `Failed to import events: ${error.message}`
    };
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
    const response = await fetch(`${API_URL}/gyms`);
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
    const response = await fetch(url);
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
    const response = await fetch(`${API_URL}/health`);
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
