# Deploying to Render

## Prerequisites

- Push your code to a **GitHub** or **GitLab** repository
- A [Render](https://render.com) account (free tier works)

---

## Step 1: Create a Web Service

1. Go to [dashboard.render.com](https://dashboard.render.com)
2. Click **New +** → **Web Service**
3. Connect your repository (GitHub/GitLab)
4. Select the **Equipment Inventory** repo

---

## Step 2: Configure the Service

| Setting | Value |
|---------|-------|
| **Name** | `equipment-inventory` (or any name) |
| **Region** | Choose closest to you |
| **Branch** | `main` (or your default branch) |
| **Runtime** | Node |
| **Build Command** | `npm install && npm run build` |
| **Start Command** | `npm run start` |
| **Instance Type** | Free (or paid for always-on) |

---

## Step 3: Add a Persistent Disk

Your database and PDF files need persistent storage (otherwise they’re lost on each deploy).

1. After creating the service, open it in the dashboard
2. Go to the **Disks** tab
3. Click **Add Disk**
4. Configure:
   - **Name**: `data`
   - **Mount Path**: `/data`
   - **Size**: 1 GB (or more if needed)
5. Click **Save**

---

## Step 4: Set Environment Variable

1. Go to the **Environment** tab
2. Add:
   - **Key**: `DATA_PATH`
   - **Value**: `/data`
3. Click **Save Changes**

---

## Step 5: Deploy

1. Click **Manual Deploy** → **Deploy latest commit** (or push to your branch to trigger auto-deploy)
2. Wait for the build to finish (a few minutes)
3. Your app will be available at `https://equipment-inventory-xxxx.onrender.com`

---

## Notes

- **Free tier**: The service sleeps after ~15 minutes of inactivity. The first request after sleep can take 30–60 seconds.
- **Paid tier**: Keeps the service running and avoids cold starts.
- **Database**: Stored at `/data/equipment-inventory.db` on the disk
- **PDFs**: Stored at `/data/calibration-records/` on the disk
