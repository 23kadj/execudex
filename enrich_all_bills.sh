#!/bin/bash
# Script to call bill_search for all IDs in legi_index
# Make sure to set your SUPABASE_URL and SUPABASE_ANON_KEY

SUPABASE_URL="https://tvvmkzoiicjrfjbmqzwc.supabase.co"
SUPABASE_ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR2dm1rem9paWNqcmZqYm1xendjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQxMDY0OTUsImV4cCI6MjA2OTY4MjQ5NX0.ZlVa4YsMZVrnvSmkJ7wKBiilQ84jh_qcN1wLl7E-Kso"

# First, get all IDs from legi_index
# You can use the SQL query from enrich_all_bills.sql to get the JSON array
# Or manually build the array below:

# Example: Replace with actual IDs from your database
LEGI_IDS='[1,2,3,4,5]'  # Replace with your actual array

# Call bill_search with all IDs
curl -X POST "${SUPABASE_URL}/functions/v1/bill_search" \
  -H "Authorization: Bearer ${SUPABASE_ANON_KEY}" \
  -H "Content-Type: application/json" \
  -d "{\"enrich\": true, \"legi_ids\": ${LEGI_IDS}}"
