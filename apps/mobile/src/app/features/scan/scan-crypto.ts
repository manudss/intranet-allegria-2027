/**
 * Chiffrement WebCrypto de la table hors-ligne (AES-GCM 256).
 * La clé de session est générée à chaque téléchargement et stockée dans
 * IndexedDB ; la table n'existe jamais en clair sur disque.
 */

const KEY_ALGO: AesKeyAlgorithm = { name: 'AES-GCM', length: 256 };

export async function generateTableKey(): Promise<CryptoKey> {
  return crypto.subtle.generateKey(KEY_ALGO, true, ['encrypt', 'decrypt']);
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

/** SHA-256 hex du code QR normalisé (minuscules) — identique au serveur. */
export async function hashQrCode(code: string): Promise<string> {
  const data = new TextEncoder().encode(code.trim().toLowerCase());
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/** Export brut de la clé pour persistance IndexedDB (CryptoKey non structurable partout). */
export async function exportKey(key: CryptoKey): Promise<ArrayBuffer> {
  return crypto.subtle.exportKey('raw', key);
}

export async function importKey(raw: ArrayBuffer): Promise<CryptoKey> {
  return crypto.subtle.importKey('raw', raw, KEY_ALGO, false, ['encrypt', 'decrypt']);
}
