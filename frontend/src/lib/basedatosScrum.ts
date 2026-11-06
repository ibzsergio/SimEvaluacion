export const BASEDATOS_TITULO = "La base de datos";
export const BASEDATOS_PROGRAMA = "Actividad Scrum · sala de cómputo";
export const BASEDATOS_ACTIVITY_NAME = "La base de datos";
export const BASEDATOS_FIRMAS_MAX = 1000;

export const BASEDATOS_CONTEXTO =
  "El proyecto es el sistema de asistencias e incidencias de una escuela, en Python y Tkinter. Las interfaces ya están. Hoy la base de datos tiene que sostener esas pantallas: quién usa cada función, con qué tablas, y quién hace el cambio si un dato se corrige.";

export const BASEDATOS_SISTEMA = [
  "Hay 6 grupos. Cada grupo tiene un docente asignado.",
  "El docente pasa lista y registra la asistencia de su grupo.",
  "El docente puede reportar una incidencia de conducta en su aula.",
  "El director ve las incidencias.",
  "El director ve las asistencias de cada docente.",
  "El director puede tomar una decisión.",
  "El director puede generar una carta compromiso.",
];

export const BASEDATOS_FUNCIONES = [
  {
    id: "lista",
    nombre: "Pasar lista",
    quien: "El docente del grupo",
    hace: "Registra la asistencia o la falta de los alumnos de su grupo.",
    cambio: "Si hay que corregir una asistencia, la corrige ese docente, en la tabla de asistencias.",
  },
  {
    id: "incidencia",
    nombre: "Reportar incidencia",
    quien: "El docente del aula",
    hace: "Registra un problema de conducta: qué pasó, a qué alumno, en qué grupo y qué día.",
    cambio: "Si el reporte se corrige, lo corrige el docente que lo registró, en la tabla de incidencias.",
  },
  {
    id: "ver-incidencias",
    nombre: "Ver incidencias",
    quien: "El director",
    hace: "Consulta las incidencias de los 6 grupos, con el docente que las reportó.",
    cambio: "El director consulta. El reporte lo modifica quien lo registró, el docente.",
  },
  {
    id: "ver-asistencias",
    nombre: "Ver asistencias por docente",
    quien: "El director",
    hace: "Consulta la asistencia de cada docente. Son 6 grupos y cada uno tiene su docente.",
    cambio: "Si un grupo cambia de docente, el cambio lo hace el director y toca la tabla donde el grupo tiene su docente.",
  },
  {
    id: "decision",
    nombre: "Tomar una decisión",
    quien: "El director",
    hace: "Registra qué decidió sobre una incidencia.",
    cambio: "Si la decisión cambia, la cambia el director, en la tabla de decisiones, ligada a esa incidencia.",
  },
  {
    id: "carta",
    nombre: "Carta compromiso",
    quien: "El director",
    hace: "Genera la carta compromiso a partir de la incidencia y de la decisión.",
    cambio: "Si hay que emitirla de nuevo, la vuelve a generar el director. La incidencia de origen se conserva.",
  },
] as const;

export const BASEDATOS_PREGUNTAS = [
  "Quién realiza esa función: el docente del grupo o el director.",
  "Con qué tablas de su modelo relacional se hace.",
  "Qué hace la función en la aplicación, con las pantallas que ya diseñaron.",
  "Si ese dato cambia, quién realiza el cambio y qué tablas se modifican.",
];

export const BASEDATOS_EQUIPO = [
  "Diagrama entidad-relación que cubra asistencias, incidencias, los 6 grupos con su docente, las decisiones y las cartas compromiso.",
  "Modelo relacional con las llaves que unen al alumno con su grupo, al grupo con su docente y la incidencia con la decisión y la carta.",
  "Esos productos ya se entregan por equipo. Hoy se corrigen si una pantalla no cabe en el modelo.",
];

export const BASEDATOS_CADA_QUIEN = [
  "Elige una función de la lista. En el equipo no se repite: las seis quedan cubiertas.",
  "En su computadora, un archivo .py. La primera línea lleva su nombre y el nombre de su función.",
  "Crea las tablas de esa función, con los nombres de su modelo. Mete datos de la escuela: grupos, su docente, alumnos, y el registro que esa función guarda o consulta.",
  "Escribe la consulta que usa esa pantalla y la corre.",
  "Abajo del programa deja escrito el cambio: quién lo realiza y qué tablas toca.",
];

export const BASEDATOS_SI_SOBRAN =
  "Si hay más personas que funciones, la siguiente toma el cambio de otra función y arma la consulta de esa pantalla. Si hay menos personas, alguien toma dos funciones. Dos personas no comparten el mismo archivo ni la misma computadora.";

export const BASEDATOS_ROLES = [
  {
    id: "product_owner",
    label: "Product Owner",
    tarea:
      "Además de su función, arma el cuadro del equipo: función, quién la realiza, tablas y, si hay un cambio, quién lo hace. Las seis funciones tienen que aparecer.",
  },
  {
    id: "scrum_master",
    label: "Scrum Master",
    tarea:
      "Reparte las funciones y pasa a cada computadora. Anota integrante, función y archivo. Si alguien no tiene su función abierta, lo sienta a trabajar.",
  },
  {
    id: "developer",
    label: "Desarrollador",
    tarea:
      "Junta en una sola base las tablas de las funciones: grupos, docentes, alumnos, asistencias, incidencias, decisiones y cartas. El programa la crea y no marca error.",
  },
  {
    id: "ui_designer",
    label: "Diseño / UI",
    tarea:
      "Conecta una pantalla que ya diseñaron: pasar lista, reportar incidencia, ver incidencias, ver asistencias, decidir o generar la carta. Guarda o muestra el dato de esa función.",
  },
  {
    id: "qa_docs",
    label: "QA / Docs",
    tarea:
      "Prueba tres casos: el docente registra la asistencia de su grupo, el docente reporta una incidencia y el director consulta los 6 grupos y genera la carta desde esa incidencia.",
  },
] as const;

export const BASEDATOS_BLOQUES = [
  {
    id: "hora1",
    nombre: "Primera hora — Su función",
    detalle:
      "El modelo está abierto. Cada quien elige una función, señala quién la realiza y qué tablas usa.",
  },
  {
    id: "hora2",
    nombre: "Segunda hora — La base de esa función",
    detalle:
      "Cada quien crea esas tablas, mete datos de los 6 grupos y corre la consulta de su pantalla.",
  },
  {
    id: "hora3",
    nombre: "Tercera hora — El cambio",
    detalle:
      "Cada quien escribe quién realiza un cambio y qué tablas se modifican. Diseño conecta una pantalla. Al cierre, cada quien muestra su función.",
  },
] as const;

export const BASEDATOS_EJEMPLO = `# Ana López · función: Pasar lista
import sqlite3
con = sqlite3.connect("basedatos.db")
cur = con.cursor()
cur.execute("""
CREATE TABLE IF NOT EXISTS asistencia (
  id INTEGER PRIMARY KEY,
  fecha TEXT NOT NULL,
  alumno TEXT NOT NULL,
  grupo TEXT NOT NULL,
  docente TEXT NOT NULL,
  estado TEXT NOT NULL
)
""")
cur.execute(
  "INSERT INTO asistencia (fecha, alumno, grupo, docente, estado) VALUES (?, ?, ?, ?, ?)",
  ("2026-11-06", "Lucía", "3 A", "Mtra. Peña", "Asistencia"),
)
consulta = cur.execute(
  "SELECT alumno, estado FROM asistencia WHERE grupo = ? AND docente = ?",
  ("3 A", "Mtra. Peña"),
)
print(consulta.fetchall())
con.commit()
con.close()
# Si cambia la asistencia, la corrige el docente de ese grupo, en la tabla asistencia.`;

export type BasedatosNotePreset = {
  code: string;
  label: string;
  points: number;
  scope: "team" | "member";
};

export const BASEDATOS_NOTAS: BasedatosNotePreset[] = [
  { code: "sin_archivo", label: "Sin archivo propio", points: 200, scope: "member" },
  { code: "no_corre", label: "No corre la función que le tocó", points: 200, scope: "member" },
  { code: "sin_cambio", label: "No dice quién hace el cambio", points: 200, scope: "member" },
  { code: "modelo", label: "La base no es de asistencias e incidencias", points: 250, scope: "team" },
  { code: "copia", label: "Dos personas, la misma función y el mismo archivo", points: 250, scope: "team" },
];

export function basedatosRoleLabel(role?: string | null) {
  if (!role) return "";
  return BASEDATOS_ROLES.find((item) => item.id === role)?.label ?? role;
}

export function basedatosRoleTask(role?: string | null) {
  return (
    BASEDATOS_ROLES.find((item) => item.id === role)?.tarea ??
    "Trabaja una función del sistema en su computadora: quién la realiza, qué tablas usa y quién hace el cambio."
  );
}
