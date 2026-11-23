# SQL incremental propuesto

`20261122_001_identificacion_pacientes.sql` es una **candidata sin ejecutar ni verificar en MySQL**. No se carga automáticamente ni es una migración Prisma con baseline.

Consultar el [protocolo de identificación y activación](../../docs/identificacion-pacientes-v020.md) antes de autorizar su ensayo o aplicación. El archivo conserva IDs, relaciones, cédula original, índices y nueve CHECK existentes; añade siete columnas, un índice único y tres CHECK.

Requiere respaldo restaurable, inspección del esquema efectivo, ventana coordinada y verificaciones antes/después. No es idempotente. DDL puede hacer commits implícitos: no reejecutar a ciegas ni prometer rollback completo. No usar inicializadores, `db push` ni `migrate deploy` para aplicar esta propuesta.
