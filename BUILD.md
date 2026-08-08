# How to Build Equipment Inventory

## Prerequisites

- **Node.js** 20.19 or newer (see `package.json` engines)
- **npm**
- Dependencies installed (`npm install`)
- `.env` configured (see `.env.example` and `DEPLOY-RENDER.md`)

## Production build

```bash
npm install
npm run build
```

This:

1. Builds the React client with Vite → `dist/`
2. Bundles the Express API with esbuild → `dist-server/index.js`

## Run the production build locally

```bash
npm start
```

Serves the API and built client (default port **3000**, or `PORT` from the environment).

## Deploy

See [`DEPLOY-RENDER.md`](DEPLOY-RENDER.md) for deploying to Render (web service + Supabase).

## Version number

Update `version` in `package.json` before a release build if you track versions for deploy notes.

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Build fails on Node version | Use Node 20.19+ |
| Missing env / Supabase errors at runtime | Copy `.env.example` → `.env` and set Supabase + auth keys |
| Port already in use | Set `PORT` or stop the other process |
