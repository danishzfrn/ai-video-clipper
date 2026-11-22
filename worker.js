const MAX_BYTES = 25 * 1024 * 1024;

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname !== "/api/transcribe") {
      return new Response("Tidak ditemukan", { status: 404 });
    }
    if (request.method !== "POST") {
      return json({ error: "Gunakan POST" }, 405);
    }
    if (request.headers.get("Origin") !== url.origin) {
      return json({ error: "Asal permintaan tidak diizinkan" }, 403);
    }
    if (!env.GROQ_API_KEY) {
      return json({ error: "Key Groq belum dipasang" }, 500);
    }

    const len = Number(request.headers.get("Content-Length") || 0);
    if (len > MAX_BYTES + 200000) {
      return json({ error: "File audio terlalu besar (maksimal 25 MB)" }, 413);
    }

    let form;
    try {
      form = await request.formData();
    } catch (e) {
      return json({ error: "Format data salah" }, 400);
    }
    const file = form.get("file");
    if (!file || typeof file === "string") {
      return json({ error: "File audio tidak ada" }, 400);
    }
    if (file.size > MAX_BYTES) {
      return json({ error: "File audio terlalu besar (maksimal 25 MB)" }, 413);
    }

    const out = new FormData();
    out.append("file", file, file.name || "audio.mp3");
    out.append("model", "whisper-large-v3-turbo");
    out.append("language", "id");
    out.append("response_format", "verbose_json");
    out.append("timestamp_granularities[]", "word");
    out.append("timestamp_granularities[]", "segment");
    out.append("temperature", "0");

    const res = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: "Bearer " + env.GROQ_API_KEY },
      body: out,
    });
    const text = await res.text();
    return new Response(text, {
      status: res.status,
      headers: { "Content-Type": "application/json" },
    });
  },
};
