import { esCuentaAdministrativa } from '../utils/permisos';
import { PageHeader } from '../components/UI/PageHeader';
import { RefreshCw, UserCheck, UserPlus } from 'lucide-react';
import { useMemo, useRef, useState } from 'react';
import { Alert } from '../components/UI/Alert';
import { Badge } from '../components/UI/Badge';
import { Button } from '../components/UI/Button';
import { DataTable, type Column } from '../components/UI/DataTable';
import { Campo, Input, Select } from '../components/UI/Form';
import { Modal } from '../components/UI/Modal';
import { useAuth } from '../context/AuthContext';
import { useCarga } from '../hooks/useCarga';
import { useDebounce } from '../hooks/useDebounce';
import { mensajeDeError } from '../services/api';
import { usuariosApi } from '../services/laboratorio';
import type { PerfilOperativo, UsuarioAdministracion } from '../types/api';
import { UsuarioFormModal } from '../components/usuarios/UsuarioFormModal';

type Accion = 'activar' | 'desactivar' | 'eliminar';
const etiquetas: Record<Accion, string> = { activar: 'activación', desactivar: 'desactivación', eliminar: 'eliminación' };
const perfilOperativo = (rol: string): rol is PerfilOperativo => rol === 'AUXILIAR' || rol === 'BACTERIOLOGO';
const etiquetaRol = (rol: string) => rol === 'AUXILIAR' ? 'Auxiliar' : rol === 'BACTERIOLOGO' ? 'Bacteriólogo'
  : esCuentaAdministrativa(rol) ? 'Administración interna' : 'Pendiente de asignación';

export default function GestionUsuarios() {
  const { usuario, puede } = useAuth();
  const autorizado = esCuentaAdministrativa(usuario?.rol ?? '') && puede('usuarios.administrar');
  const [creando, setCreando] = useState(false);
  const capacidades = useCarga(() => autorizado ? usuariosApi.capacidades() : Promise.resolve({ roles: [] }), [autorizado]);
  const [busqueda, setBusqueda] = useState('');
  const [estado, setEstado] = useState<'todos' | 'inactivos' | 'activos' | 'eliminados'>('todos');
  const [pagina, setPagina] = useState(1);
  const [confirmacion, setConfirmacion] = useState<{ usuario: UsuarioAdministracion; accion: Accion } | null>(null);
  const [asignando, setAsignando] = useState<UsuarioAdministracion | null>(null);
  const [perfil, setPerfil] = useState<PerfilOperativo | ''>('');
  const [guardando, setGuardando] = useState(false);
  const [errorOperacion, setErrorOperacion] = useState<string | null>(null);
  const [exito, setExito] = useState('');
  const bloqueado = useRef(false);
  const q = useDebounce(busqueda.trim(), 300);
  const { datos, cargando, error, recargar } = useCarga(
    () => autorizado ? usuariosApi.listar({ q, estado, page: pagina, pageSize: 25 })
      : Promise.resolve({ data: [], total: 0, page: 1, pageSize: 25, totalPages: 0 }), [autorizado, q, estado, pagina],
  );

  function abrir(u: UsuarioAdministracion, accion: Accion) {
    setConfirmacion({ usuario: u, accion }); setErrorOperacion(null); setExito('');
  }
  function cerrar() {
    if (!bloqueado.current) { setConfirmacion(null); setAsignando(null); setErrorOperacion(null); }
  }

  const columnas = useMemo<Column<UsuarioAdministracion>[]>(() => [
    { id: 'nombre', header: 'Nombre completo', accessor: u => u.nombreCompleto },
    { id: 'username', header: 'Usuario', accessor: u => u.username },
    { id: 'email', header: 'Correo electrónico', accessor: u => u.email,
      cell: u => <span className="break-all">{u.email}</span> },
    { id: 'rol', header: 'Rol operativo', accessor: u => etiquetaRol(u.rol) },
    { id: 'estado', header: 'Estado', accessor: u => u.eliminadoAt ? 'Eliminado' : u.activo ? 'Activo' : 'Inactivo',
      cell: u => <Badge tono={u.eliminadoAt ? 'gris' : u.activo ? 'verde' : 'ambar'}>{u.eliminadoAt ? 'Eliminado' : u.activo ? 'Activo' : 'Inactivo'}</Badge> },
    { id: 'acciones', header: 'Acciones', accessor: () => '', sortable: false,
      cell: u => u.id === usuario?.id ? <span className="text-xs text-muted">Su cuenta · protegida</span>
        : esCuentaAdministrativa(u.rol) ? <span className="text-xs text-muted">Administración protegida</span>
          : u.eliminadoAt ? <span className="text-xs text-muted">Conservado para trazabilidad</span>
            : <div className="flex flex-wrap gap-2">
              {u.activo ? <Button tamano="sm" disabled={guardando || cargando}
                aria-label={`Desactivar usuario: ${u.nombreCompleto}`} onClick={() => abrir(u, 'desactivar')}>Desactivar</Button>
                : <>
                  {perfilOperativo(u.rol) && <Button tamano="sm" disabled={guardando || cargando}
                    aria-label={`Activar usuario: ${u.nombreCompleto}`} onClick={() => abrir(u, 'activar')}>Activar usuario</Button>}
                  <Button tamano="sm" disabled={guardando || cargando || !capacidades.datos?.roles.length}
                    aria-label={`Asignar perfil: ${u.nombreCompleto}`} onClick={() => {
                      setAsignando(u); setPerfil(perfilOperativo(u.rol) ? u.rol : ''); setErrorOperacion(null); setExito('');
                    }}>Asignar perfil</Button>
                </>}
              <Button tamano="sm" variante="peligro" disabled={guardando || cargando}
                aria-label={`Eliminar usuario: ${u.nombreCompleto}`} onClick={() => abrir(u, 'eliminar')}>Eliminar usuario</Button>
            </div> },
  ], [usuario?.id, guardando, cargando, capacidades.datos]);

  async function confirmar() {
    if (!confirmacion || bloqueado.current) return;
    bloqueado.current = true; setGuardando(true); setErrorOperacion(null);
    try {
      await usuariosApi[confirmacion.accion](confirmacion.usuario.id);
      const verbo = { activar: 'activó', desactivar: 'desactivó', eliminar: 'eliminó' }[confirmacion.accion];
      setExito(`Se ${verbo} la cuenta de ${confirmacion.usuario.nombreCompleto}.`);
      setConfirmacion(null); recargar();
    } catch (err) { setErrorOperacion(mensajeDeError(err)); }
    finally { bloqueado.current = false; setGuardando(false); }
  }

  async function asignar() {
    if (!asignando || !perfil || bloqueado.current) return;
    bloqueado.current = true; setGuardando(true); setErrorOperacion(null);
    try {
      await usuariosApi.asignarPerfil(asignando.id, perfil);
      setExito(`Se asignó el perfil ${etiquetaRol(perfil)} a ${asignando.nombreCompleto}. La cuenta continúa inactiva.`);
      setAsignando(null); recargar();
    } catch (err) { setErrorOperacion(mensajeDeError(err)); }
    finally { bloqueado.current = false; setGuardando(false); }
  }

  if (!autorizado) return <Alert>No tiene permisos para administrar usuarios.</Alert>;

  return <div className="space-y-4">
    <PageHeader contexto="Acceso institucional" titulo="Cuentas del laboratorio"
      descripcion="Gestiona los perfiles y el acceso del personal autorizado."
      acciones={<>
        <Button variante="primario" icono={<UserPlus size={16} aria-hidden />}
          disabled={guardando || creando || capacidades.cargando || !!capacidades.error || !capacidades.datos?.roles.length}
          onClick={() => { setCreando(true); setExito(''); }}>Crear usuario</Button>
        <Button onClick={() => { recargar(); capacidades.recargar(); }} disabled={cargando || guardando || creando}
          icono={<RefreshCw size={16} aria-hidden />}>Actualizar lista</Button>
      </>} />
    <div className="lz-notice"><UserCheck size={20} aria-hidden /><div><strong>Verifica la identidad antes de activar</strong>
      <p>El personal utiliza los perfiles Auxiliar o Bacteriólogo. Las cuentas nuevas quedan inactivas. La desactivación bloquea el acceso y la eliminación conserva la trazabilidad clínica.</p></div></div>
    {capacidades.error && <Alert>{capacidades.error}</Alert>}
    {capacidades.datos?.roles.length === 0 && <Alert tipo="info">No hay perfiles disponibles para crear cuentas. Actualice la lista para volver a comprobar.</Alert>}
    {exito && <Alert tipo="info">{exito}</Alert>}
    <DataTable titulo="Personal del laboratorio" descripcion="Cuentas y perfiles del personal. Las cuentas eliminadas se consultan por separado."
      barra={<div className="lz-user-filters">
        <label className="block w-full max-w-sm"><span className="mb-1.5 block font-semibold">Buscar usuarios</span>
          <Input type="search" placeholder="Nombre, correo o usuario" value={busqueda} disabled={guardando} maxLength={120}
            onChange={e => { setBusqueda(e.target.value); setPagina(1); }} />
        </label>
        <label className="block"><span className="mb-1.5 block font-semibold">Estado de la cuenta</span>
          <Select value={estado} disabled={guardando} onValueChange={value => { setEstado(value as typeof estado); setPagina(1); }}>
            <option value="todos">Todos</option><option value="inactivos">Inactivos</option><option value="activos">Activos</option><option value="eliminados">Eliminados</option>
          </Select>
        </label>
      </div>} columnas={columnas} filas={datos?.data ?? []} clave={u => u.id} ocultarFiltro cargando={cargando} error={error}
      mensajeVacio="No hay usuarios que coincidan con los filtros."
      paginacion={datos ? { page: datos.page, total: datos.total, totalPages: datos.totalPages, onCambiarPagina: setPagina } : undefined} />
    <Modal abierto={confirmacion !== null} titulo={`Confirmar ${confirmacion ? etiquetas[confirmacion.accion] : 'operación'}`} ancho="md" onCerrar={cerrar}
      pie={<>
        <Button onClick={cerrar} disabled={guardando}>Cancelar</Button>
        <Button variante={confirmacion?.accion === 'activar' ? 'primario' : 'peligro'} onClick={confirmar} cargando={guardando}>
          {guardando ? 'Guardando…' : `Confirmar ${confirmacion ? etiquetas[confirmacion.accion] : 'operación'}`}
        </Button>
      </>}>
      <div aria-busy={guardando} className="space-y-4">
        <p>¿Desea {confirmacion?.accion} la cuenta de <strong>{confirmacion?.usuario.nombreCompleto}</strong>?</p>
        <dl className="rounded-lg border border-line bg-subtle p-4">
          <dt className="text-xs text-muted">Usuario</dt><dd>{confirmacion?.usuario.username}</dd>
          <dt className="mt-3 text-xs text-muted">Correo electrónico</dt><dd className="break-all">{confirmacion?.usuario.email}</dd>
          <dt className="mt-3 text-xs text-muted">Rol operativo</dt><dd>{confirmacion && etiquetaRol(confirmacion.usuario.rol)}</dd>
        </dl>
        <p className="text-muted">{confirmacion?.accion === 'activar' ? 'La cuenta podrá iniciar sesión con los permisos de su perfil.'
          : confirmacion?.accion === 'eliminar' ? 'El acceso quedará bloqueado. Esta cuenta no podrá reactivarse mediante la activación normal. Sus firmas, resultados y auditoría se conservarán.'
            : 'Se bloqueará el acceso inmediatamente, incluso con una sesión abierta. La cuenta podrá activarse nuevamente por administración.'}</p>
        {errorOperacion && <Alert>{errorOperacion}</Alert>}
      </div>
    </Modal>
    <Modal abierto={asignando !== null} titulo="Asignar perfil operativo" ancho="md" onCerrar={cerrar}
      pie={<><Button onClick={cerrar} disabled={guardando}>Cancelar</Button>
        <Button variante="primario" onClick={asignar} cargando={guardando} disabled={!perfil}>Guardar perfil</Button></>}>
      <div className="space-y-4">
        <p>Asignar explícitamente un perfil a <strong>{asignando?.nombreCompleto}</strong>. La cuenta permanecerá inactiva hasta su activación.</p>
        <Campo etiqueta="Perfil operativo"><Select value={perfil} disabled={guardando} onValueChange={v => setPerfil(v as PerfilOperativo)}>
          <option value="">Seleccione un perfil</option>
          {(capacidades.datos?.roles ?? []).filter(perfilOperativo).map(rol => <option key={rol} value={rol}>{etiquetaRol(rol)}</option>)}
        </Select></Campo>
        {errorOperacion && <Alert>{errorOperacion}</Alert>}
      </div>
    </Modal>
    {creando && capacidades.datos && <UsuarioFormModal roles={capacidades.datos.roles.filter(perfilOperativo)}
      onCerrar={() => setCreando(false)} onCreado={nuevo => {
        setCreando(false); setExito(`Se creó la cuenta de ${nuevo.nombreCompleto} (${nuevo.username}). Queda pendiente de activación.`);
        setBusqueda(''); setEstado('todos'); setPagina(1); recargar();
      }} />}
  </div>;
}
