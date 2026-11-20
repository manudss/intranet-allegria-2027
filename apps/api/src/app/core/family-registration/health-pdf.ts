import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
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
    font = await pdf.embedFont(StandardFonts.Helvetica);
  const safe = (s: string) => s.replace(/[\u2018\u2019]/g, "'").replace(/[^\u0020-\u00ff]/g, ' ');
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
    40,
    210,
    'Vaccinations déclarées : voir annexe et justificatif ; vérification réservée au référent santé.',
    110,
  );
  text(2, 285, 720, 'Besoins et adaptations : voir réponses intégrales en annexe.', 65);
  text(3, 165, 395, h.signature?.name || 'NON SIGNÉ', 50);
  text(3, 145, 320, h.signature?.at?.slice(0, 10) || '', 20);
  text(3, 190, 292, h.signature ? 'Attestation : voir preuve en annexe' : 'Document non signé', 50);
  text(3, 250, 650, 'Équipements : voir annexe complète.', 55);
  text(3, 185, 435, 'Peurs et phobies : voir annexe complète.', 70);
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
  const annex = await PDFDocument.load(await registrationPdf(lines));
  for (const p of await pdf.copyPages(annex, annex.getPageIndices())) pdf.addPage(p);
  return pdf.save();
}
