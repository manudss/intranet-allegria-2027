import { resolveRegistrationLink } from './event.config';

describe('resolveRegistrationLink', () => {
  it('returns undefined for an empty link, so components can disable the CTA', () => {
    expect(resolveRegistrationLink('')).toBeUndefined();
    expect(resolveRegistrationLink('   ')).toBeUndefined();
  });

  it('returns the link untouched when configured', () => {
    expect(resolveRegistrationLink('https://forms.example.com/jeunes')).toBe(
      'https://forms.example.com/jeunes',
    );
  });
});
