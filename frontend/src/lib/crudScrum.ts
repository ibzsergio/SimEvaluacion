export const CRUD_TITULO = "TEST";
export const CRUD_PROGRAMA = "Actividad Scrum · individual";
export const CRUD_PDF_MAX_BYTES = 8 * 1024 * 1024;

export const CRUD_CONTEXTO =
  "TEST es el ejemplo: el formulario se llama TEST, la base se llama 302 y la tabla se llama test. Cada alumno crea otras 3 tablas en esa misma base y, al terminar, sube un PDF con las capturas de sus CRUD.";

export const CRUD_PASOS = [
  "Copia el ejemplo. TEST y la tabla test no se entregan.",
  "Crea otras 3 tablas en la base 302. Las tres usan la misma conexión.",
  "Cada tabla tiene su formulario, con 2 o 3 datos.",
  "Cada tabla guarda, consulta, actualiza y elimina.",
  "Sube un solo PDF con la carátula y las capturas de esas 3 tablas.",
];

export const CRUD_EVIDENCIAS = [
  "Un PDF por alumno, de máximo 8 MB. El ejemplo TEST no va en el archivo.",
  "Carátula con tu nombre completo, tu grupo, la fecha y el nombre de tus 3 tablas.",
  "Por cada tabla, cuatro capturas seguidas. En cada una se lee el nombre de la tabla y los datos.",
  "Guardar: el formulario con los datos escritos y el registro ya guardado en la lista o en MySQL.",
  "Consultar: la lista o el SELECT de esa tabla, con los registros a la vista.",
  "Actualizar: el mismo registro, con un dato cambiado, y se nota cuál cambió.",
  "Eliminar: la misma lista o consulta, ya sin ese registro.",
  "Si una captura está oscura, cortada o no se leen los datos, esa tabla no cuenta.",
];

export const CRUD_CHECKS = [
  { id: "caratula", text: "La carátula trae mi nombre completo, mi grupo, la fecha y el nombre de mis 3 tablas." },
  { id: "otras", text: "Mis 3 tablas son distintas de test. TEST queda solo como ejemplo." },
  { id: "guardar", text: "Por cada tabla hay una captura de Guardar: se ve el formulario y el registro ya guardado." },
  { id: "consultar", text: "Por cada tabla hay una captura de Consultar: se ve la lista o el SELECT con los registros." },
  { id: "actualizar", text: "Por cada tabla hay una captura de Actualizar: se ve el mismo registro con un dato cambiado." },
  { id: "eliminar", text: "Por cada tabla hay una captura de Eliminar: ese registro ya no aparece." },
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
    base = mysql.connector.connect(host="localhost", user="root", password="")
    cursor = base.cursor()
    cursor.execute("CREATE DATABASE IF NOT EXISTS \`302\`")
    cursor.close()
    base.close()
    return mysql.connector.connect(
        host="localhost",
        user="root",
        password="",
        database="302",
    )

def preparar():
    con = conectar()
    cur = con.cursor()
    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS test (
            id INT AUTO_INCREMENT PRIMARY KEY,
            nombre VARCHAR(40),
            correo VARCHAR(40),
            edad INT
        )
        """
    )
    con.commit()
    cur.close()
    con.close()

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

preparar()
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
