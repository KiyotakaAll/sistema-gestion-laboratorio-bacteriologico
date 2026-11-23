# LabZen v0.2.0 — Preparación de activación coordinada (fase 6.1)

**Estado: procedimiento preparado, NO ejecutado.** No autoriza aplicar SQL,
cambiar banderas, crear cuentas, reiniciar servicios ni desplegar. Las consultas
y comandos de esta guía se reservan para una intervención futura, separada y
aprobada por responsables humanos. No se repiten las suites offline aprobadas.

Base revisada: rama `feature/labzen-v020-pacientes`, commit
`7166f177785c132de1a0f903164d580c8beeda5e`.

## 1. Responsables, aprobaciones y evidencia

Antes de cualquier intervención futura, completar un registro restringido:

| Dato | Debe quedar identificado |
| --- | --- |
| Ambiente y destino | Servidor/instancia, nombre real del esquema y versión MySQL; no suponer el destino a partir del repositorio |
| Responsables | DBA ejecutor, responsable de aplicación y responsable operativo/clínico |
| Versiones | Commit de backend, frontend, cliente Prisma generado y SHA-256 de cada candidata |
| Recuperación | Identificador del respaldo cifrado, punto de consistencia, restauración demostrada, RPO/RTO y tiempo límite para abortar |
| Ventana | Inicio/fin, mecanismo aprobado de bloqueo de escrituras y registro público; incluye integraciones y procesos externos |
| Operación | Mecanismo/comando real de configuración y reinicio de todas las instancias; verificación de que no quedan instancias antiguas |
| Acceso | ADMINISTRADOR activo con acceso probado, personal profesional y usuarios para verificaciones controladas; sin adjuntar credenciales |
| Evidencia | Ubicación protegida de inventarios SQL, conteos, huellas y resultados HTTP; no guardarlos en este repositorio |

No hay un comando universal de reinicio en esta guía: depende de la instalación
real y debe quedar completado y aprobado en ese registro. Si falta un dato,
**no comenzar**. No introducir una plataforma de despliegue nueva para resolverlo.

Aprobaciones humanas, con responsable, fecha y evidencia:

- **A0 — Ensayo aislado:** autorizar restaurar un respaldo y ensayar únicamente
  estas candidatas en un ambiente de pruebas. Sin datos personales de producción
  fuera de los controles de acceso y protección aprobados.
- **A1 — Ventana real:** solo después de demostrar restauración y validar en
  MySQL las condiciones pendientes de la sección 10. Aprobar destino, respaldo,
  inmovilización de escrituras y plan de vuelta atrás.
- **A2.1 / A2.2 / A2.3 — Migraciones:** antes de cada archivo, revisar sus
  precondiciones y resultados del anterior. Después de cada archivo, el DBA
  firma la comparación; no encadenarlos sin una parada intermedia.
- **A3.M / A3.P / A3.R — Banderas:** autorización independiente de médicos,
  pacientes y permisos; exigir todas las comprobaciones del escalón anterior.
- **A4 — Apertura:** responsable operativo/clínico aprueba los resultados de las
  comprobaciones controladas y la cobertura de doble firma; solo entonces se
  habilita tráfico general.
- **AR — Recuperación:** incidente, alcance de contención y decisión firmada de
  reversión operativa o restauración. Una restauración nunca es automática.

No se imprimen ni adjuntan contraseñas, hashes de contraseña, claves JWT,
cookies o tokens. El acceso DBA y las cuentas de aplicación se gestionan por el
mecanismo seguro existente, fuera del repositorio y de la línea de comandos.

## 2. Orden, dependencias y conservación de históricos

### Migraciones: `001 → 002 → 003`, siempre con las tres banderas en `false`

| Archivo | Cambio y dependencia real | Qué no hace |
| --- | --- | --- |
| `20261122_001_identificacion_pacientes.sql` | Amplía `pacientes`, añade tres CHECK y un UNIQUE y permite cédula NULL. Requiere su definición histórica compatible | No deduce tipo/número de documento, no reescribe la cédula ni cambia IDs/FK |
| `20261122_002_medicos_remitentes.sql` | Crea directorio y relación opcional desde `solicitudes`; exige tablas históricas y tipos compatibles. No depende estructuralmente de 001 | No extrae médicos del texto histórico, no crea fichas ni reasigna solicitudes |
| `20261122_003_roles_operativos.sql` | Amplía el CHECK de `roles` e inserta solo el catálogo AUXILIAR. Es independiente de 001/002 | No crea usuarios ni cambia sus roles, estado o contraseña; conserva ADMINISTRADOR y los demás roles históricos |

El orden numérico es una convención operativa reproducible, no una dependencia
SQL entre los tres archivos. Aplicarlos separados permite atribuir un fallo a
su cambio y verificar invariantes antes de continuar. Ninguna bandera debe
activar un esquema parcial. No se utilizan inicializadores, seeds,
`database/schema.sql`, `db push` ni `prisma migrate deploy`: no existe un
baseline de migraciones Prisma para estas candidatas.

**Matiz de 001:** el DEFAULT y su UPDATE defensivo asignan automáticamente
`LEGADO_POR_REVISAR` a la nueva columna de estado. Es una clasificación técnica
para revisión, no una conversión documental. Tipo, número, país, clave y motivo
quedan NULL y la versión es 0. El UPDATE solo actúa sobre ese estado si está
NULL; no interpreta ni normaliza cédulas. Con el primer ALTER completado en
una ventana sin escrituras, el DEFAULT debe cubrir las filas existentes. Si
cambia un dato histórico o su `updated_at`, detenerse y averiguar la causa;
no justificarlo como una conversión esperada.

La revisión acotada no demostró un defecto que justifique editar las candidatas.
No significa que ya estén validadas en MySQL: en especial, las expresiones
REGEXP/ICU de 001 siguen pendientes de ensayo real.

### Correspondencia Prisma

- `Paciente.id`, relaciones e índices históricos se conservan. `cedula` es
  opcional; los nuevos estado/versión usan `dbgenerated`, evitando que el
  cliente materialice esos defaults en INSERT del modo histórico.
- `Solicitud.medicoSolicitante` conserva el texto anterior; los nuevos
  `medicoRemitenteId` y `medicoRemitenteNombre` son opcionales. La FK nueva es
  `NoAction`. `MedicoRemitente` refleja el directorio sin registros iniciales.
- `Rol.nombre` es `String / VARCHAR(30)`, no un enum Prisma. La ampliación del
  catálogo no convierte `Usuario.rolId` ni necesita columnas de usuario nuevas.
- Prisma no describe todas las expresiones CHECK ni collations SQL. No usarlo
  para reconstruir el esquema y perder esas restricciones.

### Integridad del artefacto

Antes de A1/A2, comprobar los archivos exactos del paquete revisado:

```sh
sha256sum database/migrations/20261122_001_identificacion_pacientes.sql database/migrations/20261122_002_medicos_remitentes.sql database/migrations/20261122_003_roles_operativos.sql
```

| Archivo | SHA-256 esperado |
| --- | --- |
| 001 | `e281e58eb10ee608a7dfc0d699d8d2a69facf6647beef9856ec6c5bc6bf9558d` |
| 002 | `96e3db35075bdd04dd1c2bb4d7512b13aeca1977c846a966f5e19de54fd1b343` |
| 003 | `c0fa96d2e8f5df93dc1d2956fba45de9eb6c75137533bed9b2ec94cbf18dda48` |

Una diferencia exige nueva revisión y aprobación del artefacto. No actualizar
estos valores para hacer pasar un archivo distinto durante la intervención.

## 3. Comprobaciones SQL comunes: antes y después de cada candidata

**Solo lectura y para el futuro.** Ejecutarlas por el operador autorizado en el
esquema ya seleccionado. `DATABASE()` debe coincidir con el destino aprobado y
no ser NULL. Usar la misma configuración de sesión en todas las comparaciones.
No exponer resultados identificables; las huellas también son información
restringida, no datos anonimizados para publicar.

### Q0 — Servidor, sesión y motores

```sql
SELECT DATABASE() AS esquema, VERSION() AS version_mysql,
       @@version_comment AS distribucion,
       @@SESSION.sql_mode AS modo_sesion, @@GLOBAL.sql_mode AS modo_global,
       @@SESSION.foreign_key_checks AS fk_activas,
       @@SESSION.transaction_isolation AS aislamiento,
       @@SESSION.time_zone AS zona_sesion;

SELECT TABLE_NAME, ENGINE, TABLE_COLLATION
FROM information_schema.TABLES
WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME IN ('roles','usuarios','pacientes','solicitudes','examenes',
                    'muestras','muestra_examen','resultados',
                    'resultado_antibiograma','logs_auditoria','medicos_remitentes')
ORDER BY TABLE_NAME;

SELECT TRIGGER_NAME, EVENT_OBJECT_TABLE, EVENT_MANIPULATION, ACTION_TIMING
FROM information_schema.TRIGGERS
WHERE TRIGGER_SCHEMA = DATABASE()
ORDER BY EVENT_OBJECT_TABLE, TRIGGER_NAME;
```

Exigir MySQL 8.4/InnoDB según las candidatas, modo estricto
`STRICT_TRANS_TABLES` o `STRICT_ALL_TABLES`, FK/CHECK activados y ausencia de
escritores concurrentes. Una versión/distribución diferente, motor distinto,
trigger no evaluado o discrepancia de sesión requiere detenerse y revisión DBA;
no ajustar el esquema, desactivar restricciones o convertir datos para continuar.

### Q1 — Columnas, índices, CHECK y FK

```sql
SELECT TABLE_NAME, COLUMN_NAME, ORDINAL_POSITION, COLUMN_TYPE, IS_NULLABLE,
       COLUMN_DEFAULT, CHARACTER_SET_NAME, COLLATION_NAME, EXTRA
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME IN ('pacientes','solicitudes','medicos_remitentes','roles','usuarios')
ORDER BY TABLE_NAME, ORDINAL_POSITION;

SELECT TABLE_NAME, INDEX_NAME, NON_UNIQUE, SEQ_IN_INDEX, COLUMN_NAME,
       SUB_PART, INDEX_TYPE, IS_VISIBLE
FROM information_schema.STATISTICS
WHERE TABLE_SCHEMA = DATABASE()
ORDER BY TABLE_NAME, INDEX_NAME, SEQ_IN_INDEX;

SELECT tc.TABLE_NAME, tc.CONSTRAINT_NAME, tc.ENFORCED, cc.CHECK_CLAUSE
FROM information_schema.TABLE_CONSTRAINTS AS tc
JOIN information_schema.CHECK_CONSTRAINTS AS cc
  ON cc.CONSTRAINT_SCHEMA = tc.CONSTRAINT_SCHEMA
 AND cc.CONSTRAINT_NAME = tc.CONSTRAINT_NAME
WHERE tc.TABLE_SCHEMA = DATABASE() AND tc.CONSTRAINT_TYPE = 'CHECK'
ORDER BY tc.TABLE_NAME, tc.CONSTRAINT_NAME;

SELECT k.TABLE_NAME, k.CONSTRAINT_NAME, k.ORDINAL_POSITION, k.COLUMN_NAME,
       k.REFERENCED_TABLE_NAME, k.REFERENCED_COLUMN_NAME,
       r.UPDATE_RULE, r.DELETE_RULE
FROM information_schema.KEY_COLUMN_USAGE AS k
JOIN information_schema.REFERENTIAL_CONSTRAINTS AS r
  ON r.CONSTRAINT_SCHEMA = k.CONSTRAINT_SCHEMA
 AND r.CONSTRAINT_NAME = k.CONSTRAINT_NAME AND r.TABLE_NAME = k.TABLE_NAME
WHERE k.TABLE_SCHEMA = DATABASE() AND k.REFERENCED_TABLE_NAME IS NOT NULL
ORDER BY k.TABLE_NAME, k.CONSTRAINT_NAME, k.ORDINAL_POSITION;
```

Conservar las filas completas del inventario. El número de restricciones, por sí
solo, no demuestra su integridad: comparar nombres, expresiones y ENFORCED.
Como referencia del esquema base hay nueve CHECK:

`ck_roles_nombre`, `ck_examenes_precio`, `ck_muestras_codigo_barras`,
`ck_muestras_rechazo`, `ck_muestras_recepcion`, `ck_muestras_fechas`,
`ck_resultados_validacion`, `ck_resultados_doble_firma`, `ck_antibiograma_halo`.

Antes de 001 deben coincidir con la instalación aprobada. Después de 001 se
conservan y se añaden tres; después de 002 se añaden dos más; 003 reemplaza solo
la expresión de `ck_roles_nombre`, sin eliminar los valores históricos.
Los totales de referencia son 9 → 12 → 14 → 14, no una autorización para
ignorar una restricción adicional o una divergencia del esquema real.

### Q2 — Conteos y huellas históricas

Ejecutar sin tráfico de aplicación desde la captura inicial hasta la comprobación
posterior de 003. No comparar indiscriminadamente estas huellas después de
iniciar sesiones o crear registros de aceptación: el login modifica
`ultimo_acceso`/`updated_at` y genera auditoría de forma legítima.

```sql
SELECT 'pacientes' AS entidad, COUNT(*) AS filas FROM pacientes
UNION ALL SELECT 'solicitudes', COUNT(*) FROM solicitudes
UNION ALL SELECT 'usuarios', COUNT(*) FROM usuarios
UNION ALL SELECT 'muestras', COUNT(*) FROM muestras
UNION ALL SELECT 'muestra_examen', COUNT(*) FROM muestra_examen
UNION ALL SELECT 'resultados', COUNT(*) FROM resultados
UNION ALL SELECT 'resultado_antibiograma', COUNT(*) FROM resultado_antibiograma
UNION ALL SELECT 'logs_auditoria', COUNT(*) FROM logs_auditoria;

SELECT id, SHA2(CAST(JSON_ARRAY(id, cedula, nombres, apellidos, fecha_nacimiento,
       sexo, telefono, email, direccion, created_at, updated_at) AS BINARY), 256)
       AS huella_historica
FROM pacientes ORDER BY id;

SELECT id, SHA2(CAST(JSON_ARRAY(id, codigo, paciente_id, usuario_id_registra,
       medico_solicitante, diagnostico_presuntivo, prioridad, fecha_solicitud,
       observaciones, created_at, updated_at) AS BINARY), 256) AS huella_historica
FROM solicitudes ORDER BY id;

SELECT id, SHA2(CAST(JSON_ARRAY(id, rol_id, username, email, nombre_completo,
       activo, ultimo_acceso, created_at, updated_at) AS BINARY), 256)
       AS huella_cuenta_sin_secretos
FROM usuarios ORDER BY id;

SELECT 'muestras' AS entidad, id,
       SHA2(CAST(JSON_ARRAY(solicitud_id, usuario_id_recepciona) AS BINARY),256)
       AS huella_relacion FROM muestras
UNION ALL
SELECT 'muestra_examen', id,
       SHA2(CAST(JSON_ARRAY(muestra_id, examen_id) AS BINARY),256) FROM muestra_examen
UNION ALL
SELECT 'resultados', id,
       SHA2(CAST(JSON_ARRAY(muestra_examen_id, usuario_id_registra, usuario_id_valida)
       AS BINARY),256) FROM resultados
UNION ALL
SELECT 'resultado_antibiograma', id,
       SHA2(CAST(JSON_ARRAY(resultado_id) AS BINARY),256) FROM resultado_antibiograma
ORDER BY entidad, id;
```

Comparar cada ID y huella con el resultado inicial y con el escalón inmediatamente
anterior; no usar solo una suma o una concatenación susceptible de truncamiento.
Durante las tres migraciones no deben cambiar esas filas, conteos ni relaciones.
Los scripts no escriben `usuarios` ni referencian sus contraseñas. Estas huellas
**no incluyen `password_hash`** ni certifican su igualdad: el DBA debe verificar
que la recuperación conserva también ese campo dentro del respaldo protegido,
sin exportarlo ni mostrar hashes en este procedimiento.

Cualquier diferencia inesperada bloquea el siguiente paso. Las únicas diferencias
admitidas de catálogo/esquema son las declaradas en las secciones 4–6.

### Q3 — Cobertura administrativa y clínica

```sql
SELECT r.id, r.nombre, COUNT(u.id) AS cuentas,
       COALESCE(SUM(u.activo = 1),0) AS activas
FROM roles AS r LEFT JOIN usuarios AS u ON u.rol_id = r.id
GROUP BY r.id, r.nombre ORDER BY r.id;

SELECT COUNT(*) AS administradores_activos
FROM usuarios AS u JOIN roles AS r ON r.id = u.rol_id
WHERE r.nombre = 'ADMINISTRADOR' AND u.activo = 1;
```

Debe conservarse al menos un ADMINISTRADOR activo cuyo acceso esté comprobado.
Antes del cambio de permisos deben estar disponibles dos personas autorizadas
como BACTERIOLOGO para la doble firma y una cobertura histórica VALIDADOR si se
pretende volver a política anterior. No inferir títulos profesionales del rol,
no convertir VALIDADOR/RECEPCIONISTA ni otorgar administración a bacteriólogos.
Si faltan personas/cuentas autorizadas, resolverlo mediante el proceso humano de
alta y activación, no mediante UPDATE de roles o creación automática de admin.

## 4. Migración 001 — identificación de pacientes

**Antes (A2.1):** Q0–Q3; `pacientes.id INT UNSIGNED`, InnoDB,
`cedula VARCHAR(20) NOT NULL CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
UNIQUE histórico sin cambios y ninguna columna/índice/CHECK nuevo ya presente.
Si hay un paso aplicado anteriormente, no ejecutar el archivo completo.

Consultar la ausencia de objetos candidatos:

```sql
SELECT COLUMN_NAME FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'pacientes'
  AND COLUMN_NAME IN ('estado_identificacion','tipo_documento','numero_documento',
      'pais_emisor_documento','clave_identificacion','motivo_ausencia_documento',
      'version_identificacion');
```

Resultado esperado antes: cero filas; Q1 tampoco debe mostrar el UNIQUE ni los
tres CHECK de identificación. Registrar cantidad inicial de pacientes `N`.
Tras A2.1 se aplicará únicamente 001, con todas las banderas apagadas.

**Después:** Q0–Q3 y los siguientes controles:

```sql
SHOW CREATE TABLE pacientes;

SELECT COUNT(*) AS total,
       COALESCE(SUM(estado_identificacion = 'LEGADO_POR_REVISAR'),0) AS legado,
       COALESCE(SUM(cedula IS NULL),0) AS cedulas_nulas,
       COALESCE(SUM(tipo_documento IS NOT NULL OR numero_documento IS NOT NULL
         OR pais_emisor_documento IS NOT NULL OR clave_identificacion IS NOT NULL
         OR motivo_ausencia_documento IS NOT NULL),0) AS clasificaciones_documentales,
       COALESCE(SUM(version_identificacion <> 0),0) AS versiones_no_cero
FROM pacientes;
```

Esperar `total=N`, `legado=N`, los otros tres contadores en 0, las huellas
históricas idénticas y todos los índices/FK originales presentes. Q1 debe mostrar:

| Columna/objeto | Definición esperada |
| --- | --- |
| `cedula` | Misma longitud, charset y collation históricos; ahora nullable; UNIQUE original conservado |
| `estado_identificacion` | VARCHAR(32), utf8mb4_0900_bin, NOT NULL, DEFAULT LEGADO_POR_REVISAR |
| `tipo_documento` | VARCHAR(3), utf8mb4_0900_bin, nullable |
| `numero_documento` | VARCHAR(20), utf8mb4_0900_bin, nullable |
| `pais_emisor_documento` | VARCHAR(2), utf8mb4_0900_bin, nullable |
| `clave_identificacion` | VARCHAR(64), utf8mb4_0900_bin, nullable |
| `motivo_ausencia_documento` | VARCHAR(255), utf8mb4_0900_bin, nullable |
| `version_identificacion` | INT UNSIGNED NOT NULL DEFAULT 0 |
| `uq_pacientes_clave_identificacion` | UNIQUE visible de una sola columna, sin prefijo ni componentes adicionales |
| CHECK nuevos | `ck_pacientes_ident_estado`, `ck_pacientes_ident_formato`, `ck_pacientes_ident_clave`, ENFORCED=YES; expresiones idénticas a la candidata |

Una inspección estructural no prueba las expresiones REGEXP/ICU ni la equivalencia
con el dominio TypeScript: el ensayo aislado de esas reglas es obligatorio antes
de A1/A3.P. Mantener la bandera apagada al finalizar el archivo.

## 5. Migración 002 — médicos remitentes

**Antes (A2.2):** comprobaciones anteriores firmadas, Q0–Q3 y ausencia de tabla,
columnas, índice y FK candidatos. Exigir `solicitudes.id INT UNSIGNED`, conservar
su definición histórica y la de `medico_solicitante`.

```sql
SELECT TABLE_NAME FROM information_schema.TABLES
WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'medicos_remitentes';

SELECT COLUMN_NAME FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'solicitudes'
  AND COLUMN_NAME IN ('medico_remitente_id','medico_remitente_nombre');
```

Ambos resultados deben estar vacíos antes del archivo. Después de A2.2 se
aplicará solo 002, sin banderas activas.

**Después:** Q0–Q3, comparaciones de todas las huellas y:

```sql
SHOW CREATE TABLE medicos_remitentes;
SHOW CREATE TABLE solicitudes;
SELECT COUNT(*) AS medicos_iniciales FROM medicos_remitentes;
SELECT COUNT(*) AS solicitudes,
       COALESCE(SUM(medico_remitente_id IS NOT NULL),0) AS vinculadas,
       COALESCE(SUM(medico_remitente_nombre IS NOT NULL),0) AS instantaneas_nuevas
FROM solicitudes;

SELECT COUNT(*) AS vinculos_huerfanos
FROM solicitudes AS s LEFT JOIN medicos_remitentes AS m
  ON m.id = s.medico_remitente_id
WHERE s.medico_remitente_id IS NOT NULL AND m.id IS NULL;
```

Esperar directorio vacío, cero vínculos/instantáneas nuevas/huérfanos y exactamente
las mismas solicitudes y textos históricos. Confirmar todos los campos del
modelo MedicoRemitente, `id INT UNSIGNED`, InnoDB, fechas DATETIME(3), nombres y
apellidos obligatorios; registro/contacto/especialidad/institución opcionales.
`registro_profesional` y `clave_duplicado` usan utf8mb4_0900_bin, UNIQUE separados
sin prefijo. Comprobar `idx_medicos_nombre`, `ck_medicos_nombre` y
`ck_medicos_activo` ENFORCED y sus expresiones, no solo sus nombres.

Las dos columnas nuevas de solicitudes son nullable; el ID es INT UNSIGNED y la
instantánea VARCHAR(120). `idx_solicitudes_medico_remitente` y la FK
`fk_solicitudes_medico_remitente` deben apuntar a `medicos_remitentes.id`, sin
cascadas de cambio/borrado (NO ACTION o su representación equivalente RESTRICT).
No cambian las demás FK/índices. Mantener la bandera apagada.

## 6. Migración 003 — catálogo de roles

**Antes (A2.3):** Q0–Q3, acceso ADMINISTRADOR preservado, `roles.nombre`
VARCHAR(30), UNIQUE `uq_roles_nombre`, CHECK histórico `ck_roles_nombre`
ENFORCED con los cuatro roles, FK `usuarios.rol_id → roles.id` intacta, ningún
usuario huérfano y ninguna fila AUXILIAR previa.

```sql
SELECT id, nombre, descripcion FROM roles ORDER BY id;
SELECT COUNT(*) AS auxiliares_previos FROM roles WHERE nombre = 'AUXILIAR';
SELECT COUNT(*) AS usuarios_huerfanos
FROM usuarios AS u LEFT JOIN roles AS r ON r.id = u.rol_id WHERE r.id IS NULL;
```

Esperar ambos contadores en 0. Si AUXILIAR ya existe o el CHECK ya fue ampliado,
tratarlo como estado previo/parcial: detenerse y conciliar, no reinsertar el rol
ni asignarle un ID supuesto. Tras A2.3 aplicar solo 003, con permisos apagados.

**Después:** Q0–Q3 y:

```sql
SHOW CREATE TABLE roles;
SELECT id, nombre, descripcion FROM roles ORDER BY id;
SELECT COUNT(*) AS auxiliares_en_catalogo FROM roles WHERE nombre = 'AUXILIAR';
SELECT COUNT(*) AS cuentas_auxiliares_tras_migracion
FROM usuarios AS u JOIN roles AS r ON r.id = u.rol_id WHERE r.nombre = 'AUXILIAR';
```

Debe existir exactamente una fila AUXILIAR y cero cuentas AUXILIAR todavía.
Los cuatro roles históricos deben conservar IDs, nombres y descripciones, y
cada usuario su huella, rol y estado anterior. `ck_roles_nombre` debe quedar
ENFORCED con los cuatro nombres históricos más AUXILIAR, en una expresión `IN`
reconocible por `usuarios-disponibilidad.ts`. El servicio comprueba esa expresión
además del catálogo: no basta con que la migración termine sin error.

Las comprobaciones SQL no habilitan AUXILIAR en la aplicación: mientras la
bandera de permisos siga apagada, `GET /api/usuarios/capacidades` no lo ofrece
ni el POST administrativo lo acepta. Mantener las tres banderas apagadas y
cerrar la comparación final de migraciones antes de permitir logins/verificaciones.

## 7. Aplicación futura de archivos: un archivo y una aprobación por vez

Este apartado es una instrucción para el DBA futuro, **no una acción de esta
fase**. Primero A0/A1 y los controles previos del archivo correspondiente.
DDL hace commits implícitos: no envolver las tres candidatas en BEGIN/ROLLBACK
ni prometer una transacción global. No continuar tras un error o warning sin
revisión; no usar `--force` ni clientes configurados para ignorar fallos.

Si el equipo usa el cliente MySQL, el DBA debe disponer de un login-path seguro
preexistente `labzen-v020-dba`, seleccionar explícitamente el esquema real y
sustituir `NOMBRE_REAL_VERIFICADO`. No introducir contraseñas en argumentos o
variables de esta guía. Desde la raíz del paquete aprobado, ejecutar **solo la
línea aprobada en ese momento**, guardar salida/exit code en el registro protegido
y volver a las verificaciones; nunca ejecutar las tres seguidas:

```sh
# FUTURO: únicamente tras A2.1; detenerse después y realizar controles posteriores.
mysql --login-path=labzen-v020-dba --database=NOMBRE_REAL_VERIFICADO --show-warnings --verbose < database/migrations/20261122_001_identificacion_pacientes.sql
```

```sh
# FUTURO: únicamente tras A2.2 y conformidad de 001.
mysql --login-path=labzen-v020-dba --database=NOMBRE_REAL_VERIFICADO --show-warnings --verbose < database/migrations/20261122_002_medicos_remitentes.sql
```

```sh
# FUTURO: únicamente tras A2.3 y conformidad de 002.
mysql --login-path=labzen-v020-dba --database=NOMBRE_REAL_VERIFICADO --show-warnings --verbose < database/migrations/20261122_003_roles_operativos.sql
```

Si se utiliza otro cliente autorizado, abrir exactamente el archivo aprobado en
el destino verificado y exigir parada ante el primer error. No inventar un nuevo
mecanismo de credenciales para poder ejecutar estas líneas. Registrar cada paso
confirmado: estos scripts no son idempotentes ni se reejecutan completos después
de un fallo parcial. La reparación incremental requiere una decisión DBA aparte.

## 8. Activación gradual: médicos → pacientes → permisos

El orden de banderas reduce primero cambios de contrato y deja el cambio de
sesiones/firmas al final. Es independiente del orden numérico de migraciones.
No mezclar instancias con configuraciones distintas: cada bandera se lee al
arrancar el backend. Pausar tráfico/escrituras, ajustar solo el valor autorizado,
reiniciar **todas** las instancias con el mecanismo registrado y verificar antes
de reabrir. La gradualidad es por módulo y ambiente, no por usuarios enviados a
servidores con políticas contradictorias.

Antes de este tramo debe existir un backend/frontend compatibles entre sí,
cliente Prisma generado para estos modelos y ensayo real de cliente nuevo con
banderas apagadas. No arrancar un backend antiguo tras admitir cédulas NULL.
Cerrar o recargar pestañas antiguas; no hay una bandera Vite independiente que
reemplace estas capacidades. Las comprobaciones HTTP siguientes se hacen por
el operador usando sesiones aprobadas, sin copiar tokens en esta guía o consola.

| Escalón | Pacientes | Médicos | Permisos |
| --- | --- | --- | --- |
| S0: tras migraciones, control inicial | false | false | false |
| S1: directorio | false | true | false |
| S2: identificación | true | true | false |
| S3: política y altas operativas | true | true | true |

### S0 — Confirmación de compatibilidad con todo apagado

Con API en acceso restringido, iniciar una sesión ADMINISTRADOR existente y
comprobar su perfil y gestión de usuarios. La credencial se verifica sin cambiar
contraseñas. Esperar:

- `GET /api/pacientes/capacidades`: `identificacionPacientes=false`,
  `registroPacientes=true`.
- `GET /api/medicos/capacidades`: `directorioMedicos=false`.
- `GET /api/usuarios/capacidades`, como administrador: BACTERIOLOGO disponible
  si está en el catálogo; AUXILIAR ausente aunque la fila ya exista.
- `GET /api/auth/me`: `autorizacion.politica=historica-v1`; administración solo
  para ADMINISTRADOR. Lectura de solicitudes históricas con texto intacto.

Mantener bloqueado el registro público en el punto de entrada durante toda la
ventana; con permisos false la ruta de aplicación conserva el comportamiento
histórico de recepción inactiva. Un 202 en modo histórico no es una vía para
obtener perfiles operativos ni una prueba que deba crear cuentas de ensayo reales.

### S1 — Médicos (A3.M)

Exigir 002 completa: tabla/columnas, dos UNIQUE, CHECK, índice y FK comprobados;
permisos del usuario DB de la aplicación suficientes para leer metadatos y para
las operaciones previstas. El chequeo automático del backend es necesario pero
no verifica todas las expresiones CHECK ni sustituye el inventario DBA.

Cambiar exclusivamente `MEDICOS_REMITENTES_HABILITADOS=true`; reiniciar y
comprobar `GET /api/medicos/capacidades` con `directorioMedicos=true` y listado
HTTP 200. Las solicitudes históricas deben mantener el texto original y vínculo
nuevo NULL. La creación/edición/selección de un médico activo, instantánea y
rechazo de un médico inactivo se verifican primero con fixtures autorizados en
el ensayo aislado. No fabricar registros en producción para probarlo.

Si aparece capacidad false inesperada, 503 de esquema, fallo de FK/UNIQUE o texto
histórico alterado, detener apertura y aplicar sección 9. No pasar a S2.

### S2 — Pacientes (A3.P)

Exigir 001 completa, revisión de expresiones y pruebas reales de NULL/UNIQUE,
CHECK, ICU y cliente Prisma. El frontend debe enviar `identificacion`, no el
POST histórico con `cedula`. El personal debe revisar coincidencias con pacientes
LEGADO antes de una nueva admisión: el UNIQUE nuevo no detecta por sí solo una
persona ya existente cuyo documento histórico no ha sido clasificado.

Cambiar exclusivamente `PACIENTES_IDENTIFICACION_HABILITADA=true`; reiniciar y
comprobar ambos indicadores de `GET /api/pacientes/capacidades` en true. Leer un
paciente histórico y su cadena de solicitud/muestra: debe mostrarse como LEGADO,
con la cédula conservada, sin documento inferido. Verificar identificación visible
en las vistas clínicas antes de liberar informes.

No activar identificación sobre un esquema parcial: algunas lecturas seleccionan
las columnas nuevas al ver la bandera, aunque el endpoint de capacidades detecte
el fallo. Una capacidad false no protege por sí sola todas las consultas clínicas.

En ensayo aislado autorizado, comprobar alta documentada, ausencia de documento,
conflicto de clave, cambio de identificación con versión, auditoría y asociaciones
por ID. No clasificar masivamente históricos ni crear documentos ficticios.
Capacidad `registroPacientes=false`, errores 400 de clientes antiguos, 503 de
esquema, problemas de integridad/visibilidad o duplicados no explicados bloquean
la apertura. No continuar a S3 hasta resolverlo.

### S3 — Permisos, sesiones y alta administrativa (A3.R)

Exigir 003 completa, CHECK reconocible, ADMINISTRADOR activo con acceso probado
y personal profesional suficiente para doble firma. La asignación profesional
es humana, no una equivalencia automática entre VALIDADOR y BACTERIOLOGO.

Si faltan bacteriólogos autorizados, el administrador puede dar de alta y activar
BACTERIOLOGO mediante 5.1 con la bandera todavía apagada, tras aprobación de la
identidad y del perfil. Registrar esas altas como escrituras intencionadas
posteriores a las comparaciones SQL, no como efectos de la migración. AUXILIAR
no debe crearse antes de activar la política nueva.

1. Mantener acceso general y registro público cerrados. Comprobar cobertura de
   validación: el modo nuevo retira firma a VALIDADOR y la permite a BACTERIOLOGO;
   ADMINISTRADOR sigue sin firma profesional. Si falta doble firma, detenerse.
2. Establecer solo `PERMISOS_OPERATIVOS_HABILITADOS=true`; reiniciar todas las
   instancias y forzar cierre/reinicio de sesión en los clientes. JWT históricos
   sin `operativa-v1` dejan de autorizar peticiones; no copiar claims ni editar
   tokens para conservar una sesión.
3. Iniciar sesión de nuevo como ADMINISTRADOR. Verificar `/api/auth/me`:
   política `operativa-v1`, permiso `usuarios.administrar` y ausencia de firma
   clínica. Si no puede administrar, mantener mantenimiento y usar recuperación;
   no crear un administrador sustituto automáticamente.
4. `GET /api/usuarios/capacidades` debe ofrecer AUXILIAR y BACTERIOLOGO.
   AUXILIAR ausente o 503 bloquea sus altas; no insertar el rol o saltarse el
   CHECK desde el formulario. Revisar esquema/metadata con el DBA.
5. Una alta administrativa aprobada usa `POST /api/usuarios`: nombre completo,
   username único, correo, contraseña inicial y confirmación, rol AUXILIAR o
   BACTERIOLOGO. Esperar 201, `activo=false`, sin hash/contraseña/token. Verificar
   listado y evento `USUARIO/CREAR/INACTIVO` sin secretos. No usar alta de
   ADMINISTRADOR, RECEPCIONISTA o VALIDADOR por esta ruta.
6. Verificada la identidad, usar `PATCH /api/usuarios/:id/activar`: esperar
   activo=true y evento ACTIVAR. La cuenta podrá iniciar sesión con su rol,
   política y capacidades actuales. El administrador original debe seguir
   activo y asignado a ADMINISTRADOR; los operativos no administran usuarios.
7. Verificar la cuenta inactiva y los rechazos de escalamiento, registro público
   403 `REGISTRO_PUBLICO_DESHABILITADO`, cambios de rol tras JWT y doble firma
   con usuarios/fixtures autorizados en el ensayo aislado. En producción usar
   solo altas reales aprobadas y lecturas de comprobación; no datos ficticios.
8. Obtener A4 y reabrir de forma controlada, conservando el bloqueo externo del
   registro público. Cualquier retirada de ese bloqueo requiere otra aprobación
   y la evidencia del 403 en el ensayo con el mismo artefacto/configuración; no
   intentar registrar personas ficticias en producción para demostrarlo.
   Registrar errores inesperados 401/403/409/503/5xx, incidentes de identificación,
   fallos de auditoría y cobertura de firma. Un rechazo esperado no es un fallo;
   un 403 a un administrador legítimo o un 409 sin causa explicada exige revisión.

No hay una migración de revocación global de JWT. El cambio de versión de política
impide usar sesiones incompatibles mientras se mantiene esa política; no debe
interpretarse como borrado irreversible de todos los tokens históricos.

## 9. Reversión operativa y restauración

### 9.1 Contención común

Ante un fallo, registrar el escalón, cerrar nuevas escrituras y el acceso general
si afecta a identificación/firma, conservar logs y copias y obtener AR. No abrir
un modo alternativo que pierda controles para mantener actividad. Conservar
backend/frontend actuales y esquema ampliado siempre que puedan leer con seguridad.

| Bandera a false | Qué revierte | Qué no revierte / condición de seguridad |
| --- | --- | --- |
| Médicos | Deshabilita directorio y selección/asociación nuevas | No borra médicos ni vínculos ni instantáneas; la interfaz puede ocultarlos y mostrar solo el texto histórico anterior. No interpretar esa ocultación como ausencia del remitente |
| Pacientes | Deshabilita captura y proyección documentales nuevas | No rellena cédulas NULL ni convierte documentos a cédulas. La proyección antigua puede ocultar la identificación nueva: pausar admisiones y cualquier emisión/flujo que dependa de esa identificación hasta comprobar lectura segura |
| Permisos | Restaura matriz histórica y rechaza JWT operativos | AUXILIAR deja de iniciar sesión; BACTERIOLOGO pierde firma y VALIDADOR la recupera según la política histórica. Reabre el comportamiento histórico de registro público si no se bloquea externamente; tokens históricos no expirados pueden volver a ser aceptados |

No apagar todas las banderas por reflejo: contener y elegir el módulo afectado
con aprobación, conservar las otras donde resulte seguro. Si hace falta volver
de S3 a S0, preparar primero todas las salvaguardas y después desactivar en orden
inverso, permisos → pacientes → médicos, con reinicio coherente y comprobaciones
después de cada paso. Ese orden no elimina sus riesgos particulares.

Para volver permisos a false, **antes** bloquear `/api/auth/register` y la API
general durante la transición. Exigir nuevos logins y cobertura de VALIDADOR.
Los JWT históricos pueden revivir mientras sean válidos: mantener la contención
hasta agotar la vida máxima real de todos ellos, incluidos emisores anteriores,
o usar un procedimiento separado y aprobado de rotación de la clave de firma en
todas las instancias. Nunca publicar la clave ni asumir que cerrar una pestaña
revoca un JWT. No habilitar tráfico si no hay un plan de invalidación aceptado.

Para pacientes, con nuevas admisiones ya realizadas, no volver a `cedula NOT NULL`
ni retirar columnas. No inventar cédulas para reabrir. Si la interfaz con bandera
false no presenta identificación suficiente, mantener mantenimiento de los flujos
afectados y corregir/recuperar bajo control; false no garantiza servicio completo.
Para médicos, no reasignar solicitudes ni reconstruir el directorio por nombres.

### 9.2 Fallo parcial de una candidata

Detenerse en el primer error. DDL tiene commits implícitos y las partes anteriores
pueden estar confirmadas. Mantener las banderas apagadas, repetir solo lecturas
Q0–Q3 y las comprobaciones del archivo afectado, y registrar el último paso
confirmado. No reejecutar el archivo completo ni generar un DROP automático.

El DBA decidirá entre una reparación incremental específica y revisada o una
restauración. Un CHECK ampliado sin AUXILIAR insertado, o columnas de pacientes
sin todos los CHECK, son estados parciales: no aceptarlos como activables.

### 9.3 Restauración desde respaldo

La reversión de esquema/datos exige AR, respaldo restaurable y una ventana sin
escritores. El procedimiento de restauración depende de la plataforma de
respaldo real, debe haberse ensayado y quedar identificado en A1; no se incluye
un comando destructivo genérico para una instancia desconocida.

1. Contener y capturar una copia protegida del estado del incidente y auditoría
   posterior al respaldo. No perder la evidencia intentando restaurar encima.
2. Restaurar el punto consistente a un destino aislado mediante el procedimiento
   aprobado; verificar esquema, restricciones, conteos, huellas, cuentas y
   relaciones antes de considerar el cambio de destino.
3. Elegir entre recuperar hacia delante o volver al punto anterior. Si hubo
   nuevas admisiones, vínculos, resultados, altas/activaciones o firmas después
   del respaldo, cuantificar qué se perdería y someterlo a revisión operativa y
   clínica. No descartar ni fusionar esos registros automáticamente.
4. Planificar recuperación temporal/coordinada de todas las tablas relacionadas.
   No restaurar solo pacientes o usuarios dejando FK, solicitudes, resultados o
   logs en otro punto temporal. No borrar filas para hacer coincidir constraints.
5. Autorizar el destino y configuración compatibles, reiniciar todas las
   instancias, renovar sesiones según la política resultante y repetir los
   controles de apertura. Solo reabrir con aprobación de integridad clínica.

**Nunca son una reversión automática:** retirar AUXILIAR si tiene usuarios,
convertir usuarios a otros roles, eliminar columnas documentales/médicos,
restablecer cédula NOT NULL, borrar pacientes, reasignar solicitudes o deshacer
firmas. Tampoco un ROLLBACK del cliente SQL revierte los tres archivos completos.

## 10. Riesgos pendientes y criterios de parada

Antes de A1/A3 deben resolverse en una intervención real de pruebas autorizada:

- Admisión por MySQL 8.4 de las expresiones CHECK de 001 y evaluación efectiva de
  `IS TRUE`, REGEXP_LIKE/REGEXP_REPLACE/ICU, caracteres astrales, blancos exteriores,
  controles, longitud UTF-16 y comparación binaria de clave/collation.
- UNIQUE con NULL, prefijos y collations; conservar cédulas y texto histórico byte
  a byte, comportamiento de defaults `dbgenerated` y SQL emitido por Prisma con
  banderas apagadas sobre esquema antiguo y sobre esquema ampliado.
- Tiempo, espacio, bloqueos de metadatos y comportamiento de cada ALTER en el
  tamaño real. Parada y recuperación tras cada punto de fallo DDL/DML; duración
  y restauración demostrada del respaldo.
- Permisos efectivos de la cuenta DB de aplicación para consultar metadata; forma
  real de CHECK_CLAUSE/ENFORCED reconocida para AUXILIAR, FK y UNIQUE de médicos.
- Bloqueos, actualización condicional y rollback real frente a auditoría fallida,
  revocación de cuenta y escrituras simultáneas. La fase 4.1 usa DATETIME(3) y
  versiones crecientes; los mocks no prueban su round trip ni aislamiento real.
- Renovación de sesiones, homogeneidad de instancias/clientes, cobertura de dos
  bacteriólogos y recuperación administrativa sin cambiar roles automáticamente.
- Duplicados clínicos entre históricos LEGADO y nuevas claves documentales,
  visibilidad de identificación/remitente al apagar banderas y conservación de
  datos posteriores al respaldo en una recuperación.

Detenerse ante destino/hash/versión inesperados, esquema parcial, CHECK/FK/índice
faltante o diferente, datos históricos alterados, admin inaccesible, falta de
cobertura profesional, capacidades incompatibles, error no explicado o respaldo
sin restauración demostrada. Un resultado offline aprobado no levanta esas paradas.

## 11. Alcance y estado de esta fase

Se revisaron únicamente las tres candidatas, los modelos relacionados y los
puntos de activación/compatibilidad, sesiones y alta administrativa necesarios
para este procedimiento. No se modificaron migraciones ni módulos funcionales.
No se ejecutaron SQL, migraciones, conexiones MySQL/Railway, Docker, suites,
compilaciones, reinicios o cambios de banderas. No hay despliegue, push ni commit.

Único archivo nuevo: `docs/activacion-v020.md`. Rama y HEAD permanecen en la base
indicada. Los 604 archivos locales preexistentes se preservan y se verifican por
SHA-256 contra el inventario inicial de esta fase guardado fuera del repositorio.
El índice permanece vacío.
