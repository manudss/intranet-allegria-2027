import { BadGatewayException, BadRequestException, Injectable } from '@nestjs/common';

export type GeocodeCandidate = {
  label: string;
  latitude: number;
  longitude: number;
  address: string | null;
  postalCode: string | null;
  city: string | null;
  country: string | null;
};

type Fetch = (url: string, init: { headers: Record<string, string>; signal: AbortSignal }) => Promise<{ ok: boolean; status: number; json(): Promise<unknown> }>;

const MIN_GAP_MS = 1100; // politique Nominatim : 1 requête/s au maximum pour toute l'application
const CACHE_TTL_MS = 24 * 3600 * 1000;
const CACHE_MAX = 500;
export const MIN_QUERY_LENGTH = 6;

/**
 * Recherche d'adresse via Nominatim (OpenStreetMap), côté serveur uniquement.
 * Conditions respectées (https://operations.osmfoundation.org/policies/nominatim/) : User-Agent
 * identifiant l'appli, 1 requête/s maximum (file unique), résultats mis en cache, pas
 * d'autocomplétion (une recherche = un clic explicite de l'utilisateur), attribution affichée
 * côté écran. Service remplaçable : NOMINATIM_URL (ex. instance dédiée) sans changer le code.
 */
@Injectable()
export class GeocodingService {
  private readonly baseUrl = (process.env['NOMINATIM_URL'] ?? 'https://nominatim.openstreetmap.org').replace(/\/$/, '');
  private readonly userAgent =
    process.env['GEOCODER_USER_AGENT'] ?? 'AllegriaIntranet/1.0 (+https://github.com/manudss/intranet-allegria-2027)';
  private readonly cache = new Map<string, { at: number; value: GeocodeCandidate[] }>();
  private queue: Promise<unknown> = Promise.resolve();
  private lastCall = 0;

  /** Surchargeables dans les tests. */
  fetchImpl: Fetch = (url, init) => fetch(url, init) as never;
  now: () => number = () => Date.now();
  sleep: (ms: number) => Promise<void> = (ms) => new Promise((r) => setTimeout(r, ms));

  async search(query: string): Promise<GeocodeCandidate[]> {
    const q = query.trim().replace(/\s+/g, ' ');
    if (q.length < MIN_QUERY_LENGTH) throw new BadRequestException('Saisissez une adresse plus complète');
    const key = q.toLowerCase();
    const hit = this.cache.get(key);
    if (hit && this.now() - hit.at < CACHE_TTL_MS) return hit.value;

    const run = this.queue.then(() => this.call(q));
    this.queue = run.catch(() => undefined);
    const value = await run;
    if (this.cache.size >= CACHE_MAX) this.cache.delete(this.cache.keys().next().value as string);
    this.cache.set(key, { at: this.now(), value });
    return value;
  }

  private async call(q: string): Promise<GeocodeCandidate[]> {
    const wait = this.lastCall + MIN_GAP_MS - this.now();
    if (wait > 0) await this.sleep(wait);
    this.lastCall = this.now();
    const url = `${this.baseUrl}/search?format=jsonv2&addressdetails=1&limit=5&accept-language=fr&q=${encodeURIComponent(q)}`;
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 8000);
    try {
      const res = await this.fetchImpl(url, { headers: { 'User-Agent': this.userAgent, Accept: 'application/json' }, signal: ctrl.signal });
      if (!res.ok) throw new BadGatewayException('Service d\'adresses indisponible, placez le point à la main sur la carte');
      const rows = (await res.json()) as {
        display_name?: string;
        lat?: string;
        lon?: string;
        address?: Record<string, string>;
      }[];
      return rows
        .map((r) => {
          const lat = Number(r.lat);
          const lon = Number(r.lon);
          const a = r.address ?? {};
          const street = [a['house_number'], a['road']].filter(Boolean).join(' ');
          return {
            label: r.display_name ?? '',
            latitude: lat,
            longitude: lon,
            address: street || null,
            postalCode: a['postcode'] ?? null,
            city: a['city'] ?? a['town'] ?? a['village'] ?? a['municipality'] ?? null,
            country: a['country'] ?? null,
          };
        })
        .filter((c) => Number.isFinite(c.latitude) && Number.isFinite(c.longitude) && c.label);
    } catch (e) {
      if (e instanceof BadGatewayException) throw e;
      throw new BadGatewayException('Service d\'adresses indisponible, placez le point à la main sur la carte');
    } finally {
      clearTimeout(timer);
    }
  }
}
