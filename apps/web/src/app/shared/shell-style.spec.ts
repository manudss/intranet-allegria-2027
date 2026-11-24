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
    expect(read('../layout.html')).toContain('app-appearance-toggle');
  });
});

describe('page Stock des badges, petit écran', () => {
  it('empile champs et boutons et fait défiler le tableau', () => {
    const page = read('../features/access-control/badges-stock.page.ts');
    expect(page).toMatch(/\.row, \.filters \{[^}]*flex-wrap: wrap/);
    expect(page).toContain('class="tbl-scroll"');
    expect(page).toMatch(/\.tbl-scroll \{[^}]*overflow-x: auto/);
  });
});

describe('pastilles à couleur automatique', () => {
  it('gardent un texte foncé lisible, aussi en thème sombre', () => {
    expect(read('./data-table.scss')).toMatch(/\[tuiChip\]\[style\*='background-color'\]\s*\{[^}]*color:\s*#241c1c/);
  });
});

describe('cadre de page', () => {
  it('est une carte en ombre, sans contour', () => {
    expect(readFileSync(new URL('../../styles.scss', import.meta.url), 'utf8')).toMatch(/\.page \{[^}]*border: 0;[^}]*box-shadow: var\(--card-shadow/);
  });
});
