const DB_NAME = "simeval-practice-images";
const STORE = "files";

export type PracticeImage = {
  name: string;
  type: string;
  bytes: ArrayBuffer;
};

function openDb() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: "name" });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("No se pudieron guardar las imágenes."));
  });
}

function safeImageName(name: string) {
  const base = (name.split(/[/\\]/).pop() || "imagen.jpg").trim();
  const clean = base.replace(/[^\w.\- ()áéíóúüñÁÉÍÓÚÜÑ]+/gi, "_").replace(/_+/g, "_").slice(0, 80);
  return clean || "imagen.jpg";
}

function loadHtmlImage(url: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("no-decode"));
    img.src = url;
  });
}

/** En iPhone las fotos suelen llegar en HEIC. Safari las puede convertir a JPEG. */
async function normalizeImage(file: File): Promise<PracticeImage> {
  const name = safeImageName(file.name);
  const type = (file.type || "").toLowerCase();
  const raster = /png|jpe?g|gif|webp|bmp/.test(type) || /\.(png|jpe?g|gif|webp|bmp)$/i.test(name);
  if (raster) {
    return { name, type: file.type || "image/jpeg", bytes: await file.arrayBuffer() };
  }
  const url = URL.createObjectURL(file);
  try {
    const img = await loadHtmlImage(url);
    const canvas = document.createElement("canvas");
    canvas.width = img.naturalWidth || 1;
    canvas.height = img.naturalHeight || 1;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("no-canvas");
    ctx.drawImage(img, 0, 0);
    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((result) => (result ? resolve(result) : reject(new Error("no-blob"))), "image/jpeg", 0.92);
    });
    const stem = name.replace(/\.[^.]+$/, "") || "imagen";
    return { name: `${stem}.jpg`, type: "image/jpeg", bytes: await blob.arrayBuffer() };
  } catch {
    return { name, type: file.type || "application/octet-stream", bytes: await file.arrayBuffer() };
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function listPracticeImages(): Promise<PracticeImage[]> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).getAll();
    req.onsuccess = () => resolve((req.result as PracticeImage[]) ?? []);
    req.onerror = () => reject(req.error ?? new Error("No se pudieron leer las imágenes."));
  });
}

export async function addPracticeImages(files: File[]): Promise<PracticeImage[]> {
  const incoming = await Promise.all(files.map((file) => normalizeImage(file)));
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    const store = tx.objectStore(STORE);
    for (const image of incoming) store.put(image);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("No se pudieron guardar las imágenes."));
  });
  return listPracticeImages();
}

export async function removePracticeImage(name: string) {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).delete(name);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("No se pudo quitar la imagen."));
  });
}
