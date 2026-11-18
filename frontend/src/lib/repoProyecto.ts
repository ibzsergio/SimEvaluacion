export const REPO_PROYECTO_TITULO = "Repositorio Proyecto en GitHub";
export const REPO_PROYECTO_INSTRUCTIVO = "/Repositorio%20Proyecto%20en%20GitHub.pdf?v=2";
export const REPO_PROYECTO_PUNTOS = 3000;
export const REPO_PROYECTO_MS = 150 * 60 * 1000;
export const REPO_PROYECTO_PDF_MAX_BYTES = 8 * 1024 * 1024;
export const REPO_PROYECTO_DOCENTE = "ibzsergio";

export const REPO_PROYECTO_TABLAS = [
  "alumno",
  "docente",
  "directivo",
  "registro",
  "asistencia",
  "incidencias",
  "carta_compromiso",
  "historial",
];

export const REPO_PROYECTO_NOTAS_LIDER = [
  { code: "no_trabaja", label: "No está trabajando" },
  { code: "fuera", label: "Está fuera del equipo" },
  { code: "no_asistio", label: "No asistió" },
] as const;

export type RepoLeaderNote = {
  id: string;
  code: string;
  label: string;
  studentId: string;
  studentName: string;
  comment: string;
  at: string;
};

export const REPO_PROYECTO_NOTAS = [
  { code: "colaborador", label: "No agregaron a ibzsergio", points: 500 },
  { code: "sin_commit", label: "No tiene commit en el repositorio", points: 500 },
  { code: "no_clona", label: "No clonó el proyecto", points: 400 },
  { code: "crud", label: "El CRUD no guarda en la base de XAMPP", points: 500 },
  { code: "caratula", label: "Falta la carátula de Canva", points: 400 },
  { code: "commits", label: "No se ven los commits de los integrantes", points: 400 },
] as const;

export function repoAbierto(startedAt: string | null | undefined, now = Date.now()) {
  if (!startedAt) return false;
  return now < new Date(startedAt).getTime() + REPO_PROYECTO_MS;
}

export function repoRestante(startedAt: string | null | undefined, now = Date.now()) {
  if (!startedAt) return REPO_PROYECTO_MS;
  return Math.max(0, new Date(startedAt).getTime() + REPO_PROYECTO_MS - now);
}

export function formatoReloj(ms: number) {
  const total = Math.ceil(ms / 1000);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  return [hours, minutes, seconds].map((part) => String(part).padStart(2, "0")).join(":");
}
