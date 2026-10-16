import { createWriteStream, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import PDFDocument from "pdfkit";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(__dirname, "..", "..", "docs");
const OUT_FILE = join(OUT_DIR, "Menus_de_opciones_en_Tkinter.pdf");

const C = {
  teal: "#0f766e",
  tealDark: "#134e4a",
  ink: "#0f172a",
  slate: "#334155",
  muted: "#64748b",
  line: "#cbd5e1",
  paper: "#f8fafc",
  codeBg: "#0f172a",
  codeFg: "#e2e8f0",
  amber: "#b45309",
  amberBg: "#fffbeb",
  white: "#ffffff",
  window: "#e2e8f0",
  titlebar: "#0f766e",
};

const MARGIN = 48;
const PAGE_W = 595.28;
const PAGE_H = 841.89;
const CONTENT_W = PAGE_W - MARGIN * 2;

function ensureSpace(doc: PDFKit.PDFDocument, need: number) {
  if (doc.y + need > PAGE_H - 56) doc.addPage();
}

function header(doc: PDFKit.PDFDocument) {
  doc.save();
  doc.rect(0, 0, PAGE_W, 36).fill(C.tealDark);
  doc.fillColor("#ccfbf1").font("Helvetica").fontSize(8);
  doc.text("CECYTEM  ·  Programación  ·  Python + Tkinter", MARGIN, 13, {
    width: CONTENT_W,
    align: "left",
  });
  doc.text("Menús de opciones", MARGIN, 13, { width: CONTENT_W, align: "right" });
  doc.restore();
  doc.y = 52;
}

function footer(doc: PDFKit.PDFDocument) {
  const range = doc.bufferedPageRange();
  for (let i = 0; i < range.count; i += 1) {
    doc.switchToPage(range.start + i);
    doc.save();
    doc.fillColor(i === 0 ? "#99f6e4" : C.muted).font("Helvetica").fontSize(8);
    doc.text(`Página ${i + 1} de ${range.count}`, MARGIN, PAGE_H - 32, {
      width: CONTENT_W,
      align: "center",
    });
    doc.restore();
  }
}

function h1(doc: PDFKit.PDFDocument, text: string) {
  ensureSpace(doc, 36);
  doc.fillColor(C.tealDark).font("Helvetica-Bold").fontSize(16).text(text, MARGIN, doc.y, {
    width: CONTENT_W,
  });
  doc.moveDown(0.35);
  doc.save();
  const y = doc.y;
  doc.rect(MARGIN, y, 72, 3).fill(C.teal);
  doc.restore();
  doc.moveDown(0.8);
}

function h2(doc: PDFKit.PDFDocument, text: string) {
  ensureSpace(doc, 28);
  doc.fillColor(C.teal).font("Helvetica-Bold").fontSize(12).text(text, MARGIN, doc.y, {
    width: CONTENT_W,
  });
  doc.moveDown(0.4);
}

function para(doc: PDFKit.PDFDocument, text: string) {
  ensureSpace(doc, 40);
  doc.fillColor(C.slate).font("Helvetica").fontSize(10).text(text, MARGIN, doc.y, {
    width: CONTENT_W,
    align: "justify",
    lineGap: 2,
  });
  doc.moveDown(0.55);
}

function bullet(doc: PDFKit.PDFDocument, items: string[]) {
  for (const item of items) {
    ensureSpace(doc, 22);
    const x = MARGIN + 10;
    doc.fillColor(C.teal).circle(MARGIN + 3, doc.y + 5, 2).fill();
    doc.fillColor(C.slate).font("Helvetica").fontSize(10).text(item, x, doc.y, {
      width: CONTENT_W - 10,
      lineGap: 1.5,
    });
    doc.moveDown(0.28);
  }
  doc.moveDown(0.25);
}

function note(doc: PDFKit.PDFDocument, title: string, body: string) {
  ensureSpace(doc, 70);
  const start = doc.y;
  doc.font("Helvetica").fontSize(9);
  const h = doc.heightOfString(body, { width: CONTENT_W - 24 }) + 28;
  doc.save();
  doc.roundedRect(MARGIN, start, CONTENT_W, h, 6).fill(C.amberBg);
  doc.restore();
  doc.fillColor(C.amber).font("Helvetica-Bold").fontSize(9).text(title, MARGIN + 12, start + 8, {
    width: CONTENT_W - 24,
  });
  doc.fillColor(C.slate).font("Helvetica").fontSize(9).text(body, MARGIN + 12, start + 22, {
    width: CONTENT_W - 24,
  });
  doc.y = start + h + 10;
}

function codeBlock(doc: PDFKit.PDFDocument, code: string) {
  const lines = code.replace(/\r\n/g, "\n").split("\n");
  const lineH = 11;
  const pad = 10;
  const maxY = PAGE_H - 56;
  let i = 0;
  while (i < lines.length) {
    const available = maxY - doc.y;
    const fit = Math.max(1, Math.floor((available - pad * 2) / lineH));
    if (available < pad * 2 + lineH * 3 && i > 0) {
      doc.addPage();
      continue;
    }
    const chunk = lines.slice(i, i + fit);
    const h = chunk.length * lineH + pad * 2;
    if (doc.y + h > maxY) {
      doc.addPage();
      continue;
    }
    const start = doc.y;
    doc.save();
    doc.roundedRect(MARGIN, start, CONTENT_W, h, 6).fill(C.codeBg);
    doc.restore();
    doc.fillColor(C.codeFg).font("Courier").fontSize(8);
    let y = start + pad;
    for (const line of chunk) {
      doc.text(line.length ? line : " ", MARGIN + 12, y, { width: CONTENT_W - 24, lineBreak: false });
      y += lineH;
    }
    doc.y = start + h + 8;
    i += chunk.length;
  }
  doc.font("Helvetica");
}

function drawWindow(
  doc: PDFKit.PDFDocument,
  x: number,
  y: number,
  w: number,
  h: number,
  title: string,
) {
  doc.save();
  doc.roundedRect(x, y, w, h, 6).fill(C.window);
  doc.rect(x, y, w, 22).fill(C.titlebar);
  doc.fillColor("#ecfdf5").font("Helvetica-Bold").fontSize(8).text(title, x + 8, y + 7, {
    width: w - 16,
  });
  doc.restore();
}

function drawMenuBarGraphic(doc: PDFKit.PDFDocument) {
  ensureSpace(doc, 168);
  const x = MARGIN;
  const y = doc.y;
  const w = CONTENT_W;
  drawWindow(doc, x, y, w, 158, "MiAppTkinter — barra de menú");
  const barY = y + 22;
  doc.rect(x, barY, w, 22).fill("#ccfbf1");
  const labels = ["Archivo", "Editar", "Ver", "Ayuda"];
  labels.forEach((lab, i) => {
    const lx = x + 10 + i * 70;
    if (i === 0) {
      doc.roundedRect(lx - 4, barY + 3, 58, 16, 3).fill(C.teal);
      doc.fillColor("#ecfdf5").font("Helvetica-Bold").fontSize(8).text(lab, lx, barY + 7);
    } else {
      doc.fillColor(C.tealDark).font("Helvetica-Bold").fontSize(8).text(lab, lx, barY + 7);
    }
  });
  doc.roundedRect(x + 10, barY + 24, 130, 96, 4).fill(C.white).strokeColor(C.line).lineWidth(0.8).stroke();
  const items = ["Nuevo", "Abrir…", "─────────", "Guardar", "Salir"];
  items.forEach((it, i) => {
    const iy = barY + 32 + i * 16;
    if (it.startsWith("─")) {
      doc.moveTo(x + 18, iy + 6).lineTo(x + 132, iy + 6).strokeColor(C.line).stroke();
    } else {
      doc.fillColor(C.ink).font("Helvetica").fontSize(8).text(it, x + 20, iy);
    }
  });
  doc.fillColor(C.muted).font("Helvetica").fontSize(8).text(
    "La barra vive arriba. Un clic en Archivo abre un menú desplegable (cascade).",
    x + 150,
    barY + 40,
    { width: w - 170 },
  );
  doc.y = y + 168;
}

function drawOptionMenuGraphic(doc: PDFKit.PDFDocument) {
  ensureSpace(doc, 150);
  const x = MARGIN;
  const y = doc.y;
  const w = CONTENT_W;
  drawWindow(doc, x, y, w, 140, "MiAppTkinter — OptionMenu (menú de opciones)");
  doc.fillColor(C.tealDark).font("Helvetica-Bold").fontSize(9).text("Turno:", x + 16, y + 36);
  doc.roundedRect(x + 70, y + 32, 160, 22, 4).fill(C.white).strokeColor(C.teal).lineWidth(1).stroke();
  doc.fillColor(C.ink).font("Helvetica").fontSize(9).text("Matutino", x + 80, y + 38);
  doc.fillColor(C.teal).font("Helvetica-Bold").fontSize(10).text("▾", x + 210, y + 36);
  doc.roundedRect(x + 70, y + 54, 160, 66, 4).fill(C.white).strokeColor(C.line).lineWidth(0.8).stroke();
  ["Matutino", "Vespertino", "Mixto"].forEach((opt, i) => {
    const oy = y + 60 + i * 18;
    if (i === 0) doc.rect(x + 72, oy - 2, 156, 16).fill("#ccfbf1");
    doc.fillColor(C.ink).font("Helvetica").fontSize(8).text(opt, x + 80, oy);
  });
  doc.fillColor(C.muted).font("Helvetica").fontSize(8).text(
    "OptionMenu muestra UNA opción a la vez. El valor elegido se guarda en un StringVar. Es exclusión mutua: no puedes marcar dos turnos.",
    x + 250,
    y + 40,
    { width: w - 270 },
  );
  doc.y = y + 150;
}

function drawPopupGraphic(doc: PDFKit.PDFDocument) {
  ensureSpace(doc, 140);
  const x = MARGIN;
  const y = doc.y;
  const w = CONTENT_W;
  drawWindow(doc, x, y, w, 128, "Clic derecho — menú emergente (popup)");
  doc.roundedRect(x + 40, y + 40, 200, 70, 4).fill("#fff7ed").strokeColor("#fdba74").lineWidth(0.8).stroke();
  doc.fillColor(C.amber).font("Helvetica").fontSize(8).text("Área de trabajo (clic derecho aquí)", x + 52, y + 70, {
    width: 176,
  });
  doc.roundedRect(x + 160, y + 48, 120, 70, 4).fill(C.white).strokeColor(C.line).lineWidth(0.8).stroke();
  ["Copiar", "Pegar", "─────────", "Eliminar"].forEach((it, i) => {
    const iy = y + 56 + i * 14;
    if (it.startsWith("─")) {
      doc.moveTo(x + 168, iy + 5).lineTo(x + 272, iy + 5).strokeColor(C.line).stroke();
    } else {
      doc.fillColor(C.ink).font("Helvetica").fontSize(8).text(it, x + 172, iy);
    }
  });
  doc.fillColor(C.muted).font("Helvetica").fontSize(8).text(
    "Se enlaza con bind(\"<Button-3>\", …). En Windows el clic derecho es el botón 3.",
    x + 300,
    y + 56,
    { width: w - 320 },
  );
  doc.y = y + 138;
}

function cover(doc: PDFKit.PDFDocument) {
  doc.save();
  doc.rect(0, 0, PAGE_W, PAGE_H).fill(C.tealDark);
  doc.rect(0, 120, PAGE_W, 8).fill(C.teal);
  doc.fillColor("#ccfbf1").font("Helvetica").fontSize(11).text("Material de clase  ·  Python + Tkinter", MARGIN, 160, {
    width: CONTENT_W,
  });
  doc.fillColor(C.white).font("Helvetica-Bold").fontSize(28).text("Menús de opciones\nen Tkinter", MARGIN, 190, {
    width: CONTENT_W,
  });
  doc.fillColor("#99f6e4").font("Helvetica").fontSize(12).text(
    "Conceptos, tipos de menú, ejemplos gráficos y código\npara construir ventanas con opciones claras.",
    MARGIN,
    280,
    { width: CONTENT_W },
  );
  doc.fillColor("#ccfbf1").font("Helvetica").fontSize(10).text(
    "CECYTEM  ·  Programación\nUso en el salón: lectura, análisis y práctica en el compilador.",
    MARGIN,
    720,
    { width: CONTENT_W },
  );
  doc.restore();
}

function build(doc: PDFKit.PDFDocument) {
  cover(doc);
  doc.addPage();

  h1(doc, "1. ¿Qué es un menú de opciones?");
  para(
    doc,
    "Un menú es una lista de decisiones que el usuario puede tomar sin llenar la ventana de botones. En una aplicación de escritorio (Python + Tkinter) el menú organiza acciones: abrir, guardar, elegir un turno, cambiar el tema o disparar un comando. El usuario lee el menú antes de leer el código: si el menú no se entiende en cinco segundos, el diseño falló.",
  );
  para(
    doc,
    "En Tkinter no hay “un solo widget llamado menú”. Hay tres piezas que se confunden y hay que distinguir desde el principio:",
  );
  bullet(doc, [
    "Menu — la lista en sí (barra superior, submenú o menú emergente).",
    "OptionMenu — el menú de opciones clásico: una caja que muestra el valor actual y se abre hacia abajo. Es el más usado para “elige una de estas”.",
    "Menubutton — un botón que, al pulsarlo, despliega un Menu. Menos usado hoy; OptionMenu cubre casi el mismo caso.",
  ]);
  note(
    doc,
    "Idea principal",
    "Radiobutton y OptionMenu resuelven exclusión mutua (una sola respuesta). Checkbutton acumula varias marcas. Menu con command dispara una acción. Si mezclas esos papeles, el usuario cree una cosa y el programa hace otra.",
  );

  h1(doc, "2. Conceptos que hay que nombrar");
  h2(doc, "Ventana, variable y comando");
  para(
    doc,
    "Toda interfaz Tkinter se lee en tres estaciones: qué ve el usuario, qué se guarda, qué ocurre al elegir. En menús esas estaciones son concretas:",
  );
  bullet(doc, [
    "Ventana (Tk o Toplevel): el contenedor. El menú de barra se cuelga con config(menu=…).",
    "Variable de control (StringVar, BooleanVar, IntVar): el canal. OptionMenu y los ítems radio/check leen y escriben ahí.",
    "command= : la función que se ejecuta al elegir. Sin command, el clic no deja huella visible.",
  ]);
  h2(doc, "tearoff (el menú que se “arranca”)");
  para(
    doc,
    "Por defecto un Menu de Tkinter nace con una línea punteada arriba (tearoff=1). Si el usuario la pulsa, el menú se desprende en una ventanita. En aplicaciones escolares casi siempre se apaga: Menu(ventana, tearoff=0). Si no lo apagas, el menú “se ve raro” y no es un error de pack: es el tearoff.",
  );
  h2(doc, "add_… : cómo se llena un Menu");
  para(doc, "Un Menu vacío no sirve. Se llena con métodos add_*:");
  bullet(doc, [
    "add_command(label=…, command=…) — una acción (Guardar, Salir).",
    "add_cascade(label=…, menu=…) — un submenú (Archivo → Abrir / Guardar).",
    "add_separator() — una raya para agrupar.",
    "add_checkbutton(label=…, variable=…) — sí/no independiente (Negrita, Mostrar cuadrícula).",
    "add_radiobutton(label=…, variable=…, value=…) — una sola opción del grupo (Tema claro / oscuro).",
  ]);

  h1(doc, "3. Tipos de menú (mapa del tema)");
  para(doc, "Estos son los tipos que debes poder reconocer en una ventana y nombrar en un organizador gráfico:");
  bullet(doc, [
    "Barra de menú (menubar): Archivo, Editar, Ayuda. Vive arriba de la ventana.",
    "Submenú (cascade): un menú dentro de otro (Archivo → Exportar → PDF / CSV).",
    "Menú de opciones (OptionMenu): lista desplegable de valores. Una sola elección.",
    "Menú emergente (popup / contextual): aparece con clic derecho sobre un recuadro.",
    "Ítems de estado: check (varias marcas) y radio (una marca del grupo).",
    "Menubutton: botón-menú, útil si no quieres barra superior.",
  ]);

  h2(doc, "3.1 Barra de menú — lectura visual");
  drawMenuBarGraphic(doc);
  para(
    doc,
    "La barra no se empaqueta con pack/grid como un Button. Se asigna a la ventana: ventana.config(menu=barra). Cada palabra de la barra es un cascade a otro Menu. Salir debe llamar a ventana.destroy o quit.",
  );

  h2(doc, "3.2 OptionMenu — el menú de opciones");
  drawOptionMenuGraphic(doc);
  para(
    doc,
    "OptionMenu(padre, variable, opción1, opción2, …) exige un StringVar ya creado y con .set() inicial. Si arrancas en blanco, el usuario no sabe qué está elegido. Las opciones deben tener valores distintos: dos textos iguales confunden; dos values iguales hacen que el programa no distinga aunque la pantalla se vea distinta.",
  );
  note(
    doc,
    "Frontera con Radiobutton",
    "Si hay 2 o 3 opciones fijas y quieres verlas todas a la vez, usa Radiobutton. Si hay 4 o más, o quieres ahorrar espacio, usa OptionMenu. Ambos son exclusión mutua. No uses Checkbutton para un turno matutino/vespertino.",
  );

  h2(doc, "3.3 Menú emergente (clic derecho)");
  drawPopupGraphic(doc);

  h1(doc, "4. Ejemplo gráfico: qué debe verse");
  para(
    doc,
    "Una ventana mínima de menús para el plantel puede tener: barra Archivo/Ver, un OptionMenu de turno y un recuadro que acepte clic derecho. El Label de resultado demuestra que el menú no es decoración: el dato sí viajó.",
  );
  ensureSpace(doc, 200);
  {
    const x = MARGIN;
    const y = doc.y;
    const w = CONTENT_W;
    drawWindow(doc, x, y, w, 188, "Control escolar — prototipo de menús");
    doc.rect(x, y + 22, w, 20).fill("#ccfbf1");
    doc.fillColor(C.tealDark).font("Helvetica-Bold").fontSize(8).text("Archivo     Ver     Ayuda", x + 12, y + 28);
    doc.fillColor(C.ink).font("Helvetica").fontSize(9).text("Alumno:", x + 16, y + 56);
    doc.roundedRect(x + 70, y + 52, 180, 20, 3).fill(C.white).strokeColor(C.line).stroke();
    doc.fillColor(C.muted).font("Helvetica").fontSize(8).text("Nombre…", x + 78, y + 57);
    doc.fillColor(C.ink).font("Helvetica").fontSize(9).text("Turno:", x + 16, y + 84);
    doc.roundedRect(x + 70, y + 80, 140, 20, 3).fill(C.white).strokeColor(C.teal).stroke();
    doc.fillColor(C.ink).font("Helvetica").fontSize(8).text("Matutino  ▾", x + 78, y + 85);
    doc.roundedRect(x + 16, y + 112, w - 32, 56, 4).fill("#ecfeff");
    doc.fillColor(C.tealDark).font("Helvetica").fontSize(8).text(
      "Resultado: se eligió turno Matutino. Clic derecho aquí para copiar/limpiar.",
      x + 24,
      y + 132,
      { width: w - 48 },
    );
    doc.y = y + 200;
  }

  h1(doc, "5. Código: barra de menú");
  para(doc, "Copia este ejemplo en el compilador. Primero la barra; luego prueba Salir y el mensaje de Acerca de.");
  codeBlock(
    doc,
    `import tkinter as tk
from tkinter import messagebox

ventana = tk.Tk()
ventana.title("Barra de menú")
ventana.geometry("420x240")

def nuevo():
    messagebox.showinfo("Archivo", "Nuevo documento (aún vacío).")

def acerca():
    messagebox.showinfo("Ayuda", "Ejemplo de menú — CECYTEM")

barra = tk.Menu(ventana, tearoff=0)
menu_archivo = tk.Menu(barra, tearoff=0)
menu_archivo.add_command(label="Nuevo", command=nuevo)
menu_archivo.add_separator()
menu_archivo.add_command(label="Salir", command=ventana.destroy)

menu_ayuda = tk.Menu(barra, tearoff=0)
menu_ayuda.add_command(label="Acerca de", command=acerca)

barra.add_cascade(label="Archivo", menu=menu_archivo)
barra.add_cascade(label="Ayuda", menu=menu_ayuda)
ventana.config(menu=barra)

ventana.mainloop()`,
  );

  h1(doc, "6. Código: OptionMenu (menú de opciones)");
  para(
    doc,
    "Este es el menú de opciones: el usuario elige un valor, se guarda en un StringVar y un Label lo muestra. El command se dispara cada vez que cambia la opción.",
  );
  codeBlock(
    doc,
    `import tkinter as tk

ventana = tk.Tk()
ventana.title("Menú de opciones")
ventana.geometry("420x220")

turno = tk.StringVar(value="Matutino")
salida = tk.StringVar(value="Elegido: Matutino")

def al_cambiar(*_args):
    salida.set("Elegido: " + turno.get())

tk.Label(ventana, text="Turno del alumno:").pack(anchor="w", padx=16, pady=(16, 4))
opciones = ("Matutino", "Vespertino", "Mixto")
menu = tk.OptionMenu(ventana, turno, *opciones, command=al_cambiar)
menu.config(width=18)
menu.pack(anchor="w", padx=16)

tk.Label(ventana, textvariable=salida, fg="#0f766e").pack(anchor="w", padx=16, pady=12)
ventana.mainloop()`,
  );
  note(
    doc,
    "Detalle de código",
    "El asterisco en *opciones desempaqueta la tupla: OptionMenu necesita cada opción como argumento suelto, no una lista entera. Olvidar el StringVar o el .set() inicial deja el menú en blanco.",
  );

  h1(doc, "7. Código: check y radio dentro de un menú");
  para(
    doc,
    "Ver puede llevar checks (varias marcas a la vez) y un grupo radio (un solo tema). El Label de abajo refleja el estado. Eso demuestra comprensión: el menú escribe variables, el Label las lee.",
  );
  codeBlock(
    doc,
    `import tkinter as tk

ventana = tk.Tk()
ventana.title("Check y radio en el menú")
ventana.geometry("460x240")

negrita = tk.BooleanVar(value=False)
cuadricula = tk.BooleanVar(value=True)
tema = tk.StringVar(value="claro")
estado = tk.StringVar()

def refrescar():
    n = "sí" if negrita.get() else "no"
    c = "sí" if cuadricula.get() else "no"
    estado.set(f"Negrita: {n}  |  Cuadrícula: {c}  |  Tema: {tema.get()}")

refrescar()
barra = tk.Menu(ventana, tearoff=0)
menu_ver = tk.Menu(barra, tearoff=0)
menu_ver.add_checkbutton(label="Negrita", variable=negrita, command=refrescar)
menu_ver.add_checkbutton(label="Cuadrícula", variable=cuadricula, command=refrescar)
menu_ver.add_separator()
menu_ver.add_radiobutton(label="Tema claro", variable=tema, value="claro", command=refrescar)
menu_ver.add_radiobutton(label="Tema oscuro", variable=tema, value="oscuro", command=refrescar)
barra.add_cascade(label="Ver", menu=menu_ver)
ventana.config(menu=barra)

tk.Label(ventana, textvariable=estado, pady=24).pack()
ventana.mainloop()`,
  );

  h1(doc, "8. Código: menú emergente (clic derecho)");
  para(
    doc,
    "El popup no se asigna con config(menu=…). Se crea un Menu y se muestra con popup.tk_popup(event.x_root, event.y_root) al recibir Button-3. grab_release() evita que el menú “se quede pegado”.",
  );
  codeBlock(
    doc,
    `import tkinter as tk

ventana = tk.Tk()
ventana.title("Menú emergente")
ventana.geometry("420x240")

texto = tk.Text(ventana, height=8, wrap="word")
texto.pack(fill="both", expand=True, padx=12, pady=12)
texto.insert("1.0", "Selecciona este texto y da clic derecho.")

popup = tk.Menu(ventana, tearoff=0)
popup.add_command(label="Copiar", command=lambda: ventana.event_generate("<<Copy>>"))
popup.add_command(label="Pegar", command=lambda: ventana.event_generate("<<Paste>>"))
popup.add_separator()
popup.add_command(label="Limpiar", command=lambda: texto.delete("1.0", "end"))

def mostrar_popup(event):
    try:
        popup.tk_popup(event.x_root, event.y_root)
    finally:
        popup.grab_release()

texto.bind("<Button-3>", mostrar_popup)
ventana.mainloop()`,
  );

  h1(doc, "9. Código: un programa que junta los tres tipos");
  para(
    doc,
    "Barra + OptionMenu + popup. Es el cierre de la lectura: si puedes explicar cada pieza en voz alta, comprendiste el tema. Si solo copias el código, el organizador gráfico saldrá vacío.",
  );
  codeBlock(
    doc,
    `import tkinter as tk
from tkinter import messagebox

ventana = tk.Tk()
ventana.title("Menús — caso escolar")
ventana.geometry("480x280")

turno = tk.StringVar(value="Matutino")
aviso = tk.StringVar(value="Listo. Elige turno o usa el menú.")

def guardar():
    messagebox.showinfo("Archivo", "Se habría guardado el turno " + turno.get())

def al_turno(_val):
    aviso.set("Turno elegido: " + turno.get())

barra = tk.Menu(ventana, tearoff=0)
m_arch = tk.Menu(barra, tearoff=0)
m_arch.add_command(label="Guardar", command=guardar)
m_arch.add_command(label="Salir", command=ventana.destroy)
barra.add_cascade(label="Archivo", menu=m_arch)
ventana.config(menu=barra)

tk.Label(ventana, text="Turno:").pack(anchor="w", padx=16, pady=(16, 4))
tk.OptionMenu(ventana, turno, "Matutino", "Vespertino", "Mixto",
              command=al_turno).pack(anchor="w", padx=16)

caja = tk.Label(ventana, textvariable=aviso, bg="#ecfeff", pady=16)
caja.pack(fill="x", padx=16, pady=16)

pop = tk.Menu(ventana, tearoff=0)
pop.add_command(label="Matutino", command=lambda: (turno.set("Matutino"), al_turno("")))
pop.add_command(label="Vespertino", command=lambda: (turno.set("Vespertino"), al_turno("")))

def popup(e):
    try:
        pop.tk_popup(e.x_root, e.y_root)
    finally:
        pop.grab_release()

caja.bind("<Button-3>", popup)
ventana.mainloop()`,
  );

  h1(doc, "10. Errores típicos (se ven / no se ven)");
  bullet(doc, [
    "Olvidar tearoff=0: aparece una línea punteada rara. Arreglo: Menu(..., tearoff=0).",
    "No hacer ventana.config(menu=barra): “no se ve el menú”. El widget existe, nadie lo colgó.",
    "OptionMenu sin StringVar o sin .set(): caja vacía. El estado inicial también se lee.",
    "Pasar la lista sin asterisco: OptionMenu(f, var, opciones) falla o muestra mal. Usa *opciones.",
    "Checks con la misma variable: dejan de ser independientes. Cada check tiene su BooleanVar.",
    "Radios sin el mismo variable: ya no son un grupo y se pueden marcar varios.",
    "Popup sin bind Button-3: el menú existe en memoria y nunca aparece. Hay que enlazarlo.",
    "command= que no actualiza un Label: el usuario cree que “no hizo nada”. Siempre deja huella visible.",
  ]);
  note(
    doc,
    "Criterio de comprensión",
    "Si un compañero de otro equipo puede decir qué widget usarías para turno, para Negrita y para Salir —y por qué—, el tema se entendió. Si todo le parece “un menú”, todavía no hay análisis.",
  );

  h1(doc, "11. Mini práctica (para el salón)");
  para(doc, "En 15–20 minutos, en equipos de proyecto:");
  bullet(doc, [
    "Una ventana con barra Archivo (Guardar / Salir) y Ayuda (Acerca de).",
    "Un OptionMenu con al menos tres opciones de su propio proyecto (no copien “turno” si su app es otra).",
    "Un Label que muestre la opción elegida.",
    "Un popup con clic derecho que repita dos de esas opciones.",
    "tearoff apagado en todos los Menu.",
  ]);
  para(
    doc,
    "Al exponer: no lean el código renglón por renglón. Señalen barra, OptionMenu y popup, y digan qué variable comparte cada uno. Esa frase es la evidencia de que leyeron para programar, no para llenar minutos.",
  );

  h1(doc, "12. Glosario rápido");
  bullet(doc, [
    "cascade — menú colgado de otro menú (la palabra de la barra).",
    "command — acción al elegir un renglón.",
    "OptionMenu — menú de opciones (una de varias, en una caja).",
    "popup / tk_popup — menú que aparece en las coordenadas del clic.",
    "StringVar / BooleanVar / IntVar — canal entre el control y el programa.",
    "tearoff — menú desprendible; en clase casi siempre va en 0.",
    "value — valor que escribe un radiobutton al elegirse.",
  ]);
  para(
    doc,
    "Siguiente paso natural: conectar el valor del OptionMenu a un archivo .txt o a otra ventana (Toplevel). El menú decide; el resto del programa obedece.",
  );
}

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });
  const doc = new PDFDocument({
    size: "A4",
    margin: MARGIN,
    bufferPages: true,
    info: {
      Title: "Menús de opciones en Tkinter",
      Author: "SimEvaluación · CECYTEM",
      Subject: "Conceptos, tipos, ejemplos gráficos y código",
    },
  });
  const stream = createWriteStream(OUT_FILE);
  doc.pipe(stream);
  doc.on("pageAdded", () => header(doc));
  build(doc);
  footer(doc);
  doc.end();
  await new Promise<void>((resolve, reject) => {
    stream.on("finish", () => resolve());
    stream.on("error", reject);
  });
  console.log(OUT_FILE);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
