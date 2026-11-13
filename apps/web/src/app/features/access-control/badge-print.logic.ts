import { BarcodeFormat, EncodeHintType, QRCodeWriter } from '@zxing/library';
export interface PrintCard {
  created?: boolean;
  id?: number | null;
  volunteerId?: number;
  firstName: string;
  lastName: string | null;
  type: string;
  mejAgeGroup?: string | null;
  badgeId: number | null;
  code: string | null;
}
export function badgeLabel(p: Pick<PrintCard, 'type' | 'mejAgeGroup'>) {
  if (!p.type) return { label: 'Non nominatif', color: '#f7f7f9', ink: '#222222', logo: '' };
  if (p.type === 'BENEVOLE')
    return { label: 'Bénévole', color: '#f5a623', ink: '#222222', logo: '' };
  const branch = p.mejAgeGroup === 'TA' ? 'TA' : p.mejAgeGroup === 'ES' ? 'ES' : null;
  const adult = p.type === 'ANIMATEUR';
  if (!branch)
    return { label: adult ? 'Animateur' : 'Jeune', color: '#666666', ink: '#ffffff', logo: '' };
  return {
    label: adult ? `Anim ${branch}` : branch,
    color: branch === 'TA' ? (adult ? '#aa2445' : '#fe0002') : adult ? '#007979' : '#00b2b2',
    ink: branch === 'ES' && !adult ? '#222222' : '#ffffff',
    logo: `/assets/branches/${branch.toLowerCase()}.jpg`,
  };
}
export function printableName(p: Pick<PrintCard, 'firstName' | 'lastName' | 'type'>) {
  return p.type === 'JEUNE' ? p.firstName : [p.firstName, p.lastName].filter(Boolean).join(' ');
}
export function randomBadgeCodes(count: number): string[] {
  if (!Number.isInteger(count) || count < 1 || count > 100)
    throw new Error('Choisissez entre 1 et 100 badges');
  return Array.from({ length: count }, () =>
    Array.from(crypto.getRandomValues(new Uint8Array(16)), (x) =>
      x.toString(16).padStart(2, '0'),
    ).join(''),
  );
}
export function qrSvg(code: string, logoData: string, monochrome = false): string {
  if (!code || code.length > 256) throw new Error('Code invalide');
  const matrix = new QRCodeWriter().encode(
    code,
    BarcodeFormat.QR_CODE,
    0,
    0,
    new Map<EncodeHintType, string | number>([
      [EncodeHintType.ERROR_CORRECTION, 'H'],
      [EncodeHintType.MARGIN, 4],
    ]),
  );
  const n = matrix.getWidth();
  let cells = '';
  for (let y = 0; y < n; y++)
    for (let x = 0; x < n; x++)
      if (matrix.get(x, y)) {
        const finder = [
          [4, 4],
          [n - 11, 4],
          [4, n - 11],
        ].some(([a, b]) => x >= a && x < a + 7 && y >= b && y < b + 7);
        cells += `<rect x="${x}" y="${y}" width="1" height="1" fill="${finder && !monochrome ? '#d52f57' : '#000000'}"/>`;
      }
  const w = Math.floor((n - 8) * 0.15),
    at = (n - w) / 2;
  const logo = monochrome
    ? ''
    : `<rect x="${at - 0.7}" y="${at - 0.7}" width="${w + 1.4}" height="${w + 1.4}" fill="white"/><image href="${logoData}" x="${at}" y="${at}" width="${w}" height="${w}"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400" viewBox="0 0 ${n} ${n}" shape-rendering="crispEdges"><rect width="${n}" height="${n}" fill="white"/>${cells}${logo}</svg>`;
}
export function svgData(svg: string) {
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
}
export function escapePrint(value: string) {
  return value.replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] ?? c,
  );
}
export function printDocument(cards: PrintCard[], images: string[], origin: string): string {
  if (!cards.length || cards.some((p) => !p.code) || cards.length !== images.length)
    throw new Error('Planche incomplète');
  const pages = Array.from(
    { length: Math.ceil(cards.length / 12) },
    (_, i) =>
      `<section class="sheet">${cards
        .slice(i * 12, i * 12 + 12)
        .map((p, j) => {
          const b = badgeLabel(p),
            logo = b.logo
              ? `<img class="branch" src="${escapePrint(origin + b.logo)}" alt="${escapePrint(b.label)}"/>`
              : '';
          return `<article><img class="qr" src="${escapePrint(images[i * 12 + j])}" alt="QR badge"/><div class="band" style="background:${b.color};color:${b.ink}">${logo}<div><strong>${escapePrint(printableName(p))}</strong><span>${escapePrint(b.label)}</span></div></div>${!p.type ? `<small>${escapePrint(p.code ?? '')}</small>` : ''}</article>`;
        })
        .join('')}</section>`,
  ).join('');
  return `<!doctype html><html lang="fr"><meta charset="utf-8"><title>Badges Allegria</title><style>@page{size:A4;margin:8mm}*{box-sizing:border-box}body{margin:0;font-family:Arial}.sheet{width:194mm;min-height:280mm;display:grid;grid-template-columns:repeat(3,1fr);grid-template-rows:repeat(4,70mm);break-after:page}.sheet:last-child{break-after:auto}article{border:.2mm dashed #ccc;padding:2mm;display:flex;flex-direction:column;align-items:center;justify-content:center;break-inside:avoid;overflow:hidden}.qr{width:52mm;height:52mm}.band{print-color-adjust:exact;-webkit-print-color-adjust:exact;width:100%;min-height:13mm;display:flex;align-items:center;gap:2mm;padding:1mm}.band>div{flex:1;text-align:center;min-width:0}strong{font-size:11pt;overflow-wrap:anywhere;display:block}span{font-size:9pt;display:block}.branch{width:11mm;height:11mm;object-fit:contain}small{font-size:6pt;word-break:break-all}</style>${pages}</html>`;
}
