-- Candidata para MySQL 8.4 / InnoDB. NO ejecutada por el agente.
-- Aplicar una sola vez sobre un respaldo verificado, con ORDENES_ASISTIDAS_HABILITADAS=false.
-- Independiente de 001/002/003; no convierte ni reasigna solicitudes/muestras históricas.
-- DDL hace commit implícito: detenerse si un paso falla, no reintentar ciegamente.
CREATE TABLE sitios_anatomicos (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  nombre VARCHAR(80) NOT NULL,
  clave VARCHAR(160) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_bin NOT NULL,
  tipos_muestra JSON NOT NULL,
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  CONSTRAINT uq_sitios_clave UNIQUE (clave),
  CONSTRAINT ck_sitios_tipos CHECK (JSON_TYPE(tipos_muestra) = 'ARRAY' AND JSON_LENGTH(tipos_muestra) > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE plantillas_examenes (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  nombre VARCHAR(80) NOT NULL,
  clave VARCHAR(160) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_bin NOT NULL,
  examen_ids JSON NOT NULL,
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  CONSTRAINT uq_plantillas_clave UNIQUE (clave),
  CONSTRAINT ck_plantillas_ids CHECK (JSON_TYPE(examen_ids) = 'ARRAY' AND JSON_LENGTH(examen_ids) > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

ALTER TABLE examenes
  ADD COLUMN instrucciones_toma VARCHAR(1000) NULL,
  ADD COLUMN sitios_permitidos JSON NULL,
  ADD CONSTRAINT ck_examen_sitios CHECK (sitios_permitidos IS NULL OR
    (JSON_TYPE(sitios_permitidos) = 'ARRAY' AND JSON_LENGTH(sitios_permitidos) > 0));

CREATE TABLE solicitudes_examenes (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  solicitud_id INT UNSIGNED NOT NULL,
  examen_id INT UNSIGNED NOT NULL,
  tipo_muestra VARCHAR(60) NOT NULL,
  sitio_anatomico_id INT UNSIGNED NULL,
  sitio_anatomico VARCHAR(80) NULL,
  instrucciones_toma VARCHAR(1000) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  CONSTRAINT uq_solicitud_examen UNIQUE (solicitud_id, examen_id),
  INDEX idx_orden_examen (examen_id),
  INDEX idx_orden_sitio (sitio_anatomico_id),
  FOREIGN KEY (solicitud_id) REFERENCES solicitudes(id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  FOREIGN KEY (examen_id) REFERENCES examenes(id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  FOREIGN KEY (sitio_anatomico_id) REFERENCES sitios_anatomicos(id) ON DELETE RESTRICT ON UPDATE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Propuestas de vocabulario: verificar clínicamente antes de activar la bandera.
-- Compatibles únicamente con los tipos Exudado y Secreción ya presentes en schema.sql.
-- Orina, Sangre, Heces y Esputo siguen como materiales/tipos, no como sitios anatómicos.
INSERT INTO sitios_anatomicos (nombre, clave, tipos_muestra) VALUES
('Faríngeo','faringeo',JSON_ARRAY('Exudado')),
('Nasofaríngeo','nasofaringeo',JSON_ARRAY('Exudado')),
('Nasal','nasal',JSON_ARRAY('Exudado')),
('Bucal','bucal',JSON_ARRAY('Exudado')),
('Conjuntival','conjuntival',JSON_ARRAY('Exudado')),
('Ótico','otico',JSON_ARRAY('Exudado')),
('Cutáneo','cutaneo',JSON_ARRAY('Secreción')),
('Herida','herida',JSON_ARRAY('Secreción')),
('Vaginal','vaginal',JSON_ARRAY('Exudado')),
('Endocervical','endocervical',JSON_ARRAY('Exudado')),
('Uretral','uretral',JSON_ARRAY('Exudado')),
('Rectal','rectal',JSON_ARRAY('Exudado')),
('Perianal','perianal',JSON_ARRAY('Exudado'));

-- Restricciones solo para los exámenes existentes identificados por código Y nombre/tipo.
-- No se agregan exámenes, instrucciones ni recomendaciones de toma.
UPDATE examenes SET sitios_permitidos=JSON_ARRAY('faringeo')
WHERE codigo='EXF-CUL' AND nombre='Cultivo de exudado faríngeo' AND tipo_muestra_requerida='Exudado';
UPDATE examenes SET sitios_permitidos=JSON_ARRAY('herida')
WHERE codigo='SEC-CUL' AND nombre='Cultivo de secreción de herida' AND tipo_muestra_requerida='Secreción';

-- Verificaciones futuras: SHOW CREATE TABLE de las tres tablas y examenes;
-- COUNT solicitudes_examenes = 0 y plantillas_examenes = 0 inmediatamente después;
-- comparar conteos y contenido histórico de solicitudes/muestras/resultados antes/después.
-- No ejecutar DOWN automático ni retirar campos si ya hay órdenes nuevas.
