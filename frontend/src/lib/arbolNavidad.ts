export const ARBOL_TITULO = "Propuesta Árbol de Navidad";
export const ARBOL_PDF_MAX_BYTES = 5 * 1024 * 1024;
export const ARBOL_TEXTO_MAX = 1500;

export function pdfPareceValido(bytes: ArrayBuffer) {
  const view = new Uint8Array(bytes, 0, Math.min(bytes.byteLength, 1024));
  for (let i = 0; i <= view.length - 4; i += 1) {
    if (view[i] === 0x25 && view[i + 1] === 0x50 && view[i + 2] === 0x44 && view[i + 3] === 0x46) return true;
  }
  return false;
}

export function formatoHoraArbol(at: number | string) {
  return new Date(at).toLocaleTimeString("es-MX", { hour: "numeric", minute: "2-digit", hour12: true });
}
