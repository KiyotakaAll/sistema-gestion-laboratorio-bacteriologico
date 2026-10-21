import { Plus, Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import { PacienteDetalleModal } from '../components/admision/PacienteDetalleModal';
import { PacienteFormModal } from '../components/admision/PacienteFormModal';
import { Button } from '../components/UI/Button';
import { DataTable, type Column } from '../components/UI/DataTable';
import { useAuth } from '../context/AuthContext';
import { useCarga } from '../hooks/useCarga';
import { useDebounce } from '../hooks/useDebounce';
import { pacientesApi } from '../services/laboratorio';
import type { Paciente } from '../types/api';
import { SEXO_ETIQUETA, calcularEdad, formatFecha, limpiarParams, nombrePaciente } from '../utils/format';

export default function AdmisionPacientes() {
  const { tieneRol } = useAuth();
  const puedeEscribir = tieneRol('ADMINISTRADOR', 'RECEPCIONISTA');

  const [busqueda, setBusqueda] = useState('');
  const [pagina, setPagina] = useState(1);
  const [detalleId, setDetalleId] = useState<number | null>(null);
  const [registrando, setRegistrando] = useState(false);
  const q = useDebounce(busqueda.trim(), 300);

  const { datos, cargando, error, recargar } = useCarga(
    () => pacientesApi.listar(limpiarParams({ q, page: pagina, pageSize: 25 })),
    [q, pagina],
  );

  const columnas = useMemo<Column<Paciente>[]>(
    () => [
      { id: 'cedula', header: 'Cédula', accessor: (p) => p.cedula, width: '9rem', cell: (p) => <span className="tabular-nums">{p.cedula}</span> },
      { id: 'nombre', header: 'Paciente', accessor: (p) => nombrePaciente(p), cell: (p) => <span className="font-semibold text-slate-900">{nombrePaciente(p)}</span> },
      { id: 'edad', header: 'Edad', accessor: (p) => calcularEdad(p.fechaNacimiento), align: 'right', width: '5rem' },
      { id: 'sexo', header: 'Sexo', accessor: (p) => SEXO_ETIQUETA[p.sexo], width: '8rem' },
      { id: 'telefono', header: 'Teléfono', accessor: (p) => p.telefono },
      { id: 'email', header: 'Correo electrónico', accessor: (p) => p.email },
      { id: 'registro', header: 'Registrado', accessor: (p) => p.createdAt, cell: (p) => formatFecha(p.createdAt), width: '9rem' },
    ],
    [],
  );

  return (
    <>
      <DataTable
        columnas={columnas}
        filas={datos?.data ?? []}
        clave={(p) => p.id}
        alHacerClic={(p) => setDetalleId(p.id)}
        cargando={cargando}
        error={error}
        ocultarFiltro
        mensajeVacio={q ? 'Ningún paciente coincide con la búsqueda.' : 'Aún no hay pacientes registrados.'}
        ordenInicial={{ columna: 'nombre', direccion: 'asc' }}
        paginacion={datos ? { page: datos.page, totalPages: datos.totalPages, total: datos.total, onCambiarPagina: setPagina } : undefined}
        barra={
          <>
            <label className="relative block w-96">
              <span className="sr-only">Buscar paciente</span>
              <Search className="pointer-events-none absolute left-2 top-1.5 h-3.5 w-3.5 text-slate-400" aria-hidden />
              <input
                type="search"
                value={busqueda}
                onChange={(e) => {
                  setBusqueda(e.target.value);
                  setPagina(1);
                }}
                placeholder="Buscar por cédula, nombres o apellidos"
                className="h-7 w-full rounded-sm border border-slate-300 bg-white pl-7 pr-2 text-sm placeholder:text-slate-400 focus:border-violeta-500"
              />
            </label>
            {puedeEscribir && (
              <Button tamano="sm" variante="primario" icono={<Plus className="h-3.5 w-3.5" aria-hidden />} onClick={() => setRegistrando(true)}>
                Registrar paciente
              </Button>
            )}
          </>
        }
      />

      {registrando && (
        <PacienteFormModal
          paciente={null}
          onCerrar={() => setRegistrando(false)}
          onGuardado={(nuevo) => {
            setRegistrando(false);
            recargar();
            // Tras registrar, se abre el detalle para crear de inmediato la solicitud.
            setDetalleId(nuevo.id);
          }}
        />
      )}

      {detalleId !== null && (
        <PacienteDetalleModal pacienteId={detalleId} puedeEscribir={puedeEscribir} onCerrar={() => setDetalleId(null)} onCambio={recargar} />
      )}
    </>
  );
}
