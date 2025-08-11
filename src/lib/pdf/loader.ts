/**
 * Загрузчик UMD-скриптов jsPDF и jspdf-autotable
 * Используется для обхода проблем сборки (canvg peer dep) и работы через window.jspdf
 */

let loadingPromise: Promise<void> | null = null;

/**
 * Загружает внешний скрипт в документ
 */
function loadScript(src: string): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const existing = Array.from(document.getElementsByTagName('script')).find(
      (s) => s.src === src
    );
    if (existing) {
      if ((existing as any)._loaded) return resolve();
      existing.addEventListener('load', () => resolve());
      existing.addEventListener('error', () => reject(new Error(`Failed to load ${src}`)));
      return;
    }
    const script = document.createElement('script');
    script.src = src;
    script.async = true;
    (script as any)._loaded = false;
    script.onload = () => {
      (script as any)._loaded = true;
      resolve();
    };
    script.onerror = () => reject(new Error(`Failed to load ${src}`));
    document.head.appendChild(script);
  });
}

/**
 * Гарантирует наличие window.jspdf (UMD) и плагина autoTable
 */
export async function ensureJsPdf(): Promise<void> {
  if (typeof window === 'undefined') return;
  if ((window as any).jspdf?.jsPDF && (window as any).jspdf?.jsPDF?.API?.autoTable) {
    return;
  }
  if (!loadingPromise) {
    loadingPromise = (async () => {
      // UMD-сборки с CDN
      const jsPdfUrl = 'https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js';
      const autoTableUrl =
        'https://cdn.jsdelivr.net/npm/jspdf-autotable@3.8.2/dist/jspdf.plugin.autotable.min.js';
      await loadScript(jsPdfUrl);
      await loadScript(autoTableUrl);
      // Небольшая задержка для инициализации глобалей
      await new Promise((r) => setTimeout(r, 20));
    })();
  }
  await loadingPromise;
}

/**
 * Получить jsPDF конструктор из window.jspdf (после ensureJsPdf)
 */
export function getJsPdfCtor(): any {
  return (window as any).jspdf?.jsPDF || (window as any).jsPDF || null;
}