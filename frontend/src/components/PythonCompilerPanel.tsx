import { python } from "@codemirror/lang-python";
import { linter, lintGutter, type Diagnostic } from "@codemirror/lint";
import { EditorView } from "@codemirror/view";
import CodeMirror from "@uiw/react-codemirror";
import { vscodeDark, vscodeLight } from "@uiw/codemirror-theme-vscode";
import { useEffect, useMemo, useRef, useState } from "react";
import { checkPythonSyntax, runPythonProgram } from "../lib/pyodideRunner";
import { useTheme } from "../lib/theme";

const STORAGE_KEY = "simeval_python_tk_code";

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
  ".cm-scroller": { overflow: "auto", minHeight: "22rem" },
  "@media (max-width: 640px)": {
    "&": { fontSize: "16px" },
  },
});

function rangeForLine(code: string, line: number) {
  const lines = code.split("\n");
  const index = Math.max(1, Math.min(line, lines.length)) - 1;
  let from = 0;
  for (let i = 0; i < index; i++) from += (lines[i]?.length ?? 0) + 1;
  const text = lines[index] ?? "";
  const start = from + (text.match(/^\s*/)?.[0].length ?? 0);
  return { from: start, to: Math.max(start + 1, from + text.length) };
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
  const [output, setOutput] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "running" | "ready" | "error">("idle");
  const [message, setMessage] = useState("La primera vez necesita internet unos segundos. Después funciona sin conexión.");
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, code);
    } catch {
      /* ignore */
    }
  }, [code]);

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
      setMessage("Listo. La ventana Tkinter está a la derecha (o abajo, en el teléfono).");
    } catch (err) {
      const text = err instanceof Error ? err.message : String(err);
      setStatus("error");
      setMessage("Revisa el código. Si es la primera vez, conecta internet para descargar Python.");
      setOutput((prev) => (prev ? prev + "\n" : "") + text);
    }
  }

  return (
    <section className="glass p-3 sm:p-5">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-white">Compilador Python + Tkinter</h2>
          <p className="mt-1 text-sm text-slate-400">
            Escribe y ejecuta Python aquí, en computadora o teléfono. Sirve para prácticas con{" "}
            <span className="font-semibold text-cyan-200">tkinter</span> (Label, Button, Entry, Frame,
            Canvas, messagebox…). La primera carga descarga el motor; luego queda en el teléfono aunque
            no haya red.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void run()}
            disabled={status === "loading" || status === "running"}
            className="min-h-11 rounded-xl bg-gradient-to-r from-indigo-500 to-cyan-500 px-5 py-2.5 text-sm font-semibold text-white shadow-lg disabled:opacity-60"
          >
            {status === "loading" || status === "running" ? "Ejecutando…" : "Ejecutar"}
          </button>
        </div>
      </div>
      <p
        className={`mb-3 text-xs ${
          status === "error" ? "text-rose-300" : status === "ready" ? "text-emerald-300" : "text-slate-500"
        }`}
      >
        {message}
      </p>
      <div className={`grid gap-3 ${compact ? "" : "lg:grid-cols-2"}`}>
        <div className="block min-w-0">
          <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-400">
            Código
          </span>
          <div className="h-[22rem] overflow-hidden rounded-xl border border-white/10 sm:h-[28rem]">
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
            className="relative min-h-[16rem] overflow-hidden rounded-xl border border-white/10 bg-slate-900/40 p-2 sm:min-h-[20rem]"
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
