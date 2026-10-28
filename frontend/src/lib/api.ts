import axios from "axios";
import { IMPRO_FIRMAS_MAX } from "./improScrum";
import {
  POPUP_ANNOUNCEMENT_TITLE,
  POPUP_GRADE_NAME,
  improSessionFromProjectTeams,
  interfaceSessionAsExtra,
  noteFromPreset,
  popupGradeRows,
  popupStateFromAnnouncements,
  serializePopupState,
  withTeamNames,
  type PopupLiveState,
} from "./popupLive";
import type {
  Activity,
  ClassGroup,
  ClassDaySheet,
  GradeRow,
  GradesMatrix,
  ImportResult,
  ImportWorkbookResult,
  GroupRanking,
  GroupWeeks,
  PartialSummary,
  SeatingMode,
  SeatingPlan,
  SeatingTheme,
  OfficeExamTeacherData,
  OfficeExamState,
  StudentCommsData,
  StudentProgress,
  TeacherCommsData,
  User,
  ListasF1Preview,
  LecturaSession,
  TorreSession,
  AvionSession,
  StudentTorre,
  StudentAvion,
  StudentLectura,
  SkillRole,
} from "./types";

/** Normaliza VITE_API_URL (sin barra final ni sufijo /api de desarrollo). */
export function getApiBaseUrl(): string {
  let raw = import.meta.env.VITE_API_URL?.trim();
  if (!raw) return "/api";
  // Error frecuente en Netlify: pegar "VITE_API_URL=https://..." como valor.
  raw = raw.replace(/^VITE_API_URL\s*=\s*/i, "").trim();
  const httpMatch = raw.match(/https?:\/\/[^\s]+/);
  if (httpMatch) raw = httpMatch[0];
  let url = raw.replace(/\/$/, "");
  if (url.endsWith("/api")) url = url.slice(0, -4);
  return url;
}

const baseURL = getApiBaseUrl();

export function getApiErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    if (!error.response) {
      return "No se pudo conectar al servidor. Verifica que el backend esté en ejecución (puerto 4000).";
    }
    const code = error.response.data?.error;
    if (code === "invalid_body") {
      return "Datos inválidos. Revisa los campos.";
    }
    if (code === "password_mismatch") return "Las contraseñas no coinciden.";
    if (code === "password_already_set") return "Este alumno ya tiene contraseña. Inicia sesión.";
    if (code === "password_not_set") return "Primera vez: crea tu contraseña abajo.";
    if (code === "group_id_required") return "Selecciona un grupo.";
    if (code === "file_required") return "Selecciona un archivo Excel (.xlsx).";
    if (code === "no_sheets_matched") {
      return (
        (error.response.data as { message?: string })?.message ??
        "Nombra las hojas del Excel con el código de cada grupo (ej. 301 y 302, o Grupo 301)."
      );
    }
    if (code === "empty_file") {
      return (
        (error.response.data as { message?: string })?.message ??
        "El archivo no tiene alumnos válidos."
      );
    }
    if (code === "invalid_token" || code === "missing_token") {
      return "Sesión expirada. Vuelve a iniciar sesión.";
    }
    if (code === "invalid_credentials") return "Usuario o contraseña incorrectos.";
    if (code === "preview_readonly") {
      return (
        (error.response.data as { message?: string })?.message ??
        "La cuenta de prueba solo sirve para ver la plataforma."
      );
    }
    if (code === "student_not_found") {
      return (
        (error.response.data as { message?: string })?.message ??
        "Número de control no encontrado."
      );
    }
    if (code === "partial_closed") {
      return (error.response.data as { message?: string })?.message ?? "El parcial está cerrado.";
    }
    if (code === "partial_limit") {
      return (
        (error.response.data as { message?: string })?.message ??
        "Ya estás en el último parcial disponible."
      );
    }
    if (code === "partial_not_closed") {
      return (
        (error.response.data as { message?: string })?.message ??
        "El diploma estará disponible cuando el docente cierre el parcial y active los diplomas."
      );
    }
    if (code === "diploma_not_enabled") {
      return (
        (error.response.data as { message?: string })?.message ??
        "El docente está validando calificaciones. El diploma se habilitará cuando lo autorice."
      );
    }
    if (code === "diploma_requires_close") {
      return (
        (error.response.data as { message?: string })?.message ??
        "Cierra el parcial y valida las calificaciones antes de activar diplomas."
      );
    }
    if (code === "group_not_found") {
      return "No se encontró el grupo. Cierra sesión, vuelve a entrar y selecciona tu grupo.";
    }
    if (code === "invalid_confirm_phrase") {
      return "Escribe exactamente NUEVO SEMESTRE para confirmar.";
    }
    if (code === "group_already_exists") {
      return "Ya existe un grupo con ese código.";
    }
    if (code === "calendar_not_found") {
      return "No hay calendario escolar publicado.";
    }
    if (code === "listas_f1_not_found") {
      return (
        (error.response.data as { message?: string })?.message ??
        "No se encontró la plantilla LISTAS F1 en el servidor."
      );
    }
    if (code === "activity_not_found") {
      return "No se encontró la actividad. Recarga la página e inténtalo de nuevo.";
    }
    if (code === "class_day_not_ready") {
      return (
        (error.response.data as { message?: string })?.message ??
        "Asistencia no está lista en la base de datos. Espera 1 minuto y recarga."
      );
    }
    if (code === "class_day_failed") {
      const message = (error.response.data as { message?: string })?.message;
      return message ?? "No se pudo guardar el pase de lista.";
    }
    if (code === "incomplete_answers") {
      return "Contesta todas las preguntas de la encuesta (1 a 5).";
    }
    if (code === "not_enough_completed") {
      return (
        (error.response.data as { message?: string })?.message ??
        "Asigna rol a por lo menos 4 alumnos para sugerir equipos."
      );
    }
    if (code === "extra_failed") {
      return (
        (error.response.data as { message?: string })?.message ??
        "No se pudo actualizar Plan de Acción Proyecto."
      );
    }
    if (code === "invalid_team_size") {
      return "Cada equipo debe tener 4 a 6 integrantes. En 302: de 5, y un equipo de 6.";
    }
    if (code === "student_already_in_team") {
      return "Uno o más alumnos ya están en otro equipo.";
    }
    if (code === "seating_not_ready") {
      return (
        (error.response.data as { message?: string })?.message ??
        "Butacas aún no está listo en el servidor. Espera 1–2 minutos tras el despliegue en Railway."
      );
    }
    if (code === "seating_failed") {
      const detail = (error.response.data as { detail?: string })?.detail;
      return detail
        ? `Error en butacas: ${detail}`
        : "No se pudo guardar el acomodo de butacas. Inténtalo de nuevo.";
    }
    if (code === "no_teams") {
      return (
        (error.response.data as { message?: string })?.message ??
        "No hay equipos con alumnos activos. Asigna butacas primero."
      );
    }
    if (code === "not_leader") {
      return (
        (error.response.data as { message?: string })?.message ??
        "Solo el líder del equipo puede activar el reloj."
      );
    }
    if (code === "paused") {
      return (
        (error.response.data as { message?: string })?.message ??
        "El docente pausó el reto. El reloj está congelado."
      );
    }
    if (code === "already_started") {
      return (
        (error.response.data as { message?: string })?.message ??
        "El reloj ya está corriendo. Ya no se puede cambiar de líder."
      );
    }
    if (code === "invalid_leader") {
      return (
        (error.response.data as { message?: string })?.message ??
        "Elige a alguien de tu mismo equipo."
      );
    }
    if (code === "not_released") {
      return (
        (error.response.data as { message?: string })?.message ??
        "El docente aún no libera la actividad."
      );
    }
    if (code === "not_ready") {
      return (
        (error.response.data as { message?: string })?.message ??
        "Todavía no terminan el reloj todos los equipos."
      );
    }
    if (code === "topic_required") {
      return (
        (error.response.data as { message?: string })?.message ??
        "Escribe el tema principal de la semana."
      );
    }
    if (code === "not_found") {
      const path = (error.response.data as { path?: string })?.path;
      if (path?.includes("torre-pause")) {
        return "El servidor todavía está actualizando la pausa. Recarga en 1 o 2 minutos. Los relojes ya están congelados en la base de datos.";
      }
      if (path?.includes("impro")) {
        return "No se pudo guardar Pop-Up. Recarga la página e inténtalo de nuevo.";
      }
      return (
        "Esa función aún no está en el servidor (Railway está desplegando). Espera 1 o 2 minutos y recarga. " +
        `Base: ${getApiBaseUrl()}`
      );
    }
    if (error.response.status === 404) {
      const message = (error.response.data as { message?: string })?.message;
      if (message) return message;
      return `No encontrado (404). Si persiste, recarga la página o vuelve a iniciar sesión.`;
    }
    if (error.response.status >= 500) {
      const message = (error.response.data as { message?: string })?.message;
      const detail = (error.response.data as { detail?: string })?.detail;
      if (message && detail) return `${message} (${detail})`;
      if (message) return message;
      if (detail) return detail;
    }
    const message = (error.response.data as { message?: string })?.message;
    if (message) return message;
    return `Error del servidor (${error.response.status}).`;
  }
  if (error instanceof Error && error.message) return error.message;
  return "Ocurrió un error inesperado.";
}

export const api = axios.create({ baseURL });

const AUTH_STORAGE_KEY = "simeval_auth";

function tokenFromStorage(): string | null {
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { token?: string };
    return parsed.token?.trim() || null;
  } catch {
    return null;
  }
}

export function setAuthToken(token: string | null) {
  if (token) api.defaults.headers.common.Authorization = `Bearer ${token}`;
  else delete api.defaults.headers.common.Authorization;
}

api.interceptors.request.use((config) => {
  const header = config.headers.Authorization;
  if (!header) {
    const token = tokenFromStorage();
    if (token) config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

let refreshInFlight: Promise<string | null> | null = null;

function persistAuthToken(token: string, user?: User) {
  setAuthToken(token);
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY);
    const prev = raw ? (JSON.parse(raw) as { token?: string; user?: User }) : {};
    localStorage.setItem(
      AUTH_STORAGE_KEY,
      JSON.stringify({ token, user: user ?? prev.user }),
    );
  } catch {
    /* ignore */
  }
}

function renewAuthToken(): Promise<string | null> {
  if (!refreshInFlight) {
    refreshInFlight = api
      .post<{ token: string; user: User }>("/auth/refresh")
      .then(({ data }) => {
        persistAuthToken(data.token, data.user);
        return data.token;
      })
      .catch(() => null)
      .finally(() => {
        refreshInFlight = null;
      });
  }
  return refreshInFlight;
}

api.interceptors.response.use(
  (response) => response,
  async (error: unknown) => {
    if (!axios.isAxiosError(error) || !error.config) return Promise.reject(error);
    const original = error.config as typeof error.config & { _retry?: boolean };
    if (error.response?.status !== 401) return Promise.reject(error);
    if (original._retry) return Promise.reject(error);
    if (original.url?.includes("/auth/refresh") || original.url?.includes("/auth/login")) {
      return Promise.reject(error);
    }
    original._retry = true;
    const stored = tokenFromStorage();
    if (stored) {
      original.headers = original.headers ?? {};
      original.headers.Authorization = `Bearer ${stored}`;
      setAuthToken(stored);
    }
    const renewed = await renewAuthToken();
    if (renewed) {
      original.headers = original.headers ?? {};
      original.headers.Authorization = `Bearer ${renewed}`;
      return api.request(original);
    }
    if (stored) return api.request(original);
    return Promise.reject(error);
  },
);

export async function refreshAuthSession() {
  const { data } = await api.post<{ token: string; user: User }>("/auth/refresh");
  return data;
}

export async function loginTeacher(email: string, password: string) {
  const { data } = await api.post<{ token: string; user: User }>("/auth/login/teacher", {
    email,
    password,
  });
  return data;
}

export async function loginStudent(controlNumber: string, password?: string) {
  const payload: { controlNumber: string; password?: string } = {
    controlNumber: controlNumber.trim().replace(/\s/g, ""),
  };
  if (password && password.trim().length >= 4) {
    payload.password = password.trim();
  }
  const { data } = await api.post<{ token: string; user: User }>("/auth/login/student", payload);
  return data;
}

export type PasswordNotSetResponse = {
  error: "password_not_set";
  student: { controlNumber: string; displayName: string };
};

export function isPasswordNotSetError(error: unknown): error is { response: { data: PasswordNotSetResponse } } {
  return (
    axios.isAxiosError(error) &&
    error.response?.status === 403 &&
    error.response?.data?.error === "password_not_set"
  );
}

export async function createStudentPassword(
  controlNumber: string,
  password: string,
  confirmPassword: string,
) {
  const { data } = await api.post<{ token: string; user: User }>("/auth/student/create-password", {
    controlNumber,
    password,
    confirmPassword,
  });
  return data;
}

export async function devSeed() {
  const { data } = await api.post("/auth/dev-seed");
  return data;
}

export async function fetchGroups() {
  const { data } = await api.get<{ groups: ClassGroup[] }>("/teacher/groups");
  return data.groups;
}

export async function fetchPreviewStudent() {
  const { data } = await api.get<{
    controlNumber: string;
    password: string;
    displayName: string;
    groupCode: string;
  }>("/teacher/preview-student");
  return data;
}

export async function updateGroupProgressSettings(
  groupId: string,
  payload: { plannedActivities?: number | null; progressClosed?: boolean },
) {
  const { data } = await api.put<{ group: ClassGroup }>(`/teacher/groups/${groupId}/progress-settings`, payload);
  return data.group;
}

export async function updateGroupPartialSettings(groupId: string, payload: { partialClosed: boolean }) {
  const { data } = await api.put<{ group: ClassGroup }>(`/teacher/groups/${groupId}/partial-settings`, payload);
  return data.group;
}

export async function startNextPartial(groupId: string) {
  const { data } = await api.post<{ group: ClassGroup }>(
    `/teacher/groups/${groupId}/start-next-partial`,
  );
  return data.group;
}

export async function updateGroupDiplomaSettings(groupId: string, payload: { diplomaEnabled: boolean }) {
  const { data } = await api.put<{ group: ClassGroup }>(
    `/teacher/groups/${groupId}/diploma-settings`,
    payload,
  );
  return data.group;
}

export async function fetchLecturaSession(groupId: string) {
  const { data } = await api.get<LecturaSession>(`/teacher/groups/${groupId}/lectura-session`);
  return data;
}

export async function generateLecturaSession(groupId: string, payload: { topic: string }) {
  const { data } = await api.post<LecturaSession>(`/teacher/groups/${groupId}/lectura-generate`, payload);
  return data;
}

export async function updateGroupLecturaSettings(groupId: string, payload: { released: boolean }) {
  const { data } = await api.put<LecturaSession>(`/teacher/groups/${groupId}/lectura-settings`, payload);
  return data;
}

export async function resetLecturaSession(groupId: string) {
  const { data } = await api.post<LecturaSession>(`/teacher/groups/${groupId}/lectura-reset`);
  return data;
}

export async function chooseStudentLecturaLeader(leaderId: string) {
  const { data } = await api.post<{ lectura: StudentLectura | null }>("/student/lectura/leader", { leaderId });
  return data.lectura;
}

export async function startStudentLecturaTimer() {
  const { data } = await api.post<{ lectura: StudentLectura | null }>("/student/lectura/start");
  return data.lectura;
}

export async function fetchExtraSession(groupId: string) {
  const { data } = await api.get<import("./types").ExtraSession>(`/teacher/groups/${groupId}/extra-session`);
  return data;
}

export async function updateGroupExtraSettings(groupId: string, payload: { released: boolean }) {
  const { data } = await api.put<import("./types").ExtraSession>(
    `/teacher/groups/${groupId}/extra-settings`,
    payload,
  );
  return data;
}

export async function resetExtraSession(groupId: string) {
  const { data } = await api.post<import("./types").ExtraSession>(`/teacher/groups/${groupId}/extra-reset`);
  return data;
}

export async function setExtraPaused(groupId: string, paused: boolean) {
  const { data } = await api.post<import("./types").ExtraSession>(`/teacher/groups/${groupId}/extra-pause`, {
    paused,
  });
  return data;
}

export async function chooseStudentExtraLeader(leaderId: string) {
  const { data } = await api.post<{ extra: import("./types").StudentExtra | null }>(
    "/student/extra/leader",
    { leaderId },
  );
  return data.extra;
}

export async function startStudentExtraTimer() {
  const { data } = await api.post<{ extra: import("./types").StudentExtra | null }>("/student/extra/start");
  return data.extra;
}

export async function addExtraNote(
  groupId: string,
  payload: { teamKey: string; code: string; label?: string; points?: number; studentId?: string | null },
) {
  const { data } = await api.post<import("./types").ExtraSession>(
    `/teacher/groups/${groupId}/extra-note`,
    payload,
  );
  return data;
}

export async function removeExtraNote(groupId: string, payload: { teamKey: string; noteId: string }) {
  const { data } = await api.post<import("./types").ExtraSession>(
    `/teacher/groups/${groupId}/extra-note-remove`,
    payload,
  );
  return data;
}

function missingImproRoute(error: unknown) {
  if (!axios.isAxiosError(error) || error.response?.status !== 404) return false;
  const code = (error.response.data as { error?: string } | undefined)?.error;
  return code === "not_found";
}

async function projectTeamsForPopup(groupId: string) {
  try {
    const extra = await fetchExtraSession(groupId);
    if (extra.teams.length > 0) return extra;
  } catch (error) {
    if (!missingImproRoute(error) && axios.isAxiosError(error) && error.response?.status !== 404) {
      throw error;
    }
  }
  const design = await fetchInterfaceSession(groupId);
  return interfaceSessionAsExtra(design);
}

async function savePopupState(groupId: string, state: PopupLiveState) {
  const comms = await fetchTeacherComms();
  const previous = comms.announcements.filter(
    (item) => item.title === POPUP_ANNOUNCEMENT_TITLE && item.groupId === groupId,
  );
  await Promise.all(previous.map((item) => deleteAnnouncement(item.id)));
  await createAnnouncement({
    title: POPUP_ANNOUNCEMENT_TITLE,
    body: serializePopupState(state),
    groupId,
  });
}

async function popupSession(groupId: string, mutate?: (state: PopupLiveState) => PopupLiveState) {
  const [base, comms] = await Promise.all([projectTeamsForPopup(groupId), fetchTeacherComms()]);
  const current = popupStateFromAnnouncements(comms.announcements, groupId);
  const next = withTeamNames(mutate ? mutate(current) : current, base.teams);
  if (mutate) await savePopupState(groupId, next);
  return improSessionFromProjectTeams(base, next, true);
}

async function writePopupGrades(groupId: string, session: import("./types").ImproSession, teamKey?: string) {
  const rows = popupGradeRows(session, teamKey);
  if (rows.length === 0) return;
  const activities = await fetchActivities(groupId);
  let activity = activities.find((item) => item.name === POPUP_GRADE_NAME);
  if (!activity) {
    const now = new Date();
    const date = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    activity = await createActivity({
      groupId,
      date,
      name: POPUP_GRADE_NAME,
      maxPoints: IMPRO_FIRMAS_MAX,
    });
  }
  await saveGradesBatch(
    groupId,
    rows.map((row) => ({ activityId: activity.id, studentId: row.studentId, points: row.points })),
  );
}

export async function fetchImproSession(groupId: string) {
  try {
    const { data } = await api.get<import("./types").ImproSession>(`/teacher/groups/${groupId}/impro-session`);
    return data;
  } catch (error) {
    if (!missingImproRoute(error)) throw error;
    return popupSession(groupId);
  }
}

export async function updateGroupImproSettings(groupId: string, payload: { released: boolean }) {
  try {
    const { data } = await api.put<import("./types").ImproSession>(
      `/teacher/groups/${groupId}/impro-settings`,
      payload,
    );
    return data;
  } catch (error) {
    if (!missingImproRoute(error)) throw error;
    return popupSession(groupId, (state) => ({ ...state, released: payload.released }));
  }
}

export async function startImproTimers(groupId: string) {
  try {
    const { data } = await api.post<import("./types").ImproSession>(`/teacher/groups/${groupId}/impro-start`);
    return data;
  } catch (error) {
    if (!missingImproRoute(error)) throw error;
    return popupSession(groupId, (state) => ({
      ...state,
      released: true,
      pausedAt: null,
      startedAt: state.startedAt ?? new Date().toISOString(),
    }));
  }
}

export async function resetImproSession(groupId: string) {
  try {
    const { data } = await api.post<import("./types").ImproSession>(`/teacher/groups/${groupId}/impro-reset`);
    return data;
  } catch (error) {
    if (!missingImproRoute(error)) throw error;
    return popupSession(groupId, (state) => ({ ...state, startedAt: null, pausedAt: null }));
  }
}

export async function setImproPaused(groupId: string, paused: boolean) {
  try {
    const { data } = await api.post<import("./types").ImproSession>(`/teacher/groups/${groupId}/impro-pause`, {
      paused,
    });
    return data;
  } catch (error) {
    if (!missingImproRoute(error)) throw error;
    return popupSession(groupId, (state) => {
      if (paused) return { ...state, pausedAt: state.pausedAt ?? new Date().toISOString() };
      if (!state.pausedAt || !state.startedAt) return { ...state, pausedAt: null };
      const pauseMs = Math.max(0, Date.now() - new Date(state.pausedAt).getTime());
      return {
        ...state,
        pausedAt: null,
        startedAt: new Date(new Date(state.startedAt).getTime() + pauseMs).toISOString(),
      };
    });
  }
}

export async function chooseStudentImproLeader(leaderId: string) {
  const { data } = await api.post<{ impro: import("./types").StudentImpro | null }>("/student/impro/leader", {
    leaderId,
  });
  return data.impro;
}

export async function startStudentImproTimer() {
  const { data } = await api.post<{ impro: import("./types").StudentImpro | null }>("/student/impro/start");
  return data.impro;
}

export async function addImproNote(
  groupId: string,
  payload: { teamKey: string; code: string; label?: string; points?: number; studentId?: string | null },
) {
  try {
    const { data } = await api.post<import("./types").ImproSession>(`/teacher/groups/${groupId}/impro-note`, payload);
    return data;
  } catch (error) {
    if (!missingImproRoute(error)) throw error;
    const base = await projectTeamsForPopup(groupId);
    const team = base.teams.find((item) => item.key === payload.teamKey);
    if (!team) throw new Error("No encontré ese equipo de proyecto.");
    const note = noteFromPreset(payload.code, team, payload.studentId);
    if (payload.label) note.label = payload.label;
    if (payload.points != null) note.points = payload.points;
    return popupSession(groupId, (state) => ({
      ...state,
      notes: {
        ...state.notes,
        [payload.teamKey]: [...(state.notes[payload.teamKey] ?? []), note],
      },
    }));
  }
}

export async function removeImproNote(groupId: string, payload: { teamKey: string; noteId: string }) {
  try {
    const { data } = await api.post<import("./types").ImproSession>(
      `/teacher/groups/${groupId}/impro-note-remove`,
      payload,
    );
    return data;
  } catch (error) {
    if (!missingImproRoute(error)) throw error;
    return popupSession(groupId, (state) => ({
      ...state,
      notes: {
        ...state.notes,
        [payload.teamKey]: (state.notes[payload.teamKey] ?? []).filter((note) => note.id !== payload.noteId),
      },
    }));
  }
}

export async function applyImproFirmas(groupId: string, teamKey?: string) {
  try {
    const { data } = await api.post<import("./types").ImproSession>(
      `/teacher/groups/${groupId}/impro-award`,
      teamKey ? { teamKey } : {},
    );
    return data;
  } catch (error) {
    if (!missingImproRoute(error)) throw error;
    const preview = await popupSession(groupId);
    const keys = teamKey ? [teamKey] : preview.teams.map((team) => team.key);
    if (teamKey && !preview.teams.some((team) => team.key === teamKey)) {
      throw new Error("No encontré ese equipo de proyecto.");
    }
    const saved = await popupSession(groupId, (state) => ({
      ...state,
      released: true,
      awarded: [...new Set([...state.awarded, ...keys])],
    }));
    await writePopupGrades(groupId, saved, teamKey);
    return saved;
  }
}

export async function applyExtraFirmas(groupId: string, teamKey?: string) {
  const { data } = await api.post<import("./types").ExtraSession>(
    `/teacher/groups/${groupId}/extra-award`,
    teamKey ? { teamKey } : {},
  );
  return data;
}

export async function fetchTorreSession(groupId: string) {
  const { data } = await api.get<TorreSession>(`/teacher/groups/${groupId}/torre-session`);
  return data;
}

export async function updateGroupCompilerSettings(groupId: string, payload: { released: boolean }) {
  const { data } = await api.put<{ groupId: string; code: string; compilerReleased: boolean }>(
    `/teacher/groups/${groupId}/compiler-settings`,
    payload,
  );
  return data;
}

export async function updateGroupTorreSettings(groupId: string, payload: { released: boolean }) {
  const { data } = await api.put<TorreSession>(`/teacher/groups/${groupId}/torre-settings`, payload);
  return data;
}

export async function resetTorreSession(groupId: string) {
  const { data } = await api.post<TorreSession>(`/teacher/groups/${groupId}/torre-reset`);
  return data;
}

export async function setTorrePaused(groupId: string, paused: boolean) {
  const { data } = await api.post<TorreSession>(`/teacher/groups/${groupId}/torre-pause`, { paused });
  return data;
}

export async function chooseStudentTorreLeader(leaderId: string) {
  const { data } = await api.post<{ torre: StudentTorre | null }>("/student/torre/leader", { leaderId });
  return data.torre;
}

export async function startStudentTorreTimer() {
  const { data } = await api.post<{ torre: StudentTorre | null }>("/student/torre/start");
  return data.torre;
}

export async function fetchAvionSession(groupId: string) {
  const { data } = await api.get<AvionSession>(`/teacher/groups/${groupId}/avion-session`);
  return data;
}

export async function updateGroupAvionSettings(groupId: string, payload: { released: boolean }) {
  const { data } = await api.put<AvionSession>(`/teacher/groups/${groupId}/avion-settings`, payload);
  return data;
}

export async function resetAvionSession(groupId: string) {
  const { data } = await api.post<AvionSession>(`/teacher/groups/${groupId}/avion-reset`);
  return data;
}

export async function setAvionPaused(groupId: string, paused: boolean) {
  const { data } = await api.post<AvionSession>(`/teacher/groups/${groupId}/avion-pause`, { paused });
  return data;
}

export async function saveAvionTeams(
  groupId: string,
  teams: Array<{ key: string; memberIds: string[] }>,
) {
  const { data } = await api.put<AvionSession>(`/teacher/groups/${groupId}/avion-teams`, { teams });
  return data;
}

export async function resetAvionTeamsToSeating(groupId: string) {
  const { data } = await api.post<AvionSession>(`/teacher/groups/${groupId}/avion-teams/seating`);
  return data;
}

export async function setAvionMarcha(groupId: string, released: boolean) {
  const { data } = await api.post<AvionSession>(`/teacher/groups/${groupId}/avion-marcha`, { released });
  return data;
}

export async function saveAvionMarchaPairs(
  groupId: string,
  pairs: Array<{ a: string; b: string }>,
) {
  const { data } = await api.put<AvionSession>(`/teacher/groups/${groupId}/avion-marcha-pairs`, { pairs });
  return data;
}

export async function chooseStudentAvionLeader(leaderId: string) {
  const { data } = await api.post<{ avion: StudentAvion | null }>("/student/avion/leader", { leaderId });
  return data.avion;
}

export async function startStudentAvionTimer() {
  const { data } = await api.post<{ avion: StudentAvion | null }>("/student/avion/start");
  return data.avion;
}

export async function fetchListasF1Preview(groupId: string) {
  const { data } = await api.get<ListasF1Preview>("/teacher/listas-f1/preview", {
    params: { groupId },
  });
  return data;
}

export async function downloadListasF1Excel() {
  await downloadTeacherBlob("/teacher/listas-f1.xlsx", "LISTAS F1_2026-2027.xlsx");
}

export async function saveGroupExamScores(
  groupId: string,
  scores: Array<{ studentId: string; examScore4: number | null }>,
) {
  const { data } = await api.put<{ saved: number; cleared: number }>(
    `/teacher/groups/${groupId}/exam-scores`,
    { scores },
  );
  return data;
}

export type GroupStudent = {
  id: string;
  controlNumber: string | null;
  listNumber: number | null;
  displayName: string;
  passwordSet: boolean;
  passwordLabel: string;
};

export async function fetchGroupRanking(groupId: string) {
  const { data } = await api.get<GroupRanking>(`/teacher/groups/${groupId}/ranking`);
  return data;
}

export async function fetchGroupWeeks(groupId: string) {
  const { data } = await api.get<GroupWeeks>(`/teacher/groups/${groupId}/weeks`);
  return data;
}

export async function closeCurrentGroupWeek(groupId: string) {
  const { data } = await api.post(`/teacher/groups/${groupId}/weeks/close`);
  return data;
}

export async function fetchPartialSummary(groupId: string) {
  const { data } = await api.get<PartialSummary>(`/teacher/groups/${groupId}/partial-summary`);
  return data;
}

export async function fetchGroupStudents(groupId: string) {
  const { data } = await api.get<{ group: ClassGroup; students: GroupStudent[] }>(
    `/teacher/groups/${groupId}/students`,
  );
  return data;
}

export async function dedupeStudents() {
  const { data } = await api.post<{
    removed: number;
    details: string[];
    message: string;
  }>("/teacher/students/dedupe");
  return data;
}

export async function importStudentsWorkbook(file: File) {
  const form = new FormData();
  form.append("file", file);
  const { data } = await api.post<ImportWorkbookResult>("/teacher/students/import-workbook", form, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data;
}

export async function importStudentsExcel(groupId: string, file: File) {
  const form = new FormData();
  form.append("file", file);
  const { data } = await api.post<ImportResult>(`/teacher/groups/${groupId}/students/import`, form, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data;
}

export async function deleteGroupStudent(groupId: string, studentId: string) {
  const { data } = await api.delete<{
    ok: true;
    deletedId: string;
    displayName: string;
    controlNumber: string | null;
  }>(`/teacher/groups/${groupId}/students/${studentId}`);
  return data;
}

export async function resetStudentPassword(groupId: string, studentId: string, newPassword: string) {
  const { data } = await api.put<{
    controlNumber: string | null;
    displayName: string;
    newPassword: string;
    message: string;
  }>(`/teacher/groups/${groupId}/students/${studentId}/reset-password`, { newPassword });
  return data;
}

export type GradeImportMode = "full" | "activitiesOnly" | "gradesOnly";

export type GradeImportSummary = {
  activitiesCreated: number;
  activitiesMatched: number;
  activitiesMissing: string[];
  gradesUpserted: number;
  gradesSkipped: number;
  unknownControls: string[];
  unknownStudents: string[];
  activityDetails?: { name: string; date: string; action: "created" | "matched" | "missing" }[];
};

export type GradesImportResult = {
  group: { id: string; code: string; shift: string };
  sheetName: string;
  mode: GradeImportMode;
  summary: GradeImportSummary;
};

export type GradesImportWorkbookResult = {
  mode: GradeImportMode;
  results: { groupCode: string; sheetName: string; summary: GradeImportSummary }[];
  skippedSheets: string[];
};

export async function importGradesWorkbook(file: File, mode: GradeImportMode = "full") {
  const form = new FormData();
  form.append("file", file);
  const { data } = await api.post<GradesImportWorkbookResult>(
    `/teacher/grades/import-workbook?mode=${mode}`,
    form,
    {
      headers: { "Content-Type": "multipart/form-data" },
    },
  );
  return data;
}

export async function importGradesExcel(
  groupId: string,
  file: File,
  mode: GradeImportMode = "full",
) {
  const form = new FormData();
  form.append("file", file);
  const { data } = await api.post<GradesImportResult>(
    `/teacher/groups/${groupId}/grades/import?mode=${mode}`,
    form,
    {
      headers: { "Content-Type": "multipart/form-data" },
    },
  );
  return data;
}

export async function downloadGradesTemplate(groupId: string) {
  const { data } = await api.get<Blob>(`/teacher/groups/${groupId}/grades/template`, {
    responseType: "blob",
  });
  const url = URL.createObjectURL(data);
  const link = document.createElement("a");
  link.href = url;
  link.download = "plantilla_calificaciones.csv";
  link.click();
  URL.revokeObjectURL(url);
}

export async function downloadStudentsTemplate(groupId: string) {
  const { data } = await api.get<Blob>(`/teacher/groups/${groupId}/students/template`, {
    responseType: "blob",
  });
  const url = URL.createObjectURL(data);
  const link = document.createElement("a");
  link.href = url;
  link.download = "plantilla_alumnos.csv";
  link.click();
  URL.revokeObjectURL(url);
}

export async function downloadBothGroupsTotalsExcel(groups?: ClassGroup[]) {
  const { data } = await api.get<Blob>("/teacher/reports/totals.xlsx", {
    responseType: "blob",
  });
  const suffix =
    groups && groups.length > 0
      ? [...new Set(groups.map((g) => g.code))].sort((a, b) => a.localeCompare(b, "es")).join("_")
      : "grupos";
  const url = URL.createObjectURL(data);
  const link = document.createElement("a");
  link.href = url;
  link.download = `calificaciones_${suffix}.xlsx`;
  link.click();
  URL.revokeObjectURL(url);
}

export async function fetchActivities(groupId: string) {
  const { data } = await api.get<{ activities: Activity[] }>("/teacher/activities", {
    params: { groupId },
  });
  return data.activities;
}

export async function createActivity(payload: {
  groupId: string;
  date: string;
  name: string;
  maxPoints: number;
}) {
  const { data } = await api.post<{ activity: Activity }>("/teacher/activities", payload);
  return data.activity;
}

export type InterfacePeerEvaluator = {
  studentId: string;
  displayName: string;
  teamKey: string;
  teamName: string;
  isLeader: boolean;
  done: boolean;
  points: number | null;
  missed: string[];
};

export type InterfacePeerBoard = {
  published: boolean;
  pointsMax: number;
  teams: Array<{
    key: string;
    name: string;
    hex: string;
    teacherPoints: number;
    peerAverage: number | null;
    received: number;
    expected: number;
    evaluators: InterfacePeerEvaluator[];
  }>;
};

export type StudentInterfacePeer = {
  isLeader: boolean;
  pointsMax: number;
  peerAverage: number | null;
  evaluatingUs: Array<{
    studentId: string;
    displayName: string;
    teamName: string;
    isLeader: boolean;
    done: boolean;
  }>;
  toReview: Array<{
    key: string;
    name: string;
    hex: string;
    done: boolean;
    points: number | null;
    missed: string[];
  }>;
};

export type InterfaceSession = {
  groupId: string;
  groupCode: string;
  released: boolean;
  activityId: string | null;
  pointsMax: number;
  peer?: InterfacePeerBoard;
  teams: Array<{
    key: string;
    name: string;
    hex: string;
    leaderId: string | null;
    leaderName: string | null;
    awardedDays: string[];
    members: Array<{
      studentId: string;
      displayName: string;
      listNumber: number | null;
      role: string | null;
      points: number;
    }>;
    notes: Array<{
      id: string;
      code: string;
      label: string;
      points: number;
      day: string;
      studentId: string | null;
      studentName: string | null;
    }>;
  }>;
};

export async function fetchInterfaceSession(groupId: string) {
  const { data } = await api.get<InterfaceSession>(`/teacher/groups/${groupId}/interface-session`);
  return data;
}

export async function addInterfaceNote(
  groupId: string,
  payload: {
    teamKey: string;
    code: string;
    day: string;
    label?: string;
    points?: number;
    studentId?: string | null;
  },
) {
  const { data } = await api.post<InterfaceSession>(`/teacher/groups/${groupId}/interface-note`, payload);
  return data;
}

export async function removeInterfaceNote(groupId: string, payload: { teamKey: string; noteId: string }) {
  const { data } = await api.post<InterfaceSession>(
    `/teacher/groups/${groupId}/interface-note-remove`,
    payload,
  );
  return data;
}

export async function applyInterfacePoints(
  groupId: string,
  payload: { day: string; teamKey?: string },
) {
  const { data } = await api.post<InterfaceSession>(`/teacher/groups/${groupId}/interface-award`, payload);
  return data;
}

export async function setInterfacePeerPublished(groupId: string, published: boolean) {
  const { data } = await api.put<InterfaceSession>(`/teacher/groups/${groupId}/interface-peer-publish`, {
    published,
  });
  return data;
}

export type StudentInterfaceDesign = {
  teamName: string | null;
  leaderName: string | null;
  points: number | null;
  pointsMax: number;
  awarded: boolean;
  closed?: boolean;
  notes: Array<{ id: string; label: string; points: number; day?: string; studentName: string | null }>;
  peer?: StudentInterfacePeer | null;
};

export async function fetchStudentInterfaceDesign() {
  const { data } = await api.get<{ interfaceDesign: StudentInterfaceDesign | null }>("/student/interface-design");
  return data.interfaceDesign;
}

export async function submitInterfacePeerReview(payload: { targetTeamKey: string; missed: string[] }) {
  const { data } = await api.post<{ interfaceDesign: StudentInterfaceDesign }>(
    "/student/interface-peer",
    payload,
  );
  return data.interfaceDesign;
}

export async function setActivityStudentRelease(activityId: string, released: boolean) {
  const { data } = await api.put<{ released: boolean; releasedCount: number; activity: Activity | null }>(
    `/teacher/activities/${activityId}/student-release`,
    { released },
  );
  return data;
}

export async function updateActivity(
  activityId: string,
  payload: { date: string; name: string; maxPoints: number },
) {
  const { data } = await api.put<{ activity: Activity }>(`/teacher/activities/${activityId}`, payload);
  return data.activity;
}

export async function deleteActivity(activityId: string) {
  const { data } = await api.delete<{ ok: boolean; deletedId: string }>(
    `/teacher/activities/${activityId}`,
  );
  return data;
}

export async function fetchActivityGrades(activityId: string) {
  const { data } = await api.get<{ activity: Activity; rows: GradeRow[] }>(
    `/teacher/activities/${activityId}/grades`,
  );
  return data;
}

export async function fetchGradesMatrix(groupId: string, partialNumber: number) {
  const { data } = await api.get<GradesMatrix>(
    `/teacher/groups/${groupId}/grades-matrix`,
    { params: { partialNumber } },
  );
  return data;
}

export async function saveGradesBatch(
  groupId: string,
  grades: Array<{ activityId: string; studentId: string; points: number }>,
) {
  const { data } = await api.put<{ saved: number }>(`/teacher/groups/${groupId}/grades-batch`, {
    grades,
  });
  return data;
}

export async function saveGrade(
  activityId: string,
  studentId: string,
  payload: { points: number },
) {
  const { data } = await api.put(`/teacher/activities/${activityId}/grades/${studentId}`, payload);
  return data.grade;
}

export async function fetchStudentProgress() {
  const { data } = await api.get<StudentProgress>("/student/progress");
  return data;
}

export async function downloadStudentDiploma() {
  const { data } = await api.get<Blob>("/student/diploma.pdf", {
    responseType: "blob",
  });
  const url = URL.createObjectURL(data);
  const link = document.createElement("a");
  link.href = url;
  link.download = "diploma_parcial.pdf";
  link.click();
  URL.revokeObjectURL(url);
}

export async function fetchOfficeExamTeacher() {
  const { data } = await api.get<OfficeExamTeacherData>("/teacher/office-exam");
  return data;
}

export async function updateOfficeExamSettings(enabledForStudents: boolean) {
  const { data } = await api.put<{ exam: { enabledForStudents: boolean } }>(
    "/teacher/office-exam/settings",
    { enabledForStudents },
  );
  return data;
}

export async function recalculateOfficeExamGrades() {
  const { data } = await api.post<{ updated: number; total: number }>("/teacher/office-exam/recalculate");
  return data;
}

async function downloadOfficeExamGradesBlob(path: string) {
  const { data } = await api.get<Blob>(path, { responseType: "blob" });
  return data;
}

export async function downloadOfficeExamGradesExcel(groupId: string, groupCode: string) {
  const blob = await downloadOfficeExamGradesBlob(`/teacher/office-exam/grades/${groupId}.xlsx`);
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `calificaciones_examen_office_grupo_${groupCode}.xlsx`;
  link.click();
  URL.revokeObjectURL(url);
}

export async function downloadOfficeExamGradesExcelBoth(groups?: ClassGroup[]) {
  const blob = await downloadOfficeExamGradesBlob("/teacher/office-exam/grades.xlsx");
  const suffix =
    groups && groups.length > 0
      ? [...new Set(groups.map((g) => g.code))].sort((a, b) => a.localeCompare(b, "es")).join("_")
      : "grupos";
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `calificaciones_examen_office_${suffix}.xlsx`;
  link.click();
  URL.revokeObjectURL(url);
}

export async function fetchStudentOfficeExam() {
  const { data } = await api.get<OfficeExamState>("/student/office-exam");
  return data;
}

export async function startOfficeExam() {
  const { data } = await api.post<OfficeExamState>("/student/office-exam/start");
  return data;
}

export async function syncOfficeExamAnswers(answers: Record<string, string>) {
  const { data } = await api.put<{ ok: boolean; lastSavedAt: string }>("/student/office-exam/answers", {
    answers,
  });
  return data;
}

export async function submitOfficeExam(answers: Record<string, string>) {
  const { data } = await api.post<OfficeExamState>("/student/office-exam/submit", { answers });
  return data;
}

async function fetchTeacherDiplomaBlob(
  path: string,
  downloadName: string,
  inline: boolean,
) {
  const { data } = await api.get<Blob>(path, {
    responseType: "blob",
    params: inline ? { inline: "1" } : undefined,
  });
  return { blob: data, downloadName };
}

export async function previewTeacherDiplomaBlobUrl(groupId: string) {
  const { blob } = await fetchTeacherDiplomaBlob(
    `/teacher/groups/${groupId}/diploma/preview.pdf`,
    "muestra_diploma.pdf",
    true,
  );
  return URL.createObjectURL(blob);
}

export async function openTeacherDiplomaPreview(groupId: string) {
  const url = await previewTeacherDiplomaBlobUrl(groupId);
  window.open(url, "_blank", "noopener,noreferrer");
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

export async function downloadTeacherStudentDiploma(
  groupId: string,
  studentId: string,
  studentName: string,
) {
  const safe = studentName.replace(/[^\w\sáéíóúñÁÉÍÓÚÑ.-]/g, "").trim() || "alumno";
  const { blob, downloadName } = await fetchTeacherDiplomaBlob(
    `/teacher/groups/${groupId}/students/${studentId}/diploma.pdf`,
    `diploma_${safe.replace(/\s+/g, "_")}.pdf`,
    false,
  );
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = downloadName;
  link.click();
  URL.revokeObjectURL(url);
}

export async function fetchTeacherComms() {
  const { data } = await api.get<TeacherCommsData>("/teacher/comms");
  return data;
}

export async function createAnnouncement(payload: {
  title: string;
  body: string;
  groupId?: string | null;
}) {
  const { data } = await api.post<{ announcement: TeacherCommsData["announcements"][0] }>(
    "/teacher/comms/announcements",
    payload,
  );
  return data.announcement;
}

export async function deleteAnnouncement(id: string) {
  await api.delete(`/teacher/comms/announcements/${id}`);
}

export async function createTask(payload: {
  title: string;
  body: string;
  groupId?: string | null;
  dueDate?: string | null;
}) {
  const { data } = await api.post<{ task: TeacherCommsData["tasks"][0] }>(
    "/teacher/comms/tasks",
    payload,
  );
  return data.task;
}

export async function deleteTask(id: string) {
  await api.delete(`/teacher/comms/tasks/${id}`);
}

export async function uploadSchoolCalendar(file: File, title: string, semesterLabel: string) {
  const fd = new FormData();
  fd.append("file", file);
  fd.append("title", title);
  if (semesterLabel.trim()) fd.append("semesterLabel", semesterLabel.trim());
  const { data } = await api.post<{ calendar: TeacherCommsData["calendar"] }>(
    "/teacher/comms/calendar",
    fd,
  );
  return data.calendar;
}

export async function deleteSchoolCalendar() {
  await api.delete("/teacher/comms/calendar");
}

export async function downloadTeacherCalendarFile(fileName = "calendario_escolar") {
  await downloadTeacherBlob("/teacher/comms/calendar/file", fileName);
}

export async function resetSemester(confirmPhrase: string, clearComms = false) {
  const { data } = await api.post<{
    groupsReset: number;
    studentsRemoved: number;
    examAttemptsRemoved: number;
  }>("/teacher/comms/semester/reset", { confirmPhrase, clearComms });
  return data;
}

export async function createTeacherGroup(code: string, shift: string) {
  const { data } = await api.post<{ group: ClassGroup }>("/teacher/comms/groups", { code, shift });
  return data.group;
}

export async function deleteTeacherGroup(groupId: string) {
  await api.delete(`/teacher/comms/groups/${groupId}`);
}

export async function fetchStudentComms() {
  const { data } = await api.get<StudentCommsData>("/student/comms");
  return data;
}

export async function downloadStudentCalendarFile(fileName = "calendario_escolar") {
  await downloadTeacherBlob("/student/calendar/file", fileName);
}

export async function fetchClassDaySheet(groupId: string, date: string) {
  const { data } = await api.get<ClassDaySheet>(`/teacher/groups/${groupId}/class-day`, {
    params: { date },
  });
  return data;
}

export async function saveClassDayRecords(
  groupId: string,
  date: string,
  records: Array<{ studentId: string; attendance: string; stars: number }>,
) {
  const { data } = await api.put<{
    saved: number;
    unchanged?: boolean;
    message?: string;
  }>(`/teacher/groups/${groupId}/class-day`, {
    date,
    records,
  });
  return data;
}

export async function downloadMasterAttendanceExcel() {
  await downloadTeacherBlob(
    "/teacher/attendance/master.xlsx",
    "LISTAS DE ASISTENCIA 26-27.xlsx",
  );
}

async function parseBlobError(data: Blob) {
  const text = await data.text();
  try {
    const parsed = JSON.parse(text) as { message?: string; error?: string };
    if (parsed.error === "calendar_not_found" || parsed.error === "not_found") {
      return "No hay calendario escolar publicado.";
    }
    return parsed.message ?? parsed.error ?? text;
  } catch {
    return text || "No se pudo descargar el archivo.";
  }
}

function filenameFromDisposition(header: string | undefined, fallback: string) {
  if (!header) return fallback;
  const utf = /filename\*=UTF-8''([^;]+)/i.exec(header);
  if (utf?.[1]) {
    try {
      return decodeURIComponent(utf[1].trim());
    } catch {
      /* ignore */
    }
  }
  const ascii = /filename="([^"]+)"/i.exec(header) ?? /filename=([^;]+)/i.exec(header);
  return ascii?.[1]?.trim() || fallback;
}

function saveBlobFile(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.rel = "noopener";
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 4_000);
}

async function downloadTeacherBlob(path: string, downloadName: string) {
  try {
    const { data, headers } = await api.get<Blob>(path, { responseType: "blob" });
    const contentType = String(headers["content-type"] ?? data.type ?? "");
    if (contentType.includes("json")) {
      throw new Error(await parseBlobError(data));
    }
    const typed =
      data.type && !contentType.includes("octet-stream")
        ? data
        : new Blob([data], { type: contentType || data.type || "application/octet-stream" });
    saveBlobFile(typed, filenameFromDisposition(headers["content-disposition"], downloadName));
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.data instanceof Blob) {
      throw new Error(await parseBlobError(error.response.data));
    }
    throw error;
  }
}

export async function downloadDayAttendanceExcel(groupId: string, groupCode: string, date: string) {
  await downloadTeacherBlob(
    `/teacher/groups/${groupId}/attendance/day.xlsx?date=${encodeURIComponent(date)}`,
    `asistencia_grupo_${groupCode}_${date}.xlsx`,
  );
}

export async function downloadDayAttendancePdf(groupId: string, groupCode: string, date: string) {
  await downloadTeacherBlob(
    `/teacher/groups/${groupId}/attendance/day.pdf?date=${encodeURIComponent(date)}`,
    `asistencia_grupo_${groupCode}_${date}.pdf`,
  );
}

export async function downloadWeekAttendanceExcel(
  groupId: string,
  groupCode: string,
  anchorDate: string,
) {
  await downloadTeacherBlob(
    `/teacher/groups/${groupId}/attendance/week.xlsx?date=${encodeURIComponent(anchorDate)}`,
    `asistencia_semana_grupo_${groupCode}_${anchorDate}.xlsx`,
  );
}

export async function downloadWeekAttendancePdf(
  groupId: string,
  groupCode: string,
  anchorDate: string,
) {
  await downloadTeacherBlob(
    `/teacher/groups/${groupId}/attendance/week.pdf?date=${encodeURIComponent(anchorDate)}`,
    `asistencia_semana_grupo_${groupCode}_${anchorDate}.pdf`,
  );
}

export async function fetchGroupDeliveryStatus(groupId: string) {
  const { data } = await api.get<{
    group: { id: string; code: string; shift: string };
    activities: Array<{
      id: string;
      name: string;
      date: string;
      maxPoints: number;
      sortOrder: number;
      index: number;
      isPastDue: boolean;
    }>;
    rows: Array<{
      student: {
        id: string;
        displayName: string;
        listNumber: number | null;
        controlNumber: string | null;
        listPosition: number;
      };
      summary: {
        graded: number;
        pending: number;
        overdue: number;
        total: number;
        deliveryPercent: number;
      };
      cells: Array<{
        activityId: string;
        status: "graded" | "pending" | "overdue";
        points: number | null;
        maxPoints: number;
        gradedAt: string | null;
      }>;
    }>;
    totals: {
      students: number;
      activities: number;
      fullyComplete: number;
      withOverdue: number;
      withPending: number;
    };
  }>(`/teacher/groups/${groupId}/delivery-status`);
  return data;
}

export type LagLevel = "al_dia" | "seguimiento" | "atrasado";

export type LagReport = {
  generatedAt: string;
  reportDate: string;
  reportDateLabel: string;
  isFriday: boolean;
  weekFriday: string;
  weekFridayLabel: string;
  group: {
    id: string;
    code: string;
    shift: string;
    currentPartial: number;
    partialNumber: number;
    partialLabel: string;
  };
  partialInventory: Array<{
    partialNumber: number;
    label: string;
    published: number;
    due: number;
    upcoming: number;
    isCurrent: boolean;
  }>;
  activities: Array<{
    id: string;
    name: string;
    date: string;
    dateLabel: string;
    maxPoints: number;
    due: boolean;
    ungradedStudents: number;
  }>;
  counts: {
    published: number;
    due: number;
    upcoming: number;
    students: number;
    onTrack: number;
    watch: number;
    behind: number;
  };
  onTrackNames: string[];
  behind: Array<{
    id: string;
    displayName: string;
    listNumber: number | null;
    controlNumber: string | null;
    graded: number;
    missing: number;
    due: number;
    level: Exclude<LagLevel, "al_dia">;
    levelLabel: string;
    missingActivities: Array<{ id: string; name: string; dateLabel: string }>;
  }>;
};

export async function fetchLagReport(groupId: string, partialNumber?: number) {
  const { data } = await api.get<LagReport>(`/teacher/groups/${groupId}/lag-report`, {
    params: partialNumber ? { partialNumber } : undefined,
  });
  return data;
}

export async function downloadGroupLagReport(groupId: string, groupCode: string, partialNumber?: number) {
  const query = partialNumber ? `?partialNumber=${partialNumber}` : "";
  await downloadTeacherBlob(
    `/teacher/groups/${groupId}/lag-report.pdf${query}`,
    `reporte_viernes_grupo_${groupCode}.pdf`,
  );
}

export async function downloadFridayLagReport() {
  await downloadTeacherBlob("/teacher/reports/lag-friday.pdf", "reporte_viernes_atrasos.pdf");
}

export async function fetchSeatingPlan(groupId: string, date: string) {
  const { data } = await api.get<SeatingPlan>(`/teacher/groups/${groupId}/seating`, {
    params: { date },
  });
  return data;
}

export async function shuffleSeatingPlan(
  groupId: string,
  date: string,
  options: { mode?: SeatingMode; theme?: SeatingTheme } = {},
) {
  const { data } = await api.post<SeatingPlan>(`/teacher/groups/${groupId}/seating/shuffle`, {
    date,
    mode: options.mode ?? "random",
    theme: options.theme ?? "column_colors",
  });
  return data;
}

// El alumno ya no registra entregas. La actividad se considera entregada al calificar.

export async function fetchStudentSkillSurvey() {
  const { data } = await api.get<import("./types").StudentSkillSurveyState>("/student/skill-survey");
  return data;
}

export async function chooseStudentProjectLeader(leaderId: string) {
  const { data } = await api.post<import("./types").StudentSkillSurveyState>(
    "/student/project-team/leader",
    { leaderId },
  );
  return data;
}

export async function fetchTeacherSkillSurvey(groupId: string) {
  const { data } = await api.get<import("./types").TeacherSkillSurveyBoard>(
    `/teacher/groups/${groupId}/skill-survey`,
  );
  return data;
}

export async function assignTeacherStudentRole(groupId: string, studentId: string, role: SkillRole) {
  const { data } = await api.put<import("./types").TeacherSkillSurveyBoard>(
    `/teacher/groups/${groupId}/project-roles/${studentId}`,
    { role },
  );
  return data;
}

export async function suggestTeacherProjectTeams(groupId: string) {
  const { data } = await api.post<import("./types").TeamSuggestion>(
    `/teacher/groups/${groupId}/project-teams/suggest`,
  );
  return data;
}

export async function replaceTeacherProjectTeams(
  groupId: string,
  teams: Array<{ name: string; members: Array<{ studentId: string; role: string }> }>,
) {
  const { data } = await api.post<import("./types").TeacherSkillSurveyBoard>(
    `/teacher/groups/${groupId}/project-teams/replace`,
    { teams },
  );
  return data;
}

export async function createTeacherProjectTeam(
  groupId: string,
  name: string,
  members: Array<{ studentId: string; role: string }>,
) {
  const { data } = await api.post(`/teacher/groups/${groupId}/project-teams`, { name, members });
  return data;
}

export async function updateTeacherProjectTeam(
  groupId: string,
  teamId: string,
  name: string,
  members: Array<{ studentId: string; role: string }>,
) {
  const { data } = await api.put(`/teacher/groups/${groupId}/project-teams/${teamId}`, {
    name,
    members,
  });
  return data;
}

export async function deleteTeacherProjectTeam(groupId: string, teamId: string) {
  const { data } = await api.delete(`/teacher/groups/${groupId}/project-teams/${teamId}`);
  return data;
}
