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
  [TICKET_TYPE.INCIDENT]: '#fff0f0', // Rouge/Orange pastel doux
  [TICKET_TYPE.EVOLUTION]: '#edf5ff', // Bleu pastel doux
};

export const TICKET_TYPE_PASTEL_HOVER = {
  [TICKET_TYPE.INCIDENT]: '#fce0e0', // Rouge pastel au survol
  [TICKET_TYPE.EVOLUTION]: '#dbecfe', // Bleu pastel au survol
};

