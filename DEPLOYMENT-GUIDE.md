DEPLOYMENT-GUIDE.md

After changes to the files in the repo, you need to build the project.

**Database migrations (Supabase):**  
Run in SQL Editor as needed:
- `supabase/schema-v8-onboarding.sql` – adds `onboarding_complete` to `profiles`
- `supabase/schema-v9-site-dept-unique.sql` – scopes site/department uniqueness per company/site (allows same names across companies)
- `supabase/schema-v10-subscription-cal.sql` – subscription expiration, cal/due dates on calibration records, subscription_orders table

**Square payments (optional):**  
Add to `.env` for payment processing:
- `SQUARE_ACCESS_TOKEN` – from Square Developer Dashboard
- `SQUARE_LOCATION_ID` – your Square location ID
- `SQUARE_ENV=production` – use for live payments (omit for sandbox)

**Forgot password:** Add your app's reset URL (e.g. `https://yourdomain.com/reset-password`) to Supabase Dashboard → Authentication → URL Configuration → Redirect URLs.


## Deployment after build
```bash
cd "/Users/davefletes/Library/Mobile Documents/com~apple~CloudDocs/Buisness/DJ2/Applications/INVENTORY MANAGEMENT/Equipment Inventory"

git add .
git commit -m "Enables login and admin"
git push origin main
```


## Updating password forgotten integration
```bash
For setup of forgotten password on login screen
Supabase setup: Add your reset URL (e.g. https://yourdomain.com/reset-password) to Supabase Dashboard → Authentication → URL Configuration → Redirect URLs.
```



