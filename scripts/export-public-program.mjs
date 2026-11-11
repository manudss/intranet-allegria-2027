// Exporte le programme public (jour par jour) en JSON statiques dans
// apps/mobile/public/content/. Usage : API_URL=http://localhost:3000 node scripts/export-public-program.mjs
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const apiBase = (process.env.API_URL ?? 'http://localhost:3000').replace(/\/+$/, '');
const token = process.env.API_TOKEN ?? '';
const days = ['2027-10-30', '2027-10-31', '2027-11-01', '2027-11-02'];
const outDir = resolve('apps/mobile/public/content');

await mkdir(outDir, { recursive: true });

for (const day of days) {
  const response = await fetch(`${apiBase}/api/program/days/${day}`, {
    headers: token ? { authorization: `Bearer ${token}` } : {},
  });
  if (!response.ok) {
    console.error(`Jour ${day} : HTTP ${response.status}, ignoré.`);
    continue;
  }
  const data = await response.json();
  const publicDay = {
    date: data.date,
    updatedAt: new Date().toISOString().slice(0, 10),
    sequences: (data.sequences ?? []).map((s) => ({
      title: s.title,
      startTime: s.startTime,
      endTime: s.endTime,
      location: s.location,
    })),
  };
  const file = resolve(outDir, `program-${day}.json`);
  await writeFile(file, `${JSON.stringify(publicDay, null, 2)}\n`, 'utf8');
  console.log(`Exporté ${file}`);
}
