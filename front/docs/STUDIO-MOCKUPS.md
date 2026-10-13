# Vynx Studio: mockup del roadmap

Ruta: `/dashboard/studio`. Acceso desde “Studio demo” en el dashboard.

Todas las personas, ofertas y operaciones son ejemplos. Demo 1 puede guardar reservas ilustrativas cuando se habilita explícitamente. El prototipo no conecta una wallet, cobra, sube archivos ni habilita contenido real. El MVP de patrocinios existente sigue disponible por separado.

## Pantallas incluidas

- Creator card: retrato, identidad, ofertas y enlaces.
- Productos: formulario de publicación, selección local de archivo, precio, checkout y biblioteca del comprador con entrega bloqueada o habilitada.
- Reservas: día, horario y zona horaria, precio de sesión, checkout, reservas persistentes opcionales de Demo 1 y sala de videollamada ilustrativa.
- Contenido privado: regla NFT o saldo de token, estado autorizado y denegado. No se realiza verificación real.
- Pagos: resumen de importe y red, preparación, firma, confirmación y entrega. Confirmación simulada.
- Suscripciones: plan mensual, beneficios, estado de membresía y cancelación simulada. Renovación manual propuesta, sin débitos automáticos.
- Mainnet: checklist de planificación, sin cambio de red.

## Mejoras propuestas para implementación

1. Archivos privados con enlaces temporales, límites de tamaño y validación de formato en servidor.
2. Reservas con disponibilidad real, bloqueo temporal durante checkout, zonas horarias y política de cancelación.
3. Sala de video accesible únicamente para participantes autorizados durante el período de reserva.
4. Reglas NFT/token verificadas en servidor antes de entregar el recurso protegido.
5. Pagos idempotentes, recibo verificable y recuperación de transacciones pendientes.
6. Membresías con fecha de vencimiento, recordatorios y renovación explícita con wallet.

Estas son propuestas, no capacidades implementadas. La estética usa superficies oscuras, lavanda y botones violeta, manteniendo la identidad de la landing.

## Demo 1: persistent reservations

Apply `supabase/migrations/018_demo_bookings.sql` and explicitly set
`VYNX_DEMO_BOOKINGS_ENABLED=true` to enable `/api/demo/bookings` and the Studio
Bookings form. Disabled deployments return 404. A wallet application session is
required to reserve; the reservation never prepares a payment or grants video access.

The single offer is Luna's Creative session: 30 minutes, illustrative 35 USDC,
daily 15:00–18:00 in America/Argentina/Buenos_Aires, within the next 14 days.
Bookings persist in `demo_call_bookings`, independently of devnet escrow.
PostgreSQL timestamptz columns preserve UTC instants. Terms snapshot the policy,
price, duration, creator timezone, selected viewer timezone and acceptance instant.

Clients send a UUID `request_id` and preserve it when retrying an uncertain request.
The same payer/key returns the original record, including after the slot has passed;
changing its slot or timezone returns 409. A creator transaction lock serializes
reservations and a database exclusion constraint prevents overlapping intervals.
Adjacent sessions are allowed. Demo reservations remain reserved until their end;
there is no checkout hold, cancellation or payment expiry in this demo.

Run `npm run test:security:db` for snapshot, permissions, atomic overlap and
concurrent retry checks, and `npx tsx --test tests/demo-bookings-api.test.mjs`
for API opt-in, session, origin, acceptance and validation checks.
