export type SkillRole =
  | "scrum_master"
  | "product_owner"
  | "developer"
  | "ui_designer"
  | "qa_docs";

export type SkillDimension =
  | "scrumMaster"
  | "productOwner"
  | "developer"
  | "uiDesigner"
  | "qaDocs";

export const SKILL_ROLE_LABELS: Record<SkillRole, string> = {
  scrum_master: "Scrum Master (organización del equipo)",
  product_owner: "Product Owner / Analista (requisitos y prioridades)",
  developer: "Desarrollador (lógica y programación)",
  ui_designer: "Diseño / Interfaz (pantallas y usabilidad)",
  qa_docs: "Calidad y documentación (pruebas y manuales)",
};

export const SKILL_DIMENSION_LABELS: Record<SkillDimension, string> = {
  scrumMaster: "Organización y liderazgo",
  productOwner: "Análisis y comunicación",
  developer: "Resolver problemas con código",
  uiDesigner: "Diseño de pantallas",
  qaDocs: "Pruebas y documentación",
};

export type SurveyQuestion = {
  id: string;
  dimension: SkillDimension;
  text: string;
};

/** Escala: 1 = Nada / no me identifica · 5 = Mucho / me identifica mucho */
export const SKILL_SURVEY_QUESTIONS: SurveyQuestion[] = [
  // Scrum Master
  { id: "q1", dimension: "scrumMaster", text: "Me gusta organizar tareas y que todos sepan qué sigue." },
  { id: "q2", dimension: "scrumMaster", text: "Puedo recordar fechas y ayudar a que el equipo no se atrase." },
  { id: "q3", dimension: "scrumMaster", text: "En un trabajo en equipo, suelo ser quien coordina o motiva." },
  { id: "q4", dimension: "scrumMaster", text: "Me siento cómodo(a) cuando hay que repartir responsabilidades." },
  { id: "q5", dimension: "scrumMaster", text: "Si hay un conflicto o retraso, busco soluciones con calma." },
  { id: "q6", dimension: "scrumMaster", text: "Me interesa aprender a trabajar con sprints, roles y un tablero de avances." },

  // Product Owner
  { id: "q7", dimension: "productOwner", text: "Se me facilita explicar una idea con claridad a otras personas." },
  { id: "q8", dimension: "productOwner", text: "Puedo escuchar lo que se necesita y convertirlo en una lista de lo que hay que hacer." },
  { id: "q9", dimension: "productOwner", text: "Me gusta decidir qué es más importante entregar primero." },
  { id: "q10", dimension: "productOwner", text: "Disfruto presentar avances frente al grupo o al docente." },
  { id: "q11", dimension: "productOwner", text: "Pienso en el usuario final: qué le sería útil y fácil." },
  { id: "q12", dimension: "productOwner", text: "Puedo negociar o acordar cambios cuando el plan original no alcanza." },

  // Developer
  { id: "q13", dimension: "developer", text: "Disfruto resolver problemas paso a paso con la computadora." },
  { id: "q14", dimension: "developer", text: "Cuando algo no funciona, me da curiosidad encontrar por qué y corregirlo." },
  { id: "q15", dimension: "developer", text: "Me gusta aprender lenguajes o herramientas nuevas de programación." },
  { id: "q16", dimension: "developer", text: "Puedo seguir instrucciones técnicas y armar una solución lógica." },
  { id: "q17", dimension: "developer", text: "Me interesa que los datos se guarden bien y se puedan consultar después." },
  { id: "q18", dimension: "developer", text: "Prefiero dedicar tiempo a hacer que el sistema funcione correctamente por dentro." },

  // UI Designer
  { id: "q19", dimension: "uiDesigner", text: "Me importa que una pantalla se vea ordenada y agradable." },
  { id: "q20", dimension: "uiDesigner", text: "Me gusta proponer cómo deben verse botones, menús y formularios." },
  { id: "q21", dimension: "uiDesigner", text: "Noto rápido cuando algo se ve confuso o desordenado." },
  { id: "q22", dimension: "uiDesigner", text: "Disfruto mejorar la apariencia de un trabajo (colores, espacio, tipografía)." },
  { id: "q23", dimension: "uiDesigner", text: "Puedo imaginar un boceto de cómo debería verse una ventana del sistema." },
  { id: "q24", dimension: "uiDesigner", text: "Me interesa que sea fácil de usar, no solo que “funcione”." },

  // QA / Docs
  { id: "q25", dimension: "qaDocs", text: "Soy detallista: reviso que no falten pasos o datos." },
  { id: "q26", dimension: "qaDocs", text: "Me gusta probar las cosas varias veces para encontrar fallos." },
  { id: "q27", dimension: "qaDocs", text: "Se me da escribir instrucciones claras para que otros entiendan." },
  { id: "q28", dimension: "qaDocs", text: "Llevo registro de pendientes, cambios o lo que ya se entregó." },
  { id: "q29", dimension: "qaDocs", text: "Prefiero revisar el trabajo del equipo antes de decir que ya está listo." },
  { id: "q30", dimension: "qaDocs", text: "Me gusta documentar con capturas, listas o un manual sencillo." },
];

const DIMENSION_TO_ROLE: Record<SkillDimension, SkillRole> = {
  scrumMaster: "scrum_master",
  productOwner: "product_owner",
  developer: "developer",
  uiDesigner: "ui_designer",
  qaDocs: "qa_docs",
};

export type SkillScores = Record<SkillDimension, number>;

export function emptyScores(): SkillScores {
  return {
    scrumMaster: 0,
    productOwner: 0,
    developer: 0,
    uiDesigner: 0,
    qaDocs: 0,
  };
}

export function scoreSkillSurvey(answers: Record<string, number>): {
  scores: SkillScores;
  suggestedRole: SkillRole;
  maxPerDimension: number;
} {
  const scores = emptyScores();
  const counts: SkillScores = emptyScores();

  for (const q of SKILL_SURVEY_QUESTIONS) {
    const raw = answers[q.id];
    const value = Math.max(1, Math.min(5, Math.round(Number(raw) || 0)));
    if (!Number.isFinite(Number(raw)) || Number(raw) < 1) continue;
    scores[q.dimension] += value;
    counts[q.dimension] += 1;
  }

  let best: SkillDimension = "developer";
  let bestScore = -1;
  for (const dim of Object.keys(scores) as SkillDimension[]) {
    if (scores[dim] > bestScore) {
      bestScore = scores[dim];
      best = dim;
    }
  }

  return {
    scores,
    suggestedRole: DIMENSION_TO_ROLE[best],
    maxPerDimension: 30, // 6 preguntas × 5
  };
}

export function buildProfilePayload(
  answers: Record<string, number>,
  scores: SkillScores,
  suggestedRole: SkillRole,
) {
  const dimensions = (Object.keys(SKILL_DIMENSION_LABELS) as SkillDimension[]).map((key) => ({
    key,
    label: SKILL_DIMENSION_LABELS[key],
    score: scores[key] ?? 0,
    max: 30,
    percent: Math.round(((scores[key] ?? 0) / 30) * 100),
  }));
  dimensions.sort((a, b) => b.score - a.score);

  return {
    suggestedRole,
    suggestedRoleLabel: SKILL_ROLE_LABELS[suggestedRole],
    dimensions,
    answers,
    scores,
  };
}

/** Roles preferidos en equipos de 5; en equipos de 4 se omite qa_docs si hace falta. */
export const TEAM_ROLE_ORDER: SkillRole[] = [
  "scrum_master",
  "product_owner",
  "developer",
  "ui_designer",
  "qa_docs",
];
