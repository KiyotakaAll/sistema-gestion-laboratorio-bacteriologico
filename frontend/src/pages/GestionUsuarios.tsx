import { esCuentaAdministrativa } from '../utils/permisos';
import { PageHeader } from '../components/UI/PageHeader';
import { RefreshCw, UserCheck } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ETIQUETA_ROL } from '../components/navigation';
import { Alert } from '../components/UI/Alert';
import { Badge } from '../components/UI/Badge';
import { Button } from '../components/UI/Button';
import { DataTable, type Column } from '../components/UI/DataTable';
import { Input, Select } from '../components/UI/Form';
import { Modal } from '../components/UI/Modal';
import { useAuth } from '../context/AuthContext';
import { useCarga } from '../hooks/useCarga';
import { useDebounce } from '../hooks/useDebounce';
import { mensajeDeError } from '../services/api';
import { usuariosApi } from '../services/laboratorio';
import type { UsuarioAdministracion } from '../types/api';

export default function GestionUsuarios() {
  const { usuario } = useAuth();
  const [busqueda, setBusqueda] = useState('');
  const [estado, setEstado] = useState<'todos' | 'inactivos' | 'activos'>('todos');
  const [pagina, setPagina] = useState(1);
  const [seleccionado, setSeleccionado] = useState<UsuarioAdministracion | null>(null);
  const [activando, setActivando] = useState(false);
  const [errorActivacion, setErrorActivacion] = useState<string | null>(null);
  const [exito, setExito] = useState('');
  const [activados, setActivados] = useState<Set<number>>(() => new Set());
  const bloqueado = useRef(false);
  const q = useDebounce(busqueda.trim(), 300);
  const { datos, cargando, error, recargar } = useCarga(
    () => usuariosApi.listar({ q, estado, page: pagina, pageSize: 25 }), [q, estado, pagina],
  );
  // El estado local cubre la recarga; cada respuesta nueva vuelve a ser la fuente de verdad.
  useEffect(() => { setActivados(new Set()); }, [datos]);

  const columnas = useMemo<Column<UsuarioAdministracion>[]>(() => [
    { id: 'nombre', header: 'Nombre completo', accessor: (u) => u.nombreCompleto },
    { id: 'email', header: 'Correo electrónico', accessor: (u) => u.email,
      cell: (u) => <span className="break-all">{u.email}</span> },
    { id: 'rol', header: 'Rol', accessor: (u) => ETIQUETA_ROL[u.rol] },
    { id: 'estado', header: 'Estado', accessor: (u) => u.activo ? 'Activo' : 'Pendiente / inactivo',
      cell: (u) => <Badge tono={u.activo ? 'verde' : 'ambar'}>{u.activo ? 'Activo' : 'Pendiente / inactivo'}</Badge> },
    { id: 'acciones', header: 'Acciones', accessor: () => '', sortable: false,
      cell: (u) => u.id === usuario?.id ? <span className="text-xs text-muted">Su cuenta</span>
        : u.activo ? <span className="text-xs text-muted">Sin acciones pendientes</span>
          : esCuentaAdministrativa(u.rol) ? <span className="text-xs text-muted">Activación restringida</span>
            : <Button tamano="sm" disabled={activando || cargando} icono={<UserCheck size={16} aria-hidden />}
              aria-label={`Activar usuario: ${u.nombreCompleto}`} onClick={() => {
                setSeleccionado(u); setErrorActivacion(null); setExito('');
              }}>Activar usuario</Button> },
  ], [usuario?.id, activando, cargando]);

  function cerrarConfirmacion() {
    if (!bloqueado.current) { setSeleccionado(null); setErrorActivacion(null); }
  }

  async function activar() {
    if (!seleccionado || bloqueado.current) return;
    bloqueado.current = true;
    setActivando(true);
    setErrorActivacion(null);
    try {
      const resultado = await usuariosApi.activar(seleccionado.id);
      setActivados((anteriores) => new Set([...anteriores, resultado.id]));
      setExito(`Se activó la cuenta de ${seleccionado.nombreCompleto}. Ya puede iniciar sesión con su correo.`);
      setSeleccionado(null);
      recargar();
    } catch (err) {
      setErrorActivacion(mensajeDeError(err));
    } finally {
      bloqueado.current = false;
      setActivando(false);
    }
  }

  return <div className="space-y-4">
    <PageHeader contexto="Acceso institucional" titulo="Cuentas del laboratorio"
      descripcion="Revisa las solicitudes de acceso y gestiona la activación del personal autorizado."
      acciones={<Button onClick={recargar} disabled={cargando || activando} icono={<RefreshCw size={16} aria-hidden />}>Actualizar lista</Button>} />
    <div className="lz-notice"><UserCheck size={20} aria-hidden /><div><strong>Verifica la identidad antes de activar</strong>
      <p>Las cuentas registradas desde Login quedan inactivas con el rol de recepción. La activación conserva el rol asignado. Esta pantalla no activa cuentas administrativas ni modifica permisos.</p></div></div>
    {exito && <Alert tipo="info">{exito}</Alert>}
    <DataTable titulo="Personal del laboratorio" descripcion="Cuentas existentes y solicitudes pendientes de activación."
      barra={<div className="lz-user-filters">
      <label className="block w-full max-w-sm"><span className="mb-1.5 block font-semibold">Buscar usuarios</span>
        <Input type="search" placeholder="Nombre, correo o usuario" value={busqueda} disabled={activando} maxLength={120}
          onChange={(e) => { setBusqueda(e.target.value); setPagina(1); }} />
      </label>
      <label className="block"><span className="mb-1.5 block font-semibold">Estado de la cuenta</span>
        <Select value={estado} disabled={activando} onValueChange={(value) => {
          setEstado(value as typeof estado); setPagina(1);
        }}><option value="todos">Todos</option><option value="inactivos">Pendientes / inactivos</option><option value="activos">Activos</option></Select>
      </label>
    </div>} columnas={columnas} filas={(datos?.data ?? []).map((u) => activados.has(u.id) ? { ...u, activo: true } : u)}
      clave={(u) => u.id} ocultarFiltro cargando={cargando} error={error}
      mensajeVacio="No hay usuarios que coincidan con los filtros."
      paginacion={datos ? { page: datos.page, total: datos.total, totalPages: datos.totalPages, onCambiarPagina: setPagina } : undefined} />
    <Modal abierto={seleccionado !== null} titulo="Confirmar activación" ancho="md" onCerrar={cerrarConfirmacion}
      pie={<>
        <Button onClick={cerrarConfirmacion} disabled={activando}>Cancelar</Button>
        <Button variante="primario" onClick={activar} cargando={activando}>{activando ? 'Activando usuario…' : 'Confirmar activación'}</Button>
      </>}>
      <div aria-busy={activando} className="space-y-4">
        <p>¿Desea activar la cuenta de <strong>{seleccionado?.nombreCompleto}</strong>?</p>
        <dl className="rounded-lg border border-line bg-subtle p-4">
          <dt className="text-xs text-muted">Correo electrónico</dt><dd className="break-all">{seleccionado?.email}</dd>
          <dt className="mt-3 text-xs text-muted">Rol que conservará</dt><dd>{seleccionado && ETIQUETA_ROL[seleccionado.rol]}</dd>
        </dl>
        <p className="text-muted">La cuenta podrá iniciar sesión y acceder a los módulos permitidos por su rol.</p>
        {errorActivacion && <Alert>{errorActivacion}</Alert>}
      </div>
    </Modal>
  </div>;
}
