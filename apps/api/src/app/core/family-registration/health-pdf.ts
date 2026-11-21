import { createHash } from 'node:crypto';
import { drawAppearance } from './signature-pdf';
import type { SignatureAppearance } from '@mej-allegria/shared';
import { registrationFont } from './pdf-font';
import { PDFDocument, rgb } from 'pdf-lib';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import {
  HEALTH_FORM_PAGES,
  HEALTH_MODEL_ITEMS,
  HEALTH_EXTRA_FIELDS,
  HEALTH_WEB_ITEMS,
  FOOD_ALLERGEN_LABELS,
} from '@mej-allegria/shared';
import type { StructuredHealth, FamilySpace, YouthDossier } from '@mej-allegria/shared';
import { registrationPdf } from './registration-pdf';
async function healthPdfSource() {
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
  return source;
}
export async function healthPdfSourceDigest() {
  return createHash('sha256')
    .update(await healthPdfSource())
    .digest('hex');
}
/** Uses the supplied four-page model as background, with full non-truncated answers in numbered annexes. */
export async function healthPdf(
  family: FamilySpace,
  youth: YouthDossier,
  h: StructuredHealth,
  declaration: string,
  planned?: { name: string; appearance: SignatureAppearance },
) {
  if (h.signature && h.signedPdf) return Buffer.from(h.signedPdf, 'base64');
  if (h.signature && h.signedPayload) {
    const saved = JSON.parse(h.signedPayload);
    family = { ...family, contact: saved.contact };
    youth = { ...youth, identity: saved.identity };
    declaration = saved.declaration;
  }
  const source = await healthPdfSource();
  const pdf = await PDFDocument.load(source),
    { font, safe } = await registrationFont(pdf);
  function text(page: number, x: number, y: number, value: string, max = 68) {
    pdf
      .getPage(page)
      .drawText(safe(value).length > max ? 'Voir annexe : réponse complète' : safe(value), {
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
  text(1, 455, 482, 'Voir justificatif', 22);
  text(
    1,
    95,
    250,
    'Vaccinations déclarées : voir annexe et justificatif ; vérification réservée au référent santé.',
    110,
  );
  // Circle only an explicit model answer. Free text and missing values never become yes/no.
  for (const item of HEALTH_MODEL_ITEMS) {
    const presence = h.presence?.[item.id],
      answer = h.answers['detail_' + item.id] || h.answers[item.answerKey] || '',
      modelPage = pdf.getPage(item.pdfPage);
    if (presence) {
      if (item.id === 'treatment') {
        text(0, presence === 'YES' ? 66.8 : 36, 186, 'X', 1);
      } else {
        modelPage.drawEllipse({
          x: item.x + (presence === 'YES' ? 6.5 : 27.5),
          y: item.y,
          xScale: presence === 'YES' ? 9 : 11,
          yScale: 7,
          borderWidth: 1,
          borderColor: rgb(0.08, 0.2, 0.35),
        });
      }
    }
    if (item.id !== 'treatment') {
      const x =
          item.pdfPage === 1
            ? 280
            : item.pdfPage === 2 && item.x > 230
              ? 292
              : item.pdfPage === 3 && item.x < 150
                ? 185
                : 255,
        prefix = !presence ? 'Non renseigné. ' : '',
        content = prefix + answer,
        available = 558 - x;
      text(
        item.pdfPage,
        x,
        item.y - (['sensory', 'attention', 'swimming', 'menstruation'].includes(item.id) ? 12 : 3),
        font.widthOfTextAtSize(safe(content), 8) <= available
          ? content
          : prefix + 'Précisions : voir annexe.',
        110,
      );
    }
  }
  text(3, 165, 395, h.signature?.name || planned?.name || 'NON SIGNÉ', 50);
  text(
    3,
    137,
    320,
    h.signature
      ? new Date(h.signature.at).toLocaleDateString('fr-FR', { timeZone: 'Europe/Paris' })
      : '',
    20,
  );
  const appearance = h.signature?.appearance || planned?.appearance;
  if (appearance)
    await drawAppearance(
      pdf,
      3,
      h.signature?.name || planned?.name || '',
      appearance,
      190,
      267,
      180,
      42,
    );
  else
    text(
      3,
      190,
      292,
      h.signature ? 'Attestation : voir preuve en annexe' : 'Document non signé',
      50,
    );
  if (planned && !h.signature)
    text(3, 36, 35, 'APERÇU NON SIGNÉ : confirmation par code encore nécessaire', 100);
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
      lines.push(label + ' : ' + (h.answers[key] || 'Non renseigné'));
    for (const item of [...HEALTH_MODEL_ITEMS, ...HEALTH_WEB_ITEMS].filter(
      (item) => item.page === HEALTH_FORM_PAGES.indexOf(p),
    ))
      lines.push(
        'Choix explicite du modèle, ' +
          item.label +
          ' : ' +
          ({ YES: 'Oui', NO: 'Non', '': 'Non renseigné' }[h.presence?.[item.id] || ''] ||
            'Non renseigné'),
      );
  }
  const extra = HEALTH_EXTRA_FIELDS.filter(([key]) => !!h.answers[key]);
  if (extra.length) {
    lines.push('COMPLÉMENTS DE LA FICHE WEB');
    for (const [key, label] of extra) lines.push(label + ' : ' + h.answers[key]);
  }
  lines.push(
    'Besoins alimentaires structurés : ' +
      h.foodAllergens.map((a) => FOOD_ALLERGEN_LABELS[a] || a).join(', '),
    'Déclaration validée applicable :',
    declaration,
    h.signature ? 'Attestation simple, non avancée et non qualifiée' : 'NON SIGNÉ',
  );
  if (h.signature)
    lines.push(
      'Signataire : ' + h.signature.name,
      'Qualité : ' + (h.signature.capacity === 'LEGAL' ? 'Représentant légal' : 'Adulte concerné'),
      'Date : ' +
        new Date(h.signature.at).toLocaleString('fr-FR', { timeZone: 'Europe/Paris' }) +
        ' (heure de Paris)',
      'Empreinte du contenu figé : ' + h.signature.digest,
      ...(h.signature.verification
        ? [
            'Confirmation par code e-mail distinct de la connexion : ' +
              h.signature.verification.verifiedAt,
            'Identifiant de confirmation : ' + h.signature.verification.challengeId,
            'Empreinte de la demande liée au document : ' + h.signature.verification.context,
            'Ce contrôle ne prouve pas à lui seul l’identité ni la qualité du signataire.',
          ]
        : ['Ancienne attestation sans code distinct.']),
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
