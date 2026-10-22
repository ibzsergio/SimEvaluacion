function ExampleCard({
  src,
  title,
  ok,
  alt,
}: {
  src: string;
  title: string;
  ok: boolean;
  alt: string;
}) {
  return (
    <figure
      className={`overflow-hidden rounded-2xl border-2 ${
        ok ? "border-emerald-400/70 bg-emerald-950/40" : "border-rose-400/70 bg-rose-950/40"
      }`}
    >
      <div className="flex items-center justify-between gap-2 px-3 py-2">
        <p className={`text-xs font-bold uppercase tracking-wide ${ok ? "text-emerald-200" : "text-rose-200"}`}>
          {title}
        </p>
        <span
          className={`flex h-7 w-7 items-center justify-center rounded-full text-sm font-black ${
            ok ? "bg-emerald-500 text-[#ffffff]" : "bg-rose-500 text-[#ffffff]"
          }`}
          aria-hidden
        >
          {ok ? "✓" : "✕"}
        </span>
      </div>
      <img src={src} alt={alt} className="h-44 w-full object-cover sm:h-52" />
    </figure>
  );
}

export default function PopUpIllustration() {
  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-white">Así se ve</h3>
      <div className="grid gap-3 md:grid-cols-3">
        <ExampleCard
          src="/popup/valido-puerta.jpg"
          title="Sí cuenta — se para y se abre"
          ok
          alt="Pop-up de hojas de color que se sostiene solo, con una puerta de papel que abre"
        />
        <ExampleCard
          src="/popup/valido-tira.jpg"
          title="Sí cuenta — una tira que se jala"
          ok
          alt="Pop-up de papel con una tira verde que mueve una figura"
        />
        <ExampleCard
          src="/popup/invalido-plano.jpg"
          title="No vale — cartel plano"
          ok={false}
          alt="Hojas de color pegadas en plano, sin pararse ni moverse"
        />
      </div>
      <p className="text-xs text-slate-400">
        Es de programación: una pantalla, una función o lo que hace su programa. Tiene que pararse, algo
        se mueve y medir mínimo 30 cm de ancho por 30 cm de alto. Al iniciar el reloj pueden salir por
        cartón, palos de madera y unicel. Un cartel plano no cuenta.
      </p>
    </div>
  );
}
