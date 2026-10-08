/** Cuenta y grupo internos para que el docente vea la plataforma como alumno. */
export const PREVIEW_GROUP_CODE = "PRUEBA";
export const PREVIEW_CONTROL_NUMBER = "PRUEBA";
export const PREVIEW_PASSWORD = "prueba";
export const PREVIEW_DISPLAY_NAME = "Alumno de prueba";

export function isPreviewControlNumber(value: string | null | undefined): boolean {
  return String(value ?? "").trim().replace(/\s/g, "").toUpperCase() === PREVIEW_CONTROL_NUMBER;
}

export function isPreviewGroupCode(value: string | null | undefined): boolean {
  return String(value ?? "").trim().toUpperCase() === PREVIEW_GROUP_CODE;
}
