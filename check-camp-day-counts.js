// Paste this into F12 Console while on localhost:3000 to check camp data
// This will query Supabase and show all October 2025 camps with their titles

(async () => {
  console.clear();
  console.log('🔍 CHECKING OCTOBER 2025 CAMP DATA FROM SUPABASE...\n');
  
  try {
    // Query all October 2025 camp events
    const { data: camps, error } = await window.supabase
      .from('events_with_gym')
      .select('*')
      .eq('type', 'CAMP')
      .gte('date', '2025-10-01')
      .lte('date', '2025-10-31')
      .order('gym_id', { ascending: true })
      .order('date', { ascending: true });
    
    if (error) {
      console.error('❌ Database Error:', error);
      return;
    }
    
    if (!camps || camps.length === 0) {
      console.log('❌ No camps found for October 2025');
      return;
    }
    
    console.log(`✅ Found ${camps.length} camp events in October 2025\n`);
    console.log('=' .repeat(80));
    
    // Group by gym
    const byGym = {};
    camps.forEach(camp => {
      const gym = camp.gym_id || camp.gym_code || 'UNKNOWN';
      if (!byGym[gym]) byGym[gym] = [];
      byGym[gym].push(camp);
    });
    
    // Display each gym's camps
    Object.keys(byGym).sort().forEach(gym => {
      const gymCamps = byGym[gym];
      console.log(`\n📍 ${gym} (${gymCamps.length} camps)`);
      console.log('-'.repeat(80));
      
      gymCamps.forEach(camp => {
        const date = new Date(camp.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        const title = camp.title || 'NO TITLE';
        
        // Try to parse day count from title (same logic as EventsDashboard)
        let dayCount = null;
        const titleLower = title.toLowerCase();
        
        // 1. Look for comma-separated dates
        const commaMatch = titleLower.match(/\b\d{1,2}(?:st|nd|rd|th)?\s*,\s*\d{1,2}(?:st|nd|rd|th)?\s*(?:,|&|and)\s*\d{1,2}/);
        if (commaMatch) {
          const dates = titleLower.match(/\b\d{1,2}(?=(?:st|nd|rd|th)?(?:\s*,|\s*&|\s+and|\s*\|))/g);
          if (dates && dates.length >= 2) {
            dayCount = dates.length;
          }
        }
        // 2. Look for date ranges
        else {
          const rangeMatch = titleLower.match(/\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+(\d{1,2})(?:st|nd|rd|th)?\s*-\s*(\d{1,2})(?:st|nd|rd|th)?\b/);
          if (rangeMatch) {
            const start = parseInt(rangeMatch[1]);
            const end = parseInt(rangeMatch[2]);
            if (end > start && end - start >= 1 && end - start <= 7) {
              dayCount = end - start + 1;
            }
          }
        }
        // 3. Look for "X day" mention
        if (!dayCount && titleLower.match(/\b(\d+)\s*[-\s]*day\b/i)) {
          const match = titleLower.match(/\b(\d+)\s*[-\s]*day\b/i);
          if (match) {
            const count = parseInt(match[1]);
            if (count >= 2 && count <= 10) dayCount = count;
          }
        }
        
        const badge = dayCount ? `📅 ${dayCount} days` : '❌ NO BADGE';
        
        console.log(`  ${date} | ${badge.padEnd(15)} | ${title}`);
      });
    });
    
    console.log('\n' + '='.repeat(80));
    console.log('\n✨ SUMMARY:');
    const withBadge = camps.filter(c => {
      const t = (c.title || '').toLowerCase();
      return t.match(/\b\d{1,2}(?:st|nd|rd|th)?\s*,\s*\d{1,2}/) || 
             t.match(/\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+\d{1,2}(?:st|nd|rd|th)?\s*-\s*\d{1,2}/) ||
             t.match(/\b(\d+)\s*[-\s]*day\b/i);
    });
    console.log(`  ✅ Camps with day count badge: ${withBadge.length}`);
    console.log(`  ❌ Camps WITHOUT day count badge: ${camps.length - withBadge.length}`);
    
  } catch (err) {
    console.error('❌ Error:', err);
  }
})();


