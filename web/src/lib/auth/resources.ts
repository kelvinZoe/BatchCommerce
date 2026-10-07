export const APP_RESOURCES = [
  "dashboard",
  "arrivals",
  "product_tracking",
  "reports",
  "products",
  "clients",
  "orders",
  "deliveries",
  "buying_list",
  "damaged_items",
  "expenses",
  "import",
  "users",
  "roles",
  "settings",
  "stock_sales",
  "shipping",
  "batches"
] as const;

export type AppResource = (typeof APP_RESOURCES)[number];

export type WorkspaceRoute = {
  href: `/${string}`;
  label: string;
  resource: AppResource;
  section: "main" | "admin";
};

export const WORKSPACE_ROUTES = [
  { href: "/dashboard", label: "Dashboard", resource: "dashboard", section: "main" },
  { href: "/clients", label: "Clients", resource: "clients", section: "main" },
  { href: "/products", label: "Products", resource: "products", section: "main" },
  { href: "/orders", label: "Orders", resource: "orders", section: "main" },
  { href: "/buying-list", label: "Buying List", resource: "buying_list", section: "main" },
  { href: "/arrivals", label: "Arrivals", resource: "arrivals", section: "main" },
  { href: "/product-tracking", label: "Tracking", resource: "product_tracking", section: "main" },
  { href: "/shipping", label: "Shipping", resource: "shipping", section: "main" },
  { href: "/shipping-ledger", label: "Shipping Ledger", resource: "shipping", section: "main" },
  { href: "/deliveries", label: "Deliveries", resource: "deliveries", section: "main" },
  { href: "/stock-sales", label: "Stock Sales", resource: "stock_sales", section: "main" },
  { href: "/damaged-items", label: "Damaged Items", resource: "damaged_items", section: "main" },
  { href: "/reports", label: "Reports", resource: "reports", section: "main" },
  { href: "/expenses", label: "Expenses", resource: "expenses", section: "admin" },
  { href: "/import", label: "Import Data", resource: "import", section: "admin" },
  { href: "/batches", label: "Manage Batches", resource: "batches", section: "admin" },
  { href: "/users", label: "Users", resource: "users", section: "admin" },
  { href: "/roles", label: "Roles & Permissions", resource: "roles", section: "admin" },
  { href: "/subscription", label: "Subscription", resource: "settings", section: "admin" },
  { href: "/settings", label: "Settings", resource: "settings", section: "admin" }
] as const satisfies readonly WorkspaceRoute[];

export function isAppResource(value: string): value is AppResource {
  return (APP_RESOURCES as readonly string[]).includes(value);
}
