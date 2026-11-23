export async function copiarPdf(file: File, maxBytes: number) {
  const bytes = await file.arrayBuffer();
  if (bytes.byteLength === 0) {
    throw new Error("No se pudo leer el PDF. Ciérralo si está abierto y vuelve a elegirlo.");
  }
  if (bytes.byteLength > maxBytes) {
    const mb = Math.round(maxBytes / (1024 * 1024));
    throw new Error(`El PDF pesa más de ${mb} MB. Redúcelo y vuelve a elegirlo.`);
  }
  const name = file.name?.toLowerCase().endsWith(".pdf") ? file.name : "entrega.pdf";
  return new File([bytes], name, { type: "application/pdf" });
}
