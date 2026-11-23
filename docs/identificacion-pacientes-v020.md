# Identificación de pacientes v0.2.0 — implementación 1.3C

## Estado de entrega

Implementación preparada en `feature/labzen-v020-pacientes`, desde `97e1d2274d0390fbbd91ff32c921b0100d527674`.
La identificación ampliada está **deshabilitada por defecto**. No se ejecutaron migraciones, consultas a bases reales, Docker, seeds ni despliegues.

El código conserva `Paciente.id` INT UNSIGNED, relaciones e índices existentes. El núcleo documental de 1.3A sigue siendo la única autoridad de normalización y validación documental del backend. No se infiere CC ni se generan documentos ficticios.

## Activación y compatibilidad

Variable exclusiva del backend: `PACIENTES_IDENTIFICACION_HABILITADA`. Solo acepta los textos `true` o `false`; el valor por defecto es `false`. No hay una bandera Vite independiente que pueda anunciar prematuramente el formulario nuevo.

| Estado | Consultas y escrituras | Interfaz |
| --- | --- | --- |
| Bandera ausente/false | Contratos antiguos con cédula. Selecciones explícitas de columnas antiguas, también en proyecciones clínicas. No consulta metadatos de identificación. | Formulario anterior de registro. |
| Bandera true, esquema pendiente | POST/PATCH documental rechazados con 503. Capacidad de registro false. | No anuncia identificación ampliada ni permite abrir registro. |
| Bandera true, esquema verificado | Nuevo objeto de identificación; cédula histórica permanece separada. | Registro nuevo y revisión desde ficha. |

`GET /api/pacientes/capacidades`, autenticado, devuelve:

```json
{ "data": { "identificacionPacientes": false, "registroPacientes": true } }
```

Al activar, el backend verifica columnas, nulabilidad de cédula/clave, ID y versión unsigned, collation binaria, índice único de una sola columna y tres CHECK ENFORCED por nombre. Si falla la consulta o faltan requisitos, devuelve capacidades false y rechaza escrituras documentales antes de comenzar la transacción. Esta comprobación estructural no sustituye revisar las expresiones CHECK, permisos de escritura ni las pruebas reales de MySQL.

Prisma actualizado puede consultar columnas nuevas por defecto aunque la bandera esté apagada. Por eso cada consulta de paciente usa una selección explícita. Los defaults nuevos de estado y versión se declaran `dbgenerated`, para que los INSERT antiguos no reciban valores literales nuevos materializados por Prisma. El cliente local se regeneró offline, sin cargar `.env`. La SQL efectivamente emitida por el motor contra un esquema antiguo todavía necesita ensayo MySQL; las pruebas offline comprueban los argumentos y metadatos del cliente.

Las correcciones de nacimiento, edad y contactos se aplican en ambos modos. PUT rechaza documentos en lugar de ignorarlos silenciosamente. Son cambios intencionados de reglas defectuosas, cubiertos por las pruebas de caracterización actualizadas.

## Contratos API

Todas las rutas mantienen autenticación y los permisos existentes. POST, PUT y PATCH: recepción y administración. Lecturas: roles actualmente autorizados a consultar pacientes. No se crearon roles ni permisos nuevos.

### Creación

Con bandera false permanece el POST antiguo (`cedula`, nombres, apellidos, fecha civil y sexo).
Con bandera true, POST `/api/pacientes` exige identificación y rechaza `cedula` u otros campos desconocidos:

```json
{
  "nombres": "Persona Sintética",
  "apellidos": "Paciente Prueba",
  "fechaNacimiento": "2020-02-29",
  "sexo": "O",
  "identificacion": {
    "estado": "DOCUMENTADO",
    "tipo": "PA",
    "numero": "ab001-X",
    "paisEmisor": "VE"
  }
}
```

Para CC, TI, RC, CE y PPT se omite país o se envía CO. El almacenamiento usa NULL para el país fijo; la respuesta pública muestra CO. Los límites del catálogo siguen siendo provisionales y no normas oficiales.

Identificación de un paciente sin documento:

```json
{
  "estado": "SIN_DOCUMENTO_ASIGNADO",
  "tipo": null,
  "numero": null,
  "paisEmisor": null,
  "motivoAusencia": "No tiene documento asignado todavía"
}
```

`DOCUMENTO_NO_DISPONIBLE` tiene la misma estructura, con motivo obligatorio. `LEGADO_POR_REVISAR` no se acepta en nuevas admisiones; procede de la migración y compatibilidad histórica.

El backend genera la clave interna y no admite claves del cliente. No intenta `findUnique` con NULL. La consulta previa de duplicado mejora el mensaje; la garantía final diseñada es UNIQUE. Un P2002 en el servicio se traduce a 409 `PACIENTE_DUPLICADO`.

### Lectura e históricos

En modo nuevo, cada paciente y sus proyecciones clínicas contienen `identificacion` pública y `versionIdentificacion`. No exponen `claveIdentificacion` ni columnas documentales internas. La proyección pública reutiliza el núcleo.

```json
{
  "identificacion": {
    "estado": "LEGADO_POR_REVISAR",
    "tipo": null,
    "numero": null,
    "paisEmisor": null,
    "valorLegado": "00ab-001"
  },
  "versionIdentificacion": 0
}
```

`valorLegado` solo aparece para legado, dentro de las lecturas autenticadas que ya permitían ver cédula. Tras confirmar identidad, el original permanece en BD pero la respuesta usa la identificación actual y `cedula: null`. Los lectores antiguos no deben interpretar ese NULL como un número de identificación.

No hay fusiones ni clasificación automática. La unicidad de la clave no detecta por sí sola coincidencias con históricos todavía sin clasificar: deben buscarse y revisarse antes de registrar de nuevo a la persona. No se bloquean automáticamente nombres similares.

### Edición explícita de identificación

PATCH `/api/pacientes/73/identificacion`:

```json
{
  "identificacion": { "estado": "DOCUMENTADO", "tipo": "TI", "numero": "00012345" },
  "motivoCambio": "Documento recibido y confirmado",
  "versionIdentificacion": 0
}
```

El servicio lee por ID y realiza `updateMany` condicionado por ID+versión, incrementando la versión. No actualiza cédula histórica, IDs ni asociaciones. Usa la misma transacción para cambio y auditoría; registra responsable, motivo, identificación anterior/nueva y versiones, sin claves internas.

- 400: identificación incoherente, motivo o versión inválidos.
- 401/403: autorización existente.
- 404: paciente inexistente.
- 409 `PACIENTE_DUPLICADO`: conflicto documental.
- 409 `VERSION_IDENTIFICACION_CONFLICTO`: versión antigua o actualización condicional perdida.
- 503: deshabilitado o esquema no verificado.

Una solicitud repetida con la versión anterior devuelve 409; no se implementa idempotencia automática. El formulario conserva valores y muestra el conflicto para recargar la ficha.

PUT `/api/pacientes/:id` sigue siendo demográfico y exige nombres, apellidos, fecha y sexo. Rechaza identificación, cédula y versión. Contactos: omitido conserva, NULL limpia, vacío tras trim limpia, texto válido actualiza. El frontend envía NULL al borrar un contacto.

### Búsquedas

- `GET /api/pacientes?q=...&page=1&pageSize=25`: nombre, apellido, documento normalizado o cédula histórica; conserva paginación.
- `GET /api/pacientes?tipoDocumento=PA&numeroDocumento=ab001-X&paisEmisorDocumento=VE`: búsqueda exacta normalizada. Sin país, un pasaporte puede devolver coincidencias de varios países; siempre se selecciona por ID.
- Solicitudes y muestras conservan el parámetro `cedula` como alias compatible; en modo activo busca también clave documental. La admisión sin documento continúa hacia solicitud y muestra desde la ficha por `pacienteId` y `solicitudId`, sin necesitar un documento.

## Fechas y edad civil

`backend/src/domain/fechaCivil.ts` es código puro compartido con frontend, sin Prisma ni dependencias externas. Vite permite expresamente importar solo el directorio de dominio; no se exponen configuraciones del backend.

Nacimiento: exclusivamente `YYYY-MM-DD`, fecha existente, desde 1900 hasta el día actual de Colombia. Rechaza NULL, fechas futuras, 30 de febrero e ISO con hora. Se persiste como medianoche UTC de la fecha civil; se muestra en UTC para evitar desplazar el día original.

Edad: referencia explícita civil; formularios/directorio usan el día de Colombia (`America/Bogota`). Muestras y resultados muestran **Edad a la toma**, calculada con el día de Colombia del instante de toma.

- Un año o más: años completos.
- Menos de un año y al menos un mes: meses completos.
- Menos de un mes: días civiles completos.
- Mismo día: 0 días. Dato inválido o referencia anterior: `—`, nunca NaN ni valor negativo.
- Aniversario estricto: 29-feb cumple el 1-mar en año no bisiesto; un mes completo exige alcanzar el mismo día. 31-ene → 28-feb se muestra como 28 días; 31-ene → 1-mar como 1 mes. Esta es una regla de presentación, no una modificación de referencias clínicas.

El adaptador numérico `calcularEdad` conserva años completos para consumidores antiguos y devuelve NULL en datos inválidos; las pantallas usan el formateador pediátrico.

## SQL incremental propuesto y activación futura

Archivo versionado: `database/migrations/20261122_001_identificacion_pacientes.sql`.
Es una candidata **no ejecutada y no validada en MySQL**, no una migración lista para producción. No es un baseline Prisma ni se debe aplicar con `prisma migrate deploy` o `db push`.

1. Autorizar una intervención de BD separada. Inspeccionar esquema efectivo, MySQL 8.4, InnoDB, sql_mode, collation/tipo de cédula, índices, FK y nueve CHECK. Detenerse si difiere de las precondiciones del archivo; no convertir históricos silenciosamente.
2. Respaldar y demostrar restauración. Comparar conteos, IDs y hashes por registro de los valores históricos, además de vínculos clínicos. No usar datos personales para pruebas sin autorización.
3. Ensayar la candidata en una base aislada autorizada, incluyendo esquema antiguo con el cliente nuevo, UNIQUE/NULL, CHECK/UNKNOWN, UTF-16/ICU, concurrencia, rollback DML y recuperación DDL. No requiere continuar intentando Docker desde este entorno.
4. Preparar backend/frontend y cliente generado. Se puede desplegar código nuevo con bandera false contra esquema antiguo después de verificar esa compatibilidad. No aplicar SQL como parte automática del arranque.
5. Establecer una ventana sin escrituras y mantener bandera false. Aplicar exclusivamente la candidata revisada: columnas nuevas, estado LEGADO, índice, CHECK y cédula nullable. No ejecutar `database/schema.sql`, inicializadores ni seeds.
6. Verificar nuevamente las nueve restricciones originales y tres nuevas ENFORCED, todas las FK/índices, conteos, IDs y hashes de cédula. Resolver cualquier conflicto sin borrar o fusionar pacientes. Registrar versión/hash de la migración aplicada mediante el procedimiento autorizado.
7. Desplegar backend actualizado con cliente regenerado y frontend compatible. Mantener bandera false hasta completar los controles. El default LEGADO permite escritores antiguos que solo envían cédula; eso no autoriza seguir usando código antiguo una vez habilitados pacientes con cédula NULL.
8. Configurar `PACIENTES_IDENTIFICACION_HABILITADA=true` y reiniciar el backend. Verificar que `/api/pacientes/capacidades` devuelve ambos indicadores true. La interfaz obtiene esta capacidad al cargar admisión, sin recompilar una bandera del frontend.
9. Realizar comprobaciones autorizadas con fixtures sintéticos: documento, ausencia, histórico revisado, conflicto, versión, auditoría y cadena de IDs. Recargar las pantallas abiertas antes de habilitar admisiones a usuarios.

Un frontend antiguo contra backend activo enviaría cédula en vez de identificación y recibiría 400. Un backend antiguo puede fallar al leer NULL o perder semántica documental: coordinar versiones, pestañas y activación. Una bandera true prematura no permite escritura documental; las comprobaciones de esquema devuelven 503.

DDL realiza commits implícitos. La candidata no es idempotente ni se reejecuta completa tras un fallo: inspeccionar qué pasos terminaron y preparar reparación incremental. Un ROLLBACK ordinario no revierte el archivo. Una vez admitidos pacientes sin documento, no volver a cédula NOT NULL ni retirar columnas como recuperación. Mantener lectores compatibles, pausar admisiones ante incidentes y aplicar el plan de recuperación autorizado.

## CHECK y Unicode: límites de la evidencia

Los tres controles nuevos exigen `IS TRUE`, estructura completa, ASCII documental, país coherente y clave exactamente equivalente mediante comparación binaria. El índice es nullable de una sola columna, VARCHAR(64). El original de cédula no se normaliza.

Para motivos, la candidata expresa longitud UTF-16 mediante conteo de puntos de código más caracteres astrales, y declara los blancos exteriores ECMAScript como bytes UTF-8, junto al rechazo de controles. Evita depender de los escapes SQL de la sesión. **Todavía no se comprobó que MySQL acepte y evalúe estas expresiones como se pretende.** Las comprobaciones estáticas del archivo no sustituyen ICU/MySQL, ni demuestran unicidad o integridad SQL.

Los nueve CHECK originales no se editaron ni eliminaron. Prisma no representa sus expresiones/collations: preservarlas explícitamente en SQL y en todo despliegue posterior. El catálogo de países del formulario ofrece etiquetas CLDR del navegador y código libre; no constituye una validación contra un catálogo oficial.

## Pruebas reproducibles sin base de datos

Desde `backend`, ejecutar cada archivo en un proceso independiente:

```bash
TSX_DISABLE_CACHE=1 node --require tsx/cjs --require ./tests/solo-mocks.cjs tests/registro.test.cjs
TSX_DISABLE_CACHE=1 node --require tsx/cjs --require ./tests/solo-mocks.cjs tests/muestras.permisos.test.cjs
TSX_DISABLE_CACHE=1 node --require tsx/cjs --require ./tests/solo-mocks.cjs tests/usuarios.activacion.test.cjs
TSX_DISABLE_CACHE=1 node --require tsx/cjs --require ./tests/solo-mocks.cjs tests/pacientes.caracterizacion.test.cjs
TSX_DISABLE_CACHE=1 node --require tsx/cjs --require ./tests/solo-mocks.cjs tests/identificacion.unit.test.cjs
TSX_DISABLE_CACHE=1 node --require tsx/cjs --require ./tests/solo-mocks.cjs tests/pacientes.identificacion.test.cjs
TSX_DISABLE_CACHE=1 node --require tsx/cjs --require ./tests/solo-mocks.cjs tests/migracion.pacientes.test.cjs
node node_modules/typescript/bin/tsc --project tsconfig.json --noEmit --incremental false
node node_modules/typescript/bin/tsc --noEmit --strict --noImplicitReturns --noUncheckedIndexedAccess --skipLibCheck --target ES2022 --module commonjs --moduleResolution node tests/identificacion.tipos.ts
```

Desde `frontend`:

```bash
node node_modules/vitest/vitest.mjs run --config src/__tests__/vitest.caracterizacion.config.ts --configLoader runner
node node_modules/typescript/bin/tsc --project tsconfig.json --noEmit --incremental false
node node_modules/typescript/bin/tsc --project tsconfig.node.json --noEmit --emitDeclarationOnly false --incremental false --composite false
```

Las suites backend precargan bloqueo de red, dotenv y PrismaClient real. Frontend desactiva lectura de `.env` y usa bloqueo de red. No ejecutar smoke, pruebas MySQL del experimento ni scripts SQL de restricciones para estas comprobaciones.

Las pruebas de caracterización conservan su cobertura: los casos de NULL/30-feb ahora esperan 400, PUT no ignora cédula y los contactos omitidos ya no se borran. Los cambios de fixtures frontend incorporan capacidades y etiquetas documentales. El algoritmo de años conserva los aniversarios previos; las edades inválidas pasan a ausencia controlada y se añaden pruebas de meses/días y zona horaria.

## Resultado de verificaciones de esta entrega

| Grupo | Casos aprobados |
| --- | ---: |
| Backend existente y núcleo | 275 |
| Backend identificación | 49 |
| Migración: comprobaciones estáticas | 6 |
| Frontend completo | 237 |
| Total | 567 |

Cuatro typechecks aprobados (backend, contrato estático del núcleo, frontend y configuración Vite). Cliente Prisma 6.19.3 regenerado y esquema validado offline con bloqueo de red y `.env`. Ningún caso MySQL ejecutado. Los avisos de React Router v7 ya presentes no hicieron fallar las suites.

## Inventario de archivos de la fase 1.3C

30 archivos existentes modificados y 13 nuevos. Sin staging ni commit. Los 604 archivos locales no rastreados previos fueron comparados por hash y permanecen intactos; `database/schema.sql` también.

### Nuevos

- [backend/src/domain/fechaCivil.ts](../backend/src/domain/fechaCivil.ts)
- [backend/src/services/identificacion-paciente.ts](../backend/src/services/identificacion-paciente.ts)
- [backend/src/utils/http-pacientes.ts](../backend/src/utils/http-pacientes.ts)
- [backend/tests/migracion.pacientes.test.cjs](../backend/tests/migracion.pacientes.test.cjs)
- [backend/tests/pacientes.identificacion.test.cjs](../backend/tests/pacientes.identificacion.test.cjs)
- [database/migrations/20261122_001_identificacion_pacientes.sql](../database/migrations/20261122_001_identificacion_pacientes.sql)
- [database/migrations/README.md](../database/migrations/README.md)
- [docs/identificacion-pacientes-v020.md](../docs/identificacion-pacientes-v020.md)
- [frontend/src/__tests__/edad.civil.test.ts](../frontend/src/__tests__/edad.civil.test.ts)
- [frontend/src/__tests__/pacientes.identificacion.test.tsx](../frontend/src/__tests__/pacientes.identificacion.test.tsx)
- [frontend/src/components/admision/IdentificacionCampos.tsx](../frontend/src/components/admision/IdentificacionCampos.tsx)
- [frontend/src/components/admision/IdentificacionModal.tsx](../frontend/src/components/admision/IdentificacionModal.tsx)
- [frontend/src/utils/identificacion.ts](../frontend/src/utils/identificacion.ts)

### Modificados

- [backend/prisma/schema.prisma](../backend/prisma/schema.prisma)
- [backend/src/config/env.ts](../backend/src/config/env.ts)
- [backend/src/controllers/muestra.controller.ts](../backend/src/controllers/muestra.controller.ts)
- [backend/src/controllers/orden.controller.ts](../backend/src/controllers/orden.controller.ts)
- [backend/src/controllers/paciente.controller.ts](../backend/src/controllers/paciente.controller.ts)
- [backend/src/controllers/resultado.controller.ts](../backend/src/controllers/resultado.controller.ts)
- [backend/src/routes/paciente.routes.ts](../backend/src/routes/paciente.routes.ts)
- [backend/src/services/muestra.service.ts](../backend/src/services/muestra.service.ts)
- [backend/src/services/orden.service.ts](../backend/src/services/orden.service.ts)
- [backend/src/services/paciente.service.ts](../backend/src/services/paciente.service.ts)
- [backend/src/services/resultado.service.ts](../backend/src/services/resultado.service.ts)
- [backend/src/validators/paciente.validator.ts](../backend/src/validators/paciente.validator.ts)
- [backend/tests/pacientes.caracterizacion.test.cjs](../backend/tests/pacientes.caracterizacion.test.cjs)
- [frontend/src/__tests__/edad.caracterizacion.test.ts](../frontend/src/__tests__/edad.caracterizacion.test.ts)
- [frontend/src/__tests__/flujos.test.tsx](../frontend/src/__tests__/flujos.test.tsx)
- [frontend/src/__tests__/layout.test.tsx](../frontend/src/__tests__/layout.test.tsx)
- [frontend/src/__tests__/pacientes.caracterizacion.test.tsx](../frontend/src/__tests__/pacientes.caracterizacion.test.tsx)
- [frontend/src/components/admision/PacienteDetalleModal.tsx](../frontend/src/components/admision/PacienteDetalleModal.tsx)
- [frontend/src/components/admision/PacienteFormModal.tsx](../frontend/src/components/admision/PacienteFormModal.tsx)
- [frontend/src/components/muestras/MuestraDetalleModal.tsx](../frontend/src/components/muestras/MuestraDetalleModal.tsx)
- [frontend/src/components/muestras/MuestraFormModal.tsx](../frontend/src/components/muestras/MuestraFormModal.tsx)
- [frontend/src/components/resultados/ResultadoFormModal.tsx](../frontend/src/components/resultados/ResultadoFormModal.tsx)
- [frontend/src/components/resultados/ResultadoRevisionModal.tsx](../frontend/src/components/resultados/ResultadoRevisionModal.tsx)
- [frontend/src/pages/AdmisionPacientes.tsx](../frontend/src/pages/AdmisionPacientes.tsx)
- [frontend/src/pages/RecepcionMuestras.tsx](../frontend/src/pages/RecepcionMuestras.tsx)
- [frontend/src/pages/ValidacionAthenea.tsx](../frontend/src/pages/ValidacionAthenea.tsx)
- [frontend/src/services/laboratorio.ts](../frontend/src/services/laboratorio.ts)
- [frontend/src/types/api.ts](../frontend/src/types/api.ts)
- [frontend/src/utils/format.ts](../frontend/src/utils/format.ts)
- [frontend/vite.config.ts](../frontend/vite.config.ts)
