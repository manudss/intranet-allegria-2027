import { appRoutes } from './app.routes';

describe('appRoutes', () => {
  const expectedPaths = [
    '',
    'evenement',
    'programme',
    'participer',
    'inscription/jeunes',
    'inscription/familles',
    'benevoles',
    'inscription/benevoles',
    'faq',
    'lieu',
    'contact',
    'mentions-legales',
    'politique-confidentialite',
    'accessibilite',
  ];

  it.each(expectedPaths)('registers route "%s"', (path) => {
    expect(appRoutes.some((route) => route.path === path)).toBe(true);
  });

  it('has a wildcard fallback redirecting to home', () => {
    const wildcard = appRoutes.find((route) => route.path === '**');
    expect(wildcard?.redirectTo).toBe('');
  });

  it('lazily loads every route with a component factory', () => {
    for (const route of appRoutes) {
      if (route.path === '**') {
        continue;
      }
      expect(typeof route.loadComponent).toBe('function');
    }
  });
});
