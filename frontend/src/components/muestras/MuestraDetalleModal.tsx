import { Ban, PackageCheck, Play } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useCarga } from '../../hooks/useCarga';
import { mensajeDeError } from '../../services/api';
import { muestrasApi } from '../../services/laboratorio';
import type { EventoTrazabilidad, MuestraDetalle } from '../../types/api';
import { SEXO_ETIQUETA, calcularEdad, formatFechaHora, nombrePaciente } from '../../utils/format';
import { Alert } from '../UI/Alert';
import { Badge, ETIQUETA_ESTADO_MUESTRA, ETIQUETA_ESTADO_RESULTADO, EstadoMuestraBadge, EstadoResultadoBadge, PrioridadBadge } from '../UI/Badge';
import { Button } from '../UI/Button';
import { DataTable, type Column } from '../UI/DataTable';
import { Dato, Datos, Seccion } from '../UI/Dato';
import { Campo, Textarea } from '../UI/Form';
import { Modal } from '../UI/Modal';

type ExamenFila = MuestraDetalle['examenes'][number];

interface Props {
  muestraId: number;
  onCerrar: () => void;
  onCambio: () => void;
}

const ETIQUETA_ACCION: Record<string, string> = {
  REGISTRAR: 'Muestra registrada',
  RECEPTAR: 'Muestra receptada',
  INICIAR_PROCESAMIENTO: 'Procesamiento iniciado',
  RECHAZAR: 'Muestra rechazada',
  COMPLETAR_PROCESAMIENTO: 'Procesamiento completado',
};

const ETIQUETA_ESTADO: Record<string, string> = { ...ETIQUETA_ESTADO_MUESTRA, ...ETIQUETA_ESTADO_RESULTADO };

function motivoDelEvento(evento: EventoTrazabilidad): string | null {
  const detalle = evento.detalle;
  if (typeof detalle === 'object' && detalle !== null && 'motivoRechazo' in detalle) {
    const motivo = (detalle as { motivoRechazo: unknown }).motivoRechazo;
    return typeof motivo === 'string' ? motivo : null;
  }
  return null;
}

/** Modal Master-Detail de una muestra: datos, exámenes, trazabilidad y acciones según rol y estado. */
export function MuestraDetalleModal({ muestraId, onCerrar, onCambio }: Props) {
  const { tieneRol } = useAuth();
  const toast = useToast();
  const muestra = useCarga(() => muestrasApi.obtener(muestraId), [muestraId]);
  const trazabilidad = useCarga(() => muestrasApi.trazabilidad(muestraId), [muestraId]);

  const [ejecutando, setEjecutando] = useState(false);
  const [errorAccion, setErrorAccion] = useState<string | null>(null);
  const [rechazando, setRechazando] = useState(false);
  const [motivo, setMotivo] = useState('');

  const m = muestra.datos;
  const puedeVerResultados = tieneRol('BACTERIOLOGO', 'VALIDADOR', 'ADMINISTRADOR');

  const columnasExamenes = useMemo<Column<ExamenFila>[]>(
    () => {
      const columnas: Column<ExamenFila>[] = [
        { id: 'codigo', header: 'Código', accessor: (e) => e.examen.codigo, width: '8rem' },
        { id: 'examen', header: 'Examen', accessor: (e) => e.examen.nombre },
      ];
      if (puedeVerResultados) {
        columnas.push(
          {
            id: 'resultado',
            header: 'Resultado',
            accessor: (e) => (e.resultado ? ETIQUETA_ESTADO_RESULTADO[e.resultado.estado] : e.resultado === null ? 'Sin resultado' : ''),
            cell: (e) => (e.resultado ? <EstadoResultadoBadge estado={e.resultado.estado} /> : e.resultado === null ? <span className="text-slate-500">Sin resultado</span> : null),
          },
          { id: 'bacteria', header: 'Bacteria aislada', accessor: (e) => e.resultado?.bacteriaAislada },
        );
      }
      return columnas;
    },
    [puedeVerResultados],
  );

  async function ejecutar(accion: () => Promise<unknown>, mensajeExito: string) {
    setEjecutando(true);
    setErrorAccion(null);
    try {
      await accion();
      toast.exito(mensajeExito);
      setRechazando(false);
      setMotivo('');
      muestra.recargar();
      trazabilidad.recargar();
      onCambio();
    } catch (e) {
      setErrorAccion(mensajeDeError(e));
    } finally {
      setEjecutando(false);
    }
  }

  const puedeReceptar = m?.estado === 'REGISTRADA' && tieneRol('ADMINISTRADOR', 'RECEPCIONISTA');
  const puedeProcesar = m?.estado === 'RECEPTADA' && tieneRol('BACTERIOLOGO');
  const puedeRechazar = (m?.estado === 'REGISTRADA' || m?.estado === 'RECEPTADA') && tieneRol('ADMINISTRADOR', 'RECEPCIONISTA', 'BACTERIOLOGO');

  return (
    <Modal
      abierto
      ancho="xl"
      titulo={m ? `Muestra ${m.codigoBarras}` : 'Muestra'}
      subtitulo={m ? <EstadoMuestraBadge estado={m.estado} /> : undefined}
      onCerrar={onCerrar}
      pie={
        <>
          <Button onClick={onCerrar}>Cerrar</Button>
          {puedeRechazar && !rechazando && (
            <Button variante="peligro" icono={<Ban className="h-3.5 w-3.5" aria-hidden />} onClick={() => setRechazando(true)} disabled={ejecutando}>
              Rechazar muestra
            </Button>
          )}
          {puedeReceptar && (
            <Button variante="primario" icono={<PackageCheck className="h-3.5 w-3.5" aria-hidden />} cargando={ejecutando} onClick={() => void ejecutar(() => muestrasApi.receptar(muestraId), 'Muestra receptada')}>
              Receptar muestra
            </Button>
          )}
          {puedeProcesar && (
            <Button variante="primario" icono={<Play className="h-3.5 w-3.5" aria-hidden />} cargando={ejecutando} onClick={() => void ejecutar(() => muestrasApi.procesar(muestraId), 'Procesamiento iniciado')}>
              Iniciar procesamiento
            </Button>
          )}
        </>
      }
    >
      {muestra.error && <Alert>{muestra.error}</Alert>}
      {muestra.cargando && !m && <p className="text-slate-500">Cargando datos de la muestra</p>}

      {m && (
        <>
          <Datos columnas={4}>
            <Dato etiqueta="Paciente" className="col-span-2">
              <span className="font-semibold">{nombrePaciente(m.solicitud.paciente)}</span>
            </Dato>
            <Dato etiqueta="Cédula">{m.solicitud.paciente.cedula}</Dato>
            <Dato etiqueta="Edad y sexo">{`${calcularEdad(m.solicitud.paciente.fechaNacimiento)} años, ${SEXO_ETIQUETA[m.solicitud.paciente.sexo]}`}</Dato>
            <Dato etiqueta="Solicitud">
              <span className="font-mono text-xs">{m.solicitud.codigo}</span>
            </Dato>
            <Dato etiqueta="Prioridad">
              <PrioridadBadge prioridad={m.solicitud.prioridad} />
            </Dato>
            <Dato etiqueta="Médico solicitante">{m.solicitud.medicoSolicitante}</Dato>
            <Dato etiqueta="Diagnóstico presuntivo">{m.solicitud.diagnosticoPresuntivo}</Dato>
            <Dato etiqueta="Tipo de muestra">{m.tipoMuestra}</Dato>
            <Dato etiqueta="Sitio anatómico">{m.sitioAnatomico}</Dato>
            <Dato etiqueta="Fecha de toma">{formatFechaHora(m.fechaToma)}</Dato>
            <Dato etiqueta="Recepción">{m.fechaRecepcion ? `${formatFechaHora(m.fechaRecepcion)}${m.recepcionadoPor ? ` por ${m.recepcionadoPor.nombreCompleto}` : ''}` : null}</Dato>
            <Dato etiqueta="Inicio de procesamiento">{formatFechaHora(m.fechaProcesamiento) === '—' ? null : formatFechaHora(m.fechaProcesamiento)}</Dato>
          </Datos>

          {m.estado === 'RECHAZADA' && (
            <div className="mt-3">
              <Alert tipo="error">{`Muestra rechazada. Motivo: ${m.motivoRechazo ?? 'no registrado'}`}</Alert>
            </div>
          )}
          {errorAccion && (
            <div className="mt-3">
              <Alert>{errorAccion}</Alert>
            </div>
          )}

          {rechazando && (
            <div className="mt-3 rounded border border-rose-300 bg-rose-50/60 p-3">
              <Campo etiqueta="Motivo del rechazo" ayuda="Quedará registrado en la trazabilidad de la muestra.">
                <Textarea value={motivo} onChange={(e) => setMotivo(e.target.value)} rows={2} autoFocus placeholder="Por ejemplo: volumen insuficiente, envase sin rotular" />
              </Campo>
              <div className="mt-2 flex justify-end gap-2">
                <Button onClick={() => { setRechazando(false); setMotivo(''); }} disabled={ejecutando}>
                  Cancelar
                </Button>
                <Button variante="peligro" cargando={ejecutando} disabled={motivo.trim().length < 5} onClick={() => void ejecutar(() => muestrasApi.rechazar(muestraId, motivo.trim()), 'Muestra rechazada')}>
                  Confirmar rechazo
                </Button>
              </div>
            </div>
          )}

          <Seccion titulo="Exámenes solicitados">
            <DataTable columnas={columnasExamenes} filas={m.examenes} clave={(e) => e.id} ocultarFiltro mensajeVacio="La muestra no tiene exámenes asociados." />
          </Seccion>

          <Seccion titulo="Trazabilidad">
            {trazabilidad.error && <Alert>{trazabilidad.error}</Alert>}
            {trazabilidad.datos && trazabilidad.datos.length === 0 && <p className="text-slate-500">Todavía no hay eventos registrados.</p>}
            <ol className="space-y-2 border-l border-slate-300 pl-4">
              {trazabilidad.datos?.map((evento) => {
                const motivoEvento = motivoDelEvento(evento);
                return (
                  <li key={evento.id} className="relative">
                    <span className="absolute -left-[1.3rem] top-1.5 h-2 w-2 rounded-full bg-violeta-500" aria-hidden />
                    <p className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-slate-900">{ETIQUETA_ACCION[evento.accion] ?? evento.accion}</span>
                      {evento.estadoAnterior && evento.estadoNuevo && (
                        <Badge tono="gris">{`${ETIQUETA_ESTADO[evento.estadoAnterior] ?? evento.estadoAnterior} a ${ETIQUETA_ESTADO[evento.estadoNuevo] ?? evento.estadoNuevo}`}</Badge>
                      )}
                    </p>
                    <p className="text-xs text-slate-500">
                      {formatFechaHora(evento.fechaEvento)} por {evento.usuario?.nombreCompleto ?? 'el sistema'}
                    </p>
                    {motivoEvento && <p className="text-xs text-rose-800">Motivo: {motivoEvento}</p>}
                  </li>
                );
              })}
            </ol>
          </Seccion>
        </>
      )}
    </Modal>
  );
}
