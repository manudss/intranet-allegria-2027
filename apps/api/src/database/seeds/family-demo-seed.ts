import { randomUUID, createHash } from 'node:crypto';
import {
  HEALTH_FIELDS,
  HEALTH_MODEL_ITEMS,
  EMPTY_HEALTH,
  newYouth,
  EMPTY_CONTACT,
  DEFAULT_FAMILY_RULES,
  DIOCESES,
} from '@mej-allegria/shared';
const digest = (value: string) => createHash('sha256').update(value).digest('hex');
/** Sole source of fictional family cases, called only by the existing seed pipeline. */
export function buildFamilyDemo() {
  const exampleFamily = randomUUID(),
    first = newYouth(randomUUID(), 'Lyon'),
    second = newYouth(randomUUID(), 'Lyon');
  first.identity = {
    ...first.identity,
    firstName: 'Camille',
    lastName: 'Exemple fictif',
    dateOfBirth: '2012-05-01',
    sex: 'FEMALE',
    mejAgeGroup: 'TA',
    legalCapacity: 'LEGAL',
    dioceseId: DIOCESES.find((d) => d.name === 'Lyon')?.id || DIOCESES[0].id,
  };
  first.logistics.presence = 'FULL';
  second.identity = { ...second.identity, firstName: 'Alexis', lastName: 'Exemple fictif' };
  second.currentPage = 2;
  second.simulation = 'SUCCESS';
  const transmitted = [
    'SUBMITTED',
    'CORRECTION',
    'VALIDATED',
    'CONFIRMED',
    'REFUSED',
    'CANCELLED',
  ] as const;
  const cases = transmitted.map((state, index) => {
    const y = newYouth(randomUUID(), 'Lyon');
    y.identity = {
      ...first.identity,
      firstName: ['Louise', 'Gabriel', 'Emma', 'Louis', 'Jade', 'Noé'][index],
    };
    y.logistics.presence = 'FULL';
    y.simulation = (['SUCCESS', 'FAILURE', 'CANCELLED', 'NOT_TESTED'] as const)[index % 4];
    y.state = state;
    y.submittedAt = new Date().toISOString();
    y.contactAtSubmission = { ...EMPTY_CONTACT, name: 'Parent exemple fictif', city: 'Lyon' };
    if (state === 'CORRECTION')
      y.correction = 'Exemple fictif : merci de compléter le téléphone du contact d’urgence.';
    return y;
  });
  for (const [index, y] of cases.entries()) {
    y.identity.dioceseId = index === 0 ? 'UNKNOWN' : index === 1 ? 'OTHER' : y.identity.dioceseId;
    if (index === 1) y.identity.otherDiocese = 'EXEMPLE FICTIF : autre pays';
    y.paperHealth = index % 2 ? 'RECEIVED' : 'TO_ORGANISE';
    const snapshot = JSON.stringify({
      template: {
        id: 'demo-autorisation',
        title: 'EXEMPLE FICTIF de document attesté',
        text: 'Texte fictif sans autorisation réelle.',
      },
      identity: y.identity,
      contact: y.contactAtSubmission,
    });
    y.signatures = [
      {
        templateId: 'demo-autorisation',
        version: index === 1 ? 'demo-ancienne' : 'demo-1',
        digest: digest(snapshot),
        snapshot,
        signerName: 'Parent EXEMPLE FICTIF',
        capacity: 'LEGAL',
        signedAt: '2026-11-20T12:00:00Z',
        ...(index === 1 ? { withdrawnAt: '2026-11-20T12:05:00Z' } : {}),
      },
    ];
  }
  return {
    family: {
      id: exampleFamily,
      email: 'famille-demo@example.test',
      contact: {
        ...EMPTY_CONTACT,
        name: 'Parent exemple fictif',
        phone: '0600000000',
        city: 'Lyon',
        emergencyName: 'Urgence FICTIF',
        emergencyPhone: '0600000001',
      },
      youths: [first, second, ...cases],
      revision: 0,
      updatedAt: new Date().toISOString(),
    },
    rules: {
      ...DEFAULT_FAMILY_RULES,
      previewDemoSeed: true,
      registrationOpen: true,
      finalDeclaration:
        'DÉMONSTRATION FICTIVE : je simule l’envoi de ce dossier sans inscription réelle.',
      previewHealthSamples: Object.fromEntries(
        [first, second, ...cases].map((y, index) => [
          y.id,
          {
            ...structuredClone(EMPTY_HEALTH),
            answers: Object.fromEntries(
              HEALTH_FIELDS.map((key) => [
                key,
                'EXEMPLE FICTIF : réponse de démonstration, sans personne réelle.',
              ]),
            ),
            presence: Object.fromEntries(
              HEALTH_MODEL_ITEMS.slice(0, index === 0 ? 36 : 10).map((item, i) => [
                item.id,
                i % 2 ? 'NO' : 'YES',
              ]),
            ),
            foodAllergens: index % 2 ? ['MILK', 'EGGS'] : [],
            signature:
              index % 2
                ? {
                    name: 'Parent FICTIF',
                    capacity: 'LEGAL',
                    at: '2026-11-20T12:00:00Z',
                    digest: 'DEMONSTRATION-NON-REELLE',
                  }
                : null,
          },
        ]),
      ),
      templates: [
        {
          id: 'demo-autorisation',
          title: 'Exemple fictif, modèle à remplacer',
          version: 'demo-1',
          text: 'Démonstration uniquement. Ce texte ne vaut pas autorisation réelle. L’organisation doit fournir et valider ses modèles avant ouverture.',
          required: false,
          enabled: true,
        },
      ],
    },
  };
}
