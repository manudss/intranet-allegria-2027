import { PDFDocument, rgb } from 'pdf-lib';
import type { FamilySignature, SignatureAppearance } from '@mej-allegria/shared';
import { registrationPdf } from './registration-pdf';
import { registrationFont } from './pdf-font';
/** The same bounded renderer is used for the preview and committed signature. Never stretch an image. */
export async function drawAppearance(
  pdf: PDFDocument,
  pageIndex: number,
  name: string,
  appearance: SignatureAppearance,
  x: number,
  y: number,
  width: number,
  height: number,
) {
  const page = pdf.getPage(pageIndex);
  if (appearance.method === 'NAME') {
    const { font, safe } = await registrationFont(pdf),
      value = safe(name);
    let size = 20,
      lines: string[] = [];
    while (size >= 7) {
      lines = [];
      let line = '';
      for (const ch of value) {
        if (font.widthOfTextAtSize(line + ch, size) > width && line) {
          lines.push(line);
          line = '';
        }
        line += ch;
      }
      if (line) lines.push(line);
      if (lines.length * size * 1.2 <= height) break;
      size--;
    }
    lines.forEach((line, n) =>
      page.drawText(line, {
        x,
        y: y + height - size - n * size * 1.2,
        size,
        font,
        color: rgb(0.1, 0.15, 0.22),
      }),
    );
  } else if (appearance.image) {
    const image = appearance.image.startsWith('data:image/png')
      ? await pdf.embedPng(appearance.image)
      : await pdf.embedJpg(appearance.image);
    const scale = Math.min(width / image.width, height / image.height);
    page.drawImage(image, { x, y, width: image.width * scale, height: image.height * scale });
  }
}
export async function authorizationPdf(
  snapshot: string,
  signature?: FamilySignature,
  planned?: { name: string; appearance: SignatureAppearance; capacity?: string },
) {
  if (signature?.document) return Buffer.from(signature.document.pdfBase64, 'base64');
  const snap = JSON.parse(snapshot),
    lines = [
      snap.template.title,
      'Version ' + snap.template.version,
      'Jeune : ' + snap.identity.firstName + ' ' + snap.identity.lastName,
      ...String(snap.template.text).split('\n'),
    ];
  // A separate signature block avoids placing marks on an arbitrary template's prose.
  const pdf = await PDFDocument.load(await registrationPdf(lines));
  const block = await PDFDocument.load(
    await registrationPdf([
      signature ? 'ATTESTATION SIMPLE, NON AVANCÉE ET NON QUALIFIÉE' : 'APERÇU NON SIGNÉ',
      'Signataire : ' + (signature?.signerName || planned?.name || 'À renseigner'),
      'Qualité : ' +
        ((signature?.capacity || planned?.capacity) === 'SELF_ADULT'
          ? 'Adulte concerné'
          : 'Représentant légal'),
      'Date : ' +
        (signature
          ? new Date(signature.signedAt).toLocaleString('fr-FR', { timeZone: 'Europe/Paris' })
          : 'Fixée lors de la confirmation'),
      'Apparence de signature ci-dessous :',
    ]),
  );
  for (const page of await pdf.copyPages(block, block.getPageIndices())) pdf.addPage(page);
  const appearance = signature?.appearance || planned?.appearance;
  if (appearance)
    await drawAppearance(
      pdf,
      pdf.getPageCount() - 1,
      signature?.signerName || planned?.name || '',
      appearance,
      48,
      570,
      280,
      65,
    );
  if (signature) {
    const proof = await PDFDocument.load(
      await registrationPdf([
        'PREUVE DE CONFIRMATION',
        'Version du document : ' + signature.version,
        'Empreinte SHA-256 du contenu figé : ' + signature.digest,
        'Méthode : ' +
          (signature.verification
            ? 'Code e-mail distinct de la connexion'
            : 'Ancienne attestation sans code distinct'),
        ...(signature.verification
          ? [
              'Vérification : ' + signature.verification.verifiedAt,
              'Identifiant de confirmation : ' + signature.verification.challengeId,
              'Empreinte de la demande liée au document : ' + signature.verification.context,
            ]
          : []),
        'Le contrôle du courrier ne prouve pas à lui seul l’identité ni la qualité du signataire.',
      ]),
    );
    for (const page of await pdf.copyPages(proof, proof.getPageIndices())) pdf.addPage(page);
  }
  return pdf.save();
}
