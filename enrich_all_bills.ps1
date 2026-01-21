# PowerShell script to call bill_search for all IDs in legi_index
# Run this after getting all IDs from the SQL query

$SUPABASE_URL = "https://tvvmkzoiicjrfjbmqzwc.supabase.co"
$SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR2dm1rem9paWNqcmZqYm1xendjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQxMDY0OTUsImV4cCI6MjA2OTY4MjQ5NX0.ZlVa4YsMZVrnvSmkJ7wKBiilQ84jh_qcN1wLl7E-Kso"

# Replace this array with actual IDs from your database
# Get IDs using: SELECT json_agg(id ORDER BY id) FROM legi_index;
$LEGI_IDS = @(1, 2, 3, 4, 5)  # Replace with your actual IDs

# Convert array to JSON
$body = @{
    enrich = $true
    legi_ids = $LEGI_IDS
} | ConvertTo-Json

# Call bill_search with all IDs
$headers = @{
    "Authorization" = "Bearer $SUPABASE_ANON_KEY"
    "Content-Type" = "application/json"
}

$response = Invoke-RestMethod -Uri "$SUPABASE_URL/functions/v1/bill_search" `
    -Method POST `
    -Headers $headers `
    -Body $body

# Display results
$response | ConvertTo-Json -Depth 10
