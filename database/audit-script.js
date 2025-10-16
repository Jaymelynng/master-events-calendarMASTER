// Supabase Database Audit Script
// Analyzes complete database structure and relationships

const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.REACT_APP_SUPABASE_URL || 'https://xftiwouxpefchwoxxgpf.supabase.co',
  process.env.REACT_APP_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhmdGl3b3V4cGVmY2h3b3h4Z3BmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTA2ODc1MjUsImV4cCI6MjA2NjI2MzUyNX0.jQReOgyjYxOaig_IoJv3jhhPzlfumUcn-vkS1yF9hY4'
);

async function auditDatabase() {
  console.log('🔍 SUPABASE DATABASE AUDIT');
  console.log('='.repeat(60));
  console.log('');

  // 1. Check all tables
  console.log('📊 TABLE AUDIT:');
  console.log('-'.repeat(60));
  
  const tables = ['gyms', 'events', 'event_types', 'gym_links', 'link_types', 'monthly_requirements', 'event_audit_log'];
  
  for (const table of tables) {
    try {
      const { data, error, count } = await supabase
        .from(table)
        .select('*', { count: 'exact', head: true });
      
      if (error) {
        console.log(`❌ ${table}: ERROR - ${error.message}`);
      } else {
        console.log(`✅ ${table}: ${count} rows`);
      }
    } catch (e) {
      console.log(`❌ ${table}: ${e.message}`);
    }
  }

  console.log('');
  console.log('📋 SAMPLE DATA:');
  console.log('-'.repeat(60));

  // 2. Get sample event types
  const { data: eventTypes } = await supabase
    .from('event_types')
    .select('*');
  console.log('Event Types:', JSON.stringify(eventTypes, null, 2));

  // 3. Get sample events
  const { data: sampleEvents } = await supabase
    .from('events')
    .select('*')
    .limit(3);
  console.log('');
  console.log('Sample Events:', JSON.stringify(sampleEvents, null, 2));

  // 4. Get monthly requirements
  const { data: requirements } = await supabase
    .from('monthly_requirements')
    .select('*');
  console.log('');
  console.log('Monthly Requirements:', JSON.stringify(requirements, null, 2));

  // 5. Check views
  console.log('');
  console.log('👁️ CHECKING VIEWS:');
  console.log('-'.repeat(60));
  
  try {
    const { data: viewData, error } = await supabase
      .from('events_with_gym')
      .select('*')
      .limit(1);
    
    if (error) {
      console.log('❌ events_with_gym view: ERROR -', error.message);
    } else {
      console.log('✅ events_with_gym view: Working');
    }
  } catch (e) {
    console.log('❌ events_with_gym view:', e.message);
  }

  try {
    const { data: linksView, error } = await supabase
      .from('gym_links_detailed')
      .select('*')
      .limit(1);
    
    if (error) {
      console.log('❌ gym_links_detailed view: ERROR -', error.message);
    } else {
      console.log('✅ gym_links_detailed view: Working');
    }
  } catch (e) {
    console.log('❌ gym_links_detailed view:', e.message);
  }

  console.log('');
  console.log('🔗 GYM LINKS SAMPLE:');
  console.log('-'.repeat(60));
  
  const { data: gymLinks } = await supabase
    .from('gym_links')
    .select('*')
    .limit(5);
  console.log(JSON.stringify(gymLinks, null, 2));

  console.log('');
  console.log('✅ AUDIT COMPLETE!');
}

auditDatabase().catch(console.error);

