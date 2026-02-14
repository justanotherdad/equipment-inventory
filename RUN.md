# How to Run Equipment Inventory

## Prerequisites

- **Node.js** 18 or newer
- **npm** (comes with Node.js)

Check your versions:

```bash
node --version   # Should be v18.x or higher
npm --version
```

## Development Mode

Run the app with hot-reload for development:

```bash
cd equipment-inventory
npm install
npm run dev
```

This will:

1. Compile the Electron main process (TypeScript → JavaScript)
2. Start the Vite dev server for the React frontend
3. Launch Electron and open the app window
4. Connect to `http://localhost:5173` for live reload

The app window opens with DevTools enabled. Changes to React components will hot-reload; changes to `main/` require restarting (`Ctrl+C` then `npm run dev` again).

## Barcode Scanner

USB barcode scanners work as keyboard input devices. On the **Sign-outs** page, use the scan input at the top:

1. Click in the scan field (or it auto-focuses)
2. Scan a barcode (serial number or equipment number)
3. The scanner sends the value + Enter—the app opens the sign-out or check-in form automatically

For equipment without serial numbers, set an **Equipment Number** when adding the item. Print a barcode label with that number for scanning.

## First Run

On first launch, the app creates:

- **Database**: `~/Library/Application Support/equipment-inventory/equipment-inventory.db` (macOS)  
  or `%APPDATA%\equipment-inventory\equipment-inventory.db` (Windows)
- **Calibration records folder**: Same directory, `calibration-records/`

Default equipment types (Temperature Logger, Laptop, etc.) are seeded automatically.

## Troubleshooting

| Issue | Solution |
|-------|----------|
| `tsc: command not found` | Run `npm install` first, then use `npm run dev` (which uses `npx tsc`) |
| `API not available` | The app must run via Electron. Use `npm run dev`, not `npm run dev:react` alone |
| Port 5173 in use | Stop other Vite processes or change the port in `vite.config.ts` |
| Blank window | Wait for Vite to finish compiling, or check the terminal for errors |
