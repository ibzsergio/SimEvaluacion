export type GeneratedBloque = {
  titulo: string;
  mision: string;
  texto: string;
  clave: string[];
  preguntaGuia: string;
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

const AUDIENCES = [
  "un compañero que faltó",
  "alguien que nunca ha abierto Tkinter",
  "el docente en 40 segundos",
  "un alumno de primer semestre",
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
  const t = raw.replace(/\s+/g, " ").trim();
  return t.slice(0, 180);
}

/** Un texto único por equipo y por sesión, aunque el tema se repita. */
export function generateBloque(params: {
  topic: string;
  teamIndex: number;
  teamCount: number;
  sessionNumber: number;
  teamLabel: string;
}): GeneratedBloque {
  const topic = cleanTopic(params.topic) || "el tema de la clase";
  const seed = hashSeed(`${topic}|${params.sessionNumber}|${params.teamIndex}|${params.teamLabel}`);
  const angle = ANGLES[(params.sessionNumber + params.teamIndex) % ANGLES.length]!;
  const metaphor = pick(METAPHORS, seed, 1);
  const audience = pick(AUDIENCES, seed, 3);
  const n = params.teamIndex + 1;
  const of = params.teamCount;
  const week = params.sessionNumber;

  const claveBase = topic
    .split(/[,\-/]| y /i)
    .map((p) => p.trim())
    .filter(Boolean)
    .slice(0, 3);
  while (claveBase.length < 3) claveBase.push(["concepto", "uso", "error"][claveBase.length]!);

  if (angle === "que_es") {
    return {
      titulo: `Qué es, en serio: ${topic}`,
      mision: "Definir el tema con palabras propias, sin copiar el título.",
      texto: `Sesión ${week} · Equipo ${n} de ${of}. El tema de hoy es «${topic}». No es un adorno del programa ni una palabra para el examen: es una idea que organiza cómo se escribe y se lee un programa. Si no puedes explicarlo a ${audience}, todavía no lo dominas. Empieza por nombrar las piezas: qué problema resuelve, qué no es, y qué se rompe si falta. Compáralo con ${metaphor}: hay un contenedor, hay partes que van adentro y hay reglas para no mezclarlas. En programación, esas reglas se ven en el código tanto como en la pantalla. Tu equipo no explica “todo Tkinter”; explica este recorte. Si alguien de otro color pregunta, no leas su texto: defiende el tuyo con un ejemplo del salón.`,
      clave: [...claveBase, "definición"],
      preguntaGuia: `Si tuvieras que definir «${topic}» en una sola oración para ${audience}, ¿cuál sería?`,
      organizador: [
        { caja: "Problema", hijos: `Qué necesidad cubre ${topic}` },
        { caja: "Piezas", hijos: "Nombres de las partes que sí importan" },
        { caja: "No es", hijos: "Con qué se confunde y por qué" },
      ],
    };
  }
  if (angle === "analogia") {
    return {
      titulo: `Como ${metaphor}: ${topic}`,
      mision: "Traducir el tema a una analogía del mundo real y volver al código.",
      texto: `Sesión ${week} · Equipo ${n} de ${of}. Piensa «${topic}» como ${metaphor}. Nadie deja todas las herramientas en un solo montón y espera que el trabajo salga limpio. Hay zonas, turnos y señales. En la interfaz pasa igual: un control no “adivina” tu intención; tú lo agrupas, lo nombras y le das un valor. Si la analogía falla, el código también: por ejemplo, si dos grupos distintos usan la misma señal, el usuario cree que eligió una cosa y el programa escucha otra. Esta lectura no se parece a la del equipo de al lado a propósito. Ustedes son los dueños de esta analogía. Al final, den un paso atrás: ¿qué parte de ${metaphor} es el Frame, cuál es la opción exclusiva y cuál es el botón que pregunta?`,
      clave: [...claveBase, "analogía"],
      preguntaGuia: `En tu analogía de ${metaphor}, ¿qué objeto es el grupo de opciones y qué objeto es el contenedor?`,
      organizador: [
        { caja: "Mundo real", hijos: metaphor },
        { caja: "En el programa", hijos: topic },
        { caja: "Traducción", hijos: "Una flecha de cada objeto a un widget o idea" },
      ],
    };
  }
  if (angle === "como_se_usa") {
    return {
      titulo: `Cómo se usa «${topic}» sin teatro`,
      mision: "Describir el orden: crear, agrupar, conectar, leer el resultado.",
      texto: `Sesión ${week} · Equipo ${n} de ${of}. Usar «${topic}» no es copiar un tutorial de memoria. Hay un orden: 1) nace el contenedor, 2) nacen los controles hijos, 3) se acomodan con un solo gestor de geometría por caja, 4) se conectan a una variable o a un evento, 5) alguien lee el resultado. Si saltas el paso 3, “no se ve”. Si saltas el 4, “no responde”. Si saltas el 5, el programa no decide nada. Esta semana (${week}) tu equipo ensaya ese orden en voz alta, como si dictaran a ${audience}. No inventen API de más: con tres radios, un Frame y un botón Comprobar alcanza para demostrar el tema. Lo que no está en su texto no lo pidan prestado a otra columna.`,
      clave: [...claveBase, "orden de uso"],
      preguntaGuia: `¿Cuál de los cinco pasos de uso de «${topic}» es el que más se les olvida en clase y por qué?`,
      organizador: [
        { caja: "1–2 Crear", hijos: "Padre + hijos" },
        { caja: "3 Acomodar", hijos: "Un gestor por caja" },
        { caja: "4–5 Conectar y leer", hijos: "Variable / evento / get" },
      ],
    };
  }
  if (angle === "errores") {
    return {
      titulo: `Los errores que delatan que no se leyó «${topic}»`,
      mision: "Anticipar fallos visibles en pantalla y fallos que solo se ven en el código.",
      texto: `Sesión ${week} · Equipo ${n} de ${of}. Hay lecturas de código que ahorran veinte minutos de “no jala”. Con «${topic}», los clásicos son: crear controles sin padre claro; mezclar pack y grid en la misma caja; no compartir la variable en un grupo de opciones; repetir el mismo value; olvidar mostrar el widget; dejar la interfaz en blanco sin valor inicial. Un error se ve en la pantalla (hueco, dos opciones marcadas, botón invisible). Otro solo se ve en el código (dos variables distintas que parecen un grupo). Su misión es hacer una lista de tres fallos y decir cuál es de pantalla y cuál de código. No usen el ejemplo del equipo vecino: inventen uno con ${metaphor} o con algo que pasó esta semana en el salón.`,
      clave: [...claveBase, "errores"],
      preguntaGuia: `De los errores de «${topic}», ¿cuál se ve sin ejecutar y cuál solo al correr el programa?`,
      organizador: [
        { caja: "Se ve", hijos: "Síntoma en la ventana" },
        { caja: "No se ve", hijos: "Síntoma en el código" },
        { caja: "Reparación", hijos: "Qué cambiarían en una línea" },
      ],
    };
  }
  if (angle === "caso") {
    return {
      titulo: `Caso: un mini programa que obliga a usar «${topic}»`,
      mision: "Inventar un caso mínimo (ventana + 2 zonas + una decisión) y mapearlo.",
      texto: `Sesión ${week} · Equipo ${n} de ${of}. Caso de esta semana: una ventana corta que usa «${topic}» de verdad, no de adorno. Arriba, un encabezado. Abajo, una pregunta que no admite “un poco de todo”. A un lado, un botón que lee la elección y responde. Si pueden señalar con el dedo: contenedor, grupo, variable, evento, ya pueden programarlo después. El caso debe caber en un minuto de explicación. Si se parece al de otro equipo, cámbienlo: usen ${metaphor} o un trámite escolar (lista, turno, guardar archivo). Recuerden: leer para programar es ver el sistema antes de teclearlo. Esta es la lectura ${n}; las otras columnas tienen otro caso a propósito.`,
      clave: [...claveBase, "caso"],
      preguntaGuia: `¿Qué Frame podrías quitar de tu caso sin romper la lógica de «${topic}», y cuál no?`,
      organizador: [
        { caja: "Ventana", hijos: "Título + 2 o 3 Frames" },
        { caja: "Decisión", hijos: "Grupo de una sola opción" },
        { caja: "Acción", hijos: "Botón que lee .get() o equivalente" },
      ],
    };
  }
  if (angle === "diseno") {
    return {
      titulo: `Diseñar la pregunta: ¿«${topic}» es la herramienta correcta?`,
      mision: "Decidir cuándo sí y cuándo no usar este concepto.",
      texto: `Sesión ${week} · Equipo ${n} de ${of}. No todo se resuelve con «${topic}». Si el usuario puede marcar varias cosas a la vez, no es exclusión mutua. Si todo es un solo botón, no hace falta un grupo. Si no hay zonas, el Frame sobra. Diseñar es decir que no. Escriban dos enunciados de programa: uno donde «${topic}» es obligatorio y otro donde sería un error usarlo. Explíquenlo a ${audience}. Esta decisión es lectura: el enunciado del problema se lee antes que el código. La semana ${week} pide esa mirada, no un tutorial. Su texto es exclusivo de su color; no completen con ideas que oyeron de otra fila.`,
      clave: [...claveBase, "cuándo sí / no"],
      preguntaGuia: `Da un ejemplo escolar donde «${topic}» SÍ aplica y uno donde NO.`,
      organizador: [
        { caja: "Sí aplica", hijos: "Una sola decisión / una zona" },
        { caja: "No aplica", hijos: "Varias a la vez o sin agrupación" },
        { caja: "Widget o idea", hijos: "Con qué lo sustituirían" },
      ],
    };
  }
  if (angle === "relacion") {
    return {
      titulo: `Cómo se conecta «${topic}» con lo que ya vieron`,
      mision: "Unir este tema con ventanas, eventos o variables ya usados en clase.",
      texto: `Sesión ${week} · Equipo ${n} de ${of}. «${topic}» no llega de la nada. Se apoya en cosas que ya tocaron: una ventana, un evento de clic, una variable, un acomodo. Si el Frame es la caja, el radio es la pregunta y la variable es el canal. Si mezclan idiomas de acomodo, la relación se rompe. Dibujen tres flechas: de lo viejo a lo nuevo. Usen ${metaphor} solo si les ayuda a ${audience}. El punto no es lucirse: es que el mapa se pueda explicar sin leer el párrafo de otra columna. Cada equipo tiene un recorte distinto de la misma materia; el de ustedes es este.`,
      clave: [...claveBase, "conexión"],
      preguntaGuia: `¿Qué idea de clases anteriores es imposible quitar si queremos entender «${topic}»?`,
      organizador: [
        { caja: "Ya lo vimos", hijos: "Ventana / evento / variable" },
        { caja: "Hoy", hijos: topic },
        { caja: "Flecha", hijos: "Cómo se necesitan mutuamente" },
      ],
    };
  }
  return {
    titulo: `De la lectura al teclado: «${topic}» en 15 líneas de plan`,
    mision: "Salir con un plan de código mínimo, no con un programa terminado.",
    texto: `Sesión ${week} · Equipo ${n} de ${of}. Cierren con un plan, no con un copiar-pegar. Escriban en la hoja: nombre de la ventana, cuántos Frames, qué pregunta hace el grupo de opciones, cómo se llama la variable, qué hace el botón. Eso es «${topic}» convertido en pasos. Si el plan no se puede leer en voz alta en un minuto, está demasiado grande. Recorten. Compárenlo con ${metaphor} para ver si alguna zona sobra. Esta práctica es de la sesión ${week}: aunque el tema se repita la próxima semana, el plan tiene que ser otro. No tomen prestado el plan del equipo de al lado; el vocero solo puede apuntar a su propio mapa.`,
    clave: [...claveBase, "plan de código"],
    preguntaGuia: `¿Cuál es el primer widget que crearían y cuál el último, y por qué ese orden?`,
    organizador: [
      { caja: "Widgets", hijos: "Lista mínima (5 o menos)" },
      { caja: "Orden", hijos: "Qué se crea primero" },
      { caja: "Prueba", hijos: "Cómo sabrían que sí funciona" },
    ],
  };
}

export function speakScriptForRole(
  roleName: string,
  bloque: GeneratedBloque,
  displayName: string,
): { roleTask: string; speakScript: string } {
  const claves = bloque.clave.slice(0, 4).join(", ");
  if (roleName === "Lector") {
    return {
      roleTask: "Lee en voz alta el texto completo de TU equipo. No leas el de otro color.",
      speakScript: `${displayName} lee en voz alta, sin resumir, el texto titulado «${bloque.titulo}». Es el único texto que este equipo puede leer en voz alta.`,
    };
  }
  if (roleName === "Cazador") {
    return {
      roleTask: "Di las palabras clave y una frase tuya (no copies el párrafo).",
      speakScript: `${displayName} dice: «Palabras clave: ${claves}. En una frase, esto trata de…» y completa con sus palabras. No recite el texto del lector.`,
    };
  }
  if (roleName === "Cartógrafo") {
    const cajas = bloque.organizador.map((o) => o.caja).join(" → ");
    return {
      roleTask: "Dibuja el organizador y explícalo señalando las cajas.",
      speakScript: `${displayName} muestra el mapa (${cajas}) y explica cada caja en una oración. No copie el párrafo: diagramalo.`,
    };
  }
  if (roleName === "Crítico") {
    return {
      roleTask: "Responde en voz alta la pregunta guía del equipo.",
      speakScript: `${displayName} responde la pregunta guía: «${bloque.preguntaGuia}». Habla 20–30 segundos.`,
    };
  }
  if (roleName === "Vocero") {
    return {
      roleTask: "Expón 60 segundos al salón usando SOLO este texto de tu equipo.",
      speakScript: `${displayName} tiene 60 segundos frente al grupo. Debe decir: 1) el título «${bloque.titulo}», 2) la misión, 3) una idea del mapa. Prohibido leer o contar la lectura de otro equipo.`,
    };
  }
  return {
    roleTask: "Verifica que cada compañero cumpla su parte y añade un ejemplo extra.",
    speakScript: `${displayName} pregunta a cada integrante: «¿Ya dijiste tu parte?» y añade un ejemplo extra de «${bloque.clave[0] ?? "el tema"}» que no esté en el párrafo.`,
  };
}
