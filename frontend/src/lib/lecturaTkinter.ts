/** Lectura colaborativa: Frames y Radiobuttons en Tkinter. Colores = paleta de butacas. */

export const LECTURA_PROGRAMA = "Leer lo cambia todo";
export const LECTURA_TEMA = "Frames y botones de opción en Tkinter";
export const LECTURA_MINUTOS = 50;

export const LECTURA_COLORES = [
  { name: "Rosa", hex: "#f472b6", columna: "A" },
  { name: "Cian", hex: "#22d3ee", columna: "B" },
  { name: "Ámbar", hex: "#fbbf24", columna: "C" },
  { name: "Verde", hex: "#34d399", columna: "D" },
  { name: "Violeta", hex: "#a78bfa", columna: "E" },
  { name: "Naranja", hex: "#fb923c", columna: "F" },
] as const;

export type LecturaColorName = (typeof LECTURA_COLORES)[number]["name"];

export type LecturaBloque = {
  colorName: LecturaColorName;
  hex: string;
  columna: string;
  titulo: string;
  mision: string;
  texto: string;
  clave: string[];
  preguntaGuia: string;
};

export const LECTURA_BLOQUES: LecturaBloque[] = [
  {
    colorName: "Rosa",
    hex: "#f472b6",
    columna: "A",
    titulo: "La ventana no se improvisa: se organiza en cajas",
    mision: "Explicar qué es un Frame y por qué existe.",
    texto:
      "Cuando abres un programa con interfaz gráfica, no estás viendo un montón de botones sueltos pegados al azar. Estás viendo un sistema de cajas. En Tkinter, la ventana principal (Tk o Toplevel) es el contenedor mayor. Dentro de ella puedes colocar widgets —etiquetas, entradas, botones— pero si los tiras todos sobre la ventana, el diseño se vuelve frágil: un cambio mueve todo, y mezclar formas de acomodo provoca errores. El Frame es un widget cuya única misión es contener a otros. Piensa en una caja de cartón: no “hace” la tarea del usuario, pero agrupa lo que sí la hace. Un Frame de título, otro de formulario, otro de botones de acción. Así, cada zona tiene su propio orden interno. Leer código de interfaces es, en el fondo, leer arquitectura: quién contiene a quién. Si no ves las cajas, no entiendes la ventana.",
    clave: ["Frame", "contenedor", "ventana principal", "agrupar widgets"],
    preguntaGuia: "Si el Frame no calcula ni guarda datos, ¿para qué sirve entonces?",
  },
  {
    colorName: "Cian",
    hex: "#22d3ee",
    columna: "B",
    titulo: "Tres lenguajes de acomodo (y una sola caja a la vez)",
    mision: "Distinguir pack, grid y place, y la regla de no mezclarlos.",
    texto:
      "Tkinter no adivina dónde quieres cada control. Tú se lo dices con un gestor de geometría. pack() apila widgets como bloques: arriba, abajo, izquierda, derecha, y puede expandirlos. grid() piensa en filas y columnas, ideal para formularios. place() usa coordenadas exactas; es preciso, pero rígido si la ventana cambia de tamaño. La regla de oro cabe en una frase: no mezcles pack y grid dentro del mismo contenedor. La ventana puede usar pack para colocar tres Frames, y cada Frame puede usar grid por dentro. Eso no es mezclar: cada caja habla un solo idioma. Si un alumno “no le aparece el botón”, muchas veces el widget sí existe, pero nadie lo acomodó, o dos gestores pelearon por el mismo padre. Leer una interfaz es leer estas decisiones: qué caja, qué idioma, qué hijo.",
    clave: ["pack", "grid", "place", "no mezclar en el mismo padre"],
    preguntaGuia: "¿Por qué sí se puede pack en la ventana y grid dentro de un Frame?",
  },
  {
    colorName: "Ámbar",
    hex: "#fbbf24",
    columna: "C",
    titulo: "El Radiobutton: elegir una, y solo una",
    mision: "Definir qué problema resuelve un grupo de radios.",
    texto:
      "Hay preguntas que no admiten “un poco de todo”: turno matutino o vespertino; guardar en .txt o en .csv; dificultad fácil, media o difícil. El Radiobutton (botón de opción) existe para ese tipo de decisión. Visualmente parece un círculo que se rellena al elegirlo. Lo importante no es el círculo, sino el grupo: varios radios que comparten la misma variable de control. Cuando marcas uno, los demás del grupo se apagan solos. Si cada radio tuviera su propia variable, dejarían de ser un grupo y podrías “elegir” varios a la vez, que es exactamente lo que no quieres. Un Checkbutton, en cambio, sí permite combinaciones (negrita y cursiva al mismo tiempo). Leer bien el enunciado de un programa es decidir el widget: ¿es exclusión mutua o acumulación? Esa lectura previa ahorra rediseños enteros.",
    clave: ["Radiobutton", "exclusión mutua", "grupo", "variable compartida"],
    preguntaGuia: "¿En qué se parece un grupo de radios a una pregunta de examen de opción única?",
  },
  {
    colorName: "Verde",
    hex: "#34d399",
    columna: "D",
    titulo: "La variable invisible que une al equipo",
    mision: "Conectar variable, value y command.",
    texto:
      "Un Radiobutton solo “se entiende” con sus compañeros si todos escuchan el mismo canal. Ese canal es una variable de Tkinter: IntVar() si los valores son números, StringVar() si son textos. Cada radio declara value= (por ejemplo 1, 2, 3 o \"python\", \"java\", \"c\"). Al hacer clic, la variable toma ese value. Con .get() lees la elección; con .set() la cambias por código, útil para un valor inicial. El parámetro command= apunta a una función que se dispara al cambiar la opción: actualizar una etiqueta, habilitar un botón, mostrar un mensaje. Sin variable compartida, los radios son islas. Sin value distinto, no sabes qué eligió el usuario. Sin leer el tipo de variable, mezclas 1 con \"1\" y el programa “no selecciona”. En programación, las palabras invisibles —variable, valor, evento— son tan lectura como el texto en pantalla.",
    clave: ["IntVar / StringVar", "value", "get y set", "command"],
    preguntaGuia: "Si dos radios tienen el mismo value, ¿qué confusión le crearías al usuario?",
  },
  {
    colorName: "Violeta",
    hex: "#a78bfa",
    columna: "E",
    titulo: "Los errores que se leen antes de ejecutar",
    mision: "Anticipar fallos típicos y cómo detectarlos en el código.",
    texto:
      "Hay lecturas de código que evitan veinte minutos de “no jala”. Primera: crear los radios sin variable, o con una variable distinta para cada uno. Segunda: olvidar pack, grid o place; el widget nace y nadie lo sienta. Tercera: meter pack y grid en el mismo Frame. Cuarta: poner value iguales o olvidar el valor inicial con .set(), y la interfaz arranca “en blanco”, como si nadie hubiera elegido. Quinta: no agrupar los radios en un Frame con un LabelFrame o un título (“Elige un lenguaje”). El usuario no lee tu intención: lee la pantalla. Si las opciones de un examen y los botones de guardar están mezclados, el grupo se rompe visualmente aunque la variable sea correcta. Un programador que lee su propio diseño pregunta: ¿se entiende la pregunta?, ¿se ve el grupo?, ¿hay un valor claro al inicio? Esa lectura crítica es parte del oficio, no un adorno.",
    clave: ["variable distinta", "widget sin geometría", "valores repetidos", "agrupar con título"],
    preguntaGuia: "¿Cuál de estos errores se ve en la pantalla y cuál solo se ve en el código?",
  },
  {
    colorName: "Naranja",
    hex: "#fb923c",
    columna: "F",
    titulo: "El caso: un examen de una sola respuesta",
    mision: "Unir cajas + radios en un ejemplo que sí se puede programar.",
    texto:
      "Imagina una ventana titulada “Mini examen”. Arriba, un Frame con el encabezado: materia y nombre del alumno. Abajo, un LabelFrame que pregunta: “¿Cuál es el widget para una sola opción?”. Dentro, tres Radiobuttons que comparten una StringVar llamada respuesta, con values \"entry\", \"radio\" y \"check\". A la derecha, un Frame de acciones: botón Comprobar, que lee respuesta.get() y muestra “Correcto” solo si vale \"radio\". Eso es lectura convertida en estructura: dos o tres cajas, un grupo de opciones, una variable, un evento. No necesitas veinte controles para demostrar el tema. Necesitas que cada pieza tenga un porqué. Cuando tu equipo dibuje el mapa, debe poder señalar: ventana, frames, grupo de radios, variable, botón que pregunta. Si el mapa se puede explicar en un minuto, el código después casi se escribe solo. Leer para programar es eso: ver el sistema antes de teclearlo.",
    clave: ["LabelFrame", "StringVar respuesta", "Comprobar", "mapa → código"],
    preguntaGuia: "¿Qué Frame podrías quitar sin romper la lógica, y cuál no?",
  },
];

export const LECTURA_ROLES = [
  {
    fila: 1,
    name: "Lector",
    task: "Lee en voz alta el bloque de tu color cuando toque el turno de tu columna.",
  },
  {
    fila: 2,
    name: "Cazador",
    task: "Anota las 3 o 4 palabras clave y una frase del texto con tus palabras.",
  },
  {
    fila: 3,
    name: "Cartógrafo",
    task: "Dibuja el organizador del equipo (cajas y flechas). No copies el párrafo: diagramalo.",
  },
  {
    fila: 4,
    name: "Crítico",
    task: "Escribe el análisis: para qué sirve esto en un programa real y qué pasaría si faltara.",
  },
  {
    fila: 5,
    name: "Vocero",
    task: "Expone 60 segundos al salón. Si tu columna tiene menos de 5, el de más atrás también es vocero.",
  },
  {
    fila: 6,
    name: "Verificador",
    task: "Revisa que el mapa coincida con el texto y agrega un ejemplo extra. Si no hay fila 6, el vocero cubre esto.",
  },
] as const;

export const LECTURA_RUTA = [
  { min: "0–2", title: "Armado", detail: "Siguen en su butaca. El color de la columna es el equipo. Repasan su rol según la fila." },
  { min: "2–14", title: "Lectura en voz alta", detail: "De Rosa a Naranja, cada lector lee su bloque al salón (~2 min por color). El resto sigue el texto en la app o en la proyección." },
  { min: "14–22", title: "Análisis en equipo", detail: "Responden su pregunta guía. El crítico escribe 4–6 líneas. El cazador elige las claves." },
  { min: "22–32", title: "Organizador", detail: "El cartógrafo dibuja. El verificador o el vocero contrastan con el texto. Un mapa por columna, en una hoja." },
  { min: "32–44", title: "Galería", detail: "Seis voceros, un minuto cada uno. Orden: A→F (Rosa a Naranja). El docente solo aclara si hay un error de concepto." },
  { min: "44–50", title: "Conclusión", detail: "Cada equipo escribe 2 frases: 1) qué aprendimos; 2) un error que ya no vamos a cometer. Entrega la hoja al docente." },
];

export const LECTURA_ORGANIZADOR = [
  { caja: "Ventana Tk", hijos: "3 Frames (encabezado, pregunta, acciones)" },
  { caja: "Frame pregunta", hijos: "LabelFrame + grupo de Radiobuttons" },
  { caja: "Variable", hijos: "Una sola StringVar o IntVar para todo el grupo" },
  { caja: "Cada radio", hijos: "text + value distinto + la misma variable" },
  { caja: "Botón Comprobar", hijos: "Lee .get() y decide el mensaje" },
];

export const LECTURA_CONCLUSION_MODELO =
  "Un Frame ordena la ventana en zonas. Un grupo de Radiobuttons comparte una variable para que el usuario elija una sola opción. Si se mezcla pack con grid en la misma caja, o cada radio tiene su propia variable, la interfaz deja de decir la verdad.";

export function bloquePorColor(colorName: string | null | undefined, col = 1): LecturaBloque {
  const byName = LECTURA_BLOQUES.find(
    (b) => b.colorName.toLowerCase() === (colorName ?? "").toLowerCase(),
  );
  if (byName) return byName;
  const idx = Math.max(0, Math.min(LECTURA_BLOQUES.length - 1, (col || 1) - 1));
  return LECTURA_BLOQUES[idx]!;
}

export function rolPorFila(row: number) {
  const found = LECTURA_ROLES.find((r) => r.fila === row);
  return found ?? LECTURA_ROLES[LECTURA_ROLES.length - 1]!;
}
