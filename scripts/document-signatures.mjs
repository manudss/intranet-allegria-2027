#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const root = fileURLToPath(new URL('..', import.meta.url));
const target = path.join(root, 'tools/document-signatures/target');
const classpath = path.join(target, 'classpath.txt');
if (!existsSync(classpath)) {
  console.error(
    'Local signing tool not built. Requires Java 11+ and Maven 3.6.3+: npm run signatures:build. No remote document service is used.',
  );
  process.exit(2);
}
const java = process.env.JAVA_HOME ? path.join(process.env.JAVA_HOME, 'bin/java') : 'java';
const result = spawnSync(
  java,
  [
    '-cp',
    path.join(target, 'classes') + path.delimiter + readFileSync(classpath, 'utf8').trim(),
    'fr.allegria.signatures.DocumentSignatures',
    ...process.argv.slice(2),
  ],
  { stdio: 'inherit' },
);
if (result.error) console.error('Java 11+ is required for this local operator tool.');
process.exit(result.status ?? 2);
