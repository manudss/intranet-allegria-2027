import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const app = process.argv[2] ?? 'web';
const envKey = `${app.toUpperCase()}_API_URL`;

const configPath = resolve(`apps/${app}/public/app-config.json`);

const normalizeApiBaseUrl = (value) => {
  if (!value) return '';

  const trimmed = value.trim().replace(/\/+$/, '');
  return trimmed.endsWith('/api') ? trimmed.slice(0, -4) : trimmed;
};

const config = {
  apiBaseUrl: normalizeApiBaseUrl(process.env[envKey] ?? process.env.WEB_API_URL),
};

await mkdir(dirname(configPath), { recursive: true });
await writeFile(configPath, `${JSON.stringify(config, null, 2)}\n`, 'utf8');
console.log(`Runtime ${app} config written to ${configPath}`);
