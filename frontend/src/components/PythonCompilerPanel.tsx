import { python } from "@codemirror/lang-python";
import { linter, lintGutter, type Diagnostic } from "@codemirror/lint";
import { EditorView } from "@codemirror/view";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import CodeMirror from "@uiw/react-codemirror";
import { vscodeDark, vscodeLight } from "@uiw/codemirror-theme-vscode";
import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import {
  createPythonPractice,
  deletePythonPractice,
  fetchPythonPractice,
  fetchPythonPractices,
  getApiErrorMessage,
  updatePythonPractice,
} from "../lib/api";
import { checkPythonSyntax, runPythonProgram } from "../lib/pyodideRunner";
import { useTheme } from "../lib/theme";

const STORAGE_KEY = "simeval_python_tk_code";
const META_KEY = "simeval_python_tk_meta";

const DEFAULT_CODE = `import tkinter as tk
from tkinter import messagebox

ventana = tk.Tk()
ventana.title("Práctica Tkinter")
ventana.geometry("320x240")

tk.Label(ventana, text="Hola, SimEvaluación", font=("Arial", 14, "bold")).pack(pady=10)

nombre = tk.StringVar()
tk.Label(ventana, text="Escribe tu nombre:").pack()
tk.Entry(ventana, textvariable=nombre).pack(pady=6, padx=12, fill="x")

def saludar():
    n = nombre.get().strip() or "estudiante"
    messagebox.showinfo("Saludo", f"Hola, {n}")

tk.Button(ventana, text="Saludar", command=saludar).pack(pady=10)

ventana.mainloop()
`;

const editorTheme = EditorView.theme({
  "&": { height: "100%", fontSize: "15px" },
  ".cm-content": { fontFamily: 'Consolas, "Cascadia Code", "Fira Code", ui-monospace, monospace' },
  ".cm-scroller": {
    height: "100%",
    overflowX: "scroll",
    overflowY: "scroll",
  },
  "@media (max-width: 640px)": {
    "&": { fontSize: "16px" },
  },
});

const secondaryBtn =
  "min-h-11 rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm font-semibold text-slate-100 hover:bg-white/10 disabled:opacity-60";

function rangeForLine(code: string, line: number) {
  const lines = code.split("\n");
  const index = Math.max(1, Math.min(line, lines.length)) - 1;
  let from = 0;
  for (let i = 0; i < index; i++) from += (lines[i]?.length ?? 0) + 1;
  const text = lines[index] ?? "";
  const start = from + (text.match(/^\s*/)?.[0].length ?? 0);
  return { from: start, to: Math.max(start + 1, from + text.length) };
}

function readMeta() {
  try {
    const raw = localStorage.getItem(META_KEY);
    if (!raw) return { id: "", title: "Práctica 1" };
    const parsed = JSON.parse(raw) as { id?: string; title?: string };
    return { id: parsed.id ?? "", title: parsed.title?.trim() || "Práctica 1" };
  } catch {
    return { id: "", title: "Práctica 1" };
  }
}

function fileNameFromTitle(title: string) {
  const base = title
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 60);
  return `${base || "practica"}.py`;
}

function titleFromFileName(name: string) {
  return name.replace(/\.(py|txt)$/i, "").replace(/[_-]+/g, " ").trim() || "Práctica";
}

export default function PythonCompilerPanel({ compact }: { compact?: boolean }) {
  const { theme } = useTheme();
  const qc = useQueryClient();
  const meta0 = readMeta();
  const [code, setCode] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) || DEFAULT_CODE;
    } catch {
      return DEFAULT_CODE;
    }
  });
  const [title, setTitle] = useState(meta0.title);
  const [currentId, setCurrentId] = useState(meta0.id);
  const [savedCode, setSavedCode] = useState(code);
  const [savedTitle, setSavedTitle] = useState(meta0.title);
  const [busy, setBusy] = useState<"save" | "load" | "delete" | "file" | null>(null);
  const [output, setOutput] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "running" | "ready" | "error">("idle");
  const [message, setMessage] = useState(
    "Guarda en la plataforma para no perder el trabajo, o baja el .py a tu teléfono y ábrelo después aquí.",
  );
  const hostRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const practicesQuery = useQuery({
    queryKey: ["python-practices"],
    queryFn: fetchPythonPractices,
    staleTime: 15_000,
    retry: 1,
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, code);
      localStorage.setItem(META_KEY, JSON.stringify({ id: currentId, title }));
    } catch {
      /* ignore */
    }
  }, [code, currentId, title]);

  const dirty = code !== savedCode || title.trim() !== savedTitle.trim();

  const extensions = useMemo(
    () => [
      python(),
      lintGutter(),
      editorTheme,
      linter(
        async (view) => {
          const text = view.state.doc.toString();
          const err = await checkPythonSyntax(text);
          if (!err) return [] as Diagnostic[];
          const range = rangeForLine(text, err.line);
          return [
            {
              from: range.from,
              to: range.to,
              severity: "error" as const,
              message: err.message,
            },
          ];
        },
        { delay: 700 },
      ),
    ],
    [],
  );

  function confirmDiscard() {
    if (!dirty) return true;
    return window.confirm("Hay cambios sin guardar. ¿Descartarlos y continuar?");
  }

  function applyLoaded(next: { id: string; title: string; code: string }) {
    setCurrentId(next.id);
    setTitle(next.title);
    setCode(next.code);
    setSavedCode(next.code);
    setSavedTitle(next.title);
  }

  async function run() {
    const host = hostRef.current;
    if (!host) return;
    setOutput("");
    setStatus("loading");
    setMessage("Cargando Python…");
    try {
      setStatus("running");
      setMessage("Ejecutando…");
      await runPythonProgram(code, host, (chunk) => {
        setOutput((prev) => prev + chunk);
      });
      setStatus("ready");
      setMessage("Listo. La ventana Tkinter aparece debajo del código (puedes desplazarte si el programa es ancho).");
    } catch (err) {
      const text = err instanceof Error ? err.message : String(err);
      setStatus("error");
      setMessage("Revisa el código. Si es la primera vez, conecta internet para descargar Python.");
      setOutput((prev) => (prev ? prev + "\n" : "") + text);
    }
  }

  async function saveToPlatform() {
    const name = title.trim() || "Práctica";
    setBusy("save");
    try {
      if (currentId) {
        const saved = await updatePythonPractice(currentId, name, code);
        applyLoaded(saved);
      } else {
        const saved = await createPythonPractice(name, code);
        applyLoaded(saved);
      }
      await qc.invalidateQueries({ queryKey: ["python-practices"] });
      setMessage("Práctica guardada en tu cuenta. La puedes abrir en esta computadora o en tu teléfono.");
    } catch (err) {
      setMessage(getApiErrorMessage(err));
    } finally {
      setBusy(null);
    }
  }

  async function openFromPlatform(id: string) {
    if (!id) return;
    if (id === currentId) return;
    if (!confirmDiscard()) return;
    setBusy("load");
    try {
      const item = await fetchPythonPractice(id);
      applyLoaded(item);
      setMessage(`Abierta: ${item.title}`);
    } catch (err) {
      setMessage(getApiErrorMessage(err));
    } finally {
      setBusy(null);
    }
  }

  function newPractice() {
    if (!confirmDiscard()) return;
    applyLoaded({ id: "", title: "Nueva práctica", code: DEFAULT_CODE });
    setMessage("Nueva práctica. Recuerda guardarla en la plataforma o en tu teléfono.");
  }

  async function removePractice() {
    if (!currentId) return;
    if (!window.confirm("¿Eliminar esta práctica de la plataforma? El archivo en tu teléfono no se borra.")) {
      return;
    }
    setBusy("delete");
    try {
      await deletePythonPractice(currentId);
      await qc.invalidateQueries({ queryKey: ["python-practices"] });
      applyLoaded({ id: "", title: "Nueva práctica", code: DEFAULT_CODE });
      setMessage("Práctica eliminada de la plataforma.");
    } catch (err) {
      setMessage(getApiErrorMessage(err));
    } finally {
      setBusy(null);
    }
  }

  async function saveToPhone() {
    const name = fileNameFromTitle(title.trim() || "practica");
    const file = new File([code], name, { type: "text/x-python" });
    const nav = navigator as Navigator & {
      canShare?: (data: ShareData) => boolean;
    };
    if (typeof nav.share === "function" && nav.canShare?.({ files: [file] })) {
      try {
        await nav.share({ files: [file], title: name, text: title });
        setMessage("Archivo listo para guardarlo en el teléfono o enviarlo.");
        return;
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
      }
    }
    const url = URL.createObjectURL(file);
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.click();
    URL.revokeObjectURL(url);
    setMessage("Se descargó el archivo .py. En el teléfono, elígelo en Archivos o Descargas.");
  }

  async function onPickFile(ev: ChangeEvent<HTMLInputElement>) {
    const file = ev.target.files?.[0];
    ev.target.value = "";
    if (!file) return;
    if (!confirmDiscard()) return;
    setBusy("file");
    try {
      const text = await file.text();
      applyLoaded({ id: "", title: titleFromFileName(file.name), code: text });
      setMessage(`Archivo abierto: ${file.name}. Guárdalo en la plataforma si quieres tenerlo en tu cuenta.`);
    } catch {
      setMessage("No se pudo leer ese archivo. Prueba con un .py o .txt.");
    } finally {
      setBusy(null);
    }
  }

  const items = practicesQuery.data?.items ?? [];
  const busyNow = busy !== null || status === "loading" || status === "running";

  return (
    <section className="glass p-3 sm:p-5">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-white">Compilador Python + Tkinter</h2>
          {!compact ? (
            <p className="mt-1 text-sm text-slate-400">
              Escribe y ejecuta Python aquí. Guarda la práctica en tu cuenta para abrirla en cualquier
              dispositivo, o baja el archivo <span className="font-semibold text-cyan-200">.py</span> al
              teléfono y ábrelo después con “Abrir del teléfono”.
            </p>
          ) : null}
        </div>
        <button
          type="button"
          onClick={() => void run()}
          disabled={status === "loading" || status === "running"}
          className="min-h-11 rounded-xl bg-gradient-to-r from-indigo-500 to-cyan-500 px-5 py-2.5 text-sm font-semibold text-white shadow-lg disabled:opacity-60"
        >
          {status === "loading" || status === "running" ? "Ejecutando…" : "Ejecutar"}
        </button>
      </div>

      <div className="mb-3 rounded-xl border border-white/10 bg-slate-950/30 p-3">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
          Tus prácticas
        </p>
        <div className="grid gap-2 sm:grid-cols-2">
          <label className="block min-w-0 text-sm text-slate-300">
            <span className="mb-1 block text-xs text-slate-500">Guardadas en la plataforma</span>
            <select
              value={currentId}
              disabled={busyNow}
              onChange={(e) => {
                const id = e.target.value;
                if (!id) {
                  newPractice();
                  return;
                }
                void openFromPlatform(id);
              }}
              className="min-h-11 w-full rounded-xl border border-white/10 bg-slate-900/70 px-3 text-sm text-white"
            >
              <option value="">{currentId ? "— Nueva práctica —" : "— Sin guardar aún —"}</option>
              {items.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.title}
                </option>
              ))}
            </select>
          </label>
          <label className="block min-w-0 text-sm text-slate-300">
            <span className="mb-1 block text-xs text-slate-500">Nombre de esta práctica</span>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={120}
              placeholder="Ej. Cuestionario ENHYPEN"
              className="min-h-11 w-full rounded-xl border border-white/10 bg-slate-900/70 px-3 text-sm text-white"
            />
          </label>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" disabled={busyNow} onClick={() => void saveToPlatform()} className={secondaryBtn}>
            {busy === "save" ? "Guardando…" : currentId ? "Guardar cambios" : "Guardar en la plataforma"}
          </button>
          <button type="button" disabled={busyNow} onClick={newPractice} className={secondaryBtn}>
            Nueva
          </button>
          <button
            type="button"
            disabled={busyNow}
            onClick={() => fileRef.current?.click()}
            className={secondaryBtn}
          >
            Abrir del teléfono
          </button>
          <button type="button" disabled={busyNow} onClick={() => void saveToPhone()} className={secondaryBtn}>
            Guardar en el teléfono
          </button>
          <button
            type="button"
            disabled={busyNow || !currentId}
            onClick={() => void removePractice()}
            className={`${secondaryBtn} border-rose-400/30 text-rose-100`}
          >
            {busy === "delete" ? "Eliminando…" : "Eliminar"}
          </button>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept=".py,.txt,text/x-python,text/plain"
          className="hidden"
          onChange={(e) => void onPickFile(e)}
        />
        <p className="mt-2 text-xs text-slate-500">
          {practicesQuery.isError
            ? "No se pudieron cargar las prácticas (hace falta internet). Aun así puedes abrir o bajar un .py."
            : dirty
              ? "Hay cambios sin guardar en la plataforma."
              : items.length
                ? `${items.length} práctica${items.length === 1 ? "" : "s"} en tu cuenta.`
                : "Aún no hay prácticas en tu cuenta."}
        </p>
      </div>

      <p
        className={`mb-3 text-xs ${
          status === "error" ? "text-rose-300" : status === "ready" ? "text-emerald-300" : "text-slate-500"
        }`}
      >
        {message}
      </p>
      <div className="grid gap-3">
        <div className="block min-w-0">
          <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-400">
            Código
          </span>
          <div className="python-code-editor h-[22rem] overflow-auto rounded-xl border border-white/10 sm:h-[28rem]">
            <CodeMirror
              value={code}
              height="100%"
              theme={theme === "light" ? vscodeLight : vscodeDark}
              extensions={extensions}
              onChange={setCode}
              basicSetup={{
                lineNumbers: true,
                highlightActiveLine: true,
                highlightActiveLineGutter: true,
                foldGutter: true,
                autocompletion: true,
                bracketMatching: true,
                closeBrackets: true,
                indentOnInput: true,
              }}
            />
          </div>
        </div>
        <div className="min-w-0">
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
            Ventana Tkinter
          </p>
          <div
            ref={hostRef}
            className="relative min-h-[22rem] max-h-[75vh] overflow-auto rounded-xl border border-white/10 bg-slate-200 p-2 sm:min-h-[28rem] lg:min-h-[36rem]"
          />
          <p className="mt-3 mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
            Salida (print)
          </p>
          <pre className="max-h-40 overflow-auto whitespace-pre-wrap rounded-xl border border-white/10 bg-slate-950/60 p-3 text-xs text-slate-300">
            {output || "—"}
          </pre>
        </div>
      </div>
    </section>
  );
}
