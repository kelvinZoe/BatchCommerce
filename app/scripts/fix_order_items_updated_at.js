async function run() {
  console.error('This script no longer executes arbitrary SQL through rpc("sql").');
  console.error('Use the checked-in Supabase migration instead:');
  console.error('  supabase/migrations/20260610123000_fix_updated_at_trigger_columns.sql');
  process.exit(1);
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
