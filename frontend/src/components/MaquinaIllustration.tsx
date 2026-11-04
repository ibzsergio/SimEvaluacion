const EJEMPLOS = [
  {
    src: "/maquina/como-queda.jpg",
    title: "Así debe quedar",
    caption: "Entrada, tres estaciones, salida y la frase al frente, en grande.",
    alt: "Máquina de cartón con entrada, tres estaciones numeradas, salida y el letrero Entra dato y sale resultado",
  },
  {
    src: "/maquina/recorrido.jpg",
    title: "Así viaja la ficha",
    caption: "Sola: cae, gira y se desvía. Los huecos de la frase los llena su programa.",
    alt: "Recorrido de la ficha por las estaciones Entrada, Cae, Gira, Se desvía y Salida",
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
