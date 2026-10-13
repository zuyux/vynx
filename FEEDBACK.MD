---
proyecto: "Vynx"
version: 1
fecha: 2026-10-13
evento: "Colosseum Crypto World's Fair 2026 · Track Superteam Argentina"
deadline: 2026-10-11T23:59:00-03:00
fuente: Devolución de Superteam Argentina (misma evaluación que el PDF)
---

# Vynx · Accionables para tu agente de código

> Pegá este archivo en tu agente (Claude Code, Cursor, Codex…) como contexto. Pedile que trabaje las tareas en orden de prioridad, una por vez, que no invente datos ni métricas, y que al terminar cada una muestre cómo se cumple su criterio de aceptación.

## Contexto

**Qué es:** Una plataforma para creadores en Solana que junta identidad, contenido y pagos en un perfil compartible: alias único, página con links y ofertas, propinas en USDC o SOL, sesiones de video pagas y ofertas mensuales.

**Qué encontró la evaluación:** La idea se entiende en una lectura y apunta a un problema real: el creador reparte su link en bio, sus propinas, su agenda paga y sus suscripciones entre varias herramientas. Pero hoy no hay nada que un jurado o un inversor pueda ver: no hay repo, pitch, demo, equipo ni modelo de negocio cargados, y la categoría tiene varios proyectos casi idénticos que no quedaron premiados en Colosseum. La palanca más grande: mostrar en un demo en devnet una propina y una sesión paga de punta a punta, y elegir un ángulo propio (fans sin cripto pagando con tarjeta y el creador recibiendo USDC, con un solo historial por fan).

**Solana hoy:** No verificable. La aplicación dice que Vynx está construido sobre Solana y se prueba en devnet, con propinas en USDC o SOL, pero no hay repo, demo, program id, direcciones ni transacciones. Tampoco se sabe si hay un programa propio (por ejemplo, escrow para sesiones) o solo transferencias desde el cliente. Para un jurado, hoy equivale a no tener Solana en el producto.

**Elegibilidad:** Para ser considerados elegibles en el track de Solana tienen que tener Solana funcionando en el producto y visible en la demo (una transacción real en devnet o mainnet, con el explorer). La aplicación dice que Vynx se prueba en devnet, pero no hay repo, demo ni direcciones para verlo.

## Requisitos del domingo 11/10, 23:59 (hora Argentina)

- [ ] Todos los integrantes registrados en Colosseum (https://arena.colosseum.org), con Argentina como país.
- [ ] Solana integrado, al menos en devnet.
- [ ] El uso de Solana visible en el código del repositorio (programa, llamadas al SDK o direcciones).
- [ ] Si el repositorio es privado: compartido con hackathon@superteam.ar y hackathon@colosseum.com como colaboradores en GitHub.
- [ ] Entrega hecha en Colosseum y en el track de Superteam Earn (https://superteam.fun/earn/listing/colosseum-crypto-worlds-fair-hackathon-superteam-argentina-track).
- [ ] Pitch de hasta 2:00 y demo de hasta 3:00, ambos en inglés.

Lo que vimos en su entrega:

- ❌ **Pitch video ≤2:00**: No hay link de pitch en la aplicación.
- ❌ **Demo ≤3:00**: No hay link de demo en la aplicación.
- ⚠️ **Nombre y descripción**: Nombre y descripción en inglés están; falta el one-liner.
- ❌ **Logo**: El campo está vacío.
- ❌ **Blockchains y herramientas**: El campo de stack está vacío; sumar Solana, Anchor, USDC/SPL, Solana Pay y el resto.
- ❌ **Repo de GitHub accesible para el jurado**: No hay URL de repo en la aplicación.
- ❌ **Go-to-market y validación**: El campo está vacío; no hay modelo de cobro ni evidencia de creadores.
- ❌ **Equipo con experiencia y ubicación Argentina**: Los campos de equipo y ciudad están vacíos.
- ⚠️ **Todo en inglés**: La descripción está en inglés; el README, el pitch y el demo también tienen que estarlo.
- ❌ **Cada integrante registrado en Colosseum con país Argentina y proyecto con ubicación Argentina**: No hay link de Colosseum en la aplicación.
- ❌ **Envío en Superteam Earn**: La entrega de esta edición cerró el 13/10 a las 03:59 ART; para la próxima convocatoria, tener pitch, demo y repo listos antes.

Para que la integración con Solana sea central:

- Publicar el repo con el program id o las direcciones en devnet y su link al explorer en el README.
- Mostrar en la demo una propina en USDC llegando a la wallet del creador, con la transacción en el explorer.
- Implementar el escrow de sesiones pagas como programa Anchor y mostrar la reserva y la liberación del pago.
- Agregar un Blink o un QR de Solana Pay para dejar una propina desde un post en X.

## Accionables

### 1. [P0] Publicar el repo

- **Prioridad:** P0 · primero · **Cuándo:** esta semana · **Esfuerzo:** S
- **Objetivo:** Publicar el repo.
- **Por qué:** La aplicación no trae repo: sin código no hay nada que evaluar. Hecho cuando la URL está en la aplicación y se abre desde una cuenta sin permisos de ustedes.
- **Criterio de aceptación:** Hecho cuando la URL está en la aplicación y se abre desde una cuenta sin permisos de ustedes.
- **Pasos:**
  1. Hacer el repo público en GitHub, o darle acceso de lectura a las cuentas de revisión que indica superteam.ar/colosseum.
  2. Antes, revisar el historial con gitleaks o git log -p para que no haya .env, keypairs ni claves de APIs.
  3. Pegar la URL en la aplicación del capítulo y en el perfil del proyecto en Colosseum.
  4. Pedirle a otra persona que lo abra en una ventana de incógnito.

### 2. [P0] Hacer funcionar Solana y mostrarlo en la demo

- **Prioridad:** P0 · primero · **Cuándo:** esta semana · **Esfuerzo:** M
- **Objetivo:** Hacer funcionar Solana y mostrarlo en la demo.
- **Por qué:** Para ser elegibles en un track de Solana, Solana tiene que funcionar en el producto y verse en la demo con una transacción real en devnet o mainnet. Hecho cuando el README tiene el program id o las direcciones en devnet y la demo muestra una propina y una sesión paga con las transacciones en el explorer.
- **Criterio de aceptación:** Hecho cuando el README tiene el program id o las direcciones en devnet y la demo muestra una propina y una sesión paga con las transacciones en el explorer.
- **Pasos:**
  1. Propina: transferencia de USDC devnet (mint de prueba) desde la wallet del fan a la del creador, usando Solana Pay o @solana/kit.
  2. Sesión: programa Anchor con una PDA de escrow por reserva; anchor deploy --provider.cluster devnet y copiar el program id al README.
  3. Abrir cada firma en explorer.solana.com con ?cluster=devnet.
  4. Rotular en pantalla lo que todavía está simulado.

### 3. [P0] Grabar y subir el demo

- **Prioridad:** P0 · primero · **Cuándo:** esta semana · **Esfuerzo:** M
- **Objetivo:** Grabar y subir el demo.
- **Por qué:** No hay demo. Hecho cuando hay un video público de hasta 3:00 en inglés con el recorrido completo y el explorer visible, linkeado en la aplicación.
- **Criterio de aceptación:** Hecho cuando hay un video público de hasta 3:00 en inglés con el recorrido completo y el explorer visible, linkeado en la aplicación.
- **Pasos:**
  1. Guion: usuario y tarea en 10 s → el creador publica una sesión → el fan deja una propina y reserva → el creador recibe el USDC.
  2. Grabar con OBS o Loom, mostrando la wallet y el explorer.
  3. Subir a YouTube (no listado) o Loom y probar el link en incógnito.
  4. Pegar el link en la aplicación y en el perfil de Colosseum.

### 4. [P0] Grabar el pitch de 2:00

- **Prioridad:** P0 · primero · **Cuándo:** esta semana · **Esfuerzo:** S
- **Objetivo:** Grabar el pitch de 2:00.
- **Por qué:** No hay pitch. Hecho cuando hay un video público de hasta 2:00 en inglés que cubre problema, insight, producto, evidencia, segmento y precio, equipo y próximo hito.
- **Criterio de aceptación:** Hecho cuando hay un video público de hasta 2:00 en inglés que cubre problema, insight, producto, evidencia, segmento y precio, equipo y próximo hito.
- **Pasos:**
  1. Usar la estructura sugerida en este informe, con el nicho y los números de ustedes.
  2. Incluir 10–15 s del producto real (la propina o la reserva en devnet).
  3. Ensayar con cronómetro y cortar hasta que entre en 2:00.
  4. Subirlo y pegar el link en la aplicación.

### 5. [P0] Completar la aplicación

- **Prioridad:** P0 · primero · **Cuándo:** hoy · **Esfuerzo:** S
- **Objetivo:** Completar la aplicación.
- **Por qué:** Faltan one-liner, stack, go-to-market, equipo, ciudad, logo y link de Colosseum. Hecho cuando todos los campos están completos y en inglés.
- **Criterio de aceptación:** Hecho cuando todos los campos están completos y en inglés.
- **Pasos:**
  1. One-liner: usar el sugerido en este informe o uno propio de una frase.
  2. Equipo: nombre o handle, rol y una línea de experiencia de cada integrante.
  3. Stack: Solana, Anchor, SPL/USDC, Solana Pay, framework web, wallet adapter.
  4. Subir el logo y completar ciudad y link de Colosseum.

### 6. [P1] Definir cómo gana plata Vynx

- **Prioridad:** P1 · esta semana · **Cuándo:** esta semana · **Esfuerzo:** S
- **Objetivo:** Definir cómo gana plata Vynx.
- **Por qué:** Hoy no hay modelo de negocio. Hecho cuando la aplicación y el pitch dicen quién paga, cuánto y sobre qué, con un ejemplo numérico.
- **Criterio de aceptación:** Hecho cuando la aplicación y el pitch dicen quién paga, cuánto y sobre qué, con un ejemplo numérico.
- **Pasos:**
  1. Elegir la base: comisión por pago (por ejemplo, 3–5% en sesiones y ofertas, 0–2% en propinas).
  2. Escribir el ejemplo: una sesión de 30 USD deja X USD a Vynx y Y USD al creador al instante.
  3. Comparar en una línea contra lo que paga hoy el creador en su herramienta actual.
  4. Cargarlo en el campo de go-to-market.

### 7. [P1] Elegir un nicho y un ángulo propio

- **Prioridad:** P1 · esta semana · **Cuándo:** esta semana · **Esfuerzo:** S
- **Objetivo:** Elegir un nicho y un ángulo propio.
- **Por qué:** Varios proyectos de páginas de propinas y llamadas pagas no prosperaron en Colosseum. Hecho cuando el pitch y la aplicación nombran el creador objetivo (por ejemplo, profesores o coaches de LatAm con alumnos del exterior) y el diferencial (fan sin cripto, creador en USDC, un historial por fan).
- **Criterio de aceptación:** Hecho cuando el pitch y la aplicación nombran el creador objetivo (por ejemplo, profesores o coaches de LatAm con alumnos del exterior) y el diferencial (fan sin cripto, creador en USDC, un historial por fan).
- **Pasos:**
  1. Elegir un nicho donde la sesión paga sea el ingreso principal.
  2. Escribir el posicionamiento en una frase y usarlo en la aplicación, el README y el pitch.
  3. Revisar en colosseum.com/copilot los proyectos parecidos y anotar qué hacen ustedes distinto.

### 8. [P1] Resolver el pago de fans sin cripto

- **Prioridad:** P1 · esta semana · **Cuándo:** después del hackathon · **Esfuerzo:** M
- **Objetivo:** Resolver el pago de fans sin cripto.
- **Por qué:** Es la pregunta que va a hacer cualquier jurado. Hecho cuando la demo muestra un pago con tarjeta u onramp que llega como USDC al creador, o el pitch explica con honestidad el plan.
- **Criterio de aceptación:** Hecho cuando la demo muestra un pago con tarjeta u onramp que llega como USDC al creador, o el pitch explica con honestidad el plan.
- **Pasos:**
  1. Evaluar proveedores de onramp o pago con tarjeta que liquiden en USDC sobre Solana.
  2. Integrarlo en sandbox y grabar el flujo.
  3. Rotular en la demo qué es sandbox.

### 9. [P1] Escribir el README en inglés

- **Prioridad:** P1 · esta semana · **Cuándo:** esta semana · **Esfuerzo:** S
- **Objetivo:** Escribir el README en inglés.
- **Por qué:** Un jurado o un revisor con IA tiene que entender el proyecto en un minuto. Hecho cuando el README tiene problema → solución → cómo usa Solana → cómo correrlo → program id y links.
- **Criterio de aceptación:** Hecho cuando el README tiene problema → solución → cómo usa Solana → cómo correrlo → program id y links.
- **Pasos:**
  1. Secciones: Problem, Solution, How it uses Solana, Architecture, Run locally, Program ID (devnet), Demo.
  2. Diagrama simple: perfil → alias → pago del fan → escrow o transferencia → creador.
  3. Listar qué funciona y qué es roadmap (por ejemplo, ofertas mensuales).
  4. Explicar qué es el alias: .sol, PDA propia o base de datos.

### 10. [P1] Conseguir los primeros creadores

- **Prioridad:** P1 · esta semana · **Cuándo:** después del hackathon · **Esfuerzo:** M
- **Objetivo:** Conseguir los primeros creadores.
- **Por qué:** No hay evidencia de uso. Hecho cuando al menos 3 creadores del nicho armaron su perfil y recibieron un pago de prueba, y hay notas de lo que dijeron.
- **Criterio de aceptación:** Hecho cuando al menos 3 creadores del nicho armaron su perfil y recibieron un pago de prueba, y hay notas de lo que dijeron.
- **Pasos:**
  1. Listar 10 creadores del nicho y escribirles con el demo.
  2. Acompañar a los primeros 3 a armar su perfil en devnet.
  3. Anotar qué les gustó, qué no y cuánto cobran hoy por mes.
  4. Usarlo como evidencia rotulada en el pitch.

### 11. [P1] Anticipar las preguntas legales

- **Prioridad:** P1 · esta semana · **Cuándo:** después del hackathon · **Esfuerzo:** S
- **Objetivo:** Anticipar las preguntas legales.
- **Por qué:** Custodia, reembolsos y datos personales van a aparecer en preguntas de jurados e inversores. Hecho cuando hay términos con política de reembolso y una frase sobre custodia en el README.
- **Criterio de aceptación:** Hecho cuando hay términos con política de reembolso y una frase sobre custodia en el README.
- **Pasos:**
  1. Documentar que el escrow no es custodial y quién tiene la upgrade authority.
  2. Publicar términos con reembolso y cancelación de sesiones y ofertas mensuales.
  3. No guardar datos personales on-chain y publicar una política de privacidad.
  4. Agendar una consulta con un abogado antes de mainnet.

### 12. [P2] Lanzar en mainnet con un nicho

- **Prioridad:** P2 · después · **Cuándo:** después del hackathon · **Esfuerzo:** L
- **Objetivo:** Lanzar en mainnet con un nicho.
- **Por qué:** El siguiente escalón es uso real. Hecho cuando 10 creadores cobran en mainnet y hay métricas de pagos y retención por mes.
- **Criterio de aceptación:** Hecho cuando 10 creadores cobran en mainnet y hay métricas de pagos y retención por mes.
- **Pasos:**
  1. Auditoría o revisión externa del programa de escrow antes de mainnet.
  2. Lanzar con los creadores que probaron en devnet.
  3. Medir pagos por creador, ticket promedio y retención a 30 y 90 días.

### 13. [P2] Construir el historial por fan

- **Prioridad:** P2 · después · **Cuándo:** después del hackathon · **Esfuerzo:** M
- **Objetivo:** Construir el historial por fan.
- **Por qué:** Es el diferencial que ningún proyecto previo mostró. Hecho cuando el creador ve en un panel todo lo que cada fan pagó (propinas, sesiones, ofertas) y puede hacerle una oferta.
- **Criterio de aceptación:** Hecho cuando el creador ve en un panel todo lo que cada fan pagó (propinas, sesiones, ofertas) y puede hacerle una oferta.
- **Pasos:**
  1. Indexar los pagos por wallet del fan.
  2. Panel con el historial por fan y los que más pagaron.
  3. Una acción simple: cupón u oferta para los fans más fieles.

## Pitch

- **Pitch:** No pudimos medir la duración. Verificá que el video se pueda abrir sin login y que dure como máximo 2:00.
- **Demo:** No pudimos medir la duración. Verificá que el video se pueda abrir sin login y que dure como máximo 3:00.
- La evaluación automática penaliza pasarse del tiempo. Si faltan segundos: subtitular, acelerar a 1.1x y quitar pausas con un editor (CapCut, Descript).

**Qué ajustar:** No pudimos ver el pitch ni el demo: los dos campos están vacíos en la aplicación. La descripción escrita deja claro el producto, pero no dice qué creador lo usa, qué problema concreto tiene hoy, cómo gana plata Vynx ni quiénes son ustedes, y eso es lo que el pitch tiene que explicar en una pasada. El demo tiene que presentar en 10 s al usuario y la tarea, después el recorrido entrada → acción → resultado (el fan entra al perfil → deja una propina o reserva una sesión → el creador recibe el pago), con la transacción en el explorer y rotulando qué es devnet y qué está simulado, sin recorrer pantallas de configuración.

- **Qué vendemos:** Un perfil de creador donde cualquier fan puede dejar propinas, reservar sesiones de video pagas y suscribirse, y el creador cobra en USDC al instante.
- **Para quién:** Quien paga: creadores y expertos independientes (coaches, profesores, músicos, streamers), empezando por LatAm. Quien usa además: sus fans, que pagan como quieran.
- **Por qué ahora:** Los stablecoins en Solana permiten cobrar dólares al instante y con costo de red mínimo, y los creadores de la región buscan cobrar en dólares a audiencias globales sin perder margen en comisiones y conversiones.

Estructura sugerida:

1. 0:00–0:15 Problema: «Un creador que da clases, coaching o hace streaming usa Linktree para los links, Cafecito o Ko-fi para propinas, Calendly más una transferencia para las sesiones y Patreon para la suscripción. Cada fan queda repartido en cuatro herramientas, y cobrar a fans del exterior le cuesta comisiones y días.»
2. 0:15–0:30 Insight: «Lo que el creador necesita no es otra página: es un solo lugar donde cobra en dólares a cualquier fan y ve todo lo que ese fan le pagó. Las páginas de propinas cripto fallaron porque le pedían al fan una wallet.»
3. 0:30–1:00 Producto: «Vynx es un perfil con tu alias: el fan deja una propina, reserva una sesión o se suscribe, paga como quiera, y vos recibís USDC al instante en Solana.» Mostrar la página, una propina y la reserva de una sesión en devnet, con el explorer.
4. 1:00–1:15 Evidencia: lo que haya, rotulado con honestidad: «N creadores probando en devnet», una conversación con fecha, o «todavía no tenemos creadores activos; los primeros diez los buscamos en…».
5. 1:15–1:35 Segmento y precio: «Empezamos con creadores y expertos de LatAm que cobran a fans del exterior. Cobramos X% de cada pago (menos que Patreon o las pasarelas tradicionales) y nada por la página.»
6. 1:35–1:50 Equipo: «Somos [nombres], [roles]; [experiencia concreta como creadores, en pagos o en Solana].»
7. 1:50–2:00 Próximo hito: «Diez creadores cobrando sesiones reales en mainnet antes de [fecha].»

## Recursos

- [Perfecting your hackathon submission](https://blog.colosseum.com/perfecting-your-hackathon-submission/): Qué espera el jurado del pitch, del demo y del repo.
- [Guía del builder de Superteam Argentina](https://superteam.ar/stack): Herramientas y pasos para construir en Solana.
- [Solana Pay](https://docs.solanapay.com): Propinas y pagos con QR o link, en USDC.
- [Solana Actions y Blinks](https://solana.com/docs/advanced/actions): Dejar una propina o reservar una sesión desde un post en X.
- [Anchor](https://www.anchor-lang.com/docs): Programa de escrow para las sesiones pagas con PDAs y tests.
- [Colosseum Copilot](https://colosseum.com/copilot): Revisar los proyectos de creadores y pagos que se presentaron antes y afinar el ángulo.
- [Recursos para founders de Superteam Argentina](https://superteam.ar/recursos): Guías de pitch, Solana, perfil público y la autoevaluación.
- [Office hours de Superteam Argentina](https://t.me/superteamar): Pedí un turno por Telegram.