DEPLOYMENT-GUIDE.md

After changes to the files in the repo, you need to build the project.

**Database migrations (Supabase):**  
Run in SQL Editor as needed:
- `supabase/schema-v8-onboarding.sql` – adds `onboarding_complete` to `profiles`
- `supabase/schema-v9-site-dept-unique.sql` – scopes site/department uniqueness per company/site (allows same names across companies)

**Forgot password:** Add your app's reset URL (e.g. `https://yourdomain.com/reset-password`) to Supabase Dashboard → Authentication → URL Configuration → Redirect URLs.

cd "/Users/davefletes/Library/Mobile Documents/com~apple~CloudDocs/Buisness/DJ2/Applications/INVENTORY MANAGEMENT/Equipment Inventory"

git add .
git commit -m "Enables login and admin"
git push origin main


For setup of forgotten password on login screen
Supabase setup: Add your reset URL (e.g. https://yourdomain.com/reset-password) to Supabase Dashboard → Authentication → URL Configuration → Redirect URLs.




