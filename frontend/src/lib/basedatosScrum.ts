export const BASEDATOS_TITULO = "La base de datos";
export const BASEDATOS_PROGRAMA = "Actividad Scrum · hoy";
export const BASEDATOS_ACTIVITY_NAME = "La base de datos";
export const BASEDATOS_FIRMAS_MAX = 3000;
export const BASEDATOS_PDF_MAX_BYTES = 5 * 1024 * 1024;

export const BASEDATOS_CONTEXTO =
  "Hoy es el único día. El equipo entrega 4 productos, todos digitales, en un solo PDF. El archivo abre con carátula y cada sección lleva su título. Vale 3000 puntos. Solo se sube un archivo por equipo y no puede pesar más de 5 MB.";

export const BASEDATOS_PRODUCTOS = [
  {
    id: "caratula",
    letra: "",
    titulo: "Carátula",
    items: [
      { id: "caratula-primera", text: "El PDF empieza con una carátula." },
      { id: "caratula-titulo", text: "La carátula lleva el título del proyecto." },
      { id: "caratula-equipo", text: "La carátula lleva el nombre del equipo, los integrantes, el grupo y la fecha." },
    ],
  },
  {
    id: "er",
    letra: "A",
    titulo: "DIAGRAMA ENTIDAD RELACIÓN",
    items: [
      { id: "er-seccion", text: "La sección se llama DIAGRAMA ENTIDAD RELACIÓN y también lleva el título del proyecto." },
      { id: "er-entidades", text: "Están todas las entidades." },
      { id: "er-atributos", text: "Cada entidad muestra sus atributos." },
      { id: "er-pk", text: "Cada entidad marca su llave primaria." },
      { id: "er-relaciones", text: "Las relaciones tienen nombre." },
      { id: "er-cardinalidad", text: "Cada relación tiene su cardinalidad (1, N…)." },
    ],
  },
  {
    id: "relacional",
    letra: "B",
    titulo: "MODELO RELACIONAL",
    items: [
      { id: "rel-seccion", text: "La sección se llama MODELO RELACIONAL y también lleva el título del proyecto." },
      { id: "rel-tablas", text: "Hay una tabla por cada entidad del diagrama." },
      { id: "rel-tipos", text: "Cada columna tiene su tipo de dato." },
      { id: "rel-pk", text: "La llave primaria está marcada." },
      { id: "rel-fk", text: "Las llaves foráneas están marcadas." },
    ],
  },
  {
    id: "script",
    letra: "C",
    titulo: "SCRIPT DE LA BASE DE DATOS",
    items: [
      { id: "sql-seccion", text: "La sección se llama SCRIPT DE LA BASE DE DATOS y también lleva el título del proyecto." },
      { id: "sql-completo", text: "Va todo el script para crear la base de datos, no solo una parte." },
      { id: "sql-llaves", text: "Ese script crea todas las tablas, con llaves primarias y foráneas." },
    ],
  },
  {
    id: "interfaces",
    letra: "D",
    titulo: "INTERFACES",
    items: [
      { id: "ui-seccion", text: "La sección se llama INTERFACES y también lleva el título del proyecto." },
      { id: "ui-todas", text: "Están todas las pantallas del sistema." },
      { id: "ui-capturas", text: "Son capturas de pantalla tal cual se ven en la aplicación ya compilada." },
      { id: "ui-alumno", text: "Se ve cómo agregar o administrar un alumno." },
      { id: "ui-docente", text: "Se ve cómo agregar o administrar un docente." },
    ],
  },
] as const;

export const BASEDATOS_REGLAS = [
  "Todo se entrega en digital.",
  "El PDF abre con carátula.",
  "Cada sección lleva su título y el título del proyecto.",
  "Los 4 productos van en ese mismo PDF.",
  "Un archivo por equipo.",
  "El PDF no pasa de 5 MB.",
  "Hoy es el único día.",
];

export function basedatosProductHeading(product: { letra: string; titulo: string }) {
  return product.letra ? `${product.letra}) ${product.titulo}` : product.titulo;
}

/** Hora de Ciudad de México. Después de esta hora el grupo ya no puede subir el PDF. */
export const BASEDATOS_CIERRE: Record<string, { iso: string; texto: string }> = {
  "301": {
    iso: "2026-11-06T15:00:00-06:00",
    texto: "El archivo solo se puede subir hasta las 3:00 p. m. de hoy.",
  },
  "302": {
    iso: "2026-11-06T13:00:00-06:00",
    texto: "El archivo solo se puede subir hasta la 1:00 p. m. de hoy.",
  },
};

export function basedatosCierre(groupCode?: string | null, now = Date.now()) {
  const item = groupCode ? BASEDATOS_CIERRE[groupCode.trim()] : undefined;
  if (!item) return null;
  const until = new Date(item.iso).getTime();
  return { texto: item.texto, until, open: now < until };
}

export type BasedatosCheckItem = { id: string; text: string; letra: string; titulo: string };

export function basedatosCheckItems(): BasedatosCheckItem[] {
  return BASEDATOS_PRODUCTOS.flatMap((product) =>
    product.items.map((item) => ({
      id: item.id,
      text: item.text,
      letra: product.letra,
      titulo: product.titulo,
    })),
  );
}

const ROLE_LABEL: Record<string, string> = {
  product_owner: "Product Owner",
  scrum_master: "Scrum Master",
  developer: "Desarrollador",
  ui_designer: "Diseño / UI",
  qa_docs: "QA / Docs",
};

export function basedatosRoleLabel(role?: string | null) {
  if (!role) return "";
  return ROLE_LABEL[role] ?? role;
}

export type BasedatosNotePreset = {
  code: string;
  label: string;
  points: number;
  scope: "team" | "member";
};

export const BASEDATOS_NOTAS: BasedatosNotePreset[] = [
  { code: "no_trabaja", label: "No está trabajando", points: 500, scope: "member" },
  { code: "no_participa", label: "No participa", points: 500, scope: "member" },
  { code: "ruido", label: "Está haciendo ruido", points: 300, scope: "member" },
];

export function formatBasedatosSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
