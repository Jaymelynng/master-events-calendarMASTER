-- ============================================================================
-- HGA KIDS NIGHT OUT - DUPLICATE CHECK
-- ============================================================================
-- Run this query to identify duplicate HGA Kids Night Out events
-- ============================================================================

-- Count total HGA Kids Night Out events
SELECT COUNT(*) as total_hga_kno_events
FROM events
WHERE gym_id = 'HGA'
  AND type = 'KIDS NIGHT OUT';

-- Show all HGA Kids Night Out events ordered by date
SELECT 
  id,
  title,
  date,
  event_url,
  created_at
FROM events
WHERE gym_id = 'HGA'
  AND type = 'KIDS NIGHT OUT'
ORDER BY date, created_at;

-- Find duplicates by event_url (without query parameters)
SELECT 
  SPLIT_PART(event_url, '?', 1) as base_url,
  COUNT(*) as duplicate_count,
  ARRAY_AGG(id) as duplicate_ids,
  ARRAY_AGG(created_at ORDER BY created_at) as created_timestamps,
  MIN(title) as event_title,
  MIN(date) as event_date
FROM events
WHERE gym_id = 'HGA'
  AND type = 'KIDS NIGHT OUT'
GROUP BY SPLIT_PART(event_url, '?', 1)
HAVING COUNT(*) > 1
ORDER BY MIN(date);

-- Show detailed view of duplicates
WITH base_urls AS (
  SELECT 
    id,
    title,
    date,
    event_url,
    created_at,
    SPLIT_PART(event_url, '?', 1) as base_url,
    ROW_NUMBER() OVER (
      PARTITION BY SPLIT_PART(event_url, '?', 1) 
      ORDER BY created_at
    ) as duplicate_rank
  FROM events
  WHERE gym_id = 'HGA'
    AND type = 'KIDS NIGHT OUT'
)
SELECT 
  base_url,
  title,
  date,
  id,
  created_at,
  duplicate_rank,
  CASE 
    WHEN duplicate_rank > 1 THEN '❌ DUPLICATE - DELETE THIS'
    ELSE '✅ KEEP (original)'
  END as action
FROM base_urls
WHERE base_url IN (
  SELECT base_url
  FROM base_urls
  GROUP BY base_url
  HAVING COUNT(*) > 1
)
ORDER BY date, created_at;



