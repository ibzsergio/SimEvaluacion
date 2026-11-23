export const REPO_PROYECTO_TITULO = "Repositorio Proyecto en GitHub";
export const REPO_PROYECTO_INSTRUCTIVO = "/Repositorio%20Proyecto%20en%20GitHub.pdf?v=7";
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
  { code: "no_asistio", label: "No asistió" },
  { code: "no_lugar", label: "No está en su lugar de trabajo" },
  { code: "jugando", label: "Está jugando" },
  { code: "fuera", label: "Está fuera del equipo" },
  { code: "otra", label: "Otra situación" },
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

export function repoCierre(groupCode: string | null | undefined) {
  if (groupCode?.trim() === "301") {
    return "Después de la 1:00 p. m. de hoy, lunes 23 de noviembre, ya no se permite subir el PDF.";
  }
  return "Esta entrega no está abierta para este grupo.";
}

const HORARIO_301 = [
  {
    until: "2026-11-23T13:00:00-06:00",
    points: 3000,
    texto: "Si lo suben hoy, lunes 23 de noviembre, hasta la 1:00 p. m. y cumplen con todo, la máxima es 3000.",
  },
] as const;

const TRAMOS = { "301": HORARIO_301, "302": [] as const };

export function repoTramos(groupCode: string | null | undefined) {
  const code = groupCode?.trim();
  if (code === "301" || code === "302") return TRAMOS[code];
  return [];
}

export function repoEntrega(groupCode: string | null | undefined, at: number | string = Date.now()) {
  const ms = typeof at === "number" ? at : new Date(at).getTime();
  for (const tramo of repoTramos(groupCode)) {
    if (ms < new Date(tramo.until).getTime()) return { open: true, points: tramo.points };
  }
  return { open: false, points: 0 };
}

export function formatoHoraClase(at: number | string) {
  return new Date(at).toLocaleTimeString("es-MX", { hour: "numeric", minute: "2-digit", hour12: true });
}

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
