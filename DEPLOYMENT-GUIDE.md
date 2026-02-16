DEPLOYMENT-GUIDE.md

After changes to the files in the repo, you need to build the project.

**Database migration (company admin onboarding):**  
If using Supabase, run `supabase/schema-v8-onboarding.sql` in the SQL Editor to add the `onboarding_complete` column to `profiles`.

**Forgot password:** Add your app's reset URL (e.g. `https://yourdomain.com/reset-password`) to Supabase Dashboard → Authentication → URL Configuration → Redirect URLs.

cd "/Users/davefletes/Library/Mobile Documents/com~apple~CloudDocs/Buisness/DJ2/Applications/INVENTORY MANAGEMENT/Equipment Inventory"

git add .
git commit -m "Enables login and admin"
git push origin main






