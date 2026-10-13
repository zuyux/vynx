# Vynx — respuesta a la devolución de Superteam Argentina

Fecha: 13 de octubre de 2026. Documento de respuesta a [FEEDBACK.MD](FEEDBACK.MD), basado en el repositorio y sus registros de verificación disponibles a esta fecha.

Gracias por la devolución. Compartimos la necesidad de demostrar el producto con evidencia accesible, definir mejor el segmento inicial y validar el negocio con creadores. Sin embargo, varias conclusiones parten de campos vacíos en la ficha de evaluación y no reflejan los materiales y las implementaciones que tenemos. Pedimos revisar esas conclusiones con los enlaces y evidencias siguientes, manteniendo abiertas las críticas que todavía corresponden.

## 1. Materiales y entrega que pedimos revisar

- Sitio público: <https://vynx.me>.
- Repositorio público: <https://github.com/zuyux/vynx>.
- Entrega en Colosseum: <https://colosseum.com/arena/projects/17501/submission>.
- Pitch y demo: el equipo confirma que están publicados y enviados en esa entrega. No verificamos aquí sus enlaces directos, duración, idioma ni acceso sin sesión; corresponde aportar esos enlaces para cerrar la comprobación.
- Logo: existen activos en `front/public/logo.svg` y `front/public/logo.png`. Esto acredita que tenemos identidad visual, aunque no prueba que el campo del formulario se haya completado.
- Equipo: somos tres integrantes; dos son argentinos residentes en Argentina, según lo informado por el equipo. Falta documentar nombres, roles, experiencia, ubicación y registros individuales para comprobar la elegibilidad.

La ausencia de un enlace en el intake no equivale a la ausencia del material. Es posible que haya habido una omisión al cargar el formulario o un problema al asociar los enlaces; no tenemos evidencia para atribuir la causa. Solicitamos contrastar la ficha evaluada con la entrega de Colosseum.

Tampoco afirmamos que la entrega en Colosseum resuelva por sí sola la elegibilidad del track. Las [bases de Superteam Argentina](https://superteam.ar/colosseum) requieren entregas en Colosseum y Superteam Earn, además de condiciones de ubicación y registro. No contamos aquí con comprobante de envío en Earn ni confirmación de elegibilidad del tercer integrante. Pedimos aclarar ambos puntos y si existe posibilidad de subsanar una omisión.

Las fechas del feedback también requieren aclaración: menciona el 11/10 y el cierre del 13/10 a las 03:59 ART; la página del track distingue el cierre regional del 12/10 a las 23:59 ART del cierre global del 13/10 a las 03:59 ART. No afirmamos cumplimiento del plazo sin el comprobante correspondiente.

## 2. Solana es parte del producto y tiene evidencia en devnet

La afirmación de que Solana es solamente una línea en la descripción debe revisarse. Tenemos programas Anchor propios, integración de wallets, verificación de transacciones y evidencia registrada de operaciones en devnet. Los tokens de prueba no representan ingresos ni pagos comerciales.

| Componente | Qué tenemos | Evidencia y límite |
| --- | --- | --- |
| Identidad y alias | Registro propio mediante PDAs, un alias por wallet, precios configurables en SOL y registro patrocinado. Supabase indexa perfiles; no sustituye la propiedad on-chain. | [Documentación del programa](chain/README.md), [despliegue](chain/devnet-deployment.json) y [prueba de registro](chain/devnet-smoke.json). No es un dominio SNS `.sol`. |
| Propinas SOL/USDC | Construcción y verificación server-side del pago, confirmaciones idempotentes y totales separados por moneda. Kora patrocina comisiones de red y creación de la cuenta de tokens para USDC. | [Integración Kora](docs/kora-usdc-tips.md) y [prueba alojada del 10/10](docs/kora-vercel-smoke.json): 0,01 USDC devnet, fan con cero SOL y confirmación API exitosa. Esto no habilita pagos con tarjeta. |
| Reservas y escrow | Programa separado con recibo permanente por reserva, financiación atómica en USDC, reembolsos, disputas y asignación controlada por un resolver. Checkout de desarrollo y restricciones de agenda implementados. | [Implementación y límites](docs/custom-booking-escrow.md), [prueba de financiación y reembolso](chain/booking-devnet-funding-smoke.json) y [tests del programa](chain/tests/booking.test.cjs). No está auditado ni habilita un lanzamiento comercial en mainnet. |
| Videollamadas | Integración Daily con salas privadas, tokens por participante y eventos autenticados de asistencia. | [Documentación](docs/private-calls.md) y [prueba alojada](docs/daily-vercel-smoke.json). Se usó una reserva sintética sin pago escrow; no demuestra una sesión paga completa ni una liberación por servicio cumplido. |
| Reseñas | Código, migración y pruebas de reseñas vinculadas a reservas completadas. | [Documentación](front/docs/call-reviews.md) y [pruebas](front/tests/call-reviews.test.mjs). La implementación no acredita reseñas de clientes reales ni adopción. |

Programas publicados:

- Alias: [`AxQxAgndT6ziUr3FBNafhJzF4PpniGpMX4fVRXXmh5y8`](https://explorer.solana.com/address/AxQxAgndT6ziUr3FBNafhJzF4PpniGpMX4fVRXXmh5y8?cluster=devnet).
- Reservas: [`B6FdE4aAcavkyh1u7UXadQXTQrGYmGWpPqKbfQ6sX7mY`](https://explorer.solana.com/address/B6FdE4aAcavkyh1u7UXadQXTQrGYmGWpPqKbfQ6sX7mY?cluster=devnet).

El escrow tiene evidencia de financiación y devolución de 0,01 USDC devnet. No presentamos esa devolución como evidencia de pago al creador después de una llamada. El resolver tiene autoridad de asignación y el programa es actualizable; debemos explicar estas facultades, no describir el sistema como una resolución sin confianza. El código permite una excepción explícita de hackathon para checkout alojado en devnet; esa excepción no equivale a aprobación para fondos reales.

## 3. Respuesta a los trece accionables

| Recomendación | Respuesta con lo que tenemos | Qué sí adoptaríamos y cómo comprobarlo |
| --- | --- | --- |
| 1. Publicar el repo | El repositorio público existe y el sitio lo enlaza. | Corregir o confirmar el enlace en cada formulario, verificar acceso sin sesión y mantener revisión del historial antes de nuevas publicaciones. No afirmamos haber realizado una auditoría de secretos en esta revisión. |
| 2. Hacer funcionar Solana y mostrarlo | Registro, propinas y escrow tienen implementación y evidencias devnet. | Reunir program IDs y transacciones en una sección visible; mostrar en video el pago y su resultado. Falta demostrar el recorrido completo de reserva, llamada y liquidación. |
| 3. Grabar/subir demo | El equipo confirma una demo enviada en Colosseum. | Entregar el enlace directo, comprobar acceso e idioma y duración máxima de 3 minutos. Revisar que muestre resultado y explorer, con rótulos de devnet y simulaciones. |
| 4. Grabar pitch | El equipo confirma un pitch enviado en Colosseum. | Comprobar enlace e idioma y máximo de 2 minutos; reforzar problema concreto, segmento, precio, equipo y siguiente hito sin inventar métricas. |
| 5. Completar aplicación | Tenemos sitio, código, logo y stack; esto no acredita que la ficha esté completa. | Consolidar una ficha en inglés con esos enlaces, one-liner, roles, experiencia, ubicaciones y go-to-market. Verificar Earn y elegibilidad por separado. |
| 6. Definir cómo gana dinero | Hay precios on-chain para adquisición de alias. No equivalen a un modelo completo de monetización de sesiones, suscripciones o propinas. | Definir quién paga y por qué, separar precio del alias, rent de cuentas, comisión de red y eventual comisión de plataforma. Publicar un ejemplo numérico tras decidir la política; no asumir el 3–5 % sugerido. |
| 7. Elegir nicho y diferencial | La Creator Card combina identidad propia y cobros en Solana; las llamadas privadas y reseñas aportan una línea de producto. No prueban diferenciación comercial ni demanda. | Probar como hipótesis un segmento de expertos/creadores de LatAm que monetizan tiempo y audiencias internacionales. Entrevistar usuarios y comparar sus alternativas antes de fijarlo como mercado validado. |
| 8. Fans sin cripto | El patrocinio permite una propina USDC sin saldo SOL, pero sigue requiriendo wallet y USDC. | Evaluar tarjeta/onramp como siguiente hipótesis de reducción de fricción. No prometer “paga como quiera” hasta verificar una integración completa, sus costos y disponibilidad. |
| 9. README en inglés | Existe README en inglés con stack, instalación, flujo y referencias técnicas. | Mejorar problema, solución, arquitectura y un índice de evidencia. Actualizar resumen y alcance: hay secciones antiguas que describen solo SOL o llamadas enteramente futuras, aunque ya existe implementación de desarrollo. |
| 10. Primeros creadores | Hay pruebas técnicas; el estudio con usuarios invitados registra cero participantes y está suspendido a pedido del equipo. | Adoptar validación con usuarios cuando se decida reactivar el estudio. Preparar una cohorte inicial de tres creadores, registrar tareas, dificultades y pagos de prueba consentidos. No presentar wallets de smoke tests como clientes. |
| 11. Preguntas legales | Existen páginas de términos/privacidad, límites documentados del escrow y controles de acceso. No equivalen a validación jurídica ni auditoría independiente. | Revisar políticas finales de cancelación, no-show, disputas, reembolsos y facultades de actualización/resolución antes de operar con fondos reales; explicar qué datos son públicos on-chain. |
| 12. Mainnet con un nicho | El alcance verificable es devnet; no tenemos evidencia de diez creadores cobrando en mainnet. | Mantenerlo como objetivo posterior, condicionado a auditoría, políticas, operación y validación. Medir pagos y retención cuando existan usuarios reales, sin fijar fechas comerciales no acordadas. |
| 13. Historial por fan | Existe actividad de propinas y registros de reservas; no acreditamos un historial unificado con segmentación y ofertas. | Adoptar una vista que reúna pagos y servicios por fan, respetando preferencias de privacidad. Priorizarla con entrevistas; no afirmar que sea un diferencial único sin comparación verificable. |

## 4. Críticas que consideramos válidas

**Necesitamos comunicar mejor la evidencia.** Si el evaluador recibió una ficha sin enlaces, el problema de presentación existe aunque los materiales estén publicados. Debemos facilitar la evaluación sin obligar a buscar entre documentos o plataformas.

**Necesitamos validación comercial.** Pruebas automatizadas, despliegues y transacciones devnet acreditan ejecución técnica dentro de su alcance. No demuestran tracción, disposición a pagar, retención ni ajuste producto–mercado. No usamos cifras del sitio como evidencia de adopción sin respaldos verificables.

**Necesitamos un modelo de negocio explícito.** El precio del alias aporta una fuente potencial de ingresos, pero falta explicar adquisición, frecuencia de uso, costos de operación y monetización de servicios. Las comisiones propuestas por el feedback son alternativas para evaluar, no decisiones tomadas.

**Necesitamos reducir fricción para fans.** Kora resuelve la necesidad de SOL para determinadas propinas; no resuelve acceso a USDC, creación de wallet o pago con tarjeta. Esa diferencia debe aparecer en el pitch y el sitio.

**Necesitamos cerrar el flujo de sesiones.** Reservas, escrow, video y reseñas tienen avances separados. La evidencia consultada no demuestra el circuito completo con una reserva real, asistencia, decisión de liquidación y pago al creador. También quedan pendientes operación duradera, recuperación del usuario, sincronización de estados y política final de resolución.

**Necesitamos alinear promesas y alcance.** Suscripciones, tienda digital, token gating, pagos con tarjeta y resolución automática de disputas no deben presentarse como capacidades comprobadas por la evidencia de este documento. La landing, el README y los videos deben distinguir funcionalidades disponibles, desarrollo devnet y roadmap.

## 5. Próximos pasos propuestos

Estas son propuestas para adoptar la crítica; este documento no ejecuta cambios de producto ni modifica entregas externas.

1. **Corregir la base de evaluación:** enviar a Superteam el enlace de Colosseum, sitio, repo y enlaces directos de los videos; pedir confirmación de asociación a la ficha y aclaración de Earn/elegibilidad.
2. **Publicar un paquete de evidencia:** índice con programas, transacciones, fecha, entorno y alcance de cada prueba; ajustar README y presentación para evitar afirmaciones desactualizadas.
3. **Demostrar el flujo de servicios:** completar y registrar una prueba integral devnet de reserva → financiación → llamada → resultado → liquidación/reembolso, mostrando límites y autoridades.
4. **Definir hipótesis comerciales:** seleccionar un segmento inicial, una política de precios y métricas de validación; separar supuestos de resultados observados.
5. **Validar con creadores cuando se reactive el estudio:** recoger evidencia real y decidir a partir de ella la prioridad de onramp e historial unificado.
6. **Preparar producción después de esa validación:** auditoría independiente, políticas finales y operación de los servicios externos antes de habilitar fondos reales.

## 6. Solicitud al equipo evaluador

Les pedimos revisar las conclusiones de “sin repo”, “sin sitio” y “Solana no verificable” con los materiales aportados, y contrastar el pitch y la demo con la entrega de Colosseum. También necesitamos confirmar el motivo exacto de exclusión y el tratamiento de nuestro equipo, compuesto por tres personas, dos de ellas argentinas residentes en Argentina.

Aceptamos que todavía debemos fortalecer nicho, modelo de negocio, validación con creadores y demostración integral de sesiones. Una evaluación actualizada debería distinguir esos pendientes de las funcionalidades y evidencias técnicas que ya existen. No solicitamos un puntaje específico ni afirmamos que la corrección de enlaces garantice elegibilidad.

## Alcance de esta revisión

Se revisaron archivos fuente, documentación y registros de verificaciones anteriores. No se ejecutaron nuevas transacciones, suites de tests, auditorías, modificaciones de formularios ni envíos de correo. Los registros enlazados acreditan lo que documentan en sus fechas; no garantizan disponibilidad actual de todos los servicios ni un despliegue comercial completo. Las afirmaciones sobre integrantes y videos provienen del equipo y están identificadas como tales.
