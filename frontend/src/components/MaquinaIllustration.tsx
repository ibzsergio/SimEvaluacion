const EJEMPLOS = [
  {
    src: "/maquina/como-queda.jpg",
    title: "Así debe quedar",
    caption:
      "Entrada, las etapas 1 a 12 en orden y salida. En su máquina cada número lleva el nombre de esa etapa del proyecto.",
    alt: "Máquina de cartón con entrada, doce etapas numeradas del 1 al 12 y salida",
  },
  {
    src: "/maquina/recorrido.jpg",
    title: "Así viaja la ficha",
    caption:
      "Las flechas marcan que pasa sola por las 12 etapas. Los huecos de la frase los llena su programa.",
    alt: "Recorrido de la ficha desde la entrada, por las etapas 1 a 12, hasta la salida",
  },
] as const;

export default function MaquinaIllustration() {
  return (
    <div className="space-y-3">
      <p className="text-xs font-bold uppercase tracking-widest text-lime-200">Así se ve el producto</p>
      <div className="grid gap-3 sm:grid-cols-2">
        {EJEMPLOS.map((item) => (
          <figure key={item.src} className="overflow-hidden rounded-2xl border border-lime-400/30 bg-slate-950/40">
            <figcaption className="px-3 py-2 text-sm font-semibold text-white">{item.title}</figcaption>
            <img src={item.src} alt={item.alt} className="h-auto max-h-64 w-full bg-slate-100 object-contain" />
            <p className="px-3 py-2 text-xs leading-relaxed text-slate-300">{item.caption}</p>
          </figure>
        ))}
      </div>
    </div>
  );
}
