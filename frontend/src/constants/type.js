export const TICKET_TYPE = {
  INCIDENT: 'incident',
  EVOLUTION: 'evolution',
  QUESTION: 'question',
};

export const TICKET_TYPE_LABEL = {
  [TICKET_TYPE.INCIDENT]: 'Incident / Bug',
  [TICKET_TYPE.EVOLUTION]: 'Évolution / Feature',
  [TICKET_TYPE.QUESTION]: 'Simple question',
};

export const TICKET_TYPE_ICON = {
  [TICKET_TYPE.INCIDENT]: 'bi-exclamation-triangle-fill',
  [TICKET_TYPE.EVOLUTION]: 'bi-lightbulb-fill',
  [TICKET_TYPE.QUESTION]: 'bi-question-circle-fill',
};

export const TICKET_TYPE_VARIANT = {
  [TICKET_TYPE.INCIDENT]: 'danger',
  [TICKET_TYPE.EVOLUTION]: 'primary',
  [TICKET_TYPE.QUESTION]: 'secondary',
};

export const TICKET_TYPE_PASTEL_BG = {
  [TICKET_TYPE.INCIDENT]: '#fee2e2', // Rouge/Orange pastel (red-100)
  [TICKET_TYPE.EVOLUTION]: '#dbeafe', // Bleu pastel (blue-100)
  [TICKET_TYPE.QUESTION]: '#f3f4f6',  // Gris pastel (gray-100)
};

export const TICKET_TYPE_PASTEL_HOVER = {
  [TICKET_TYPE.INCIDENT]: '#fca5a5', 
  [TICKET_TYPE.EVOLUTION]: '#bfdbfe', 
  [TICKET_TYPE.QUESTION]: '#e5e7eb',
};

export function getTicketPastelBg(type) {
  const norm = String(type || '').toLowerCase();
  if (norm === 'evolution') {
    return TICKET_TYPE_PASTEL_BG[TICKET_TYPE.EVOLUTION];
  }
  if (norm === 'incident') {
    return TICKET_TYPE_PASTEL_BG[TICKET_TYPE.INCIDENT];
  }
  if (norm === 'question') {
    return TICKET_TYPE_PASTEL_BG[TICKET_TYPE.QUESTION];
  }
  return null;
}


