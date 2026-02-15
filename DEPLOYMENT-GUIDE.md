DEPLOYMENT-GUIDE.md

After changes to the files in the repo, you need to build the project.

cd "/Users/davefletes/Library/Mobile Documents/com~apple~CloudDocs/Buisness/DJ2/Applications/INVENTORY MANAGEMENT/Equipment Inventory"

git add .
git commit -m "Enables login and admin"
git push origin main

## Database migrations

Run schema files in order in Supabase SQL Editor if not already applied:
- schema.sql, schema-v2-requests.sql, schema-v3-auth-access.sql, schema-v4-roles-subscription.sql, schema-v5-company-contact.sql
- schema-v6-checkouts.sql (for Scan & Checkout batch flow)
- schema-v7-request-site-room.sql (for Site and Room on equipment requests)


