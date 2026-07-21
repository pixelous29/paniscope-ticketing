export const TICKET_TYPE = {
  INCIDENT: 'incident',
  EVOLUTION: 'evolution',
};

export const TICKET_TYPE_LABEL = {
  [TICKET_TYPE.INCIDENT]: 'Incident',
  [TICKET_TYPE.EVOLUTION]: 'Évolution',
};

export const TICKET_TYPE_ICON = {
  [TICKET_TYPE.INCIDENT]: 'bi-exclamation-triangle-fill',
  [TICKET_TYPE.EVOLUTION]: 'bi-lightbulb-fill',
};

export const TICKET_TYPE_VARIANT = {
  [TICKET_TYPE.INCIDENT]: 'danger',
  [TICKET_TYPE.EVOLUTION]: 'primary',
};

export const TICKET_TYPE_PASTEL_BG = {
  [TICKET_TYPE.INCIDENT]: '#fee2e2', // Rouge/Orange pastel (red-100)
  [TICKET_TYPE.EVOLUTION]: '#dbeafe', // Bleu pastel (blue-100)
};

export const TICKET_TYPE_PASTEL_HOVER = {
  [TICKET_TYPE.INCIDENT]: '#fca5a5', 
  [TICKET_TYPE.EVOLUTION]: '#bfdbfe', 
};

export function getTicketPastelBg(type) {
  const norm = String(type || '').toLowerCase();
  if (norm.includes('evolution')) {
    return TICKET_TYPE_PASTEL_BG[TICKET_TYPE.EVOLUTION];
  }
  return TICKET_TYPE_PASTEL_BG[TICKET_TYPE.INCIDENT];
}


