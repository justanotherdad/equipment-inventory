# How to Run Equipment Inventory

## Prerequisites

- **Node.js** 20.19 or newer
- **npm** (comes with Node.js)

Check your versions:

```bash
node --version   # Should be v20.19.x or higher
npm --version
```

## Development Mode

```bash
npm install
npm run dev
```

This starts:

1. **Express API** (`npm run dev:server`) on port **3000**
2. **Vite** React client (`npm run dev:client`) on port **5173**

Open **http://localhost:5173** in your browser.

Copy `.env.example` to `.env` and set Supabase / auth values before first run (see `DEPLOY-RENDER.md`).

## Barcode Scanner

USB barcode scanners work as keyboard input devices. On the **Sign-outs** page, use the scan input at the top:

1. Click in the scan field (or it auto-focuses)
2. Scan a barcode (serial number or equipment number)
3. The scanner sends the value + Enter—the app opens the sign-out or check-in form automatically

For equipment without serial numbers, set an **Equipment Number** when adding the item. Print a barcode label with that number for scanning.

## Production locally

```bash
npm run build
npm start
```

Open **http://localhost:3000** (or the port set by `PORT`).

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Auth / API errors | Ensure `.env` has Supabase URL and keys; restart `npm run dev` |
| Port 5173 in use | Stop other Vite processes or change the port in `vite.config.ts` |
| Port 3000 in use | Stop the other API process or set `PORT` |
| Blank page | Check the terminal for Vite or API errors |
