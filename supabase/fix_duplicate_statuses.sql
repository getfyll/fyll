-- FIX DUPLICATE ORDER STATUSES
-- Run this in your Supabase SQL Editor to clean up duplicate statuses

-- Step 1: View current duplicates (run this first to see what we're dealing with)
SELECT
  business_id,
  data->>'name' as status_name,
  COUNT(*) as count
FROM order_statuses
GROUP BY business_id, data->>'name'
HAVING COUNT(*) > 1
ORDER BY count DESC;

-- Step 2: View all statuses for your business (to see the full picture)
SELECT id, business_id, data->>'name' as name, data->>'color' as color, created_at
FROM order_statuses
ORDER BY data->>'name', created_at;

-- Step 3: DELETE DUPLICATES - Keep only the oldest entry for each status name per business
-- This keeps the FIRST created entry and removes all duplicates
DELETE FROM order_statuses
WHERE id IN (
  SELECT id FROM (
    SELECT
      id,
      ROW_NUMBER() OVER (
        PARTITION BY business_id, data->>'name'
        ORDER BY created_at ASC NULLS LAST, id ASC
      ) as row_num
    FROM order_statuses
  ) ranked
  WHERE row_num > 1
);

-- Step 4: Verify cleanup - should show no duplicates now
SELECT
  business_id,
  data->>'name' as status_name,
  COUNT(*) as count
FROM order_statuses
GROUP BY business_id, data->>'name'
HAVING COUNT(*) > 1;

-- Step 5: Show final list of statuses
SELECT id, business_id, data->>'name' as name, data->>'color' as color
FROM order_statuses
ORDER BY data->>'name';
