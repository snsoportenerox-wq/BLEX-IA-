require("dotenv").config();
const express = require("express");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const path = require("path");
const { createClient } = require("@supabase/supabase-js");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json({ limit: "12mb" }));
app.use(express.static(path.join(__dirname, "public")));

const supabaseReady = Boolean(
  process.env.SUPABASE_URL &&
  process.env.SUPABASE_ANON_KEY &&
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const supabaseAdmin = supabaseReady
  ? createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false }
    })
  : null;

const chatLimiter = rateLimit({
  windowMs: 60 *  1000,
  limit: 20,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: "Demasiadas solicitudes. Inténtalo de nuevo en un momento." }
});

async function authenticate(req, res, next) {
  try {
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : "";
    if (!token) return res.status(401).json({ error: "Inicia sesión para continuar." });
    if (!supabaseReady) return res.status(503).json({ error: "Supabase todavía no está configurado." });

    const { data, error } = await supabaseAdmin.auth.getUser(token);
    if (error || !data?.user) return res.status(401).json({ error: "Sesión no válida. Inicia sesión otra vez." });
    req.user = data.user;
    req.userSupabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false, autoRefreshToken: false }
    });
    next();
  } catch {
    res.status(500).json({ error: "No se pudo validar la sesión." });
  }
}

app.get("/api/config", (_req, res) => {
  res.json({
    supabaseUrl: process.env.SUPABASE_URL || "",
    supabaseAnonKey: process.env.SUPABASE_ANON_KEY || "",
    configured: supabaseReady
  });
});

app.get("/api/me/usage", authenticate, async (req, res) => {
  const today = new Date().toISOString().slice(0, 10);
  const { data, error } = await supabaseAdmin
    .from("daily_usage")
    .select("message_count,image_count")
    .eq("user_id", req.user.id)
    .eq("usage_date", today)
    .maybeSingle();

  if (error) return res.status(500).json({ error: "No se pudo consultar el uso diario." });
  res.json({
    messages: data?.message_count || 0,
    images: data?.image_count || 0,
    messageLimit: 300,
    imageLimit: 10,
    date: today
  });
});

app.post("/api/chat", chatLimiter, authenticate, async (req, res) => {
  const { message, imageCount = 0 } = req.body || {};
  const cleanMessage = typeof message === "string" ? message.trim() : "";
  const countImages = Number(imageCount);

  if (!cleanMessage && countImages < 1) {
    return res.status(400).json({ error: "Escribe un mensaje o adjunta una imagen." });
  }
  if (!Number.isInteger(countImages) || countImages < 0 || countImages > 10) {
    return res.status(400).json({ error: "Cantidad de imágenes no válida." });
  }

  // Los contadores se aplican atómicamente mediante la función SQL incluida.
  if (!process.env.AI_API_URL || !process.env.AI_API_KEY || !process.env.AI_MODEL) {
    return res.status(503).json({
      error: "El chat está preparado, pero falta configurar el proveedor de IA en el archivo .env."
    });
  }

  const { data: usage, error: usageError } = await req.userSupabase.rpc("consume_blex_usage", {
    p_user_id: req.user.id,
    p_messages: cleanMessage ? 1 : 0,
    p_images: countImages
  });

  if (usageError) {
    return res.status(500).json({ error: "No se pudo validar el límite diario. Revisa supabase.sql." });
  }
  if (!usage?.allowed) {
    return res.status(429).json({
      error: usage?.reason === "images" ? "Has alcanzado el límite de 10 imágenes de hoy." :
        "Has alcanzado el límite de 300 mensajes de hoy.",
      usage
    });
  }

  // Adaptador genérico compatible con APIs tipo OpenAI. El proveedor elegido debe admitir este formato.
  try {
    const response = await fetch(process.env.AI_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.AI_API_KEY}`
      },
      body: JSON.stringify({
        model: process.env.AI_MODEL,
        messages: [{ role: "user", content: cleanMessage }]
      })
    });
    const payload = await response.json();
    if (!response.ok) return res.status(502).json({ error: "El proveedor de IA no pudo responder." });
    const answer = payload.choices?.[0]?.message?.content || payload.output_text;
    if (!answer) return res.status(502).json({ error: "Respuesta no compatible del proveedor de IA." });
    res.json({ answer, usage });
  } catch {
    res.status(502).json({ error: "No se pudo conectar con el proveedor de IA." });
  }
});

app.get("*", (_req, res) => res.sendFile(path.join(__dirname, "public", "index.html")));

app.listen(PORT, () => {
  console.log(`BLEX IA disponible en http://localhost:${PORT}`);
  if (!supabaseReady) console.log("Configura las variables de Supabase en .env");
});
