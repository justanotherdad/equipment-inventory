# Deploying to Render (Free Tier) with Supabase

This guide uses **Supabase** for database and file storage, so you can run on Render's **free tier** (no persistent disk required).

---

## Part 1: Set Up Supabase

### Step 1: Create a Supabase Project

1. Go to [supabase.com](https://supabase.com) and sign in (or create an account)
2. Click **New Project**
3. Fill in:
   - **Name**: `equipment-inventory` (or any name)
   - **Database Password**: Choose a strong password (save it somewhere)
   - **Region**: Choose closest to you
4. Click **Create new project** and wait 1–2 minutes

### Step 2: Run the Database Schema

1. In your Supabase project, go to **SQL Editor**
2. Click **New query**
3. Copy the contents of `supabase/schema.sql` from this project and run it
4. Run a second query with the contents of `supabase/schema-v2-requests.sql` (adds equipment requests)
5. Run a third query with the contents of `supabase/schema-v3-auth-access.sql` (adds auth, sites, departments, access control)
6. Run a fourth query with the contents of `supabase/schema-v4-roles-subscription.sql` (roles, companies, subscription levels)
7. You should see "Success. No rows returned" for each

### Step 3: Create the Storage Bucket

1. In Supabase, go to **Storage** in the left sidebar
2. Click **New bucket**
3. Set:
   - **Name**: `calibration-records`
   - **Public bucket**: **Off** (private – we use signed URLs for downloads)
4. Click **Create bucket**

> **Note:** The bucket is private by default. The server uses the service role key, which has full access to upload files and create signed URLs for downloads.

### Step 4: Get Your API Keys

1. In Supabase, go to **Project Settings** (gear icon) → **API**
2. Copy these values (you’ll need them for Render):
   - **Project URL** (e.g. `https://xxxxx.supabase.co`)
   - **service_role** key (under "Project API keys" – **keep this secret**)

---

## Part 2: Deploy to Render

### Step 1: Create a Web Service

1. Go to [dashboard.render.com](https://dashboard.render.com)
2. Click **New +** → **Web Service**
3. Connect your GitHub account if needed
4. Select the **equipment-inventory** repository

### Step 2: Configure the Service

| Setting | Value |
|---------|-------|
| **Name** | `equipment-inventory` |
| **Region** | Choose closest to you |
| **Branch** | `main` |
| **Runtime** | Node |
| **Build Command** | `npm install && npm run build` |
| **Start Command** | `npm run start` |
| **Instance Type** | **Free** |

### Step 3: Add Environment Variables

1. In Render, open your **equipment-inventory** service
2. Click **Environment** in the left sidebar
3. Click **Add Environment Variable**
4. Add each variable below (Key and Value)

**How to add SUPER_ADMIN_EMAIL:**
- Click **Add Environment Variable**
- **Key:** `SUPER_ADMIN_EMAIL`
- **Value:** Your email (e.g. `david.fletes@ctg-gmp.com`)
- Click **Save Changes**
- Trigger a new deploy: **Manual Deploy** → **Deploy latest commit**

**Full list:**

| Key | Value |
|-----|-------|
| `SUPABASE_URL` | Your Supabase Project URL |
| `SUPABASE_SERVICE_KEY` | Your Supabase service_role key |
| `SUPABASE_ANON_KEY` | Your Supabase anon key (for auth) |
| `SUPABASE_STORAGE_BUCKET` | `calibration-records` (optional – this is the default) |
| `SUPER_ADMIN_EMAIL` | Your email – you become super admin on first login |
| `ADMIN_EMAIL` | Same as SUPER_ADMIN_EMAIL (legacy, optional) |

For the **client** (Vite), add these in Render's environment (they are passed at build time):

| Key | Value |
|-----|-------|
| `VITE_SUPABASE_URL` | Same as SUPABASE_URL |
| `VITE_SUPABASE_ANON_KEY` | Same as SUPABASE_ANON_KEY |

### Step 4: Deploy

1. Click **Create Web Service**
2. Wait for the build to finish (a few minutes)
3. Your app will be at `https://equipment-inventory-xxxx.onrender.com`

---

## Deploying Changes

When you update the code:

1. **Commit and push** to GitHub:
   ```bash
   git add .
   git commit -m "Your change description"
   git push origin main
   ```

2. **Render** will automatically detect the push and redeploy (if auto-deploy is on).

3. **Database changes** (new tables, columns): Run any new SQL in Supabase **SQL Editor** before or after the deploy. For example, if you add `schema-v2-requests.sql`, run it once in Supabase.

4. **Manual deploy** (if auto-deploy is off): In Render dashboard → your service → **Manual Deploy** → **Deploy latest commit**.

---

## Part 3: Local Development with Supabase

To run locally with the same Supabase backend:

1. Copy `.env.example` to `.env`
2. Fill in your Supabase URL and service role key
3. Run `npm run dev`

The server loads credentials from `.env` automatically.

---

## Notes

- **Free tier**: The Render service sleeps after ~15 minutes of inactivity. The first request may take 30–60 seconds.
- **Supabase free tier**: 500MB database, 1GB file storage – enough for typical use.
- **No disk needed**: Database and PDFs are stored in Supabase, not on Render.

---

## Subscription Levels (schema-v4)

| Level | Sites | Depts/Site | Eq Managers | Users |
|-------|-------|------------|-------------|-------|
| 1 | 1 | 2 | 2 | 20 |
| 2 | 2 | 4 | 3 | 50 |
| 3 | 5 | 3 | 10 | 200 |
| 4 (enterprise) | 10 | 5 | 20 | 500 |

---

## Remaining Work

- [x] **Subscription activation** – Super admin UI to enable/disable subscription per company
- [x] **Company admin portal** – Company-scoped admin for company admins (profiles, sites, departments filtered by company)
- [x] **Equipment bulk edit** – Checkbox column and bulk edit action on Equipment list
- [x] **User request history** – Users see only their own requests (Request Queue shows "My Requests")
- [x] **Equipment manager user creation** – Equipment managers can add users via Create User with access within their scope
- [x] **Auto-check new equipment** – New equipment in a department is auto-added to profile_access for users with equipment-level access in that department
