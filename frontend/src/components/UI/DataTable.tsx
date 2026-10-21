import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp, ChevronsUpDown, Loader2, Search } from 'lucide-react';
import { useMemo, useState, type KeyboardEvent, type ReactNode } from 'react';

export interface Column<T> {
  id: string;
  header: string;
  /** Valor plano usado para filtrar y ordenar (lo que ve el usuario, no JSX). */
  accessor: (fila: T) => string | number | null | undefined;
  /** Render personalizado de la celda; si falta se muestra el valor de `accessor`. */
  cell?: (fila: T) => ReactNode;
  align?: 'left' | 'right' | 'center';
  width?: string;
  sortable?: boolean;
}

interface Paginacion {
  page: number;
  totalPages: number;
  total: number;
  onCambiarPagina: (pagina: number) => void;
}

interface DataTableProps<T> {
  columnas: Column<T>[];
  filas: T[];
  clave: (fila: T) => string | number;
  alHacerClic?: (fila: T) => void;
  cargando?: boolean;
  error?: string | null;
  mensajeVacio?: string;
  placeholderFiltro?: string;
  ocultarFiltro?: boolean;
  /** Controles adicionales a la derecha de la barra superior. */
  barra?: ReactNode;
  paginacion?: Paginacion;
  ordenInicial?: { columna: string; direccion: 'asc' | 'desc' };
  alturaMaxima?: string;
}

type Direccion = 'asc' | 'desc';

/** Quita tildes y mayúsculas: "Pérez" coincide con "perez". */
function normalizar(valor: unknown): string {
  return String(valor ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function comparar(a: string | number | null | undefined, b: string | number | null | undefined): number {
  if (a == null && b == null) return 0;
  if (a == null) return 1;
  if (b == null) return -1;
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  return String(a).localeCompare(String(b), 'es', { numeric: true, sensitivity: 'base' });
}

const ALINEACION = { left: 'text-left', right: 'text-right', center: 'text-center' } as const;

/**
 * Tabla de alta densidad: filtro en tiempo real (sobre las filas cargadas),
 * ordenamiento por columna (clic: ascendente, descendente, sin orden),
 * encabezado fijo y navegación por teclado. El filtrado y orden son locales;
 * la paginación y los filtros de servidor los controla la página que la usa.
 */
export function DataTable<T>({
  columnas,
  filas,
  clave,
  alHacerClic,
  cargando = false,
  error = null,
  mensajeVacio = 'No hay registros para mostrar.',
  placeholderFiltro = 'Filtrar en esta tabla',
  ocultarFiltro = false,
  barra,
  paginacion,
  ordenInicial,
  alturaMaxima,
}: DataTableProps<T>) {
  const [filtro, setFiltro] = useState('');
  const [orden, setOrden] = useState<{ columna: string; direccion: Direccion } | null>(ordenInicial ?? null);

  const visibles = useMemo(() => {
    const texto = normalizar(filtro).trim();
    let resultado = filas;

    if (texto) {
      resultado = resultado.filter((fila) => columnas.some((c) => normalizar(c.accessor(fila)).includes(texto)));
    }

    if (orden) {
      const columna = columnas.find((c) => c.id === orden.columna);
      if (columna) {
        const signo = orden.direccion === 'asc' ? 1 : -1;
        resultado = [...resultado].sort((a, b) => signo * comparar(columna.accessor(a), columna.accessor(b)));
      }
    }
    return resultado;
  }, [filas, columnas, filtro, orden]);

  function alternarOrden(id: string) {
    setOrden((actual) => {
      if (!actual || actual.columna !== id) return { columna: id, direccion: 'asc' };
      if (actual.direccion === 'asc') return { columna: id, direccion: 'desc' };
      return null;
    });
  }

  function alPresionarFila(evento: KeyboardEvent<HTMLTableRowElement>, fila: T) {
    if (alHacerClic && (evento.key === 'Enter' || evento.key === ' ')) {
      evento.preventDefault();
      alHacerClic(fila);
    }
  }

  return (
    <div className="flex min-h-0 flex-col rounded border border-slate-300 bg-white">
      {(!ocultarFiltro || barra) && (
        <div className="flex items-center gap-3 border-b border-slate-200 bg-slate-50 px-2 py-1.5">
          {!ocultarFiltro && (
            <label className="relative block w-72">
              <span className="sr-only">{placeholderFiltro}</span>
              <Search className="pointer-events-none absolute left-2 top-1.5 h-3.5 w-3.5 text-slate-400" aria-hidden />
              <input
                type="search"
                value={filtro}
                onChange={(e) => setFiltro(e.target.value)}
                placeholder={placeholderFiltro}
                className="h-7 w-full rounded-sm border border-slate-300 bg-white pl-7 pr-2 text-sm placeholder:text-slate-400 focus:border-violeta-500"
              />
            </label>
          )}
          <div className="ml-auto flex items-center gap-2">{barra}</div>
        </div>
      )}

      <div className="min-h-0 overflow-auto" style={alturaMaxima ? { maxHeight: alturaMaxima } : undefined}>
        <table className="w-full border-collapse text-sm">
          <thead className="sticky top-0 z-10 bg-slate-100">
            <tr>
              {columnas.map((c) => {
                const ordenable = c.sortable !== false;
                const activa = orden?.columna === c.id;
                const Icono = !activa ? ChevronsUpDown : orden.direccion === 'asc' ? ChevronUp : ChevronDown;
                return (
                  <th
                    key={c.id}
                    scope="col"
                    style={c.width ? { width: c.width } : undefined}
                    aria-sort={activa ? (orden.direccion === 'asc' ? 'ascending' : 'descending') : 'none'}
                    className={`border-b border-slate-300 px-2 py-1 text-xs font-semibold text-slate-600 ${ALINEACION[c.align ?? 'left']}`}
                  >
                    {ordenable ? (
                      <button
                        type="button"
                        onClick={() => alternarOrden(c.id)}
                        className="inline-flex items-center gap-1 hover:text-violeta-800"
                      >
                        {c.header}
                        <Icono className={`h-3 w-3 ${activa ? 'text-violeta-700' : 'text-slate-400'}`} aria-hidden />
                      </button>
                    ) : (
                      c.header
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {cargando && filas.length === 0 && (
              <tr>
                <td colSpan={columnas.length} className="px-3 py-8 text-center text-slate-500">
                  <Loader2 className="mr-2 inline h-4 w-4 animate-spin" aria-hidden />
                  Cargando datos
                </td>
              </tr>
            )}
            {error && (
              <tr>
                <td colSpan={columnas.length} className="px-3 py-6 text-center text-rose-700">
                  {error}
                </td>
              </tr>
            )}
            {!cargando && !error && visibles.length === 0 && (
              <tr>
                <td colSpan={columnas.length} className="px-3 py-8 text-center text-slate-500">
                  {filas.length > 0 ? 'Ninguna fila coincide con el filtro.' : mensajeVacio}
                </td>
              </tr>
            )}
            {visibles.map((fila) => (
              <tr
                key={clave(fila)}
                tabIndex={alHacerClic ? 0 : undefined}
                onClick={alHacerClic ? () => alHacerClic(fila) : undefined}
                onKeyDown={alHacerClic ? (e) => alPresionarFila(e, fila) : undefined}
                className={`border-b border-slate-100 ${alHacerClic ? 'cursor-pointer hover:bg-violeta-50' : ''} ${cargando ? 'opacity-60' : ''}`}
              >
                {columnas.map((c) => (
                  <td key={c.id} className={`px-2 py-1 align-middle ${ALINEACION[c.align ?? 'left']}`}>
                    {c.cell ? c.cell(fila) : (c.accessor(fila) ?? <span className="text-slate-400">—</span>)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50 px-2 py-1 text-xs text-slate-600">
        <span>
          {paginacion
            ? `${paginacion.total} registros en total, ${visibles.length} visibles en esta página`
            : `${visibles.length} de ${filas.length} registros`}
        </span>
        {paginacion && (
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => paginacion.onCambiarPagina(paginacion.page - 1)}
              disabled={paginacion.page <= 1 || cargando}
              className="rounded-sm p-1 hover:bg-slate-200 disabled:cursor-not-allowed disabled:text-slate-300"
              aria-label="Página anterior"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="tabular-nums">
              Página {paginacion.page} de {paginacion.totalPages}
            </span>
            <button
              type="button"
              onClick={() => paginacion.onCambiarPagina(paginacion.page + 1)}
              disabled={paginacion.page >= paginacion.totalPages || cargando}
              className="rounded-sm p-1 hover:bg-slate-200 disabled:cursor-not-allowed disabled:text-slate-300"
              aria-label="Página siguiente"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
