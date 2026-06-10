const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY before running this script.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false }
});

async function run() {
  const sql = `
    ALTER TABLE order_items
    ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

    NOTIFY pgrst, 'reload schema';
  `;

  console.log('Attempting to execute SQL via rpc("sql", { sql })...');
  const res = await supabase.rpc('sql', { sql });
  if (res.error) {
    console.error('RPC Error:', res.error);
    process.exit(1);
  }

  console.log('Schema patch applied.');
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
