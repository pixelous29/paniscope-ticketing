export const DEV_PHASE = {
  PLANNING: "PLANNING",
  DEVELOPMENT: "DEVELOPMENT",
  TESTING: "TESTING",
  READY_FOR_DEPLOY: "READY_FOR_DEPLOY",
};

export const DEV_PHASE_LABELS = {
  [DEV_PHASE.PLANNING]: "Planification / Étude",
  [DEV_PHASE.DEVELOPMENT]: "Conception / Dév",
  [DEV_PHASE.TESTING]: "Prêt pour Test",
  [DEV_PHASE.READY_FOR_DEPLOY]: "Ok Déploiement",
};

export const DEV_PHASE_COLORS = {
  [DEV_PHASE.PLANNING]: "#6c757d", // secondary (gris)
  [DEV_PHASE.DEVELOPMENT]: "#0d6efd", // primary (bleu)
  [DEV_PHASE.TESTING]: "#ffc107", // warning (jaune)
  [DEV_PHASE.READY_FOR_DEPLOY]: "#198754", // success (vert)
};

export const DEV_PHASES_ORDER = [
  DEV_PHASE.PLANNING,
  DEV_PHASE.DEVELOPMENT,
  DEV_PHASE.TESTING,
  DEV_PHASE.READY_FOR_DEPLOY,
];
