/**
 * Calcule l'URL canonique de redirection lorsqu'un utilisateur accède à l'application
 * via un domaine générique Firebase de production (.web.app / .firebaseapp.com).
 * Préserve l'environnement de recette (-dev.), localhost, Capacitor et les routes /__/.
 *
 * @param {{ hostname?: string, pathname?: string, search?: string, hash?: string }} locationObj
 * @param {string} [canonicalOrigin]
 * @returns {string | null}
 */
export function getCanonicalRedirectUrl(
  locationObj,
  canonicalOrigin = import.meta.env.VITE_APP_BASE_URL || 'https://support.paniscope.fr'
) {
  if (!locationObj || !locationObj.hostname) return null;
  const host = locationObj.hostname.toLowerCase();
  const pathname = locationObj.pathname || '/';

  // Ne jamais rediriger les chemins internes Firebase Auth (/__/auth/*)
  if (pathname.startsWith('/__/')) return null;

  // Rediriger uniquement les domaines génériques Firebase de production (hors -dev., localhost ou Capacitor)
  const isGenericFirebaseHost = host.endsWith('.web.app') || host.endsWith('.firebaseapp.com');
  const isDevHost = host.includes('-dev.');

  if (isGenericFirebaseHost && !isDevHost) {
    const cleanOrigin = canonicalOrigin.replace(/\/+$/, '');
    return `${cleanOrigin}${pathname}${locationObj.search || ''}${locationObj.hash || ''}`;
  }

  return null;
}
