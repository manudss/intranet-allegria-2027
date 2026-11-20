import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
/** Paginated immutable copy of the complete attested document and its evidence. */
export async function registrationPdf(lines: string[]): Promise<Uint8Array> {
  const pdf = await PDFDocument.create(),
    font = await pdf.embedFont(StandardFonts.Helvetica);
  let page = pdf.addPage(),
    y = 800;
  const safe = (s: string) =>
    s
      .replace(/[\u2018\u2019]/g, "'")
      .replace(/[\u201c\u201d]/g, '"')
      .replace(/[\u2192]/g, '>')
      .replace(/[^\u0020-\u00ff\n]/g, ' ');
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
