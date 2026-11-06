export const BASEDATOS_TITULO = "La base de datos";
export const BASEDATOS_PROGRAMA = "Actividad Scrum · hoy";
export const BASEDATOS_ACTIVITY_NAME = "La base de datos";
export const BASEDATOS_FIRMAS_MAX = 3000;
export const BASEDATOS_PDF_MAX_BYTES = 5 * 1024 * 1024;

export const BASEDATOS_CONTEXTO =
  "Hoy es el único día. El equipo entrega 4 productos, todos digitales, en un solo PDF. Vale 3000 puntos. Solo se sube un archivo por equipo y no puede pesar más de 5 MB.";

export const BASEDATOS_PRODUCTOS = [
  {
    id: "er",
    letra: "A",
    titulo: "Modelo entidad-relación",
    items: [
      { id: "er-titulo", text: "Tiene el título del proyecto." },
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
    titulo: "Modelo relacional en tablas",
    items: [
      { id: "rel-tablas", text: "Hay una tabla por cada entidad del modelo ER." },
      { id: "rel-tipos", text: "Cada columna tiene su tipo de dato." },
      { id: "rel-pk", text: "La llave primaria está marcada." },
      { id: "rel-fk", text: "Las llaves foráneas están marcadas." },
    ],
  },
  {
    id: "script",
    letra: "C",
    titulo: "Script de base de datos",
    items: [
      { id: "sql-tablas", text: "El script crea las tablas del modelo relacional." },
      { id: "sql-llaves", text: "El script incluye las llaves primarias y las foráneas." },
      { id: "sql-pdf", text: "El script va dentro del mismo PDF." },
    ],
  },
  {
    id: "interfaces",
    letra: "D",
    titulo: "Interfaces",
    items: [
      { id: "ui-alumno", text: "Muestra cómo agregar o administrar un alumno." },
      { id: "ui-docente", text: "Muestra cómo agregar o administrar un docente." },
      { id: "ui-pdf", text: "Esas pantallas van en el mismo PDF." },
    ],
  },
] as const;

export const BASEDATOS_REGLAS = [
  "Todo se entrega en digital.",
  "Los 4 productos van en un solo PDF.",
  "Un archivo por equipo.",
  "El PDF no pasa de 5 MB.",
  "Hoy es el único día.",
];

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
