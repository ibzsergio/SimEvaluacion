/** Mensajes motivadores rotados por día (misma frase todo el día, distinta al día siguiente). */
const DAILY_MESSAGES: readonly string[] = [
  "Cada entrega es un paso más hacia tu meta. ¡Hoy puedes sumar puntos!",
  "La constancia vence al talento cuando el talento no es constante. Sigue adelante.",
  "Una práctica bien hecha hoy vale más que diez promesas para mañana.",
  "Tu esfuerzo de hoy construye el ranking de mañana. ¡Tú puedes!",
  "Pequeños avances diarios llevan a grandes resultados al final del periodo.",
  "No compares tu inicio con el de otros; compara tu progreso de ayer con el de hoy.",
  "Entregar a tiempo es una habilidad tan valiosa como el contenido de tu trabajo.",
  "El Top 10 no es suerte: es disciplina, entrega y mejora continua.",
  "Hoy es buen día para cerrar una actividad pendiente y subir en el ranking.",
  "Los errores enseñan; lo importante es volver a intentarlo con más claridad.",
  "Tu número en la lista no define tu potencial: tu trabajo sí.",
  "Cada punto suma. No dejes pasar la oportunidad de la actividad de hoy.",
  "La excelencia no es un acto, es un hábito. Haz de la entrega tu hábito.",
  "Si ayer no fue tu mejor día, hoy puedes empezar de nuevo con energía.",
  "Organízate, prioriza y entrega: tres claves que te acercan al podio.",
  "Tu grupo compite contigo y contigo mismo. Supera tu récord anterior.",
  "La motivación te pone en marcha; el hábito te mantiene en el camino.",
  "Una calificación más puede ser la diferencia entre el puesto 11 y el Top 10.",
  "Confía en tu proceso: estudiar, practicar y entregar siempre da frutos.",
  "No esperes el momento perfecto; empieza ahora con lo que tienes.",
  "Tu actitud ante las prácticas dice mucho de tu compromiso académico.",
  "Celebra cada actividad calificada: es evidencia de que vas avanzando.",
  "El aprendizaje real ocurre cuando te esfuerzas un poco más de lo cómodo.",
  "Hoy puedes ser el alumno que entrega primero y con calidad.",
  "La meta no es solo ganar: es dar lo mejor de ti en cada actividad.",
  "Respira, enfócate y da tu mejor versión en la siguiente entrega.",
  "Los que suben en el ranking no tienen menos dificultades; tienen más constancia.",
  "Tu futuro yo te agradecerá las horas que inviertes hoy en tus prácticas.",
  "Un día productivo en el aula empieza con una entrega cumplida.",
  "No te rindas por un mal resultado: úsalo como mapa para mejorar.",
  "La disciplina es elegir entre lo que quieres ahora y lo que quieres lograr.",
  "Compite con respeto: tu mejor rival te empuja a crecer.",
  "Hoy escribe un capítulo más de tu historia académica con acción.",
  "La claridad llega haciendo, no solo pensando. Entrega y aprende.",
  "Cada semana es una nueva oportunidad de subir lugares en el ranking.",
  "Tu nombre puede brillar en el Top 10 si conviertes intención en entrega.",
  "El esfuerzo invisible de hoy será el resultado visible de mañana.",
  "Pregunta, practica, entrega: ese ciclo te lleva lejos.",
  "No subestimes el poder de terminar lo que empezaste.",
  "Hoy elige ser proactivo: revisa pendientes y planifica tu siguiente paso.",
  "La diferencia entre bueno y excelente está en los detalles de cada entrega.",
  "Tu grupo confía en que puedes mejorar; demuéstralo con hechos.",
  "La constancia en las prácticas es la moneda del éxito en este curso.",
  "Un mensaje para hoy: tú tienes lo necesario para lograrlo.",
  "Empieza con lo más importante: la actividad que más puntos te puede dar.",
  "El ranking cambia; tu dedicación es lo que permanece y te define.",
];

const DAILY_EMOJIS: readonly string[] = [
  "🌟",
  "🚀",
  "💪",
  "✨",
  "🎯",
  "📚",
  "🏆",
  "🔥",
  "🌱",
  "⭐",
];

function hashSeed(input: string): number {
  let h = 0;
  for (let i = 0; i < input.length; i++) {
    h = (h * 31 + input.charCodeAt(i)) >>> 0;
  }
  return h;
}

/** Fecha local YYYY-MM-DD (zona del servidor; estable todo el día). */
export function localDateKey(date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function firstNameFromDisplayName(displayName: string): string {
  const trimmed = displayName.trim();
  if (!trimmed) return "Alumno";
  const part = trimmed.split(/\s+/)[0] ?? trimmed;
  return part.charAt(0).toUpperCase() + part.slice(1);
}

export function getDailyMotivation(
  studentId: string,
  date = new Date(),
): { date: string; message: string; emoji: string } {
  const dayKey = localDateKey(date);
  const messageSeed = hashSeed(`${dayKey}:msg:${studentId}`);
  const emojiSeed = hashSeed(`${dayKey}:emoji:${studentId}`);
  const message = DAILY_MESSAGES[messageSeed % DAILY_MESSAGES.length];
  const emoji = DAILY_EMOJIS[emojiSeed % DAILY_EMOJIS.length];
  return {
    date: dayKey,
    message: message ?? "Sigue esforzándote: cada día cuenta.",
    emoji: emoji ?? "🌟",
  };
}
