-- Fase 3.1: candidata NO EJECUTADA ni ensayada en MySQL.
-- MySQL 8.4/InnoDB. Revisar ck_roles_nombre y uq_roles_nombre antes de aplicar.
-- Respaldar y verificar restauración. Mantener PERMISOS_OPERATIVOS_HABILITADOS=false.
-- Prisma ya representa roles.nombre como VARCHAR(30); no requiere columnas nuevas.
-- No modifica usuarios, contraseñas, asignaciones ni permisos administrativos.
-- No elimina los roles históricos ni presupone los IDs de roles existentes.

ALTER TABLE roles
  DROP CHECK ck_roles_nombre,
  ADD CONSTRAINT ck_roles_nombre CHECK
    (nombre IN ('ADMINISTRADOR', 'RECEPCIONISTA', 'BACTERIOLOGO', 'VALIDADOR', 'AUXILIAR'));

INSERT INTO roles (nombre, descripcion)
VALUES ('AUXILIAR', 'Admisión y registro operativo del laboratorio');

-- Verificar CHECK ENFORCED, catálogo y que todos los usuarios conservan rol_id,
-- activo y password_hash. El INSERT no crea ninguna cuenta ni la convierte.
-- DDL tiene commits implícitos: no reejecutar tras un fallo parcial sin inspección.
-- La futura activación exige renovar sesiones. Volver a false invalida JWT nuevos;
-- las cuentas AUXILIAR no podrán iniciar sesión en modo histórico.
-- No retirar AUXILIAR si tiene usuarios asociados. Conservar la FK de usuarios.
