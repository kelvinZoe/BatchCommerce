const fs = require('fs');
const path = require('path');

const outPath = path.join(__dirname, '..', 'src', 'environments', 'environment.prod.ts');

const env = {
  production: true,
  adminApiUrl: process.env.ADMIN_API_URL || 'https://your-backend-domain.com',
  supabaseUrl: process.env.SUPABASE_URL || 'https://hlewyduelyxzkezetnhb.supabase.co',
  supabaseKey: process.env.SUPABASE_KEY || 'sb_publishable_t8EUXaZjCgpI8o-QcMeAnA_tWq_nRNx'
};

const content = `export const environment = ${JSON.stringify(env, null, 2)};\n`;

fs.writeFileSync(outPath, content, { encoding: 'utf8' });
console.log('Wrote', outPath);
