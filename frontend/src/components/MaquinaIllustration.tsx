const EJEMPLOS = [
  {
    src: "/maquina/como-queda.jpg",
    title: "Así debe quedar",
    caption:
      "Entrada y salida como en la foto. El letrero de enfrente no es «Entra y sale»: escriban Sistema de Alerta Temprana.",
    alt: "Máquina de cartón con boca de entrada, doce obstáculos numerados y boca de salida",
  },
  {
    src: "/maquina/recorrido.jpg",
    title: "Así viaja la pieza",
    caption:
      "La ficha, canica, moneda o pelota cruza sola cada obstáculo. En la competencia gana la que salga primero.",
    alt: "La pieza recorre sola los doce obstáculos, de la boca de entrada a la boca de salida",
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
