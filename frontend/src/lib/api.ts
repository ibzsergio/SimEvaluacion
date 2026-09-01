import axios from "axios";
import type {
  Activity,
  ClassGroup,
  ClassDaySheet,
  GradeRow,
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
    if (code === "student_not_found") {
      return (
        (error.response.data as { message?: string })?.message ??
        "Número de control no encontrado."
      );
    }
    if (code === "partial_closed") {
      return (error.response.data as { message?: string })?.message ?? "El parcial está cerrado.";
    }
    if (code === "partial_not_closed") {
      return (
        (error.response.data as { message?: string })?.message ??
        "El diploma estará disponible cuando el docente cierre el parcial."
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
    if (code === "activity_not_found") {
      return "No se encontró la actividad. Recarga la página e inténtalo de nuevo.";
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
    if (code === "not_found") {
      return (
        "Ruta no encontrada en el servidor. Verifica que Railway esté desplegado y que VITE_API_URL sea " +
        `https://tu-backend.up.railway.app (sin /api). Base actual: ${getApiBaseUrl()}`
      );
    }
    if (error.response.status === 404) {
      const message = (error.response.data as { message?: string })?.message;
      if (message) return message;
      return `No encontrado (404). Si persiste, recarga la página o vuelve a iniciar sesión.`;
    }
    return `Error del servidor (${error.response.status}).`;
  }
  return "Ocurrió un error inesperado.";
}

export const api = axios.create({ baseURL });

export function setAuthToken(token: string | null) {
  if (token) api.defaults.headers.common.Authorization = `Bearer ${token}`;
  else delete api.defaults.headers.common.Authorization;
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

export async function openTeacherCalendarFile() {
  const { data } = await api.get<Blob>("/teacher/comms/calendar/file", { responseType: "blob" });
  const url = URL.createObjectURL(data);
  window.open(url, "_blank", "noopener,noreferrer");
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
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

export async function openStudentCalendarFile() {
  const { data } = await api.get<Blob>("/student/calendar/file", { responseType: "blob" });
  const url = URL.createObjectURL(data);
  window.open(url, "_blank", "noopener,noreferrer");
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
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
  const { data } = await api.put<{ saved: number }>(`/teacher/groups/${groupId}/class-day`, {
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

async function downloadTeacherBlob(path: string, downloadName: string) {
  const { data } = await api.get<Blob>(path, { responseType: "blob" });
  const url = URL.createObjectURL(data);
  const link = document.createElement("a");
  link.href = url;
  link.download = downloadName;
  link.click();
  URL.revokeObjectURL(url);
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
