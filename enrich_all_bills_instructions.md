# Instructions: Enrich All Bills with bill_search

## Step 1: Get All IDs from Database

Run this SQL query in your Supabase SQL Editor:

```sql
SELECT json_agg(id ORDER BY id) as legi_ids FROM legi_index;
```

Copy the JSON array (e.g., `[1,2,3,4,5,...]`)

## Step 2: Call bill_search Function

### Option A: Using curl (Windows Command Prompt)

```bash
curl -X POST "https://tvvmkzoiicjrfjbmqzwc.supabase.co/functions/v1/bill_search" ^
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR2dm1rem9paWNqcmZqYm1xendjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQxMDY0OTUsImV4cCI6MjA2OTY4MjQ5NX0.ZlVa4YsMZVrnvSmkJ7wKBiilQ84jh_qcN1wLl7E-Kso" ^
  -H "Content-Type: application/json" ^
  -d "{\"enrich\": true, \"legi_ids\": [1,2,3,4,5]}"
```

Replace `[1,2,3,4,5]` with your actual array from Step 1.

### Option B: Using PowerShell

1. Use the `enrich_all_bills.ps1` script
2. Replace the `$LEGI_IDS` array with your actual IDs from Step 1
3. Run: `.\enrich_all_bills.ps1`

### Option C: Using the Supabase Dashboard

1. Go to Database > Functions
2. Find `bill_search` function
3. Use the test interface with:
```json
{
  "enrich": true,
  "legi_ids": [1, 2, 3, 4, 5]
}
```

## Alternative: Process All Missing Metadata

If you want to enrich only bills that are missing metadata, you can call:

```bash
curl -X POST "https://tvvmkzoiicjrfjbmqzwc.supabase.co/functions/v1/bill_search" ^
  -H "Authorization: Bearer YOUR_ANON_KEY" ^
  -H "Content-Type: application/json" ^
  -d "{\"enrich\": true}"
```

This will automatically find and enrich all bills missing metadata fields.
