# Equipment Inventory

A web application for tracking equipment inventory, calibrations, sign-outs, and usage. Built with React, TypeScript, Express, and SQLite.

## Features

- **Equipment Management**: Track make, model, serial number, and calibration dates for each item
- **Equipment Types**: Configure categories (Temperature Logger, Laptop, etc.) with optional calibration requirements and frequency
- **Equipment Number**: Optional ID for items without serial numbers—used for barcode scanning
- **Equipment Requests**: Users request equipment with name, email, phone, building, equipment to test, and dates. Equipment managers approve or reject with comments. Approved requests create sign-out records and appear in equipment history.
- **Request Queue**: Equipment managers review pending requests, approve (creates sign-out) or reject (with comment)
- **Sign-out Tracking**: Record who signed equipment out, when, for what purpose, building, equipment tested, and dates
- **Barcode Scanner**: Use a USB hand scanner to quickly sign out or check in equipment
- **Calibration Status**: View all equipment with calibration due dates—filter by overdue, due soon (30 days), OK, or N/A
- **Calibration Records**: Upload PDF scans of calibration certificates to each equipment item
- **Usage History**: See which systems or equipment each item was used to map/test during sign-outs
- **Mobile Friendly**: Responsive layout with collapsible sidebar on small screens
- **Admin Panel** (inactive): Placeholder for future multi-site access control, user/equipment manager/admin roles

## Requirements

- Node.js 18+
- npm or yarn

## Development

```bash
npm install
npm run dev
```

This starts the API server (port 3000) and Vite dev server (port 5173). Open **http://localhost:5173** in your browser.

## Production

```bash
npm run build
npm run start
```

Then open **http://localhost:3000** (or set `PORT` env var for a different port).

## Where to Upload PDF Calibration Records

1. Go to **Equipment** in the sidebar
2. Click on an equipment item to open its detail page
3. In the **Calibration Records** section, click **Add PDF**
4. Select your PDF file (calibration certificate scan) from your computer
5. The PDF is uploaded and stored on the server

You can click **Open** next to any record to view the PDF in a new browser tab.

## Data Storage

- **Database**: Supabase (PostgreSQL)
- **Calibration PDFs**: Supabase Storage bucket `calibration-records`

See `DEPLOY-RENDER.md` for Supabase setup and deployment to Render's free tier.

## Default Equipment Types

On first run, the app seeds these equipment types:

| Type                  | Calibration Required | Frequency |
|-----------------------|---------------------|-----------|
| Temperature Logger    | Yes                 | 12 months |
| Temp & Humidity Logger| Yes                 | 12 months |
| Laptop                | No                  | —         |
| Temperature Block     | Yes                 | 12 months |
| Temperature Standard | Yes                 | 12 months |

You can add, edit, or remove equipment types in **Equipment Types** (Settings).

## Tech Stack

- **React 18** – UI
- **TypeScript** – Type safety
- **Vite** – Build tooling
- **Express** – API server
- **SQLite (better-sqlite3)** – Database
- **React Router** – Navigation
- **date-fns** – Date formatting
- **Lucide React** – Icons
