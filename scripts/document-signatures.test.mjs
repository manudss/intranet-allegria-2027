import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
if (!existsSync('tools/document-signatures/target/classpath.txt') && process.env.CI) {
  const result = spawnSync(
    'mvn',
    [
      '-q',
      '-f',
      'tools/document-signatures/pom.xml',
      'compile',
      'dependency:build-classpath',
      '-Dmdep.outputFile=target/classpath.txt',
    ],
    { encoding: 'utf8' },
  );
  assert.equal(
    result.status,
    0,
    'CI requires Java 11+ and Maven for offline signature tests. ' +
      (result.error?.message || '') +
      '\n' +
      result.stdout +
      '\n' +
      result.stderr,
  );
}
const built = existsSync('tools/document-signatures/target/classpath.txt');
test(
  'DSS offline: four standard containers, tamper rejection, no implicit identity trust',
  {
    skip:
      !built &&
      'Run npm run signatures:build first; the existing Node CI glob builds and runs this test',
  },
  () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'allegria-signature-test-'));
    const password = path.join(dir, 'test-password');
    const env = {
      ...process.env,
      ALLEGRIA_SIGN_P12_FILE: path.join(dir, 'fixture.p12'),
      ALLEGRIA_SIGN_PASSWORD_FILE: password,
    };
    const run = (command, args, ok = true) => {
      const r = spawnSync(command, args, { env, encoding: 'utf8' });
      if (ok) assert.equal(r.status, 0, r.stderr);
      return r;
    };
    const tool = (...args) => run(process.execPath, ['scripts/document-signatures.mjs', ...args]);
    try {
      writeFileSync(password, randomBytes(32).toString('hex'), { mode: 0o600 });
      run('openssl', [
        'req',
        '-x509',
        '-newkey',
        'rsa:2048',
        '-nodes',
        '-keyout',
        path.join(dir, 'test.key'),
        '-out',
        path.join(dir, 'test.crt'),
        '-days',
        '1',
        '-subj',
        '/CN=ALLEGRIA TEST ONLY NOT A PARENT',
      ]);
      run('openssl', [
        'pkcs12',
        '-export',
        '-inkey',
        path.join(dir, 'test.key'),
        '-in',
        path.join(dir, 'test.crt'),
        '-out',
        env.ALLEGRIA_SIGN_P12_FILE,
        '-passout',
        'file:' + password,
      ]);
      const fixtures = [
        ['PADES', 'apps/api/src/assets/registration/health-form-source-2026.pdf', 'signed.pdf'],
        ['XADES', path.join(dir, 'input.xml'), 'signed.xml'],
        ['CADES', path.join(dir, 'input.bin'), 'signed.p7m'],
        ['JADES', path.join(dir, 'input.json'), 'signed.json'],
      ];
      writeFileSync(
        path.join(dir, 'input.xml'),
        '<fictional><name>EXAMPLE ONLY</name></fictional>',
      );
      writeFileSync(path.join(dir, 'input.bin'), 'FICTIONAL_BINARY_ONLY');
      writeFileSync(path.join(dir, 'input.json'), '{"name":"FICTIONAL ONLY"}');
      for (const [format, input, output] of fixtures) {
        const file = path.join(dir, output);
        assert.match(tool('sign', format, input, file).stdout, /"identityValidated":false/);
        const result = JSON.parse(tool('verify', file).stdout.trim());
        assert.equal(result.cryptographicIntegrity, true, format);
        assert.equal(result.certificateTrust, 'NOT_EVALUATED');
        assert.equal(
          run(
            process.execPath,
            ['scripts/document-signatures.mjs', 'sign', format, input, file],
            false,
          ).status !== 0,
          true,
          'overwrite rejected',
        );
      }
      const altered = path.join(dir, 'altered.xml');
      writeFileSync(
        altered,
        readFileSync(path.join(dir, 'signed.xml'), 'utf8').replace('EXAMPLE ONLY', 'ALTERED DATA'),
      );
      assert.notEqual(
        run(process.execPath, ['scripts/document-signatures.mjs', 'verify', altered], false).status,
        0,
        'XML tampering rejected',
      );
      assert.notEqual(
        run(
          process.execPath,
          ['scripts/document-signatures.mjs', 'verify', path.join(dir, 'input.xml')],
          false,
        ).status,
        0,
        'unsigned document rejected',
      );
      assert.notEqual(
        run(
          process.execPath,
          [
            'scripts/document-signatures.mjs',
            'sign',
            'DOCX',
            path.join(dir, 'input.xml'),
            path.join(dir, 'bad'),
          ],
          false,
        ).status,
        0,
        'unsupported format rejected',
      );
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  },
);
