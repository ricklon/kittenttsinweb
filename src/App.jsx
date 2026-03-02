import { useEffect, useMemo, useRef, useState } from "react";

const FALLBACK_VOICES = ["Bella", "Jasper", "Luna", "Bruno", "Rosie", "Hugo", "Kiki", "Leo"];
const BASE_URL = import.meta.env.BASE_URL || "/";
const DEFAULT_MODEL_DIR = `${BASE_URL}models/kitten-tts-nano-0.8-int8`;
const RATINGS_KEY = "kittentts_mos_ratings_v1";
const VOICE_TECH_TO_NICK = {
  "expr-voice-2-f": "Bella",
  "expr-voice-2-m": "Jasper",
  "expr-voice-3-f": "Luna",
  "expr-voice-3-m": "Bruno",
  "expr-voice-4-f": "Rosie",
  "expr-voice-4-m": "Hugo",
  "expr-voice-5-f": "Kiki",
  "expr-voice-5-m": "Leo"
};
const PREFERRED_VOICE_ORDER = [
  "expr-voice-2-f",
  "expr-voice-2-m",
  "expr-voice-3-f",
  "expr-voice-3-m",
  "expr-voice-4-f",
  "expr-voice-4-m",
  "expr-voice-5-f",
  "expr-voice-5-m"
];

const PRESETS = [
  {
    label: "Numbers",
    text: "In 2026, the price moved from $12.50 to $19.99 in just 3 weeks."
  },
  {
    label: "Acronyms",
    text: "NASA, GPU, API, and SQL are all common engineering acronyms."
  },
  {
    label: "Tongue Twister",
    text: "She sells sea shells by the sea shore, and the shells she sells are surely sea shells."
  },
  {
    label: "Punctuation",
    text: "Wait... what?! Really; yes: absolutely, 100 percent."
  },
  {
    label: "Names",
    text: "Dr. Amelia Rivera met Mr. Chen and Ms. O'Connor at 8:30 p.m."
  }
];

function randomChoice(items) {
  return items[Math.floor(Math.random() * items.length)];
}

function buildStressPhrase() {
  const intros = [
    "Quick stress test",
    "Browser synthesis check",
    "Latency and quality sample",
    "Pronunciation benchmark"
  ];
  const dates = ["March 2nd, 2026", "01/31/2027", "2028-11-05"];
  const currency = ["$19.95", "$1,250.00", "$0.07"];
  const ids = ["GPU-4090", "API-v2", "SKU-A12B9"];
  const endings = [
    "Please confirm clarity and pacing.",
    "Evaluate intelligibility across voices.",
    "Report tail noise if any artifacts remain."
  ];
  return `${randomChoice(intros)}: On ${randomChoice(dates)}, ${randomChoice(ids)} changed from ${randomChoice(
    currency
  )} to ${randomChoice(currency)}; ${randomChoice(endings)}`;
}

const DEFAULT_DIALOGUE_SCRIPT = `# Dada dialogue sample (TTS script format)
# Format: [SPEAKER=Name] line text

[SPEAKER=EYE] The teacup has resigned.
[SPEAKER=MOUTH] Then appoint the umbrella.
[SPEAKER=EAR] It only speaks in buttons.
[SPEAKER=NOSE] Buttons are reliable philosophers.
[SPEAKER=EYE] Who moved the staircase into the soup?
[SPEAKER=MOUTH] The violin, at dawn.
[SPEAKER=EAR] I object in lowercase.
[SPEAKER=NOSE] Objections must wear feathers.
[SPEAKER=EYE] Then let the window apologize.
[SPEAKER=MOUTH] Too late — the window has become Thursday.

[SPEAKER=EYEBROW] I have swallowed a map.
[SPEAKER=MOUTH] Which country was delicious?
[SPEAKER=EYE] The one with three moons and no chairs.
[SPEAKER=EAR] Chairs are only frozen arguments.
[SPEAKER=NOSE] I prefer a ladder with opinions.
[SPEAKER=EYEBROW] Then climb the orchestra.
[SPEAKER=MOUTH] I already mailed it to a fish.
[SPEAKER=EYE] Did the fish reply?
[SPEAKER=EAR] Yes, in excellent dust.
[SPEAKER=NOSE] Then we are formally introduced.

[SPEAKER=MOUTH] Good evening, ceiling.
[SPEAKER=CEILING] I refuse to remain overhead.
[SPEAKER=EYE] Sensible. The floor is overworked.
[SPEAKER=EAR] Hush — the wallpaper is rehearsing.
[SPEAKER=NOSE] For what performance?
[SPEAKER=MOUTH] A duel between two teaspoons.
[SPEAKER=CEILING] Who is judging?
[SPEAKER=EYE] A lamp with aristocratic knees.
[SPEAKER=EAR] Then the verdict will be circular.
[SPEAKER=NOSE] As all honest furniture is.

[SPEAKER=EYE] My hat has learned arithmetic.
[SPEAKER=MOUTH] Hide it before it teaches the bread.
[SPEAKER=EAR] Too late — the bread now counts backwards.
[SPEAKER=NOSE] Backwards is the shortest route to Paris.
[SPEAKER=EYE] Only if the moon signs the receipt.
[SPEAKER=MOUTH] I left the receipt in a trumpet.
[SPEAKER=EAR] Then the trumpet owns the moon.
[SPEAKER=NOSE] Ownership is a temporary sneeze.
[SPEAKER=EYE] Bless you, then.
[SPEAKER=MOUTH] And also the chandelier.`;

function loadRatings() {
  try {
    const raw = localStorage.getItem(RATINGS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveRatings(list) {
  localStorage.setItem(RATINGS_KEY, JSON.stringify(list));
}

function voiceLabel(voice) {
  const nick = VOICE_TECH_TO_NICK[voice];
  if (nick) return `${nick} (${voice})`;
  return voice;
}

function sortVoicesStable(list) {
  const rank = new Map(PREFERRED_VOICE_ORDER.map((v, i) => [v, i]));
  return [...list].sort((a, b) => {
    const ra = rank.has(a) ? rank.get(a) : Number.MAX_SAFE_INTEGER;
    const rb = rank.has(b) ? rank.get(b) : Number.MAX_SAFE_INTEGER;
    if (ra !== rb) return ra - rb;
    return voiceLabel(a).localeCompare(voiceLabel(b));
  });
}

function parseDialogueScript(script, voiceA, voiceB) {
  const lines = String(script || "").split("\n");
  const speakerOrder = new Map();
  const turns = [];

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;
    if (line.startsWith("#")) continue;
    if (/^\d+\.$/.test(line)) continue;

    let speaker = "";
    let text = "";

    // Preferred format: [SPEAKER=Name] text
    const bracketMatch = line.match(/^\[(.*?)\]\s*(.+)$/);
    if (bracketMatch) {
      const attrs = bracketMatch[1].split("|").map((x) => x.trim());
      text = bracketMatch[2].trim();
      for (const attr of attrs) {
        const kv = attr.match(/^([A-Z_]+)\s*=\s*(.+)$/i);
        if (!kv) continue;
        if (kv[1].toUpperCase() === "SPEAKER") {
          speaker = kv[2].trim();
        }
      }
    }

    // Backward compatibility: SPEAKER: text
    if (!speaker) {
      const legacyMatch = line.match(/^([A-Z][A-Z0-9_-]{0,40})\s*:\s*(.+)$/i);
      if (!legacyMatch) continue;
      speaker = legacyMatch[1].trim();
      text = legacyMatch[2].trim();
    }

    if (!text) continue;

    if (!speakerOrder.has(speaker)) speakerOrder.set(speaker, speakerOrder.size);
    const idx = speakerOrder.get(speaker);
    const mappedVoice = idx % 2 === 0 ? voiceA : voiceB;
    turns.push({ speaker, text, voice: mappedVoice });
  }

  return turns;
}

export default function App() {
  const workerRef = useRef(null);
  const pendingRef = useRef(new Map());
  const audioUrlRef = useRef("");
  const shootoutUrlsRef = useRef([]);
  const dialogueUrlsRef = useRef([]);

  const [status, setStatus] = useState("idle");
  const [modelInitialized, setModelInitialized] = useState(false);
  const [text, setText] = useState("KittenTTS in browser with ONNX Runtime Web.");
  const [voice, setVoice] = useState("Bella");
  const [speed, setSpeed] = useState(1);
  const [voices, setVoices] = useState(FALLBACK_VOICES);
  const [audioUrl, setAudioUrl] = useState("");
  const [error, setError] = useState("");
  const [modelDir, setModelDir] = useState(DEFAULT_MODEL_DIR);
  const [configUrl, setConfigUrl] = useState(`${DEFAULT_MODEL_DIR}/browser-config.json`);
  const [lastStats, setLastStats] = useState("");
  const [runtimeInfo, setRuntimeInfo] = useState("");
  const [debugInfo, setDebugInfo] = useState("");
  const [conversionProgress, setConversionProgress] = useState("");
  const [trimTailSamples, setTrimTailSamples] = useState(5000);
  const [execMode, setExecMode] = useState("wasm");
  const [webgpuStatus, setWebgpuStatus] = useState("Not checked");

  const [shootoutLoading, setShootoutLoading] = useState(false);
  const [shootoutProgress, setShootoutProgress] = useState("");
  const [shootoutClips, setShootoutClips] = useState([]);
  const [dialogueLoading, setDialogueLoading] = useState(false);
  const [dialogueProgress, setDialogueProgress] = useState("");
  const [dialogueScript, setDialogueScript] = useState(DEFAULT_DIALOGUE_SCRIPT);
  const [dialogueVoiceA, setDialogueVoiceA] = useState("expr-voice-2-f");
  const [dialogueVoiceB, setDialogueVoiceB] = useState("expr-voice-2-m");
  const [dialogueClips, setDialogueClips] = useState([]);

  const [ratings, setRatings] = useState(() => loadRatings());

  const canGenerate = useMemo(
    () => status === "ready" && text.trim().length > 0 && !shootoutLoading && !dialogueLoading,
    [status, text, shootoutLoading, dialogueLoading]
  );

  const ratingSummary = useMemo(() => {
    if (!ratings.length) return "No ratings yet";
    const avg = ratings.reduce((a, b) => a + b.score, 0) / ratings.length;
    return `${ratings.length} ratings, avg ${avg.toFixed(2)}/5`;
  }, [ratings]);

  useEffect(() => {
    const worker = new Worker(new URL("./workers/tts.worker.js", import.meta.url), { type: "module" });
    workerRef.current = worker;

    worker.onmessage = (event) => {
      const { type, payload } = event.data || {};

      if (type === "ready") {
        setStatus("ready");
        setModelInitialized(true);
        setError("");
        setConversionProgress("");
        const inputs = Array.isArray(payload?.inputs) ? payload.inputs.join(", ") : "unknown";
        const outputs = Array.isArray(payload?.outputs) ? payload.outputs.join(", ") : "unknown";
        const provider = Array.isArray(payload?.providers) ? payload.providers.join(", ") : "unknown";
        setRuntimeInfo(`provider=${provider} | inputs=[${inputs}] | outputs=[${outputs}]`);
        if (Array.isArray(payload?.voices) && payload.voices.length) {
          const sortedVoices = sortVoicesStable(payload.voices);
          setVoices(sortedVoices);
          if (!sortedVoices.includes(voice)) setVoice(sortedVoices[0]);
          if (!sortedVoices.includes(dialogueVoiceA)) setDialogueVoiceA(sortedVoices[0]);
          if (!sortedVoices.includes(dialogueVoiceB)) setDialogueVoiceB(sortedVoices[1] || sortedVoices[0]);
        }
        return;
      }

      if (type === "debug") {
        setDebugInfo(JSON.stringify(payload || {}, null, 2));
        return;
      }

      if (type === "audio") {
        const requestId = payload?.requestId;
        if (requestId && pendingRef.current.has(requestId)) {
          const resolve = pendingRef.current.get(requestId);
          pendingRef.current.delete(requestId);
          resolve(payload);
          return;
        }
      }

      if (type === "progress") {
        const msg = payload?.message || payload?.stage || "Working";
        setConversionProgress(msg);
        return;
      }

      if (type === "error") {
        const requestId = payload?.requestId;
        if (requestId && pendingRef.current.has(requestId)) {
          const resolve = pendingRef.current.get(requestId);
          pendingRef.current.delete(requestId);
          resolve({ error: String(payload?.message || payload || "Unknown error") });
          setConversionProgress("");
          return;
        }
        setError(typeof payload === "string" ? payload : String(payload?.message || JSON.stringify(payload)));
        setConversionProgress("");
        setModelInitialized(false);
        setStatus("ready");
      }
    };

    const initialProviders = execMode === "webgpu" ? ["webgpu"] : execMode === "auto" ? ["webgpu", "wasm"] : ["wasm"];
    setStatus("loading");
    setModelInitialized(false);
    setConversionProgress("Loading model");
    worker.postMessage({
      type: "init",
      payload: {
        modelDir,
        configUrl,
        providers: initialProviders,
        configOverrides: {
          trimTailSamples,
          phonemizerMode: "espeak_js"
        }
      }
    });

    return () => {
      worker.terminate();
      pendingRef.current.clear();
      if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current);
      for (const url of shootoutUrlsRef.current) URL.revokeObjectURL(url);
      for (const url of dialogueUrlsRef.current) URL.revokeObjectURL(url);
    };
  }, []);

  async function checkWebgpuReadiness() {
    if (typeof window === "undefined") {
      setWebgpuStatus("WebGPU check unavailable in this environment.");
      return;
    }

    if (!window.isSecureContext) {
      setWebgpuStatus("WebGPU unavailable: secure context required (use localhost/https).");
      return;
    }

    if (!("gpu" in navigator)) {
      setWebgpuStatus(
        "WebGPU not exposed by browser. In Chrome, try chrome://flags -> Unsafe WebGPU (experimental), then restart."
      );
      return;
    }

    try {
      const adapter = await navigator.gpu.requestAdapter();
      if (!adapter) {
        setWebgpuStatus(
          "WebGPU API found but no GPU adapter available. Keep using WASM/Auto; WebGPU remains experimental."
        );
        return;
      }
      setWebgpuStatus("WebGPU adapter detected. Experimental mode is likely enabled and usable.");
    } catch (err) {
      setWebgpuStatus(`WebGPU check failed: ${String(err?.message || err)}`);
    }
  }

  function initModel() {
    if (!workerRef.current) return;
    setStatus("loading");
    setModelInitialized(false);
    setError("");
    setConversionProgress("Loading model");
    const providers = execMode === "webgpu" ? ["webgpu"] : execMode === "auto" ? ["webgpu", "wasm"] : ["wasm"];
    workerRef.current.postMessage({
      type: "init",
      payload: {
        modelDir,
        configUrl,
        providers,
        configOverrides: {
          trimTailSamples,
          phonemizerMode: "espeak_js"
        }
      }
    });
  }

  function requestGenerate({ textValue, voiceValue, speedValue, requestId }) {
    return new Promise((resolve) => {
      pendingRef.current.set(requestId, resolve);
      workerRef.current.postMessage({
        type: "generate",
        payload: {
          text: textValue,
          voice: voiceValue,
          speed: speedValue,
          requestId
        }
      });
    });
  }

  function rateClip({ clipId, score, clipType, clipVoice }) {
    const entry = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      clipId,
      clipType,
      clipVoice,
      score,
      speed,
      trimTailSamples,
      text: text.slice(0, 120),
      createdAt: new Date().toISOString()
    };
    const next = [entry, ...ratings].slice(0, 300);
    setRatings(next);
    saveRatings(next);
  }

  async function generateMain() {
    if (!workerRef.current || !canGenerate || !modelInitialized) {
      setError("Initialize Model first.");
      return;
    }
    setStatus("generating");
    setError("");
    const requestId = `main-${Date.now()}`;
    const result = await requestGenerate({ textValue: text, voiceValue: voice, speedValue: speed, requestId });
    if (result?.error) {
      setError(result.error);
      setConversionProgress("");
      setStatus("ready");
      return;
    }

    const blob = new Blob([result.wavBuffer], { type: "audio/wav" });
    const url = URL.createObjectURL(blob);
    if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current);
    audioUrlRef.current = url;
    setAudioUrl(url);
    setLastStats(`${result.samples} samples across ${result.chunks} chunk(s)`);
    setConversionProgress("");
    setStatus("ready");
  }

  async function runVoiceShootout() {
    if (!workerRef.current || !canGenerate || !modelInitialized) {
      setError("Initialize Model first.");
      return;
    }
    setShootoutLoading(true);
    setStatus("generating");
    setError("");

    for (const url of shootoutUrlsRef.current) URL.revokeObjectURL(url);
    shootoutUrlsRef.current = [];
    setShootoutClips([]);

    const clips = [];
    for (let i = 0; i < voices.length; i += 1) {
      const v = voices[i];
      setShootoutProgress(`Rendering ${i + 1}/${voices.length}: ${v}`);
      const requestId = `shootout-${i}-${Date.now()}`;
      const result = await requestGenerate({ textValue: text, voiceValue: v, speedValue: speed, requestId });
      if (result?.error) {
        setError(`Shootout failed on ${v}: ${result.error}`);
        setConversionProgress("");
        break;
      }
      const blob = new Blob([result.wavBuffer], { type: "audio/wav" });
      const url = URL.createObjectURL(blob);
      shootoutUrlsRef.current.push(url);
      clips.push({
        id: requestId,
        voice: v,
        url,
        samples: result.samples,
        chunks: result.chunks
      });
      setShootoutClips([...clips]);
    }

    setShootoutProgress("");
    setConversionProgress("");
    setShootoutLoading(false);
    setStatus("ready");
  }

  async function runDialogueScript() {
    if (!workerRef.current || !canGenerate || !modelInitialized) {
      setError("Initialize Model first.");
      return;
    }
    const turns = parseDialogueScript(dialogueScript, dialogueVoiceA, dialogueVoiceB);
    if (turns.length === 0) {
      setError("No valid dialogue lines found. Use format: SPEAKER: text");
      return;
    }

    setDialogueLoading(true);
    setStatus("generating");
    setError("");
    setDialogueProgress("");

    for (const url of dialogueUrlsRef.current) URL.revokeObjectURL(url);
    dialogueUrlsRef.current = [];
    setDialogueClips([]);

    const clips = [];
    for (let i = 0; i < turns.length; i += 1) {
      const turn = turns[i];
      setDialogueProgress(`Rendering dialogue ${i + 1}/${turns.length}: ${turn.speaker}`);
      const requestId = `dialogue-${i}-${Date.now()}`;
      const result = await requestGenerate({
        textValue: turn.text,
        voiceValue: turn.voice,
        speedValue: speed,
        requestId
      });
      if (result?.error) {
        setError(`Dialogue failed at line ${i + 1}: ${result.error}`);
        setConversionProgress("");
        break;
      }
      const blob = new Blob([result.wavBuffer], { type: "audio/wav" });
      const url = URL.createObjectURL(blob);
      dialogueUrlsRef.current.push(url);
      clips.push({
        id: requestId,
        speaker: turn.speaker,
        text: turn.text,
        voice: turn.voice,
        url,
        samples: result.samples
      });
      setDialogueClips([...clips]);
    }

    setDialogueProgress("");
    setConversionProgress("");
    setDialogueLoading(false);
    setStatus("ready");
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-5xl flex-col px-4 py-8">
      <div className="mb-6 rounded-2xl border border-cyan-300/30 bg-slate-900/70 p-5 backdrop-blur">
        <p className="text-xs uppercase tracking-[0.18em] text-cyan-300">In Browser TTS</p>
        <h1 className="mt-2 text-3xl font-bold text-white">KittenTTS 0.8 ONNX</h1>
        <p className="mt-2 text-sm text-slate-300">Steps: 1) Initialize Model 2) Choose or randomize test text 3) Generate</p>
        <p className="mt-1 text-slate-300">Status: {status}</p>
        {conversionProgress ? <p className="mt-1 text-xs text-cyan-200">Progress: {conversionProgress}</p> : null}
      </div>

      <section className="space-y-4 rounded-2xl border border-slate-700 bg-slate-900/70 p-5">
        <h2 className="text-lg font-semibold text-white">Model Setup</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <label className="block">
            <span className="mb-2 block text-sm text-slate-200">Model Directory</span>
            <input
              value={modelDir}
              onChange={(e) => setModelDir(e.target.value)}
              className="w-full rounded-xl border border-slate-600 bg-slate-950 p-3 text-slate-100"
            />
          </label>

          <label className="block">
            <span className="mb-2 block text-sm text-slate-200">Browser Config URL</span>
            <input
              value={configUrl}
              onChange={(e) => setConfigUrl(e.target.value)}
              className="w-full rounded-xl border border-slate-600 bg-slate-950 p-3 text-slate-100"
            />
          </label>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <label className="block">
            <span className="mb-2 block text-sm text-slate-200">Default Voice</span>
            <select
              value={voice}
              onChange={(e) => setVoice(e.target.value)}
              className="w-full rounded-xl border border-slate-600 bg-slate-950 p-3 text-slate-100"
            >
              {voices.map((v) => (
                <option key={v} value={v}>
                  {voiceLabel(v)}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="mb-2 block text-sm text-slate-200">Speed: {speed.toFixed(2)}x</span>
            <input
              type="range"
              min="0.5"
              max="2"
              step="0.05"
              value={speed}
              onChange={(e) => setSpeed(Number(e.target.value))}
              className="w-full accent-cyan-300"
            />
          </label>
        </div>

        <label className="block">
          <span className="mb-2 block text-sm text-slate-200">Execution Mode</span>
          <select
            value={execMode}
            onChange={(e) => setExecMode(e.target.value)}
            className="w-full rounded-xl border border-slate-600 bg-slate-950 p-3 text-slate-100"
          >
            <option value="wasm">WASM (Stable)</option>
            <option value="auto">Auto (WebGPU then WASM)</option>
            <option value="webgpu">WebGPU (Experimental)</option>
          </select>
          <p className="mt-2 text-xs text-slate-400">
            If WebGPU fails: switch to <code>Auto</code> or <code>WASM</code>. For Chrome WebGPU, open{" "}
            <code>chrome://flags</code>, enable <code>Unsafe WebGPU</code>, then restart Chrome.
          </p>
          <div className="mt-2 flex items-center gap-2">
            <button
              onClick={checkWebgpuReadiness}
              className="rounded-md border border-slate-500 px-2 py-1 text-xs text-slate-200 hover:border-cyan-300"
            >
              Check WebGPU
            </button>
            <span className="text-xs text-slate-300">{webgpuStatus}</span>
          </div>
        </label>

        <label className="block">
          <span className="mb-2 block text-sm text-slate-200">Tail Trim: {trimTailSamples} samples</span>
          <input
            type="range"
            min="0"
            max="12000"
            step="250"
            value={trimTailSamples}
            onChange={(e) => setTrimTailSamples(Number(e.target.value))}
            className="w-full accent-cyan-300"
          />
        </label>

        <button
          onClick={initModel}
          disabled={status === "loading" || status === "generating"}
          className="rounded-xl border border-cyan-400/60 px-4 py-2 text-sm hover:border-cyan-300 disabled:opacity-60"
        >
          {status === "loading" ? "Loading Model..." : "Initialize Model"}
        </button>
        <p className="text-xs text-slate-400">Re-initialize after changing voice/speed/trim/execution mode.</p>

        {error && <div className="rounded-xl border border-red-400/50 bg-red-900/20 p-3 text-sm text-red-200">{error}</div>}
      </section>

      <section className="mt-4 grid gap-4 lg:grid-cols-2">
        <div className="space-y-4 rounded-2xl border border-cyan-400/30 bg-slate-900/70 p-5">
          <h3 className="text-lg font-semibold text-white">Your Text Panel</h3>
          <p className="text-xs text-slate-400">Use this for single-voice testing with the current default voice.</p>

          <div className="flex flex-wrap gap-2">
            {PRESETS.map((preset) => (
              <button
                key={preset.label}
                onClick={() => setText(preset.text)}
                className="rounded-lg border border-slate-600 px-3 py-1 text-xs text-slate-200 hover:border-cyan-300"
              >
                {preset.label}
              </button>
            ))}
            <button
              onClick={() => setText(buildStressPhrase())}
              className="rounded-lg border border-amber-400/60 px-3 py-1 text-xs text-amber-200 hover:border-amber-300"
            >
              Random Stress Test
            </button>
          </div>

          <label className="block">
            <span className="mb-2 block text-sm text-slate-200">Text</span>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={8}
              className="w-full rounded-xl border border-slate-600 bg-slate-950 p-3 text-slate-100 outline-none focus:border-cyan-300"
            />
          </label>

          <button
            onClick={generateMain}
            disabled={!canGenerate || !modelInitialized || status === "generating"}
            className="rounded-xl bg-cyan-300 px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-cyan-200 disabled:opacity-60"
          >
            {status === "generating" && !shootoutLoading ? "Generating..." : "Generate Audio"}
          </button>

          {audioUrl && (
            <div className="rounded-xl border border-slate-700 bg-slate-950/70 p-3">
              <p className="mb-2 text-sm text-slate-200">Latest Clip ({voiceLabel(voice)})</p>
              <audio controls className="w-full" src={audioUrl} />
              <p className="mt-2 text-xs text-slate-400">{lastStats}</p>
              <div className="mt-3 flex items-center gap-2">
                <span className="text-xs text-slate-300">Rate MOS:</span>
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    onClick={() => rateClip({ clipId: "latest", score: n, clipType: "single", clipVoice: voice })}
                    className="rounded-md border border-slate-600 px-2 py-1 text-xs text-slate-200 hover:border-cyan-300"
                  >
                    {n}
                  </button>
                ))}
              </div>
              <a className="mt-3 inline-block text-sm text-cyan-300 underline" href={audioUrl} download="kittentts.wav">
                Download WAV
              </a>
            </div>
          )}
        </div>

        <div className="space-y-4 rounded-2xl border border-emerald-400/30 bg-slate-900/70 p-5">
          <h3 className="text-lg font-semibold text-white">Shootout Panel</h3>
          <p className="text-xs text-slate-400">Generate the same text across all voices for side-by-side comparison.</p>

          <button
            onClick={runVoiceShootout}
            disabled={!canGenerate || !modelInitialized || shootoutLoading}
            className="rounded-xl border border-emerald-400/70 px-4 py-2 text-sm font-semibold text-emerald-200 hover:border-emerald-300 disabled:opacity-60"
          >
            {shootoutLoading ? "Running Shootout..." : "Run Voice Shootout"}
          </button>

          {shootoutProgress ? <p className="text-xs text-slate-300">{shootoutProgress}</p> : null}

          {shootoutClips.length === 0 ? (
            <p className="mt-2 text-sm text-slate-300">No shootout clips yet.</p>
          ) : (
            <div className="mt-3 grid gap-3">
              {shootoutClips.map((clip) => (
                <div key={clip.id} className="rounded-xl border border-slate-700 bg-slate-950/70 p-3">
                  <p className="text-sm text-slate-200">{voiceLabel(clip.voice)}</p>
                  <p className="mb-2 text-xs text-slate-400">
                    {clip.samples} samples, {clip.chunks} chunk(s)
                  </p>
                  <audio controls className="w-full" src={clip.url} />
                  <div className="mt-2 flex items-center gap-2">
                    <span className="text-xs text-slate-300">MOS:</span>
                    {[1, 2, 3, 4, 5].map((n) => (
                      <button
                        key={n}
                        onClick={() =>
                          rateClip({ clipId: clip.id, score: n, clipType: "shootout", clipVoice: clip.voice })
                        }
                        className="rounded-md border border-slate-600 px-2 py-1 text-xs text-slate-200 hover:border-cyan-300"
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="mt-4 space-y-4 rounded-2xl border border-fuchsia-400/30 bg-slate-900/70 p-5">
        <h3 className="text-lg font-semibold text-white">Dialogue Panel</h3>
        <p className="text-xs text-slate-400">
          Author script lines as <code>SPEAKER: text</code>. Speakers auto-map to Voice A/B in encounter order.
        </p>

        <div className="grid gap-4 md:grid-cols-2">
          <label className="block">
            <span className="mb-2 block text-sm text-slate-200">Voice A</span>
            <select
              value={dialogueVoiceA}
              onChange={(e) => setDialogueVoiceA(e.target.value)}
              className="w-full rounded-xl border border-slate-600 bg-slate-950 p-3 text-slate-100"
            >
              {voices.map((v) => (
                <option key={`a-${v}`} value={v}>
                  {voiceLabel(v)}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="mb-2 block text-sm text-slate-200">Voice B</span>
            <select
              value={dialogueVoiceB}
              onChange={(e) => setDialogueVoiceB(e.target.value)}
              className="w-full rounded-xl border border-slate-600 bg-slate-950 p-3 text-slate-100"
            >
              {voices.map((v) => (
                <option key={`b-${v}`} value={v}>
                  {voiceLabel(v)}
                </option>
              ))}
            </select>
          </label>
        </div>

        <label className="block">
          <span className="mb-2 block text-sm text-slate-200">Dialogue Script</span>
          <textarea
            value={dialogueScript}
            onChange={(e) => setDialogueScript(e.target.value)}
            rows={14}
            className="w-full rounded-xl border border-slate-600 bg-slate-950 p-3 text-slate-100 outline-none focus:border-fuchsia-300"
          />
        </label>

        <div className="flex flex-wrap gap-3">
          <button
            onClick={runDialogueScript}
            disabled={!canGenerate || !modelInitialized || dialogueLoading}
            className="rounded-xl border border-fuchsia-400/70 px-4 py-2 text-sm font-semibold text-fuchsia-200 hover:border-fuchsia-300 disabled:opacity-60"
          >
            {dialogueLoading ? "Rendering Dialogue..." : "Generate Dialogue Clips"}
          </button>
          <button
            onClick={() => setDialogueScript(DEFAULT_DIALOGUE_SCRIPT)}
            className="rounded-xl border border-slate-500 px-4 py-2 text-sm text-slate-200 hover:border-cyan-300"
          >
            Reset Default Script
          </button>
        </div>

        {dialogueProgress ? <p className="text-xs text-slate-300">{dialogueProgress}</p> : null}

        {dialogueClips.length === 0 ? (
          <p className="text-sm text-slate-300">No dialogue clips yet.</p>
        ) : (
          <div className="grid gap-3">
            {dialogueClips.map((clip, idx) => (
              <div key={clip.id} className="rounded-xl border border-slate-700 bg-slate-950/70 p-3">
                <p className="text-sm text-slate-200">
                  {idx + 1}. <strong>{clip.speaker}</strong> {"->"} {voiceLabel(clip.voice)}
                </p>
                <p className="mb-2 text-xs text-slate-400">{clip.text}</p>
                <audio controls className="w-full" src={clip.url} />
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="mt-4 space-y-3 rounded-2xl border border-slate-700 bg-slate-900/70 p-5">
        <h3 className="text-sm font-semibold uppercase tracking-[0.12em] text-slate-200">Ratings + Technical Info</h3>
        <p className="text-xs text-slate-300">{ratingSummary}</p>
        {runtimeInfo ? <p className="text-xs text-slate-300">{runtimeInfo}</p> : null}
        {debugInfo && (
          <pre className="overflow-x-auto rounded-xl border border-slate-700 bg-slate-950/70 p-3 text-xs text-slate-300">
            {debugInfo}
          </pre>
        )}
      </section>
    </main>
  );
}
