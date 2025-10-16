const { createClient } = require('@supabase/supabase-js');

// Use environment variables from React app
const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
const supabaseKey = process.env.REACT_APP_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('ERROR: Missing Supabase credentials');
  console.error('Please set REACT_APP_SUPABASE_URL and REACT_APP_SUPABASE_ANON_KEY environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkDuplicates() {
  const { data, error } = await supabase
    .from('events')
    .select('id, title, date, event_url, created_at')
    .eq('gym_id', 'HGA')
    .eq('type', 'KIDS NIGHT OUT')
    .order('date')
    .order('created_at');

  if (error) {
    console.error('Error:', error);
    return;
  }

  console.log('='.repeat(80));
  console.log('HOUSTON GYMNASTICS ACADEMY - KIDS NIGHT OUT EVENTS');
  console.log('='.repeat(80));
  console.log(`Total events found: ${data.length}\n`);

  // Group by URL (without query params)
  const urlMap = {};
  data.forEach(ev => {
    const url = ev.event_url.split('?')[0];
    if (!urlMap[url]) {
      urlMap[url] = [];
    }
    urlMap[url].push(ev);
  });

  console.log('=== DUPLICATE CHECK BY URL ===\n');
  
  let duplicateCount = 0;
  const duplicateIds = [];

  Object.entries(urlMap).forEach(([url, events]) => {
    if (events.length > 1) {
      duplicateCount++;
      console.log(`DUPLICATE #${duplicateCount}: ${url}`);
      console.log(`  Title: ${events[0].title}`);
      console.log(`  Date: ${events[0].date}`);
      console.log(`  Total copies: ${events.length}`);
      console.log(`  Copies:`);
      events.forEach((e, idx) => {
        console.log(`    ${idx + 1}. ID: ${e.id} | Created: ${e.created_at}`);
        if (idx > 0) {
          // Mark duplicates after the first one for deletion
          duplicateIds.push(e.id);
        }
      });
      console.log('');
    }
  });

  if (duplicateCount === 0) {
    console.log('✅ NO DUPLICATES FOUND - All events are unique!\n');
  } else {
    console.log('='.repeat(80));
    console.log(`⚠️  SUMMARY: Found ${duplicateCount} duplicate event(s)`);
    console.log(`⚠️  ${duplicateIds.length} record(s) need to be deleted`);
    console.log('='.repeat(80));
    console.log('\nDuplicate IDs to delete:');
    duplicateIds.forEach(id => console.log(`  - ${id}`));
  }

  console.log('\n=== ALL EVENTS (chronological order) ===\n');
  data.forEach((ev, idx) => {
    console.log(`${idx + 1}. ${ev.date} | ${ev.title}`);
    console.log(`   URL: ${ev.event_url}`);
    console.log(`   ID: ${ev.id} | Created: ${ev.created_at}\n`);
  });
}

checkDuplicates();

