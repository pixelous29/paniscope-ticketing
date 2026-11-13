import { describe, it, expect } from 'vitest';
import { getCanonicalRedirectUrl } from '../utils/canonicalRedirect';

describe('getCanonicalRedirectUrl', () => {
  it('redirige un domaine générique .web.app de production vers support.paniscope.fr en conservant le chemin et les paramètres', () => {
    const result = getCanonicalRedirectUrl({
      hostname: 'exemple-prod.web.app',
      pathname: '/ticket/0000123',
      search: '?tab=client',
      hash: '#details',
    });

    expect(result).toBe('https://support.paniscope.fr/ticket/0000123?tab=client#details');
  });

  it('redirige également un domaine générique .firebaseapp.com vers support.paniscope.fr', () => {
    const result = getCanonicalRedirectUrl({
      hostname: 'exemple-prod.firebaseapp.com',
      pathname: '/',
      search: '',
      hash: '',
    });

    expect(result).toBe('https://support.paniscope.fr/');
  });

  it('ne redirige pas l’environnement de recette (-dev.)', () => {
    expect(
      getCanonicalRedirectUrl({
        hostname: 'paniscope-dev.web.app',
        pathname: '/ticket/0000123',
        search: '',
        hash: '',
      })
    ).toBeNull();
  });

  it('ne redirige pas support.paniscope.fr ni localhost', () => {
    expect(
      getCanonicalRedirectUrl({
        hostname: 'support.paniscope.fr',
        pathname: '/ticket/0000123',
      })
    ).toBeNull();

    expect(
      getCanonicalRedirectUrl({
        hostname: 'localhost',
        pathname: '/mon-compte',
      })
    ).toBeNull();
  });

  it('ne redirige pas les routes internes Firebase /__/auth/*', () => {
    expect(
      getCanonicalRedirectUrl({
        hostname: 'exemple-prod.web.app',
        pathname: '/__/auth/handler',
        search: '?mode=action',
      })
    ).toBeNull();
  });
});
