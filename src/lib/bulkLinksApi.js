/**
 * Bulk Links API — Supabase data access for the 📦 Bulk Links tab.
 *
 * Lives in Calendar's Supabase project. Tables created by
 * database/CREATE_BULK_LINKS_TABLES.sql:
 *   - bulk_pages       (tabs)
 *   - bulk_sections    (groupings inside a tab)
 *   - bulk_fields      (rows inside a section)
 *   - bulk_field_values (per-gym values for each field)
 *
 * Patterned after src/lib/api.js. No realtime subscriptions yet; data
 * is fetched on tab open and re-fetched after edits.
 */

import { supabase } from './supabase';

// -----------------------------------------------------------------------
// pagesApi — top-level tabs
// -----------------------------------------------------------------------
export const bulkPagesApi = {
  async getAll() {
    const { data, error } = await supabase
      .from('bulk_pages')
      .select('*')
      .eq('status', 'active')
      .order('display_order');
    if (error) throw new Error(error.message);
    return data || [];
  },

  async create(page) {
    const { data, error } = await supabase
      .from('bulk_pages')
      .insert([page])
      .select()
      .single();
    if (error) throw new Error(error.message);
    return data;
  },

  async update(id, updates) {
    const { data, error } = await supabase
      .from('bulk_pages')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return data;
  },

  async delete(id) {
    const { error } = await supabase.from('bulk_pages').delete().eq('id', id);
    if (error) throw new Error(error.message);
  },
};

// -----------------------------------------------------------------------
// pageDataApi — one call that returns everything needed to render a page
// -----------------------------------------------------------------------
export const bulkPageDataApi = {
  /**
   * Fetch a full page hydrated with sections, fields, and all values.
   * Returns:
   *   {
   *     page: {...},
   *     sections: [{
   *       id, title, emoji, displayOrder,
   *       fields: [{ id, label, emoji, fieldType, displayOrder, allowCopy, allowOpen }]
   *     }],
   *     valuesByFieldAndLocation: { [fieldId]: { [gymId]: FieldValue[] } }
   *   }
   */
  async getBySlug(slug) {
    const { data: page, error: pageErr } = await supabase
      .from('bulk_pages')
      .select('*')
      .eq('slug', slug)
      .single();
    if (pageErr) throw new Error(pageErr.message);

    const { data: sections, error: secErr } = await supabase
      .from('bulk_sections')
      .select('*')
      .eq('page_id', page.id)
      .order('display_order');
    if (secErr) throw new Error(secErr.message);

    const sectionIds = (sections || []).map((s) => s.id);
    const { data: fields, error: fieldErr } = sectionIds.length
      ? await supabase
          .from('bulk_fields')
          .select('*')
          .in('section_id', sectionIds)
          .order('display_order')
      : { data: [], error: null };
    if (fieldErr) throw new Error(fieldErr.message);

    const fieldIds = (fields || []).map((f) => f.id);
    const { data: values, error: valErr } = fieldIds.length
      ? await supabase
          .from('bulk_field_values')
          .select('*')
          .in('field_id', fieldIds)
          .eq('status', 'active')
          .order('display_order')
      : { data: [], error: null };
    if (valErr) throw new Error(valErr.message);

    // Index values by field × gym for cheap lookup in the UI
    const valuesByFieldAndLocation = {};
    (values || []).forEach((v) => {
      if (!valuesByFieldAndLocation[v.field_id]) {
        valuesByFieldAndLocation[v.field_id] = {};
      }
      if (!valuesByFieldAndLocation[v.field_id][v.gym_id]) {
        valuesByFieldAndLocation[v.field_id][v.gym_id] = [];
      }
      valuesByFieldAndLocation[v.field_id][v.gym_id].push({
        id: v.id,
        value: v.value,
        label: v.label,
        displayOrder: v.display_order,
        status: v.status,
      });
    });

    // Nest fields under their sections, in display order
    const fieldsBySection = {};
    (fields || []).forEach((f) => {
      if (!fieldsBySection[f.section_id]) fieldsBySection[f.section_id] = [];
      fieldsBySection[f.section_id].push({
        id: f.id,
        label: f.label,
        emoji: f.emoji,
        fieldType: f.field_type,
        displayOrder: f.display_order,
        allowCopy: f.allow_copy,
        allowOpen: f.allow_open,
      });
    });

    const hydratedSections = (sections || []).map((s) => ({
      id: s.id,
      title: s.title,
      emoji: s.emoji,
      displayOrder: s.display_order,
      fields: fieldsBySection[s.id] || [],
    }));

    return {
      page: {
        id: page.id,
        slug: page.slug,
        title: page.title,
        emoji: page.emoji,
        activeColor: page.active_color,
        componentOverride: page.component_override,
      },
      sections: hydratedSections,
      valuesByFieldAndLocation,
    };
  },
};

// -----------------------------------------------------------------------
// valuesApi — single-cell mutations used by the admin
// -----------------------------------------------------------------------
export const bulkValuesApi = {
  async upsert({ fieldId, gymId, value, label = null }) {
    // Find existing single-value row first
    const { data: existing } = await supabase
      .from('bulk_field_values')
      .select('id')
      .eq('field_id', fieldId)
      .eq('gym_id', gymId)
      .eq('status', 'active')
      .limit(1)
      .maybeSingle();

    if (existing) {
      const { data, error } = await supabase
        .from('bulk_field_values')
        .update({ value, label })
        .eq('id', existing.id)
        .select()
        .single();
      if (error) throw new Error(error.message);
      return data;
    }
    const { data, error } = await supabase
      .from('bulk_field_values')
      .insert([{ field_id: fieldId, gym_id: gymId, value, label, display_order: 0 }])
      .select()
      .single();
    if (error) throw new Error(error.message);
    return data;
  },

  async delete(id) {
    const { error } = await supabase.from('bulk_field_values').delete().eq('id', id);
    if (error) throw new Error(error.message);
  },

  async bulkFillAll({ fieldId, gymIds, value }) {
    const results = [];
    for (const gymId of gymIds) {
      const row = await bulkValuesApi.upsert({ fieldId, gymId, value });
      results.push(row);
    }
    return results;
  },
};

// -----------------------------------------------------------------------
// Helpers — value rendering for copy / open actions
// -----------------------------------------------------------------------

/** Returns the text to paste into a clipboard for a given field/value. */
export function getCopyValue(field, value) {
  if (!value || value.value == null) return null;
  if (value.value === 'N/A' || value.value === 'not offered') return null;
  return value.value;
}

/** Returns the URL to open in a new tab for a given field/value, or null. */
export function getOpenUrl(field, value) {
  if (!field.allowOpen) return null;
  if (field.fieldType !== 'link') return null;
  const raw = value?.value;
  if (!raw || raw === 'N/A' || raw === 'not offered') return null;
  if (raw.startsWith('http://') || raw.startsWith('https://')) return raw;
  if (raw.startsWith('mailto:')) return raw;
  return `https://${raw}`;
}
