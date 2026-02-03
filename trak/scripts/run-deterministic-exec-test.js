const fs = require('fs');
const path = require('path');

const envPath = path.join(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if (val.includes(' #')) val = val.split(' #', 1)[0].trim();
    if (val.includes('\t#')) val = val.split('\t#', 1)[0].trim();
    val = val.replace(/^['"]|['"]$/g, '');
    process.env[key] = val;
  }
}

process.env.ENABLE_TEST_MODE = 'true';

const tsconfigPaths = require('tsconfig-paths');
tsconfigPaths.register({ baseUrl: process.cwd(), paths: { '@/*': ['src/*'] } });

const { createJiti } = require('jiti');
const jiti = createJiti(path.join(process.cwd(), '_jiti_root.js'));

jiti('./src/lib/ai/test-deterministic-exec.ts');
