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
      
      const duplicateCount = events.length - trulyNewEvents.length - eventsToRestore.length;
      console.log(`📋 Found ${duplicateCount} active duplicates, ${eventsToRestore.length} to restore, ${trulyNewEvents.length} truly new`);
      
      let importedEvents = [];
      
      // Restore soft-deleted events (update them with new data and clear deleted_at)
      if (eventsToRestore.length > 0) {
        console.log(`🔄 Restoring ${eventsToRestore.length} previously deleted events...`);
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
            console.log(`✅ Restored event: ${restored[0].title}`);
          }
        }
      }
      
      // Insert truly new events
      if (trulyNewEvents.length > 0) {
        console.log('🚀 Inserting new events to Supabase:', trulyNewEvents);
        
        const { data, error } = await supabase
          .from('events')
          .insert(trulyNewEvents)
          .select();
        
        if (error) {
          console.error('❌ Supabase bulk import error:', error);
          throw new Error(`Database error: ${error.message}`);
        }
        
        importedEvents = [...importedEvents, ...(data || [])];
        console.log(`✅ Successfully imported ${data?.length || 0} new events`);
      }
      
      if (importedEvents.length === 0 && trulyNewEvents.length === 0 && eventsToRestore.length === 0) {
        console.log('✅ All events already exist - no new events to import');
      } else {
        console.log(`✅ Total imported/restored: ${importedEvents.length} events`);
      }
      
      return importedEvents;
    } catch (networkError) {
      console.error('❌ Network error during bulk import:', networkError);
      throw new Error(`Failed to save events: ${networkError.message}`);
    }
  },

  async getAll(startDate, endDate, includeDeleted = false) {
    // The events_with_gym view already filters WHERE deleted_at IS NULL,
    // so when we need soft-deleted events (for sync comparison), we must
    // query the events table directly and join gym info manually.
    const tableName = includeDeleted ? 'events' : 'events_with_gym';
    
    let query = supabase
      .from(tableName)
      .select(includeDeleted ? '*, gyms(name)' : '*')
      .order('date', { ascending: true })
    
    if (startDate && endDate) {
      query = query.or(`and(date.gte.${startDate},date.lte.${endDate}),and(start_date.lt.${startDate},end_date.gte.${startDate})`)
    } else if (startDate) {
      query = query.gte('date', startDate)
    } else if (endDate) {
      query = query.lte('date', endDate)
    }
    
    if (!includeDeleted) {
      query = query.is('deleted_at', null)
    }
    
    const { data, error } = await query
    
    if (error) throw new Error(error.message)
    
    if (includeDeleted && data) {
      return data.map(row => ({
        ...row,
        gym_name: row.gyms?.name || null,
        gym_code: row.gym_id,
        gyms: undefined
      }));
    }
    
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

  // Archive a deleted event: copy to events_archive, then remove from events
  async markAsDeleted(id) {
    const now = new Date().toISOString()
    
    // Step 1: Set deleted_at on the event
    const { data: event, error: updateError } = await supabase
      .from('events')
      .update({ deleted_at: now })
      .eq('id', id)
      .select()
      .single()
    
    if (updateError) throw new Error(updateError.message)
    
    // Step 2: Copy to events_archive via RPC (handles the date type cast)
    try {
      const { error: archiveError } = await supabase.rpc('archive_single_event', { event_id: id })
      if (archiveError) {
        console.warn('Archive RPC not available, event stays soft-deleted in events table:', archiveError.message)
        return event
      }
      
      // Step 3: Remove from events table
      const { error: deleteError } = await supabase
        .from('events')
        .delete()
        .eq('id', id)
      
      if (deleteError) {
        console.warn('Failed to remove archived event from events table:', deleteError.message)
      }
    } catch (rpcErr) {
      console.warn('Archive failed, falling back to soft-delete only:', rpcErr.message)
    }
    
    return event
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
  },

  async getFiltered({ gymIds = [], actions = [], limit = 50, offset = 0 } = {}) {
    let query = supabase
      .from('event_audit_log')
      .select('*', { count: 'exact' })
      .order('changed_at', { ascending: false });

    if (gymIds.length > 0) {
      query = query.in('gym_id', gymIds);
    }
    if (actions.length > 0) {
      query = query.in('action', actions);
    }

    query = query.range(offset, offset + limit - 1);

    const { data, error, count } = await query;
    if (error) throw new Error(error.message);
    return { data: data || [], count: count || 0 };
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

// Rules API - unified validation rules system (replaces gym_valid_values)
export const rulesApi = {
  async getAll() {
    const today = new Date().toISOString().split('T')[0];
    const { data, error } = await supabase
      .from('rules')
      .select('*')
      .or(`is_permanent.eq.true,end_date.gte.${today}`)
      .order('created_at', { ascending: false });
    if (error) throw new Error(error.message);
    return data || [];
  },

  async getAllIncludeExpired() {
    const { data, error } = await supabase
      .from('rules')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw new Error(error.message);
    return data || [];
  },

  async create(rule) {
    const { data, error } = await supabase
      .from('rules')
      .insert([{
        is_permanent: rule.is_permanent !== false,
        start_date: rule.start_date || null,
        end_date: rule.end_date || null,
        gym_ids: rule.gym_ids || ['ALL'],
        program: rule.program || 'ALL',
        camp_season: rule.camp_season || null,
        scope: rule.scope || 'all_events',
        keyword: rule.keyword || null,
        event_id: rule.event_id || null,
        rule_type: rule.rule_type,
        value: rule.value,
        value_kid2: rule.value_kid2 || null,
        value_kid3: rule.value_kid3 || null,
        label: rule.label || null,
        note: rule.note || null,
        created_by: rule.created_by || 'manual'
      }])
      .select()
      .single();
    if (error) throw new Error(error.message);
    return data;
  },

  async update(id, updates) {
    const { data, error } = await supabase
      .from('rules')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return data;
  },

  async delete(id) {
    const { error } = await supabase
      .from('rules')
      .delete()
      .eq('id', id);
    if (error) throw new Error(error.message);
  },

  async getForGym(gymId) {
    const { data, error } = await supabase
      .from('rules')
      .select('*')
      .or(`gym_ids.cs.{${gymId}},gym_ids.cs.{ALL}`);
    if (error) throw new Error(error.message);
    return data || [];
  },

  matchesEvent(rule, event) {
    if (!rule || !event) return false;
    const today = new Date().toISOString().split('T')[0];
    if (!rule.is_permanent && rule.end_date && rule.end_date < today) return false;
    if (!rule.gym_ids.includes('ALL') && !rule.gym_ids.includes(event.gym_id)) return false;
    if (rule.program !== 'ALL' && rule.program !== event.type) return false;
    if (rule.scope === 'keyword' && rule.keyword) {
      if (!(event.title || '').toLowerCase().includes(rule.keyword.toLowerCase())) return false;
    }
    if (rule.scope === 'single_event' && rule.event_id !== event.id) return false;
    return true;
  }
};

// Event Pricing API - base expected prices for Clinic, KNO, Open Gym (validates event_price_mismatch)
export const eventPricingApi = {
  async getAll() {
    const { data, error } = await supabase
      .from('event_pricing')
      .select('*')
      .order('gym_id')
      .order('event_type');
    if (error) throw new Error(error.message);
    return data || [];
  },

  async create(row) {
    const { data, error } = await supabase
      .from('event_pricing')
      .insert([{
        gym_id: row.gym_id,
        event_type: row.event_type,
        price: parseFloat(row.price),
        effective_date: row.effective_date || new Date().toISOString().slice(0, 10),
        end_date: row.end_date || null,
        notes: row.notes || null
      }])
      .select()
      .single();
    if (error) throw new Error(error.message);
    return data;
  },

  async update(id, updates) {
    const { data, error } = await supabase
      .from('event_pricing')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return data;
  },

  async delete(id) {
    const { error } = await supabase
      .from('event_pricing')
      .delete()
      .eq('id', id);
    if (error) throw new Error(error.message);
  }
};

// Camp Pricing API - base expected prices for Camp (full/half day daily/weekly)
export const campPricingApi = {
  async getAll() {
    const { data, error } = await supabase
      .from('camp_pricing')
      .select('*')
      .order('gym_id');
    if (error) throw new Error(error.message);
    return data || [];
  },

  async upsert(row) {
    const { data, error } = await supabase
      .from('camp_pricing')
      .upsert({
        gym_id: row.gym_id,
        full_day_daily: row.full_day_daily != null ? parseFloat(row.full_day_daily) : null,
        full_day_weekly: row.full_day_weekly != null ? parseFloat(row.full_day_weekly) : null,
        half_day_daily: row.half_day_daily != null ? parseFloat(row.half_day_daily) : null,
        half_day_weekly: row.half_day_weekly != null ? parseFloat(row.half_day_weekly) : null
      }, { onConflict: 'gym_id' })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return data;
  }
};

// Acknowledged patterns: temp overrides for "all events of this program at this gym"
export const acknowledgedPatternsApi = {
  async getAll() {
    const { data, error } = await supabase
      .from('acknowledged_patterns')
      .select('*')
      .order('gym_id')
      .order('event_type');
    if (error) throw new Error(error.message);
    return data || [];
  },

  async create(row) {
    const { data, error } = await supabase
      .from('acknowledged_patterns')
      .insert([{
        gym_id: row.gym_id,
        event_type: row.event_type,
        error_message: row.error_message,
        note: row.note || null
      }])
      .select()
      .single();
    if (error) throw new Error(error.message);
    return data;
  },

  async delete(id) {
    const { error } = await supabase
      .from('acknowledged_patterns')
      .delete()
      .eq('id', id);
    if (error) throw new Error(error.message);
  }
};