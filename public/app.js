const $ = (id) => document.getElementById(id);
let supabase = null, session = null, selectedFiles = [];

async function init() {
  const response = await fetch("/api/config");
  const config = await response.json();
  if (config.supabaseUrl && config.supabaseAnonKey && window.supabase) {
    supabase = window.supabase.createClient(config.supabaseUrl, config.supabaseAnonKey);
    const { data } = await supabase.auth.getSession();
    session = data.session;
    supabase.auth.onAuthStateChange((_event, nextSession) => {
      session = nextSession;
      renderAuth();
      refreshUsage();
    });
  }
  renderAuth();
  refreshUsage();
}
function renderAuth() {
  $("authStatus").textContent = session ? "Sesión iniciada correctamente." : "Inicia sesión para acceder a tu espacio.";
  $("userLabel").textContent = session?.user?.email || "No has iniciado sesión";
  $("loginBtn").textContent = session ? "Cuenta conectada" : "Iniciar sesión";
}
async function login() {
  if (!supabase) return alert("Configura SUPABASE_URL y SUPABASE_ANON_KEY en .env.");
  const { error } = await supabase.auth.signInWithOAuth({
    provider: "discord",
    options: { redirectTo: window.location.origin }
  });
  if (error) alert("No se pudo iniciar sesión: " + error.message);
}
async function logout() {
  if (!supabase) return;
  const { error } = await supabase.auth.signOut();
  if (error) alert("No se pudo cerrar sesión.");
}
async function api(path, body) {
  const token = session?.access_token;
  const response = await fetch(path, {
    method: body ? "POST" : "GET",
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
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
$("loginBtn").addEventListener("click", login);
$("heroLogin").addEventListener("click", login);
$("logoutBtn").addEventListener("click", logout);
$("menuToggle").addEventListener("click", () => $("nav").classList.toggle("open"));
$("fileInput").addEventListener("change", (event) => {
  const incoming = [...event.target.files];
  const imageFiles = incoming.filter(f => f.type.startsWith("image/"));
  if (imageFiles.length !== incoming.length) alert("Por ahora solo se permiten imágenes en el chat.");
  if (selectedFiles.length + imageFiles.length > 10) {
    alert("Puedes seleccionar como máximo 10 imágenes por envío.");
    return;
  }
  selectedFiles = [...selectedFiles, ...imageFiles];
  $("filePreview").replaceChildren();
  selectedFiles.forEach((file, index) => {
    const item = document.createElement("span");
    item.className = "preview-item";
    item.textContent = `${file.name}  ×`;
    item.title = "Pulsa para quitar";
    item.addEventListener("click", () => {
      selectedFiles.splice(index, 1);
      $("fileInput").value = "";
      renderPreviews();
    });
    $("filePreview").appendChild(item);
  });
});
function renderPreviews() {
  $("filePreview").replaceChildren();
  selectedFiles.forEach((file, index) => {
    const item = document.createElement("span");
    item.className = "preview-item";
    item.textContent = `${file.name} ×`;
    item.addEventListener("click", () => { selectedFiles.splice(index, 1); renderPreviews(); });
    $("filePreview").appendChild(item);
  });
}
$("chatForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!session) return alert("Inicia sesión con Discord para usar el chat.");
  const message = $("messageInput").value.trim();
  if (!message && !selectedFiles.length) return;
  // En esta entrega las imágenes se seleccionan y previsualizan; aún falta configurar
  // almacenamiento seguro, análisis de imágenes y moderación del proveedor.
  if (selectedFiles.length) {
    return alert("La selección de imágenes está lista. Para enviarlas al modelo falta configurar almacenamiento y análisis de imágenes del proveedor de IA.");
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