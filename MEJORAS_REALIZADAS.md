# Mejoras Realizadas

## 0.3 Segunda tanda: cuerpo estructural de las vistas y las reglas del sistema como prueba

### Las reglas del sistema ahora se verifican solas

`tests/js/sistema-diseno.test.js` (7 pruebas) recorre **todas** las vistas y los
componentes y falla si vuelve a entrar: un radio fuera de escala (`rounded-2xl/3xl`),
una sombra apilada sobre un borde (R10), un título de página genérico, un
`window.confirm`/`alert` nativo, un token `--ofbol-*` inexistente o una clase
`ofbol-*` inventada (esta última cubre también las clases armadas por concatenación,
como `ofbol-badge--${tono}`).

Sirvió de inmediato: encontró **9 vistas sin `.ofbol-page-enter`**. Tres eran reales
(`Notificaciones` de los tres roles) y se corrigieron; las de `Reportes` y
`Trazabilidad` ya la tenían en sus motores compartidos (`ReportesEngine`,
`RecorridoInstitucional`) y la prueba se afinó para no señalarlas.

### Pruebas de comportamiento, no solo de humo

`tests/js/misdocumentos.test.jsx` (9 pruebas) ejerce el flujo real del usuario:
filtrar por texto y por tipo, ordenar por fecha y por código, paginar de a 10 y
limpiar filtros. Incluye la **regresión del `toSorted`**: una prueba que falla si el
orden vuelve a descartarse. Total del arnés: **78 → 94 pruebas**.

`vitest.config.js` pasó de `*.test.jsx` a `*.test.{js,jsx}` para admitir pruebas de
reglas escritas en JS plano (leen los archivos, no montan React).

### Vistas reescritas con el sistema

| Vista | Qué cambió |
|---|---|
| `secretario_comando_departamental/DocumentosPorEpi.jsx` | Modal propio → `Modal` compartido; 4 contadores a mano → `KpiPanel` (con una sola cifra líder); tabla a mano → `.ofbol-table`; vacío a mano → `EstadoVacio`; naranjas/azules/verdes de Tailwind → acentos institucionales; `useNavigate` sin usar, eliminado |
| `secretario_comando_departamental/GestionSecretarios.jsx` | Dos modales propios → `Modal`; campos a `.ofbol-input`; desactivar ahora pasa por `ConfirmDialog` (antes cortaba el acceso sin preguntar); avatares y estados a tokens; tablas a `.ofbol-table` |
| `secretario_comando_departamental/DesempenioEpis.jsx` | `Metrica` y `Pill` locales duplicaban `KpiPanel` y `ChipsDato` → reemplazados; gradientes `from-[#5a6b3d] to-[#3d4a2c]` de los avatares → color plano (R1); barras propias → `.ofbol-progress`; acentos desde `ACENTOS` en vez de hex sueltos |
| `secretario_comando_departamental/Observaciones.jsx` | Kicker fuera; tablas y tarjetas sobre el sistema |
| `comando_general/GestionUsuarios.jsx` | Tarjetas de métricas → `KpiPanel`; pestañas y buscador al sistema; tabla a `.ofbol-table`; vacío → `EstadoVacio`; pastillas azul/ámbar/esmeralda → tokens; desactivar con `ConfirmDialog`; `parseInt` sin base corregido |
| `comando_general/DocumentosAprobados.jsx` | Igual, más: el panel oscuro con `text-emerald-300` → superficie oliva institucional; las 3 fichas de datos → `ChipsDato` |
| `comando_general/Auditoria.jsx`, `DirectorioInstitucional.jsx`, `ComparativoGeneral.jsx` | Kicker fuera, filtros y tablas al sistema, métricas a `KpiPanel`/`ChipsDato`, `ring`+`borde` (que eran borde y sombra a la vez) corregido |

### Afirmaciones que la interfaz no podía sostener (corregidas)

- `DocumentosPorEpi` mostraba `hash || 'SHA256-POLICIA-BOLIVIANA-OFBOL'`: un hash
  **inventado** cuando el documento no tenía sello. Ahora se muestra el hash real o
  se dice que el trámite todavía no tiene sello digital.
- `DocumentosAprobados` afirmaba `'SHA-256 Verificado'` y `'PDF Inalterado'` sin
  verificar nada. Ahora muestra el hash emitido o su ausencia.
- Ambas vistas usan el texto real en lugar de una cadena fija.

### Nota de seguridad (decisión pendiente de la institución)

La clave de arranque `ale775` viaja **en el bundle** del frontend: era un literal
repetido en tres vistas de administración. Ahora es una sola constante con nombre
(`CLAVE_POR_DEFECTO`) para que el cambio de política sea de una línea, pero sigue
visible en el cliente. Corresponde decidir si la clave inicial la genera el backend
una sola vez y se entrega fuera del canal, en vez de venir en el código.

### Verificación

`npm test` → **94/94 verdes** · `npm run build` → **exit 0**. Las 7 reglas del sistema
y las 9 pruebas de comportamiento de `MisDocumentos` corren dentro de ese mismo
`npm test`, así que cualquier tanda futura queda cubierta.

---

## 0.2 Arnés de pruebas + barrido del sistema en las 28 vistas restantes

### Arnés de pruebas (nuevo)

Antes no existía ninguna prueba de frontend. `vite build` valida sintaxis pero
**no** detecta un símbolo sin importar: eso solo revienta al renderizar. Ahora hay
`npm test` (vitest + jsdom + @testing-library/react):

- `vitest.config.js` — entorno jsdom, sin el plugin de Tailwind (las pruebas no
  evalúan estilos).
- `tests/js/setup.js` — shims de `matchMedia`, `AudioContext`, `URL.createObjectURL`,
  observadores y `scrollIntoView`.
- `tests/js/vistas.test.jsx` — **78 pruebas** (2 por vista × 38 vistas de los 3 roles
  más login y registro público): cada vista real se monta con la sesión sembrada y la
  API simulada, y falla si el render lanza, si aparece un `undefined` suelto, un
  `is not defined` o un `NaN`.

**Bug real que encontró la primera corrida:** `GestionTiposMemo` crasheaba al
renderizar (`Cannot read properties of undefined (reading 'length')`). Se endureció
la carga para que una respuesta con forma inesperada conserve el catálogo vacío en
vez de dejar la pantalla en blanco.

### Barrido sistemático (23 archivos de vista)

Los tres scripts quedan en `.test_tmp/` como registro de las reglas aplicadas:

| Regla | Resultado |
|---|---|
| `rounded-2xl` / `rounded-3xl` → `rounded-[14px]` (la escala del sistema es 12–16 px) | **85** |
| Quitar `shadow-*` **solo** cuando la misma clase ya trae `border` (R10: borde o sombra, nunca ambos) | **52** |
| Normalizar los 6 títulos de página distintos a `.ofbol-display` | **21** |
| Agregar `.ofbol-page-enter` al contenedor raíz (antes solo 3 de 24 lo tenían) | **13** |

No se tocaron los anillos de foco: `focus-visible:ring-emerald-500` y compañía ya
resuelven a oliva por el remapeo de la paleta, así que cambiarlos no aportaba y
podía romper el foco de elementos con `outline-none`.

### Rediseño profundo

- **`secretario_unidad/MisDocumentos.jsx`** reescrita: campos `.ofbol-input`, tabla
  `.ofbol-table`, estado vacío `EstadoVacio`, detalle con `ChipsDato`, revisiones con
  los tonos institucionales (antes naranjas), botones de acción siempre visibles (antes
  `opacity-0` hasta el hover, inaccesible en táctil) con `aria-label`. **Bug corregido:**
  el orden por fecha/código nunca se aplicaba — `list.toSorted(...)` devuelve un arreglo
  nuevo y el resultado se descartaba. 12,82 → **9,57 kB**.
- **Los 3 `Perfil.jsx`** (EPI, Departamental, General) eran el mismo archivo copiado
  tres veces. Ahora son envoltorios finos sobre **`ui/PerfilInstitucional.jsx`**. Se
  eliminaron el kicker en mayúsculas sobre el título, el meta con punto medio, los
  gradientes decorativos (`from-emerald-800`, `from-slate-950 via-slate-900 to-amber-950`),
  `rounded-t-3xl` y los chips con `backdrop-blur`.

### Pendiente de rediseño profundo (actualizado: ver 0.3)

El barrido alcanzó a las 23 vistas, pero el cuerpo de estas todavía no pasó por una
reescritura estructural: `OficialesEpi`, `Plantillas`, `Notificaciones` (×3),
`RevisarDocumentos` (cuerpo), `Observaciones`, `DocumentosPorEpi`, `DesempenioEpis`,
`GestionSecretarios`, `RegistroDocumental`, `GestionUsuarios`, `Auditoria`,
`ComparativoGeneral`, `DirectorioInstitucional`, `RegistroOficialesIA`,
`GestionTiposMemo`, `DocumentosAprobados`, `RegistroOficial` (×2).

---

## 0.1 Reestructuración del cuerpo de SubirDocumento y Correcciones

Las dos vistas más usadas por el Secretario EPI. No se cambió comportamiento:
solo la estructura de la información y las clases, sobre las primitivas del sistema.

### `secretario_unidad/SubirDocumento.jsx`

| Antes | Ahora |
|---|---|
| Encabezado genérico repetido 5 veces (`text-sm font-bold text-slate-900` + `ofbol-step`) | Componente local `Bloque` (paso + `ofbol-titulo-seccion` + metadato a la derecha) |
| Modal de confirmación hecho a mano (`fixed inset-0`, `bg-white rounded-2xl`) | `ui/Modal` compartido (una sola superficie flotante en todo el sistema) |
| Pantalla de éxito con `bg-emerald-100`, `shadow-lg`, `animate-pulse` | Panel con tokens institucionales, `ofbol-page-enter` y sin parpadeo |
| 5 inputs con `bg-slate-50 border … focus-visible:ring-emerald-500` | `.ofbol-input` (un solo estilo de campo en el sistema) |
| Badges de categoría en `blue` / `purple` / `amber` de Tailwind | `ofbol-badge--teal` / `--amber` / `--olive` |
| Lista de oficiales vacía como párrafo de texto | `EstadoVacio` (mismo estado vacío que el resto) |
| Card de previsualización con header a mano | `SeccionPanel` + `EstadoVacio` |
| Botones de tipo con `shadow-md` al seleccionar | Relleno plano (borde o sombra, no ambos) |

### `secretario_unidad/Correcciones.jsx`

- Cabecera reestructurada: fuera el kicker en mayúsculas y el meta con punto medio;
  el h1 pasa a `.ofbol-display` y la nota a `.ofbol-nota`. La marca «Subsanación
  obligatoria» pasa a insignia junto a «Actualizar».
- Las 4 tarjetas de resumen ahora usan `KpiPanel` con `ACENTOS` (la misma pieza
  que los dashboards), en vez de markup propio.
- `hover:shadow-md` en las tarjetas eliminado (el borde ya comunica la elevación).
- `rounded-2xl` → `rounded-[14px]` en toda la vista; el modal dejó `shadow-2xl`
  apilado sobre borde y usa `.ofbol-elevated`.

### Verificación

`npm run build` verde (exit 0) tras cada paso. Sin `rounded-2xl`, `rounded-3xl`,
`hover:shadow` ni `animate-pulse` en ninguna de las dos vistas.

---

## 0. Identidad sonora del sistema + componentes compartidos

Referencias aplicadas: `frontend-design` (Anthropic), `apple-design-skill` (HIG),
`styles.refero.design`, y las skills ya instaladas (`craft`, `impeccable`, `accessibility`).

### Identidad sonora (`resources/js/lib/sounds.js`)

El sonido dejó de ser un click pegado a cada botón. Ahora hay **una señal por evento**,
sintetizada (Web Audio, cero archivos y cero peticiones):

| Evento | Sonido | Se dispara en |
|---|---|---|
| `notificacion()` | campana de dos notas ascendentes | toasts informativos / llegadas del sondeo en vivo |
| `enviar()` | barrido ascendente | al remitir un formulario (evento `submit`, no el botón) |
| `exito()` | arpegio mayor que resuelve | confirmaciones (aprobado, registrado, guardado) |
| `advertencia()` | dos pulsos iguales | validación y sesión vencida (401/422) |
| `error()` | dos notas descendentes | caída real de conexión o error de servidor |

Detalles de oficio: **un solo `AudioContext`** para toda la sesión (antes se creaba
uno por sonido y el navegador los bloqueaba), **desbloqueo con el primer gesto real**
(política de autoplay), **anti-ráfaga** de 90 ms por evento, **preferencia de silencio
persistida** (`localStorage`) y arranque silenciado si el sistema pide
`prefers-reduced-motion`.

Cableado centralizado en los puntos por donde pasa lo importante, no en los botones:
`lib/api.js` (fallos), `ui/ToastEnVivo.jsx` (por tipo de aviso) y `ui/ErrorBoundary.jsx`.
Se eliminó el listener global de `app.jsx` que hacía sonar **todos** los botones.

### Componentes compartidos

- **`ui/Modal.jsx`** rediseñado con la identidad institucional (`.ofbol-elevated`,
foco y velo propios, entrada `ofbol-animate-scale-in`, `isolation: isolate`). Como lo
usan casi todas las vistas, la mejora es transversal.
- **`ui/ConfirmDialog.jsx`** nuevo: confirmación diseñada + hook `useConfirmar()`
(promesa). Reemplaza los `window.confirm()` en `DocumentosAprobados`, `RevisarDocumentos`
y `RegistroOficialesIA`; los `alert()` de validación pasaron a los avisos del sistema.
- **`.ofbol-btn-danger`** añadido para la acción destructiva de una confirmación.

### Bugs de diseño corregidos

- `ToastEnVivo`: los tipos `error` y `warning` **no existían** en el mapa de color, así
que los avisos de error y las advertencias caían al estilo oliva genérico. Ahora hay
carmesí para error y ámbar para advertencia (y cada uno suena distinto).
- `ErrorBoundary`: usaba la paleta genérica (`bg-white`, `rounded-2xl`, `shadow-sm`,
`ring-emerald-500`); quedó sobre los tokens institucionales.
- `login/Login.jsx`: se quitó el kicker en mayúsculas sobre el título (prohibición
explícita del propio sistema de diseño).

### Verificación

`npm run build` verde. Sin `window.confirm`/`alert` nativos en el proyecto
(solo la mención en la documentación del componente).

---

## 1. Reorganización Arquitectónica (Mínima)

### Nueva carpeta `resources/views/login/`
- Movidos: `Login.jsx`, `RegistroOficial.jsx` (registro público)
- Actualizados imports en `resources/js/app.jsx`
- Organiza autenticación e inicio de sesión/registro en un solo lugar

### Nueva carpeta `resources/views/sistema_experto/`
- `README.md`: Documentación completa del Sistema Experto, parámetros para LM Studio, rutas API y archivos relacionados
- `ia.config.php`: Copia de configuración `config/ia.php` para referencia rápida
