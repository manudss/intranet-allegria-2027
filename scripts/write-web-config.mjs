import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const configPath = resolve('apps/web/public/app-config.json');

const normalizeApiBaseUrl = (value) => {
  if (!value) return '';

  const trimmed = value.trim().replace(/\/+$/, '');
  return trimmed.endsWith('/api') ? trimmed.slice(0, -4) : trimmed;
};

const config = {
  apiBaseUrl: normalizeApiBaseUrl(process.env.WEB_API_URL),
};

await mkdir(dirname(configPath), { recursive: true });
await writeFile(configPath, `${JSON.stringify(config, null, 2)}\n`, 'utf8');
console.log(`Runtime web config written to ${configPath}`);
