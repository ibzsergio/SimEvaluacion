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

export type SqlScrumGithubPaso = { quien: string; texto: string };

export function sqlScrumGithub(key: SqlScrumKey): { carpeta: string; pasos: SqlScrumGithubPaso[] } {
  const actividad = key === "bd2" ? "II" : "III";
  const carpeta = key === "bd2" ? "actividad-ii" : "actividad-iii";
  const tablas =
    key === "bd2"
      ? "PRENDAS, PEDIDOS o ENTREGAS, de la base UNIFORME"
      : "EQUIPOS, SERVICIOS, ORDENES o PAGOS, de la base TALLER";
  return {
    carpeta,
    pasos: [
      {
        quien: "El líder",
        texto: `Reparte una tabla a cada integrante. En esta actividad las tablas son ${tablas}. Anota el nombre de la persona y la tabla que le tocó. Cada quien trabaja solo su tabla.`,
      },
      {
        quien: "Cada integrante, en su computadora",
        texto:
          "Prepara dos cosas de la tabla que le tocó. Primera: script.sql, el script que crea la base de datos y su tabla, con el llenado y los cambios. Segunda: app.py, otra aplicación de Tkinter que se conecta a esa base y a esa tabla, y hace el CRUD: guardar, consultar, actualizar y eliminar.",
      },
      {
        quien: "Un integrante",
        texto:
          "Entra a github.com e inicia sesión. Arriba a la derecha pulsa + y elige New repository. En Repository name escribe bd-302-equipo- y el número del equipo. Ejemplo: bd-302-equipo-1. Elige Public. Marca Add a README. Pulsa Create repository. Es un solo proyecto para todo el equipo y para las dos actividades. Si ya lo crearon en la otra actividad, no creen otro: abran el mismo.",
      },
      {
        quien: "Ese mismo integrante",
        texto:
          "Dentro del repositorio pulsa Settings, luego Collaborators y luego Add people. Escribe el usuario de GitHub de cada compañero y el del docente. Pulsa Add.",
      },
      {
        quien: "Cada compañero",
        texto:
          "Entra a github.com con su cuenta. Abre la campana de notificaciones y acepta la invitación. También puede aceptarla en el correo. Si no acepta, no puede subir su carpeta.",
      },
      {
        quien: "Cada integrante",
        texto: `Abre el repositorio del equipo. Pulsa Add file y después Create new file. En el nombre escribe ${carpeta}/sunombre/script.sql. Ejemplo: ${carpeta}/ana/script.sql. Pega su script.sql y pulsa Commit changes. El commit debe quedar con su usuario.`,
      },
      {
        quien: "Cada integrante",
        texto: `Otra vez Add file y Create new file. Ahora el nombre es ${carpeta}/sunombre/app.py. Ejemplo: ${carpeta}/ana/app.py. Pega su aplicación de Tkinter y pulsa Commit changes, otra vez con su usuario. Su carpeta queda con los dos archivos: el script de su tabla y el CRUD que se conecta a ella.`,
      },
      {
        quien: "El líder",
        texto:
          "Abre README.md, pulsa el lápiz y escribe el nombre del equipo, el enlace del repositorio y la lista: persona, usuario de GitHub y tabla que le tocó. Pulsa Commit changes.",
      },
      {
        quien: "El integrante que sube el PDF",
        texto: `El PDF es aparte del proyecto. Un solo archivo, de máximo 8 MB. La portada lleva el enlace del repositorio. Después, de cada integrante, las evidencias de que su Tkinter funciona con la base y con la tabla que le tocó. En SimEvaluación marca las casillas y sube ese PDF de la actividad ${actividad}.`,
      },
    ],
  };
}

export function sqlScrumGithubChecks(key: SqlScrumKey) {
  const carpeta = key === "bd2" ? "actividad-ii" : "actividad-iii";
  return [
    { id: "github-repo", text: "Hay un solo repositorio del equipo, bd-302-equipo-…. La actividad II y la III están en ese mismo proyecto." },
    { id: "github-invitacion", text: "Cada integrante aceptó la invitación y puede abrir el repositorio." },
    { id: "github-tabla", text: "El líder repartió una tabla por integrante y el README dice quién tiene cuál." },
    {
      id: "github-carpeta",
      text: `Cada integrante tiene su carpeta ${carpeta}/sunombre/ con script.sql y con app.py, y el commit está a su nombre.`,
    },
    { id: "github-enlace", text: "La portada del PDF trae el enlace del repositorio y las evidencias del CRUD de cada tabla." },
  ];
}
