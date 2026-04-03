"use client";

import { useEffect, useMemo, useRef, useState } from "react";

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
  note?: string;
  preview?: string;
  filename?: string;
};

const STORAGE_KEY = "verifoto-captures-v1";

const statusMap: Record<
  VerificationStatus,
  { label: string; tone: string; badge: string; summary: string }
> = {
  verified: {
    label: "Verificada",
    tone: "border-emerald-400/30 bg-emerald-500/10 text-emerald-200",
    badge: "✅ Evidencia de origen encontrada",
    summary:
      "La imagen coincide con una captura registrada dentro de VeriFoto. Eso demuestra que esta copia conserva la misma huella que la evidencia guardada.",
  },
  unverified: {
    label: "Sin prueba de origen",
    tone: "border-amber-400/30 bg-amber-500/10 text-amber-100",
    badge: "⚠️ No verificable",
    summary:
      "No encontramos un registro previo de esta imagen en VeriFoto. Eso no demuestra que sea IA o falsa; solo significa que no hay prueba de origen en este sistema.",
  },
  edited: {
    label: "Posible edición",
    tone: "border-orange-400/30 bg-orange-500/10 text-orange-100",
    badge: "✏️ Posible alteración",
    summary:
      "La huella no coincide con una captura registrada y el archivo presenta señales compatibles con edición o exportación posterior.",
  },
  ai: {
    label: "Posible IA",
    tone: "border-fuchsia-400/30 bg-fuchsia-500/10 text-fuchsia-100",
    badge: "🧠 Señales compatibles con IA",
    summary:
      "No hay prueba de origen y además aparecen pistas débiles compatibles con contenido generado o fuertemente sintetizado. No es una certeza; es una alerta de riesgo.",
  },
};

const shortenHash = (hash: string) => `${hash.slice(0, 12)}…${hash.slice(-8)}`;

const getDeviceId = () => {
  if (typeof window === "undefined") return "web-device";

  const existing = localStorage.getItem("verifoto-device-id");
  if (existing) return existing;

  const generated = `vf-device-${crypto.randomUUID()}`;
  localStorage.setItem("verifoto-device-id", generated);
  return generated;
};

const arrayBufferToHex = (buffer: ArrayBuffer) =>
  Array.from(new Uint8Array(buffer))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");

const hashFile = async (file: Blob) => {
  const buffer = await file.arrayBuffer();
  const digest = await crypto.subtle.digest("SHA-256", buffer);
  return arrayBufferToHex(digest);
};

const hashString = async (value: string) => {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return arrayBufferToHex(digest);
};

const loadCertificates = (): CaptureCertificate[] => {
  if (typeof window === "undefined") return [];

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as CaptureCertificate[];
  } catch {
    return [];
  }
};

const persistCertificates = (items: CaptureCertificate[]) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
};

const generateSignals = (
  status: VerificationStatus,
  matchedCertificate: CaptureCertificate | null,
  hashMatched: boolean,
): AnalysisSignal[] => {
  switch (status) {
    case "verified":
      return [
        { label: "Registro en VeriFoto", value: "Encontrado", tone: "text-emerald-300" },
        { label: "Hash SHA-256", value: hashMatched ? "Coincide" : "No coincide", tone: "text-emerald-300" },
        { label: "Certificado", value: matchedCertificate?.id ?? "Disponible", tone: "text-white/80" },
        { label: "Riesgo", value: "Bajo", tone: "text-emerald-200" },
      ];
    case "edited":
      return [
        { label: "Registro en VeriFoto", value: "Existe versión original", tone: "text-orange-300" },
        { label: "Hash SHA-256", value: "No coincide", tone: "text-orange-300" },
        { label: "Integridad", value: "Rota o exportada distinto", tone: "text-white/80" },
        { label: "Riesgo", value: "Medio", tone: "text-orange-200" },
      ];
    case "ai":
      return [
        { label: "Registro en VeriFoto", value: "No encontrado", tone: "text-fuchsia-300" },
        { label: "Metadatos", value: "Sin evidencia de captura", tone: "text-fuchsia-300" },
        { label: "Patrón de nombre", value: "Compatible con IA", tone: "text-white/80" },
        { label: "Riesgo", value: "Alto", tone: "text-fuchsia-200" },
      ];
    default:
      return [
        { label: "Registro en VeriFoto", value: "No encontrado", tone: "text-amber-300" },
        { label: "Hash SHA-256", value: "Sin coincidencia", tone: "text-amber-300" },
        { label: "Interpretación", value: "Sin prueba de origen", tone: "text-white/80" },
        { label: "Riesgo", value: "Indeterminado", tone: "text-amber-200" },
      ];
  }
};

const features = [
  {
    title: "Captura real desde navegador",
    description:
      "Usa la cámara del dispositivo cuando el navegador lo permite. Si no, también acepta tomar o elegir una imagen local.",
  },
  {
    title: "Huella SHA-256 real",
    description:
      "La app calcula la huella del archivo capturado o subido y la compara contra registros guardados en el dispositivo.",
  },
  {
    title: "Verificación honesta",
    description:
      "Si una foto no fue registrada antes, el resultado correcto es ‘sin prueba de origen’, no una acusación automática de IA.",
  },
  {
    title: "Base lista para crecer",
    description:
      "Hoy guarda evidencia local para el MVP. El siguiente paso natural es llevar certificados y storage a Supabase.",
  },
];

export default function Home() {
  const [captureNote, setCaptureNote] = useState("");
  const [locationEnabled, setLocationEnabled] = useState(true);
  const [certificate, setCertificate] = useState<CaptureCertificate | null>(null);
  const [captureBusy, setCaptureBusy] = useState(false);
  const [capturePreview, setCapturePreview] = useState<string | null>(null);
  const [captureFile, setCaptureFile] = useState<File | null>(null);
  const [savedCertificates, setSavedCertificates] = useState<CaptureCertificate[]>([]);

  const [uploadedName, setUploadedName] = useState("Ninguna imagen seleccionada");
  const [analysisMode, setAnalysisMode] = useState<VerificationStatus>("unverified");
  const [analysisBusy, setAnalysisBusy] = useState(false);
  const [analysisHash, setAnalysisHash] = useState<string | null>(null);
  const [analysisPreview, setAnalysisPreview] = useState<string | null>(null);
  const [matchedCertificate, setMatchedCertificate] = useState<CaptureCertificate | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const captureInputRef = useRef<HTMLInputElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    setSavedCertificates(loadCertificates());

    return () => {
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  const resultConfig = useMemo(() => statusMap[analysisMode], [analysisMode]);
  const signals = useMemo(
    () => generateSignals(analysisMode, matchedCertificate, Boolean(matchedCertificate && analysisHash && matchedCertificate.sha256 === analysisHash)),
    [analysisMode, matchedCertificate, analysisHash],
  );

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" } },
        audio: false,
      });
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
    } catch {
      alert("No pude abrir la cámara en este navegador. Puedes usar 'Elegir imagen' para seguir igual.");
    }
  };

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  };

  const captureFromCamera = async () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || !video.videoWidth || !video.videoHeight) {
      alert("Primero abre la cámara y espera a que cargue la imagen.");
      return;
    }

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.drawImage(video, 0, 0, video.videoWidth, video.videoHeight);

    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.92));
    if (!blob) return;

    const file = new File([blob], `verifoto-capture-${Date.now()}.jpg`, { type: "image/jpeg" });
    setCaptureFile(file);
    setCapturePreview(URL.createObjectURL(file));
  };

  const handleCaptureSelection = async (file?: File) => {
    if (!file) return;
    setCaptureFile(file);
    setCapturePreview(URL.createObjectURL(file));
  };

  const handleRegisterCapture = async () => {
    if (!captureFile) {
      alert("Primero toma una foto o elige una imagen para registrar.");
      return;
    }

    setCaptureBusy(true);
    const capturedAt = new Date().toISOString();
    const sha256 = await hashFile(captureFile);
    const deviceId = getDeviceId();
    const signature = await hashString(`${sha256}:${deviceId}:${capturedAt}`);

    let location: string | undefined;
    if (locationEnabled && "geolocation" in navigator) {
      location = await new Promise<string | undefined>((resolve) => {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            resolve(`${position.coords.latitude.toFixed(5)}, ${position.coords.longitude.toFixed(5)}`);
          },
          () => resolve(undefined),
          { enableHighAccuracy: false, timeout: 5000, maximumAge: 60000 },
        );
      });
    }

    const item: CaptureCertificate = {
      id: `VF-${Date.now().toString().slice(-6)}`,
      capturedAt,
      deviceId,
      sha256,
      signature,
      location,
      note: captureNote || undefined,
      preview: capturePreview ?? undefined,
      filename: captureFile.name,
    };

    const updated = [item, ...loadCertificates()].slice(0, 20);
    persistCertificates(updated);
    setSavedCertificates(updated);
    setCertificate(item);
    setCaptureBusy(false);
  };

  const handleFileSelection = async (file?: File) => {
    if (!file) return;

    setAnalysisBusy(true);
    setUploadedName(file.name);
    setAnalysisPreview(URL.createObjectURL(file));
    const digest = await hashFile(file);
    setAnalysisHash(digest);

    const certificates = loadCertificates();
    const exactMatch = certificates.find((item) => item.sha256 === digest) ?? null;
    const similarBaseName = certificates.find((item) => {
      if (!item.filename) return false;
      const left = item.filename.split(".")[0].toLowerCase();
      const right = file.name.split(".")[0].toLowerCase();
      return left === right;
    }) ?? null;

    setMatchedCertificate(exactMatch ?? similarBaseName);

    const lowered = file.name.toLowerCase();
    if (exactMatch) {
      setAnalysisMode("verified");
    } else if (similarBaseName) {
      setAnalysisMode("edited");
    } else if (lowered.includes("ai") || lowered.includes("ia") || lowered.includes("midjourney") || lowered.includes("generated")) {
      setAnalysisMode("ai");
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
              <p className="text-xs uppercase tracking-[0.38em] text-cyan-200/70">VeriFoto MVP realista</p>
              <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-5xl">
                Captura evidencia real. Verifica contra registros reales.
              </h1>
              <p className="mt-5 max-w-3xl text-base leading-8 text-white/70 sm:text-lg">
                Esta versión ya no inventa estados por nombre de archivo. Si registras una foto en
                VeriFoto, luego puedes verificar la misma imagen por su hash SHA-256. Si subes una
                foto externa, la respuesta correcta será “sin prueba de origen”, no una acusación absurda.
              </p>
            </div>

            <div className="rounded-3xl border border-cyan-400/20 bg-cyan-400/10 px-5 py-4 text-sm text-cyan-100 shadow-lg shadow-cyan-950/20">
              <p className="font-medium">Qué ya hace esta versión</p>
              <p className="mt-2 max-w-xs leading-6 text-cyan-50/80">
                Captura desde cámara o archivo, calcula hash real, guarda certificados locales y compara
                evidencia al verificar.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-3 text-sm">
            <a href="#captura" className="rounded-full bg-white px-5 py-3 font-medium text-black transition hover:bg-white/90">
              Registrar evidencia
            </a>
            <a href="#analisis" className="rounded-full border border-white/15 px-5 py-3 font-medium text-white/85 transition hover:border-white/35 hover:text-white">
              Verificar imagen
            </a>
            <a href="#registros" className="rounded-full border border-white/10 bg-white/5 px-5 py-3 font-medium text-white/70 transition hover:bg-white/10 hover:text-white">
              Ver registros guardados
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
                <p className="text-xs uppercase tracking-[0.3em] text-cyan-200/65">Paso 1</p>
                <h2 className="mt-2 text-2xl font-semibold tracking-tight">Registrar captura</h2>
              </div>
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/60">
                Cámara real + hash real
              </span>
            </div>

            <div className="mt-6 grid gap-5 xl:grid-cols-[0.95fr_1.05fr]">
              <div className="rounded-[1.6rem] border border-dashed border-cyan-300/25 bg-gradient-to-br from-cyan-400/10 to-transparent p-4">
                <div className="rounded-[1.25rem] border border-white/10 bg-black/20 p-4">
                  <div className="flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={startCamera}
                      className="rounded-full bg-white px-4 py-3 text-sm font-semibold text-black transition hover:bg-white/90"
                    >
                      Abrir cámara
                    </button>
                    <button
                      type="button"
                      onClick={captureFromCamera}
                      className="rounded-full border border-white/15 px-4 py-3 text-sm font-semibold text-white transition hover:border-white/35"
                    >
                      Tomar foto
                    </button>
                    <button
                      type="button"
                      onClick={() => captureInputRef.current?.click()}
                      className="rounded-full border border-white/15 px-4 py-3 text-sm font-semibold text-white transition hover:border-white/35"
                    >
                      Elegir imagen
                    </button>
                  </div>

                  <div className="mt-4 overflow-hidden rounded-[1.2rem] border border-white/10 bg-[#09111a]">
                    <video ref={videoRef} autoPlay playsInline muted className="aspect-[3/4] w-full object-cover" />
                  </div>

                  <input
                    ref={captureInputRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="hidden"
                    onChange={(event) => handleCaptureSelection(event.target.files?.[0])}
                  />
                  <canvas ref={canvasRef} className="hidden" />

                  <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/65">
                    Si tu navegador o celular no deja abrir la cámara, puedes usar “Elegir imagen” o el selector nativo del dispositivo.
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-white/80">Nota de captura</span>
                  <input
                    value={captureNote}
                    onChange={(event) => setCaptureNote(event.target.value)}
                    placeholder="Ej: mi gatita, documento, producto, evidencia..."
                    className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none placeholder:text-white/35 focus:border-cyan-300/40"
                  />
                </label>

                <label className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/80">
                  <span>Intentar incluir ubicación</span>
                  <input
                    type="checkbox"
                    checked={locationEnabled}
                    onChange={(event) => setLocationEnabled(event.target.checked)}
                    className="h-4 w-4 accent-cyan-300"
                  />
                </label>

                {capturePreview ? (
                  <div className="overflow-hidden rounded-[1.5rem] border border-white/10 bg-black/20">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={capturePreview} alt="Vista previa de captura" className="aspect-[4/3] w-full object-cover" />
                  </div>
                ) : (
                  <div className="rounded-[1.5rem] border border-dashed border-white/10 bg-black/20 p-6 text-sm leading-7 text-white/55">
                    Aún no hay captura preparada. Abre la cámara y toma una foto, o elige una imagen para registrarla.
                  </div>
                )}

                <div className="flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={handleRegisterCapture}
                    disabled={captureBusy || !captureFile}
                    className="rounded-full bg-cyan-300 px-5 py-3 text-sm font-semibold text-black transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {captureBusy ? "Registrando evidencia..." : "Guardar certificado"}
                  </button>
                  <button
                    type="button"
                    onClick={stopCamera}
                    className="rounded-full border border-white/15 px-5 py-3 text-sm font-semibold text-white transition hover:border-white/35"
                  >
                    Cerrar cámara
                  </button>
                </div>
              </div>
            </div>

            <div className="mt-6 rounded-[1.5rem] border border-white/10 bg-black/20 p-4">
              <p className="text-sm font-medium text-white/85">Certificado generado</p>
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
                    <br />
                    note: {certificate.note ?? "Sin nota"}
                  </div>
                </div>
              ) : (
                <p className="mt-3 text-sm leading-7 text-white/55">
                  Cuando guardes una captura, aquí aparece el certificado real generado en tu navegador.
                </p>
              )}
            </div>
          </article>

          <article id="analisis" className="rounded-[2rem] border border-white/10 bg-[#0f0b1a]/85 p-6 shadow-2xl shadow-black/20">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-fuchsia-200/60">Paso 2</p>
                <h2 className="mt-2 text-2xl font-semibold tracking-tight">Verificar imagen</h2>
              </div>
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/60">
                Comparación por hash
              </span>
            </div>

            <div className="mt-6 space-y-5">
              <div className="rounded-[1.6rem] border border-white/10 bg-white/5 p-4">
                <p className="text-sm font-medium text-white/85">Subir imagen para verificar</p>
                <p className="mt-2 text-sm leading-7 text-white/58">
                  Si antes registraste esa foto dentro de VeriFoto y luego subes exactamente el mismo archivo, debería salir verificada. Si subes una foto real externa, lo correcto será “sin prueba de origen”.
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

              <div className="grid gap-5 xl:grid-cols-[0.95fr_1.05fr]">
                <div className="space-y-4">
                  {analysisPreview ? (
                    <div className="overflow-hidden rounded-[1.6rem] border border-white/10 bg-black/20">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={analysisPreview} alt="Vista previa de análisis" className="aspect-[4/3] w-full object-cover" />
                    </div>
                  ) : (
                    <div className="rounded-[1.6rem] border border-dashed border-white/10 bg-black/20 p-6 text-sm leading-7 text-white/55">
                      Sube una imagen para calcular su huella y compararla contra los certificados locales guardados en este dispositivo.
                    </div>
                  )}

                  <div className={`rounded-[1.4rem] border p-4 ${resultConfig.tone}`}>
                    <p className="text-sm font-semibold">{resultConfig.badge}</p>
                    <h3 className="mt-2 text-2xl font-semibold tracking-tight text-white">{resultConfig.label}</h3>
                    <p className="mt-3 text-sm leading-7 text-white/80">{resultConfig.summary}</p>
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

                  <div className="mt-4 rounded-[1.4rem] border border-white/10 bg-black/20 p-4 text-sm text-white/70">
                    <p className="font-medium text-white/85">Huella analizada</p>
                    <p className="mt-3 font-mono text-xs leading-6 text-white/62">
                      file: {uploadedName}
                      <br />
                      derivedHash: {analysisHash ? shortenHash(analysisHash) : "pendiente"}
                      <br />
                      certificate: {matchedCertificate?.id ?? "ninguno"}
                    </p>
                  </div>

                  <div className="mt-4 rounded-[1.4rem] border border-dashed border-white/10 bg-black/20 p-4 text-sm leading-7 text-white/58">
                    {analysisBusy
                      ? "Calculando hash y comparando registros..."
                      : "Esta versión no hace forensia avanzada todavía. Su punto fuerte ahora es la verificación honesta por coincidencia real de hash contra capturas registradas en el navegador."}
                  </div>
                </div>
              </div>
            </div>
          </article>
        </section>

        <section id="registros" className="mt-10 grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
          <article className="rounded-[2rem] border border-white/10 bg-white/5 p-6">
            <p className="text-xs uppercase tracking-[0.3em] text-white/45">Registros locales</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight">Capturas guardadas en este dispositivo</h2>
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              {savedCertificates.length > 0 ? (
                savedCertificates.map((item) => (
                  <div key={item.id} className="rounded-[1.5rem] border border-white/10 bg-black/20 p-4">
                    <h3 className="font-medium text-white">{item.id}</h3>
                    <p className="mt-2 text-sm leading-7 text-white/65">
                      {item.note ?? "Sin nota"}
                      <br />
                      {item.filename ?? "Sin archivo"}
                    </p>
                    <p className="mt-3 font-mono text-xs leading-6 text-white/55">
                      {shortenHash(item.sha256)}
                      <br />
                      {item.capturedAt}
                    </p>
                  </div>
                ))
              ) : (
                <div className="rounded-[1.5rem] border border-dashed border-white/10 bg-black/20 p-5 text-sm leading-7 text-white/55 md:col-span-2">
                  Aún no hay capturas registradas. Primero guarda una evidencia y luego vuelve aquí para verla listada.
                </div>
              )}
            </div>
          </article>

          <article className="rounded-[2rem] border border-white/10 bg-[#101522]/90 p-6">
            <p className="text-xs uppercase tracking-[0.3em] text-white/45">Siguiente fase</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight">Qué falta para volverlo realmente serio</h2>
            <div className="mt-5 space-y-3 text-sm">
              {[
                "Backend con Supabase para que los certificados no queden solo en localStorage.",
                "Cuentas de usuario y dispositivo para cadena de custodia real.",
                "Carga segura de imágenes y consulta por hash desde cualquier dispositivo.",
                "Análisis técnico de metadatos, EXIF y heurísticas visuales más prudentes.",
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
