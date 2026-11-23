# LabZen v0.2.0 — permisos operativos, fase 3.1

Implementación desde `c339e2783e728c9cca5d4eace234f5f3fce094f4`, sin activar ni modificar datos reales.
`PERMISOS_OPERATIVOS_HABILITADOS` es exclusiva del backend, acepta `true`/`false` y tiene default `false`.
Las banderas de identificación de pacientes y médicos conservan su default `false` independiente.

## Política y responsabilidades

`backend/src/domain/permisos.ts` contiene la única matriz de permisos, pura y compartida con frontend.
`requirePermiso` exige la política del servidor en cada ruta. Los servicios de usuarios y firma clínica
también verifican su responsabilidad sensible. No hay bypass de administración sobre la firma.

Con la bandera activada:

| Operación | AUXILIAR | BACTERIOLOGO | RECEPCIONISTA histórico | VALIDADOR histórico | ADMINISTRADOR histórico |
| --- | --- | --- | --- | --- | --- |
| Consultar pacientes, solicitudes, exámenes, médicos y muestras | Sí | Sí | Sí | Sí | Sí |
| Admisión y edición de pacientes/solicitudes | Sí | No | Sí | No | Sí |
| Mantener directorio de médicos, si está habilitado | Sí | No | Sí | No | Sí |
| Registrar y recibir muestras | Sí | No | Sí | No | Sí |
| Rechazar muestras según estado y motivo | Sí | Sí | Sí | No | Sí |
| Iniciar procesamiento | No | Sí | No | No | No |
| Consultar worklist | No | Sí | No | No | Sí |
| Leer resultados y hallazgos clínicos | No | Sí | No | Sí | Sí |
| Registrar/corregir resultados pendientes | No | Sí | No | No | No |
| Validación final del trabajo de otra persona | No | Sí | No | No | No |
| Administración de usuarios existente | No | No | No | No | Sí |

Las pantallas mantienen las restricciones de navegación actuales: la admisión se abre a quien tiene
responsabilidad de admisión; la consulta clínica de pacientes para bacteriología sigue permitida por API.
Los permisos de navegación y las acciones se consultan mediante capacidades, sin listas de roles en componentes.

RECEPCIONISTA se adapta a las mismas operaciones de AUXILIAR sin convertir la cuenta.
ADMINISTRADOR conserva únicamente sus facultades anteriores, incluida la administración explícita.
VALIDADOR conserva consultas clínicas, pero no se convierte en bacteriólogo ni puede firmar en modo nuevo.
BACTERIOLOGO añade la validación final solicitada; la regla de dos personas diferentes permanece intacta.
En modo nuevo se necesitan al menos dos profesionales habilitados para completar registro y doble firma.

## JWT y capacidades

Login y `/api/auth/me` devuelven `usuario.autorizacion` (en `/me`, directamente dentro de `data`):

```json
{
  "politica": "operativa-v1",
  "perfilOperativo": "AUXILIAR",
  "permisos": ["pacientes.leer", "pacientes.escribir"]
}
```

La lista del ejemplo es abreviada. Las capacidades de módulos migrables se siguen consultando aparte.
El JWT contiene el rol y la versión de política, nunca la lista de permisos ni un indicador administrativo.
La firma se verifica exclusivamente con HS256 y el ID debe ser un entero positivo UNSIGNED válido.
En modo nuevo cada petición comprueba la existencia, actividad y rol vigente del usuario. Una discrepancia
con el JWT exige nueva sesión; un fallo de consulta cierra el acceso con 503. Los permisos enviados por el
cliente, incluidos claims firmados de permisos ajenos al contrato, nunca se usan para autorizar.
La firma clínica vuelve a comprobar el profesional dentro de su transacción y conserva doble firma y auditoría.

Al activar, los JWT históricos sin la versión operativa deben renovarse mediante login.
Al volver a false, los JWT operativos se rechazan y AUXILIAR no puede iniciar sesión. Los JWT históricos
todavía vigentes siguen sujetos al comportamiento histórico. No se implementó revocación global de sesiones.

El frontend consume capacidades de login/perfil y las limita con la misma matriz. Una respuesta con
capacidades vacías o desconocidas deniega acceso. Si un servidor anterior no envía capacidades, aplica
solo la matriz histórica; nunca infiere AUXILIAR ni la firma nueva a partir del JWT/localStorage.
La autorización obligatoria permanece en backend aunque se manipule el cliente.

## Compatibilidad, Prisma y SQL pendiente

Con la bandera apagada se conserva exactamente la matriz anterior: firma solo de VALIDADOR,
procesamiento/carga solo de BACTERIOLOGO y administración solo de ADMINISTRADOR.
El middleware mantiene la autenticación histórica stateless, sin añadir consultas de cuenta por petición;
el perfil y las operaciones administrativas conservan sus verificaciones vigentes anteriores.
Esto conserva también la limitación histórica: un JWT emitido con la política histórica
puede seguir vigente hasta expirar aunque la cuenta se desactive. La comprobación por petición solo se
activa con la política nueva.

No se agregaron columnas ni tablas de autorizaciones. `Rol.nombre` ya es String/VARCHAR(30) en Prisma:
se documentó el catálogo ampliado, sin convertirlo a enum ni cambiar las relaciones de Usuario.
Las consultas continúan usando el esquema actual; no dependen de las migraciones de pacientes o médicos.

`database/migrations/20261122_003_roles_operativos.sql` es candidata incremental no ejecutada ni ensayada.
Amplía `ck_roles_nombre` conservando los cuatro valores históricos y propone insertar AUXILIAR en el
catálogo. No cambia ningún `usuarios.rol_id`, `activo` ni contraseña; tampoco asigna IDs ficticios.
El registro público sigue creando RECEPCIONISTA inactivo en modo histórico. Con la política nueva
`rolRegistroPublico()` devuelve `null` y el servicio rechaza el registro con 403
`REGISTRO_PUBLICO_DESHABILITADO`, antes de calcular hashes o consultar/crear cuentas. No hay fallback
a un rol operativo ni concesión pública de AUXILIAR, BACTERIOLOGO o ADMINISTRADOR.

Antes de una activación futura: autorizar la intervención de BD, verificar esquema y restricciones,
respaldar y demostrar restauración, ensayar el SQL en una base aislada y coordinar versiones de clientes.
El DDL tiene commits implícitos; no es una migración reejecutable tras un fallo parcial.
Revisar institucionalmente quiénes son profesionales y quién conserva administración. No convertir
VALIDADOR a BACTERIOLOGO automáticamente ni usar esta fase para modificar usuarios reales.

## Decisión administrativa pendiente

La solución segura implementada mantiene ADMINISTRADOR como responsabilidad histórica separada,
sin otorgarla a ninguno de los dos perfiles operativos. Esto permite desarrollar y probar la simplificación
sin adivinar qué personas deben administrar cuentas. No existe endpoint nuevo para asignar facultades.

Si se exige retirar todos los roles almacenados salvo los dos operativos, debe elegirse explícitamente:

1. Una facultad administrativa independiente del rol operativo, denegada por defecto, con asignación y
   revocación auditadas a personas revisadas. Requiere otra migración y un procedimiento de recuperación.
2. Un plano administrativo separado del acceso clínico, con sus responsables y autenticación definidos.
3. Conservar permanentemente ADMINISTRADOR como rol técnico, fuera de los dos perfiles operativos.

Ninguna de estas alternativas está asignada por suposición. La retirada/conversión de roles históricos y
la concesión individual de administración quedan fuera de esta implementación.

## Verificaciones offline

Las suites backend se ejecutan precargando `tests/solo-mocks.cjs`, que bloquea red, dotenv y PrismaClient real.
Las pruebas de rutas nuevas usan handlers centinela salvo la validación clínica, cuyo servicio, doble firma
y auditoría se prueban contra dobles transaccionales. No demuestran bloqueos, CHECK ni DDL reales de MySQL.
Frontend usa la configuración aislada existente con `envFile: false` y bloqueo de red.
La compilación de producción usa `npm run build` con una configuración temporal que desactiva `.env`.
Los resultados iniciales, la corrección de cierre y el inventario se consignan debajo.

## Resultado de verificación inicial, antes del cierre

- Backend: 322 casos aprobados (64 nuevos, 258 de regresión).
- Frontend: 171 casos aprobados (26 nuevos, 145 de regresión).
- Total: 493 pruebas offline aprobadas.
- Tres typechecks correctos: backend, frontend y configuración Vite.
- Prisma validado offline; no hubo cambios estructurales que regenerar en el cliente.
- Compilación de producción aprobada, sin cargar `.env`, con solo módulos puros compartidos.
- No se ensayó SQL, ni se conectó MySQL/Railway, ni se ejecutaron migraciones.
- Los 604 archivos locales previos permanecen intactos por SHA-256. Sin staging ni commit.

## Cierre: revisión exclusiva del registro público

La implementación inicial creaba AUXILIAR inactivo desde una ruta pública: no proporcionaba acceso
inmediato ni JWT, pero asignaba automáticamente un rol operativo y no cumplía el criterio de cierre.
Se corrigieron únicamente `permisos.service.ts`, `auth.service.ts`, sus casos de registro en
`permisos.test.cjs` y esta documentación, dentro de los mismos 39 archivos de la fase.

En modo nuevo se bloquea el registro público incluso si se presenta un JWT administrativo: esa ruta
no es un alta administrativa autorizada. Tampoco puede eludirse llamando directamente al servicio.
El flujo existente de usuarios solo permite listar y activar cuentas; no tiene creación administrativa.
Se conserva intacto y no se introduce un endpoint nuevo ni un bypass para resolver esa ausencia.
En modo histórico se mantiene el alta de RECEPCIONISTA inactivo y la activación administrativa vigente.

Las verificaciones del cierre se limitan al registro público y sus regresiones históricas; no se repiten
la batería completa ni la compilación de frontend, cuyo código no cambió durante esta revisión.

Cierre verificado: 11 pruebas dirigidas de registro/política y 18 regresiones de registro aprobadas
(29 casos en total), más el typecheck de backend correcto. Las tres banderas mantienen default `false`.

## Inventario de la fase

### Nuevos

- [backend/src/domain/permisos.ts](../backend/src/domain/permisos.ts)
- [backend/src/services/permisos.service.ts](../backend/src/services/permisos.service.ts)
- [backend/tests/permisos.test.cjs](../backend/tests/permisos.test.cjs)
- [database/migrations/20261122_003_roles_operativos.sql](../database/migrations/20261122_003_roles_operativos.sql)
- [docs/permisos-operativos-v020.md](../docs/permisos-operativos-v020.md)
- [frontend/src/__tests__/permisos.test.tsx](../frontend/src/__tests__/permisos.test.tsx)
- [frontend/src/utils/permisos.ts](../frontend/src/utils/permisos.ts)

### Modificados

- [backend/prisma/schema.prisma](../backend/prisma/schema.prisma)
- [backend/src/config/env.ts](../backend/src/config/env.ts)
- [backend/src/middlewares/auth.ts](../backend/src/middlewares/auth.ts)
- [backend/src/middlewares/roleCheck.ts](../backend/src/middlewares/roleCheck.ts)
- [backend/src/routes/medico.routes.ts](../backend/src/routes/medico.routes.ts)
- [backend/src/routes/muestra.routes.ts](../backend/src/routes/muestra.routes.ts)
- [backend/src/routes/orden.routes.ts](../backend/src/routes/orden.routes.ts)
- [backend/src/routes/paciente.routes.ts](../backend/src/routes/paciente.routes.ts)
- [backend/src/routes/resultado.routes.ts](../backend/src/routes/resultado.routes.ts)
- [backend/src/routes/usuario.routes.ts](../backend/src/routes/usuario.routes.ts)
- [backend/src/services/auth.service.ts](../backend/src/services/auth.service.ts)
- [backend/src/services/muestra.service.ts](../backend/src/services/muestra.service.ts)
- [backend/src/services/resultado.service.ts](../backend/src/services/resultado.service.ts)
- [backend/src/services/usuario.service.ts](../backend/src/services/usuario.service.ts)
- [backend/src/types/auth.ts](../backend/src/types/auth.ts)
- [frontend/src/App.tsx](../frontend/src/App.tsx)
- [frontend/src/__tests__/flujos.test.tsx](../frontend/src/__tests__/flujos.test.tsx)
- [frontend/src/components/Header.tsx](../frontend/src/components/Header.tsx)
- [frontend/src/components/Sidebar.tsx](../frontend/src/components/Sidebar.tsx)
- [frontend/src/components/admision/PacienteDetalleModal.tsx](../frontend/src/components/admision/PacienteDetalleModal.tsx)
- [frontend/src/components/muestras/MuestraDetalleModal.tsx](../frontend/src/components/muestras/MuestraDetalleModal.tsx)
- [frontend/src/components/navigation.ts](../frontend/src/components/navigation.ts)
- [frontend/src/components/resultados/ResultadoRevisionModal.tsx](../frontend/src/components/resultados/ResultadoRevisionModal.tsx)
- [frontend/src/context/AuthContext.tsx](../frontend/src/context/AuthContext.tsx)
- [frontend/src/pages/AdmisionPacientes.tsx](../frontend/src/pages/AdmisionPacientes.tsx)
- [frontend/src/pages/Dashboard.tsx](../frontend/src/pages/Dashboard.tsx)
- [frontend/src/pages/GestionUsuarios.tsx](../frontend/src/pages/GestionUsuarios.tsx)
- [frontend/src/pages/MedicosRemitentes.tsx](../frontend/src/pages/MedicosRemitentes.tsx)
- [frontend/src/pages/RecepcionMuestras.tsx](../frontend/src/pages/RecepcionMuestras.tsx)
- [frontend/src/pages/ValidacionAthenea.tsx](../frontend/src/pages/ValidacionAthenea.tsx)
- [frontend/src/pages/WorklistResultados.tsx](../frontend/src/pages/WorklistResultados.tsx)
- [frontend/src/types/api.ts](../frontend/src/types/api.ts)
