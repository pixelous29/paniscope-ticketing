/**
 * Utilitaire de gestion et de catégorisation des utilisateurs.
 * Ce fichier regroupe les fonctions logiques de détermination des types d'utilisateurs.
 */

const SUPER_ADMIN_EMAIL = 'yves@paniscope.fr';

/**
 * Liste des emails d'utilisateurs masqués / invisibles dans l'interface
 */
export const HIDDEN_USER_EMAILS = [
  'test-google@paniscope.fr'
];

/**
 * Vérifie si un utilisateur doit être masqué de l'interface.
 * 
 * @param {Object} user - L'objet utilisateur Firestore
 * @returns {boolean}
 */
export function isUserHidden(user) {
  if (!user) return false;
  if (user.hidden === true) return true;
  const email = (user.email || '').toLowerCase().trim();
  return HIDDEN_USER_EMAILS.some(hiddenEmail => hiddenEmail.toLowerCase() === email);
}

/**
 * Détermine dynamiquement si un utilisateur est 'internal' (Membre de l'équipe Paniscope)
 * ou 'client' (Client externe).
 * 
 * Règle métier :
 * Est considéré comme 'internal' :
 * - Le Super Admin (yves@paniscope.fr)
 * - Les rôles 'manager' et 'developer'
 * - Toute personne dont la société est 'Paniscope' ou le domaine 'paniscope.fr'
 * 
 * @param {Object} user - L'objet utilisateur Firestore
 * @returns {'internal' | 'client'} Le type de l'utilisateur
 */
export function getUserType(user) {
  if (!user) return 'client';

  const email = (user.email || '').toLowerCase().trim();
  const role = user.role || 'client';
  const company = (user.company || '').toLowerCase().trim();
  const companyDomain = (user.companyDomain || '').toLowerCase().trim();

  if (
    email === SUPER_ADMIN_EMAIL.toLowerCase() ||
    role === 'manager' ||
    role === 'developer' ||
    company === 'paniscope' ||
    companyDomain === 'paniscope.fr'
  ) {
    return 'internal';
  }

  return 'client';
}

/**
 * Retourne la configuration visuelle (libellé, variante Bootstrap, icône) pour le badge du type d'utilisateur.
 * 
 * @param {'internal' | 'client'} userType 
 * @returns {{ label: string, variant: string, icon: string }}
 */
export function getUserTypeBadgeConfig(userType) {
  if (userType === 'internal') {
    return {
      label: 'Paniscope',
      variant: 'primary',
      icon: 'bi-building-fill-gear'
    };
  }

  return {
    label: 'Client',
    variant: 'secondary',
    icon: 'bi-person-badge'
  };
}
