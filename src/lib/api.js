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
      console.log('🔍 Checking for existing events...');
      console.log('📊 Total events to import:', events.length);
      
      // Get list of existing event URLs
      const eventUrls = events.map(e => e.event_url);
      const { data: existingEvents, error: checkError } = await supabase
        .from('events')
        .select('event_url')
        .in('event_url', eventUrls);
      
      if (checkError) {
        console.error('❌ Error checking existing events:', checkError);
        throw new Error(`Failed to check existing events: ${checkError.message}`);
      }
      
      // Create a Set of existing URLs for fast lookup
      const existingUrls = new Set(existingEvents?.map(e => e.event_url) || []);
      
      // Filter out events that already exist
      const newEvents = events.filter(e => !existingUrls.has(e.event_url));
      const duplicateCount = events.length - newEvents.length;
      
      console.log(`📋 Found ${duplicateCount} duplicates, ${newEvents.length} new events to import`);
      
      if (newEvents.length === 0) {
        console.log('✅ All events already exist - no new events to import');
        return [];
      }
      
      console.log('🚀 Inserting new events to Supabase:', newEvents);
      
      // Insert only new events
      const { data, error } = await supabase
        .from('events')
        .insert(newEvents)
        .select();
      
      if (error) {
        console.error('❌ Supabase bulk import error:', error);
        throw new Error(`Database error: ${error.message}`);
      }
      
      console.log(`✅ Successfully imported ${data?.length || 0} new events`);
      
      return data || [];
    } catch (networkError) {
      console.error('❌ Network error during bulk import:', networkError);
      throw new Error(`Failed to save events: ${networkError.message}`);
    }
  },

  async getAll(startDate, endDate, includeDeleted = false) {
    let query = supabase
      .from('events_with_gym')
      .select('*')
      .order('date', { ascending: true })
    
    if (startDate) {
      query = query.gte('date', startDate)
    }
    if (endDate) {
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