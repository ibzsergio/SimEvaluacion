import { useEffect, useState } from "react";
import QRCode from "qrcode";

function QrCard({ title, subtitle, url }: { title: string; subtitle: string; url: string }) {
  const [dataUrl, setDataUrl] = useState("");

  useEffect(() => {
    let cancelled = false;
    QRCode.toDataURL(url, { width: 220, margin: 1, color: { dark: "#1e1b4b", light: "#ffffff" } })
      .then((value) => {
        if (!cancelled) setDataUrl(value);
      })
      .catch(() => {
        if (!cancelled) setDataUrl("");
      });
    return () => {
      cancelled = true;
    };
  }, [url]);

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-5 text-center">
      <h3 className="text-base font-semibold text-white">{title}</h3>
      <p className="mt-1 text-xs text-slate-400">{subtitle}</p>
      <div className="mt-4 flex justify-center">
        {dataUrl ? (
          <img src={dataUrl} alt={`QR ${title}`} className="rounded-xl bg-white p-2" width={220} height={220} />
        ) : (
          <div className="flex h-[220px] w-[220px] items-center justify-center rounded-xl bg-slate-800 text-slate-500">
            Generando QR...
          </div>
        )}
      </div>
      <p className="mt-3 break-all text-xs text-cyan-300/90">{url}</p>
    </div>
  );
}

export default function AccessQrPanel() {
  const origin = window.location.origin;
  const studentUrl = `${origin}/`;
  const teacherUrl = `${origin}/ingresar-docente`;

  return (
    <div className="space-y-6">
      <section className="glass p-6">
        <h2 className="text-lg font-semibold text-white">Acceso rápido con QR</h2>
        <p className="mt-2 text-sm text-slate-400">
          Imprime o muestra estos códigos en clase. Los alumnos escanean con la cámara o Safari y entran
          directo a la app (pueden agregarla a la pantalla de inicio).
        </p>
        <div className="mt-6 grid gap-6 md:grid-cols-2">
          <QrCard
            title="Alumnos"
            subtitle="Inicio de sesión alumnos"
            url={studentUrl}
          />
          <QrCard
            title="Docente"
            subtitle="Panel del docente"
            url={teacherUrl}
          />
        </div>
      </section>
    </div>
  );
}
