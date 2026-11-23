# Informes PDF y flujo asistido v0.2.0

Implementación del 23 de noviembre de 2026 sobre `55119cb9c48982edc1fac680800e98ce8f2ff880`.
Sin commit, migraciones ejecutadas, conexión a bases reales, push ni despliegue.

## Uso y alcance

1. Admisión → buscar paciente existente → detalle → Nueva solicitud.
2. Elegir remitente del directorio o nombre externo proporcionado, prioridad y
   observaciones; seleccionar exámenes por búsqueda o selección frecuente.
3. Confirmar tipo de muestra y sitio compatible por examen. Las instrucciones
   solo proceden del campo del catálogo; vacío significa «no registradas».
4. Crear solicitud. En sus acciones están Orden PDF e impresión de la orden.
5. Registrar muestra reutiliza los grupos de la orden; no exige repetir exámenes,
   tipo ni sitio. Conserva el código de barras y las transiciones existentes.
6. El bacteriólogo registra hallazgos; otra persona con permiso profesional valida.
7. Informe final PDF e impresión desde paciente, muestra o revisión de resultados.
   El backend exige todos los exámenes completos y validados y vuelve a comprobar
   la cuenta vigente. Responde 409 si falta algo. No se ofrece borrador clínico.
8. Remisión vacía está disponible desde Admisión. Hay una copia imprimible
   [generada sin datos de pacientes](remision-labzen-v020.pdf).

Sitio anatómico era texto libre. Ahora existe un catálogo persistente con búsqueda
sin tildes, teclado, cambio y limpieza; ADMINISTRADOR puede agregar sitios, con
normalización, unicidad y compatibilidad por material/examen. Las selecciones
frecuentes guardan solo IDs de exámenes; no diagnósticos ni resultados.

Se añadió `informes.descargar` para entregar únicamente informes finales desde
los perfiles con acceso al paciente, incluido AUXILIAR. No concede lectura de
resultados pendientes, firma clínica ni administración. El validador histórico
VALIDADOR se conserva en informes previos; ADMINISTRADOR no es un firmante clínico.

## API protegida

| Método | Ruta | Capacidad |
| --- | --- | --- |
| GET | `/api/solicitudes/:id/informe.pdf` | `informes.descargar`, cuenta vigente y totalidad validada |
| GET | `/api/solicitudes/:id/orden.pdf` | `solicitudes.leer` y cuenta vigente |
| GET | `/api/documentos/remision-vacia.pdf` | `solicitudes.leer` y cuenta vigente |
| GET | `/api/catalogos/flujo` | `examenes.leer` |
| POST | `/api/catalogos/sitios` | `usuarios.administrar`, revalidado en transacción |
| POST | `/api/catalogos/plantillas` | `solicitudes.escribir`, revalidado en transacción |

POST `/api/solicitudes` admite `examenesSolicitados` con `examenId`, `tipoMuestra`
y `sitioAnatomicoId` opcional; no acepta instrucciones aportadas por el cliente.
Las muestras conservan el campo histórico de sitio y admiten ID de catálogo.

PDF mediante [PDFKit](https://pdfkit.org/docs/getting_started.html): A4, fuentes
incluidas con licencia, símbolos clínicos, tablas medidas y páginas numeradas.
No se escriben PDF de pacientes en directorios públicos. Descarga con Bearer y
`Cache-Control: no-store, private`; el navegador utiliza URL blob temporal.
Auditoría de emisión con solicitud, usuario, IDs de resultados, fecha y SHA-256,
sin contraseñas ni hashes de cuenta. Lectura consistente y auditoría transaccional.

## Activación pendiente

- Migración nueva: `database/migrations/20261123_004_ordenes_sitios.sql`.
  Agrega sitios, plantillas, líneas de orden y dos campos opcionales de catálogo.
  No rellena órdenes históricas ni cambia asociaciones clínicas. Propone 13 sitios
  con compatibilidad inicial que requiere aprobación clínica antes de activación.
- `ORDENES_ASISTIDAS_HABILITADAS=false` por defecto. Apagada, no se consultan
  sus tablas/columnas nuevas; funcionan las solicitudes históricas y los PDF.
- Para activarla: aplicar y verificar 004 en el entorno identificado/aprobado,
  revisar FK/UNIQUE/CHECK y los tipos/sitios reales del catálogo; luego configurar
  la bandera en el backend y reiniciarlo de forma coordinada. No ejecutado aquí.
- 004 es estructuralmente independiente de 001/002/003. La identificación ampliada,
  directorio y política AUXILIAR/BACTERIOLOGO siguen requiriendo sus migraciones y
  banderas según [la guía anterior](activacion-v020.md). No se habilitó ninguna.
- Antes de desplegar: validar las cuatro migraciones y el flujo con dos sesiones
  en MySQL 8.4 aislado y datos sintéticos, conservar administrador y renovar JWT.
  Los mocks no acreditan bloqueos, aislamiento ni admisión real de los CHECK.
- No hay identificación profesional del validador ni valores de referencia
  estructurados en el modelo actual: no se inventan. El informe es microbiológico;
  conserva unidades registradas y el halo en mm. Solo incluye observaciones del
  resultado validado, sin copiar notas de admisión al informe clínico.
- Una fuente sin un carácter del registro produce error controlado; no se cambia
  el nombre ni un símbolo clínico para forzar la impresión.

## Verificación focalizada

- Backend: 256 pruebas aprobadas: documentos/órdenes 42, flujo clínico 84,
  médicos 55 y permisos 75. Incluye recorrido de servicios completo offline,
  permisos, doble firma, datos históricos, rechazo de PDF incompleto y rollback.
- Frontend: 179 pruebas en ocho archivos afectados, incluidas 12 nuevas de
  formularios, reutilización, sitios, errores y descarga/impresión.
- Typechecks del backend y dos proyectos frontend correctos; builds de producción
  frontend y backend correctos. Cliente Prisma generado offline desde copia del
  esquema en `/tmp`, sin cargar configuración local ni ejecutar migración.
- Contenido PDF comprobado con `pdftotext`, A4 con `pdfinfo` e inspección visual.
  La remisión vacía también se generó desde el backend compilado.
- Sin pruebas con MySQL ni verificación integrada de una instancia desplegada.

## Inventario de esta entrega

25 archivos modificados y 21 nuevos; 46 en total.
Los tres documentos de preparación de demo anteriores no pertenecen a esta entrega.

Modificados:

- `backend/.env.example`
- `backend/package-lock.json`
- `backend/package.json`
- `backend/prisma/schema.prisma`
- `backend/src/config/env.ts`
- `backend/src/domain/permisos.ts`
- `backend/src/routes/index.ts`
- `backend/src/services/auditoria.service.ts`
- `backend/src/services/muestra.service.ts`
- `backend/src/services/orden.service.ts`
- `backend/src/services/resultado.service.ts`
- `backend/src/validators/muestra.validator.ts`
- `backend/src/validators/orden.validator.ts`
- `frontend/src/__tests__/flujos.test.tsx`
- `frontend/src/__tests__/medicos.test.tsx`
- `frontend/src/__tests__/pacientes.caracterizacion.test.tsx`
- `frontend/src/__tests__/pacientes.identificacion.test.tsx`
- `frontend/src/components/UI/Combobox.tsx`
- `frontend/src/components/admision/PacienteDetalleModal.tsx`
- `frontend/src/components/muestras/MuestraDetalleModal.tsx`
- `frontend/src/components/muestras/MuestraFormModal.tsx`
- `frontend/src/components/resultados/ResultadoRevisionModal.tsx`
- `frontend/src/pages/AdmisionPacientes.tsx`
- `frontend/src/services/laboratorio.ts`
- `frontend/src/types/api.ts`

Nuevos:

- `backend/assets/fonts/DejaVuSans-Bold.ttf`
- `backend/assets/fonts/DejaVuSans.ttf`
- `backend/assets/fonts/LICENSE-DejaVu.txt`
- `backend/src/domain/catalogo-clinico.ts`
- `backend/src/domain/documentos.ts`
- `backend/src/routes/catalogo.routes.ts`
- `backend/src/routes/documento.routes.ts`
- `backend/src/services/catalogo.service.ts`
- `backend/src/services/documento.service.ts`
- `backend/src/services/pdf.service.ts`
- `backend/src/validators/catalogo.validator.ts`
- `backend/tests/documentos-ordenes.test.cjs`
- `database/migrations/20261123_004_ordenes_sitios.sql`
- `docs/informes-ordenes-v020.md`
- `docs/remision-labzen-v020.pdf`
- `frontend/src/__tests__/documentos-ordenes.test.tsx`
- `frontend/src/components/admision/ExamenesOrdenSelector.tsx`
- `frontend/src/components/documentos/DocumentoAcciones.tsx`
- `frontend/src/components/muestras/SitioSelector.tsx`
- `frontend/src/services/catalogos.ts`
- `frontend/src/services/documentos.ts`
