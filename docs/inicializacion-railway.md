# Inicialización de LabZen v0.1.3 en MySQL vacío

**Estado: preparado para revisión. Estos comandos no han sido ejecutados contra MySQL.**
No son migraciones ni deben agregarse al arranque automático del backend. Ejecutarlos
solo después de que el responsable revise y autorice el destino y los archivos.

1. **Qué se ha confirmado leyendo el código**

   - `database/schema.sql` es la fuente del modelo: diez tablas, diez PK, diez
     restricciones UNIQUE, doce FK, nueve CHECK y cuarenta índices en total
     (incluidas PK y UNIQUE). El esquema original permanece intacto.
   - Los cuatro roles se insertan en ese SQL: `ADMINISTRADOR`, `RECEPCIONISTA`,
     `BACTERIOLOGO`, `VALIDADOR`. También inserta siete exámenes. No hay contraseñas
     en esos catálogos ni se depende de IDs fijos para asignar roles.
   - `backend/prisma/schema.prisma` refleja las tablas y relaciones, pero no
     reproduce los CHECK. No sustituir este procedimiento por `prisma db push`.
   - `backend/prisma/seed.ts` utiliza una contraseña fija de demostración y crea
     cuatro usuarios. **No ejecutar `npm run seed` ni `prisma db seed` en Railway.**
   - El login compara `password_hash` con bcrypt, exige cuenta activa y emite JWT.
     El registro público crea únicamente recepcionistas inactivos; no crea al
     primer administrador. La administración existente activa cuentas, sin cambiar
     su rol. Este bootstrap no resuelve la provisión posterior de bacteriólogos o
     validadores, que requerirá otro procedimiento autorizado.
   - `/api/health` hace `SELECT 1`: confirma conectividad, sin comprobar las tablas.
     Todavía hay que probar inicialización y login tras su autorización.

2. **Qué hace cada archivo nuevo**

   - `database/init-empty-v0.1.3.sql`: crea un procedimiento auxiliar
     `labzen_initialize_empty_v013`, con `SQL SECURITY INVOKER`, y lo invoca.
     Dentro de esa única llamada comprueba base seleccionada, MySQL >= 8.0.16,
     FK activas, modo estricto, bloqueo exclusivo cooperativo y ausencia de
     **cualquier tabla o vista**. Solo después crea las diez tablas y catálogos.
     No crea bases ni usuarios MySQL, no elige un nombre de base por su cuenta,
     no desactiva FK y no contiene operaciones de borrado. Conserva columnas,
     ENUM, defaults, índices, CHECK y acciones referenciales del original.
     Cada tabla fija `utf8mb4_unicode_ci`, la collation prevista en el esquema
     original, sin modificar los valores predeterminados de la base Railway.
   - El procedimiento **queda en la base intencionalmente**. No se incluye ninguna
     instrucción para eliminarlo. Su creación puede ocurrir incluso si la llamada
     posterior rechaza una base no vacía; en ese caso no se crean tablas ni filas.
     Reimportar el archivo falla por procedimiento existente. Volver a invocar
     el procedimiento con tablas presentes también falla. No es una herramienta
     para actualizar o reparar instalaciones.
   - `backend/scripts/create-first-admin.cjs`: herramienta manual e interactiva,
     independiente del seed. Pide conexión, identidad y contraseña; oculta la URL
     y las dos entradas de contraseña. No lee `.env` ni `DATABASE_URL`. Valida la
     política de contraseña del registro actual, aplica bcrypt con costo 12 y
     crea un administrador activo más su evento `CREAR_ADMIN_INICIAL`, en una
     transacción Serializable. Exige cuatro roles exactos y **cero usuarios**;
     rechaza instalaciones ya utilizadas. No imprime hashes ni errores internos.
   - `database/verify-init-v0.1.3.sql`: exclusivamente `SELECT` y `SHOW CREATE TABLE`.
     Lista tablas, restricciones, CHECK aplicados, FK con sus acciones, índices,
     catálogos y conteos; comprueba formato bcrypt sin devolver el hash.

3. **Preparar una conexión autorizada, antes de ejecutar nada**

   Utilizar una terminal privada, sin grabación de sesión ni pantalla compartida,
   y desactivar trazas del shell con `set +x`. No pegar claves en comandos, URLs
   visibles, mensajes o archivos del repositorio. No usar `MYSQL_PWD`, argumentos
   `--password=...`, `echo "$DATABASE_URL"`, volcados de variables ni `railway variables`.
   El cliente `mysql --password` pide la clave sin eco. El script de administrador
   pide la URL completa también sin eco. Las claves existen en memoria durante la
   operación; solo el hash bcrypt de la contraseña administrativa se persiste en
   `usuarios`. JavaScript no garantiza borrar inmediatamente cadenas de memoria.

   Hace falta un entorno de operador **ya autorizado**, con el repositorio, Node
   >= 20, dependencias del backend y Prisma Client generado, además del cliente
   oficial MySQL 8. No se han instalado herramientas como parte de esta preparación.
   El usuario MySQL necesita `SELECT` sobre toda la base elegida (para que la
   comprobación de tablas tenga visibilidad completa), `CREATE`, `INSERT`,
   `CREATE ROUTINE` y `EXECUTE`. Es una cuenta de provisión; no añadir estos
   privilegios permanentemente al backend ni crear un endpoint de bootstrap.

   Elegir **una** de estas conexiones previamente autorizadas:

   - Entorno de operador dentro de la red privada del mismo proyecto/entorno
     Railway, o mediante un túnel privado autenticado ya configurado. Usar su
     host/puerto privado. Un dominio `*.railway.internal` no es una dirección para
     conectarse directamente desde un portátil fuera de esa red. La base privada
     se selecciona por su nombre real, que puede ser `railway`; el SQL no fuerza
     `laboratorio_bacteriologico`.
   - Desde una máquina local, usar el host/puerto del TCP Proxy autorizado **solo
     con TLS MySQL verificado**, si el servidor lo tiene configurado: CA confiable
     y nombre del servidor compatibles con `VERIFY_IDENTITY`. El HTTPS del backend
     no demuestra TLS en MySQL. Si esa conexión no ofrece TLS verificado, usar el
     entorno privado/túnel autorizado; no desactivar la verificación para acceder
     al proxy público.

   Railway distingue conexión privada y TCP Proxy público; consultar sus
   [instrucciones MySQL](https://docs.railway.com/databases/mysql) y
   [TCP Proxy](https://docs.railway.com/networking/tcp-proxy). Para Prisma 6,
   consultar los [parámetros TLS de MySQL](https://docs.prisma.io/docs/orm/v6/overview/databases/mysql).
   Esta guía no habilita exposición pública ni configura túneles por sí misma.

4. **Seleccionar el destino y hacer la comprobación previa de solo lectura**

   Ejecutar desde la raíz del repositorio, con Bash y cliente oficial MySQL.
   Mantener el backend sin tráfico de escritura/registro público y detener otros
   procesos que puedan inicializar la base hasta terminar la verificación. El
   bloqueo SQL solo coordina llamadas a este inicializador; no detiene otros DDL.

   ```bash
   set +x
   read -r -p 'Host MySQL autorizado: ' labzen_db_host
   read -r -p 'Puerto MySQL autorizado: ' labzen_db_port
   read -r -p 'Base exacta a inicializar: ' labzen_db_name
   read -r -s -p 'Usuario MySQL de provision: ' labzen_db_user
   printf '\n'
   labzen_mysql=(mysql --no-defaults --no-login-paths --protocol=TCP
     --host="$labzen_db_host" --port="$labzen_db_port"
     --user="$labzen_db_user" --database="$labzen_db_name"
     --default-character-set=utf8mb4 --connect-timeout=15 --password)
   ```

   Para TLS verificado desde una máquina externa:

   ```bash
   read -r -p 'Ruta absoluta a la CA MySQL aprobada: ' labzen_ca_path
   labzen_mysql+=(--ssl-mode=VERIFY_IDENTITY --ssl-ca="$labzen_ca_path")
   ```

   Si se utiliza exclusivamente la red privada o un túnel autenticado existente,
   se puede seleccionar este modo para el tramo MySQL transportado dentro de
   esa conexión privada (nunca para un TCP Proxy público directo):

   ```bash
   labzen_mysql+=(--ssl-mode=DISABLED)
   ```

   Usar una sola opción de transporte. La opción TLS requiere una configuración
   real del servidor, no basta con disponer del TCP Proxy. Los flags
   `--no-defaults --no-login-paths` evitan heredar opciones peligrosas de otros
   perfiles. Nunca añadir `--force` ni ejecutar el archivo mediante un cliente
   que ignore errores. La clave MySQL se solicita de nuevo en cada conexión.

   ```bash
   "${labzen_mysql[@]}" --batch --execute='
     SELECT DATABASE() AS destino, VERSION() AS version_mysql,
            @@SESSION.foreign_key_checks AS fk_activadas, @@SESSION.sql_mode AS sql_mode;
     SELECT table_name, table_type FROM information_schema.tables WHERE table_schema=DATABASE();
     SELECT routine_name FROM information_schema.routines WHERE routine_schema=DATABASE();
     SELECT trigger_name FROM information_schema.triggers WHERE trigger_schema=DATABASE();
     SELECT event_name FROM information_schema.events WHERE event_schema=DATABASE();
     SHOW SESSION STATUS LIKE "Ssl_cipher";
   '
   ```

   Revisar el nombre de la base: debe ser exactamente el autorizado. La lista de
   tablas/vistas debe estar vacía, así como procedimientos, triggers y eventos
   antes de la primera importación. MySQL debe ser >= 8.0.16, con FK activas y
   modo estricto. En la variante TLS `Ssl_cipher` debe contener un cifrado.
   Si algo no coincide, detenerse. No borrar objetos para hacer pasar la revisión.

5. **Inicializar, únicamente tras revisar y autorizar**

   ```bash
   "${labzen_mysql[@]}" --batch < database/init-empty-v0.1.3.sql
   ```

   Comprobar código de salida cero y mensaje final de inicialización completada.
   Ante cualquier error **no seguir ni repetir a ciegas**. MySQL confirma DDL
   implícitamente: `ROLLBACK` no revierte las tablas ya creadas. El bloque de
   catálogos sí es transaccional. Un fallo puede dejar tablas parciales o solo el
   procedimiento; inspeccionar de solo lectura y acordar recuperación aparte.
   No se proporciona un reset automático. Ver
   [commits implícitos de MySQL](https://dev.mysql.com/doc/refman/8.4/en/implicit-commit.html).

6. **Verificar el esquema antes de crear el administrador**

   ```bash
   "${labzen_mysql[@]}" --batch < database/verify-init-v0.1.3.sql
   ```

   Esperado: diez tablas InnoDB con `utf8mb4_unicode_ci`, diez PK, diez UNIQUE,
   doce FK, nueve CHECK con `ENFORCED=YES`, y cero diferencias en los manifiestos
   de restricciones e índices. Revisar las definiciones de `SHOW CREATE TABLE`
   contra `schema.sql`, incluidas las columnas y las expresiones CHECK.
   Dos FK tienen `ON DELETE CASCADE`, una `SET NULL`, el resto RESTRICT/NO ACTION:
   se preserva el comportamiento original; la inicialización no ejecuta borrados.
   Debe haber exactamente cuatro roles y siete exámenes con los valores originales,
   cero usuarios y cero filas en las otras tablas. El único procedimiento previsto
   es `labzen_initialize_empty_v013`, de tipo PROCEDURE y seguridad INVOKER.
   Triggers y eventos deben estar vacíos. Estas consultas muestran evidencia para
   revisión humana; un código de salida cero por sí solo no certifica el modelo.

7. **Crear el primer administrador manualmente**

   ```bash
   node backend/scripts/create-first-admin.cjs
   ```

   Introducir la URL de conexión autorizada por el canal oculto; codificar los
   caracteres especiales de usuario/clave como exige una URL MySQL. Usar la misma
   base revisada. En conexión pública con TLS configurado, incluir los parámetros
   de Prisma 6 `sslcert=/ruta/ca.pem&sslaccept=strict`; el archivo CA no es una
   contraseña y debe corresponder al servidor autorizado. No usar
   `accept_invalid_certs`. En red privada/túnel, usar su dirección autorizada.
   La herramienta no hereda los flags de transporte del cliente `mysql`:
   comprobar también la configuración TLS en la URL de Prisma.

   Solicita nombre de usuario, correo y nombre completo. La contraseña se pide
   dos veces, sin eco: mínimo doce caracteres, mayúscula, minúscula, número,
   símbolo y máximo 72 bytes UTF-8 (límite de bcrypt). No se proporciona ningún
   valor predeterminado. Confirmar escribiendo `CREAR <nombre_de_base>` tras revisar
   host y puerto mostrados. No se abren conexiones antes de esa confirmación.
   Un reintento con usuarios existentes se rechaza, sin cambiar cuentas.

   Volver a ejecutar la verificación del paso 6: debe aparecer exactamente un
   usuario activo con rol `ADMINISTRADOR`, formato bcrypt válido, costo 12 y un
   evento `CREAR_ADMIN_INICIAL`. Las tablas operativas siguen vacías.
   Si la creación falla o se pierde la conexión, inspeccionar primero: puede
   haberse confirmado la transacción aunque no haya llegado el mensaje de éxito.

8. **Cerrar la provisión**

   Restablecer el acceso del backend después de verificar. Probar el login desde
   la interfaz HTTPS con la contraseña elegida y comprobar el perfil. El login
   escribe último acceso y auditoría, por eso no forma parte de la verificación
   de solo lectura y requerirá su autorización operativa. Mantener el seed demo
   fuera del despliegue y retirar el acceso de provisión según la política del
   proyecto. No guardar claves, URL, hash ni capturas de la sesión en Git.

   ```bash
   unset labzen_db_host labzen_db_port labzen_db_name labzen_db_user labzen_mysql labzen_ca_path
   ```

**Comprobaciones locales que no requieren base:**

```bash
node --check backend/scripts/create-first-admin.cjs
node backend/scripts/create-first-admin.cjs --help
git diff --check
git diff -- database/schema.sql backend/prisma/schema.prisma backend/prisma/seed.ts
```

La última orden debe mostrar que los tres archivos originales no cambiaron. La
revisión estática no sustituye una futura prueba del SQL y del bootstrap en una
base desechable expresamente autorizada. No ejecutar los scripts SQL de pruebas
existentes como comprobación de solo lectura.
