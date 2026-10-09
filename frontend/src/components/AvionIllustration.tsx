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
      <div className="relative">
        <img src={src} alt={alt} className="h-40 w-full object-cover sm:h-48" />
        {ok ? null : (
          <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
            <line x1="8" y1="8" x2="92" y2="92" stroke="#f43f5e" strokeWidth="8" strokeLinecap="round" />
            <line x1="92" y1="8" x2="8" y2="92" stroke="#f43f5e" strokeWidth="8" strokeLinecap="round" />
          </svg>
        )}
      </div>
    </figure>
  );
}

export default function AvionIllustration({ compact = false }: { compact?: boolean }) {
  return (
    <div className={compact ? "space-y-3" : "space-y-4"}>
      <ExampleCard
        src="/avion/invalido-papel.jpg"
        title="No vale — solo papel doblado"
        ok={false}
        alt="Avión de papel doblado, ejemplo que no cuenta"
      />
      <ExampleCard
        src="/avion/valido-1.jpg"
        title="Sí cuenta — cascarón, palos y silicón"
        ok
        alt="Avión de palos de paleta y cascarón verde con el nombre Cecytem que sí cuenta"
      />
      <ExampleCard
        src="/avion/valido-2.jpg"
        title="Sí cuenta — estructura y alas rígidas"
        ok
        alt="Avión armado con palillos, palos de paleta e ilustración que sí cuenta"
      />
      <p className="text-center text-xs text-slate-400">
        Papel doblado = no válido. Cascarón o ilustración, palillos, palos de paleta y silicón frío = sí cuenta.
      </p>
    </div>
  );
}
