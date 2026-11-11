export const CRUD_TITULO = "TEST";
export const CRUD_PROGRAMA = "Actividad Scrum · equipo de proyecto";
export const CRUD_PDF_MAX_BYTES = 12 * 1024 * 1024;

export const CRUD_CONTEXTO =
  "TEST es el ejemplo: solo se conecta a la base 302 y usa la tabla test. El equipo escribe el script que crea la base y las tablas. El CRUD que se entrega es de las otras 5 tablas. Un integrante sube el PDF de todo el equipo.";

export const CRUD_PASOS = [
  "Escriban el script: crean la base 302, la tabla test y las 5 tablas de abajo.",
  "El ejemplo solo se conecta. No crea la base ni la tabla.",
  "Cada una de las 5 tablas tiene su formulario y su CRUD, con la misma conexión.",
  "Un integrante sube un solo PDF con el script y las capturas de las 5 tablas.",
];

export const CRUD_TABLA_EJEMPLO = {
  nombre: "test",
  uso: "Solo para que corra el ejemplo. No cuenta como entrega.",
  atributos: [
    { campo: "id", tipo: "INT", nota: "llave primaria, autoincrementable" },
    { campo: "nombre", tipo: "VARCHAR(40)", nota: "" },
    { campo: "correo", tipo: "VARCHAR(40)", nota: "" },
    { campo: "edad", tipo: "INT", nota: "" },
  ],
};

export const CRUD_TABLAS = [
  {
    nombre: "grupos",
    atributos: [
      { campo: "id_grupo", tipo: "INT", nota: "llave primaria" },
      { campo: "nombre", tipo: "VARCHAR(20)", nota: "" },
      { campo: "turno", tipo: "VARCHAR(15)", nota: "" },
    ],
  },
  {
    nombre: "docentes",
    atributos: [
      { campo: "id_docente", tipo: "INT", nota: "llave primaria" },
      { campo: "nombre", tipo: "VARCHAR(40)", nota: "" },
      { campo: "id_grupo", tipo: "INT", nota: "grupo que atiende" },
    ],
  },
  {
    nombre: "alumnos",
    atributos: [
      { campo: "id_alumno", tipo: "INT", nota: "llave primaria" },
      { campo: "nombre", tipo: "VARCHAR(40)", nota: "" },
      { campo: "apellido", tipo: "VARCHAR(40)", nota: "" },
      { campo: "id_grupo", tipo: "INT", nota: "su grupo" },
    ],
  },
  {
    nombre: "asistencias",
    atributos: [
      { campo: "id_asistencia", tipo: "INT", nota: "llave primaria" },
      { campo: "id_alumno", tipo: "INT", nota: "" },
      { campo: "fecha", tipo: "DATE", nota: "" },
      { campo: "estado", tipo: "VARCHAR(12)", nota: "presente, falta o retardo" },
    ],
  },
  {
    nombre: "incidencias",
    atributos: [
      { campo: "id_incidencia", tipo: "INT", nota: "llave primaria" },
      { campo: "id_alumno", tipo: "INT", nota: "" },
      { campo: "id_docente", tipo: "INT", nota: "" },
      { campo: "fecha", tipo: "DATE", nota: "" },
      { campo: "descripcion", tipo: "VARCHAR(100)", nota: "" },
    ],
  },
] as const;

export const CRUD_EVIDENCIAS = [
  "Un PDF por equipo, de máximo 12 MB. Lo sube un solo integrante.",
  "Carátula con el nombre del equipo, los integrantes, el grupo y la fecha.",
  "El script que crea la base 302, la tabla test y las 5 tablas, con los tipos de esta actividad.",
  "Por cada una de las 5 tablas, cuatro capturas. En cada una se lee el nombre de la tabla y los datos.",
  "Guardar: el formulario con los datos escritos y el registro ya guardado en la lista o en MySQL.",
  "Consultar: la lista o el SELECT de esa tabla, con los registros a la vista.",
  "Actualizar: el mismo registro, con un dato cambiado, y se nota cuál cambió.",
  "Eliminar: la misma lista o consulta, ya sin ese registro.",
  "La tabla test no se entrega. Si una captura no se lee, esa tabla no cuenta.",
];

export const CRUD_CHECKS = [
  { id: "caratula", text: "La carátula trae el equipo, los integrantes, el grupo y la fecha." },
  { id: "script", text: "El PDF trae el script que crea la base 302, la tabla test y las 5 tablas." },
  { id: "tablas", text: "Las 5 tablas son grupos, docentes, alumnos, asistencias e incidencias." },
  { id: "guardar", text: "Por cada una de las 5 tablas hay una captura de Guardar y el registro ya guardado." },
  { id: "consultar", text: "Por cada una hay una captura de Consultar, con la lista o el SELECT." },
  { id: "actualizar", text: "Por cada una hay una captura de Actualizar, con un dato cambiado." },
  { id: "eliminar", text: "Por cada una hay una captura de Eliminar, y ese registro ya no aparece." },
  { id: "legible", text: "En todas las capturas se lee el nombre de la tabla y los datos." },
] as const;

export function formatCrudSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export const CRUD_CODIGO = `import mysql.connector
import tkinter as tk
from tkinter import messagebox

def conectar():
    return mysql.connector.connect(
        host="localhost",
        user="root",
        password="",
        database="302",
    )

def guardar():
    con = conectar()
    cur = con.cursor()
    cur.execute(
        "INSERT INTO test (nombre, correo, edad) VALUES (%s, %s, %s)",
        (nombre.get(), correo.get(), edad.get()),
    )
    con.commit()
    cur.close()
    con.close()
    messagebox.showinfo("TEST", "Guardado")
    consultar()

def consultar():
    con = conectar()
    cur = con.cursor()
    cur.execute("SELECT id, nombre, correo, edad FROM test")
    filas = cur.fetchall()
    cur.close()
    con.close()
    lista.delete(0, tk.END)
    for fila in filas:
        lista.insert(tk.END, f"{fila[0]} | {fila[1]} | {fila[2]} | {fila[3]}")

def actualizar():
    con = conectar()
    cur = con.cursor()
    cur.execute(
        "UPDATE test SET nombre=%s, correo=%s, edad=%s WHERE id=%s",
        (nombre.get(), correo.get(), edad.get(), id_registro.get()),
    )
    con.commit()
    cur.close()
    con.close()
    messagebox.showinfo("TEST", "Actualizado")
    consultar()

def eliminar():
    con = conectar()
    cur = con.cursor()
    cur.execute("DELETE FROM test WHERE id=%s", (id_registro.get(),))
    con.commit()
    cur.close()
    con.close()
    messagebox.showinfo("TEST", "Eliminado")
    consultar()

ventana = tk.Tk()
ventana.title("TEST")
tk.Label(ventana, text="Id").grid(row=0, column=0, padx=6, pady=4)
id_registro = tk.Entry(ventana)
id_registro.grid(row=0, column=1, padx=6, pady=4)
tk.Label(ventana, text="Nombre").grid(row=1, column=0, padx=6, pady=4)
nombre = tk.Entry(ventana)
nombre.grid(row=1, column=1, padx=6, pady=4)
tk.Label(ventana, text="Correo").grid(row=2, column=0, padx=6, pady=4)
correo = tk.Entry(ventana)
correo.grid(row=2, column=1, padx=6, pady=4)
tk.Label(ventana, text="Edad").grid(row=3, column=0, padx=6, pady=4)
edad = tk.Entry(ventana)
edad.grid(row=3, column=1, padx=6, pady=4)
lista = tk.Listbox(ventana, width=42)
lista.grid(row=4, column=0, columnspan=2, padx=6, pady=6)
tk.Button(ventana, text="Guardar", command=guardar).grid(row=5, column=0, pady=4)
tk.Button(ventana, text="Consultar", command=consultar).grid(row=5, column=1, pady=4)
tk.Button(ventana, text="Actualizar", command=actualizar).grid(row=6, column=0, pady=4)
tk.Button(ventana, text="Eliminar", command=eliminar).grid(row=6, column=1, pady=4)
ventana.mainloop()
`;
