import { supabase } from './supabase'

// App-wide settings the UI manages (e.g. the CC email for error notifications).
// Key/value so nothing is hardcoded.
export const appConfigApi = {
  async getAll() {
    const { data, error } = await supabase.from('app_config').select('*')
    if (error) throw new Error(error.message)
    const map = {}
    ;(data || []).forEach(r => { map[r.key] = r.value })
    return map
  },
  async set(key, value) {
    const { error } = await supabase
      .from('app_config')
      .upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: 'key' })
    if (error) throw new Error(error.message)
  }
}

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
  },

  // event_type is the primary key — upsert handles add+edit in one method
  async upsert(eventType, count) {
    const parsed = parseInt(count, 10);
    if (!eventType || Number.isNaN(parsed)) {
      throw new Error('upsert requires non-empty eventType and numeric count');
    }
    const { data, error } = await supabase
      .from('monthly_requirements')
      .upsert(
        { event_type: eventType, required_count: parsed },
        { onConflict: 'event_type' }
      )
      .select()
      .single();
    if (error) throw new Error(error.message);
    return data;
  },

  async delete(eventType) {
    const { error } = await supabase
      .from('monthly_requirements')
      .delete()
      .eq('event_type', eventType);
    if (error) throw new Error(error.message);
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

// Error Email Log API - records every "Email the Gym" send so we can show
// "you emailed them on X" next to a still-active error and offer a follow-up.
export const errorEmailLogApi = {
  async getAll() {
    const { data, error } = await supabase
      .from('error_email_log')
      .select('*')
      .order('sent_at', { ascending: false });
    if (error) throw new Error(error.message);
    return data || [];
  },

  async log(row) {
    const { data, error } = await supabase
      .from('error_email_log')
      .insert([{
        event_id: row.event_id || null,
        gym_id: row.gym_id || null,
        event_title: row.event_title || null,
        error_message: row.error_message || null,
        recipients: row.recipients || null,
        cc: row.cc || null,
      }])
      .select()
      .single();
    if (error) throw new Error(error.message);
    return data;
  }
};

// Verified Events API - Jayme's personal "I checked this flag" marker.
// Row exists = verified. Does not touch validation or acknowledgments.
export const verifiedEventsApi = {
  async getAll() {
    const { data, error } = await supabase.from('verified_events').select('event_id');
    if (error) throw new Error(error.message);
    return (data || []).map(r => r.event_id);
  },
  async setVerified(eventId, on) {
    if (on) {
      const { error } = await supabase
        .from('verified_events')
        .upsert({ event_id: eventId }, { onConflict: 'event_id' });
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabase.from('verified_events').delete().eq('event_id', eventId);
      if (error) throw new Error(error.message);
    }
  }
};

// Requirement Notes API - tracks status of missing requirements
export const requirementNotesApi = {
  async getAll() {
    const { data, error } = await supabase
      .from('requirement_notes')
      .select('*');
    if (error) throw new Error(error.message);
    return data || [];
  },

  async getByMonth(month) {
    const { data, error } = await supabase
      .from('requirement_notes')
      .select('*')
      .eq('month', month);
    if (error) throw new Error(error.message);
    return data || [];
  },

  async upsert(gymId, program, month, status, note) {
    const { data, error } = await supabase
      .from('requirement_notes')
      .upsert({
        gym_id: gymId,
        program: program,
        month: month,
        status: status,
        note: note,
        updated_at: new Date().toISOString()
      }, { onConflict: 'gym_id,program,month' })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return data;
  },

  async delete(id) {
    const { error } = await supabase
      .from('requirement_notes')
      .delete()
      .eq('id', id);
    if (error) throw new Error(error.message);
  }
};

// Future Plans API - tracks planned features, improvements, and ideas
export const futurePlansApi = {
  async getAll() {
    const { data, error } = await supabase
      .from('future_plans')
      .select('*')
      .order('priority_sort', { ascending: true, nullsFirst: false })
      .order('created_at', { ascending: false });
    if (error) {
      // Fallback ordering if priority_sort column doesn't exist
      const { data: fallback, error: err2 } = await supabase
        .from('future_plans')
        .select('*')
        .order('created_at', { ascending: false });
      if (err2) throw new Error(err2.message);
      return fallback || [];
    }
    return data || [];
  },

  async create(plan) {
    const { data, error } = await supabase
      .from('future_plans')
      .insert([{
        title: plan.title,
        description: plan.description || null,
        category: plan.category || 'feature',
        priority: plan.priority || 'medium',
        status: plan.status || 'planning',
        target_area: plan.target_area || null,
        added_by: plan.added_by || 'manual',
        notes: plan.notes || null
      }])
      .select()
      .single();
    if (error) throw new Error(error.message);
    return data;
  },

  async update(id, updates) {
    const updateData = { ...updates, updated_at: new Date().toISOString() };
    if (updates.status === 'completed' && !updates.completed_at) {
      updateData.completed_at = new Date().toISOString();
    }
    const { data, error } = await supabase
      .from('future_plans')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return data;
  },

  async delete(id) {
    const { error } = await supabase
      .from('future_plans')
      .delete()
      .eq('id', id);
    if (error) throw new Error(error.message);
  }
};

// Format Patterns API — UI-managed catalog of date / time / price / age /
// program / skill format variations the validation engine recognizes.
// Each row = one pattern (regex or keyword) the engine looks for in
// titles + descriptions. See database/CREATE_FORMAT_PATTERNS_TABLE.sql.
export const formatPatternsApi = {
  async getAll() {
    const { data, error } = await supabase
      .from('format_patterns')
      .select('*')
      .order('category')
      .order('name');
    if (error) throw new Error(error.message);
    return data || [];
  },

  async getByCategory(category) {
    const { data, error } = await supabase
      .from('format_patterns')
      .select('*')
      .eq('category', category)
      .order('name');
    if (error) throw new Error(error.message);
    return data || [];
  },

  async create(pattern) {
    const { data, error } = await supabase
      .from('format_patterns')
      .insert([{
        category: pattern.category,
        name: pattern.name,
        pattern: pattern.pattern,
        match_type: pattern.match_type || 'regex',
        example: pattern.example || null,
        description: pattern.description || null,
        is_active: pattern.is_active !== false,
        gym_ids: pattern.gym_ids || ['ALL'],
        program: pattern.program || 'ALL',
        created_by: pattern.created_by || 'manual'
      }])
      .select()
      .single();
    if (error) throw new Error(error.message);
    return data;
  },

  async update(id, updates) {
    const { data, error } = await supabase
      .from('format_patterns')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return data;
  },

  async toggle(id, isActive) {
    return formatPatternsApi.update(id, { is_active: isActive });
  },

  async delete(id) {
    const { error } = await supabase
      .from('format_patterns')
      .delete()
      .eq('id', id);
    if (error) throw new Error(error.message);
  }
};

// ============================================================================
// CAMP TYPE MAPPINGS — iClass's own category name -> the calendar bucket.
// ============================================================================
// iClass hands back a real category name on every camp request (campTypeName /
// the booking-page title). This table says which bucket each name lands in, so
// nothing is ever guessed from an event title.
//
// A name with NO row here becomes UNSORTED: it shows on the calendar, is never
// counted toward a monthly requirement, and waits for Jayme to classify it.
// It is never silently called CAMP.
export const eventTypeMappingsApi = {
  async getAll() {
    const { data, error } = await supabase
      .from('event_type_mappings')
      .select('*')
      .order('event_type')
      .order('iclass_type_name');
    if (error) throw new Error(error.message);
    return data;
  },

  // { "kids night out": { event_type: 'KIDS NIGHT OUT', hide: false }, ... }
  async getLookup() {
    const rows = await eventTypeMappingsApi.getAll();
    return Object.fromEntries(
      rows.filter(r => r.is_active).map(r => [
        (r.iclass_type_name || '').trim().toLowerCase(),
        { event_type: r.event_type, hide: !!r.hide_from_calendar },
      ])
    );
  },

  async create(row) {
    const { data, error } = await supabase
      .from('event_type_mappings')
      .insert([row])
      .select()
      .single();
    if (error) throw new Error(error.message);
    return data;
  },

  async update(id, updates) {
    const { data, error } = await supabase
      .from('event_type_mappings')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return data;
  },

  async delete(id) {
    const { error } = await supabase
      .from('event_type_mappings')
      .delete()
      .eq('id', id);
    if (error) throw new Error(error.message);
  }
};

// ============================================================================
// BUCKETS - the Admin "Buckets" screen (AdminBuckets.js).
// Two ways Jayme decides where an event lands, both stored in the database:
//   1. TRAIN a category: an event_type_mappings row (for one gym or every gym).
//      Every event in that iClass category follows it, now and on every sync.
//   2. FORCE one event: events.type_locked = true. The sync leaves its bucket
//      alone no matter which iClass category the gym filed it under.
// ============================================================================
const pageAll = async (build) => {
  // Supabase caps a read at 1,000 rows without saying so - always page.
  const rows = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await build().range(from, from + 999);
    if (error) throw new Error(error.message);
    rows.push(...(data || []));
    if (!data || data.length < 1000) break;
  }
  return rows;
};

export const bucketsApi = {
  // Events waiting for a home.
  async getUnsorted(unsortedName) {
    return pageAll(() => supabase.from('events').select('*')
      .eq('type', unsortedName).is('deleted_at', null).order('start_date'));
  },

  // Events Jayme forced into a bucket.
  async getForced() {
    return pageAll(() => supabase.from('events').select('*')
      .eq('type_locked', true).is('deleted_at', null).order('start_date'));
  },

  // Every live event filed under one iClass category name. gymId null = every gym.
  async getByCategory(categoryName, gymId = null) {
    // ilike = same name in any capitals. Escape its wildcards so the name is
    // matched exactly, never as a pattern.
    const exact = (categoryName || '').replace(/[\\%_]/g, c => '\\' + c);
    return pageAll(() => {
      let q = supabase.from('events').select('*')
        .ilike('camp_type', exact).is('deleted_at', null).order('start_date');
      if (gymId) q = q.eq('gym_id', gymId);
      return q;
    });
  },

  // Every event that hasn't ended yet, with just the fields the bulk opener
  // needs to count gyms per bucket and build each category's portal page.
  async getUpcoming() {
    const today = new Date().toISOString().split('T')[0];
    return pageAll(() => supabase.from('events')
      .select('gym_id, type, type_id, event_url, end_date')
      .is('deleted_at', null).gte('end_date', today).order('id'));
  },

  // Move events to a bucket. locked: true = force, false = un-force,
  // undefined = leave the lock as it is.
  async moveEvents(events, bucket, locked, changedBy = 'Buckets screen') {
    let moved = 0;
    for (const ev of events) {
      const updates = { type: bucket };
      if (locked !== undefined) updates.type_locked = locked;
      const { error } = await supabase.from('events').update(updates).eq('id', ev.id);
      if (error) throw new Error(error.message);
      if (ev.type !== bucket) {
        await auditLogApi.log(ev.id, ev.gym_id, 'UPDATE', 'type', String(ev.type), String(bucket),
          ev.title, ev.date, changedBy);
      }
      moved++;
    }
    return moved;
  }
};
