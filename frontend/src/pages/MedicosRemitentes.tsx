import { useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useCarga } from '../hooks/useCarga';
import { useDebounce } from '../hooks/useDebounce';
import { mensajeDeError } from '../services/api';
import { medicosApi } from '../services/medicos';
import { nombreMedico, type EstadoMedicos, type MedicoRemitente } from '../types/medicos';
import { PageHeader } from '../components/UI/PageHeader';
import { Alert } from '../components/UI/Alert';
import { Badge } from '../components/UI/Badge';
import { Button } from '../components/UI/Button';
import { Campo, Input, Select } from '../components/UI/Form';
import { DataTable, type Column } from '../components/UI/DataTable';
import { Modal } from '../components/UI/Modal';
import { MedicoFormModal } from '../components/medicos/MedicoFormModal';

export default function MedicosRemitentes() {
  const capacidad = useCarga(() => medicosApi.capacidades(), []);
  return <div className="space-y-4">
    <PageHeader contexto="Admisión" titulo="Médicos remitentes" descripcion="Directorio de profesionales que remiten solicitudes al laboratorio." />
    {capacidad.error && <Alert>{capacidad.error}</Alert>}
    {capacidad.cargando ? <p>Cargando disponibilidad…</p> : capacidad.datos?.directorioMedicos
      ? <Directorio /> : <Alert tipo="info">El directorio de médicos aún no está habilitado.</Alert>}
  </div>;
}

function Directorio() {
  const { puede } = useAuth();
  const escribir = puede('medicos.escribir');
  const [busqueda, setBusqueda] = useState('');
  const q = useDebounce(busqueda.trim(), 300);
  const [estado, setEstado] = useState<EstadoMedicos>('todos');
  const [pagina, setPagina] = useState(1);
  const [formulario, setFormulario] = useState<MedicoRemitente | 'nuevo' | null>(null);
  const [cambio, setCambio] = useState<MedicoRemitente | null>(null);
  const [guardando, setGuardando] = useState(false);
  const bloqueo = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState('');
  const carga = useCarga(() => medicosApi.listar({ q, estado, page: pagina, pageSize: 25 }), [q, estado, pagina]);
  const columnas: Column<MedicoRemitente>[] = [
    { id: 'nombre', header: 'Médico', accessor: nombreMedico },
    { id: 'registro', header: 'Registro profesional', accessor: m => m.registroProfesional },
    { id: 'especialidad', header: 'Especialidad', accessor: m => m.especialidad },
    { id: 'institucion', header: 'Institución', accessor: m => m.institucion },
    { id: 'telefono', header: 'Teléfono', accessor: m => m.telefono },
    { id: 'email', header: 'Correo electrónico', accessor: m => m.email },
    { id: 'estado', header: 'Estado', accessor: m => m.activo ? 'Activo' : 'Inactivo',
      cell: m => <Badge tono={m.activo ? 'verde' : 'ambar'}>{m.activo ? 'Activo' : 'Inactivo'}</Badge> },
    { id: 'acciones', header: 'Acciones', accessor: () => '', sortable: false,
      cell: m => escribir && <div className="flex gap-2">
        <Button tamano="sm" disabled={guardando} onClick={() => setFormulario(m)} aria-label={`Editar ${nombreMedico(m)}`}>Editar</Button>
        <Button tamano="sm" disabled={guardando} onClick={() => { setCambio(m); setError(null); }}
          aria-label={`${m.activo ? 'Desactivar' : 'Activar'} ${nombreMedico(m)}`}>{m.activo ? 'Desactivar' : 'Activar'}</Button>
      </div> },
  ];
  async function confirmar() {
    if (!cambio || bloqueo.current) return;
    bloqueo.current = true; setGuardando(true); setError(null);
    try { await medicosApi.estado(cambio.id, !cambio.activo); setCambio(null); setAviso('Estado del médico actualizado.'); carga.recargar(); }
    catch (err) { setError(mensajeDeError(err)); }
    finally { bloqueo.current = false; setGuardando(false); }
  }
  return <>
    {aviso && <Alert tipo="info">{aviso}</Alert>}
    <DataTable titulo="Directorio de médicos" descripcion="La desactivación conserva las solicitudes y sus nombres históricos."
      barra={<div className="flex flex-wrap items-end gap-4">
        {escribir && <Button variante="primario" onClick={() => setFormulario('nuevo')}>Nuevo médico</Button>}
        <Campo etiqueta="Buscar médicos"><Input type="search" maxLength={120} placeholder="Nombre, registro o institución"
          value={busqueda} onChange={e => { setBusqueda(e.target.value); setPagina(1); }} /></Campo>
        <Campo etiqueta="Estado"><Select value={estado} onValueChange={v => { setEstado(v as EstadoMedicos); setPagina(1); }}>
          <option value="todos">Todos</option><option value="activos">Activos</option><option value="inactivos">Inactivos</option>
        </Select></Campo>
        <Button onClick={carga.recargar} disabled={carga.cargando}>Actualizar lista</Button>
      </div>} columnas={columnas} filas={carga.datos?.data ?? []} clave={m => m.id} ocultarFiltro
      cargando={carga.cargando} error={carga.error} mensajeVacio="No hay médicos que coincidan con los filtros."
      paginacion={carga.datos ? { page: carga.datos.page, total: carga.datos.total, totalPages: carga.datos.totalPages, onCambiarPagina: setPagina } : undefined} />
    {formulario && <MedicoFormModal medico={formulario === 'nuevo' ? undefined : formulario} onCerrar={() => setFormulario(null)}
      onGuardado={() => { setFormulario(null); setAviso('Médico guardado.'); carga.recargar(); }} />}
    <Modal abierto={cambio !== null} titulo="Confirmar cambio de estado" ancho="md"
      onCerrar={() => { if (!bloqueo.current) setCambio(null); }}
      pie={<><Button disabled={guardando} onClick={() => setCambio(null)}>Cancelar</Button>
        <Button variante="primario" cargando={guardando} onClick={confirmar}>Confirmar</Button></>}>
      <p>{cambio?.activo ? 'Desactivar' : 'Activar'} a {cambio && nombreMedico(cambio)}.</p>
      <p>Las solicitudes existentes conservarán su información.</p>{error && <Alert>{error}</Alert>}
    </Modal>
  </>;
}
