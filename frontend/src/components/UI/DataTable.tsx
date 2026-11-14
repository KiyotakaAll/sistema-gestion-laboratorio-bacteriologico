
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ChevronsUpDown,
  Loader2,
  Search,
} from 'lucide-react';
import {
  useMemo,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from 'react';

export interface Column<T> {
  id: string;
  header: string;
  accessor: (fila: T) => string | number | null | undefined;
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
  barra?: ReactNode;
  paginacion?: Paginacion;
  ordenInicial?: {
    columna: string;
    direccion: 'asc' | 'desc';
  };
  alturaMaxima?: string;
}

type Direccion = 'asc' | 'desc';

function normalizar(valor: unknown): string {
  return String(valor ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function comparar(
  a: string | number | null | undefined,
  b: string | number | null | undefined,
): number {
  if (a == null && b == null) return 0;
  if (a == null) return 1;
  if (b == null) return -1;

  if (typeof a === 'number' && typeof b === 'number') {
    return a - b;
  }

  return String(a).localeCompare(String(b), 'es', {
    numeric: true,
    sensitivity: 'base',
  });
}

const ALINEACION = {
  left: 'text-left',
  right: 'text-right',
  center: 'text-center',
} as const;

export function DataTable<T>({
  columnas,
  filas,
  clave,
  alHacerClic,
  cargando = false,
  error = null,
  mensajeVacio = 'No hay registros para mostrar.',
  placeholderFiltro = 'Buscar en esta tabla',
  ocultarFiltro = false,
  barra,
  paginacion,
  ordenInicial,
  alturaMaxima,
}: DataTableProps<T>) {
  const [filtro, setFiltro] = useState('');
  const [orden, setOrden] = useState<{
    columna: string;
    direccion: Direccion;
  } | null>(ordenInicial ?? null);

  const visibles = useMemo(() => {
    const texto = normalizar(filtro).trim();
    let resultado = filas;

    if (texto) {
      resultado = resultado.filter((fila) =>
        columnas.some((columna) =>
          normalizar(columna.accessor(fila)).includes(texto),
        ),
      );
    }

    if (orden) {
      const columna = columnas.find(
        (c) => c.id === orden.columna,
      );

      if (columna) {
        const signo = orden.direccion === 'asc' ? 1 : -1;

        resultado = [...resultado].sort(
          (a, b) =>
            signo *
            comparar(
              columna.accessor(a),
              columna.accessor(b),
            ),
        );
      }
    }

    return resultado;
  }, [filas, columnas, filtro, orden]);

  function alternarOrden(id: string) {
    setOrden((actual) => {
      if (!actual || actual.columna !== id) {
        return { columna: id, direccion: 'asc' };
      }

      if (actual.direccion === 'asc') {
        return { columna: id, direccion: 'desc' };
      }

      return null;
    });
  }

  function alPresionarFila(
    evento: KeyboardEvent<HTMLTableRowElement>,
    fila: T,
  ) {
    if (
      alHacerClic &&
      (evento.key === 'Enter' || evento.key === ' ')
    ) {
      evento.preventDefault();
      alHacerClic(fila);
    }
  }

  return (
    <div className="flex min-h-0 flex-col overflow-hidden rounded-xl border border-[#e3e7ed] bg-white shadow-sm">

      {(!ocultarFiltro || barra) && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#edf0f4] bg-white px-5 py-4">

          {!ocultarFiltro && (
            <label className="relative block w-full max-w-sm">
              <span className="sr-only">
                {placeholderFiltro}
              </span>

              <Search
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8993a3]"
                aria-hidden
              />

              <input
                type="search"
                value={filtro}
                onChange={(e) => setFiltro(e.target.value)}
                placeholder={placeholderFiltro}
                className="h-10 w-full rounded-lg border border-[#d8dce7] bg-white pl-10 pr-3 text-sm text-[#30203f] outline-none transition-colors placeholder:text-[#9aa3b2] focus:border-[#7545ad] focus:ring-2 focus:ring-[#7545ad]/10"
              />
            </label>
          )}

          <div className="ml-auto flex flex-wrap items-center gap-3">
            {barra}
          </div>
        </div>
      )}

      <div
        className="min-h-0 overflow-auto"
        style={
          alturaMaxima
            ? { maxHeight: alturaMaxima }
            : undefined
        }
      >
        <table className="w-full border-collapse text-sm">

          <thead className="sticky top-0 z-10 bg-[#f8f9fc]">
            <tr>
              {columnas.map((c) => {
                const ordenable = c.sortable !== false;
                const activa = orden?.columna === c.id;

                const Icono = !activa
                  ? ChevronsUpDown
                  : orden.direccion === 'asc'
                    ? ChevronUp
                    : ChevronDown;

                return (
                  <th
                    key={c.id}
                    scope="col"
                    style={
                      c.width
                        ? { width: c.width }
                        : undefined
                    }
                    aria-sort={
                      activa
                        ? orden.direccion === 'asc'
                          ? 'ascending'
                          : 'descending'
                        : 'none'
                    }
                    className={`border-b border-[#e8ebf1] px-4 py-3.5 text-xs font-semibold tracking-wide text-[#596579] ${ALINEACION[c.align ?? 'left']}`}
                  >
                    {ordenable ? (
                      <button
                        type="button"
                        onClick={() => alternarOrden(c.id)}
                        className="inline-flex items-center gap-1.5 transition-colors hover:text-[#60379a]"
                      >
                        {c.header}

                        <Icono
                          className={`h-3.5 w-3.5 ${
                            activa
                              ? 'text-[#60379a]'
                              : 'text-[#a3acb9]'
                          }`}
                          aria-hidden
                        />
                      </button>
                    ) : (
                      c.header
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>

          <tbody className="divide-y divide-[#edf0f4]">

            {cargando && filas.length === 0 && (
              <tr>
                <td
                  colSpan={columnas.length}
                  className="px-5 py-12 text-center text-[#68758a]"
                >
                  <Loader2
                    className="mr-2 inline h-4 w-4 animate-spin text-[#60379a]"
                    aria-hidden
                  />
                  Cargando datos...
                </td>
              </tr>
            )}

            {error && (
              <tr>
                <td
                  colSpan={columnas.length}
                  className="bg-rose-50 px-5 py-8 text-center text-rose-700"
                >
                  {error}
                </td>
              </tr>
            )}

            {!cargando &&
              !error &&
              visibles.length === 0 && (
                <tr>
                  <td
                    colSpan={columnas.length}
                    className="px-5 py-14 text-center text-[#788294]"
                  >
                    {filas.length > 0
                      ? 'Ninguna fila coincide con el filtro.'
                      : mensajeVacio}
                  </td>
                </tr>
              )}

            {visibles.map((fila) => (
              <tr
                key={clave(fila)}
                tabIndex={
                  alHacerClic ? 0 : undefined
                }
                onClick={
                  alHacerClic
                    ? () => alHacerClic(fila)
                    : undefined
                }
                onKeyDown={
                  alHacerClic
                    ? (e) => alPresionarFila(e, fila)
                    : undefined
                }
                className={`transition-colors ${
                  alHacerClic
                    ? 'cursor-pointer hover:bg-[#f7f3fc] focus-visible:bg-[#f7f3fc]'
                    : ''
                } ${
                  cargando ? 'opacity-60' : ''
                }`}
              >
                {columnas.map((c) => (
                  <td
                    key={c.id}
                    className={`px-4 py-3.5 align-middle text-[#475467] ${ALINEACION[c.align ?? 'left']}`}
                  >
                    {c.cell
                      ? c.cell(fila)
                      : c.accessor(fila) ?? (
                          <span className="text-[#a3acb9]">
                            —
                          </span>
                        )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#edf0f4] bg-[#fafbfd] px-5 py-3 text-xs text-[#68758a]">

        <span>
          {paginacion
            ? `${paginacion.total} registros en total · ${visibles.length} visibles en esta página`
            : `${visibles.length} de ${filas.length} registros`}
        </span>

        {paginacion && (
          <div className="flex items-center gap-3">

            <button
              type="button"
              onClick={() =>
                paginacion.onCambiarPagina(
                  paginacion.page - 1,
                )
              }
              disabled={
                paginacion.page <= 1 || cargando
              }
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#e3e7ed] bg-white text-[#60379a] transition-colors hover:bg-[#f5f1fb] disabled:cursor-not-allowed disabled:text-slate-300"
              aria-label="Página anterior"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>

            <span className="font-medium tabular-nums text-[#475467]">
              Página {paginacion.page} de{' '}
              {paginacion.totalPages}
            </span>

            <button
              type="button"
              onClick={() =>
                paginacion.onCambiarPagina(
                  paginacion.page + 1,
                )
              }
              disabled={
                paginacion.page >=
                  paginacion.totalPages ||
                cargando
              }
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#e3e7ed] bg-white text-[#60379a] transition-colors hover:bg-[#f5f1fb] disabled:cursor-not-allowed disabled:text-slate-300"
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
