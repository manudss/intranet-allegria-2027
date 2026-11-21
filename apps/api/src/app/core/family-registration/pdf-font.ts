import { PDFDocument } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
export async function registrationFont(pdf: PDFDocument) {
  let bytes: Buffer | undefined;
  for (const base of [
    join(__dirname, 'assets/registration'),
    join(process.cwd(), 'apps/api/src/assets/registration'),
    join(process.cwd(), 'src/assets/registration'),
  ]) {
    try {
      bytes = await readFile(join(base, 'fonts/NotoSans-Regular.ttf'));
      break;
    } catch {
      /* Next deployment path. */
    }
  }
  if (!bytes) throw new Error('Registration Unicode font unavailable');
  pdf.registerFontkit(fontkit);
  const font = await pdf.embedFont(bytes, { subset: true }),
    characters = new Set(font.getCharacterSet());
  // Never silently lose input: unsupported glyphs stay explicit and exact UTF-8 is attached.
  const safe = (s: string) =>
    Array.from(s)
      .map((c) =>
        c === '\n'
          ? '\n'
          : characters.has(c.codePointAt(0)!)
            ? c
            : '[U+' + c.codePointAt(0)!.toString(16).toUpperCase() + ']',
      )
      .join('');
  return { font, safe };
}
