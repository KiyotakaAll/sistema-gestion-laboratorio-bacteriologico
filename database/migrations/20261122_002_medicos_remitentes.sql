-- LabZen 2.1. Candidata incremental NO EJECUTADA ni validada en MySQL.
-- Requiere MySQL 8.4/InnoDB y solicitudes.id INT UNSIGNED. No depende de 1.3C.
-- Revisar esquema real, respaldar y ensayar restauración en una intervención autorizada.
-- Mantener MEDICOS_REMITENTES_HABILITADOS=false hasta verificar todo el esquema.
-- No reejecutar tras un fallo parcial: DDL produce commits implícitos.

CREATE TABLE medicos_remitentes (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  nombres VARCHAR(80) NOT NULL,
  apellidos VARCHAR(80) NOT NULL,
  registro_profesional VARCHAR(50) COLLATE utf8mb4_0900_bin NULL,
  especialidad VARCHAR(100) NULL,
  telefono VARCHAR(25) NULL,
  email VARCHAR(120) NULL,
  institucion VARCHAR(120) NULL,
  clave_duplicado VARCHAR(64) COLLATE utf8mb4_0900_bin NULL,
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_medicos_registro (registro_profesional),
  UNIQUE KEY uq_medicos_duplicado (clave_duplicado),
  KEY idx_medicos_nombre (apellidos, nombres),
  CONSTRAINT ck_medicos_nombre CHECK ((CHAR_LENGTH(TRIM(nombres)) > 0
    AND CHAR_LENGTH(TRIM(apellidos)) > 0
    AND CHAR_LENGTH(CONCAT(nombres, ' ', apellidos)) <= 120) IS TRUE),
  CONSTRAINT ck_medicos_activo CHECK (activo IN (0, 1))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- No UPDATE, backfill, clasificación ni reasignación: ambas columnas nacen NULL.
-- medico_solicitante conserva exactamente el texto anterior.
ALTER TABLE solicitudes
  ADD COLUMN medico_remitente_id INT UNSIGNED NULL,
  ADD COLUMN medico_remitente_nombre VARCHAR(120) NULL,
  ADD KEY idx_solicitudes_medico_remitente (medico_remitente_id),
  ADD CONSTRAINT fk_solicitudes_medico_remitente
    FOREIGN KEY (medico_remitente_id) REFERENCES medicos_remitentes (id)
    ON DELETE NO ACTION ON UPDATE NO ACTION;

-- Verificar FK, UNIQUE, CHECK ENFORCED, conteos y hashes del texto histórico antes
-- de activar. No retirar estas columnas si ya hay vínculos; apagar la bandera
-- oculta la asociación nueva pero conserva datos y el texto de ingreso.
