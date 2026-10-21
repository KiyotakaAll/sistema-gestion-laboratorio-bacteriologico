#!/usr/bin/env bash
# Verifica que schema.sql rechaza datos inválidos (CHECK, UNIQUE, doble firma) y acepta los válidos.
# Uso: ./verificar_restricciones.sh [usuario_mysql]   (pide la clave si la cuenta la requiere)
# ADVERTENCIA: borra los datos de las tablas de laboratorio_bacteriologico. Úselo solo en una BD de desarrollo.
set -u
U="${1:-root}"; DB=laboratorio_bacteriologico
sql() { mysql -u"$U" -p"${MYSQL_PWD:-}" -N "$DB" -e "$1" 2>&1; }
[ -z "${MYSQL_PWD:-}" ] && sql() { mysql -u"$U" -N "$DB" -e "$1" 2>&1; }
fallos=0
debe_fallar() { if out=$(sql "$2"); then echo "FALLO  (aceptado) $1"; fallos=$((fallos+1)); else echo "OK     rechazado: $1"; fi; }
debe_pasar()  { if out=$(sql "$2"); then echo "OK     aceptado:  $1"; else echo "FALLO  (rechazado) $1 -> $out"; fallos=$((fallos+1)); fi; }

sql "SET FOREIGN_KEY_CHECKS=0; TRUNCATE resultado_antibiograma; TRUNCATE resultados; TRUNCATE muestra_examen; TRUNCATE muestras; TRUNCATE solicitudes; TRUNCATE pacientes; TRUNCATE usuarios; TRUNCATE logs_auditoria; SET FOREIGN_KEY_CHECKS=1;" >/dev/null
sql "INSERT INTO usuarios (rol_id,username,email,nombre_completo,password_hash) VALUES (3,'bact','b@x.l','Bact','h'),(4,'val','v@x.l','Val','h');
     INSERT INTO pacientes (cedula,nombres,apellidos,fecha_nacimiento,sexo) VALUES ('12345678','Ana','Perez','1990-05-12','F');
     INSERT INTO solicitudes (codigo,paciente_id,usuario_id_registra) VALUES ('SOL-2026-000001',1,1);
     INSERT INTO muestras (codigo_barras,solicitud_id,tipo_muestra,fecha_toma) VALUES ('M261014-ABC234',1,'Orina','2026-10-14 08:00:00');
     INSERT INTO muestra_examen (muestra_id,examen_id) VALUES (1,1);" >/dev/null

debe_fallar "muestra RECHAZADA sin motivo"            "UPDATE muestras SET estado='RECHAZADA', fecha_recepcion=NOW() WHERE id=1"
debe_fallar "muestra RECEPTADA sin fecha_recepcion"   "UPDATE muestras SET estado='RECEPTADA' WHERE id=1"
debe_fallar "código de barras con formato inválido"   "INSERT INTO muestras (codigo_barras,solicitud_id,tipo_muestra,fecha_toma) VALUES ('ab',1,'Orina',NOW())"
debe_fallar "código de barras duplicado"              "INSERT INTO muestras (codigo_barras,solicitud_id,tipo_muestra,fecha_toma) VALUES ('M261014-ABC234',1,'Orina',NOW())"
debe_fallar "cédula duplicada"                        "INSERT INTO pacientes (cedula,nombres,apellidos,fecha_nacimiento,sexo) VALUES ('12345678','X','Y','1990-01-01','M')"
debe_fallar "recepción anterior a la toma"            "UPDATE muestras SET estado='RECEPTADA', fecha_recepcion='2026-10-14 07:00:00' WHERE id=1"
debe_fallar "estado de muestra fuera del enum"        "UPDATE muestras SET estado='INVENTADO' WHERE id=1"
debe_fallar "rol no permitido"                        "INSERT INTO roles (nombre,descripcion) VALUES ('HACKER','x')"
debe_fallar "examen con precio negativo"              "INSERT INTO examenes (codigo,nombre,tipo_muestra_requerida,precio) VALUES ('NEG','Neg','x',-1)"

B=$(sql "SELECT id FROM usuarios WHERE username='bact'"); V=$(sql "SELECT id FROM usuarios WHERE username='val'"); ME=$(sql "SELECT id FROM muestra_examen LIMIT 1")
debe_fallar "resultado VALIDADO sin validador"        "INSERT INTO resultados (muestra_examen_id,usuario_id_registra,bacteria_aislada,estado) VALUES ($ME,$B,'E. coli','VALIDADO')"
debe_fallar "DOBLE FIRMA: valida quien registró"      "INSERT INTO resultados (muestra_examen_id,usuario_id_registra,bacteria_aislada,estado,usuario_id_valida,fecha_validacion) VALUES ($ME,$B,'E. coli','VALIDADO',$B,NOW())"
debe_pasar  "resultado pendiente válido"              "INSERT INTO resultados (muestra_examen_id,usuario_id_registra,bacteria_aislada) VALUES ($ME,$B,'E. coli')"
R=$(sql "SELECT id FROM resultados LIMIT 1")
debe_pasar  "antibiograma Ciprofloxacino S"           "INSERT INTO resultado_antibiograma (resultado_id,antibiotico,sensibilidad,halo_mm) VALUES ($R,'Ciprofloxacino','S',24.5)"
debe_fallar "antibiótico repetido en el resultado"    "INSERT INTO resultado_antibiograma (resultado_id,antibiotico,sensibilidad) VALUES ($R,'Ciprofloxacino','R')"
debe_fallar "validar con el mismo usuario que registró" "UPDATE resultados SET estado='VALIDADO', usuario_id_valida=$B, fecha_validacion=NOW() WHERE id=$R"
debe_pasar  "validar con OTRO usuario (doble firma)"  "UPDATE resultados SET estado='VALIDADO', usuario_id_valida=$V, fecha_validacion=NOW() WHERE id=$R"

echo; [ "$fallos" -eq 0 ] && echo "TODAS LAS RESTRICCIONES FUNCIONAN" || echo "$fallos verificaciones fallaron"
exit "$fallos"
