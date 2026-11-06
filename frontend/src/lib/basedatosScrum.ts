export const BASEDATOS_TITULO = "La base de datos";
export const BASEDATOS_PROGRAMA = "Actividad Scrum · sala de cómputo";
export const BASEDATOS_ACTIVITY_NAME = "La base de datos";
export const BASEDATOS_FIRMAS_MAX = 1000;

export const BASEDATOS_CONTEXTO =
  "El proyecto es una aplicación de Python y Tkinter para una escuela primaria. Las interfaces ya están. Ayer el equipo elaboró el diagrama entidad-relación y el modelo relacional: eso se entrega por equipo. Hoy, en la sala, cada integrante trabaja en su propia computadora.";

export const BASEDATOS_EQUIPO = [
  "Diagrama entidad-relación del proyecto, el que ya pidió el docente.",
  "Modelo relacional del mismo proyecto, con llaves primarias y foráneas.",
  "Esos dos productos no se reinventan hoy. Si una pantalla no cabe en el modelo, se corrige el modelo, no se inventa otra aplicación.",
];

export const BASEDATOS_CADA_QUIEN = [
  "Un archivo .py en su computadora. La primera línea es un comentario con su nombre.",
  "CREATE TABLE de una tabla del modelo relacional del equipo. La tabla no puede ser la misma que la de otro integrante.",
  "Cinco INSERT con datos de una escuela primaria: alumnos, maestros, grupos o calificaciones, según su tabla.",
  "Un SELECT que conteste una pregunta de esa escuela. Lo corre y el resultado se ve en la pantalla.",
];

export const BASEDATOS_SI_SOBRAN =
  "Si hay más personas que tablas, otra persona carga otros cinco registros distintos de esa tabla o conecta otra pantalla. Dos personas no comparten el mismo archivo ni la misma computadora.";

export const BASEDATOS_ROLES = [
  {
    id: "product_owner",
    label: "Product Owner",
    tarea:
      "Además de su archivo, escribe el diccionario: cada campo del modelo, su tipo, si es llave y un ejemplo de la primaria. Los nombres coinciden con el diagrama.",
  },
  {
    id: "scrum_master",
    label: "Scrum Master",
    tarea:
      "Además de su archivo, reparte las tablas y pasa a cada computadora. Anota integrante, tabla y nombre del archivo. Si alguien no tiene archivo abierto, lo sienta a trabajar.",
  },
  {
    id: "developer",
    label: "Desarrollador",
    tarea:
      "Además de su tabla, junta las tablas del equipo en una sola base SQLite, con llave primaria y foránea como en el modelo. El programa crea la base y no marca error.",
  },
  {
    id: "ui_designer",
    label: "Diseño / UI",
    tarea:
      "Además de su archivo, conecta una pantalla de Tkinter que ya diseñaron: guarda un registro y lo muestra en una lista. No dibuja otra interfaz.",
  },
  {
    id: "qa_docs",
    label: "QA / Docs",
    tarea:
      "Además de sus cinco registros, prueba tres fallos: llave repetida, campo obligatorio vacío y una foránea que no existe. Anota qué pasó en cada uno.",
  },
] as const;

export const BASEDATOS_BLOQUES = [
  {
    id: "hora1",
    nombre: "Primera hora — Su tabla",
    detalle:
      "El diagrama y el modelo están abiertos. Cada quien crea su archivo con su nombre y elige una tabla distinta.",
  },
  {
    id: "hora2",
    nombre: "Segunda hora — Datos y consulta",
    detalle:
      "Cada quien escribe los cinco registros de la primaria y una consulta. Lo corre en su computadora.",
  },
  {
    id: "hora3",
    nombre: "Tercera hora — Se ve en la aplicación",
    detalle:
      "El desarrollador junta la base. Diseño conecta una pantalla. QA prueba los tres fallos. Al cierre, cada quien muestra su pantalla dos minutos.",
  },
] as const;

export const BASEDATOS_EJEMPLO = `# Ana López
import sqlite3
con = sqlite3.connect("basedatos.db")
cur = con.cursor()
cur.execute("""
CREATE TABLE IF NOT EXISTS alumno (
  id INTEGER PRIMARY KEY,
  nombre TEXT NOT NULL,
  grado TEXT NOT NULL
)
""")
cur.execute(
  "INSERT INTO alumno (nombre, grado) VALUES (?, ?)",
  ("Lucía", "3 A"),
)
consulta = cur.execute(
  "SELECT nombre FROM alumno WHERE grado = ?",
  ("3 A",),
)
print(consulta.fetchall())
con.commit()
con.close()`;

export type BasedatosNotePreset = {
  code: string;
  label: string;
  points: number;
  scope: "team" | "member";
};

export const BASEDATOS_NOTAS: BasedatosNotePreset[] = [
  { code: "sin_archivo", label: "Sin archivo propio", points: 200, scope: "member" },
  { code: "no_corre", label: "No corre su tabla o su consulta", points: 200, scope: "member" },
  { code: "modelo", label: "No usan el modelo del equipo", points: 250, scope: "team" },
  { code: "copia", label: "Dos personas, el mismo archivo", points: 250, scope: "team" },
];

export function basedatosRoleLabel(role?: string | null) {
  if (!role) return "";
  return BASEDATOS_ROLES.find((item) => item.id === role)?.label ?? role;
}

export function basedatosRoleTask(role?: string | null) {
  return (
    BASEDATOS_ROLES.find((item) => item.id === role)?.tarea ??
    "Trabaja en su computadora: su tabla, sus cinco registros y su consulta. Nadie se queda mirando."
  );
}
