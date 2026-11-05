export const STATUS = {
  NEW: "Nouveau",
  IN_PROGRESS: "En cours",
  PENDING: "En attente",
  PENDING_VALIDATION: "En attente de validation",
  VALIDATED: "Validé - Prêt pour clôture",
  CLOSED: "Ticket Clôturé",
};

export const STATUS_VARIANT = {
  [STATUS.NEW]: "primary",
  [STATUS.IN_PROGRESS]: "primary",
  [STATUS.PENDING]: "warning",
  [STATUS.PENDING_VALIDATION]: "info",
  [STATUS.VALIDATED]: "success",
  [STATUS.CLOSED]: "secondary",
};

export const STATUS_LABEL = {
  client: {
    [STATUS.NEW]: "Nouveau",
    [STATUS.IN_PROGRESS]: "En cours de traitement",
    [STATUS.PENDING]: "🟠 En attente de votre retour",
    [STATUS.PENDING_VALIDATION]: "⏳ En attente de votre validation",
    [STATUS.VALIDATED]: "✅ Validé (Clôture en cours)",
    [STATUS.CLOSED]: "Ticket Clôturé",
  },
  manager: {
    [STATUS.NEW]: "🟣 Nouveau (À traiter)",
    [STATUS.IN_PROGRESS]: "🔵 À traiter (Paniscope)",
    [STATUS.PENDING]: "🟠 Attente retour client",
    [STATUS.PENDING_VALIDATION]: "⏳ Attente validation client",
    [STATUS.VALIDATED]: "✅ OK pour clôture",
    [STATUS.CLOSED]: "🔒 Ticket Clôturé",
  },
  developer: {
    [STATUS.NEW]: "🟣 Nouveau (À traiter)",
    [STATUS.IN_PROGRESS]: "🔵 À traiter (Paniscope)",
    [STATUS.PENDING]: "🟠 Attente retour client",
    [STATUS.PENDING_VALIDATION]: "⏳ Attente validation client",
    [STATUS.VALIDATED]: "✅ OK pour clôture",
    [STATUS.CLOSED]: "🔒 Ticket Clôturé",
  },
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
    [STATUS.VALIDATED]:
      "Vous avez validé la résolution. Notre équipe va procéder à la clôture du ticket.",
    [STATUS.CLOSED]: "Le ticket est résolu et définitivement archivé.",
  },
  manager: {
    [STATUS.NEW]:
      "Nouveau ticket, en attente d'assignation ou de prise en charge.",
    [STATUS.IN_PROGRESS]:
      "Ticket dans le camp de Paniscope (en cours de traitement par l'équipe).",
    [STATUS.PENDING]:
      "En attente d'une action ou d'une réponse de la part du client.",
    [STATUS.PENDING_VALIDATION]:
      "En attente de la validation finale par le client.",
    [STATUS.VALIDATED]:
      "Le client a validé les travaux. Le ticket peut être clôturé.",
    [STATUS.CLOSED]: "Ticket résolu et clôturé.",
  },
  developer: {
    [STATUS.NEW]: "Nouveau ticket, non démarré.",
    [STATUS.IN_PROGRESS]: "Ticket dans le camp de Paniscope (en cours de développement/traitement).",
    [STATUS.PENDING]: "En attente d'un retour du client.",
    [STATUS.PENDING_VALIDATION]:
      "Développement terminé, en attente de validation par le client.",
    [STATUS.VALIDATED]:
      "Le client a validé les travaux ! Ce ticket est prêt à être clôturé.",
    [STATUS.CLOSED]: "Ticket fermé.",
  },
};

/**
 * Détecte si un ticket au statut "En cours" contient déjà une validation finale du client
 * (pour migrer automatiquement les tickets validés avant l'introduction de STATUS.VALIDATED).
 */
export function shouldAutoHealToValidated(ticket) {
  if (!ticket || ticket.status !== STATUS.IN_PROGRESS) return false;
  if (!Array.isArray(ticket.conversation) || ticket.conversation.length === 0) return false;

  const sorted = [...ticket.conversation].sort((a, b) => {
    const timeA = a.timestamp?.toMillis ? a.timestamp.toMillis() : new Date(a.timestamp || 0).getTime();
    const timeB = b.timestamp?.toMillis ? b.timestamp.toMillis() : new Date(b.timestamp || 0).getTime();
    return timeA - timeB;
  });

  let lastValidationIdx = -1;
  let lastReopenOrResetIdx = -1;

  sorted.forEach((msg, idx) => {
    const text = msg.text || "";
    if (text.includes("Validation client :") && text.includes("J'ai validé les travaux")) {
      lastValidationIdx = idx;
    } else if (
      text.includes("Ticket réouvert") ||
      text.includes("Clôture automatique") ||
      text.includes("Ticket clôturé")
    ) {
      lastReopenOrResetIdx = idx;
    }
  });

  return lastValidationIdx !== -1 && lastValidationIdx > lastReopenOrResetIdx;
}

