BLEX IA 1.1.0 - AUTENTICACION SEPARADA Y SUPABASE COMO BASE DE DATOS

ARQUITECTURA ACTUAL
- Firebase Authentication: inicio de sesion con Google.
- Supabase Auth: inicio de sesion con Discord (proveedor Discord habilitado).
- Supabase Database: perfiles, historial de inicios de sesion y contadores diarios.
- BLEX IA: chat independiente del proveedor de autenticacion.

IMPORTANTE SOBRE LAS CLAVES
La clave sb_secret que se compartio anteriormente debe revocarse y reemplazarse desde Supabase.
No pegues secretos en el chat ni los subas a GitHub.
SUPABASE_ANON_KEY contiene una clave publicable sb_publishable_ y puede estar en la configuracion del servidor/cliente.
SUPABASE_SERVICE_ROLE_KEY contiene la clave sb_secret_ y solo se usa en el backend.

CONFIGURACION
1. Descomprime el ZIP y copia .env.example como .env.
2. Completa SUPABASE_URL y SUPABASE_ANON_KEY.
3. Genera una nueva clave secreta Supabase y guardala como SUPABASE_SERVICE_ROLE_KEY.
4. En Firebase Console crea un proyecto y registra una aplicacion web.
5. Habilita Google en Firebase Authentication > Sign-in method.
6. Copia apiKey, authDomain, projectId y appId de la configuracion web Firebase al .env.
7. En Firebase Console > Project settings > Service accounts genera una clave privada del Admin SDK. Guarda client_email y private_key en FIREBASE_CLIENT_EMAIL y FIREBASE_PRIVATE_KEY. Nunca publiques ese archivo JSON.
8. En Supabase > Authentication > Providers habilita Discord y configura Client ID/Secret de tu aplicacion Discord.
9. En Supabase Authentication > URL Configuration agrega la URL de tu sitio como Site URL y redirect permitida.
10. En Firebase Authentication > Settings > Authorized domains agrega tu dominio y localhost para pruebas.
11. Ejecuta supabase.sql en Supabase > SQL Editor.
12. Ejecuta npm install y npm start. Abre http://localhost:3000.

REGISTROS
El backend valida el token de Firebase para Google y el token de Supabase para Discord.
Despues guarda perfiles y eventos de inicio de sesion en blex_profiles y blex_login_events.
Los identificadores se prefijan con firebase: o discord: para evitar colisiones.

LIMITES
- 300 mensajes diarios por identidad/proveedor.
- 10 imágenes diarias por identidad/proveedor.
- Los contadores siguen usando fecha UTC en esta version.

PENDIENTES REALES
- Falta elegir y configurar el proveedor/modelo de IA.
- Las imagenes se pueden seleccionar y previsualizar, pero no se envian ni analizan todavia.
- Falta moderacion real del contenido y adjuntos del lado del servidor.
- No se ha implementado almacenamiento de conversaciones; este proyecto no guarda chats en Supabase.
- Los documentos legales son borradores y deben revisarse antes de publicar.

NOTA
El archivo public/logo-blex-ia.png sigue siendo un marcador temporal de la entrega anterior. Sustituyelo por el logo oficial.
