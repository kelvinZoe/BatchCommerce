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
