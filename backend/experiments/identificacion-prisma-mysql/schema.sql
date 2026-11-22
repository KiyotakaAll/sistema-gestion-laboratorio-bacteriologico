-- SOLO instancia desechable creada por ensayo.cjs. NO ejecutar manualmente.
-- Candidato SIN verificar en MySQL hasta ejecutar el modo --mysql.
-- No contiene CREATE DATABASE, USE, DROP, TRUNCATE ni datos del proyecto.
CREATE TABLE ensayo_pacientes (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  -- Conserva la collation histórica declarada por database/schema.sql.
  cedula VARCHAR(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL,
  estadoIdentificacion VARCHAR(32) NOT NULL,
  tipoDocumento VARCHAR(3) NULL,
  numeroDocumento VARCHAR(20) NULL,
  paisEmisorDocumento VARCHAR(2) NULL,
  claveIdentificacion VARCHAR(64) NULL,
  motivoAusenciaDocumento VARCHAR(255) NULL,
  versionIdentificacion INT UNSIGNED NOT NULL DEFAULT 0,
  UNIQUE KEY uq_ensayo_cedula (cedula),
  UNIQUE KEY uq_ensayo_clave (claveIdentificacion),
  -- IS TRUE impide que UNKNOWN deje pasar una combinación incompleta.
  CONSTRAINT ck_ensayo_estado CHECK ((
    (estadoIdentificacion = 'DOCUMENTADO'
      AND tipoDocumento IS NOT NULL AND numeroDocumento IS NOT NULL
      AND claveIdentificacion IS NOT NULL AND motivoAusenciaDocumento IS NULL)
    OR
    (estadoIdentificacion IN ('SIN_DOCUMENTO_ASIGNADO', 'DOCUMENTO_NO_DISPONIBLE')
      AND tipoDocumento IS NULL AND numeroDocumento IS NULL
      AND paisEmisorDocumento IS NULL AND claveIdentificacion IS NULL
      AND motivoAusenciaDocumento IS NOT NULL
      AND CHAR_LENGTH(motivoAusenciaDocumento) BETWEEN 5 AND 255
      AND CAST(motivoAusenciaDocumento AS BINARY) = CAST(TRIM(motivoAusenciaDocumento) AS BINARY)
      AND NOT REGEXP_LIKE(motivoAusenciaDocumento, '[[:cntrl:]]', 'c'))
    OR
    (estadoIdentificacion = 'LEGADO_POR_REVISAR' AND cedula IS NOT NULL
      AND tipoDocumento IS NULL AND numeroDocumento IS NULL
      AND paisEmisorDocumento IS NULL AND claveIdentificacion IS NULL
      AND motivoAusenciaDocumento IS NULL)
  ) IS TRUE),
  CONSTRAINT ck_ensayo_formato CHECK ((estadoIdentificacion <> 'DOCUMENTADO' OR (
    (
      (tipoDocumento = 'CC' AND CHAR_LENGTH(numeroDocumento) BETWEEN 1 AND 12
        AND NOT REGEXP_LIKE(numeroDocumento, '[^0-9]', 'c'))
      OR (tipoDocumento = 'TI' AND CHAR_LENGTH(numeroDocumento) BETWEEN 5 AND 12
        AND NOT REGEXP_LIKE(numeroDocumento, '[^0-9]', 'c'))
      OR (tipoDocumento IN ('RC', 'PPT') AND CHAR_LENGTH(numeroDocumento) BETWEEN 5 AND 20
        AND NOT REGEXP_LIKE(numeroDocumento, '[^A-Za-z0-9-]', 'c'))
      OR (tipoDocumento IN ('CE', 'PA') AND CHAR_LENGTH(numeroDocumento) BETWEEN 3 AND 20
        AND NOT REGEXP_LIKE(numeroDocumento, '[^A-Za-z0-9-]', 'c'))
    )
    AND (
      (tipoDocumento IN ('CC', 'TI', 'RC', 'CE', 'PPT') AND paisEmisorDocumento IS NULL)
      OR (tipoDocumento = 'PA' AND paisEmisorDocumento IS NOT NULL
        AND CHAR_LENGTH(paisEmisorDocumento) = 2
        AND NOT REGEXP_LIKE(paisEmisorDocumento, '[^A-Z]', 'c'))
    )
  )) IS TRUE),
  -- Primero se restringen componentes a ASCII y longitudes válidas.
  -- Después se compara la fórmula COMPLETA byte a byte, sin PAD SPACE.
  CONSTRAINT ck_ensayo_clave CHECK ((estadoIdentificacion <> 'DOCUMENTADO' OR (
    claveIdentificacion IS NOT NULL
    AND CAST(claveIdentificacion AS BINARY) = CAST(CONCAT(
      tipoDocumento, ':', CASE WHEN tipoDocumento = 'PA' THEN paisEmisorDocumento ELSE 'CO' END,
      ':', UPPER(numeroDocumento)
    ) AS BINARY)
  )) IS TRUE)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_bin;

CREATE TABLE ensayo_solicitudes (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  pacienteId INT UNSIGNED NOT NULL,
  CONSTRAINT fk_ensayo_solicitud FOREIGN KEY (pacienteId) REFERENCES ensayo_pacientes(id)
) ENGINE=InnoDB;

CREATE TABLE ensayo_muestras (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  solicitudId INT UNSIGNED NOT NULL,
  CONSTRAINT fk_ensayo_muestra FOREIGN KEY (solicitudId) REFERENCES ensayo_solicitudes(id)
) ENGINE=InnoDB;

CREATE TABLE ensayo_muestra_examen (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  muestraId INT UNSIGNED NOT NULL,
  CONSTRAINT fk_ensayo_examen FOREIGN KEY (muestraId) REFERENCES ensayo_muestras(id)
) ENGINE=InnoDB;

CREATE TABLE ensayo_resultados (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  muestraExamenId INT UNSIGNED NOT NULL UNIQUE,
  CONSTRAINT fk_ensayo_resultado FOREIGN KEY (muestraExamenId) REFERENCES ensayo_muestra_examen(id)
) ENGINE=InnoDB;
