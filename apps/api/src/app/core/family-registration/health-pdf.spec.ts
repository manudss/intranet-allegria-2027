import { describe, it, expect } from 'vitest';
import { PDFDocument } from 'pdf-lib';
import { writeFile } from 'node:fs/promises';
import { digest } from './family-registration.service';
import { healthPdf } from './health-pdf';
import { newYouth, EMPTY_CONTACT, EMPTY_HEALTH, HEALTH_FIELDS } from '@mej-allegria/shared';
describe('Health source model and complete annex', () => {
  it('keeps the four original pages and all long answers in a paginated annex', async () => {
    const y = newYouth('fiction');
    y.identity = {
      ...y.identity,
      firstName: 'Camille',
      lastName: 'EXEMPLE FICTIF',
      dateOfBirth: '2012-05-01',
      sex: 'FEMALE',
      legalCapacity: 'LEGAL',
    };
    const f = {
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
      youths: [y],
    };
    const h = {
      ...EMPTY_HEALTH,
      answers: Object.fromEntries(
        HEALTH_FIELDS.map((k) => [
          k,
          k === 'foodAllergy'
            ? 'Allergie fictive au lait. Consignes fictives à vérifier.'
            : k === 'other'
              ? 'Réponse fictive longue. '.repeat(70)
              : 'Aucune information supplémentaire déclarée dans cet exemple fictif.',
        ]),
      ),
      foodAllergens: ['MILK'],
    };
    const bytes = await healthPdf(
      f,
      y,
      h,
      'Déclaration de test uniquement. Document fictif sans valeur de collecte.',
    );
    const doc = await PDFDocument.load(bytes);
    expect(doc.getPageCount()).toBeGreaterThan(5);
    if (process.env.WRITE_HEALTH_SAMPLE === 'true') {
      await writeFile('/downloads/allegria-health-fiction.pdf', bytes);
      const payload = JSON.stringify({
        identity: y.identity,
        contact: f.contact,
        answers: h.answers,
        foodAllergens: h.foodAllergens,
        declaration: 'Attestation FICTIVE de test, aucun dossier réel.',
      });
      const signed = {
        ...h,
        signedPayload: payload,
        signature: {
          name: 'Parent FICTIF',
          capacity: 'LEGAL',
          at: '2026-11-20T12:00:00Z',
          digest: digest(payload),
        },
      };
      await writeFile(
        '/downloads/allegria-health-signed-fiction.pdf',
        await healthPdf(
          f,
          { ...y, identity: { ...y.identity, firstName: 'NOM MODIFIE APRES SIGNATURE' } },
          signed,
          'Texte modifié non applicable',
        ),
      );
    }
  });
});
