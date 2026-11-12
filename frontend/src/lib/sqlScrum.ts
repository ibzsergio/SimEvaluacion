export type SqlScrumKey = "bd2" | "bd3";

export const SQL_SCRUM_PUNTOS = 2000;
export const SQL_SCRUM_PDF_MAX_BYTES = 8 * 1024 * 1024;

export const SQL_SCRUM_NOTAS = [
  { code: "no_trabaja", label: "No está trabajando", points: 500 },
  { code: "no_participa", label: "No participa", points: 500 },
  { code: "ruido", label: "Está haciendo ruido", points: 300 },
] as const;

const CIERRE: Record<string, { iso: string; texto: string }> = {
  "301": {
    iso: "2026-11-12T10:00:00-06:00",
    texto:
      "La entrega y la subida del archivo del grupo 301 se cierran a las 10:00 a. m. de hoy. Después ya no se puede subir y el equipo pierde los 2000 puntos.",
  },
  "302": {
    iso: "2026-11-12T12:00:00-06:00",
    texto:
      "La entrega y la subida del archivo del grupo 302 se cierran a las 12:00 del día de hoy. Después ya no se puede subir y el equipo pierde los 2000 puntos.",
  },
};

export function sqlScrumCierre(groupCode?: string | null, now = Date.now()) {
  const item = groupCode ? CIERRE[groupCode.trim()] : undefined;
  if (!item) {
    return {
      texto:
        "El grupo 301 entrega hasta las 10:00 a. m. El grupo 302 entrega hasta las 12:00 del día. Después de esa hora ya no se puede subir y el equipo pierde los 2000 puntos.",
      until: 0,
      open: false,
    };
  }
  const until = new Date(item.iso).getTime();
  return { texto: item.texto, until, open: now < until };
}

export function sqlScrumPuntosDe(notes: Array<{ points: number; studentId?: string | null }>, studentId: string) {
  const cut = notes
    .filter((note) => !note.studentId || note.studentId === studentId)
    .reduce((acc, note) => acc + Math.max(0, note.points), 0);
  return Math.max(0, SQL_SCRUM_PUNTOS - cut);
}

export type SqlScrumActivity = {
  key: SqlScrumKey;
  title: string;
  contexto: string;
  pasos: string[];
  checks: Array<{ id: string; text: string }>;
};

export const SQL_SCRUM_ACTIVITIES: SqlScrumActivity[] = [
  {
    key: "bd2",
    title: "ACTIVIDAD BASE DE DATOS II",
    contexto:
      "La hacen el grupo 301 y el grupo 302. Es por equipo de proyecto y vale 2000 puntos. La base se llama UNIFORME. No se combinan las tablas. El PDF lleva portada y, de cada tabla, evidencias en Tkinter de su creación, de sus movimientos y de sus resultados. Un solo integrante sube un solo PDF, de máximo 8 MB.",
    pasos: [
      "Elaborar una portada del equipo.",
      "Crear la base UNIFORME y las tablas PRENDAS y PEDIDOS, y llenarlas con los datos de la hoja.",
      "Actualizar la Playera de $150.00 a $200.00 y los montos de los pedidos de esa prenda.",
      "Actualizar la talla de la Falda: pasa de CH a M.",
      "Eliminar los pedidos con monto menor a $400.00 y eliminar el pedido 7009.",
      "Crear la tabla ENTREGAS y llenarla solo con los 2 registros de la hoja: 7001 Entregado y 7002 Pendiente.",
      "De cada tabla (PRENDAS, PEDIDOS y ENTREGAS) incluir evidencias en Tkinter de su creación, de sus movimientos y del resultado.",
      "Un integrante sube un solo PDF, de máximo 8 MB, con la portada y esas evidencias.",
    ],
    checks: [
      { id: "portada", text: "El PDF abre con la portada del equipo." },
      { id: "base", text: "Se ve la creación de la base UNIFORME y de las tablas PRENDAS y PEDIDOS, con el llenado." },
      { id: "playera", text: "Se ve la Playera en $200.00 y los montos de sus pedidos ya actualizados." },
      { id: "falda", text: "Se ve la Falda con talla M." },
      { id: "bajas", text: "Ya no están los pedidos con monto menor a $400.00 ni el pedido 7009." },
      { id: "entregas", text: "Está la tabla ENTREGAS con los 2 registros: 7001 Entregado y 7002 Pendiente." },
      { id: "tkinter", text: "De cada tabla hay evidencias en Tkinter: la creación, los movimientos y el resultado." },
      { id: "archivo", text: "Es un solo PDF y pesa 8 MB o menos." },
    ],
  },
  {
    key: "bd3",
    title: "ACTIVIDAD BASE DE DATOS III",
    contexto:
      "La hacen el grupo 301 y el grupo 302. Es por equipo de proyecto y vale 2000 puntos. La base se llama TALLER. No se combinan las tablas. El PDF lleva portada y, de cada tabla, evidencias en Tkinter de su creación, de sus movimientos y de sus resultados. Un solo integrante sube un solo PDF, de máximo 8 MB.",
    pasos: [
      "Elaborar una portada del equipo.",
      "Crear la base TALLER y las tablas EQUIPOS, SERVICIOS y ORDENES, y llenarlas con los datos de la hoja.",
      "Actualizar la Tablet: la marca pasa de Lenovo a Samsung.",
      "Actualizar el Teclado de $160.00 a $210.00 y los montos de sus órdenes.",
      "Actualizar el Cargador de $300.00 a $280.00 y los montos de sus órdenes.",
      "Eliminar las órdenes con monto menor a $400.00 y eliminar la orden 8006.",
      "Crear la tabla PAGOS y llenarla solo con los 3 registros de la hoja: 8001 Efectivo, 8002 Tarjeta y 8008 Efectivo.",
      "De cada tabla (EQUIPOS, SERVICIOS, ORDENES y PAGOS) incluir evidencias en Tkinter de su creación, de sus movimientos y del resultado.",
      "Un integrante sube un solo PDF, de máximo 8 MB, con la portada y esas evidencias.",
    ],
    checks: [
      { id: "portada", text: "El PDF abre con la portada del equipo." },
      { id: "base", text: "Se ve la creación de la base TALLER y de las tablas EQUIPOS, SERVICIOS y ORDENES, con el llenado." },
      { id: "tablet", text: "Se ve la Tablet con marca Samsung." },
      { id: "precios", text: "El Teclado está en $210.00, el Cargador en $280.00, y los montos de sus órdenes ya cambiaron." },
      { id: "bajas", text: "Ya no están las órdenes con monto menor a $400.00 ni la orden 8006." },
      { id: "pagos", text: "Está la tabla PAGOS con los 3 registros: 8001 Efectivo, 8002 Tarjeta y 8008 Efectivo." },
      { id: "tkinter", text: "De cada tabla hay evidencias en Tkinter: la creación, los movimientos y el resultado." },
      { id: "archivo", text: "Es un solo PDF y pesa 8 MB o menos." },
    ],
  },
];

export function sqlScrumActivity(key: SqlScrumKey) {
  const found = SQL_SCRUM_ACTIVITIES.find((item) => item.key === key);
  if (!found) throw new Error("Actividad no encontrada.");
  return found;
}
