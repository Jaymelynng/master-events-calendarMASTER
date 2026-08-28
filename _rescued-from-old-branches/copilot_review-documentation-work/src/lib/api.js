import { supabase } from './supabase'

// Gyms API
export const gymsApi = {
  async getAll() {
    const { data, error } = await supabase
      .from('gyms')
      .select('*')
      .order('name')
    
    if (error) throw new Error(error.message)
    return data
  },

  async create(gym) {
    const { data, error } = await supabase
      .from('gyms')
      .insert([gym])
      .select()
      .single()
    
    if (error) throw new Error(error.message)
    return data
  },

  async update(id, updates) {
    const { data, error } = await supabase
      .from('gyms')
      .update(updates)
      .eq('id', id)
      .select()
      .single()
    
    if (error) throw new Error(error.message)
    return data
  },

  async delete(id) {
    const { error } = await supabase
      .from('gyms')
      .delete()
      .eq('id', id)
    
    if (error) throw new Error(error.message)
  }
}

// Events API
export const eventsApi = {
  // Bulk import for admin workflow
  async bulkImport(events) {
    if (!events || !Array.isArray(events) || events.length === 0) {
      throw new Error('Invalid events data: must be non-empty array');
    }
    
    // Validate each event has required fields
    for (let i = 0; i < events.length; i++) {
      const event = events[i];
      if (!event.gym_id || !event.date || !event.type || !event.event_url || !event.title) {
        throw new Error(`Event ${i + 1} missing required fields (gym_id, title, date, type, event_url)`);
      }
      
      // Auto-populate start_date and end_date if missing
      if (!event.start_date) event.start_date = event.date;
      if (!event.end_date) event.end_date = event.start_date || event.date;
      
      // Validate date format
      const dateTest = new Date(event.date);
      if (isNaN(dateTest.getTime())) {
        throw new Error(`Event ${i + 1} has invalid date format: ${event.date}`);
      }
    }
    
    try {
      // Get list of existing event URLs (including soft-deleted ones)
      const eventUrls = events.map(e => e.event_url);
      const { data: existingEvents, error: checkError } = await supabase
        .from('events')
        .select('id, event_url, deleted_at')
        .in('event_url', eventUrls);
      
      if (checkError) {
        console.error('❌ Error checking existing events:', checkError);
        throw new Error(`Failed to check existing events: ${checkError.message}`);
      }
      
      // Separate existing events into active and soft-deleted
      const activeUrls = new Set();
      const softDeletedByUrl = new Map();
      
      for (const event of (existingEvents || [])) {
        if (event.deleted_at) {
          softDeletedByUrl.set(event.event_url, event.id);
        } else {
          activeUrls.add(event.event_url);
        }
      }
      
      // Separate events into: truly new, need restore (soft-deleted), and duplicates
      const trulyNewEvents = [];
      const eventsToRestore = [];
      
      for (const event of events) {
        if (activeUrls.has(event.event_url)) {
          // Already exists and is active - skip
          continue;
        } else if (softDeletedByUrl.has(event.event_url)) {
          // Was soft-deleted - needs to be restored with updated data
          eventsToRestore.push({
            id: softDeletedByUrl.get(event.event_url),
            ...event,
            deleted_at: null  // Clear the deletion
          });
        } else {
          // Truly new event
          trulyNewEvents.push(event);
        }
      }
      
      let importedEvents = [];
      
      // Restore soft-deleted events (update them with new data and clear deleted_at)
      if (eventsToRestore.length > 0) {
        for (const event of eventsToRestore) {
          const { id, ...updateData } = event;
          const { data: restored, error: restoreError } = await supabase
            .from('events')
            .update({ ...updateData, updated_at: new Date().toISOString() })
            .eq('id', id)
            .select();
          
          if (restoreError) {
            console.error(`❌ Error restoring event ${id}:`, restoreError);
          } else if (restored && restored.length > 0) {
            importedEvents.push(restored[0]);
          }
        }
      }
      
      // Insert truly new events
      if (trulyNewEvents.length > 0) {
        const { data, error } = await supabase
          .from('events')
          .insert(trulyNewEvents)
          .select();
        
        if (error) {
          console.error('❌ Supabase bulk import error:', error);
          throw new Error(`Database error: ${error.message}`);
        }
        
        importedEvents = [...importedEvents, ...(data || [])];
      }
      
      return importedEvents;
    } catch (networkError) {
      console.error('❌ Network error during bulk import:', networkError);
      throw new Error(`Failed to save events: ${networkError.message}`);
    }
  },

  async getAll(startDate, endDate, includeDeleted = false) {
    // For multi-day events, we need to fetch:
    // 1. Events that START within the date range (date >= startDate AND date <= endDate)
    // 2. Events that SPAN into the date range (start_date < startDate AND end_date >= startDate)
    
    let query = supabase
      .from('events_with_gym')
      .select('*')
      .order('date', { ascending: true })
    
    if (startDate && endDate) {
      // Use OR to get both:
      // - Events starting in range: date >= startDate AND date <= endDate
      // - Multi-day events spanning into range: start_date < startDate AND end_date >= startDate
      query = query.or(`and(date.gte.${startDate},date.lte.${endDate}),and(start_date.lt.${startDate},end_date.gte.${startDate})`)
    } else if (startDate) {
      query = query.gte('date', startDate)
    } else if (endDate) {
      query = query.lte('date', endDate)
    }
    
    // Filter out deleted events unless explicitly requested
    if (!includeDeleted) {
      query = query.is('deleted_at', null)
    }
    
    const { data, error } = await query
    
    if (error) throw new Error(error.message)
    return data
  },

  async create(event) {
    // First get the gym name for the event
    const { data: gym } = await supabase
      .from('gyms')
      .select('name')
      .eq('id', event.gym_id)
      .single()
    
    const { data, error } = await supabase
      .from('events')
      .insert([event])
      .select()
      .single()
    
    if (error) throw new Error(error.message)
    
    // Add gym_name for frontend compatibility
    return {
      ...data,
      gym_name: gym?.name || 'Unknown'
    }
  },

  async update(id, updates) {
    const { data, error } = await supabase
      .from('events')
      .update(updates)
      .eq('id', id)
      .select()
      .single()
    
    if (error) throw new Error(error.message)
    
    // Get gym name if gym_id was updated
    if (updates.gym_id) {
      const { data: gym } = await supabase
        .from('gyms')
        .select('name')
        .eq('id', updates.gym_id)
        .single()
      
      data.gym_name = gym?.name || 'Unknown'
    }
    
    return data
  },

  async delete(id) {
    const { error } = await supabase
      .from('events')
      .delete()
      .eq('id', id)
    
    if (error) throw new Error(error.message)
  },

  // Soft delete - marks event as deleted without removing from database
  async markAsDeleted(id) {
    const { data, error } = await supabase
      .from('events')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single()
    
    if (error) throw new Error(error.message)
    return data
  },

  // Restore a soft-deleted event
  async restore(id) {
    const { data, error } = await supabase
      .from('events')
      .update({ deleted_at: null })
      .eq('id', id)
      .select()
      .single()
    
    if (error) throw new Error(error.message)
    return data
  }
}

// Event Types API
export const eventTypesApi = {
  async getAll() {
    const { data, error } = await supabase
      .from('event_types')
      .select('*')
      .order('name')
    
    if (error) throw new Error(error.message)
    return data
  },

  async getTrackedTypes() {
    const { data, error } = await supabase
      .from('event_types')
      .select('*')
      .eq('is_tracked', true)
      .order('name')
    
    if (error) throw new Error(error.message)
    return data
  },

  async update(id, updates) {
    const { data, error } = await supabase
      .from('event_types')
      .update(updates)
      .eq('id', id)
      .select()
      .single()
    
    if (error) throw new Error(error.message)
    return data
  }
} 

export const monthlyRequirementsApi = {
  async getAll() {
    const { data, error } = await supabase
      .from('monthly_requirements')
      .select('*')
      .order('event_type');
    if (error) throw new Error(error.message);
    return data || [];
  }
};

// Sync Log API - tracks when each gym/event type was last synced
export const syncLogApi = {
  async getAll() {
    const { data, error } = await supabase
      .from('sync_log')
      .select('*')
      .order('last_synced', { ascending: false });
    if (error) throw new Error(error.message);
    return data || [];
  },

  async log(gymId, eventType, eventsFound, eventsImported = 0) {
    // Upsert - update if exists, insert if not
    const { data, error } = await supabase
      .from('sync_log')
      .upsert({
        gym_id: gymId,
        event_type: eventType,
        last_synced: new Date().toISOString(),
        events_found: eventsFound,
        events_imported: eventsImported
      }, {
        onConflict: 'gym_id,event_type'
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return data;
  },

  async getByGym(gymId) {
    const { data, error } = await supabase
      .from('sync_log')
      .select('*')
      .eq('gym_id', gymId);
    if (error) throw new Error(error.message);
    return data || [];
  }
};

// Audit Log API - tracks all event changes
export const auditLogApi = {
  async getAll(limit = 100) {
    const { data, error } = await supabase
      .from('event_audit_log')
      .select('*')
      .order('changed_at', { ascending: false })
      .limit(limit);
    if (error) throw new Error(error.message);
    return data || [];
  },

  async log(eventId, gymId, action, fieldChanged, oldValue, newValue, eventTitle, eventDate, changedBy = 'Sync Import') {
    const { data, error } = await supabase
      .from('event_audit_log')
      .insert([{
        event_id: eventId,
        gym_id: gymId,
        action: action,
        field_changed: fieldChanged,
        old_value: oldValue,
        new_value: newValue,
        changed_by: changedBy,
        event_title: eventTitle,
        event_date: eventDate
      }])
      .select()
      .single();
    if (error) {
      console.error('Error logging audit:', error);
      return null;
    }
    return data;
  },

  async getByEvent(eventId) {
    const { data, error } = await supabase
      .from('event_audit_log')
      .select('*')
      .eq('event_id', eventId)
      .order('changed_at', { ascending: false });
    if (error) throw new Error(error.message);
    return data || [];
  },

  async getByGym(gymId, limit = 50) {
    const { data, error } = await supabase
      .from('event_audit_log')
      .select('*')
      .eq('gym_id', gymId)
      .order('changed_at', { ascending: false })
      .limit(limit);
    if (error) throw new Error(error.message);
    return data || [];
  }
};

// Gym Valid Values API - per-gym rules for valid prices, times, etc.
// These prevent false positive validation errors (e.g. $20 aftercare, 8:30am early dropoff)
export const gymValidValuesApi = {
  async getAll() {
    const { data, error } = await supabase
      .from('gym_valid_values')
      .select('*')
      .order('gym_id')
      .order('rule_type');
    if (error) throw new Error(error.message);
    return data || [];
  },

  async getByGym(gymId) {
    const { data, error } = await supabase
      .from('gym_valid_values')
      .select('*')
      .eq('gym_id', gymId)
      .order('rule_type');
    if (error) throw new Error(error.message);
    return data || [];
  },

  async create(rule) {
    const { data, error } = await supabase
      .from('gym_valid_values')
      .insert([rule])
      .select()
      .single();
    if (error) throw new Error(error.message);
    return data;
  },

  async delete(id) {
    const { error } = await supabase
      .from('gym_valid_values')
      .delete()
      .eq('id', id);
    if (error) throw new Error(error.message);
  }
};