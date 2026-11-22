# Ensayo 1.3B de identificación: Prisma 6.19.3 y MySQL 8.4

Este directorio es un experimento separado. No se importa desde la aplicación, no modifica su esquema Prisma ni constituye una migración aplicable a LabZen.

## Estado de la intervención

- Rama inicial: `feature/labzen-v020-pacientes`.
- Commit inicial: `9839994755f1eb5dd14cfc88c0c7f3e15cbcf717`.
- El daemon Docker local rechazó la consulta de versión por permisos, también fuera del sandbox. No se crearon contenedores ni redes.
- El binario local llamado `mysqld` es **MariaDB 13.0.2**. No se inició ni utilizó como sustituto de MySQL.
- Prisma CLI y Client instalados: **6.19.3**. Motor observado: `c2990dca591cba766e3b7ef5d9e8a84796e47ab7`, destino `debian-openssl-3.0.x`. Node observado: 26.11.1; TypeScript: 5.9.3.
- Esquema validado, cliente separado generado y contrato TypeScript comprobado sin conexión. Los resultados SQL, errores reales Prisma y concurrencia siguen **pendientes**.
- Pruebas ejecutadas: 36 de protección nuevas y 121 del núcleo 1.3A, todas aprobadas. Typechecks del contrato generado y del backend aprobados. Casos MySQL ejecutados: **cero**.

## Archivos

| Archivo | Finalidad |
| --- | --- |
| `schema.prisma` | Modelo mínimo con `String? @unique`, salida de cliente independiente y relaciones por IDs. |
| `schema.sql` | DDL candidato, con tres CHECK nuevos y collation explícita. Nunca aplicarlo manualmente. |
| `ensayo.cjs` | Modos offline y MySQL; crea únicamente una instancia nueva y elimina únicamente sus propios recursos. |
| `seguridad.cjs` | Validación de destino, aislamiento y construcción de un entorno sin variables heredadas. |
| `seguridad.test.cjs` | Pruebas unitarias de protección. Sus fixtures Docker no demuestran aislamiento real. |
| `sin-red.cjs` | Bloquea red y lecturas de `.env` durante las comprobaciones offline. |
| `integracion.cjs` | Fixtures sintéticos y casos reales de persistencia; solo lo invoca el modo MySQL. |

## Ejecución sin base de datos

Desde la raíz del repositorio, con las dependencias actuales ya instaladas:

```bash
node backend/experiments/identificacion-prisma-mysql/seguridad.test.cjs
node backend/experiments/identificacion-prisma-mysql/ensayo.cjs --offline
```

El segundo comando crea un directorio privado nuevo en `/tmp/labzen-ident-13b-*`. Copia allí el esquema experimental y ejecuta únicamente `prisma --version`, `validate`, `generate`, un `migrate diff --from-empty --to-schema-datamodel ... --script` sin conexión, inspección del cliente generado y `tsc --noEmit`. El SQL renderizado se conserva como `representacion-prisma-no-aplicar.sql`; **no se ejecuta**.

No usa `npx`, no instala paquetes y exige versiones exactas 6.19.3. El generador se resuelve mediante un enlace al paquete existente `@prisma/client`; escribe su salida en el directorio temporal, sin regenerar el cliente de la aplicación. Los procesos reciben un entorno construido desde cero, una URL sintética que no se utiliza para conectar y un preload que impide red y lecturas de `.env`.

En esta ejecución, el renderizado Prisma declaró `VARCHAR(64) NULL` y `UNIQUE INDEX uq_ensayo_clave`. También emitió `utf8mb4_unicode_ci` como collation de tabla y **ningún CHECK**: no reproduce la collation `utf8mb4_0900_bin` ni los controles del SQL candidato. Por tanto, no sirve como reemplazo de ese SQL. Los últimos artefactos offline de esta sesión quedaron en `/tmp/labzen-ident-13b-0ee37b`; son temporales y reproducibles.

## Requisitos pendientes para ejecutar MySQL

El usuario debe habilitar acceso autorizado al daemon **local** `/var/run/docker.sock` y disponer previamente de una imagen oficial `mysql:8.4` en ese daemon. No se incluyen instalaciones, descargas automáticas, `sudo`, cambios de permisos ni modificaciones de servicios existentes.

Cuando ese entorno esté autorizado y disponible:

```bash
node backend/experiments/identificacion-prisma-mysql/ensayo.cjs --mysql --confirmar-instancia-nueva
```

El comando vuelve a ejecutar las comprobaciones offline. Luego:

1. Usa exclusivamente el socket local explícito, configuración Docker vacía propia y `--pull=never`; registra el ID inmutable de imagen.
2. Crea una red bridge **interna** nueva y un contenedor nuevo, ambos con token aleatorio y etiqueta propia.
3. Guarda los datos MySQL exclusivamente en `tmpfs`, sin bind mounts, volúmenes compartidos, red host ni otras redes.
4. Publica únicamente `3306` en un puerto aleatorio de `127.0.0.1`. Si esa publicación no funciona con una red interna en la versión de Docker disponible, se detiene: no rebaja el aislamiento.
5. Genera base, usuario y contraseñas sintéticos. No acepta una URL del usuario ni lee variables de conexión del proyecto.
6. Antes de conectar y de cada consulta Prisma, comprueba destino, IDs, fecha de creación, etiquetas, imagen, montajes, red interna exclusiva y publicación local. El hijo solo acepta el proceso padre que creó la instancia.
7. Comprueba versión MySQL 8.4 y modo SQL estricto. Aplica exclusivamente el SQL experimental; ejecuta los casos reales y registra resultados y códigos de error.
8. En `finally`, elimina solo el contenedor y la red creados por esa ejecución, después de comprobar sus etiquetas. Nunca ejecuta limpieza global ni opera sobre servicios del proyecto.

El directorio temporal conserva evidencias y, durante el ensayo, credenciales sintéticas con permisos privados. No publicarlas. Una terminación forzada del proceso podría impedir el `finally`: en ese caso se deben revisar los IDs y etiquetas impresos antes de autorizar una retirada manual. No usar comandos globales de limpieza.

**Este modo todavía no se ha ejecutado.** La compatibilidad del arranque del contenedor, su red y todos los casos SQL requieren la primera ejecución real.

## Modelo y reglas candidatas

| Campo | Tipo SQL | Nulabilidad |
| --- | --- | --- |
| `id` | INT UNSIGNED AUTO_INCREMENT | NOT NULL; misma representación que el ID real |
| `cedula` | VARCHAR(20), utf8mb4_unicode_ci, UNIQUE | NULL permitido; original histórico conservado |
| `estadoIdentificacion` | VARCHAR(32) | NOT NULL, restringido por CHECK |
| `tipoDocumento` | VARCHAR(3) | Según estado |
| `numeroDocumento` | VARCHAR(20) | Según estado |
| `paisEmisorDocumento` | VARCHAR(2) | NULL para emisor fijo; obligatorio para PA |
| `claveIdentificacion` | VARCHAR(64), UNIQUE | NULL permitido |
| `motivoAusenciaDocumento` | VARCHAR(255) | Obligatorio para ambos estados de ausencia |
| `versionIdentificacion` | INT UNSIGNED DEFAULT 0 | NOT NULL |

Las columnas nuevas usan `utf8mb4_0900_bin`, con comparación sensible a mayúsculas y NO PAD. La cédula conserva la collation histórica **declarada en el script**, no una collation comprobada contra una base real. Prisma no expresa aquí las collations ni los CHECK; el SQL candidato los declara explícitamente.

Los tres controles se complementan:

- `ck_ensayo_estado`: combinaciones válidas de estado, documento, legado y motivo.
- `ck_ensayo_formato`: catálogo, límites, ASCII y país; el patrón busca cualquier carácter ajeno al conjunto, evitando el caso de un salto final tolerado por algunos anclajes `$`.
- `ck_ensayo_clave`: fórmula completa `TIPO:PAIS_EFECTIVO:UPPER(NUMERO)` comparada con `CAST(... AS BINARY)` en ambos operandos. Solo se aplica a componentes previamente restringidos a ASCII. Las regex reciben texto, no valores BINARY.

Cada condición principal termina en `IS TRUE`: SQL permite que un CHECK ordinario acepte UNKNOWN. El experimento incluye una tabla de contraste para demostrarlo; no se asume que los controles funcionen hasta ejecutarlos.

El almacenamiento exige componentes ya normalizados; no hace trim ni corrige datos de forma silenciosa. El núcleo TypeScript recorta y valida antes de persistir. El motivo SQL comprueba longitud, blancos ASCII exteriores y controles, pero **no reproduce exactamente todo `String.trim()` Unicode ni el conteo UTF-16 de JavaScript**. Esa diferencia debe resolverse o aceptarse expresamente antes de convertir este candidato en una migración.

Si MySQL no acepta las funciones del CHECK o aparece una diferencia respecto del núcleo, el ensayo debe fallar. Una alternativa posterior sería una columna generada para la clave; requeriría decidir propiedad del cálculo, escritura del cliente y representación Prisma, manteniendo de todas formas controles de estado y formato. No se cambia el modelo B automáticamente.

## Matriz de persistencia pendiente

| Grupo | Comprobación real prevista |
| --- | --- |
| Metadatos | UNIQUE nullable, collation NO PAD y tres CHECK ENFORCED en information_schema. |
| Documentos | Los seis tipos; ceros iniciales, guiones y capitalización mostrada conservados. |
| Ausencia | Tres pacientes sin documento, IDs distintos y claves NULL. |
| Búsquedas | `findUnique` con clave confirmada; rechazo de clave NULL. |
| Unicidad | Exacta, normalizada por mayúsculas, diferente tipo/país y actualización a clave ocupada. |
| SQL directo a través del cliente | Campos omitidos, estados contradictorios, caracteres, longitudes, claves falsas y país incompatible. |
| CHECK y NULL | Tabla que acepta UNKNOWN frente a control con `IS TRUE`. |
| Concurrencia | Dos creaciones con barrera y escrituras clínicas anidadas: un éxito, un P2002, una sola cadena completa. |
| Relaciones | Paciente → Solicitud → Muestra → MuestraExamen → Resultado; cambio documental sin cambiar IDs ni asociaciones; FK inválida. |
| Transacciones | DML totalmente revertido ante conflicto; DDL que permanece pese al intento de rollback. |
| Aditividad | Tabla histórica mínima, columnas nuevas, clasificación LEGADO y conservación de cédula/ID/FK. |

P2002, P2003 y P2000 son **resultados esperados**, no observados en esta intervención. El código CHECK de Prisma se registra sin asumir una traducción fija; se exige una violación CHECK reconocible. Los fallos se conservan en el informe y hacen fallar el proceso. No hay mocks que sustituyan estas verificaciones.

## Nueve CHECK del esquema existente

Inspeccionados únicamente en `database/schema.sql`:

1. `ck_roles_nombre`.
2. `ck_examenes_precio`.
3. `ck_muestras_codigo_barras`.
4. `ck_muestras_rechazo`.
5. `ck_muestras_recepcion`.
6. `ck_muestras_fechas`.
7. `ck_resultados_validacion`.
8. `ck_resultados_doble_firma`.
9. `ck_antibiograma_halo`.

No recaen en los campos documentales nuevos. Por inspección no hay conflicto directo con los tres controles candidatos; esto **no demuestra su preservación en una migración**. No se copiaron ni ejecutaron los scripts de inicialización. El ensayo mínimo omite reglas clínicas, usuarios y catálogo: su coexistencia completa y las acciones referenciales reales deben verificarse después sobre una copia aislada y sintética del esquema real.

## Orden recomendado para una migración futura, todavía no autorizada

1. Completar este ensayo MySQL. Después, inspeccionar el esquema efectivo mediante una intervención autorizada; inventariar motor, sql_mode, collations, índices, FK y los nueve CHECK.
2. Preparar respaldo y probar restauración. Ensayar DDL y recuperación en un entorno aislado con el esquema completo.
3. Desplegar un backend de transición compatible con el esquema antiguo, con nuevas admisiones deshabilitadas. Definir cómo cubrirá escrituras antiguas durante el backfill: ventana de mantenimiento breve o coordinación explícita.
4. Añadir columnas nullable, conservando ID, cédula e índices existentes. Crear el índice único de la clave mientras todas las claves son NULL, antes de permitir escrituras documentales nuevas.
5. Marcar LEGADO sin inferir tipos, verificar conteos, hashes de cédulas y referencias. Resolver cualquier fila incompleta y cerrar la ventana de escrituras antiguas antes de exigir controles finales.
6. Exigir estado y versión, aplicar CHECK ENFORCED y comprobar nuevamente todas las restricciones existentes. Este paso requiere backend escritor compatible: el POST antiguo no enviaría estado ni componentes nuevos y podría fallar.
7. Relajar nulabilidad de cédula conservando tipo, collation y UNIQUE. Hacerlo antes de admitir pacientes sin cédula, pero después de que los lectores soporten NULL.
8. Desplegar backend con cliente generado del futuro esquema real y frontend compatible; conservar compatibilidad temporal y asociaciones por ID. No rellenar cédula con documentos nuevos ni números ficticios.
9. Habilitar por etapas documentos nuevos y ausencia documental. Verificar conteos, conflictos, historial y relaciones.
10. Retirar compatibilidad solo en una fase posterior expresamente autorizada.

La secuencia propuesta inicialmente requiere coordinación: no aplicar CHECK finales con escritores antiguos activos ni habilitar NULL mientras lectores antiguos lo presuponen obligatorio. Inicializar todos los históricos no basta si continúan entrando filas con el contrato anterior.

DDL puede provocar commits implícitos. Un rollback ordinario no restaura un despliegue completo: la recuperación necesita respaldo restaurable, plan de corrección incremental y compatibilidad del código anterior con los nuevos datos. Una vez admitidos pacientes sin documento, volver a `cedula NOT NULL` no es una recuperación automática válida.

## Documentación técnica de referencia

- [Prisma v6: @unique y campos opcionales](https://www.prisma.io/docs/orm/v6/reference/prisma-schema-reference#unique).
- [MySQL 8.4: CHECK y UNKNOWN](https://dev.mysql.com/doc/refman/8.4/en/create-table-check-constraints.html).
- [MySQL 8.4: collations binarias y NO PAD](https://dev.mysql.com/doc/refman/8.4/en/charset-binary-collations.html).
- [MySQL 8.4: regex y cadenas binarias](https://dev.mysql.com/doc/refman/8.4/en/regexp.html).
- [MySQL 8.4: commits implícitos](https://dev.mysql.com/doc/refman/8.4/en/implicit-commit.html).

Estas fuentes respaldan el diseño, pero no sustituyen los experimentos MySQL pendientes.
