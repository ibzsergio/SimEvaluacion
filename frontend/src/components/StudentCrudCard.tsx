import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchStudentComms } from "../lib/api";
import { studentCrudReleased } from "../lib/crudLive";
import { CRUD_CHECKS, CRUD_CODIGO, CRUD_CONTEXTO, CRUD_PASOS, CRUD_PROGRAMA, CRUD_TITULO } from "../lib/crudScrum";

export default function StudentCrudCard() {
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [copied, setCopied] = useState(false);
  const comms = useQuery({
    queryKey: ["student-comms"],
    queryFn: fetchStudentComms,
    staleTime: 4_000,
    refetchInterval: 8_000,
  });
  if (!studentCrudReleased(comms.data?.announcements ?? [])) return null;

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(CRUD_CODIGO);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return (
    <section className="glass mb-6 border border-emerald-400/30 p-4 sm:p-6">
      <p className="text-[11px] font-bold uppercase tracking-widest text-emerald-200">{CRUD_PROGRAMA}</p>
      <h2 className="mt-1 text-2xl font-bold text-white">{CRUD_TITULO}</h2>
      <p className="mt-2 text-sm leading-relaxed text-slate-200">{CRUD_CONTEXTO}</p>
      <ol className="mt-4 list-decimal space-y-1 pl-5 text-sm text-slate-100">
        {CRUD_PASOS.map((paso) => (
          <li key={paso}>{paso}</li>
        ))}
      </ol>
      <p className="mt-4 text-sm text-emerald-100">
        Si tu MySQL pide contraseña, escríbela en <span className="font-semibold">password</span>. Para la segunda y la tercera tabla copias este archivo, cambias el nombre de la tabla y los campos, y dejas la misma función <span className="font-semibold">conectar()</span>.
      </p>
      <div className="mt-4 overflow-hidden rounded-2xl border border-white/10 bg-slate-950">
        <div className="flex items-center justify-between gap-2 border-b border-white/10 px-3 py-2">
          <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Formulario TEST · tabla test</p>
          <button
            type="button"
            onClick={() => void copyCode()}
            className="rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-bold text-slate-950"
          >
            {copied ? "Copiado" : "Copiar código"}
          </button>
        </div>
        <pre className="max-h-80 overflow-auto p-3 text-xs leading-relaxed text-emerald-100">{CRUD_CODIGO}</pre>
      </div>
      <ul className="mt-4 space-y-2">
        {CRUD_CHECKS.map((item) => (
          <li key={item.id}>
            <label className="flex items-start gap-2 text-sm text-slate-100">
              <input
                type="checkbox"
                className="mt-1"
                checked={Boolean(checked[item.id])}
                onChange={(event) => setChecked((prev) => ({ ...prev, [item.id]: event.target.checked }))}
              />
              <span>{item.text}</span>
            </label>
          </li>
        ))}
      </ul>
    </section>
  );
}
