import bcrypt from 'bcrypt';
import { env } from '../src/config/env';
import { prisma } from '../src/config/prisma';
import type { RolNombre } from '../src/types/auth';

/**
 * Crea un usuario demo por rol. Los roles y exámenes ya los inserta schema.sql.
 * Se crean DOS perfiles con capacidad de firma distintos (BACTERIOLOGO y
 * VALIDADOR) para poder demostrar la doble firma: quien registra un resultado
 * no puede validarlo.
 *
 * ⚠ Contraseña de DEMOSTRACIÓN. Cambiarla antes de cualquier uso real.
 */
const PASSWORD_DEMO = 'Lab2026*';

interface UsuarioSemilla {
  username: string;
  email: string;
  nombreCompleto: string;
  rol: RolNombre;
}

const usuarios: UsuarioSemilla[] = [
  { username: 'admin', email: 'admin@laboratorio.local', nombreCompleto: 'Administrador del Sistema', rol: 'ADMINISTRADOR' },
  { username: 'recepcion', email: 'recepcion@laboratorio.local', nombreCompleto: 'Rosa Elena Martínez', rol: 'RECEPCIONISTA' },
  { username: 'bacteriologo', email: 'bacteriologo@laboratorio.local', nombreCompleto: 'Carlos Andrés Gómez', rol: 'BACTERIOLOGO' },
  { username: 'validador', email: 'validador@laboratorio.local', nombreCompleto: 'Dra. Luisa Fernanda Ortiz', rol: 'VALIDADOR' },
];

async function main(): Promise<void> {
  const passwordHash = await bcrypt.hash(PASSWORD_DEMO, env.BCRYPT_ROUNDS);

  for (const u of usuarios) {
    const rol = await prisma.rol.findUnique({ where: { nombre: u.rol } });
    if (!rol) {
      throw new Error(`El rol ${u.rol} no existe. Ejecute primero database/schema.sql.`);
    }

    await prisma.usuario.upsert({
      where: { username: u.username },
      update: {},
      create: {
        username: u.username,
        email: u.email,
        nombreCompleto: u.nombreCompleto,
        passwordHash,
        rolId: rol.id,
      },
    });
    console.log(`Usuario listo: ${u.username} (${u.rol})`);
  }
}

main()
  .catch((error: unknown) => {
    console.error('Error al ejecutar el seed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
