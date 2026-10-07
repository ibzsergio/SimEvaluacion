import { TKINTER_SHIM } from "./pythonTkinterShim";

const PYODIDE_INDEX = "https://cdn.jsdelivr.net/pyodide/v0.27.2/full/";

type PyodideLike = {
  runPythonAsync: (code: string) => Promise<unknown>;
  setStdout: (opts: { batched: (s: string) => void }) => void;
  setStderr: (opts: { batched: (s: string) => void }) => void;
};

declare global {
  interface Window {
    loadPyodide?: (opts: { indexURL: string }) => Promise<PyodideLike>;
    __SIMEVAL_TK_HOST?: HTMLElement | null;
  }
}

let pyodidePromise: Promise<PyodideLike> | null = null;
let pyodideReady: PyodideLike | null = null;

function loadScript(src: string) {
  return new Promise<void>((resolve, reject) => {
    const existing = document.querySelector(`script[src="${src}"]`);
    if (existing) {
      resolve();
      return;
    }
    const s = document.createElement("script");
    s.src = src;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("No se pudo cargar el motor de Python. Conéctate una vez a internet."));
    document.head.appendChild(s);
  });
}

export function getPyodide(): Promise<PyodideLike> {
  if (!pyodidePromise) {
    pyodidePromise = (async () => {
      await loadScript(`${PYODIDE_INDEX}pyodide.js`);
      if (!window.loadPyodide) {
        throw new Error("El motor de Python no está disponible en este navegador.");
      }
      const py = await window.loadPyodide({ indexURL: PYODIDE_INDEX });
      await py.runPythonAsync(TKINTER_SHIM);
      pyodideReady = py;
      return py;
    })();
  }
  return pyodidePromise;
}

export async function runPythonProgram(
  code: string,
  host: HTMLElement,
  onOutput: (chunk: string) => void,
) {
  const py = await getPyodide();
  window.__SIMEVAL_TK_HOST = host;
  host.innerHTML = "";
  py.setStdout({ batched: onOutput });
  py.setStderr({ batched: onOutput });
  await py.runPythonAsync(TKINTER_SHIM);
  await py.runPythonAsync(code);
}

export async function checkPythonSyntax(code: string): Promise<{
  line: number;
  message: string;
} | null> {
  if (!pyodideReady) return null;
  try {
    await pyodideReady.runPythonAsync(`compile(${JSON.stringify(code)}, "<editor>", "exec")`);
    return null;
  } catch (err) {
    const text = err instanceof Error ? err.message : String(err);
    const lineMatch = text.match(/line (\d+)/i);
    const msgMatch = text.match(/SyntaxError:\s*(.+)/);
    return {
      line: lineMatch ? Number(lineMatch[1]) : 1,
      message: (msgMatch?.[1] ?? text.split("\n").pop() ?? "Error de sintaxis").trim(),
    };
  }
}
