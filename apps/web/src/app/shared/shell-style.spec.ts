import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (p: string) => readFileSync(new URL(p, import.meta.url), 'utf8');

describe('identité visuelle du gabarit (thème clair)', () => {
  const layout = read('../layout.scss');

  it('garde le menu jaune et le bandeau rose de la marque', () => {
    expect(layout).toMatch(/\.allegria-header\s*{[^}]*background:\s*#d52f57/);
    expect(layout).toMatch(/\.allegria-sidebar\s*{[^}]*background:\s*#f5a623/);
  });

  it('utilise un texte foncé lisible sur le menu jaune', () => {
    expect(layout).toMatch(/\.allegria-sidebar \[tuiAsideItem\]\s*{[^}]*color:\s*#2b1a00/);
  });

  it('place le sélecteur d’apparence dans l’en-tête', () => {
    expect(read('../layout.html')).toContain('app-appearance-taiga');
  });
});
