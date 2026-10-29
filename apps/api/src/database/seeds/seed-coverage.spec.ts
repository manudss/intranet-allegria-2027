import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

// Le seed sert a rendre la base de preview exclusivement fictive : il doit vider TOUTES les tables.
describe('seed truncates every table created by migrations', () => {
  const seed = readFileSync(join(__dirname, 'seed.ts'), 'utf8');
  const truncate = /TRUNCATE TABLE([\s\S]*?)RESTART IDENTITY/.exec(seed)?.[1] ?? '';
  const truncated = new Set([...truncate.matchAll(/"([a-z_]+)"/g)].map((m) => m[1]));

  const migrationsDir = join(__dirname, '..', 'migrations');
  const created = new Set<string>();
  for (const file of readdirSync(migrationsDir).filter((f) => f.endsWith('.ts'))) {
    const sql = readFileSync(join(migrationsDir, file), 'utf8');
    for (const m of sql.matchAll(/CREATE TABLE(?: IF NOT EXISTS)? \\?"([a-z_]+)\\?"/g)) {
      created.add(m[1]);
    }
  }

  it('finds the tables', () => {
    expect(created.size).toBeGreaterThan(10);
    expect(truncated.size).toBeGreaterThan(10);
  });

  it('has no table missing from the TRUNCATE list', () => {
    const missing = [...created].filter((t) => t !== 'migrations' && !truncated.has(t));
    expect(missing).toEqual([]);
  });
});
