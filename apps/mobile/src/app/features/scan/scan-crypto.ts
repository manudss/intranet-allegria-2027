/**
 * Chiffrement WebCrypto de l'instantané hors-ligne (AES-GCM 256).
 * La clé AES est dérivée (SHA-256) de la clé de session fournie par le
 * serveur : elle suit son cycle de vie (TTL 30 min, renouvellement en ligne).
 * L'instantané n'existe jamais en clair sur disque.
 */

const KEY_ALGO: AesKeyAlgorithm = { name: 'AES-GCM', length: 256 };

/** Dérive la clé AES-256 de la clé de session serveur. */
export async function deriveTableKey(sessionKey: string): Promise<CryptoKey> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(sessionKey));
  return crypto.subtle.importKey('raw', digest, KEY_ALGO, false, ['encrypt', 'decrypt']);
}

export async function encryptJson(key: CryptoKey, value: unknown): Promise<ArrayBuffer> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const data = new TextEncoder().encode(JSON.stringify(value));
  const cipher = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, data);
  const out = new Uint8Array(iv.length + cipher.byteLength);
  out.set(iv, 0);
  out.set(new Uint8Array(cipher), iv.length);
  return out.buffer;
}

export async function decryptJson<T>(key: CryptoKey, payload: ArrayBuffer): Promise<T> {
  const bytes = new Uint8Array(payload);
  const iv = bytes.slice(0, 12);
  const data = bytes.slice(12);
  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, data);
  return JSON.parse(new TextDecoder().decode(plain)) as T;
}
