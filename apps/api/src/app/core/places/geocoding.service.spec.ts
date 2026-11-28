import { describe, expect, it } from 'vitest';
import { GeocodingService } from './geocoding.service';

const ok = (rows: unknown[]) => ({ ok: true, status: 200, json: async () => rows });

function make() {
  const svc = new GeocodingService();
  let t = 1_000_000;
  const calls: { url: string; ua: string; at: number }[] = [];
  svc.now = () => t;
  svc.sleep = async (ms) => {
    t += ms;
  };
  svc.fetchImpl = async (url, init) => {
    calls.push({ url, ua: init.headers['User-Agent'], at: t });
    return ok([{ display_name: '1 rue Test, Saint-Étienne', lat: '45.44', lon: '4.39', address: { house_number: '1', road: 'rue Test', postcode: '42000', city: 'Saint-Étienne', country: 'France' } }]);
  };
  return { svc, calls, tick: (ms: number) => (t += ms) };
}

describe('GeocodingService (conditions Nominatim)', () => {
  it('refuse les requêtes trop courtes (pas d\'autocomplétion à la frappe)', async () => {
    const { svc, calls } = make();
    await expect(svc.search('rue')).rejects.toThrow();
    expect(calls).toHaveLength(0);
  });

  it('envoie un User-Agent identifiant et renvoie des candidats structurés', async () => {
    const { svc, calls } = make();
    const r = await svc.search('1 rue Test Saint-Étienne');
    expect(calls[0].ua).toMatch(/^AllegriaIntranet\//);
    expect(calls[0].url).toContain('/search?');
    expect(r[0]).toMatchObject({ latitude: 45.44, longitude: 4.39, address: '1 rue Test', postalCode: '42000', city: 'Saint-Étienne' });
  });

  it('met en cache : une même recherche ne rappelle pas le service', async () => {
    const { svc, calls } = make();
    await svc.search('1 rue Test Saint-Étienne');
    await svc.search('  1 RUE test   saint-étienne ');
    expect(calls).toHaveLength(1);
  });

  it('espace les appels d\'au moins 1 s, même en rafale', async () => {
    const { svc, calls } = make();
    await Promise.all([svc.search('adresse numéro un'), svc.search('adresse numéro deux'), svc.search('adresse numéro trois')]);
    expect(calls).toHaveLength(3);
    expect(calls[1].at - calls[0].at).toBeGreaterThanOrEqual(1000);
    expect(calls[2].at - calls[1].at).toBeGreaterThanOrEqual(1000);
  });

  it('erreur du service : message clair, rien en cache', async () => {
    const { svc } = make();
    svc.fetchImpl = async () => ({ ok: false, status: 429, json: async () => [] });
    await expect(svc.search('adresse en erreur')).rejects.toThrow(/indisponible/);
    let n = 0;
    svc.fetchImpl = async () => {
      n++;
      return ok([]);
    };
    await svc.search('adresse en erreur');
    expect(n).toBe(1);
  });
});
