export const CRUD_TITULO = "TEST";
export const CRUD_PROGRAMA = "Actividad Scrum · individual";

export const CRUD_CONTEXTO =
  "Cada alumno arma su formulario y su CRUD. La base se llama 302 y ahí viven las tres tablas. El ejemplo es el formulario TEST, con la tabla test y tres datos: nombre, correo y edad.";

export const CRUD_PASOS = [
  "Crea la base de datos 302. Las tres tablas van en esa misma base.",
  "La primera tabla puede ser test, como el ejemplo. Las otras dos las nombras tú.",
  "Cada tabla se llena desde un formulario con 2 o 3 datos.",
  "La conexión es la misma: host, usuario, contraseña y la base 302.",
  "Cada tabla guarda, consulta, actualiza y elimina.",
];

export const CRUD_CHECKS = [
  { id: "base", text: "La base se llama 302." },
  { id: "tablas", text: "En esa base hay 3 tablas." },
  { id: "datos", text: "Cada formulario pide 2 o 3 datos." },
  { id: "conexion", text: "La conexión usa la base 302." },
  { id: "crud", text: "Cada tabla guarda, consulta, actualiza y elimina." },
] as const;

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
