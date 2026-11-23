-- LabZen v0.1.3: SOLO LECTURA. Ejecutar despues del SQL inicial y repetir
-- tras crear el primer administrador. No muestra hashes ni credenciales.
SELECT DATABASE() AS base_seleccionada, VERSION() AS version_mysql,
       @@SESSION.foreign_key_checks AS fk_activadas, @@SESSION.sql_mode AS sql_mode;

-- Deben aparecer exactamente las diez tablas, InnoDB y utf8mb4_unicode_ci.
SELECT table_name, table_type, engine, table_collation
FROM information_schema.tables WHERE table_schema = DATABASE() ORDER BY table_name;

-- Resumen esperado: 10 PK, 10 UNIQUE, 12 FK, 9 CHECK (todos ENFORCED=YES).
SELECT constraint_type, COUNT(*) AS cantidad
FROM information_schema.table_constraints WHERE constraint_schema = DATABASE()
GROUP BY constraint_type ORDER BY constraint_type;

-- Esta consulta debe devolver CERO filas (nombres y tipos exactos).
WITH esperadas AS (
  SELECT 'roles' AS tabla, 'PRIMARY' AS nombre, 'PRIMARY KEY' AS tipo
  UNION ALL
  SELECT 'roles', 'ck_roles_nombre', 'CHECK'
  UNION ALL
  SELECT 'roles', 'uq_roles_nombre', 'UNIQUE'
  UNION ALL
  SELECT 'usuarios', 'PRIMARY', 'PRIMARY KEY'
  UNION ALL
  SELECT 'usuarios', 'fk_usuarios_rol', 'FOREIGN KEY'
  UNION ALL
  SELECT 'usuarios', 'uq_usuarios_username', 'UNIQUE'
  UNION ALL
  SELECT 'usuarios', 'uq_usuarios_email', 'UNIQUE'
  UNION ALL
  SELECT 'pacientes', 'PRIMARY', 'PRIMARY KEY'
  UNION ALL
  SELECT 'pacientes', 'uq_pacientes_cedula', 'UNIQUE'
  UNION ALL
  SELECT 'solicitudes', 'PRIMARY', 'PRIMARY KEY'
  UNION ALL
  SELECT 'solicitudes', 'fk_solicitudes_paciente', 'FOREIGN KEY'
  UNION ALL
  SELECT 'solicitudes', 'fk_solicitudes_usuario_registra', 'FOREIGN KEY'
  UNION ALL
  SELECT 'solicitudes', 'uq_solicitudes_codigo', 'UNIQUE'
  UNION ALL
  SELECT 'examenes', 'PRIMARY', 'PRIMARY KEY'
  UNION ALL
  SELECT 'examenes', 'ck_examenes_precio', 'CHECK'
  UNION ALL
  SELECT 'examenes', 'uq_examenes_codigo', 'UNIQUE'
  UNION ALL
  SELECT 'muestras', 'PRIMARY', 'PRIMARY KEY'
  UNION ALL
  SELECT 'muestras', 'fk_muestras_solicitud', 'FOREIGN KEY'
  UNION ALL
  SELECT 'muestras', 'fk_muestras_usuario_recepciona', 'FOREIGN KEY'
  UNION ALL
  SELECT 'muestras', 'ck_muestras_codigo_barras', 'CHECK'
  UNION ALL
  SELECT 'muestras', 'ck_muestras_rechazo', 'CHECK'
  UNION ALL
  SELECT 'muestras', 'ck_muestras_recepcion', 'CHECK'
  UNION ALL
  SELECT 'muestras', 'ck_muestras_fechas', 'CHECK'
  UNION ALL
  SELECT 'muestras', 'uq_muestras_codigo_barras', 'UNIQUE'
  UNION ALL
  SELECT 'muestra_examen', 'PRIMARY', 'PRIMARY KEY'
  UNION ALL
  SELECT 'muestra_examen', 'fk_muestra_examen_muestra', 'FOREIGN KEY'
  UNION ALL
  SELECT 'muestra_examen', 'fk_muestra_examen_examen', 'FOREIGN KEY'
  UNION ALL
  SELECT 'muestra_examen', 'uq_muestra_examen', 'UNIQUE'
  UNION ALL
  SELECT 'resultados', 'PRIMARY', 'PRIMARY KEY'
  UNION ALL
  SELECT 'resultados', 'fk_resultados_muestra_examen', 'FOREIGN KEY'
  UNION ALL
  SELECT 'resultados', 'fk_resultados_usuario_registra', 'FOREIGN KEY'
  UNION ALL
  SELECT 'resultados', 'fk_resultados_usuario_valida', 'FOREIGN KEY'
  UNION ALL
  SELECT 'resultados', 'ck_resultados_validacion', 'CHECK'
  UNION ALL
  SELECT 'resultados', 'ck_resultados_doble_firma', 'CHECK'
  UNION ALL
  SELECT 'resultados', 'uq_resultados_muestra_examen', 'UNIQUE'
  UNION ALL
  SELECT 'resultado_antibiograma', 'PRIMARY', 'PRIMARY KEY'
  UNION ALL
  SELECT 'resultado_antibiograma', 'fk_antibiograma_resultado', 'FOREIGN KEY'
  UNION ALL
  SELECT 'resultado_antibiograma', 'ck_antibiograma_halo', 'CHECK'
  UNION ALL
  SELECT 'resultado_antibiograma', 'uq_antibiograma_resultado_antibiotico', 'UNIQUE'
  UNION ALL
  SELECT 'logs_auditoria', 'PRIMARY', 'PRIMARY KEY'
  UNION ALL
  SELECT 'logs_auditoria', 'fk_logs_usuario', 'FOREIGN KEY'
), actuales AS (
  SELECT table_name AS tabla, constraint_name AS nombre, constraint_type AS tipo
  FROM information_schema.table_constraints WHERE constraint_schema = DATABASE()
)
SELECT 'FALTA' AS problema, e.* FROM esperadas e
LEFT JOIN actuales a ON a.tabla=e.tabla AND a.nombre=e.nombre AND a.tipo=e.tipo
WHERE a.nombre IS NULL
UNION ALL
SELECT 'SOBRA', a.* FROM actuales a
LEFT JOIN esperadas e ON a.tabla=e.tabla AND a.nombre=e.nombre AND a.tipo=e.tipo
WHERE e.nombre IS NULL;

-- Deben ser nueve CHECK, aplicados. Revisar tambien las expresiones completas.
SELECT t.table_name, t.constraint_name, t.enforced, c.check_clause
FROM information_schema.table_constraints t
JOIN information_schema.check_constraints c
  ON c.constraint_schema=t.constraint_schema AND c.constraint_name=t.constraint_name
WHERE t.constraint_schema=DATABASE() AND t.constraint_type='CHECK'
ORDER BY t.table_name, t.constraint_name;

-- Reglas de las 12 FK: dos CASCADE, un SET NULL; resto RESTRICT/NO ACTION.
SELECT r.table_name, r.constraint_name, k.column_name, k.referenced_table_name,
       k.referenced_column_name, r.update_rule, r.delete_rule
FROM information_schema.referential_constraints r
JOIN information_schema.key_column_usage k
  ON k.constraint_schema=r.constraint_schema AND k.constraint_name=r.constraint_name
  AND k.table_name=r.table_name
WHERE r.constraint_schema=DATABASE() ORDER BY r.table_name, r.constraint_name, k.ordinal_position;

-- Indices: CERO diferencias, incluyendo orden de columnas y unicidad.
WITH esperados AS (
  SELECT 'roles' AS tabla, 'PRIMARY' AS nombre, 0 AS no_unico, 'id' AS columnas
  UNION ALL
  SELECT 'roles', 'uq_roles_nombre', 0, 'nombre'
  UNION ALL
  SELECT 'usuarios', 'PRIMARY', 0, 'id'
  UNION ALL
  SELECT 'usuarios', 'uq_usuarios_username', 0, 'username'
  UNION ALL
  SELECT 'usuarios', 'uq_usuarios_email', 0, 'email'
  UNION ALL
  SELECT 'usuarios', 'idx_usuarios_rol', 1, 'rol_id'
  UNION ALL
  SELECT 'pacientes', 'PRIMARY', 0, 'id'
  UNION ALL
  SELECT 'pacientes', 'uq_pacientes_cedula', 0, 'cedula'
  UNION ALL
  SELECT 'pacientes', 'idx_pacientes_apellidos_nombres', 1, 'apellidos,nombres'
  UNION ALL
  SELECT 'pacientes', 'idx_pacientes_created_at', 1, 'created_at'
  UNION ALL
  SELECT 'solicitudes', 'PRIMARY', 0, 'id'
  UNION ALL
  SELECT 'solicitudes', 'uq_solicitudes_codigo', 0, 'codigo'
  UNION ALL
  SELECT 'solicitudes', 'idx_solicitudes_paciente', 1, 'paciente_id'
  UNION ALL
  SELECT 'solicitudes', 'idx_solicitudes_fecha', 1, 'fecha_solicitud'
  UNION ALL
  SELECT 'solicitudes', 'idx_solicitudes_registra', 1, 'usuario_id_registra'
  UNION ALL
  SELECT 'examenes', 'PRIMARY', 0, 'id'
  UNION ALL
  SELECT 'examenes', 'uq_examenes_codigo', 0, 'codigo'
  UNION ALL
  SELECT 'examenes', 'idx_examenes_nombre', 1, 'nombre'
  UNION ALL
  SELECT 'muestras', 'PRIMARY', 0, 'id'
  UNION ALL
  SELECT 'muestras', 'uq_muestras_codigo_barras', 0, 'codigo_barras'
  UNION ALL
  SELECT 'muestras', 'idx_muestras_solicitud', 1, 'solicitud_id'
  UNION ALL
  SELECT 'muestras', 'idx_muestras_estado', 1, 'estado'
  UNION ALL
  SELECT 'muestras', 'idx_muestras_fecha_toma', 1, 'fecha_toma'
  UNION ALL
  SELECT 'muestras', 'idx_muestras_recepciona', 1, 'usuario_id_recepciona'
  UNION ALL
  SELECT 'muestra_examen', 'PRIMARY', 0, 'id'
  UNION ALL
  SELECT 'muestra_examen', 'uq_muestra_examen', 0, 'muestra_id,examen_id'
  UNION ALL
  SELECT 'muestra_examen', 'idx_muestra_examen_examen', 1, 'examen_id'
  UNION ALL
  SELECT 'resultados', 'PRIMARY', 0, 'id'
  UNION ALL
  SELECT 'resultados', 'uq_resultados_muestra_examen', 0, 'muestra_examen_id'
  UNION ALL
  SELECT 'resultados', 'idx_resultados_estado', 1, 'estado'
  UNION ALL
  SELECT 'resultados', 'idx_resultados_fecha_registro', 1, 'fecha_registro'
  UNION ALL
  SELECT 'resultados', 'idx_resultados_fecha_validacion', 1, 'fecha_validacion'
  UNION ALL
  SELECT 'resultados', 'idx_resultados_registra', 1, 'usuario_id_registra'
  UNION ALL
  SELECT 'resultados', 'idx_resultados_valida', 1, 'usuario_id_valida'
  UNION ALL
  SELECT 'resultado_antibiograma', 'PRIMARY', 0, 'id'
  UNION ALL
  SELECT 'resultado_antibiograma', 'uq_antibiograma_resultado_antibiotico', 0, 'resultado_id,antibiotico'
  UNION ALL
  SELECT 'logs_auditoria', 'PRIMARY', 0, 'id'
  UNION ALL
  SELECT 'logs_auditoria', 'idx_logs_entidad', 1, 'entidad,entidad_id'
  UNION ALL
  SELECT 'logs_auditoria', 'idx_logs_usuario', 1, 'usuario_id'
  UNION ALL
  SELECT 'logs_auditoria', 'idx_logs_fecha', 1, 'fecha_evento'
), actuales AS (
  SELECT table_name AS tabla, index_name AS nombre, non_unique AS no_unico,
         GROUP_CONCAT(column_name ORDER BY seq_in_index SEPARATOR ',') AS columnas
  FROM information_schema.statistics WHERE table_schema=DATABASE()
  GROUP BY table_name, index_name, non_unique
)
SELECT 'FALTA_O_DIFIERE' AS problema, e.* FROM esperados e
LEFT JOIN actuales a ON a.tabla=e.tabla AND a.nombre=e.nombre
  AND a.no_unico=e.no_unico AND a.columnas=e.columnas
WHERE a.nombre IS NULL
UNION ALL
SELECT 'SOBRA_O_DIFIERE', a.* FROM actuales a
LEFT JOIN esperados e ON a.tabla=e.tabla AND a.nombre=e.nombre
  AND a.no_unico=e.no_unico AND a.columnas=e.columnas
WHERE e.nombre IS NULL;

-- DDL efectivo: contrastar columnas, ENUM, defaults, CHECK y FK con el original.
SHOW CREATE TABLE roles;
SHOW CREATE TABLE usuarios;
SHOW CREATE TABLE pacientes;
SHOW CREATE TABLE solicitudes;
SHOW CREATE TABLE examenes;
SHOW CREATE TABLE muestras;
SHOW CREATE TABLE muestra_examen;
SHOW CREATE TABLE resultados;
SHOW CREATE TABLE resultado_antibiograma;
SHOW CREATE TABLE logs_auditoria;

-- Deben ser cuatro roles con los nombres del enum RBAC; siete examenes originales.
SELECT id, nombre, descripcion FROM roles ORDER BY nombre;
SELECT codigo, nombre, tipo_muestra_requerida, descripcion, precio, activo FROM examenes ORDER BY codigo;

-- Antes de crear administrador: cero usuarios y cero registros operativos.
-- Despues: un usuario y un evento CREAR_ADMIN_INICIAL; resto permanece en cero.
SELECT 'roles' AS tabla, COUNT(*) AS filas FROM roles
UNION ALL
SELECT 'usuarios' AS tabla, COUNT(*) AS filas FROM usuarios
UNION ALL
SELECT 'pacientes' AS tabla, COUNT(*) AS filas FROM pacientes
UNION ALL
SELECT 'solicitudes' AS tabla, COUNT(*) AS filas FROM solicitudes
UNION ALL
SELECT 'examenes' AS tabla, COUNT(*) AS filas FROM examenes
UNION ALL
SELECT 'muestras' AS tabla, COUNT(*) AS filas FROM muestras
UNION ALL
SELECT 'muestra_examen' AS tabla, COUNT(*) AS filas FROM muestra_examen
UNION ALL
SELECT 'resultados' AS tabla, COUNT(*) AS filas FROM resultados
UNION ALL
SELECT 'resultado_antibiograma' AS tabla, COUNT(*) AS filas FROM resultado_antibiograma
UNION ALL
SELECT 'logs_auditoria' AS tabla, COUNT(*) AS filas FROM logs_auditoria;

-- Tras el bootstrap: exactamente un administrador activo, bcrypt_formato=1, costo=12.
-- Es una comprobacion de formato; no demuestra que el login funcione.
SELECT u.id, u.username, u.email, u.activo, r.nombre AS rol,
       (u.password_hash REGEXP '^[$]2[aby][$][0-9]{2}[$][./A-Za-z0-9]{53}$') AS bcrypt_formato,
       SUBSTRING(u.password_hash, 5, 2) AS costo_bcrypt
FROM usuarios u JOIN roles r ON r.id=u.rol_id ORDER BY u.id;
SELECT entidad, entidad_id, accion, usuario_id FROM logs_auditoria ORDER BY id;

-- Unico procedimiento auxiliar previsto; no debe haber triggers ni eventos.
SELECT routine_name, routine_type, security_type FROM information_schema.routines
WHERE routine_schema=DATABASE();
SELECT trigger_name FROM information_schema.triggers WHERE trigger_schema=DATABASE();
SELECT event_name FROM information_schema.events WHERE event_schema=DATABASE();
