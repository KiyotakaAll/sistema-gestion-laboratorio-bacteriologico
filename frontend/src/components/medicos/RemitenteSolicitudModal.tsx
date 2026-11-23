import { useRef, useState, type FormEvent } from 'react';
import { useCarga } from '../../hooks/useCarga';
import { solicitudesApi } from '../../services/laboratorio';
import { medicosApi } from '../../services/medicos';
import { mensajeDeError } from '../../services/api';
import { Alert } from '../UI/Alert';
import { Button } from '../UI/Button';
import { Modal } from '../UI/Modal';
import { MedicoSelector } from './MedicoSelector';

export function RemitenteSolicitudModal({ solicitudId, onCerrar, onGuardado }: {
  solicitudId: number; onCerrar: () => void; onGuardado: () => void;
}) {
  const carga = useCarga(() => solicitudesApi.obtener(solicitudId), [solicitudId]);
  const [seleccion, setSeleccion] = useState<number | null | undefined>(undefined);
  const [guardando, setGuardando] = useState(false);
  const bloqueo = useRef(false);
  const [error, setError] = useState<string | null>(null);
  async function guardar(e: FormEvent) {
    e.preventDefault(); if (bloqueo.current || !carga.datos) return;
    bloqueo.current = true; setGuardando(true); setError(null);
    try { await medicosApi.asignar(solicitudId, seleccion === undefined ? carga.datos.medicoRemitenteId ?? null : seleccion); onGuardado(); }
    catch (err) { setError(mensajeDeError(err)); }
    finally { bloqueo.current = false; setGuardando(false); }
  }
  return <Modal abierto titulo="Remitente de la solicitud" onCerrar={() => { if (!bloqueo.current) onCerrar(); }} ancho="md">
    {carga.error && <Alert>{carga.error}</Alert>}
    {carga.cargando ? <p>Cargando solicitud…</p> : carga.datos && <form onSubmit={guardar} className="space-y-4">
      <p>Remitente al ingreso: {carga.datos.medicoSolicitante ?? 'Sin remitente'}. Este texto se conserva.</p>
      <p>Nombre guardado del directorio: {carga.datos.medicoRemitenteNombre ?? 'Sin asociación'}.</p>
      <MedicoSelector disabled={guardando} value={seleccion === undefined ? carga.datos.medicoRemitenteId ?? null : seleccion}
        nombreActual={carga.datos.medicoRemitenteNombre} onChange={setSeleccion} />
      <p className="text-xs text-muted">Limpiar la selección retira el vínculo; conserva el remitente al ingreso.</p>
      {error && <Alert>{error}</Alert>}
      <div className="flex justify-end gap-3"><Button onClick={onCerrar} disabled={guardando}>Cancelar</Button>
        <Button type="submit" variante="primario" cargando={guardando}>Guardar remitente</Button></div>
    </form>}
  </Modal>;
}
