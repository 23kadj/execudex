-- SQL queries to get all IDs from legi_index and prepare for bill_search enrichment

-- 1. Get all IDs as a simple list:
SELECT id FROM legi_index ORDER BY id;

-- 2. Get all IDs as a JSON array (ready for API call):
SELECT json_agg(id ORDER BY id) as legi_ids FROM legi_index;

-- 3. Get count of total bills:
SELECT COUNT(*) as total_bills FROM legi_index;

-- 4. Get all IDs as comma-separated list (for easy copying):
SELECT string_agg(id::text, ', ' ORDER BY id) as legi_ids_csv FROM legi_index;
