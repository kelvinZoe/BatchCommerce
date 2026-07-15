export * from './batch-workflow';

export interface Product {
  id?: number;
  name: string;
  stock?: number;
  preorderPrice: number | null;
  purchasePrice: number | null;
  description?: string;
  imageUrl?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface ProductCatalog {
  id?: number;
  displayIndex?: number;
  name: string;
  description?: string;
  imageUrl?: string;
  isActive?: boolean;
  stock?: number;
  stockPrice?: number;
  stockDiscountMinQty?: number;
  stockDiscountPrice?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface BatchProduct {
  id?: number;
  shopId?: string;
  displayIndex?: number;
  batchId: number;
  productId: number;
  productName?: string;
  description?: string;
  imageUrl?: string;
  preorderPrice: number;
  preorderDiscountMinQty: number;
  preorderDiscountPrice: number;
  stockPrice: number;
  stockDiscountMinQty: number;
  stockDiscountPrice: number;
  inStockQty: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface Client {
  id?: number;
  name: string;
  phone: string;
  whatsappNumber?: string;
  address?: string;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface Shop {
  id?: string;
  name: string;
  slug: string;
  isActive?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface ShopMembership {
  id?: string;
  shopId: string;
  authUserId?: string;
  appUserId?: number;
  roleId?: number;
  roleName?: string;
  shopName?: string;
  shopSlug?: string;
  isOwner?: boolean;
  isActive?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export type MembershipStatus = 'pending_verification' | 'active' | 'suspended' | 'removed';

// ── Batches ───────────────────────────────────────────
export type OrderBatchStatus = 'open' | 'closed';

export interface OrderBatch {
  id?: number;
  name: string;
  status: OrderBatchStatus;
  orderStatus: OrderStatus;
  buyingStatus: BuyingStatus;
  deliveryStatus: DeliveryBatchStatus;
  arrivalsSent?: boolean;
  stockApplied?: boolean;
  closedAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

// ── Delivery Categories ───────────────────────────────
export type DeliveryCategory = 'station_car_delivery' | 'riders' | 'ghana_post';

export const DELIVERY_CATEGORIES: { value: DeliveryCategory; label: string }[] = [
  { value: 'station_car_delivery', label: 'Station Car Delivery' },
  { value: 'riders',               label: 'Riders' },
  { value: 'ghana_post',           label: 'Ghana Post' },
];

export interface Order {
  id?: number;
  orderUuid?: string;
  batchId?: number;
  clientId: number;
  clientName?: string;
  clientPhone?: string;
  items: OrderItem[];
  totalAmount: number;
  deliveryFee?: number;
  deliveryCategory?: DeliveryCategory;
  paymentStatus: PaymentStatus;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface OrderItem {
  id?: number;
  orderId?: number;
  batchProductId?: number;
  productId: number;
  productName?: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
  fulfilledQuantity?: number;
  shortfallQuantity?: number;
  hasFulfillmentAdjustment?: boolean;
  adjustmentReason?: string | null;
  adjustmentHistory?: OrderItemAdjustment[];
}

export interface OrderItemAdjustment {
  id?: number;
  orderItemId?: number;
  arrivalItemId?: number | null;
  damagedItemId?: number | null;
  originalQuantity: number;
  adjustedQuantity: number;
  damagedQuantity: number;
  reason?: string | null;
  isActive: boolean;
  createdAt?: string;
  undoneAt?: string | null;
}

export interface Delivery {
  id?: number;
  orderId: number;
  clientId: number;
  clientName?: string;
  clientPhone?: string;
  clientAddress?: string;
  items: string;
  quantity: number;
  deliveryFee: number;
  deliveryCategory?: DeliveryCategory;
  deliveryAddress?: string;
  deliveryDate: string | null;
  status: DeliveryStatus;
  deliveryItemStatus?: DeliveryItemStatus;
  batchName?: string;
  notes?: string;
  createdAt?: string;
}

export interface BuyingListItem {
  id?: number;
  batchId?: number;
  batchProductId?: number;
  productId?: number;
  productName: string;
  requestedQty?: number;
  orderedQty?: number;
  inStockQty?: number;
  requestedQuantity: number;
  orderedQuantity?: number;
  quantityArrived?: number;
  orderCount?: number;
  batchName?: string;
  movedToArrivals?: boolean;
  status: BuyingStatus;
  source?: 'client' | 'shop';
  createdAt?: string;
  updatedAt?: string;
}

export interface ArrivalItem {
  id?: number;
  batchId?: number;
  batchProductId?: number;
  productId?: number;
  productName: string;
  orderedQuantity: number;
  boughtQuantity?: number;
  requestedQuantity?: number;
  receivedQuantity: number;
  batchName?: string;
  productStock?: number;
  confirmed: boolean;
  sentToShipping?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

// =====================
// Auth & RBAC Models
// =====================

export interface User {
  id?: number;
  authId?: string;
  shopId?: string;
  membershipId?: string | number;
  username: string;
  password?: string;
  fullName: string;
  email?: string;
  phone?: string;
  roleId: number;
  roleName?: string;
  isActive: boolean;
  membershipStatus?: MembershipStatus;
  phoneVerifiedAt?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface Role {
  id?: number;
  name: string;
  description?: string;
  isSystem: boolean;      // true = built-in (Admin, Sales, etc.) — cannot be deleted
  permissions?: Permission[];
  createdAt?: string;
}

/** Controls which sections of the dashboard are visible to a role */
export interface DashboardComponentConfig {
  stats: boolean;           // Summary cards: products, clients, orders today, pending deliveries
  finance: boolean;         // Finance overview: revenue, shipping, paid orders
  revenueTrend: boolean;    // 6-month revenue trend chart (requires finance)
  topProducts: boolean;     // Top 10 products by period (requires finance)
  deliveryOverview: boolean;// Delivery breakdown pie chart
  batchPipeline: boolean;   // Batch stages: Open → Buying → Delivering → Completed
  recentOrders: boolean;    // Recent orders list (requires finance)
  expenses: boolean;        // Expense trend + expense category breakdown
  stockSales: boolean;      // Stock sales performance
  damagedItems: boolean;    // Damaged items summary
  inventory: boolean;       // Inventory arrivals status
}

export const DEFAULT_DASHBOARD_CONFIG: DashboardComponentConfig = {
  stats: false, finance: false, revenueTrend: false, topProducts: false,
  deliveryOverview: false, batchPipeline: false, recentOrders: false,
  expenses: false, stockSales: false, damagedItems: false, inventory: false
};

export const DASHBOARD_COMPONENTS: {
  key: keyof DashboardComponentConfig;
  label: string;
  icon: string;
  description: string;
  dependsOn?: keyof DashboardComponentConfig;
}[] = [
  { key: 'stats',           label: 'Summary Stats',     icon: 'bar_chart',              description: 'Products, clients, orders today, pending deliveries' },
  { key: 'finance',         label: 'Finance Overview',  icon: 'account_balance',        description: 'Revenue, shipping fees, paid orders this batch' },
  { key: 'revenueTrend',    label: 'Revenue Trend',     icon: 'trending_up',            description: '6-month revenue bar chart', dependsOn: 'finance' },
  { key: 'topProducts',     label: 'Top Products',      icon: 'inventory_2',            description: 'Top 10 products by sales period', dependsOn: 'finance' },
  { key: 'deliveryOverview',label: 'Delivery Overview', icon: 'local_shipping',         description: 'Delivery breakdown by shipping method' },
  { key: 'batchPipeline',   label: 'Batch Pipeline',    icon: 'linear_scale',           description: 'Batch stages: Open → Buying → Delivering → Completed' },
  { key: 'recentOrders',    label: 'Recent Orders',     icon: 'shopping_cart',          description: 'Last 5 placed orders', dependsOn: 'finance' },
  { key: 'expenses',        label: 'Expenses',          icon: 'account_balance_wallet', description: 'Expense trends and breakdown by category' },
  { key: 'stockSales',      label: 'Stock Sales',       icon: 'storefront',             description: 'Stock sales performance' },
  { key: 'damagedItems',    label: 'Damaged Items',     icon: 'report_problem',         description: 'Damaged items summary and top damaged products' },
  { key: 'inventory',       label: 'Inventory Status',  icon: 'inventory',              description: 'Arrivals, received items, pending quantities' },
];

/** Controls which product operations a role can perform */
export interface ProductPermissionConfig {
  canAddBatch: boolean;              // Can create new batches
  canDeleteBatch: boolean;           // Can delete batches from the Products page
  canEditBatchName: boolean;         // Can rename batches from the Products page
  canAddProductToBatch: boolean;     // Can add products to batches (new or existing)
  canEditPricesAndStockOnAdd: boolean; // Can edit prices and stock values while adding to a batch
  canEditBatchProduct: boolean;      // Can edit existing batch products
  canEditBatchProductPricing: boolean; // Can edit prices and stock values on existing batch products
  canEditBatchProductAfterBatchClosed: boolean; // Can edit batch products after a batch is closed
  canDeleteProductFromBatch: boolean;// Can delete products from batches
  canDeleteProductAfterBatchClosed: boolean; // Can delete batch products after a batch is closed
}

export const DEFAULT_PRODUCT_CONFIG: ProductPermissionConfig = {
  canAddBatch: false,
  canDeleteBatch: false,
  canEditBatchName: false,
  canAddProductToBatch: false,
  canEditPricesAndStockOnAdd: false,
  canEditBatchProduct: false,
  canEditBatchProductPricing: false,
  canEditBatchProductAfterBatchClosed: false,
  canDeleteProductFromBatch: false,
  canDeleteProductAfterBatchClosed: false
};

export const PRODUCT_OPERATIONS: {
  key: keyof ProductPermissionConfig;
  label: string;
  icon: string;
  description: string;
}[] = [
  { key: 'canAddBatch',               label: 'Add Batch',             icon: 'create_new_folder',  description: 'Create new batches' },
  { key: 'canDeleteBatch',            label: 'Delete Batch',          icon: 'folder_delete',      description: 'Delete batches from the Products page' },
  { key: 'canEditBatchName',          label: 'Rename Batch',          icon: 'drive_file_rename_outline', description: 'Edit a batch name' },
  { key: 'canAddProductToBatch',      label: 'Add Products to Batch', icon: 'playlist_add',      description: 'Add products to a batch' },
  { key: 'canEditPricesAndStockOnAdd', label: 'Set Prices While Adding', icon: 'price_change',    description: 'Edit prices and stock values when adding products to a batch' },
  { key: 'canEditBatchProduct',       label: 'Edit Batch Products',   icon: 'edit_note',         description: 'Edit existing products already attached to a batch' },
  { key: 'canEditBatchProductPricing', label: 'Edit Batch Product Prices', icon: 'request_quote', description: 'Edit prices and stock values on an existing batch product' },
  { key: 'canEditBatchProductAfterBatchClosed', label: 'Edit After Batch Closed', icon: 'lock_open', description: 'Edit batch products after the batch is closed' },
  { key: 'canDeleteProductFromBatch', label: 'Delete Batch Product',  icon: 'delete_sweep',      description: 'Remove products from batches' },
  { key: 'canDeleteProductAfterBatchClosed', label: 'Delete After Batch Closed', icon: 'delete_forever', description: 'Delete batch products after the batch is closed' },
];

/** Orders page operation permissions */
export interface OrdersPermissionConfig {
  canCreateOrder: boolean;           // Create new orders
  canAddItemsToOrder: boolean;       // Add items to existing orders
  canDeleteOrder: boolean;           // Delete orders
  canCloseBatch: boolean;            // Close a batch
  canReopenBatch: boolean;           // Reopen closed batch
  canEditOrderAfterBatchClosed: boolean; // Edit order after batch is closed
}

export const DEFAULT_ORDERS_CONFIG: OrdersPermissionConfig = {
  canCreateOrder: false, canAddItemsToOrder: false, canDeleteOrder: false,
  canCloseBatch: false, canReopenBatch: false, canEditOrderAfterBatchClosed: false
};

export const ORDERS_OPERATIONS: { key: keyof OrdersPermissionConfig; label: string; icon: string; description: string }[] = [
  { key: 'canCreateOrder', label: 'Create Orders', icon: 'add_shopping_cart', description: 'Create new orders' },
  { key: 'canAddItemsToOrder', label: 'Add Items to Order', icon: 'add_circle', description: 'Add more items to existing orders' },
  { key: 'canDeleteOrder', label: 'Delete Orders', icon: 'delete', description: 'Delete orders' },
  { key: 'canCloseBatch', label: 'Close Batch', icon: 'lock', description: 'Close batches' },
  { key: 'canReopenBatch', label: 'Reopen Batch', icon: 'lock_open', description: 'Reopen closed batches' },
  { key: 'canEditOrderAfterBatchClosed', label: 'Edit After Close', icon: 'edit_note', description: 'Edit orders after batch is closed' },
];

/** Buying List page operation permissions */
export interface BuyingListPermissionConfig {
  canEditQuantityOrdered: boolean;   // Edit quantity ordered
  canChangeStatus: boolean;          // Change status
  canEditAfterArrived: boolean;      // Edit after status changed to arrived
  canAddItemToBuyingList: boolean;   // Add new items to buying list
  canSendToArrivals: boolean;        // Send items to arrivals
  canEditAfterSent: boolean;         // Edit after item has been sent onward
  canReverseFromArrivals: boolean;   // Reverse unconfirmed arrivals back to buying list
}

export const DEFAULT_BUYING_LIST_CONFIG: BuyingListPermissionConfig = {
  canEditQuantityOrdered: false, canChangeStatus: false, canEditAfterArrived: false,
  canAddItemToBuyingList: false, canSendToArrivals: false, canEditAfterSent: false,
  canReverseFromArrivals: false
};

export const BUYING_LIST_OPERATIONS: { key: keyof BuyingListPermissionConfig; label: string; icon: string; description: string }[] = [
  { key: 'canEditQuantityOrdered', label: 'Edit Quantity', icon: 'edit', description: 'Edit quantity ordered' },
  { key: 'canChangeStatus', label: 'Change Status', icon: 'assignment', description: 'Change item status' },
  { key: 'canEditAfterArrived', label: 'Edit After Arrival', icon: 'edit_note', description: 'Edit items after marked as arrived' },
  { key: 'canAddItemToBuyingList', label: 'Add Items', icon: 'add_circle', description: 'Add new items to buying list' },
  { key: 'canSendToArrivals', label: 'Send to Arrivals', icon: 'send', description: 'Send items to arrivals' },
  { key: 'canEditAfterSent', label: 'Edit After Sent', icon: 'published_with_changes', description: 'Edit an item after it has been sent onward' },
  { key: 'canReverseFromArrivals', label: 'Reverse From Arrivals', icon: 'undo', description: 'Move unconfirmed arrivals back to the buying list' },
];

/** Arrivals page operation permissions */
export interface ArrivalsPermissionConfig {
  canChangeReceivedValue: boolean;   // Change received value
  canConfirmReceivedItems: boolean;  // Confirm received items
  canSendToShipping: boolean;        // Send to shipping
  canReverseToArrivals: boolean;     // Reverse an item back to arrivals
  canReverseToBuyingList: boolean;   // Reverse unconfirmed arrivals back to buying list
}

export const DEFAULT_ARRIVALS_CONFIG: ArrivalsPermissionConfig = {
  canChangeReceivedValue: false, canConfirmReceivedItems: false, canSendToShipping: false,
  canReverseToArrivals: false, canReverseToBuyingList: false
};

export const ARRIVALS_OPERATIONS: { key: keyof ArrivalsPermissionConfig; label: string; icon: string; description: string }[] = [
  { key: 'canChangeReceivedValue', label: 'Change Received Value', icon: 'edit', description: 'Update received quantities' },
  { key: 'canConfirmReceivedItems', label: 'Confirm Items', icon: 'done_all', description: 'Confirm received items' },
  { key: 'canSendToShipping', label: 'Send to Shipping', icon: 'local_shipping', description: 'Send items to shipping' },
  { key: 'canReverseToArrivals', label: 'Reverse to Arrivals', icon: 'undo', description: 'Reverse an item back to arrivals' },
  { key: 'canReverseToBuyingList', label: 'Reverse to Buying List', icon: 'assignment_return', description: 'Move unconfirmed arrivals back to the buying list' },
];

/** Shipping page operation permissions */
export interface ShippingPermissionConfig {
  canEditShippingItem: boolean;      // Edit shipping item
  canChangeShippingValue: boolean;   // Change shipping value
}

export const DEFAULT_SHIPPING_CONFIG: ShippingPermissionConfig = {
  canEditShippingItem: false, canChangeShippingValue: false
};

export const SHIPPING_OPERATIONS: { key: keyof ShippingPermissionConfig; label: string; icon: string; description: string }[] = [
  { key: 'canEditShippingItem', label: 'Edit Item', icon: 'edit', description: 'Edit shipping items' },
  { key: 'canChangeShippingValue', label: 'Change Value', icon: 'local_offer', description: 'Change shipping value' },
];

/** Shipping Ledger page operation permissions */
export interface ShippingLedgerPermissionConfig {
  canAddAmountPaid: boolean;         // Add amount paid
  canMoveToDeliveries: boolean;      // Move item to deliveries
  canEditAmountPaidAfterMove: boolean; // Edit amount after moved to deliveries
}

export const DEFAULT_SHIPPING_LEDGER_CONFIG: ShippingLedgerPermissionConfig = {
  canAddAmountPaid: false, canMoveToDeliveries: false, canEditAmountPaidAfterMove: false
};

export const SHIPPING_LEDGER_OPERATIONS: { key: keyof ShippingLedgerPermissionConfig; label: string; icon: string; description: string }[] = [
  { key: 'canAddAmountPaid', label: 'Add Amount Paid', icon: 'add_circle', description: 'Record payment amount' },
  { key: 'canMoveToDeliveries', label: 'Move to Deliveries', icon: 'send', description: 'Move item to deliveries' },
  { key: 'canEditAmountPaidAfterMove', label: 'Edit After Move', icon: 'edit_note', description: 'Edit amount paid after moved to deliveries' },
];

/** Stock Sales page operation permissions */
export interface StockSalesPermissionConfig {
  canDeleteSale: boolean;            // Delete a sale
  canEditSale: boolean;              // Edit a sale
  canAddSale: boolean;               // Add new sale
  canCloseSale: boolean;             // Close/finalize a sale
}

export const DEFAULT_STOCK_SALES_CONFIG: StockSalesPermissionConfig = {
  canDeleteSale: false, canEditSale: false, canAddSale: false, canCloseSale: false
};

export const STOCK_SALES_OPERATIONS: { key: keyof StockSalesPermissionConfig; label: string; icon: string; description: string }[] = [
  { key: 'canDeleteSale', label: 'Delete Sale', icon: 'delete', description: 'Delete sales records' },
  { key: 'canEditSale', label: 'Edit Sale', icon: 'edit', description: 'Edit existing sales' },
  { key: 'canAddSale', label: 'Add Sale', icon: 'add_circle', description: 'Add new sales' },
  { key: 'canCloseSale', label: 'Close Sale', icon: 'task_alt', description: 'Close or finalize a sale' },
];

/** Manage Batches page operation permissions */
export interface ManageBatchesPermissionConfig {
  canDeleteBatch: boolean;           // Delete a batch
  canRenameBatch: boolean;           // Rename a batch
}

export const DEFAULT_MANAGE_BATCHES_CONFIG: ManageBatchesPermissionConfig = {
  canDeleteBatch: false,
  canRenameBatch: false
};

export const MANAGE_BATCHES_OPERATIONS: { key: keyof ManageBatchesPermissionConfig; label: string; icon: string; description: string }[] = [
  { key: 'canDeleteBatch', label: 'Delete Batch', icon: 'delete', description: 'Delete batches' },
  { key: 'canRenameBatch', label: 'Rename Batch', icon: 'drive_file_rename_outline', description: 'Rename batches' },
];

/** Roles page operation permissions */
export interface RolesPermissionConfig {
  canEditRole: boolean;              // Edit a role
  canAddRole: boolean;               // Add new role
  canDeleteRole: boolean;            // Delete role
}

export const DEFAULT_ROLES_CONFIG: RolesPermissionConfig = {
  canEditRole: false, canAddRole: false, canDeleteRole: false
};

export const ROLES_OPERATIONS: { key: keyof RolesPermissionConfig; label: string; icon: string; description: string }[] = [
  { key: 'canEditRole', label: 'Edit Role', icon: 'edit', description: 'Edit existing roles' },
  { key: 'canAddRole', label: 'Add Role', icon: 'add_circle', description: 'Create new roles' },
  { key: 'canDeleteRole', label: 'Delete Role', icon: 'delete', description: 'Delete roles' },
];

/** Users page operation permissions */
export interface UsersPermissionConfig {
  canAddUser: boolean;    // Create new user accounts
  canDeleteUser: boolean; // Delete user accounts
}

export const DEFAULT_USERS_CONFIG: UsersPermissionConfig = {
  canAddUser: false, canDeleteUser: false
};

export const USERS_OPERATIONS: { key: keyof UsersPermissionConfig; label: string; icon: string; description: string }[] = [
  { key: 'canAddUser',    label: 'Add User',    icon: 'person_add', description: 'Create new user accounts' },
  { key: 'canDeleteUser', label: 'Delete User', icon: 'person_remove', description: 'Delete user accounts' },
];

export type PermissionAction = 'view' | 'create' | 'edit' | 'delete';

/**
 * Every page/resource in the app mapped to its CRUD abilities.
 * resource = the page key (dashboard, reports, products, clients, orders, deliveries, buying_list, expenses, import, users, roles, settings)
 * canView / canCreate / canEdit / canDelete = booleans
 */
export interface Permission {
  id?: number;
  roleId?: number;
  resource: AppResource;
  canView: boolean;
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
  dashboardConfig?: DashboardComponentConfig;
  productConfig?: ProductPermissionConfig;
  ordersConfig?: OrdersPermissionConfig;
  buyingListConfig?: BuyingListPermissionConfig;
  arrivalsConfig?: ArrivalsPermissionConfig;
  shippingConfig?: ShippingPermissionConfig;
  shippingLedgerConfig?: ShippingLedgerPermissionConfig;
  stockSalesConfig?: StockSalesPermissionConfig;
  manageBatchesConfig?: ManageBatchesPermissionConfig;
  rolesConfig?: RolesPermissionConfig;
  usersConfig?: UsersPermissionConfig;
}

/** Every controllable page / resource in the system */
export type AppResource =
  | 'dashboard'
  | 'arrivals'
  | 'product_tracking'
  | 'reports'
  | 'products'
  | 'clients'
  | 'orders'
  | 'deliveries'
  | 'buying_list'
  | 'damaged_items'
  | 'expenses'
  | 'import'
  | 'users'
  | 'roles'
  | 'settings'
  | 'stock_sales'
  | 'shipping'
  | 'batches';

export interface AppResourceMeta {
  key: AppResource;
  label: string;
  icon: string;
  description: string;
}

export interface AppNavItem {
  route: string;
  icon: string;
  label: string;
  resource: AppResource;
}

export const APP_RESOURCE_CATALOG: AppResourceMeta[] = [
  { key: 'dashboard', label: 'Dashboard', icon: 'dashboard', description: 'Business overview, finance, inventory, and activity widgets.' },
  { key: 'clients', label: 'Clients', icon: 'people', description: 'Customer/contact records used by orders, shipping, and deliveries.' },
  { key: 'products', label: 'Products', icon: 'inventory_2', description: 'Product catalog plus batch-specific product pricing.' },
  { key: 'orders', label: 'Orders', icon: 'shopping_cart', description: 'Customer preorder capture, order edits, and batch closing controls.' },
  { key: 'buying_list', label: 'Buying List', icon: 'shopping_bag', description: 'Batch purchase planning and send-to-arrivals workflow.' },
  { key: 'arrivals', label: 'Arrivals', icon: 'inventory', description: 'Receive purchased stock, confirm shortages, and move items onward.' },
  { key: 'product_tracking', label: 'Product Tracking', icon: 'track_changes', description: 'Track product shipping progress after arrivals.' },
  { key: 'shipping', label: 'Shipping', icon: 'paid', description: 'Shipping fee setup and shipping ledger payment workflows.' },
  { key: 'deliveries', label: 'Deliveries', icon: 'local_shipping', description: 'Delivery queue, statuses, categories, and delivery adjustments.' },
  { key: 'stock_sales', label: 'Stock Sales', icon: 'storefront', description: 'Sell available inventory outside the preorder pipeline.' },
  { key: 'damaged_items', label: 'Damaged Items', icon: 'report_problem', description: 'Damage reporting, shortage allocation, and follow-up support.' },
  { key: 'reports', label: 'Reports', icon: 'analytics', description: 'Business reporting and analysis screens.' },
  { key: 'expenses', label: 'Expenses', icon: 'account_balance_wallet', description: 'Operational expense tracking.' },
  { key: 'import', label: 'Import Data', icon: 'upload_file', description: 'Bulk spreadsheet import tools.' },
  { key: 'batches', label: 'Manage Batches', icon: 'inventory_2', description: 'Admin batch management and destructive batch cleanup.' },
  { key: 'users', label: 'Users', icon: 'manage_accounts', description: 'Team membership, role assignment, and account status controls.' },
  { key: 'roles', label: 'Roles', icon: 'admin_panel_settings', description: 'Role definitions and permission configuration.' },
  { key: 'settings', label: 'Settings', icon: 'settings', description: 'Shop profile, workspace settings, and data management.' },
];

export const ALL_RESOURCES: { key: AppResource; label: string; icon: string }[] =
  APP_RESOURCE_CATALOG.map(({ key, label, icon }) => ({ key, label, icon }));

export const MAIN_NAV_ITEMS: AppNavItem[] = [
  { route: '/dashboard', icon: 'dashboard', label: 'Dashboard', resource: 'dashboard' },
  { route: '/clients', icon: 'people', label: 'Clients', resource: 'clients' },
  { route: '/products', icon: 'inventory_2', label: 'Products', resource: 'products' },
  { route: '/orders', icon: 'shopping_cart', label: 'Orders', resource: 'orders' },
  { route: '/buying-list', icon: 'shopping_bag', label: 'Buying List', resource: 'buying_list' },
  { route: '/arrivals', icon: 'inventory', label: 'Arrivals', resource: 'arrivals' },
  { route: '/product-tracking', icon: 'track_changes', label: 'Tracking', resource: 'product_tracking' },
  { route: '/shipping', icon: 'paid', label: 'Shipping', resource: 'shipping' },
  { route: '/shipping-ledger', icon: 'local_shipping', label: 'Shipping Ledger', resource: 'shipping' },
  { route: '/deliveries', icon: 'local_shipping', label: 'Deliveries', resource: 'deliveries' },
  { route: '/stock-sales', icon: 'storefront', label: 'Stock Sales', resource: 'stock_sales' },
  { route: '/damaged-items', icon: 'report_problem', label: 'Damaged Items', resource: 'damaged_items' },
  { route: '/reports', icon: 'analytics', label: 'Reports', resource: 'reports' },
];

export const ADMIN_NAV_ITEMS: AppNavItem[] = [
  { route: '/import', icon: 'upload_file', label: 'Import Data', resource: 'import' },
  { route: '/batches', icon: 'inventory_2', label: 'Manage Batches', resource: 'batches' },
  { route: '/users', icon: 'manage_accounts', label: 'Users', resource: 'users' },
  { route: '/roles', icon: 'admin_panel_settings', label: 'Roles & Permissions', resource: 'roles' },
  { route: '/subscription', icon: 'workspace_premium', label: 'Subscription', resource: 'settings' },
  { route: '/settings', icon: 'settings', label: 'Settings', resource: 'settings' },
];

export type OrderStatus = 'pending' | 'confirmed' | 'processing' | 'ready' | 'delivered' | 'cancelled';
export type PaymentStatus = 'unpaid' | 'partial' | 'paid' | 'refunded';
export type DeliveryStatus = 'pending' | 'in_transit' | 'delivered' | 'failed';
export type DeliveryBatchStatus = 'not_sent' | 'pending' | 'in_progress' | 'completed';
export type DeliveryItemStatus = 'pending' | 'packaged' | 'delivering' | 'delivered';
export type BuyingStatus = 'pending' | 'ordered' | 'shipped' | 'arrived';

export interface StockProduct {
  id: number;
  name: string;
  stock: number;
  stockPrice: number;
  stockDiscountMinQty: number;
  stockDiscountPrice: number;
  latestBatchProductId: number | null;
}

export interface StockSale {
  id?: number;
  saleUuid?: string;
  customerId?: number | null;
  customerName?: string;
  saleChannel?: string;
  totalAmount?: number;
  itemCount?: number;
  createdAt?: string;
  status?: 'open' | 'closed' | 'cancelled';
  closedAt?: string | null;
  closedBy?: number | null;
  items?: StockSaleItem[];
}

export interface StockSaleItem {
  id?: number;
  stockSaleId?: number;
  batchProductId: number;
  productId: number;
  productName?: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
}

export type PricingPlanKey = 'starter' | 'growth' | 'pro';
export type SubscriptionStatus = 'promo' | 'active' | 'past_due' | 'suspended' | 'cancelled';

export interface PricingUsage {
  plan: PricingPlanKey;
  status: SubscriptionStatus;
  priceGhs: number;
  monthlyLimit: number | null;
  usageCount: number;
  remaining: number | null;
  overageCount: number;
  promoStartedAt: string | null;
  promoEndsAt: string | null;
  promoActive: boolean;
  canCreateSalesRecord: boolean;
  recommendedPlan: PricingPlanKey;
  monthStart: string;
  monthEnd: string;
}

export interface PromoCodeRedemptionResult {
  code: string;
  description: string | null;
  extraPromoDays: number;
  discountPercent: number | null;
  planOverride: PricingPlanKey | null;
  promoEndsAt: string | null;
}

export type ExpenseCategory =
  | 'salary'
  | 'rent'
  | 'utilities'
  | 'transport'
  | 'supplies'
  | 'marketing'
  | 'maintenance'
  | 'food'
  | 'other';

export type PaymentMethod = 'cash' | 'mobile_money' | 'bank_transfer';

export interface Expense {
  id?: number;
  category: ExpenseCategory;
  description: string;
  amount: number;
  recipient?: string;
  paymentMethod: PaymentMethod;
  reference?: string;
  expenseDate: string;
  notes?: string;
  createdBy?: number;
  createdByName?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface DashboardStats {
  totalProducts: number;
  totalClients: number;
  pendingOrders: number;
  pendingDeliveries: number;
  totalRevenue: number;
  todayOrders: number;
}
