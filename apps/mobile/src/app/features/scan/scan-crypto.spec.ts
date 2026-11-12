import { decryptJson, encryptJson, exportKey, generateTableKey, hashQrCode, importKey } from './scan-crypto';

describe('scan-crypto', () => {
  it('chiffre et déchiffre une table (AES-GCM)', async () => {
    const key = await generateTableKey();
    const data = { participants: [{ qrCodeHash: 'abc', firstName: 'Ada' }] };
    const blob = await encryptJson(key, data);
    expect(blob.byteLength).toBeGreaterThan(12);
    const back = await decryptJson<typeof data>(key, blob);
    expect(back.participants[0].firstName).toBe('Ada');
  });

  it('export/import de clé préserve le chiffrement', async () => {
    const key = await generateTableKey();
    const raw = await exportKey(key);
    const key2 = await importKey(raw);
    const blob = await encryptJson(key, { x: 1 });
    expect(await decryptJson<{ x: number }>(key2, blob)).toEqual({ x: 1 });
  });

  it('hash SHA-256 hex stable et insensible à la casse', async () => {
    const a = await hashQrCode('ABC-123');
    const b = await hashQrCode('abc-123');
    expect(a).toBe(b);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
  });

  it('déchiffrement avec une autre clé échoue', async () => {
    const k1 = await generateTableKey();
    const k2 = await generateTableKey();
    const blob = await encryptJson(k1, { secret: true });
    await expect(decryptJson(k2, blob)).rejects.toThrow();
  });
});
