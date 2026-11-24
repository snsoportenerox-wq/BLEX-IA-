const $ = (id) => document.getElementById(id);
let supabase = null, firebaseAuth = null, session = null, activeProvider = null, selectedFiles = [];

async function init() {
  const response = await fetch("/api/config");
  const config = await response.json();

  if (config.supabaseUrl && config.supabaseAnonKey && window.supabase) {
    supabase = window.supabase.createClient(config.supabaseUrl, config.supabaseAnonKey);
    const { data } = await supabase.auth.getSession();
    if (data.session) {
      session = data.session;
      activeProvider = "discord";
    }
    supabase.auth.onAuthStateChange(async (_event, nextSession) => {
      if (nextSession) {
        session = nextSession;
        activeProvider = "discord";
        await recordLogin();
      } else if (activeProvider === "discord") {
        session = null;
        activeProvider = null;
      }
      renderAuth();
      refreshUsage();
    });
  }

  if (config.firebase?.apiKey && window.firebase) {
    if (!firebase.apps.length) firebase.initializeApp(config.firebase);
    firebaseAuth = firebase.auth();
    firebaseAuth.onAuthStateChanged(async (user) => {
      if (user) {
        session = { access_token: await user.getIdToken(), user: {
          email: user.email, displayName: user.displayName, photoURL: user.photoURL
        }};
        activeProvider = "firebase";
        await recordLogin();
      } else if (activeProvider === "firebase") {
        session = null;
        activeProvider = null;
      }
      renderAuth();
      refreshUsage();
    });
  }
  renderAuth();
  refreshUsage();
}

function renderAuth() {
  $("authStatus").textContent = session
    ? `Sesión iniciada con ${activeProvider === "firebase" ? "Google" : "Discord"}.`
    : "Inicia sesión para acceder a tu espacio.";
  $("userLabel").textContent = session?.user?.email || session?.user?.displayName || "No has iniciado sesión";
  $("loginGoogle").textContent = activeProvider === "firebase" ? "Google conectado" : "Continuar con Google";
  $("loginDiscord").textContent = activeProvider === "discord" ? "Discord conectado" : "Continuar con Discord";
}

async function loginGoogle() {
  if (!firebaseAuth) return alert("Configura Firebase en el archivo .env y habilita Google en Firebase Authentication.");
  try {
    const provider = new firebase.auth.GoogleAuthProvider();
    await firebaseAuth.signInWithPopup(provider);
  } catch (e) {
    if (e.code === "auth/popup-blocked" || e.code === "auth/operation-not-supported-in-this-environment") {
      await firebaseAuth.signInWithRedirect(new firebase.auth.GoogleAuthProvider());
    } else alert("No se pudo iniciar sesión con Google: " + e.message);
  }
}

async function loginDiscord() {
  if (!supabase) return alert("Configura Supabase en el archivo .env.");
  const { error } = await supabase.auth.signInWithOAuth({
    provider: "discord",
    options: { redirectTo: window.location.origin }
  });
  if (error) alert("No se pudo iniciar sesión con Discord: " + error.message);
}

async function logout() {
  try {
    if (activeProvider === "firebase" && firebaseAuth) await firebaseAuth.signOut();
    if (activeProvider === "discord" && supabase) await supabase.auth.signOut();
    session = null;
    activeProvider = null;
    renderAuth();
    refreshUsage();
  } catch { alert("No se pudo cerrar sesión."); }
}

async function recordLogin() {
  if (!session || !activeProvider) return;
  try {
    await api("/api/auth/login-event", null);
  } catch (e) { console.warn("No se pudo guardar el acceso:", e.message); }
}

async function api(path, body) {
  if (!session?.access_token) throw new Error("Inicia sesión para continuar.");
  const response = await fetch(path, {
    method: body ? "POST" : "GET",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session.access_token}`,
      "X-Auth-Provider": activeProvider
    },
    ...(body ? { body: JSON.stringify(body) } : {})
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Ocurrió un error.");
  return data;
}

async function refreshUsage() {
  if (!session) {
    $("messageUsage").textContent = "Mensajes: —/300";
    $("imageUsage").textContent = "Imágenes: —/10";
    return;
  }
  try {
    const usage = await api("/api/me/usage");
    $("messageUsage").textContent = `Mensajes: ${usage.messages}/300`;
    $("imageUsage").textContent = `Imágenes: ${usage.images}/10`;
  } catch (e) { console.warn(e.message); }
}

function addBubble(text, who) {
  const div = document.createElement("div");
  div.className = `bubble ${who}`;
  div.textContent = text;
  $("messages").appendChild(div);
  $("messages").scrollTop = $("messages").scrollHeight;
}

$("loginGoogle").addEventListener("click", loginGoogle);
$("heroGoogle").addEventListener("click", loginGoogle);
$("loginDiscord").addEventListener("click", loginDiscord);
$("heroDiscord").addEventListener("click", loginDiscord);
$("logoutBtn").addEventListener("click", logout);
$("menuToggle").addEventListener("click", () => $("nav").classList.toggle("open"));

$("fileInput").addEventListener("change", (event) => {
  const incoming = [...event.target.files];
  const imageFiles = incoming.filter(f => f.type.startsWith("image/"));
  if (imageFiles.length !== incoming.length) alert("Por ahora solo se permiten imágenes.");
  if (selectedFiles.length + imageFiles.length > 10) {
    alert("Puedes seleccionar como máximo 10 imágenes por envío.");
    return;
  }
  selectedFiles = [...selectedFiles, ...imageFiles];
  renderPreviews();
});
function renderPreviews() {
  $("filePreview").replaceChildren();
  selectedFiles.forEach((file, index) => {
    const item = document.createElement("span");
    item.className = "preview-item";
    item.textContent = `${file.name} ×`;
    item.title = "Pulsa para quitar";
    item.addEventListener("click", () => {
      selectedFiles.splice(index, 1);
      $("fileInput").value = "";
      renderPreviews();
    });
    $("filePreview").appendChild(item);
  });
}

$("chatForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!session) return alert("Inicia sesión con Google o Discord para usar el chat.");
  const message = $("messageInput").value.trim();
  if (!message && !selectedFiles.length) return;
  if (selectedFiles.length) {
    return alert("La selección de imágenes está preparada, pero todavía falta conectar el envío y análisis real de imágenes al modelo.");
  }
  addBubble(message, "user");
  $("messageInput").value = "";
  try {
    const result = await api("/api/chat", { message, imageCount: 0 });
    addBubble(result.answer, "ai");
    refreshUsage();
  } catch (error) {
    addBubble(error.message, "ai");
    refreshUsage();
  }
});

window.addEventListener("scroll", () => $("backTop").classList.toggle("show", window.scrollY > 350));
$("backTop").addEventListener("click", () => window.scrollTo({ top: 0, behavior: "smooth" }));
init();
