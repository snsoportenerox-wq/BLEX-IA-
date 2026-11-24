BLEX IA 1.1.0 - AUTENTICACIÓN SOLO CON DISCORD

REQUISITOS
- Node.js 18 o superior (se recomienda Node 20/22)
- Proyecto de Supabase
- Aplicación OAuth de Discord configurada como proveedor en Supabase
- Proveedor de IA compatible con API estilo OpenAI (por configurar)

INSTALACIÓN
1. Descomprime el ZIP.
2. Copia .env.example como .env.
3. Completa SUPABASE_URL, SUPABASE_ANON_KEY y SUPABASE_SERVICE_ROLE_KEY.
4. En Supabase, abre Authentication > Providers > Discord y activa Discord.
5. En el portal de desarrolladores de Discord, configura como Redirect URL la URL de callback que muestra Supabase para el proveedor Discord.
6. En Supabase, añade la URL de tu web a Authentication > URL Configuration > Redirect URLs. Para pruebas locales, añade http://localhost:3000.
7. Ejecuta supabase.sql en Supabase > SQL Editor.
8. Ejecuta: npm install
9. Ejecuta: npm start
10. Abre http://localhost:3000

AUTENTICACIÓN
- El único método de inicio de sesión de esta versión es Discord.
- Supabase Auth gestiona el inicio de sesión y las sesiones.
- El backend valida los tokens de Supabase antes de permitir el uso de la API.
- No se necesita Firebase ni configuración de Google para esta versión.

LÍMITES
- 300 mensajes por usuario y día.
- 10 imágenes por usuario y día.
- Los contadores usan fecha UTC en esta primera versión.

ESTADO DE FUNCIONES
- La interfaz adaptable, navegación, páginas informativas y botón de volver arriba están preparados.
- El botón de inicio de sesión utiliza Discord OAuth mediante Supabase.
- La tabla daily_usage y la función SQL gestionan los contadores diarios.
- El endpoint del chat valida sesión y límites, pero requiere un proveedor de IA y sus credenciales.
- La selección y vista previa de imágenes está preparada en el navegador, pero las imágenes NO se envían al modelo todavía.
- No está implementado todavía el análisis real de imágenes, almacenamiento seguro de adjuntos ni moderación automática de archivos y respuestas.
- Los documentos legales son borradores y deben adaptarse a las prácticas reales de BLEX IA y revisarse antes de publicarse.

SEGURIDAD
- No publiques SUPABASE_SERVICE_ROLE_KEY ni claves de IA en archivos dentro de public/.
- Mantén las credenciales OAuth de Discord y las claves privadas en los paneles/variables privadas correspondientes.
- En producción configura HTTPS, URLs de redirección exactas, políticas de almacenamiento privadas y controles de moderación antes de procesar archivos.

NOTA DEL LOGO
El archivo del logo original no estaba disponible en esta sesión de creación; public/logo-blex-ia.png es un marcador temporal. Sustitúyelo por el logo oficial de BLEX IA antes de publicar.
