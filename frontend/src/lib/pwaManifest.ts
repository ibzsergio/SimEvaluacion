const TEACHER_ENTRY = "/ingresar-docente";

export function syncPwaManifest(pathname: string) {
  const isTeacherEntry = pathname === TEACHER_ENTRY;
  const manifestHref = isTeacherEntry ? "/manifest-docente.webmanifest" : "/manifest.webmanifest";
  const appTitle = isTeacherEntry ? "SimEval Doc" : "SimEval";

  let link = document.querySelector<HTMLLinkElement>('link[rel="manifest"]');
  if (!link) {
    link = document.createElement("link");
    link.rel = "manifest";
    document.head.appendChild(link);
  }
  if (link.href !== new URL(manifestHref, window.location.origin).href) {
    link.href = manifestHref;
  }

  document.querySelector('meta[name="apple-mobile-web-app-title"]')?.setAttribute("content", appTitle);
}
