// ============================================================================
// migrate-blp-to-calendar.mjs
// One-time data migration: Bulk Link PRO → Calendar's Supabase.
//
// Copies the remaining `field_values` rows (active-campaign, general-links,
// summer-camp pages) from BLP's project (wunjenvrovcrntjakawi) into Calendar's
// `bulk_field_values` table (xftiwouxpefchwoxxgpf).
//
// The pages, sections, fields, and the `programs` page values were already
// migrated via the Supabase MCP earlier in the session. This script handles
// the bulky remaining values in batches so we don't drown the API.
//
// HOW TO RUN:
//   1. Make sure these env vars are set in your shell:
//        BLP_SUPABASE_URL       = https://wunjenvrovcrntjakawi.supabase.co
//        BLP_SUPABASE_ANON_KEY  = (BLP's anon key from its Supabase dashboard)
//        CAL_SUPABASE_URL       = https://xftiwouxpefchwoxxgpf.supabase.co
//        CAL_SUPABASE_ANON_KEY  = (Calendar's anon key)
//   2. From the project root:
//        node scripts/migrate-blp-to-calendar.mjs
//
// Idempotent: skips rows whose `id` already exists in the destination.
// ============================================================================

import { createClient } from "@supabase/supabase-js";

const BLP_URL = process.env.BLP_SUPABASE_URL || "https://wunjenvrovcrntjakawi.supabase.co";
const BLP_KEY = process.env.BLP_SUPABASE_ANON_KEY;
const CAL_URL = process.env.CAL_SUPABASE_URL || "https://xftiwouxpefchwoxxgpf.supabase.co";
const CAL_KEY = process.env.CAL_SUPABASE_ANON_KEY || process.env.REACT_APP_SUPABASE_ANON_KEY;

if (!BLP_KEY || !CAL_KEY) {
  console.error("ERROR: Missing env vars. Set BLP_SUPABASE_ANON_KEY and CAL_SUPABASE_ANON_KEY.");
  process.exit(1);
}

const blp = createClient(BLP_URL, BLP_KEY);
const cal = createClient(CAL_URL, CAL_KEY);

const SLUGS_TO_MIGRATE = ["active-campaign", "general-links", "summer-camp"];
const CHUNK_SIZE = 500;

async function migrateSlug(slug) {
  console.log(`\n— ${slug} —`);

  // Find the BLP page → all its field IDs → all values for those fields
  const { data: page } = await blp.from("pages").select("id").eq("slug", slug).single();
  if (!page) {
    console.warn(`  skipped: no BLP page with slug ${slug}`);
    return { fetched: 0, inserted: 0 };
  }

  const { data: sections } = await blp.from("sections").select("id").eq("page_id", page.id);
  const sectionIds = (sections || []).map((s) => s.id);
  if (sectionIds.length === 0) return { fetched: 0, inserted: 0 };

  const { data: fields } = await blp.from("fields").select("id").in("section_id", sectionIds);
  const fieldIds = (fields || []).map((f) => f.id);
  if (fieldIds.length === 0) return { fetched: 0, inserted: 0 };

  // Pull all values for those fields
  const { data: values, error: valErr } = await blp
    .from("field_values")
    .select("id, field_id, location_id, value, label, display_order, status");
  if (valErr) throw valErr;

  const fieldSet = new Set(fieldIds);
  const rows = (values || [])
    .filter((v) => fieldSet.has(v.field_id))
    .map((v) => ({
      id: v.id,
      field_id: v.field_id,
      gym_id: v.location_id,
      value: v.value,
      label: v.label,
      display_order: v.display_order ?? 0,
      status: v.status ?? "active",
    }));

  console.log(`  fetched: ${rows.length} value rows`);

  // Insert in chunks; upsert on id so re-running is safe.
  let inserted = 0;
  for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
    const chunk = rows.slice(i, i + CHUNK_SIZE);
    const { error } = await cal.from("bulk_field_values").upsert(chunk, { onConflict: "id" });
    if (error) {
      console.error(`  chunk ${i}-${i + chunk.length} failed:`, error.message);
      throw error;
    }
    inserted += chunk.length;
    console.log(`  inserted ${inserted}/${rows.length}`);
  }
  return { fetched: rows.length, inserted };
}

(async () => {
  let totalFetched = 0;
  let totalInserted = 0;
  for (const slug of SLUGS_TO_MIGRATE) {
    const r = await migrateSlug(slug);
    totalFetched += r.fetched;
    totalInserted += r.inserted;
  }
  console.log(`\nDONE. fetched=${totalFetched} inserted=${totalInserted}`);

  // Final sanity check from Calendar's side
  const { count } = await cal
    .from("bulk_field_values")
    .select("*", { count: "exact", head: true });
  console.log(`bulk_field_values total in Calendar: ${count}`);
})().catch((err) => {
  console.error("MIGRATION FAILED:", err);
  process.exit(1);
});
