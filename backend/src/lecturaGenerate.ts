export type GeneratedBloque = {
  titulo: string;
  mision: string;
  texto: string;
  parrafos: string[];
  clave: string[];
  preguntaGuia: string;
  producto: string;
  organizador: Array<{ caja: string; hijos: string }>;
};

const ANGLES = [
  "que_es",
  "analogia",
  "como_se_usa",
  "errores",
  "caso",
  "diseno",
  "relacion",
  "cierre_practica",
] as const;

const METAPHORS = [
  "un recetario de cocina",
  "un tablero de fútbol con zonas",
  "una mochila con compartimentos",
  "un examen de opción única",
  "un semáforo en un cruce",
  "un cajón de herramientas",
  "un mapa del salón",
  "una fila en la cafetería",
];

function hashSeed(input: string) {
  let h = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    h = Math.imul(h ^ input.charCodeAt(i), 16777619);
  }
  return h >>> 0;
}

function pick<T>(list: T[], seed: number, salt: number) {
  return list[(seed + salt * 17) % list.length]!;
}

function cleanTopic(raw: string) {
  return raw.replace(/\s+/g, " ").trim().slice(0, 180);
}

/** Reparte los párrafos de la lectura: uno por integrante. */
export function assignParagraphs(parts: string[], memberCount: number): string[] {
  const n = Math.max(1, memberCount);
  const source = parts.map((p) => p.trim()).filter(Boolean);
  if (!source.length) return Array.from({ length: n }, () => "");
  if (source.length === n) return source;
  if (source.length < n) {
    const out = [...source];
    let guard = 0;
    while (out.length < n && guard < 12) {
      guard += 1;
      let idx = 0;
      let best = 0;
      out.forEach((p, i) => {
        if (p.length > best) {
          best = p.length;
          idx = i;
        }
      });
      const bits = out[idx]!.split(/(?<=\.)\s+/).filter(Boolean);
      if (bits.length < 2) break;
      const mid = Math.ceil(bits.length / 2);
      out.splice(idx, 1, bits.slice(0, mid).join(" "), bits.slice(mid).join(" "));
    }
    while (out.length < n) out.push(out[out.length - 1] ?? "");
    return out.slice(0, n);
  }
  const buckets: string[][] = Array.from({ length: n }, () => []);
  source.forEach((p, i) => {
    const idx = Math.min(n - 1, Math.floor((i * n) / source.length));
    buckets[idx]!.push(p);
  });
  return buckets.map((b) => b.join(" "));
}

function productCopy(topic: string) {
  return `Después de leer, TODO el equipo arma UN SOLO producto: un organizador gráfico o mapa cognitivo de «${topic}». Háganlo en una herramienta digital (Canva, PowerPoint o Google Drawings) y expónganlo frente al grupo. No es un trabajo por persona: es uno por equipo.`;
}

function sixParagraphs(topic: string, metaphor: string, week: number, n: number, of: number, angle: (typeof ANGLES)[number]): string[] {
  const t = topic;
  const m = metaphor;
  if (angle === "que_es") {
    return [
      `El tema de esta lectura es «${t}». No es un adorno para el examen: es una idea que organiza cómo se escribe y se lee un programa. Si no puedes nombrarlo con tus palabras, todavía no lo dominas.`,
      `Toda idea de interfaz tiene un problema que resuelve. Con «${t}» pregúntate: ¿qué necesidad del usuario cubre? ¿Qué pasaría si esa pieza no existiera en la ventana?`,
      `También hay que decir qué NO es. «${t}» se confunde con otras herramientas. Si mezclas conceptos, el usuario cree una cosa y el programa hace otra.`,
      `Compáralo con ${m}: hay un contenedor, hay partes que van adentro y hay reglas para no revolverlas. En el código esas reglas se ven tanto como en la pantalla.`,
      `Este equipo (el ${n} de ${of}, sesión ${week}) explica solo este recorte. No tomen prestado el texto de otra columna: defiendan el suyo con un ejemplo del salón.`,
      `Al cerrar el párrafo, dejen lista una definición de una oración. Esa frase alimentará el mapa que van a armar todos juntos en Canva.`,
    ];
  }
  if (angle === "analogia") {
    return [
      `Piensa «${t}» como ${m}. Nadie deja todas las herramientas en un solo montón y espera que el trabajo salga limpio. Hay zonas, turnos y señales.`,
      `En la interfaz pasa igual: un control no adivina tu intención. Tú lo agrupas, lo nombras y le das un valor. Si no hay agrupación, la analogía se rompe.`,
      `Si dos grupos distintos usan la misma señal, el usuario cree que eligió una cosa y el programa escucha otra. Eso también pasa cuando se copia mal una variable.`,
      `Den un paso atrás: ¿qué parte de ${m} sería el contenedor, cuál la opción exclusiva y cuál el botón que pregunta?`,
      `Esta analogía es de este equipo (sesión ${week}, ${n} de ${of}). El equipo de al lado tiene otra a propósito. No la mezclen.`,
      `Anoten tres flechas mundo-real → programa. Esas flechas son el esqueleto del organizador gráfico que harán en Canva.`,
    ];
  }
  if (angle === "como_se_usa") {
    return [
      `Usar «${t}» no es copiar un tutorial de memoria. Hay un orden, y si lo saltas el programa “no jala”.`,
      `Primero nace el contenedor. Después nacen los controles hijos. Si el hijo no tiene padre claro, no sabes dónde vive.`,
      `Luego se acomodan con un solo gestor de geometría por caja. Mezclar pack y grid en el mismo padre es el error más común.`,
      `Después se conectan a una variable o a un evento. Sin esa conexión, el clic no deja huella.`,
      `Al final alguien lee el resultado. Si nadie pregunta qué eligió el usuario, el programa no decide nada.`,
      `Ensayen ese orden en voz alta, párrafo por párrafo. Con eso ya pueden dibujar el flujo en Canva y exponerlo.`,
    ];
  }
  if (angle === "errores") {
    return [
      `Hay lecturas de código que ahorran veinte minutos de “no jala”. Con «${t}» conviene cazar errores antes de ejecutar.`,
      `Un clásico: crear controles sin padre claro, o crearlos y olvidar mostrarlos. El widget existe, pero nadie lo sentó en la ventana.`,
      `Otro: mezclar pack y grid en la misma caja, o no compartir la variable en un grupo de opciones. La pantalla miente.`,
      `También se repite el mismo valor en dos opciones, o la interfaz arranca en blanco sin valor inicial. El usuario no sabe qué está elegido.`,
      `Un error se ve en la pantalla: hueco, dos marcas, botón invisible. Otro solo se ve en el código: dos variables que parecen un grupo y no lo son.`,
      `Listen tres fallos (pantalla o código) y una reparación de una línea. Eso entra al mapa cognitivo del equipo en Canva.`,
    ];
  }
  if (angle === "caso") {
    return [
      `Caso de esta semana: una ventana corta que usa «${t}» de verdad, no de adorno. Si el caso es enorme, recórtelo.`,
      `Arriba, un encabezado. Abajo, una pregunta que no admite “un poco de todo”. Esa pregunta obliga a una sola decisión.`,
      `A un lado, un botón que lee la elección y responde. Si pueden señalar contenedor, grupo, variable y evento, ya pueden programarlo después.`,
      `El caso debe caber en un minuto de explicación. Si se parece al de otro equipo, cámbienlo con ${m} o con un trámite escolar.`,
      `Leer para programar es ver el sistema antes de teclearlo. Cada párrafo de esta lectura es una pieza de ese sistema.`,
      `El producto no es el código todavía: es el mapa del caso en Canva, expuesto frente al grupo por todo el equipo.`,
    ];
  }
  if (angle === "diseno") {
    return [
      `No todo se resuelve con «${t}». Diseñar también es decir que no. Si el usuario puede marcar varias cosas a la vez, no es exclusión mutua.`,
      `Si todo es un solo botón, no hace falta un grupo. Si no hay zonas, el contenedor sobra. El enunciado se lee antes que el código.`,
      `Escriban un ejemplo escolar donde «${t}» SÍ aplica. Tiene que ser una sola decisión clara.`,
      `Escriban otro ejemplo donde sería un error usarlo. Ahí proponen con qué lo sustituirían.`,
      `Esta mirada es de la sesión ${week}. Aunque el tema se repita, el par de ejemplos tiene que ser otro.`,
      `Esos dos ejemplos (sí / no) son el corazón del organizador. Pásenlos a Canva y explíquenlos en la exposición.`,
    ];
  }
  if (angle === "relacion") {
    return [
      `«${t}» no llega de la nada. Se apoya en cosas que ya vieron: una ventana, un evento de clic, una variable, un acomodo.`,
      `Si el contenedor es la caja, la opción exclusiva es la pregunta y la variable es el canal. Si mezclan idiomas de acomodo, la relación se rompe.`,
      `Dibujen una flecha de lo viejo a lo nuevo. ¿Qué idea de clases anteriores es imposible quitar?`,
      `Una segunda flecha: cómo el evento necesita a la variable. Sin esa pareja, el clic no significa nada.`,
      `Una tercera flecha: cómo el usuario entiende la pantalla. Si el grupo no se ve como grupo, la lectura del diseño falló.`,
      `Tres flechas son un mapa. Háganlo en Canva, una sola lámina del equipo, y preséntenla al salón.`,
    ];
  }
  return [
    `Cierren con un plan, no con un copiar-pegar. «${t}» se vuelve pasos: qué se crea primero y qué se prueba al final.`,
    `Anoten el nombre de la ventana y cuántas zonas necesita. Si hay más de tres, recorten.`,
    `Anoten la pregunta que hace el grupo de opciones y cómo se llama la variable. Sin nombre, no hay lectura del resultado.`,
    `Anoten qué hace el botón. Una acción. Si el plan no se puede decir en un minuto, está demasiado grande.`,
    `Comparen el plan con ${m}: si alguna zona sobra, quítenla. Esta es la sesión ${week}; el plan no puede ser el de la semana pasada.`,
    `Pasen el plan a un organizador en Canva. Todo el equipo expone esa única lámina. Nadie lee el texto de otro color.`,
  ];
}

export function generateBloque(params: {
  topic: string;
  teamIndex: number;
  teamCount: number;
  sessionNumber: number;
  teamLabel: string;
  memberCount: number;
}): GeneratedBloque {
  const topic = cleanTopic(params.topic) || "el tema de la clase";
  const seed = hashSeed(`${topic}|${params.sessionNumber}|${params.teamIndex}|${params.teamLabel}`);
  const angle = ANGLES[(params.sessionNumber + params.teamIndex) % ANGLES.length]!;
  const metaphor = pick(METAPHORS, seed, 1);
  const n = params.teamIndex + 1;
  const of = params.teamCount;
  const week = params.sessionNumber;
  const claveBase = topic
    .split(/[,\-/]| y /i)
    .map((p) => p.trim())
    .filter(Boolean)
    .slice(0, 3);
  while (claveBase.length < 3) claveBase.push(["concepto", "uso", "error"][claveBase.length]!);

  const raw = sixParagraphs(topic, metaphor, week, n, of, angle);
  const parrafos = assignParagraphs(raw, Math.max(1, params.memberCount));
  const texto = parrafos.join("\n\n");

  const titles: Record<(typeof ANGLES)[number], string> = {
    que_es: `Qué es «${topic}»`,
    analogia: `Como ${metaphor}: ${topic}`,
    como_se_usa: `Cómo se usa «${topic}»`,
    errores: `Errores al aplicar «${topic}»`,
    caso: `Un caso con «${topic}»`,
    diseno: `¿Cuándo sí y cuándo no? «${topic}»`,
    relacion: `Cómo se conecta «${topic}»`,
    cierre_practica: `Plan mínimo de «${topic}»`,
  };

  return {
    titulo: titles[angle],
    mision: "Cada integrante lee EN VOZ ALTA su párrafo. Luego el equipo entero arma un solo mapa en Canva y lo expone.",
    texto,
    parrafos,
    clave: [...claveBase, angle.replace("_", " ")],
    preguntaGuia: `Con los ${parrafos.length} párrafos de este equipo, ¿qué idea no puede faltar en el mapa de Canva?`,
    producto: productCopy(topic),
    organizador: [
      { caja: "Idea central", hijos: topic },
      { caja: "De cada párrafo", hijos: "Una palabra o flecha" },
      { caja: "Producto", hijos: "Una lámina en Canva · todo el equipo expone" },
    ],
  };
}
