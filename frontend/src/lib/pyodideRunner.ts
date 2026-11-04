import { listPracticeImages, practiceImageKeys } from "./practiceImages";
import { TKINTER_SHIM } from "./pythonTkinterShim";

const PYODIDE_INDEX = "https://cdn.jsdelivr.net/pyodide/v0.27.2/full/";

type PyodideLike = {
  runPythonAsync: (code: string) => Promise<unknown>;
  setStdout: (opts: { batched: (s: string) => void }) => void;
  setStderr: (opts: { batched: (s: string) => void }) => void;
  FS: {
    mkdirTree: (path: string) => void;
    writeFile: (path: string, data: Uint8Array) => void;
  };
};

declare global {
  interface Window {
    loadPyodide?: (opts: { indexURL: string }) => Promise<PyodideLike>;
    __SIMEVAL_TK_HOST?: HTMLElement | null;
    __SIMEVAL_IMAGE_URLS_JSON?: string;
    __SIMEVAL_IMAGE_NAMES?: string;
  }
}

const practiceBlobUrls: string[] = [];

async function syncPracticeImages(py: PyodideLike) {
  const images = await listPracticeImages();
  for (const url of practiceBlobUrls) URL.revokeObjectURL(url);
  practiceBlobUrls.length = 0;
  const urls: Record<string, string> = {};
  const cwd = String(await py.runPythonAsync("import os; os.getcwd()"));
  const folders = ["/imagenes", `${cwd}/imagenes`, cwd, "/home/pyodide", "/home/pyodide/imagenes"];
  for (const folder of folders) {
    try {
      py.FS.mkdirTree(folder);
    } catch {
      /* la carpeta ya existe */
    }
  }
  for (const image of images) {
    const bytes = new Uint8Array(image.bytes);
    for (const folder of folders) {
      try {
        py.FS.writeFile(`${folder}/${image.name}`, bytes);
      } catch {
        /* un destino puede no aceptar el archivo */
      }
    }
    const url = URL.createObjectURL(new Blob([bytes], { type: image.type || "image/jpeg" }));
    practiceBlobUrls.push(url);
    for (const key of practiceImageKeys(image.name)) urls[key] = url;
    for (const alias of practiceImageKeys(image.name)) {
      if (alias === image.name) continue;
      for (const folder of folders) {
        try {
          py.FS.writeFile(`${folder}/${alias}`, bytes);
        } catch {
          /* el alias ya existe */
        }
      }
    }
  }
  window.__SIMEVAL_IMAGE_URLS_JSON = JSON.stringify(urls);
  window.__SIMEVAL_IMAGE_NAMES = images.map((image) => image.name).join("\n");
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
    s.onerror = () =>
      reject(
        new Error(
          "No hay internet o el navegador bloqueó la carga. Conéctate a WiFi y vuelve a intentar. No instales Python en el teléfono.",
        ),
      );
    document.head.appendChild(s);
  });
}

export function isPythonEngineReady() {
  return pyodideReady != null;
}

export function getPyodide(): Promise<PyodideLike> {
  if (!pyodidePromise) {
    pyodidePromise = (async () => {
      await loadScript(`${PYODIDE_INDEX}pyodide.js`);
      if (!window.loadPyodide) {
        throw new Error("Este navegador no pudo preparar Python. Prueba Chrome o Safari.");
      }
      const py = await window.loadPyodide({ indexURL: PYODIDE_INDEX });
      await py.runPythonAsync(TKINTER_SHIM);
      pyodideReady = py;
      return py;
    })().catch((err) => {
      pyodidePromise = null;
      throw err;
    });
  }
  return pyodidePromise;
}

export function preloadPythonEngine() {
  return getPyodide();
}

/** Espacios invisibles y comillas raras al pegar desde Word, WhatsApp o PDF. */
export function sanitizePythonSource(source: string) {
  return source
    .replace(/^\uFEFF/, "")
    .replace(/[\u00A0\u202F\u2007\u2008\u2009\u200A\u3000]/g, " ")
    .replace(/[\u200B\u200C\u200D\u2060\u00AD]/g, "")
    .replace(/[\u2018\u2019\u201A\u201B]/g, "'")
    .replace(/[\u201C\u201D\u201E\u201F]/g, '"');
}

export function formatPythonError(err: unknown) {
  const text = err instanceof Error ? err.message : String(err);
  const lineMatch = text.match(/File "<exec>", line (\d+)/) ?? text.match(/line (\d+)/i);
  const syntaxMatch = text.match(/SyntaxError:\s*(.+)/);
  if (syntaxMatch) {
    const line = lineMatch?.[1] ?? "?";
    return `Error de sintaxis en la línea ${line}: ${syntaxMatch[1].trim()}`;
  }
  const useful = text
    .split("\n")
    .filter((line) => !line.includes("/lib/python") && !line.includes("_pyodide/_base.py"))
    .join("\n")
    .trim();
  return useful || text;
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
  await syncPracticeImages(py);
  // El código corre con exec, no como archivo. Sin esto, __file__ lanza NameError.
  await py.runPythonAsync(
    `__file__ = __import__("os").path.join(__import__("os").getcwd(), "programa.py")`,
  );
  await py.runPythonAsync(sanitizePythonSource(code));
}

export async function checkPythonSyntax(code: string): Promise<{
  line: number;
  message: string;
} | null> {
  if (!pyodideReady) return null;
  const clean = sanitizePythonSource(code);
  try {
    await pyodideReady.runPythonAsync(`compile(${JSON.stringify(clean)}, "<editor>", "exec")`);
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
