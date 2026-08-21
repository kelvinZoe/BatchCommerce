export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

type Table<Row, Insert = Partial<Row>, Update = Partial<Insert>> = {
  Row: Row;
  Insert: Insert;
  Update: Update;
  Relationships: [];
};

/**
 * Auth-scoped schema snapshot. Replace this file with Supabase CLI-generated
 * types from the live project before the first production feature cutover.
 */
export type Database = {
  public: {
    Tables: {
      app_users: Table<{
        id: number;
        auth_id: string | null;
        username: string;
        full_name: string;
        phone: string;
        email: string | null;
        is_active: boolean;
        metadata: Json;
        created_at: string;
        updated_at: string;
      }>;
      role_permissions: Table<{
        id: number;
        shop_id: string;
        role_id: number;
        resource: string;
        can_view: boolean;
        can_create: boolean;
        can_edit: boolean;
        can_delete: boolean;
        dashboard_config: Json | null;
        product_config: Json | null;
        orders_config: Json | null;
        buying_list_config: Json | null;
        arrivals_config: Json | null;
        shipping_config: Json | null;
        shipping_ledger_config: Json | null;
        stock_sales_config: Json | null;
        manage_batches_config: Json | null;
        roles_config: Json | null;
        users_config: Json | null;
        created_at: string;
        updated_at: string;
      }>;
      roles: Table<{
        id: number;
        shop_id: string;
        name: string;
        description: string | null;
        is_system: boolean;
        created_at: string;
        updated_at: string;
      }>;
      shop_memberships: Table<{
        id: number;
        shop_id: string;
        auth_user_id: string;
        app_user_id: number | null;
        role_id: number | null;
        is_owner: boolean;
        is_active: boolean;
        membership_status: string;
        accepted_at: string | null;
        invited_at: string | null;
        last_selected_at: string | null;
        created_at: string;
        updated_at: string;
      }>;
      shops: Table<{
        id: string;
        name: string;
        slug: string;
        is_active: boolean;
        created_at: string;
        updated_at: string;
      }>;
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
