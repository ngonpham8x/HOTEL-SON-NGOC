import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const secrets = [process.env.SON_NGOC_FIXED_TEST_PASSWORD, process.env.SON_NGOC_PRIMARY_TEST_PASSWORD].filter(Boolean);
if (!secrets.length) throw new Error('Supply private test input through the process environment.');
const patterns = secrets.flatMap(secret => [Buffer.from(secret), Buffer.from(secret.toLowerCase()), Buffer.from(Buffer.from(secret).toString('base64')), Buffer.from(JSON.stringify(secret).slice(1,-1)), Buffer.from([...secret].map(c=>'\\u'+c.charCodeAt(0).toString(16).padStart(4,'0')).join(''))]);
const scan = path => {
  for (const entry of readdirSync(path, { withFileTypes: true })) {
    const file = join(path, entry.name);
    if (entry.name === '.temp') continue;
    if (entry.isDirectory()) scan(file);
    else {
      const content = readFileSync(file);
      if (patterns.some(value => content.includes(value))) throw new Error('Private credential material found in: ' + file);
    }
  }
};
for (const root of ['src','public','dist','scripts','tests','supabase','.github']) if (existsSync(root)) scan(root);
if (patterns.some(value => readFileSync('README.md').includes(value))) throw new Error('Private credential material found in documentation.');
console.log('PASS private credential is absent from source, tests, documentation and build assets in plaintext and the checked text encodings.');
