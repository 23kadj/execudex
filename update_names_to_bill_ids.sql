-- SQL script to replace name column with bill_id for specific legislation rows
-- Run this in your Supabase SQL Editor

-- STEP 1: Preview what will be updated (run this first to see what will change)
SELECT 
  id, 
  bill_id, 
  name AS current_name,
  bill_id AS new_name,
  CASE WHEN name = bill_id THEN 'Already matches' ELSE 'Will update' END AS status
FROM legi_index
WHERE id IN (
  4, 5, 10, 35, 39, 47, 51, 53, 54, 77,
  103, 109, 110, 114, 116, 120, 127, 133,
  145, 148, 160, 163, 169, 170, 171, 173,
  175, 178, 179, 182, 183
)
AND bill_id IS NOT NULL
ORDER BY id;

-- STEP 2: Perform the update (run this after reviewing the preview)
UPDATE legi_index
SET name = bill_id
WHERE id IN (
  4, 5, 10, 35, 39, 47, 51, 53, 54, 77,
  103, 109, 110, 114, 116, 120, 127, 133,
  145, 148, 160, 163, 169, 170, 171, 173,
  175, 178, 179, 182, 183
)
AND bill_id IS NOT NULL
RETURNING id, bill_id, name;

-- STEP 3: Verify the update (check that name now matches bill_id)
SELECT 
  id, 
  bill_id, 
  name,
  CASE WHEN name = bill_id THEN '✓ Match' ELSE '✗ Mismatch' END AS verification
FROM legi_index
WHERE id IN (
  4, 5, 10, 35, 39, 47, 51, 53, 54, 77,
  103, 109, 110, 114, 116, 120, 127, 133,
  145, 148, 160, 163, 169, 170, 171, 173,
  175, 178, 179, 182, 183
)
ORDER BY id;

-- STEP 4: Find any IDs from the list that are missing bill_id (these were skipped)
SELECT id, bill_id, name
FROM legi_index
WHERE id IN (
  4, 5, 10, 35, 39, 47, 51, 53, 54, 77,
  103, 109, 110, 114, 116, 120, 127, 133,
  145, 148, 160, 163, 169, 170, 171, 173,
  175, 178, 179, 182, 183
)
AND bill_id IS NULL;
