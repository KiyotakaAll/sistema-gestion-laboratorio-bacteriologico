import { createHash } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { prisma } from '../config/prisma';
import { exigirInformeFinal, type SolicitudDocumento } from '../domain/documentos';
import type { AuditContext } from '../types/dto';
import { AppError } from '../types/errors';
import { seleccionSolicitudBase } from './medicos-disponibilidad';
import { seleccionPacienteResumen } from './identificacion-paciente';
import { seleccionExamen, ordenesAsistidasActivas, exigirOrdenesAsistidas } from './catalogo.service';
import { exigirPermisoClinico } from './flujo-clinico.service';
import { registrarLog } from './auditoria.service';
import { generarInformePdf, generarOrdenPdf, generarRemisionVaciaPdf } from './pdf.service';

/** Una instantánea consistente; solo se seleccionan nombres/IDs de profesionales, nunca hashes ni emails. */
export async function documentoSolicitud(id: number, clase: 'informe' | 'orden', ctx: AuditContext) {
  if (ordenesAsistidasActivas()) await exigirOrdenesAsistidas();
  return prisma.$transaction(async tx => {
    await exigirPermisoClinico(tx, ctx, clase === 'informe' ? 'informes.descargar' : 'solicitudes.leer');
    const persona = { select: { id: true, nombreCompleto: true, rol: { select: { nombre: true } } } } as const;
    const solicitud = await tx.solicitud.findUnique({ where: { id }, select: {
      ...await seleccionSolicitudBase(tx), paciente: { select: { ...seleccionPacienteResumen(), fechaNacimiento: true } },
      muestras: { orderBy: { id: 'asc' }, include: { examenes: { orderBy: { id: 'asc' }, include: {
        examen: { select: seleccionExamen() }, resultado: { include: {
          antibiograma: { orderBy: { antibiotico: 'asc' } }, registradoPor: persona, validadoPor: persona,
        } },
      } } } },
    } });
    if (!solicitud) throw new AppError(404, 'La solicitud no existe.', 'SOLICITUD_NO_ENCONTRADA');
    const datos: SolicitudDocumento = { ...solicitud, ...(ordenesAsistidasActivas() ? {
      examenesSolicitados: await tx.solicitudExamen.findMany({ where: { solicitudId: id },
        include: { examen: { select: seleccionExamen() } } }),
    } : {}) };
    const emision = new Date();
    const muestras = clase === 'informe' ? exigirInformeFinal(datos) : [];
    const pdf = clase === 'informe' ? await generarInformePdf(datos, muestras, emision) : await generarOrdenPdf(datos, emision);
    await registrarLog(tx, { usuarioId: ctx.usuarioId, entidad: 'SOLICITUD', entidadId: id,
      accion: clase === 'informe' ? 'EMITIR_INFORME' : 'EMITIR_ORDEN',
      detalle: { numero: `${clase === 'informe' ? 'INF' : 'ORD'}-${solicitud.codigo}`,
        emision: emision.toISOString(), sha256: createHash('sha256').update(pdf).digest('hex'),
        ...(clase === 'informe' ? { resultadoIds: muestras.flatMap(m => m.examenes.map(e => e.resultado!.id)) } : {}),
      }, ip: ctx.ip });
    return { pdf, nombre: `${clase === 'informe' ? 'informe' : 'orden'}-${solicitud.codigo}.pdf` };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead, timeout: 15000 });
}

export async function remisionVacia(ctx: AuditContext) {
  return prisma.$transaction(async tx => {
    await exigirPermisoClinico(tx, ctx, 'solicitudes.leer');
    const pdf = await generarRemisionVaciaPdf();
    await registrarLog(tx, { usuarioId: ctx.usuarioId, entidad: 'USUARIO', entidadId: ctx.usuarioId,
      accion: 'DESCARGAR_REMISION', ip: ctx.ip });
    return { pdf, nombre: 'labzen-remision-vacia.pdf' };
  });
}
