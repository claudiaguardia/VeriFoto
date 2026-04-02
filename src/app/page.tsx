"use client";

import { useMemo, useRef, useState } from "react";

type VerificationStatus = "verified" | "unverified" | "edited" | "ai";

type AnalysisSignal = {
  label: string;
  value: string;
  tone: string;
};

type CaptureCertificate = {
  id: string;
  capturedAt: string;
  deviceId: string;
  sha256: string;
  signature: string;
  location?: string;
};

const statusMap: Record<
  VerificationStatus,
  { label: string; tone: string; badge: string; summary: string }
> = {
  verified: {
    label: "Verificada",
    tone: "border-emerald-400/30 bg-emerald-500/10 text-emerald-200",
    badge: "✅ Evidencia fuerte",
    summary:
      "La imagen coincide con una captura registrada y su evidencia criptográfica sigue siendo consistente.",
  },
  unverified: {
    label: "Sin prueba de origen",
    tone: "border-amber-400/30 bg-amber-500/10 text-amber-100",
    badge: "⚠️ No verificable",
    summary:
      "No se encontró una prueba de captura confiable. Eso no demuestra fraude, pero tampoco autenticidad.",
  },
  edited: {
    label: "Posible edición",
    tone: "border-orange-400/30 bg-orange-500/10 text-orange-100",
    badge: "✏️ Posible alteración",
    summary:
      "La evidencia visual y técnica sugiere que la imagen pudo haber sido retocada o recompuesta.",
  },
  ai: {
    label: "Posible IA",
    tone: "border-fuchsia-400/30 bg-fuchsia-500/10 text-fuchsia-100",
    badge: "🧠 Señales compatibles con IA",
    summary:
      "Se detectaron patrones que suelen aparecer en imágenes generadas o fuertemente sintetizadas.",
  },
};

const hashString = async (input: string) => {
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
};

const shortenHash = (hash: string) => `${hash.slice(0, 12)}…${hash.slice(-8)}`;

const generateSignals = (status: VerificationStatus): AnalysisSignal[] => {
  switch (status) {
    case "verified":
      return [
        { label: "Firma", value: "Válida", tone: "text-emerald-300" },
        { label: "Hash", value: "Coincide con certificado", tone: "text-emerald-300" },
        { label: "Metadatos", value: "Consistentes", tone: "text-white/80" },
        { label: "Riesgo", value: "Bajo", tone: "text-emerald-200" },
      ];
    case "edited":
      return [
        { label: "Compresión", value: "Inconsistente", tone: "text-orange-300" },
        { label: "Bordes", value: "Halos detectados", tone: "text-orange-300" },
        { label: "Metadatos", value: "Parciales / extraños", tone: "text-white/80" },
        { label: "Riesgo", value: "Medio-Alto", tone: "text-orange-200" },
      ];
    case "ai":
      return [
        { label: "Texturas", value: "Patrón sintético", tone: "text-fuchsia-300" },
        { label: "Iluminación", value: "Uniformidad sospechosa", tone: "text-fuchsia-300" },
        { label: "Metadatos", value: "Sin origen verificable", tone: "text-white/80" },
        { label: "Riesgo", value: "Alto", tone: "text-fuchsia-200" },
      ];
    default:
      return [
        { label: "Firma", value: "No encontrada", tone: "text-amber-300" },
        { label: "Hash", value: "Sin registro comparable", tone: "text-amber-300" },
        { label: "Metadatos", value: "Limitados", tone: "text-white/80" },
        { label: "Riesgo", value: "Indeterminado", tone: "text-amber-200" },
      ];
  }
};

const features = [
  {
    title: "Captura verificable",
    description:
      "La foto genera huella SHA-256, fecha, dispositivo y una firma demostrativa para dejar rastro desde el origen.",
  },
  {
    title: "Cadena de custodia",
    description:
      "El certificado acompaña a la imagen para validar integridad y registrar si la evidencia se rompe o cambia.",
  },
  {
    title: "Análisis de riesgo",
    description:
      "Cuando no hay prueba de origen, el sistema muestra señales compatibles con edición o generación por IA.",
  },
  {
    title: "Resultado legible",
    description:
      "Nada de promesas absolutas: el prototipo traduce evidencia técnica a un estado claro y accionable.",
  },
];

export default function Home() {
  const [captureNote, setCaptureNote] = useState("");
  const [locationEnabled, setLocationEnabled] = useState(true);
  const [certificate, setCertificate] = useState<CaptureCertificate | null>(null);
  const [captureBusy, setCaptureBusy] = useState(false);

  const [uploadedName, setUploadedName] = useState("imagen_demo.jpg");
  const [analysisMode, setAnalysisMode] = useState<VerificationStatus>("verified");
  const [analysisBusy, setAnalysisBusy] = useState(false);
  const [analysisHash, setAnalysisHash] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const resultConfig = useMemo(() => statusMap[analysisMode], [analysisMode]);
  const signals = useMemo(() => generateSignals(analysisMode), [analysisMode]);

  const handleCapture = async () => {
    setCaptureBusy(true);
    const capturedAt = new Date().toISOString();
    const deviceId = "web-demo-device";
    const payload = `${captureNote}|${capturedAt}|${deviceId}|${locationEnabled ? "gps:on" : "gps:off"}`;
    const sha256 = await hashString(payload);
    const signature = await hashString(`signature:${sha256}:${deviceId}`);

    setCertificate({
      id: `VF-${Date.now().toString().slice(-6)}`,
      capturedAt,
      deviceId,
      sha256,
      signature,
      location: locationEnabled ? "Rosario, Santa Fe (aprox.)" : undefined,
    });
    setCaptureBusy(false);
  };

  const handleFileSelection = async (file?: File) => {
    if (!file) return;

    setAnalysisBusy(true);
    setUploadedName(file.name);
    const content = `${file.name}:${file.size}:${file.type}:${file.lastModified}`;
    const digest = await hashString(content);
    setAnalysisHash(digest);

    const name = file.name.toLowerCase();
    if (name.includes("ai") || name.includes("ia") || name.includes("midjourney")) {
      setAnalysisMode("ai");
    } else if (name.includes("edit") || name.includes("retouch") || name.includes("photoshop")) {
      setAnalysisMode("edited");
    } else if (name.includes("raw") || name.includes("proof") || name.includes("verify")) {
      setAnalysisMode("verified");
    } else {
      setAnalysisMode("unverified");
    }

    setAnalysisBusy(false);
  };

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(34,211,238,0.16),_transparent_35%),linear-gradient(180deg,_#081019_0%,_#05070d_100%)] text-white">
      <section className="mx-auto flex w-full max-w-7xl flex-col px-6 py-8 sm:px-10 lg:px-12">
        <header className="flex flex-col gap-6 rounded-[2rem] border border-white/10 bg-white/5 px-6 py-6 backdrop-blur sm:px-8">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.38em] text-cyan-200/70">VeriFoto MVP</p>
              <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-5xl">
                Evidencia fuerte de autenticidad para imágenes.
              </h1>
              <p className="mt-5 max-w-3xl text-base leading-8 text-white/70 sm:text-lg">
                Este prototipo no promete verdad absoluta. Sí muestra cómo capturar prueba de
                origen, conservar integridad y comunicar riesgo de edición o IA con un lenguaje
                entendible.
              </p>
            </div>

            <div className="rounded-3xl border border-cyan-400/20 bg-cyan-400/10 px-5 py-4 text-sm text-cyan-100 shadow-lg shadow-cyan-950/20">
              <p className="font-medium">Posicionamiento del producto</p>
              <p className="mt-2 max-w-xs leading-6 text-cyan-50/80">
                “No aseguramos que una imagen sea real al 100%. Aportamos evidencia verificable y
                señales técnicas para estimar confianza.”
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-3 text-sm">
            <a href="#captura" className="rounded-full bg-white px-5 py-3 font-medium text-black transition hover:bg-white/90">
              Tomar foto verificable
            </a>
            <a href="#analisis" className="rounded-full border border-white/15 px-5 py-3 font-medium text-white/85 transition hover:border-white/35 hover:text-white">
              Analizar imagen
            </a>
            <a href="#arquitectura" className="rounded-full border border-white/10 bg-white/5 px-5 py-3 font-medium text-white/70 transition hover:bg-white/10 hover:text-white">
              Ver arquitectura MVP
            </a>
          </div>
        </header>

        <section className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {features.map((feature) => (
            <article key={feature.title} className="rounded-[1.6rem] border border-white/10 bg-white/5 p-5">
              <h2 className="text-lg font-semibold tracking-tight">{feature.title}</h2>
              <p className="mt-3 text-sm leading-7 text-white/68">{feature.description}</p>
            </article>
          ))}
        </section>

        <section className="mt-10 grid gap-8 lg:grid-cols-[1fr_1fr]">
          <article id="captura" className="rounded-[2rem] border border-white/10 bg-[#0c1420]/85 p-6 shadow-2xl shadow-black/20">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-cyan-200/65">Pantalla 1</p>
                <h2 className="mt-2 text-2xl font-semibold tracking-tight">Captura verificable</h2>
              </div>
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/60">
                Cámara + manifiesto
              </span>
            </div>

            <div className="mt-6 grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
              <div className="rounded-[1.6rem] border border-dashed border-cyan-300/25 bg-gradient-to-br from-cyan-400/10 to-transparent p-4">
                <div className="aspect-[3/4] rounded-[1.25rem] border border-white/10 bg-[linear-gradient(160deg,_rgba(34,211,238,0.18),_rgba(17,24,39,0.35))] p-4">
                  <div className="flex h-full flex-col justify-between rounded-[1rem] border border-white/10 bg-black/20 p-4">
                    <div className="flex items-center justify-between text-xs text-white/55">
                      <span>Vista previa de cámara</span>
                      <span>Demo</span>
                    </div>
                    <div className="space-y-2 text-sm text-white/70">
                      <p>• fecha y hora</p>
                      <p>• hash SHA-256</p>
                      <p>• firma del dispositivo</p>
                      <p>• ubicación opcional</p>
                    </div>
                    <button
                      type="button"
                      onClick={handleCapture}
                      disabled={captureBusy}
                      className="rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-black transition hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {captureBusy ? "Generando certificado..." : "Simular captura verificable"}
                    </button>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-white/80">Nota de captura</span>
                  <input
                    value={captureNote}
                    onChange={(event) => setCaptureNote(event.target.value)}
                    placeholder="Ej: prueba de producto, documento, incidente..."
                    className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none ring-0 placeholder:text-white/35 focus:border-cyan-300/40"
                  />
                </label>

                <label className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/80">
                  <span>Incluir ubicación aproximada</span>
                  <input
                    type="checkbox"
                    checked={locationEnabled}
                    onChange={(event) => setLocationEnabled(event.target.checked)}
                    className="h-4 w-4 accent-cyan-300"
                  />
                </label>

                <div className="rounded-[1.5rem] border border-white/10 bg-black/20 p-4">
                  <p className="text-sm font-medium text-white/85">Certificado de autenticidad</p>
                  {certificate ? (
                    <div className="mt-4 space-y-3 text-sm text-white/72">
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                          <p className="text-xs uppercase tracking-[0.24em] text-white/40">ID</p>
                          <p className="mt-2 font-medium text-white">{certificate.id}</p>
                        </div>
                        <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                          <p className="text-xs uppercase tracking-[0.24em] text-white/40">Dispositivo</p>
                          <p className="mt-2 font-medium text-white">{certificate.deviceId}</p>
                        </div>
                      </div>
                      <div className="rounded-2xl border border-cyan-400/20 bg-cyan-400/5 p-3 font-mono text-xs leading-6 text-cyan-50/85">
                        sha256: {shortenHash(certificate.sha256)}
                        <br />
                        signature: {shortenHash(certificate.signature)}
                        <br />
                        capturedAt: {certificate.capturedAt}
                        <br />
                        location: {certificate.location ?? "No incluida"}
                      </div>
                    </div>
                  ) : (
                    <p className="mt-3 text-sm leading-7 text-white/55">
                      Todavía no hay una captura registrada. Al generar una, acá aparece la evidencia
                      que después puede compararse en verificación.
                    </p>
                  )}
                </div>
              </div>
            </div>
          </article>

          <article id="analisis" className="rounded-[2rem] border border-white/10 bg-[#0f0b1a]/85 p-6 shadow-2xl shadow-black/20">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-fuchsia-200/60">Pantalla 2</p>
                <h2 className="mt-2 text-2xl font-semibold tracking-tight">Verificación y análisis</h2>
              </div>
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/60">
                Upload + scoring
              </span>
            </div>

            <div className="mt-6 space-y-5">
              <div className="rounded-[1.6rem] border border-white/10 bg-white/5 p-4">
                <p className="text-sm font-medium text-white/85">Subir imagen</p>
                <p className="mt-2 text-sm leading-7 text-white/58">
                  Para la demo, el resultado cambia según el nombre del archivo: usa algo como
                  <span className="mx-1 rounded bg-white/8 px-2 py-1 font-mono text-xs">foto-proof.jpg</span>,
                  <span className="mx-1 rounded bg-white/8 px-2 py-1 font-mono text-xs">retrato-ai.png</span>
                  o
                  <span className="mx-1 rounded bg-white/8 px-2 py-1 font-mono text-xs">producto-editado.jpg</span>.
                </p>

                <div className="mt-4 flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="rounded-full bg-white px-5 py-3 text-sm font-semibold text-black transition hover:bg-white/90"
                  >
                    Elegir archivo
                  </button>
                  <div className="rounded-full border border-white/10 px-4 py-3 text-sm text-white/65">
                    Archivo actual: {uploadedName}
                  </div>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(event) => handleFileSelection(event.target.files?.[0])}
                />
              </div>

              <div className="grid gap-3 sm:grid-cols-4">
                {([
                  ["verified", "Verificada"],
                  ["unverified", "Sin prueba"],
                  ["edited", "Posible edición"],
                  ["ai", "Posible IA"],
                ] as const).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setAnalysisMode(value)}
                    className={`rounded-2xl border px-4 py-3 text-sm transition ${
                      analysisMode === value
                        ? "border-cyan-300/45 bg-cyan-400/10 text-white"
                        : "border-white/10 bg-white/5 text-white/65 hover:bg-white/8 hover:text-white"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              <div className="grid gap-5 xl:grid-cols-[0.95fr_1.05fr]">
                <div className="rounded-[1.6rem] border border-white/10 bg-black/20 p-4">
                  <p className="text-sm font-medium text-white/85">Resultado</p>
                  <div className={`mt-4 rounded-[1.4rem] border p-4 ${resultConfig.tone}`}>
                    <p className="text-sm font-semibold">{resultConfig.badge}</p>
                    <h3 className="mt-2 text-2xl font-semibold tracking-tight text-white">
                      {resultConfig.label}
                    </h3>
                    <p className="mt-3 text-sm leading-7 text-white/80">{resultConfig.summary}</p>
                  </div>

                  <div className="mt-4 rounded-[1.4rem] border border-white/10 bg-white/5 p-4 text-sm text-white/70">
                    <p className="font-medium text-white/85">Huella analizada</p>
                    <p className="mt-3 font-mono text-xs leading-6 text-white/62">
                      file: {uploadedName}
                      <br />
                      derivedHash: {analysisHash ? shortenHash(analysisHash) : "pendiente"}
                      <br />
                      captureRegistry: {analysisMode === "verified" ? "match" : "no-match / unavailable"}
                    </p>
                  </div>
                </div>

                <div className="rounded-[1.6rem] border border-white/10 bg-white/5 p-4">
                  <p className="text-sm font-medium text-white/85">Señales detectadas</p>
                  <div className="mt-4 grid gap-3">
                    {signals.map((signal) => (
                      <div
                        key={signal.label}
                        className="flex items-center justify-between rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm"
                      >
                        <span className="text-white/65">{signal.label}</span>
                        <span className={`font-medium ${signal.tone}`}>{signal.value}</span>
                      </div>
                    ))}
                  </div>

                  <div className="mt-4 rounded-[1.4rem] border border-dashed border-white/10 bg-black/20 p-4 text-sm leading-7 text-white/58">
                    {analysisBusy
                      ? "Analizando imagen..."
                      : "En la versión real, acá entrarían chequeos de metadatos EXIF, consistencia visual, artefactos de compresión, score de edición y señales compatibles con generación sintética."}
                  </div>
                </div>
              </div>
            </div>
          </article>
        </section>

        <section id="arquitectura" className="mt-10 grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
          <article className="rounded-[2rem] border border-white/10 bg-white/5 p-6">
            <p className="text-xs uppercase tracking-[0.3em] text-white/45">Arquitectura MVP</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight">Cómo lo construiría de verdad</h2>
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <div className="rounded-[1.5rem] border border-white/10 bg-black/20 p-4">
                <h3 className="font-medium text-white">Frontend</h3>
                <p className="mt-2 text-sm leading-7 text-white/65">
                  Next.js + Tailwind. Cámara web/mobile, upload, dashboard de verificación y UX
                  responsive para demo rápida.
                </p>
              </div>
              <div className="rounded-[1.5rem] border border-white/10 bg-black/20 p-4">
                <h3 className="font-medium text-white">API</h3>
                <p className="mt-2 text-sm leading-7 text-white/65">
                  API routes o backend serverless para registrar capturas, emitir certificados y
                  resolver verificaciones por hash o ID.
                </p>
              </div>
              <div className="rounded-[1.5rem] border border-white/10 bg-black/20 p-4">
                <h3 className="font-medium text-white">Persistencia</h3>
                <p className="mt-2 text-sm leading-7 text-white/65">
                  Postgres/Supabase para certificados, eventos de custodia, dispositivos y estados
                  de verificación.
                </p>
              </div>
              <div className="rounded-[1.5rem] border border-white/10 bg-black/20 p-4">
                <h3 className="font-medium text-white">Storage</h3>
                <p className="mt-2 text-sm leading-7 text-white/65">
                  Supabase Storage o S3 para imágenes y manifiestos, separados del registro
                  criptográfico para trazabilidad.
                </p>
              </div>
            </div>
          </article>

          <article className="rounded-[2rem] border border-white/10 bg-[#101522]/90 p-6">
            <p className="text-xs uppercase tracking-[0.3em] text-white/45">Fases</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight">Plan corto de construcción</h2>
            <div className="mt-5 space-y-3 text-sm">
              {[
                "Fase 1: captura, hash, firma demo y certificado visual.",
                "Fase 2: registro real en base de datos + verificación por hash.",
                "Fase 3: análisis técnico de metadatos y reglas heurísticas.",
                "Fase 4: cuentas, cadena de custodia y exportación PDF del certificado.",
              ].map((item, index) => (
                <div key={item} className="flex gap-4 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white/72">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white text-xs font-semibold text-black">
                    {index + 1}
                  </span>
                  <span className="leading-7">{item}</span>
                </div>
              ))}
            </div>
          </article>
        </section>
      </section>
    </main>
  );
}
