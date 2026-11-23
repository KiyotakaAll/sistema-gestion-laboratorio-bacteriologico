-- Gestión de usuarios: baja lógica y revocación de sesiones. MySQL 8.4/InnoDB.
-- Respaldar y restaurar antes de aplicar. No requiere ni ejecuta la candidata 004.
-- Idempotente: valida los objetos existentes y añade únicamente los ausentes.
-- No cambia usuarios, roles, contraseñas, firmas ni relaciones históricas.
-- El DDL realiza commits implícitos; verificar el esquema después de cada paso.

SET @labzen_usuarios_guard = IF(
  EXISTS (SELECT 1 FROM information_schema.TABLES
    WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='usuarios' AND ENGINE='InnoDB')
  AND NOT EXISTS (SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='usuarios' AND (
      (COLUMN_NAME='eliminado_at' AND (COLUMN_TYPE<>'datetime(3)' OR IS_NULLABLE<>'YES'))
      OR (COLUMN_NAME='version_sesion' AND (COLUMN_TYPE<>'int unsigned'
        OR IS_NULLABLE<>'NO' OR COLUMN_DEFAULT IS NULL OR COLUMN_DEFAULT<>'0'))))
  AND NOT EXISTS (SELECT 1 FROM information_schema.TABLE_CONSTRAINTS tc
    JOIN information_schema.CHECK_CONSTRAINTS cc
      ON cc.CONSTRAINT_SCHEMA=tc.CONSTRAINT_SCHEMA AND cc.CONSTRAINT_NAME=tc.CONSTRAINT_NAME
    WHERE tc.TABLE_SCHEMA=DATABASE() AND tc.TABLE_NAME='usuarios'
      AND tc.CONSTRAINT_NAME='ck_usuarios_eliminado_inactivo' AND (
        tc.ENFORCED<>'YES' OR
        REGEXP_REPLACE(LOWER(REPLACE(REPLACE(REPLACE(cc.CHECK_CLAUSE,'`',''),'(',''),')','')),
          '[[:space:]]','') <> 'eliminado_atisnulloractivo=0istrue')),
  'DO 0', NULL);
-- PREPARE con NULL detiene la ejecución si hay un esquema parcial incompatible.
PREPARE labzen_usuarios_stmt FROM @labzen_usuarios_guard;
EXECUTE labzen_usuarios_stmt;
DEALLOCATE PREPARE labzen_usuarios_stmt;

SET @labzen_usuarios_ddl = IF(
  EXISTS (SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE()
    AND TABLE_NAME='usuarios' AND COLUMN_NAME='eliminado_at'), 'DO 0',
  'ALTER TABLE usuarios ADD COLUMN eliminado_at DATETIME(3) NULL');
PREPARE labzen_usuarios_stmt FROM @labzen_usuarios_ddl;
EXECUTE labzen_usuarios_stmt;
DEALLOCATE PREPARE labzen_usuarios_stmt;

SET @labzen_usuarios_ddl = IF(
  EXISTS (SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE()
    AND TABLE_NAME='usuarios' AND COLUMN_NAME='version_sesion'), 'DO 0',
  'ALTER TABLE usuarios ADD COLUMN version_sesion INT UNSIGNED NOT NULL DEFAULT 0');
PREPARE labzen_usuarios_stmt FROM @labzen_usuarios_ddl;
EXECUTE labzen_usuarios_stmt;
DEALLOCATE PREPARE labzen_usuarios_stmt;

SET @labzen_usuarios_ddl = IF(
  EXISTS (SELECT 1 FROM information_schema.TABLE_CONSTRAINTS WHERE TABLE_SCHEMA=DATABASE()
    AND TABLE_NAME='usuarios' AND CONSTRAINT_NAME='ck_usuarios_eliminado_inactivo'), 'DO 0',
  'ALTER TABLE usuarios ADD CONSTRAINT ck_usuarios_eliminado_inactivo CHECK ((eliminado_at IS NULL OR activo = 0) IS TRUE)');
PREPARE labzen_usuarios_stmt FROM @labzen_usuarios_ddl;
EXECUTE labzen_usuarios_stmt;
DEALLOCATE PREPARE labzen_usuarios_stmt;
SET @labzen_usuarios_guard = NULL;
SET @labzen_usuarios_ddl = NULL;
