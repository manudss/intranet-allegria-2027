import { describe, it, expect } from 'vitest';
import { PDFDocument, PDFName } from 'pdf-lib';
import { writeFile, readFile } from 'node:fs/promises';
import { healthPdf } from './health-pdf';
import { newYouth, EMPTY_CONTACT, EMPTY_HEALTH, HEALTH_FIELDS } from '@mej-allegria/shared';
import type { StructuredHealth } from '@mej-allegria/shared';

async function pages(bytes: Uint8Array) {
  const { getDocument } = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const doc = await getDocument({ data: new Uint8Array(bytes), useSystemFonts: true }).promise;
  try {
    const result: string[] = [];
    for (let n = 1; n <= doc.numPages; n++) {
      const text = await (await doc.getPage(n)).getTextContent();
      result.push(text.items.map((v) => ('str' in v ? v.str : '')).join(' '));
    }
    return result;
  } finally {
    await doc.destroy();
  }
}
function fixture() {
  const youth = newYouth('fiction');
  youth.identity = {
    ...youth.identity,
    firstName: 'Camille',
    lastName: 'EXEMPLE FICTIF',
    dateOfBirth: '2012-05-01',
    sex: 'FEMALE',
    legalCapacity: 'LEGAL',
  };
  const family = {
    id: 'fiction',
    email: 'fiction@example.test',
    revision: 0,
    updatedAt: '',
    contact: {
      ...EMPTY_CONTACT,
      name: 'Parent FICTIF',
      phone: '0600000000',
      address: 'Adresse fictive',
      postalCode: '69000',
      city: 'Lyon',
      emergencyName: 'Contact FICTIF',
      emergencyPhone: '0600000001',
    },
    youths: [youth],
  };
  const health: StructuredHealth = {
    ...EMPTY_HEALTH,
    answers: {
      birthPlace: 'Lyon (exemple)',
      doctor: 'Médecin FICTIF : 0600000002',
      foodAllergy: 'Réponse alimentaire FICTIVE.',
      history: 'Antécédent FICTIF.',
      diet: 'Repas FICTIF.',
      vaccine_0_name: 'Vaccin FICTIF.',
      vaccine_0_date: '2026-01-01',
      detail_glasses: 'Lunettes FICTIVES.',
      guardianExtra1_name: 'Autre parent FICTIF',
    },
    foodAllergens: ['MILK'],
    presence: { foodAllergy: 'YES', glasses: 'YES', treatment: 'NO' },
  };
  return { youth, family, health };
}
const declaration = 'Déclaration FICTIVE de test, aucun dossier réel.';
describe('Alegria sanitary PDF, sheet and signature evidence only', () => {
  it('brands both copies of the model with the existing Alegria logo and removes the old heading', async () => {
    const api = await readFile(
      new URL('../../../assets/registration/health-form-source-2026.pdf', import.meta.url),
    );
    expect(api).toEqual(
      await readFile(
        new URL('../../../../../site/public/assets/health-form-source-2026.pdf', import.meta.url),
      ),
    );
    const text = (await pages(api)).join(' ');
    expect(text).toContain('RASSEMBLEMENT ALEGRIA');
    expect(text).not.toContain('CAMP MEJ 2026');
  });
  it('keeps medical answers in the sheet and puts only signature evidence at the end, with no embedded export', async () => {
    const { youth, family, health } = fixture();
    const bytes = await healthPdf(family, youth, health, declaration);
    const doc = await PDFDocument.load(bytes);
    expect(doc.catalog.get(PDFName.of('Names'))).toBeUndefined();
    const text = await pages(bytes);
    const body = text.slice(0, -1).join(' ');
    expect(body).toContain('Antécédent FICTIF.');
    expect(body).toContain('Réponse alimentaire FICTIVE.');
    expect(body).toContain('Lunettes FICTIVES.');
    expect(body).toContain('Vaccin FICTIF.');
    expect(body).toContain('Autre parent FICTIF');
    expect(text.at(-1)).toContain('PREUVE DE SIGNATURE');
    expect(text.at(-1)).toContain('NON SIGNÉ');
    expect(text.at(-1)).not.toContain('Antécédent FICTIF.');
    expect(text.at(-1)).not.toContain('Réponse alimentaire FICTIVE.');
    expect(text.join(' ')).not.toContain('RÉPONSES INTÉGRALES');
    if (process.env.WRITE_HEALTH_SAMPLE === 'true')
      await writeFile('/downloads/allegria-health-fiction.pdf', bytes);
  });
  it('preserves long answers, line breaks and every supported answer without a full duplicate annex', async () => {
    const { youth, family, health } = fixture();
    const tokens = HEALTH_FIELDS.map((key, n) => [key, 'CHAMP' + n + 'FIN'] as const);
    health.answers = Object.fromEntries(tokens);
    health.answers.other = 'Début-ligne\n' + 'Longue réponse fictive. '.repeat(130) + 'FINLONGUE';
    const bytes = await healthPdf(family, youth, health, declaration);
    const text = (await pages(bytes)).join(' ').replace(/\s+/g, ' ');
    for (const [key, token] of tokens) if (key !== 'other') expect(text, key).toContain(token);
    expect(text).toContain('FINLONGUE');
    const doc = await PDFDocument.load(bytes);
    expect(doc.catalog.get(PDFName.of('Names'))).toBeUndefined();
    if (process.env.WRITE_HEALTH_SAMPLE === 'true')
      await writeFile('/downloads/allegria-health-overflow-fiction.pdf', bytes);
  });
  it('includes confirmation evidence without exporting medical data or fabricating a code for old attestations', async () => {
    const { youth, family, health } = fixture();
    health.signature = {
      name: 'Parent FICTIF',
      capacity: 'LEGAL',
      at: '2026-11-21T12:00:00Z',
      digest: 'a'.repeat(64),
      appearance: { method: 'NAME' },
      verification: {
        method: 'EMAIL_CODE',
        challengeId: 'fiction-confirmation',
        verifiedAt: '2026-11-21T12:00:00Z',
        context: 'b'.repeat(64),
      },
    };
    const bytes = await healthPdf(family, youth, health, declaration);
    const text = await pages(bytes);
    expect(text.at(-1)).toContain('fiction-confirmation');
    expect(text.at(-1)).toContain('a'.repeat(64));
    expect(text.at(-1)).not.toContain('Antécédent FICTIF.');
    if (process.env.WRITE_HEALTH_SAMPLE === 'true')
      await writeFile('/downloads/allegria-health-signed-fiction.pdf', bytes);
    delete health.signature.verification;
    const legacy = await pages(await healthPdf(family, youth, health, declaration));
    expect(legacy.at(-1)).toContain('Ancienne attestation sans code distinct.');
    expect(legacy.at(-1)).not.toContain('fiction-confirmation');
  });
  it('returns an already frozen signed PDF unchanged', async () => {
    const { youth, family, health } = fixture();
    const saved = Buffer.from('immutable signed fixture');
    health.signature = {
      name: 'Parent FICTIF',
      capacity: 'LEGAL',
      at: '2026-11-21T12:00:00Z',
      digest: 'a'.repeat(64),
    };
    health.signedPdf = saved.toString('base64');
    expect(Buffer.from(await healthPdf(family, youth, health, declaration))).toEqual(saved);
  });
});
