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
    expect(read('../../styles.scss')).toMatch(/\.page \{[^}]*border: 0;[^}]*box-shadow: var\(--card-shadow/);
  });
});

describe('tableau de données, accessibilité clavier', () => {
  it('zone défilante focusable, nommée, avec focus visible', () => {
    const html = read('./data-table.html');
    expect(html).toMatch(/class="table-scroll"[^>]*role="region"[^>]*tabindex="0"[^>]*aria-label="[^"]+"/);
    expect(read('./data-table.scss')).toMatch(/\.table-scroll[^}]*&:focus-visible/s);
  });
});

describe('bandeau en thème sombre', () => {
  it('garde le rouge de la marque avec texte clair', () => {
    const layout = read('../layout.scss');
    const dark = layout.slice(layout.indexOf(":host-context([data-theme='dark'])"));
    expect(dark).toMatch(/\.allegria-header \{\s*background:#d52f57;color:#ffffff;/);
    expect(dark).not.toMatch(/\.allegria-header,\s*\.allegria-sidebar/);
  });
});

describe('accessibilité du gabarit (lot 6)', () => {
  const html = read('../layout.html');

  it('propose un lien d’évitement vers le contenu', () => {
    expect(html).toMatch(/<a class="skip-link" href="#contenu"/);
    expect(html).toMatch(/<main[^>]*id="contenu"/);
  });

  it('laisse le titre de page aux pages : un seul h1 par écran', () => {
    expect(html).not.toContain('<h1');
  });

  it('nomme le bouton de menu mobile', () => {
    expect(html).toMatch(/mobile-menu-btn/);
    expect(html).toContain("'Ouvrir le menu'");
  });
});
