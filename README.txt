BLEX IA - ARCHIVOS INICIALES

REQUISITOS
- Node.js 18 o superior (se recomienda Node 20/22)
- Proyecto de Supabase
- Aplicación OAuth de Google configurada en Supabase
- Proveedor de IA compatible con API estilo OpenAI (por configurar)

INSTALACIÓN
1. Descomprime el ZIP.
2. Copia .env.example como .env.
3. Completa SUPABASE_URL, SUPABASE_ANON_KEY y SUPABASE_SERVICE_ROLE_KEY.
4. En Supabase, habilita Google en Authentication > Providers y configura las credenciales OAuth.
5. Añade http://localhost:3000 como URL de redirección permitida en Supabase para pruebas locales.
6. Ejecuta supabase.sql en Supabase > SQL Editor.
7. Ejecuta: npm install
8. Ejecuta: npm start
9. Abre http://localhost:3000

LÍMITES
- 300 mensajes por usuario y día.
- 10 imágenes por usuario y día.
- Los contadores usan fecha UTC en esta primera versión.

IMPORTANTE: QUÉ ESTÁ Y QUÉ NO ESTÁ LISTO
- La interfaz adaptable, navegación, páginas informativas, botón de volver arriba y botón de Google están preparados.
- La autenticación real requiere configurar Google OAuth en Supabase y completar .env.
- Supabase Auth gestiona sesiones; la tabla daily_usage y la función SQL gestionan contadores.
- El endpoint del chat valida sesión y límites, pero requiere un proveedor de IA y sus credenciales.
- La selección/preview de imágenes está preparada en el navegador, pero NO se envían al modelo todavía.
- No está implementado todavía el análisis real de imágenes, almacenamiento seguro de adjuntos ni moderación automática de archivos y respuestas.
- No publiques la SERVICE_ROLE_KEY ni claves de IA en archivos dentro de public/.
- No presentes la moderación como activa hasta implementarla y probarla del lado del servidor.
- Los documentos legales son borradores y deben adaptarse a las prácticas reales de BLEX IA y revisarse antes de publicarse.

SEGURIDAD
El backend verifica el token de Supabase con auth.getUser. Los límites se actualizan mediante una función SQL con bloqueo de fila para evitar incrementos simultáneos por encima del máximo. En producción configura HTTPS, URLs de redirección exactas, políticas de almacenamiento privadas y controles de moderación antes de procesar archivos.

NOTA DEL LOGO
El archivo del logo original no estaba disponible en esta sesión de creación; public/logo-blex-ia.png es un marcador temporal. Sustitúyelo por el logo oficial de BLEX IA antes de publicar.
