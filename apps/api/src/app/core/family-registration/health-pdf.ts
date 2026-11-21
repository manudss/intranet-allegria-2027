import { createHash } from 'node:crypto';
import { drawAppearance } from './signature-pdf';
import type {
  SignatureAppearance,
  StructuredHealth,
  FamilySpace,
  YouthDossier,
} from '@mej-allegria/shared';
import { registrationFont } from './pdf-font';
import { PDFDocument, rgb } from 'pdf-lib';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import {
  HEALTH_MODEL_ITEMS,
  HEALTH_WEB_ITEMS,
  HEALTH_FORM_PAGES,
  HEALTH_EXTRA_FIELDS,
  FOOD_ALLERGEN_LABELS,
} from '@mej-allegria/shared';
import { registrationPdf } from './registration-pdf';
async function healthPdfSource() {
  for (const path of [
    join(__dirname, 'assets/registration/health-form-source-2026.pdf'),
    join(process.cwd(), 'apps/api/src/assets/registration/health-form-source-2026.pdf'),
    join(process.cwd(), 'src/assets/registration/health-form-source-2026.pdf'),
  ]) {
    try {
      return await readFile(path);
    } catch {
      /* Next supported deployment location. */
    }
  }
  throw new Error('Health source model unavailable');
}
export async function healthPdfSourceDigest() {
  return createHash('sha256')
    .update(await healthPdfSource())
    .digest('hex');
}
/** Filled sanitary sheet. Only signature evidence follows the sheet, never a full data export. */
export async function healthPdf(
  family: FamilySpace,
  youth: YouthDossier,
  h: StructuredHealth,
  declaration: string,
  planned?: { name: string; appearance: SignatureAppearance },
) {
  // An already confirmed document must remain byte-for-byte immutable.
  if (h.signature && h.signedPdf) return Buffer.from(h.signedPdf, 'base64');
  if (h.signature && h.signedPayload) {
    const saved = JSON.parse(h.signedPayload);
    family = { ...family, contact: saved.contact };
    youth = { ...youth, identity: saved.identity };
    declaration = saved.declaration;
  }
  const pdf = await PDFDocument.load(await healthPdfSource());
  const { font, safe } = await registrationFont(pdf);
  const ink = rgb(0.08, 0.2, 0.35);
  const continuations: string[][] = [[], [], [], []];
  const used = new Set<string>();
  const a = h.answers;
  function answer(key: string) {
    used.add(key);
    return a[key] || '';
  }
  function wrap(value: string, width: number, size: number) {
    const result: string[] = [];
    for (const paragraph of safe(value).split(/\r?\n/)) {
      let line = '';
      for (const ch of paragraph) {
        if (line && font.widthOfTextAtSize(line + ch, size) > width) {
          result.push(line);
          line = '';
        }
        line += ch;
      }
      result.push(line);
    }
    return result;
  }
  function draw(page: number, x: number, y: number, value: string, size = 8) {
    pdf.getPage(page).drawText(safe(value), { x, y, size, font, color: ink });
  }
  function field(
    page: number,
    label: string,
    value: string,
    x: number,
    y: number,
    width: number,
    rows = 1,
    size = 8,
  ) {
    if (!value) return;
    const lines = wrap(value, width, size);
    if (lines.length > rows) {
      continuations[page].push(label + ' : ' + value);
      draw(page, x, y, 'Voir suite de cette rubrique', Math.min(size, 7));
      return;
    }
    lines.forEach((line, n) => draw(page, x, y - n * (size + 2), line, size));
  }
  function extra(page: number, label: string, value: string) {
    if (value) continuations[page].push(label + ' : ' + value);
  }
  const i = youth.identity,
    c = family.contact;
  field(0, 'Nom', i.lastName, 95, 698, 350);
  field(0, 'Prénom', i.firstName, 110, 670, 335);
  draw(
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
  field(0, 'Naissance', i.dateOfBirth + ' ' + answer('birthPlace'), 175, 613, 270);
  field(0, 'Adresse', c.address + ' ' + c.postalCode + ' ' + c.city, 120, 585, 430);
  extra(0, 'Domicile', answer('addressType'));
  field(0, 'Responsable', c.name, 40, 472, 145, 2);
  field(
    0,
    'Qualité',
    i.legalCapacity === 'SELF_ADULT' ? 'Adulte concerné' : 'Représentant légal',
    195,
    472,
    130,
    2,
    7,
  );
  field(0, 'Téléphone du responsable', c.phone, 337, 472, 100);
  field(0, 'Autre représentant légal', answer('guardian2'), 40, 445, 500, 2);
  field(0, 'Contact d’urgence', c.emergencyName, 40, 388, 145, 2);
  field(0, 'Téléphone d’urgence', c.emergencyPhone, 337, 388, 100);
  extra(0, 'Autre contact', answer('emergency2'));
  field(0, 'Médecin traitant', answer('doctor'), 40, 350, 510, 2);
  field(0, 'Problèmes importants', answer('history'), 40, 285, 405, 6);
  field(0, 'Date ou période', answer('historyDate'), 455, 285, 100, 6);
  field(0, 'Traitements', answer('treatment'), 40, 145, 510, 5);
  extra(0, 'Nom du traitement', answer('treatmentName'));
  extra(0, 'Type de traitement', answer('treatmentType'));
  extra(0, 'Ordonnance', answer('prescription'));
  extra(0, 'PAI', answer('pai'));
  // Additional contact rows have no room in the supplied two-row table.
  for (const [key, label] of HEALTH_EXTRA_FIELDS.filter(([key]) =>
    /^(guardianExtra|emergencyExtra)/.test(key),
  ))
    extra(0, label, answer(key));

  for (const item of HEALTH_MODEL_ITEMS) {
    const presence = h.presence?.[item.id];
    if (presence) {
      if (item.id === 'treatment') draw(0, presence === 'YES' ? 66.8 : 36, 186, 'X');
      else
        pdf
          .getPage(item.pdfPage)
          .drawEllipse({
            x: item.x + (presence === 'YES' ? 6.5 : 27.5),
            y: item.y,
            xScale: presence === 'YES' ? 9 : 11,
            yScale: 7,
            borderWidth: 1,
            borderColor: ink,
          });
    }
    const detail = answer('detail_' + item.id);
    // Legacy grouped free text is placed once, not duplicated beside every related diagnosis.
    const legacy = !used.has(item.answerKey) ? answer(item.answerKey) : '';
    const value = [detail, legacy && legacy !== detail ? legacy : ''].filter(Boolean).join(' ; ');
    if (item.id === 'treatment') {
      extra(0, item.label, detail);
      continue;
    }
    const x =
      item.pdfPage === 1
        ? 280
        : item.pdfPage === 2 && item.x > 230
          ? 292
          : item.pdfPage === 3 && item.x < 150
            ? 185
            : 255;
    const subrow = ['sensory', 'attention', 'swimming', 'menstruation'].includes(item.id);
    field(
      item.pdfPage,
      item.label,
      (!presence ? 'Non renseigné. ' : '') + value,
      x,
      item.y - (subrow ? 12 : 3),
      558 - x,
      subrow || item.pdfPage === 1 ? 1 : 2,
      7,
    );
  }
  // Web-only fields and older grouped answers remain part of the sanitary sheet itself.
  extra(1, 'Besoins de repas', answer('diet'));
  if (h.foodAllergens.length)
    extra(
      1,
      'Allergènes déclarés',
      h.foodAllergens.map((v) => FOOD_ALLERGEN_LABELS[v] || v).join(', '),
    );
  field(1, 'Vaccinations déclarées', answer('vaccinations'), 95, 250, 460, 2, 7);
  extra(1, 'Justificatif vaccinal', answer('vaccineDocument'));
  for (const [key, label] of HEALTH_EXTRA_FIELDS.filter(([key]) => key.startsWith('vaccine_')))
    extra(1, label, answer(key));
  field(3, 'Suivi particulier', answer('followUp'), 40, 601, 510, 2);
  for (const item of HEALTH_WEB_ITEMS) {
    const presence = h.presence?.[item.id];
    const detail = answer('detail_' + item.id);
    if (presence || detail)
      extra(
        3,
        item.label,
        [presence === 'YES' ? 'Oui' : presence === 'NO' ? 'Non' : 'Non renseigné', detail]
          .filter(Boolean)
          .join(' ; '),
      );
  }
  // Preserve supported fields not handled by a model cell, never a second full export.
  const labels = new Map<string, string>([
    ...HEALTH_FORM_PAGES.flatMap((p) => [...p.fields]),
    ...HEALTH_EXTRA_FIELDS,
  ]);
  for (const [key, value] of Object.entries(a))
    if (value && !used.has(key)) extra(3, labels.get(key) || key, value);

  field(3, 'Signataire', h.signature?.name || planned?.name || 'NON SIGNÉ', 165, 395, 380);
  draw(
    3,
    137,
    320,
    h.signature
      ? new Date(h.signature.at).toLocaleDateString('fr-FR', { timeZone: 'Europe/Paris' })
      : '',
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
    draw(
      3,
      190,
      292,
      h.signature ? 'Attestation : voir preuve de signature' : 'Document non signé',
    );
  if (planned && !h.signature)
    draw(3, 36, 35, 'APERÇU NON SIGNÉ : confirmation par code encore nécessaire');
  // Insert only the overflow for a rubric directly after its source page, before signature evidence.
  for (let sourcePage = 3; sourcePage >= 0; sourcePage--) {
    if (!continuations[sourcePage].length) continue;
    const continuation = await PDFDocument.load(
      await registrationPdf([
        'FICHE SANITAIRE : SUITE DES RUBRIQUES',
        'Rassemblement Alegria · ' + i.firstName + ' ' + i.lastName,
        'Suite de la page du modèle ' +
          (sourcePage + 1) +
          '. Informations non répétées dans les cases.',
        ...continuations[sourcePage],
      ]),
    );
    const copies = await pdf.copyPages(continuation, continuation.getPageIndices());
    copies.forEach((p, n) => pdf.insertPage(sourcePage + 1 + n, p));
  }
  const proof = [
    'PREUVE DE SIGNATURE',
    'Rassemblement Alegria · Fiche sanitaire de ' + i.firstName + ' ' + i.lastName,
    'Déclaration applicable :',
    declaration,
    h.signature
      ? 'Attestation simple, non avancée et non qualifiée'
      : 'NON SIGNÉ : aucune confirmation enregistrée',
  ];
  if (h.signature)
    proof.push(
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
  const evidence = await PDFDocument.load(await registrationPdf(proof));
  for (const p of await pdf.copyPages(evidence, evidence.getPageIndices())) pdf.addPage(p);
  for (const [n, page] of pdf.getPages().entries())
    page.drawText(
      safe(
        'Rassemblement Alegria | ' +
          i.firstName +
          ' ' +
          i.lastName +
          ' | ' +
          (n + 1) +
          '/' +
          pdf.getPageCount(),
      ),
      { x: 36, y: 20, size: 7, font, color: ink },
    );
  // No JSON, UTF-8 file or other embedded export of the family's answers.
  return pdf.save();
}
