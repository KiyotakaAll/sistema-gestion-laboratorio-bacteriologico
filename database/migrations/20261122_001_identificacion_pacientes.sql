-- LabZen 20261122_001 — CANDIDATA, NO EJECUTADA NI VERIFICADA EN MYSQL.
-- No utilizar con prisma migrate deploy: no existe baseline Prisma del proyecto.
-- Requiere MySQL 8.4, respaldo RESTAURADO de prueba, ventana sin escrituras,
-- inventario de FK/índices y los nueve CHECK originales, y revisión del README.
-- DDL realiza commits implícitos. No hay rollback global de este archivo.
-- Precondición a comprobar manualmente: cedula VARCHAR(20) NOT NULL utf8mb4,
-- id INT UNSIGNED, InnoDB, sql_mode estricto y ausencia de columnas nuevas.
-- NO cambia id, FK, índices existentes ni los nueve CHECK clínicos.
-- Mantener PACIENTES_IDENTIFICACION_HABILITADA=false hasta verificar todo.

-- Capturar y validar la definición efectiva ANTES del primer cambio. PREPARE
-- falla si no coincide el tipo/charset esperado (la expresión resulta NULL).
-- La collation procede exclusivamente de metadatos, no de entrada del usuario.
-- Conservarla evita cambiar la unicidad/comparación de cédulas históricas.
SET @labzen_ident_cedula_ddl = (
  SELECT CONCAT('ALTER TABLE pacientes MODIFY COLUMN cedula VARCHAR(20) ',
    'CHARACTER SET utf8mb4 COLLATE `', COLLATION_NAME, '` NULL')
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'pacientes'
    AND COLUMN_NAME = 'cedula' AND COLUMN_TYPE = 'varchar(20)'
    AND CHARACTER_SET_NAME = 'utf8mb4' AND IS_NULLABLE = 'NO'
    AND COLLATION_NAME REGEXP '^utf8mb4_[a-zA-Z0-9_]+$'
);
PREPARE labzen_ident_cedula_nullable FROM @labzen_ident_cedula_ddl;

ALTER TABLE pacientes
  ADD COLUMN estado_identificacion VARCHAR(32) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_bin NULL DEFAULT 'LEGADO_POR_REVISAR',
  ADD COLUMN tipo_documento VARCHAR(3) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_bin NULL,
  ADD COLUMN numero_documento VARCHAR(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_bin NULL,
  ADD COLUMN pais_emisor_documento VARCHAR(2) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_bin NULL,
  ADD COLUMN clave_identificacion VARCHAR(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_bin NULL,
  ADD COLUMN motivo_ausencia_documento VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_bin NULL,
  ADD COLUMN version_identificacion INT UNSIGNED NOT NULL DEFAULT 0;

-- Únicamente clasifica el estado. No lee, transforma ni reescribe cedula.
UPDATE pacientes SET estado_identificacion = 'LEGADO_POR_REVISAR'
WHERE estado_identificacion IS NULL;

ALTER TABLE pacientes
  ADD UNIQUE KEY uq_pacientes_clave_identificacion (clave_identificacion),
  MODIFY COLUMN estado_identificacion VARCHAR(32) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_bin NOT NULL DEFAULT 'LEGADO_POR_REVISAR';

-- IS TRUE cierra UNKNOWN. Regex sobre texto; comparación de clave sobre bytes.
-- Razones: cuenta UTF-16 y excluye exactamente blancos exteriores ECMAScript.
-- REGEXP_REPLACE/REGEXP_LIKE y su equivalencia ICU siguen pendientes de MySQL.
ALTER TABLE pacientes
  -- IS TRUE impide que UNKNOWN deje pasar una combinación incompleta.
  ADD CONSTRAINT ck_pacientes_ident_estado CHECK ((
    (estado_identificacion = 'DOCUMENTADO'
      AND tipo_documento IS NOT NULL AND numero_documento IS NOT NULL
      AND clave_identificacion IS NOT NULL AND motivo_ausencia_documento IS NULL)
    OR
    (estado_identificacion IN ('SIN_DOCUMENTO_ASIGNADO', 'DOCUMENTO_NO_DISPONIBLE')
      AND tipo_documento IS NULL AND numero_documento IS NULL
      AND pais_emisor_documento IS NULL AND clave_identificacion IS NULL
      AND motivo_ausencia_documento IS NOT NULL
      AND (2 * CHAR_LENGTH(motivo_ausencia_documento) - CHAR_LENGTH(REGEXP_REPLACE(motivo_ausencia_documento, CONCAT('[', CONVERT(0xF0908080 USING utf8mb4), '-', CONVERT(0xF48FBFBF USING utf8mb4), ']'), '', 1, 0, 'c'))) BETWEEN 5 AND 255
      AND NOT REGEXP_LIKE(motivo_ausencia_documento, CONCAT('^[', CONVERT(0x20c2a0e19a80e28080e28081e28082e28083e28084e28085e28086e28087e28088e28089e2808ae280a8e280a9e280afe2819fe38080efbbbf USING utf8mb4), ']|[', CONVERT(0x20c2a0e19a80e28080e28081e28082e28083e28084e28085e28086e28087e28088e28089e2808ae280a8e280a9e280afe2819fe38080efbbbf USING utf8mb4), ']$'), 'c')
      AND NOT REGEXP_LIKE(motivo_ausencia_documento, '[[:cntrl:]]', 'c'))
    OR
    (estado_identificacion = 'LEGADO_POR_REVISAR' AND cedula IS NOT NULL
      AND tipo_documento IS NULL AND numero_documento IS NULL
      AND pais_emisor_documento IS NULL AND clave_identificacion IS NULL
      AND motivo_ausencia_documento IS NULL)
  ) IS TRUE),
  ADD CONSTRAINT ck_pacientes_ident_formato CHECK ((estado_identificacion <> 'DOCUMENTADO' OR (
    (
      (tipo_documento = 'CC' AND CHAR_LENGTH(numero_documento) BETWEEN 1 AND 12
        AND NOT REGEXP_LIKE(numero_documento, '[^0-9]', 'c'))
      OR (tipo_documento = 'TI' AND CHAR_LENGTH(numero_documento) BETWEEN 5 AND 12
        AND NOT REGEXP_LIKE(numero_documento, '[^0-9]', 'c'))
      OR (tipo_documento IN ('RC', 'PPT') AND CHAR_LENGTH(numero_documento) BETWEEN 5 AND 20
        AND NOT REGEXP_LIKE(numero_documento, '[^A-Za-z0-9-]', 'c'))
      OR (tipo_documento IN ('CE', 'PA') AND CHAR_LENGTH(numero_documento) BETWEEN 3 AND 20
        AND NOT REGEXP_LIKE(numero_documento, '[^A-Za-z0-9-]', 'c'))
    )
    AND (
      (tipo_documento IN ('CC', 'TI', 'RC', 'CE', 'PPT') AND pais_emisor_documento IS NULL)
      OR (tipo_documento = 'PA' AND pais_emisor_documento IS NOT NULL
        AND CHAR_LENGTH(pais_emisor_documento) = 2
        AND NOT REGEXP_LIKE(pais_emisor_documento, '[^A-Z]', 'c'))
    )
  )) IS TRUE),
  -- Primero se restringen componentes a ASCII y longitudes válidas.
  -- Después se compara la fórmula COMPLETA byte a byte, sin PAD SPACE.
  ADD CONSTRAINT ck_pacientes_ident_clave CHECK ((estado_identificacion <> 'DOCUMENTADO' OR (
    clave_identificacion IS NOT NULL
    AND CAST(clave_identificacion AS BINARY) = CAST(CONCAT(
      tipo_documento, ':', CASE WHEN tipo_documento = 'PA' THEN pais_emisor_documento ELSE 'CO' END,
      ':', UPPER(numero_documento)
    ) AS BINARY)
  )) IS TRUE);

-- Solo después de comprobar el CHECK de LEGADO y los originales.
-- Cambia únicamente la nulabilidad; conserva la collation histórica capturada.
EXECUTE labzen_ident_cedula_nullable;
DEALLOCATE PREPARE labzen_ident_cedula_nullable;
SET @labzen_ident_cedula_ddl = NULL;

-- Verificaciones posteriores (solo lectura; comparar con respaldo/inventario).
SELECT COUNT(*) AS pacientes, SUM(estado_identificacion = 'LEGADO_POR_REVISAR') AS legado,
  SUM(clave_identificacion IS NOT NULL) AS claves FROM pacientes;
SELECT CONSTRAINT_NAME, ENFORCED FROM information_schema.TABLE_CONSTRAINTS
WHERE TABLE_SCHEMA = DATABASE() AND CONSTRAINT_TYPE = 'CHECK';
SHOW CREATE TABLE pacientes;
