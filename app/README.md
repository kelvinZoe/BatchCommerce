# Shakhis Commerce

A desktop application for managing WhatsApp-based product sales, built with Angular and Electron.

## Features

- **Dashboard**: Overview of products, clients, orders, and revenue
- **Products Management**: Add, edit, and manage your product catalog with prices
- **Clients Management**: Track customer information including phone and WhatsApp numbers
- **Orders**: Create and manage orders with multiple items, track payment status
- **Deliveries**: Track delivery status and manage delivery schedules
- **Buying List**: Manage purchase batches and track inventory arrivals
- **Excel Import**: Import data from existing Excel spreadsheets
- **SQLite Database**: Local data storage with backup capability

## Prerequisites

- Node.js 18+ 
- npm 9+

## Installation

```bash
cd app
npm install
```

## Development

Run the Angular dev server:
```bash
npm start
```

Run Electron in development mode (opens the app pointing to localhost:4200):
```bash
npm run electron:dev
```
Web vs Desktop builds
---------------------

This repository supports both a web-hosted SPA and a thin Electron desktop wrapper. The Angular app is the single source of truth — build it once and run it in either runtime.

Web (production)

Build the SPA for production and serve it locally for testing:

```bash
npm run build:web
npm run start:web
```

Desktop (Electron)

Run Electron in development (the shell points at the local dev server):

```bash
npm run electron:dev
```

Package the desktop app for the current platform (uses `electron-builder`):

```bash
npm run dist
```

Platform-specific packaging

- Build macOS installer (`.dmg`):

```bash
npm run dist:mac
```

- Build Linux AppImage:

```bash
npm run dist:linux
```

- Build Windows distributable on this machine (requires Wine on macOS):

```bash
# on macOS: ensure Wine is installed (you mentioned you have wine-stable installed)
# e.g. using Homebrew: brew install --cask wine-stable
npm run dist:win
```

- Build all targets (mac, win, linux):

```bash
npm run dist:all
```

Notes about Windows builds on macOS

- Building Windows installers (NSIS or signed installers) on macOS often requires Wine to perform certain packaging steps. You said you have `wine-stable` installed — that will typically satisfy electron-builder's Windows tooling. On Apple Silicon you may need to run Homebrew under Rosetta or use a CI runner that provides Windows build support.
- If you only need the portable `.exe` output, the default `win` target in `build.win.target` is set to `portable` which can be produced without full NSIS tooling in some configurations.
- Code signing / notarization: for macOS and Windows code signing you will need valid signing identities and credentials configured as environment variables or in your CI. For macOS notarization an Apple Developer account is required.

General notes

- Use the `ElectronService` (`src/app/services/electron.service.ts`) to access `openFile` / `saveFile` dialogs. It safely guards against missing `window.electronAPI` so the same code runs in a browser without changes.
- Keep privileged keys (Supabase `service_role` etc.) on the server only; do not ship them to the browser. The admin API runs from `server/index.js`.

## Production Build

Build and package the app:
```bash
npm run dist
```

This will create:
- macOS: `.dmg` file in `release/` folder
- Windows: `.exe` installer in `release/` folder
- Linux: `.AppImage` in `release/` folder

## Project Structure

```
app/
├── electron/
│   ├── main.js          # Electron main process
│   └── preload.js       # Preload script for IPC
├── src/
│   ├── app/
│   │   ├── models/      # TypeScript interfaces
│   │   ├── services/    # Database and Excel services
│   │   └── pages/       # Angular components
│   │       ├── dashboard/
│   │       ├── products/
│   │       ├── clients/
│   │       ├── orders/
│   │       ├── deliveries/
│   │       ├── buying-list/
│   │       ├── import/
│   │       └── settings/
│   ├── styles.scss      # Global styles
│   └── index.html
├── angular.json
├── package.json
└── tsconfig.json
```

Vercel deployment
-----------------

This project is configured for Vercel as a monorepo. The repository root contains `vercel.json` which tells Vercel to use `app/package.json` to build the SPA and publish `dist/shakhis-commerce`.

Quick setup:

1. In the Vercel dashboard, import the GitHub repository `kelvinZoe/BatchCommerce`.
2. Set the Project Root to `app` (Vercel will detect `app/package.json`).
3. Build Command: `npm run build` (the project runs a small `scripts/generate-env.js` before build).
4. Output Directory: `dist/shakhis-commerce` (this is also configured in `vercel.json`).
5. Add environment variables (via Dashboard or CLI): see `vercel.env.example` in repo root.

If you prefer CLI:

```bash
# install vercel CLI
npm i -g vercel

# login and deploy from the repo root
vercel login
vercel --cwd app
```

Notes:
- Do NOT store sensitive keys in the repository. Use the Vercel dashboard to add `SUPABASE_URL`, `SUPABASE_KEY`, and `ADMIN_API_URL` for `Preview` and `Production` environments.
- The `app/scripts/generate-env.js` script writes `environment.prod.ts` at build time from those environment variables so the Angular build picks them up.

## Database

The app uses SQLite for local data storage. The database file is stored in:
- macOS: `~/Library/Application Support/shakhis-commerce/`
- Windows: `%APPDATA%/shakhis-commerce/`
- Linux: `~/.config/shakhis-commerce/`

### Tables
- `products` - Product catalog with prices
- `clients` - Customer information
- `orders` - Order records
- `order_items` - Individual items in orders
- `deliveries` - Delivery tracking
- `buying_list` - Purchase/inventory tracking

## Excel Import

The app can import data from Excel files with the following sheets:
- **PRICES**: Product names and prices
- **Buying List**: Items to purchase
- **ITEMS SORTING**: Client orders by product
- **Delivery**: Delivery records

## License

MIT
