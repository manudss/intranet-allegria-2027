import { describe, it, expect } from 'vitest';
import {
  badgeLabel,
  printableName,
  randomBadgeCodes,
  qrSvg,
  svgData,
  printDocument,
  PrintCard,
} from './badge-print.logic';
const card: PrintCard = {
  id: 1,
  firstName: 'Ada',
  lastName: 'Secret',
  type: 'JEUNE',
  mejAgeGroup: 'TA',
  badgeId: 7,
  code: '0123456789abcdef0123456789abcdef',
};
describe('QR printing contract', () => {
  it('encodes only the opaque code, H correction, free margin and red finders', () => {
    const svg = qrSvg(card.code ?? '', 'data:image/png;base64,AA==');
    expect(svg).toContain('#d52f57');
    expect(svg).toContain('#000000');
    expect(svg).toContain('<image');
    expect(svg).not.toContain('Ada');
    expect(svg).not.toContain('Secret');
    expect(svgData(svg)).toMatch(/^data:image\/svg\+xml/);
  });
  it('provides a plain black fallback without central obstruction', () => {
    const svg = qrSvg(card.code ?? '', '', true);
    expect(svg).not.toContain('<image');
    expect(svg).not.toContain('#d52f57');
  });
  it('does not infer a branch from age and never adds JT', () => {
    expect(badgeLabel({ type: 'JEUNE', mejAgeGroup: null }).label).toBe('Jeune');
    expect(badgeLabel({ type: 'JEUNE', mejAgeGroup: 'JT' }).label).toBe('Jeune');
    expect(badgeLabel({ type: 'ANIMATEUR', mejAgeGroup: 'TA' })).toMatchObject({
      label: 'Anim TA',
      logo: '/assets/branches/ta.jpg',
    });
    expect(badgeLabel({ type: 'JEUNE', mejAgeGroup: 'ES' })).toMatchObject({
      color: '#00b2b2',
      ink: '#222222',
    });
    expect(badgeLabel({ type: 'BENEVOLE' }).color).toBe('#f5a623');
    expect(badgeLabel({ type: '' }).label).toBe('Non nominatif');
  });
  it('hides youth surnames in preview and print, escapes text, and paginates 12 per A4', () => {
    expect(printableName(card)).toBe('Ada');
    const cards = Array.from({ length: 13 }, () => ({ ...card, firstName: '<script>"&' }));
    const html = printDocument(
      cards,
      cards.map(() => svgData(qrSvg(card.code ?? '', '', true))),
      'https://example.test',
    );
    expect(html.match(/class="sheet"/g) ?? []).toHaveLength(2);
    expect(html.match(/<article>/g) ?? []).toHaveLength(13);
    expect(html).not.toContain('Secret');
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;&quot;&amp;');
    expect(html).toContain('size:A4');
    expect(html).toContain('repeat(4,70mm)');
    expect(() => printDocument([card], [], '')).toThrow();
    expect(() => printDocument([{ ...card, code: null }], ['x'], '')).toThrow();
  });
  it('generates bounded random 32-hex codes without any personal data', () => {
    const codes = randomBadgeCodes(100);
    expect(new Set(codes).size).toBe(100);
    expect(codes.every((c) => /^[a-f0-9]{32}$/.test(c))).toBe(true);
    for (const n of [0, -1, 101, 1.5]) expect(() => randomBadgeCodes(n)).toThrow();
  });
});
