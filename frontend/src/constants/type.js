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
