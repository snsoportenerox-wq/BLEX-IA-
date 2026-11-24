require("dotenv").config();
const express = require("express");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const path = require("path");
const { createClient } = require("@supabase/supabase-js");
const admin = require("firebase-admin");

const app = express();
const PORT = process.env.PORT || 3000;
app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json({ limit: "12mb" }));
app.use(express.static(path.join(__dirname, "public")));

const supabaseReady = Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
const supabaseAdmin = supabaseReady ? createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } }
) : null;

const firebaseReady = Boolean(
  process.env.FIREBASE_PROJECT_ID &&
  process.env.FIREBASE_CLIENT_EMAIL &&
  process.env.FIREBASE_PRIVATE_KEY
);
if (firebaseReady && !admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n")
    })
  });
}

const chatLimiter = rateLimit({
  windowMs: 60 * 1000, limit: 20,
  standardHeaders: "draft-7", legacyHeaders: false,
  message: { error: "Demasiadas solicitudes. Inténtalo de nuevo en un momento." }
});

function publicFirebaseConfig() {
  return {
    apiKey: process.env.FIREBASE_API_KEY || "",
    authDomain: process.env.FIREBASE_AUTH_DOMAIN || "",
    projectId: process.env.FIREBASE_PROJECT_ID || "",
    appId: process.env.FIREBASE_APP_ID || ""
  };
}

async function authenticate(req, res, next) {
  try {
    const token = (req.headers.authorization || "").replace(/^Bearer\s+/i, "");
    const provider = String(req.headers["x-auth-provider"] || "").toLowerCase();
    if (!token) return res.status(401).json({ error: "Inicia sesión para continuar." });
    if (!supabaseReady) return res.status(503).json({ error: "Supabase no está configurado." });

    let identity;
    if (provider === "firebase") {
      if (!firebaseReady) return res.status(503).json({ error: "Firebase Admin no está configurado." });
      const decoded = await admin.auth().verifyIdToken(token);
      identity = {
        userId: `firebase:${decoded.uid}`,
        provider: "google",
        email: decoded.email || null,
        name: decoded.name || decoded.email || "Usuario",
        avatar: decoded.picture || null
      };
    } else if (provider === "discord") {
      const { data, error } = await supabaseAdmin.auth.getUser(token);
      if (error || !data?.user) return res.status(401).json({ error: "Sesión de Discord no válida." });
      const u = data.user;
      identity = {
        userId: `discord:${u.id}`,
        provider: "discord",
        email: u.email || null,
        name: u.user_metadata?.full_name || u.user_metadata?.name || u.user_metadata?.user_name || "Usuario de Discord",
        avatar: u.user_metadata?.avatar_url || null
      };
    } else {
      return res.status(400).json({ error: "Proveedor de inicio de sesión no reconocido." });
    }

    const { error: profileError } = await supabaseAdmin.from("blex_profiles").upsert({
      user_id: identity.userId, provider: identity.provider, email: identity.email,
      display_name: identity.name, avatar_url: identity.avatar, last_login_at: new Date().toISOString()
    }, { onConflict: "user_id" });
    if (profileError) console.error("No se pudo actualizar el perfil:", profileError.message);

    req.identity = identity;
    req.authToken = token;
    next();
  } catch (err) {
    console.warn("Error de autenticación:", err.message);
    return res.status(401).json({ error: "Tu sesión no es válida. Vuelve a iniciar sesión." });
  }
}

app.get("/api/config", (_req, res) => {
  res.json({
    supabaseUrl: process.env.SUPABASE_URL || "",
    supabaseAnonKey: process.env.SUPABASE_ANON_KEY || "",
    firebase: publicFirebaseConfig(),
    configured: supabaseReady
  });
});

app.post("/api/auth/login-event", authenticate, async (req, res) => {
  const { error } = await supabaseAdmin.from("blex_login_events").insert({
    user_id: req.identity.userId,
    provider: req.identity.provider,
    email: req.identity.email,
    logged_in_at: new Date().toISOString()
  });
  if (error) return res.status(500).json({ error: "No se pudo guardar el registro de acceso." });
  res.json({ ok: true });
});

app.get("/api/me/usage", authenticate, async (req, res) => {
  const today = new Date().toISOString().slice(0, 10);
  const { data, error } = await supabaseAdmin.from("daily_usage")
    .select("message_count,image_count")
    .eq("user_id", req.identity.userId)
    .eq("usage_date", today).maybeSingle();
  if (error) return res.status(500).json({ error: "No se pudo consultar el uso diario." });
  res.json({ messages: data?.message_count || 0, images: data?.image_count || 0,
    messageLimit: 300, imageLimit: 10, date: today });
});

app.post("/api/chat", chatLimiter, authenticate, async (req, res) => {
  const { message, imageCount = 0 } = req.body || {};
  const cleanMessage = typeof message === "string" ? message.trim() : "";
  const countImages = Number(imageCount);
  if (!cleanMessage && countImages < 1) return res.status(400).json({ error: "Escribe un mensaje o adjunta una imagen." });
  if (!Number.isInteger(countImages) || countImages < 0 || countImages > 10)
    return res.status(400).json({ error: "Cantidad de imágenes no válida." });

  if (!process.env.AI_API_URL || !process.env.AI_API_KEY || !process.env.AI_MODEL)
    return res.status(503).json({ error: "Falta configurar el proveedor de IA en el archivo .env." });

  const { data: usage, error: usageError } = await supabaseAdmin.rpc("consume_blex_usage", {
    p_user_id: req.identity.userId,
    p_messages: cleanMessage ? 1 : 0,
    p_images: countImages
  });
  if (usageError) {
    console.error("Error de contador:", usageError.message);
    return res.status(500).json({ error: "No se pudo validar el límite diario. Revisa supabase.sql." });
  }
  if (!usage?.allowed) return res.status(429).json({
    error: usage.reason === "images" ? "Has alcanzado el límite de 10 imágenes de hoy." :
      "Has alcanzado el límite de 300 mensajes de hoy.", usage
  });

  try {
    const response = await fetch(process.env.AI_API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${process.env.AI_API_KEY}` },
      body: JSON.stringify({ model: process.env.AI_MODEL, messages: [{ role: "user", content: cleanMessage }] })
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
  if (!supabaseReady) console.log("Configura Supabase en .env");
  if (!firebaseReady) console.log("Configura Firebase Admin en .env");
});
