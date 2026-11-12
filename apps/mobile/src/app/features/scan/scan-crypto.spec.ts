import { decryptJson, deriveTableKey, encryptJson } from './scan-crypto';

describe('scan-crypto', () => {
  it('chiffre et déchiffre un instantané (AES-GCM)', async () => {
    const key = await deriveTableKey('cle-session-serveur');
    const data = { entries: [{ code: 'abc', firstName: 'Ada' }] };
    const blob = await encryptJson(key, data);
    expect(blob.byteLength).toBeGreaterThan(12);
    const back = await decryptJson<typeof data>(key, blob);
    expect(back.entries[0].firstName).toBe('Ada');
  });

  it('la même clé de session donne la même clé AES', async () => {
    const k1 = await deriveTableKey('meme-cle');
    const k2 = await deriveTableKey('meme-cle');
    const blob = await encryptJson(k1, { x: 1 });
    expect(await decryptJson<{ x: number }>(k2, blob)).toEqual({ x: 1 });
  });

  it('une autre clé de session ne déchiffre pas', async () => {
    const k1 = await deriveTableKey('cle-1');
    const k2 = await deriveTableKey('cle-2');
    const blob = await encryptJson(k1, { secret: true });
    await expect(decryptJson(k2, blob)).rejects.toThrow();
  });
});
