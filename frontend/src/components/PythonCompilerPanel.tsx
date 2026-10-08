import { python } from "@codemirror/lang-python";
import { linter, lintGutter, type Diagnostic } from "@codemirror/lint";
import { EditorView } from "@codemirror/view";
import CodeMirror from "@uiw/react-codemirror";
import { vscodeDark, vscodeLight } from "@uiw/codemirror-theme-vscode";
import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { checkPythonSyntax, runPythonProgram } from "../lib/pyodideRunner";
import { useTheme } from "../lib/theme";

const STORAGE_KEY = "simeval_python_tk_code";
const TITLE_KEY = "simeval_python_tk_title";

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
  const [code, setCode] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) || DEFAULT_CODE;
    } catch {
      return DEFAULT_CODE;
    }
  });
  const [title, setTitle] = useState(() => {
    try {
      return localStorage.getItem(TITLE_KEY) || "Práctica 1";
    } catch {
      return "Práctica 1";
    }
  });
  const [output, setOutput] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "running" | "ready" | "error">("idle");
  const [message, setMessage] = useState(
    "El código de ahora se queda en este teléfono o computadora. Para llevarlo a otro lado, guarda el .py y ábrelo aquí.",
  );
  const hostRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, code);
      localStorage.setItem(TITLE_KEY, title);
    } catch {
      /* ignore */
    }
  }, [code, title]);

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
    try {
      const text = await file.text();
      setTitle(titleFromFileName(file.name));
      setCode(text);
      setMessage(`Archivo abierto: ${file.name}`);
    } catch {
      setMessage("No se pudo leer ese archivo. Prueba con un .py o .txt.");
    }
  }

  return (
    <section className="glass p-3 sm:p-5">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-white">Compilador Python + Tkinter</h2>
          {!compact ? (
            <p className="mt-1 text-sm text-slate-400">
              Escribe y ejecuta Python aquí. El borrador se queda en este dispositivo. Para otra
              computadora o teléfono, usa <span className="font-semibold text-cyan-200">.py</span>:
              “Guardar en el teléfono” y luego “Abrir del teléfono”.
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
        <label className="block min-w-0 text-sm text-slate-300">
          <span className="mb-1 block text-xs text-slate-500">Nombre del archivo</span>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={80}
            placeholder="Ej. Cuestionario ENHYPEN"
            className="min-h-11 w-full rounded-xl border border-white/10 bg-slate-900/70 px-3 text-sm text-white"
          />
        </label>
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" onClick={() => fileRef.current?.click()} className={secondaryBtn}>
            Abrir del teléfono
          </button>
          <button type="button" onClick={() => void saveToPhone()} className={secondaryBtn}>
            Guardar en el teléfono
          </button>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept=".py,.txt,text/x-python,text/plain"
          className="hidden"
          onChange={(e) => void onPickFile(e)}
        />
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
