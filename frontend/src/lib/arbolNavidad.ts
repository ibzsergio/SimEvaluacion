export const ARBOL_TITULO = "Propuesta Árbol de Navidad";
export const ARBOL_PDF_MAX_BYTES = 5 * 1024 * 1024;
export const ARBOL_TEXTO_MAX = 1500;

export function formatoHoraArbol(at: number | string) {
  return new Date(at).toLocaleTimeString("es-MX", { hour: "numeric", minute: "2-digit", hour12: true });
}
