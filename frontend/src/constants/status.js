export const STATUS = {
  NEW: "Nouveau",
  IN_PROGRESS: "En cours",
  PENDING: "En attente",
  PENDING_VALIDATION: "En attente de validation",
  CLOSED: "Ticket Clôturé",
};

export const STATUS_VARIANT = {
  [STATUS.NEW]: "primary",
  [STATUS.IN_PROGRESS]: "warning",
  [STATUS.PENDING]: "info",
  [STATUS.PENDING_VALIDATION]: "secondary",
  [STATUS.CLOSED]: "success",
};

export const STATUS_DESCRIPTION = {
  client: {
    [STATUS.NEW]:
      "Votre demande a été créée et est en attente de prise en charge.",
    [STATUS.IN_PROGRESS]:
      "Notre équipe travaille actuellement sur votre demande.",
    [STATUS.PENDING]:
      "L'équipe support a répondu et attend une action ou un retour de votre part.",
    [STATUS.PENDING_VALIDATION]:
      "Une solution a été déployée, en attente de votre validation finale.",
    [STATUS.CLOSED]: "Le ticket est résolu et définitivement archivé.",
  },
  manager: {
    [STATUS.NEW]:
      "Nouveau ticket, en attente d'assignation ou de prise en charge.",
    [STATUS.IN_PROGRESS]:
      "Ticket pris en charge et en cours de traitement par l'équipe.",
    [STATUS.PENDING]:
      "En attente d'une action ou d'une réponse de la part du client.",
    [STATUS.PENDING_VALIDATION]:
      "En attente de la validation finale par le client.",
    [STATUS.CLOSED]: "Ticket résolu et archivé.",
  },
  developer: {
    [STATUS.NEW]: "Nouveau ticket, non démarré.",
    [STATUS.IN_PROGRESS]: "Ticket en cours de développement/traitement.",
    [STATUS.PENDING]: "En attente d'un retour client/manager.",
    [STATUS.PENDING_VALIDATION]:
      "Développement terminé, en attente de validation client.",
    [STATUS.CLOSED]: "Ticket fermé.",
  },
};
