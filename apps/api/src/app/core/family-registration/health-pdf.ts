import { registrationFont } from './pdf-font';
import { PDFDocument, rgb } from 'pdf-lib';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { HEALTH_FORM_PAGES } from '@mej-allegria/shared';
import type { StructuredHealth, FamilySpace, YouthDossier } from '@mej-allegria/shared';
import { registrationPdf } from './registration-pdf';
/** Uses the supplied four-page model as background, with full non-truncated answers in numbered annexes. */
export async function healthPdf(
  family: FamilySpace,
  youth: YouthDossier,
  h: StructuredHealth,
  declaration: string,
) {
  if (h.signature && h.signedPayload) {
    const saved = JSON.parse(h.signedPayload);
    family = { ...family, contact: saved.contact };
    youth = { ...youth, identity: saved.identity };
    declaration = saved.declaration;
  }
  const paths = [
    join(__dirname, 'assets/registration/health-form-source-2026.pdf'),
    join(process.cwd(), 'apps/api/src/assets/registration/health-form-source-2026.pdf'),
    join(process.cwd(), 'src/assets/registration/health-form-source-2026.pdf'),
  ];
  let source: Buffer | undefined;
  for (const path of paths) {
    try {
      source = await readFile(path);
      break;
    } catch {
      /* Next supported deployment location. */
    }
  }
  if (!source) throw new Error('Health source model unavailable');
  const pdf = await PDFDocument.load(source),
    { font, safe } = await registrationFont(pdf);
  function text(page: number, x: number, y: number, value: string, max = 68) {
    pdf
      .getPage(page)
      .drawText(safe(value).length > max ? safe(value).slice(0, max - 3) + '...' : safe(value), {
        x,
        y,
        size: 8,
        font,
        color: rgb(0.08, 0.2, 0.35),
      });
  }
  const i = youth.identity,
    c = family.contact;
  text(0, 95, 698, i.lastName);
  text(0, 110, 670, i.firstName);
  text(
    0,
    95,
    640,
    (
      { FEMALE: 'Féminin', MALE: 'Masculin', OTHER: 'Autre', UNDISCLOSED: 'Non précisé' } as Record<
        string,
        string
      >
    )[i.sex] || i.sex,
  );
  text(0, 175, 613, i.dateOfBirth + ' ' + (h.answers.birthPlace || ''));
  text(0, 120, 585, c.address + ' ' + c.postalCode + ' ' + c.city);
  text(0, 40, 472, c.name, 28);
  text(
    0,
    200,
    472,
    i.legalCapacity === 'SELF_ADULT' ? 'Adulte concerné' : 'Représentant légal',
    25,
  );
  text(0, 340, 472, c.phone, 20);
  text(0, 40, 445, h.answers.guardian2 ? 'Voir annexe : autre responsable' : 'Non renseigné', 28);
  text(0, 40, 388, c.emergencyName, 25);
  text(0, 340, 388, c.emergencyPhone, 20);
  text(
    0,
    40,
    340,
    h.answers.doctor ? 'Médecin : voir réponse intégrale en annexe' : 'Médecin : non renseigné',
    90,
  );
  text(
    0,
    40,
    280,
    'État de santé et dates : voir les réponses intégrales en annexe, pages 5 et suivantes.',
    100,
  );
  text(0, 40, 258, h.answers.history || 'À compléter', 95);
  text(0, 40, 142, 'Traitements, ordonnance et PAI : réponses intégrales en annexe.', 100);
  const allergyKeys = ['foodAllergy', 'animalAllergy', 'pollenAllergy', 'drugAllergy', 'asthma'];
  allergyKeys.forEach((key, index) =>
    text(1, 280, 639 - index * 18, h.answers[key] || 'À compléter, voir annexe', 66),
  );
  text(1, 455, 482, 'Voir justificatif', 22);
  text(
    1,
    95,
    250,
    'Vaccinations déclarées : voir annexe et justificatif ; vérification réservée au référent santé.',
    110,
  );
  const adaptationRows = [
    ['communication', 737],
    ['communication', 709],
    ['sleep', 682],
    ['mobility', 654],
    ['learning', 627],
    ['learning', 599],
    ['mobility', 572],
    ['sensory', 535],
    ['sleep', 517],
    ['other', 489],
    ['learning', 451],
    ['mental', 434],
    ['mental', 407],
    ['sleep', 379],
    ['learning', 351],
    ['learning', 324],
    ['other', 296],
  ] as const;
  for (const [key, y] of adaptationRows)
    text(
      2,
      292,
      y,
      `Voir annexe : ${HEALTH_FORM_PAGES[5].fields.find((f) => f[0] === key)?.[1]?.split(':')[0] || key}`,
      55,
    );
  text(2, 255, 215, 'Voir annexe : aisance aquatique', 55);
  text(2, 255, 195, 'Voir annexe : équipements', 55);
  text(2, 255, 165, 'Voir annexe : vie quotidienne', 55);
  text(2, 255, 138, 'Voir annexe : vie quotidienne', 55);
  text(3, 165, 395, h.signature?.name || 'NON SIGNÉ', 50);
  text(3, 145, 320, h.signature?.at?.slice(0, 10) || '', 20);
  text(3, 190, 292, h.signature ? 'Attestation : voir preuve en annexe' : 'Document non signé', 50);
  for (const y of [755, 728, 700, 673, 645])
    text(3, 250, y, 'Voir annexe : équipements / vie quotidienne.', 55);
  for (const y of [554, 527, 500, 472, 445]) text(3, 185, y, 'Voir annexe : peurs et phobies.', 70);
  for (let n = 0; n < 4; n++) {
    text(
      n,
      36,
      20,
      `Fiche de ${i.firstName} ${i.lastName} | Modèle fourni 2026, mentions à valider | Annexe indissociable`,
      110,
    );
  }
  const lines = [
    'FICHE SANITAIRE : RÉPONSES INTÉGRALES ET PREUVE',
    'Modèle fourni : CAMP MEJ 2026, quatre pages conservées en tête.',
    'Cette annexe complète les cases trop courtes ; elle fait partie du document.',
    'Jeune : ' + i.firstName + ' ' + i.lastName,
    'Naissance : ' + i.dateOfBirth,
    'Responsable : ' + c.name,
    'Contacts : ' + c.phone + ' ; urgence : ' + c.emergencyName + ' ' + c.emergencyPhone,
  ];
  for (const p of HEALTH_FORM_PAGES) {
    lines.push(p.title);
    for (const [key, label] of p.fields)
      lines.push(label + ' : ' + (h.answers[key] || 'À compléter'));
  }
  lines.push(
    'Besoins alimentaires structurés : ' + h.foodAllergens.join(', '),
    'Déclaration validée applicable :',
    declaration,
    h.signature ? 'Attestation simple, non avancée et non qualifiée' : 'NON SIGNÉ',
  );
  if (h.signature)
    lines.push(
      'Signataire : ' + h.signature.name,
      'Qualité : ' + h.signature.capacity,
      'Date : ' + h.signature.at,
      'Empreinte du contenu figé : ' + h.signature.digest,
    );
  await pdf.attach(
    Buffer.from(
      JSON.stringify({ identity: i, contact: c, health: h, declaration }, null, 2),
      'utf8',
    ),
    'fiche-integrale-utf8.json',
    { mimeType: 'application/json', description: 'Données intégrales et preuve de cette fiche' },
  );
  const annex = await PDFDocument.load(await registrationPdf(lines));
  for (const p of await pdf.copyPages(annex, annex.getPageIndices())) pdf.addPage(p);
  return pdf.save();
}
