import { describe, expect, it } from 'vitest';
import { computeTeamMaxSize, hasSecondaryAnimator } from './team-fill';

describe('computeTeamMaxSize', () => {
  it('laisse une équipe sur cinq exactement pleine', () => {
    expect(computeTeamMaxSize(9, 2, 0)).toBe(11);
    expect(computeTeamMaxSize(9, 2, 5)).toBe(11);
  });

  it('remplit une équipe sur cinq à moitié', () => {
    expect(computeTeamMaxSize(9, 2, 1)).toBe(22);
  });

  it('laisse une marge de 2 à 4 places aux autres équipes', () => {
    expect(computeTeamMaxSize(9, 2, 2)).toBe(15);
    expect(computeTeamMaxSize(9, 2, 3)).toBe(13);
    expect(computeTeamMaxSize(9, 2, 4)).toBe(14);
  });

  it('garantit toujours la place des jeunes et des animateurs', () => {
    for (let index = 0; index < 25; index += 1) {
      expect(computeTeamMaxSize(8, 2, index)).toBeGreaterThanOrEqual(10);
      expect(computeTeamMaxSize(8, 1, index)).toBeGreaterThanOrEqual(9);
    }
  });
});

describe('hasSecondaryAnimator', () => {
  it('garde environ 20 % des équipes sans second animateur', () => {
    const withSecondary = Array.from({ length: 25 }, (_, index) =>
      hasSecondaryAnimator(index),
    ).filter(Boolean).length;
    expect(withSecondary).toBe(20);
  });
});
