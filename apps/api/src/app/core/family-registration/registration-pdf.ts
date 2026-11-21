import { registrationFont } from './pdf-font';
import { PDFDocument, rgb } from 'pdf-lib';
/** Paginated immutable copy of the complete attested document and its evidence. */
export async function registrationPdf(lines: string[]): Promise<Uint8Array> {
  const pdf = await PDFDocument.create(),
    { font, safe } = await registrationFont(pdf);
  let page = pdf.addPage(),
    y = 800;
  await pdf.attach(Buffer.from(lines.join('\n'), 'utf8'), 'contenu-integral-utf8.txt', {
    mimeType: 'text/plain',
    description: 'Contenu intégral UTF-8 sans perte de caractères',
  });
  for (const line of lines) {
    let remaining = safe(line).replace(/\n/g, ' / ');
    while (remaining.length) {
      let n = Math.min(remaining.length, 94);
      while (n > 1 && font.widthOfTextAtSize(remaining.slice(0, n), 10) > 495) n--;
      if (n < remaining.length) {
        const space = remaining.lastIndexOf(' ', n);
        if (space > 0) n = space;
      }
      if (y < 48) {
        page = pdf.addPage();
        y = 800;
      }
      page.drawText(remaining.slice(0, n), {
        x: 48,
        y,
        size: 10,
        font,
        color: rgb(0.14, 0.1, 0.09),
      });
      y -= 15;
      remaining = remaining.slice(n).trimStart();
    }
    y -= 8;
  }
  return pdf.save();
}
