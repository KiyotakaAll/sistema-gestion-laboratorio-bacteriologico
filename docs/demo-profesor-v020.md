# LabZen v0.2.0: demostración al profesor

Preparada el 23 de noviembre de 2026.
Referencia: `55119cb9c48982edc1fac680800e98ce8f2ff880`.

## Qué se puede presentar hoy

**Demostración parcial, verificable y sin escribir en bases existentes.**
Abrir [la presentación local](demo-profesor-v020.html). Funciona sin Internet,
sin iniciar sesión y sin conectar a una base de datos. Es una presentación de
evidencias; no es una instancia funcional ni una simulación interactiva de LabZen.

Se comprobó por HTTP que el frontend existente sirve `/login` en el puerto 5173
y que `GET http://127.0.0.1:3000/api/health` devuelve `status: ok`. El healthcheck
comprueba una conexión de base mediante `SELECT 1`. Esto no demuestra que las
funcionalidades nuevas funcionen de extremo a extremo.

La configuración apunta a una base local, sin identificación de prueba
desechable. Los servicios locales de base están activos; el cliente `mysql`
instalado se identifica como MariaDB. No se consultó la versión del servidor ni
su esquema, ni se realizaron inicios de sesión o escrituras. Las migraciones
candidatas exigen verificar MySQL 8.4; no suponer compatibilidad por el nombre
del comando cliente.

Las tres banderas tienen valor predeterminado `false` y no aparecen habilitadas
en la configuración local inspeccionada. No se cambiaron. Una configuración
distinta del proceso ya iniciado no se puede descartar con el healthcheck.

## Evidencias y límites

- **Aplicación real accesible:** pantalla pública de acceso y healthcheck del
  backend. No se inició sesión sobre la base local sin clasificar: el acceso
  puede actualizar datos de sesión o auditoría.
- **Código real ejecutado offline:** 14 casos de funciones puras y validadores,
  registrados en [el archivo de resultados](demo-profesor-v020-evidencia.json).
  Incluyen identificación sin documento, edad pediátrica, fechas, permisos,
  transiciones y validadores de médico/alta de usuario. No equivalen a crear
  registros, comprobar autorizaciones HTTP ni probar bloqueos MySQL.
- **Capturas históricas de interfaz:** React real con API interceptada y datos
  de prueba del navegador, según [su procedencia](capturas/v020-estetica-final/auditoria.json).
  Muestran diseño y ubicación de pantallas; no prueban persistencia ni las
  correcciones posteriores. Algunas contienen nombres de personas de prueba.
- **Implementado, pendiente de demostración integrada:** identificación ampliada,
  directorio y vínculo por ID, sesiones operativas, alta administrativa y
  conflictos concurrentes en una base aislada preparada. No afirmar que se
  ejecutaron hoy mediante formularios o contra MySQL real.

## Recorrido exacto: siete minutos

Mantener abiertas tres pestañas: `/login`, la presentación HTML y este documento.
Si `/login` no responde, comenzar directamente con la presentación local.

| Tiempo | Pantalla y acción | Explicación sencilla | Resultado observable / alternativa |
| --- | --- | --- | --- |
| 0:00–0:40 | Abrir `http://127.0.0.1:5173/login`, sin enviar credenciales. Volver a la portada de la presentación. | «La aplicación local responde. Para proteger la base existente, hoy separaré interfaz y comprobaciones de lógica». | Se ve el acceso real. Si falla, usar su captura histórica y declarar que es una imagen. |
| 0:40–2:00 | Sección 1: pacientes. Mostrar captura y salida `identificacion`, `edad-dias`, `edad-meses`, `fecha-imposible` y `fecha-futura`. | «Un recién nacido puede registrarse sin inventar un documento. La edad puede expresarse en días o meses y se rechazan fechas inválidas». | Salida real offline: documento nulo con motivo, `13 días`, `3 meses`, fecha imposible `false`, fecha futura `null`. La captura antigua no contiene el formulario nuevo. No guardar pacientes en la base actual. |
| 2:00–2:50 | Sección 2: solicitud y médicos. Mostrar salida `medico-sin-registro`. | «El directorio permite elegir un remitente estable sin exigir un registro profesional desconocido. El texto histórico se conserva». | Validador acepta registro profesional ausente. La captura muestra la solicitud histórica, no una selección nueva por ID. Si no hay base de prueba, explicar el vínculo preparado sin simular una selección funcional. |
| 2:50–3:50 | Sección 3: permisos. Mostrar las tres salidas de permisos. | «El auxiliar recibe muestras; el bacteriólogo valida. Administrar usuarios es una capacidad separada». | Función de política: recibir `true`, validar `true`, administrar como bacteriólogo `false`. Se invocó con política operativa como parámetro, sin habilitar el servidor. No presentar un inicio de sesión AUXILIAR como realizado. |
| 3:50–5:20 | Sección 4: detalle de muestra y transiciones. Mostrar `muestra-no-recibida` y `muestra-recibida`. Abrir el documento de flujo si preguntan por concurrencia. | «No se procesa una muestra antes de recibirla. La validación profesional exige doble firma; los conflictos deben impedir sobrescribir cambios». | Política pura: iniciar desde REGISTRADA `false`; desde RECEPTADA `true`. Doble firma, auditoría y HTTP 409 están implementados/documentados, pero no se reprodujeron hoy en MySQL. No pulsar cambios clínicos ni afirmar que una imagen prueba bloqueo concurrente. |
| 5:20–6:30 | Sección 5: usuarios. Mostrar las tres salidas del validador de alta. | «La creación operativa la realiza una cuenta administrativa; no se pueden crear administradores desde ese formulario». | Validador acepta BACTERIOLOGO y rechaza ADMINISTRADOR/clave débil. La captura es el listado anterior; no muestra el formulario nuevo ni demuestra autorización, hash o alta persistida. |
| 6:30–7:00 | Sección 6: pendientes y activación. | «El código está preparado, pero la activación requiere un entorno identificado, migraciones aprobadas y pruebas integradas». | Enseñar [la guía de activación](activacion-v020.md). Cerrar aclarando qué fue ejecutado y qué requiere ese entorno. |

## Inicio y apertura en Fish

Las dependencias ya existen. No instalar, generar Prisma, ejecutar seeds ni
migrar para este recorrido. No reiniciar ni detener los servicios existentes.

### Opción inmediata: presentación sin base

```fish
set repo /home/single_tomas/Proyectos/LaboratorioBacteriologico/proyecto/laboratorio-bacteriologico
xdg-open "$repo/docs/demo-profesor-v020.html"
```

Si el navegador no abre archivos locales, servir solamente `docs`, en otra terminal:

```fish
set repo /home/single_tomas/Proyectos/LaboratorioBacteriologico/proyecto/laboratorio-bacteriologico
python3 -m http.server 8765 --bind 127.0.0.1 --directory "$repo/docs"
```

Abrir `http://127.0.0.1:8765/demo-profesor-v020.html`. Para terminar ese servidor
de presentación, usar Ctrl+C en su terminal. No publica la aplicación en Internet.

### Aplicación local: comprobar primero lo que ya está iniciado

```fish
curl --fail --max-time 5 http://127.0.0.1:3000/api/health
curl --fail --max-time 5 --output /dev/null --write-out '%{http_code}\n' http://127.0.0.1:5173/login
xdg-open http://127.0.0.1:5173/login
```

Si responden, usar esas instancias. Si el frontend se detuvo, iniciarlo así:

```fish
cd /home/single_tomas/Proyectos/LaboratorioBacteriologico/proyecto/laboratorio-bacteriologico/frontend
npm run dev -- --host 127.0.0.1 --port 5173 --strictPort
```

Si el backend se detuvo, este es el comando existente, **solo después de
identificar y autorizar su base de destino**. No hace falta para la presentación:

```fish
cd /home/single_tomas/Proyectos/LaboratorioBacteriologico/proyecto/laboratorio-bacteriologico/backend
npm run dev
```

El backend usa `backend/.env`; no mostrar su contenido ni copiarlo a la
presentación. El frontend usa `/api` mediante proxy al backend local en 3000.
No modificar ni exportar banderas para intentar hacer aparecer formularios.

### Comprobación viva opcional, sin base: edad y fechas

Esta llamada ejecuta las funciones actuales y bloquea red, dotenv y PrismaClient
mediante la precarga de seguridad existente. No es una suite de pruebas.

```fish
cd /home/single_tomas/Proyectos/LaboratorioBacteriologico/proyecto/laboratorio-bacteriologico/backend
env TSX_DISABLE_CACHE=1 node --require tsx/cjs --require ./tests/solo-mocks.cjs -e 'const {formatEdad,fechaCivilValida,edadCivil}=require("../frontend/src/utils/format.ts"); console.log(JSON.stringify({dias:formatEdad("2026-11-10","2026-11-23"),meses:formatEdad("2026-08-23","2026-11-23"),fechaImposible:fechaCivilValida("2026-02-30"),fechaFutura:edadCivil("2026-11-24","2026-11-23")},null,2));'
```

Salida esperada: `13 días`, `3 meses`, `false` y `null`, respectivamente. Las
fechas de referencia están fijas para que la demostración no cambie mañana.

## Índice de capturas y plan alternativo

Todas las imágenes siguientes son anteriores a esta preparación y proceden de
la colección visual con API simulada. Están insertadas en la presentación para
evitar búsquedas durante la exposición. No se generaron capturas nuevas.

| Imagen | Uso permitido | Lo que no demuestra |
| --- | --- | --- |
| [Acceso](capturas/v020-estetica-final/despues/login-con-estilos-internos-1440.png) | Alternativa si falla el frontend. | Una sesión autenticada actual. |
| [Pacientes](capturas/v020-estetica-final/despues/pacientes-1440.png) | Diseño de listado y ubicación de admisión. | Identificación ampliada ni pacientes pediátricos actuales. |
| [Nueva solicitud](capturas/v020-estetica-final/despues/nueva-solicitud-1440.png) | Ubicación del remitente en el flujo histórico. | Selector nuevo de médicos ni asociación por ID. |
| [Detalle de muestra](capturas/v020-estetica-final/despues/detalle-muestra-1440.png) | Organización visual del flujo clínico. | Transición persistida, permisos actuales, doble firma o concurrencia. |
| [Usuarios](capturas/v020-estetica-final/despues/usuarios-1440.png) | Gestión de usuarios existente. | Alta administrativa nueva o creación de AUXILIAR. |

No utilizar `referencia-medicos-1440.png` como evidencia del directorio
implementado: es una referencia visual. Tampoco usar capturas antiguas con
botones de validación bajo un administrador para afirmar que ese rol puede
validar con la política nueva.

Si falla toda conexión local: abrir el HTML como archivo y recorrer las mismas
secciones. Si no carga una imagen: abrirla desde los enlaces de esta tabla. Si
preguntan por una interacción no disponible: decir «está implementada, pero no
ejecutada en esta demostración; requiere activar el entorno de prueba» y mostrar
la salida offline o la documentación pertinente, sin improvisar registros.

## Antes de presentar: dos minutos

1. Abrir presentación e imágenes y ampliar el navegador hasta que se lean.
2. Comprobar `/login` y `/api/health`, sin enviar credenciales ni crear datos.
3. Ejecutar opcionalmente la comprobación de edad anterior.
4. Tener abierta la evidencia JSON y [flujo clínico](flujo-clinico-v020.md).
5. Ocultar terminales/configuraciones con secretos y pestañas de producción.
6. Ensayar el recorrido sin superar siete minutos. No activar funciones durante
   la explicación ni atribuir a MySQL lo comprobado únicamente offline.

## Para una demostración funcional completa o por enlace

Hace falta identificar una **base MySQL 8.4 local, aislada y desechable** y recibir
autorización explícita para prepararla y aplicar allí las tres migraciones.
No se ha identificado ni autorizado una en esta tarea. No usar automáticamente
la base local existente: que esté en localhost no la hace desechable.

Seguir [la guía aprobada como procedimiento](activacion-v020.md), con sus puntos
de aprobación y comprobaciones: migraciones `001 → 002 → 003` con banderas
apagadas; activación gradual de médicos, pacientes y finalmente permisos.
Conservar administrador vigente; comprobar catálogo AUXILIAR, crear cuentas de
prueba mediante el alta autorizada y renovar sesiones JWT. No convertir usuarios
ni solicitudes históricas automáticamente. No iniciar la secuencia como parte
de esta exposición.

Después, comprobar de forma integrada las seis correcciones y dos sesiones
concurrentes, utilizando exclusivamente datos sintéticos identificados. Hasta
entonces no hay evidencia nueva de persistencia, bloqueos reales o alta de cuentas.

Un enlace público funcional requiere además un alojamiento aprobado, backend y
frontend compatibles, HTTPS, secretos fuera del repositorio, configuración de
origen/API y cuentas de prueba en una base separada. El servidor de presentación
en 127.0.0.1 no proporciona ese enlace. Publicar una presentación estática también
requiere aprobación y revisión de qué documentos/capturas se compartirán; no
subir todo `docs` ni la configuración local.

## Cambios de esta preparación

Solo se añaden esta guía, `demo-profesor-v020.html` y
`demo-profesor-v020-evidencia.json`. No se cambió código de producto ni diseño,
no se ejecutaron suites completas, migraciones, seeds, despliegues o commits.
No se detectó un bloqueo de inicio que requiriera corregir el producto.
