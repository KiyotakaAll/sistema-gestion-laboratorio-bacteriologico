-- =============================================================================
-- Sistema Web de Gestión para Laboratorio Bacteriológico
-- Asignatura: Base de Datos I
-- Motor: MySQL 8.0.16+ (las restricciones CHECK solo se aplican desde esa versión)
-- Este archivo es la FUENTE DE VERDAD del modelo. backend/prisma/schema.prisma
-- lo refleja con `prisma generate` (no se usa `prisma migrate`).
--
-- Decisiones de diseño:
--  * ENGINE=InnoDB en todas las tablas: necesario para FK y transacciones.
--  * utf8mb4 para soportar tildes y caracteres especiales en nombres/hallazgos.
--  * PK sustitutas INT UNSIGNED; la clave de negocio (cédula, código de barras,
--    código de solicitud) se protege con UNIQUE.
--  * Se añade la tabla `resultado_antibiograma` (hija de `resultados`) para
--    cumplir 1FN: un resultado puede probar N antibióticos, cada uno con su
--    sensibilidad S/I/R. Guardarlo como texto/JSON impediría consultar o indexar.
--  * `resultados` es 1:1 con `muestra_examen` (un examen solicitado sobre una
--    muestra produce un único resultado).
--  * La "doble firma" se garantiza también en BD: quien valida debe ser distinto
--    de quien registró el resultado (ck_resultados_doble_firma).
--  * Regla MySQL: no se permiten acciones referenciales (CASCADE / SET NULL) en
--    columnas usadas por un CHECK, por eso las FK de `muestras` y `resultados`
--    hacia `usuarios` usan el comportamiento por defecto (NO ACTION).
-- =============================================================================

CREATE DATABASE IF NOT EXISTS laboratorio_bacteriologico
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE laboratorio_bacteriologico;

SET FOREIGN_KEY_CHECKS = 0;
DROP TABLE IF EXISTS logs_auditoria;
DROP TABLE IF EXISTS resultado_antibiograma;
DROP TABLE IF EXISTS resultados;
DROP TABLE IF EXISTS muestra_examen;
DROP TABLE IF EXISTS examenes;
DROP TABLE IF EXISTS muestras;
DROP TABLE IF EXISTS solicitudes;
DROP TABLE IF EXISTS pacientes;
DROP TABLE IF EXISTS usuarios;
DROP TABLE IF EXISTS roles;
SET FOREIGN_KEY_CHECKS = 1;

-- -----------------------------------------------------------------------------
-- Seguridad: roles y usuarios (RBAC)
-- -----------------------------------------------------------------------------
CREATE TABLE roles (
  id          INT UNSIGNED NOT NULL AUTO_INCREMENT,
  nombre      VARCHAR(30)  NOT NULL,
  descripcion VARCHAR(150) NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_roles_nombre (nombre),
  CONSTRAINT ck_roles_nombre CHECK (
    nombre IN ('ADMINISTRADOR', 'RECEPCIONISTA', 'BACTERIOLOGO', 'VALIDADOR')
  )
) ENGINE = InnoDB;

CREATE TABLE usuarios (
  id              INT UNSIGNED NOT NULL AUTO_INCREMENT,
  rol_id          INT UNSIGNED NOT NULL,
  username        VARCHAR(40)  NOT NULL,
  email           VARCHAR(120) NOT NULL,
  nombre_completo VARCHAR(120) NOT NULL,
  password_hash   VARCHAR(255) NOT NULL,            -- hash bcrypt, nunca texto plano
  activo          TINYINT(1)   NOT NULL DEFAULT 1,
  ultimo_acceso   DATETIME(3)  NULL,
  created_at      DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at      DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_usuarios_username (username),
  UNIQUE KEY uq_usuarios_email (email),
  KEY idx_usuarios_rol (rol_id),
  CONSTRAINT fk_usuarios_rol FOREIGN KEY (rol_id) REFERENCES roles (id)
) ENGINE = InnoDB;

-- -----------------------------------------------------------------------------
-- Admisión: pacientes y solicitudes médicas
-- -----------------------------------------------------------------------------
CREATE TABLE pacientes (
  id               INT UNSIGNED NOT NULL AUTO_INCREMENT,
  cedula           VARCHAR(20)  NOT NULL,
  nombres          VARCHAR(80)  NOT NULL,
  apellidos        VARCHAR(80)  NOT NULL,
  fecha_nacimiento DATE         NOT NULL,
  sexo             ENUM('M', 'F', 'O') NOT NULL,
  telefono         VARCHAR(20)  NULL,
  email            VARCHAR(120) NULL,
  direccion        VARCHAR(200) NULL,
  created_at       DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at       DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_pacientes_cedula (cedula),           -- búsqueda por cédula
  KEY idx_pacientes_apellidos_nombres (apellidos, nombres),
  KEY idx_pacientes_created_at (created_at)
) ENGINE = InnoDB;

CREATE TABLE solicitudes (
  id                    INT UNSIGNED NOT NULL AUTO_INCREMENT,
  codigo                VARCHAR(20)  NOT NULL,       -- p. ej. SOL-2026-000001
  paciente_id           INT UNSIGNED NOT NULL,
  usuario_id_registra   INT UNSIGNED NOT NULL,
  medico_solicitante    VARCHAR(120) NULL,
  diagnostico_presuntivo VARCHAR(255) NULL,
  prioridad             ENUM('RUTINA', 'URGENTE') NOT NULL DEFAULT 'RUTINA',
  fecha_solicitud       DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  observaciones         VARCHAR(255) NULL,
  created_at            DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at            DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_solicitudes_codigo (codigo),
  KEY idx_solicitudes_paciente (paciente_id),
  KEY idx_solicitudes_fecha (fecha_solicitud),
  KEY idx_solicitudes_registra (usuario_id_registra),
  CONSTRAINT fk_solicitudes_paciente FOREIGN KEY (paciente_id) REFERENCES pacientes (id),
  CONSTRAINT fk_solicitudes_usuario_registra FOREIGN KEY (usuario_id_registra) REFERENCES usuarios (id)
) ENGINE = InnoDB;

-- -----------------------------------------------------------------------------
-- Catálogo de exámenes
-- -----------------------------------------------------------------------------
CREATE TABLE examenes (
  id                     INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  codigo                 VARCHAR(20)   NOT NULL,
  nombre                 VARCHAR(120)  NOT NULL,
  tipo_muestra_requerida VARCHAR(60)   NOT NULL,
  descripcion            VARCHAR(255)  NULL,
  precio                 DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  activo                 TINYINT(1)    NOT NULL DEFAULT 1,
  PRIMARY KEY (id),
  UNIQUE KEY uq_examenes_codigo (codigo),
  KEY idx_examenes_nombre (nombre),
  CONSTRAINT ck_examenes_precio CHECK (precio >= 0)
) ENGINE = InnoDB;

-- -----------------------------------------------------------------------------
-- Control de muestras (código de barras único + trazabilidad de estados)
-- -----------------------------------------------------------------------------
CREATE TABLE muestras (
  id                    INT UNSIGNED NOT NULL AUTO_INCREMENT,
  codigo_barras         VARCHAR(30)  NOT NULL,
  solicitud_id          INT UNSIGNED NOT NULL,
  tipo_muestra          VARCHAR(60)  NOT NULL,       -- orina, esputo, sangre, heces...
  sitio_anatomico       VARCHAR(80)  NULL,
  estado                ENUM('REGISTRADA', 'RECEPTADA', 'EN_PROCESAMIENTO', 'PROCESADA', 'RECHAZADA')
                        NOT NULL DEFAULT 'REGISTRADA',
  fecha_toma            DATETIME(3)  NOT NULL,
  fecha_recepcion       DATETIME(3)  NULL,
  fecha_procesamiento   DATETIME(3)  NULL,
  usuario_id_recepciona INT UNSIGNED NULL,
  motivo_rechazo        VARCHAR(255) NULL,
  created_at            DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at            DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_muestras_codigo_barras (codigo_barras),
  KEY idx_muestras_solicitud (solicitud_id),
  KEY idx_muestras_estado (estado),
  KEY idx_muestras_fecha_toma (fecha_toma),
  KEY idx_muestras_recepciona (usuario_id_recepciona),
  CONSTRAINT fk_muestras_solicitud FOREIGN KEY (solicitud_id) REFERENCES solicitudes (id),
  CONSTRAINT fk_muestras_usuario_recepciona FOREIGN KEY (usuario_id_recepciona) REFERENCES usuarios (id),
  CONSTRAINT ck_muestras_codigo_barras CHECK (codigo_barras REGEXP '^[A-Z0-9-]{8,30}$'),
  CONSTRAINT ck_muestras_rechazo CHECK (
    estado <> 'RECHAZADA' OR (motivo_rechazo IS NOT NULL AND CHAR_LENGTH(TRIM(motivo_rechazo)) > 0)
  ),
  CONSTRAINT ck_muestras_recepcion CHECK (
    estado = 'REGISTRADA' OR fecha_recepcion IS NOT NULL
  ),
  CONSTRAINT ck_muestras_fechas CHECK (
    (fecha_recepcion IS NULL OR fecha_recepcion >= fecha_toma)
    AND (fecha_procesamiento IS NULL OR (fecha_recepcion IS NOT NULL AND fecha_procesamiento >= fecha_recepcion))
  )
) ENGINE = InnoDB;

-- Relación N:M entre muestras y exámenes solicitados
CREATE TABLE muestra_examen (
  id         INT UNSIGNED NOT NULL AUTO_INCREMENT,
  muestra_id INT UNSIGNED NOT NULL,
  examen_id  INT UNSIGNED NOT NULL,
  created_at DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_muestra_examen (muestra_id, examen_id),
  KEY idx_muestra_examen_examen (examen_id),
  CONSTRAINT fk_muestra_examen_muestra FOREIGN KEY (muestra_id) REFERENCES muestras (id) ON DELETE CASCADE,
  CONSTRAINT fk_muestra_examen_examen FOREIGN KEY (examen_id) REFERENCES examenes (id)
) ENGINE = InnoDB;

-- -----------------------------------------------------------------------------
-- Worklist bacteriológico: resultados y antibiograma
-- -----------------------------------------------------------------------------
CREATE TABLE resultados (
  id                  INT UNSIGNED NOT NULL AUTO_INCREMENT,
  muestra_examen_id   INT UNSIGNED NOT NULL,
  usuario_id_registra INT UNSIGNED NOT NULL,
  hallazgo_gram       TEXT         NULL,             -- hallazgos microscópicos (tinción de Gram)
  colonias            TEXT         NULL,             -- descripción / recuento de colonias (UFC)
  bacteria_aislada    VARCHAR(150) NULL,
  observaciones       TEXT         NULL,
  estado              ENUM('PENDIENTE_VALIDACION', 'VALIDADO') NOT NULL DEFAULT 'PENDIENTE_VALIDACION',
  fecha_registro      DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  usuario_id_valida   INT UNSIGNED NULL,
  fecha_validacion    DATETIME(3)  NULL,
  updated_at          DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_resultados_muestra_examen (muestra_examen_id),
  KEY idx_resultados_estado (estado),
  KEY idx_resultados_fecha_registro (fecha_registro),
  KEY idx_resultados_fecha_validacion (fecha_validacion),
  KEY idx_resultados_registra (usuario_id_registra),
  KEY idx_resultados_valida (usuario_id_valida),
  CONSTRAINT fk_resultados_muestra_examen FOREIGN KEY (muestra_examen_id) REFERENCES muestra_examen (id),
  CONSTRAINT fk_resultados_usuario_registra FOREIGN KEY (usuario_id_registra) REFERENCES usuarios (id),
  CONSTRAINT fk_resultados_usuario_valida FOREIGN KEY (usuario_id_valida) REFERENCES usuarios (id),
  -- Un resultado VALIDADO exige validador y fecha; uno pendiente no puede tenerlos.
  CONSTRAINT ck_resultados_validacion CHECK (
    (estado = 'PENDIENTE_VALIDACION' AND usuario_id_valida IS NULL AND fecha_validacion IS NULL)
    OR (estado = 'VALIDADO' AND usuario_id_valida IS NOT NULL AND fecha_validacion IS NOT NULL)
  ),
  -- Doble firma: el validador debe ser distinto de quien registró.
  CONSTRAINT ck_resultados_doble_firma CHECK (
    usuario_id_valida IS NULL OR usuario_id_valida <> usuario_id_registra
  )
) ENGINE = InnoDB;

CREATE TABLE resultado_antibiograma (
  id           INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  resultado_id INT UNSIGNED  NOT NULL,
  antibiotico  VARCHAR(80)   NOT NULL,
  sensibilidad ENUM('S', 'I', 'R') NOT NULL,         -- Sensible / Intermedio / Resistente
  halo_mm      DECIMAL(5,1)  NULL,                   -- diámetro del halo de inhibición
  PRIMARY KEY (id),
  UNIQUE KEY uq_antibiograma_resultado_antibiotico (resultado_id, antibiotico),
  CONSTRAINT fk_antibiograma_resultado FOREIGN KEY (resultado_id) REFERENCES resultados (id) ON DELETE CASCADE,
  CONSTRAINT ck_antibiograma_halo CHECK (halo_mm IS NULL OR halo_mm >= 0)
) ENGINE = InnoDB;

-- -----------------------------------------------------------------------------
-- Auditoría y trazabilidad
-- -----------------------------------------------------------------------------
CREATE TABLE logs_auditoria (
  id              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  usuario_id      INT UNSIGNED    NULL,
  entidad         VARCHAR(40)     NOT NULL,          -- MUESTRA, RESULTADO, PACIENTE...
  entidad_id      INT UNSIGNED    NOT NULL,
  accion          VARCHAR(40)     NOT NULL,          -- CREAR, RECEPTAR, RECHAZAR, VALIDAR...
  estado_anterior VARCHAR(30)     NULL,
  estado_nuevo    VARCHAR(30)     NULL,
  detalle         JSON            NULL,
  ip_origen       VARCHAR(45)     NULL,
  fecha_evento    DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY idx_logs_entidad (entidad, entidad_id),        -- historial de una muestra/resultado
  KEY idx_logs_usuario (usuario_id),
  KEY idx_logs_fecha (fecha_evento),
  CONSTRAINT fk_logs_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios (id) ON DELETE SET NULL
) ENGINE = InnoDB;

-- -----------------------------------------------------------------------------
-- Datos semilla de catálogo (los usuarios se crean con `npm run seed` para
-- generar los hashes bcrypt desde Node.js)
-- -----------------------------------------------------------------------------
INSERT INTO roles (nombre, descripcion) VALUES
  ('ADMINISTRADOR', 'Gestión de usuarios y configuración del sistema'),
  ('RECEPCIONISTA', 'Admisión de pacientes, solicitudes y recepción de muestras'),
  ('BACTERIOLOGO',  'Procesamiento de muestras y carga de resultados en el worklist'),
  ('VALIDADOR',     'Validación formal (doble firma) de resultados');

INSERT INTO examenes (codigo, nombre, tipo_muestra_requerida, descripcion, precio) VALUES
  ('URO-CUL', 'Urocultivo',                    'Orina',   'Cultivo cuantitativo de orina con antibiograma', 8.50),
  ('COP-CUL', 'Coprocultivo',                  'Heces',   'Cultivo de heces para enteropatógenos',           9.00),
  ('HEM-CUL', 'Hemocultivo',                   'Sangre',  'Cultivo de sangre en medio líquido',             15.00),
  ('ESP-CUL', 'Cultivo de esputo',             'Esputo',  'Cultivo bacteriano de secreción respiratoria',    10.00),
  ('GRM-DIR', 'Gram directo',                  'Variable','Tinción de Gram sobre muestra directa',            4.00),
  ('EXF-CUL', 'Cultivo de exudado faríngeo',   'Exudado', 'Cultivo de exudado de faringe',                    8.00),
  ('SEC-CUL', 'Cultivo de secreción de herida','Secreción','Cultivo aerobio de secreción de herida',          9.50);
