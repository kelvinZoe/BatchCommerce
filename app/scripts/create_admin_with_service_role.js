/*
Node script to create a Supabase Auth user (admin) using the service_role key
and then link the new auth user's id to the `app_users` table.

Usage:
  1) Install dependencies (run once):
     npm install @supabase/supabase-js

  2) Set env vars and run:
     export SUPABASE_URL="https://xyz.supabase.co"
     export SUPABASE_SERVICE_ROLE_KEY="<your service_role key>"
     node scripts/create_admin_with_service_role.js

This script will:
 - create a new auth user with email admin@yourshop.com and a generated password
 - (if user already exists, it will skip creation and fetch the user id)
 - update `app_users` row with username 'admin@yourshop.com' (or 'admin') to set auth_id

Make sure your DB is reachable from Supabase project and that the `app_users` row exists
(you can run scripts/recreate_admin.sql first).
*/

import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('Please set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in your environment');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const ADMIN_EMAIL = 'admin@yourshop.com';
const ADMIN_PASSWORD = 'U7k$4vPz!qR9tLm2'; // change after first login

async function main() {
  // 1) Check if auth user exists
  const { data: existingUsers, error: listErr } = await supabase.auth.admin.listUsers({
    filter: `email=eq.${ADMIN_EMAIL}`
  }).catch(e => ({ data: null, error: e }));

  if (listErr) {
    console.error('Failed to list users:', listErr.message || listErr);
    process.exit(1);
  }

  let authUser = existingUsers?.users?.[0];

  if (!authUser) {
    console.log('Creating Supabase Auth user', ADMIN_EMAIL);
    const { data, error } = await supabase.auth.admin.createUser({
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
      email_confirm: true,
      user_metadata: { full_name: 'Administrator' }
    }).catch(e => ({ data: null, error: e }));

    if (error) {
      console.error('Failed to create auth user:', error.message || error);
      process.exit(1);
    }
    authUser = data.user || data;
  } else {
    console.log('Auth user already exists, using existing user id');
  }

  const authId = authUser.id;
  console.log('Auth user id:', authId);

  // 2) Find app_users row and update auth_id
  // We'll run a direct SQL RPC via the REST / from the Supabase client
  const updateSql = `
    UPDATE app_users
    SET auth_id = '${authId}'
    WHERE username IN ('admin@yourshop.com','admin')
    RETURNING id, username, auth_id
  `;

  const { data: updateResult, error: updateErr } = await supabase.rpc('sql', { sql: updateSql }).catch(e => ({ data: null, error: e }));

  if (updateErr) {
    // If the project doesn't expose an sql rpc, fall back to using the REST/pg endpoint
    // Try via from('app_users').update(...)
    try {
      const { data, error } = await supabase
        .from('app_users')
        .update({ auth_id: authId })
        .in('username', ['admin@yourshop.com', 'admin'])
        .select();
      if (error) throw error;
      console.log('Updated app_users:', data);
    } catch (err) {
      console.error('Failed to update app_users with auth_id. Run the following SQL manually:');
      console.error(`UPDATE app_users SET auth_id = '${authId}' WHERE username IN ('admin@yourshop.com','admin');`);
      process.exit(1);
    }
  } else {
    console.log('Updated app_users via SQL RPC:', updateResult);
  }

  console.log('Admin user creation/link complete. Login with:', ADMIN_EMAIL, ADMIN_PASSWORD);
}

main().catch(err => {
  console.error('Unexpected error:', err);
  process.exit(1);
});
