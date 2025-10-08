export const STATUS = {
  NEW: 'Nouveau',
  IN_PROGRESS: 'En cours',
  PENDING: 'En attente',
  PENDING_VALIDATION: 'En attente de validation',
  CLOSED: 'Ticket Clôturé',
};

export const STATUS_VARIANT = {
  [STATUS.NEW]: 'primary',
  [STATUS.IN_PROGRESS]: 'warning',
  [STATUS.PENDING]: 'info',
  [STATUS.PENDING_VALIDATION]: 'secondary',
  [STATUS.CLOSED]: 'success',
};

