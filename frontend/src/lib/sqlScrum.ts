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
    iso: "2026-11-12T15:00:00-06:00",
    texto:
      "La entrega y la subida del archivo del grupo 301 se cierran a las 3:00 p. m. de hoy. Después ya no se puede subir y el equipo pierde los 2000 puntos.",
  },
  "302": {
    iso: "2026-11-12T15:00:00-06:00",
    texto:
      "La entrega y la subida del archivo del grupo 302 se cierran a las 3:00 p. m. de hoy. Después ya no se puede subir y el equipo pierde los 2000 puntos.",
  },
};

export function sqlScrumCierre(groupCode?: string | null, now = Date.now()) {
  const item = groupCode ? CIERRE[groupCode.trim()] : undefined;
  if (!item) {
    return {
      texto:
        "Los grupos 301 y 302 entregan hasta las 3:00 p. m. de hoy. Después de esa hora ya no se puede subir y el equipo pierde los 2000 puntos.",
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

export type SqlScrumGithubPaso = { quien: string; titulo: string; lineas: string[]; ejemplo?: string };

export function sqlScrumGithub(key: SqlScrumKey): { carpeta: string; pasos: SqlScrumGithubPaso[] } {
  const actividad = key === "bd2" ? "II" : "III";
  const carpeta = key === "bd2" ? "actividad-ii" : "actividad-iii";
  const tablas =
    key === "bd2"
      ? "PRENDAS, PEDIDOS o ENTREGAS. La base se llama UNIFORME."
      : "EQUIPOS, SERVICIOS, ORDENES o PAGOS. La base se llama TALLER.";
  const nombre = "ana-lopez";
  return {
    carpeta,
    pasos: [
      {
        quien: "El líder",
        titulo: "Reparte una tabla",
        lineas: [
          `Las tablas de esta actividad son: ${tablas}`,
          "Escribe en una hoja el nombre de cada integrante y la tabla que le toca.",
          "Una persona trabaja una sola tabla.",
        ],
      },
      {
        quien: "Cada integrante",
        titulo: "Prepara dos archivos en su computadora, antes de abrir GitHub",
        lineas: [
          "script.sql es el script de su tabla: crea la base, crea la tabla, la llena y hace los cambios.",
          "app.py es otra aplicación, la de Tkinter. Se conecta a esa misma base y a esa tabla.",
          "En esa aplicación se debe poder guardar, consultar, actualizar y eliminar.",
          "Deja los dos archivos abiertos. Después vas a copiar todo el texto.",
        ],
      },
      {
        quien: "Un integrante",
        titulo: "Entra a GitHub",
        lineas: [
          "Abre el navegador y escribe github.com.",
          "Arriba a la derecha pulsa Sign in e inicia sesión con la cuenta que ya creó.",
          "Cuando ya entró, arriba a la derecha se ve su foto.",
        ],
      },
      {
        quien: "Ese mismo integrante",
        titulo: "Crea el proyecto del equipo",
        lineas: [
          "Junto a su foto hay un signo +. Púlsalo.",
          "En el menú que se abre, pulsa New repository.",
          "En la caja Repository name escribe el nombre del proyecto. Cambia el número final por el de su equipo.",
          "Marca el círculo que dice Public.",
          "Marca la casilla Add a README.",
          "Pulsa el botón verde Create repository.",
          "Si la otra actividad ya creó este proyecto, no creen otro. Abran el que ya existe y sigan con el siguiente paso.",
        ],
        ejemplo: "bd-302-equipo-1",
      },
      {
        quien: "Ese mismo integrante",
        titulo: "Invita a cada compañero",
        lineas: [
          "Arriba se ven unas pestañas. Pulsa Settings.",
          "En el menú de la izquierda busca la palabra Collaborators. Si no la ves, pulsa Access y ahí aparece.",
          "Pulsa el botón Add people.",
          "Escribe el usuario de GitHub de un compañero. El usuario es el nombre de su cuenta, el que va después de github.com/.",
          "Pulsa Add.",
          "Haz lo mismo con cada compañero y también con el docente.",
        ],
      },
      {
        quien: "Cada compañero",
        titulo: "Acepta la invitación con su propia cuenta",
        lineas: [
          "Entra a github.com e inicia sesión con su cuenta, no con la del líder.",
          "Arriba a la derecha pulsa la campana.",
          "Abre el aviso de invitación y pulsa Accept invitation.",
          "Si la campana está vacía, abre el correo con el que creó la cuenta y acepta desde ahí.",
          "Al aceptar, debe ver el proyecto del equipo. Si no lo ve, todavía no puede subir sus archivos.",
        ],
      },
      {
        quien: "Cada integrante",
        titulo: "Sube su script.sql",
        lineas: [
          "Abre el proyecto del equipo.",
          "Arriba a la derecha de la lista de archivos hay un botón gris que dice Add file. Púlsalo.",
          "Pulsa Create new file.",
          "En la caja del nombre, la de hasta arriba, escribe la ruta completa. Las diagonales crean las carpetas.",
          "Su nombre va en minúsculas, sin acentos. El espacio se cambia por un guion. Ana López escribe ana-lopez.",
          "Haz clic en el cuadro grande de abajo y pega todo el texto de script.sql.",
          "Baja hasta el final de la página. Pulsa el botón verde Commit changes.",
          "Si se abre una ventana, pulsa otra vez el botón verde Commit changes. Ahí queda guardado con tu usuario.",
        ],
        ejemplo: `${carpeta}/${nombre}/script.sql`,
      },
      {
        quien: "Cada integrante",
        titulo: "Sube su app.py en la misma carpeta",
        lineas: [
          "Regresa a la página principal del proyecto.",
          "Otra vez pulsa Add file y después Create new file.",
          "En la caja del nombre escribe la misma carpeta y termina en app.py.",
          "Pega todo el programa de Tkinter en el cuadro grande.",
          "Baja y pulsa Commit changes. Si sale la ventana, pulsa Commit changes otra vez.",
        ],
        ejemplo: `${carpeta}/${nombre}/app.py`,
      },
      {
        quien: "Cada integrante",
        titulo: "Comprueba su carpeta",
        lineas: [
          "En la página principal del proyecto pulsa la carpeta de esta actividad.",
          "Entra a la carpeta con su nombre.",
          "Ahí deben verse dos archivos: script.sql y app.py.",
          "Junto a cada archivo debe aparecer su usuario de GitHub.",
        ],
        ejemplo: `${carpeta}/${nombre}/`,
      },
      {
        quien: "El líder",
        titulo: "Anota en el README quién hizo cada tabla",
        lineas: [
          "En la lista de archivos pulsa README.md.",
          "Pulsa el ícono del lápiz. Se llama Edit this file.",
          "Escribe el nombre del equipo.",
          "Escribe el enlace del proyecto: es la dirección que se ve arriba en el navegador y empieza con https://github.com/.",
          "Escribe una línea por persona: su nombre, su usuario de GitHub y la tabla que le tocó.",
          "Baja y pulsa Commit changes dos veces, igual que al subir un archivo.",
        ],
      },
      {
        quien: "Un integrante",
        titulo: `Sube el PDF de la actividad ${actividad} en SimEvaluación`,
        lineas: [
          "El PDF es otro archivo. Se entrega aquí, en la plataforma, aparte de GitHub.",
          "La portada lleva el enlace del proyecto.",
          "Después van las evidencias de cada integrante: su Tkinter funcionando con la base y con la tabla que le tocó.",
          "Es un solo PDF y pesa 8 MB o menos.",
          "Marca todas las casillas de abajo y pulsa Subir PDF.",
        ],
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
      text: `Cada integrante tiene su carpeta ${carpeta}/su-nombre/ con script.sql y con app.py, y junto al archivo aparece su usuario.`,
    },
    { id: "github-enlace", text: "La portada del PDF trae el enlace del repositorio y las evidencias del CRUD de cada tabla." },
  ];
}
