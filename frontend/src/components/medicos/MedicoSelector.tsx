import { useState } from 'react';
import { useCarga } from '../../hooks/useCarga';
import { useDebounce } from '../../hooks/useDebounce';
import { medicosApi } from '../../services/medicos';
import { nombreMedico } from '../../types/medicos';
import { Alert } from '../UI/Alert';
import { Campo, Input } from '../UI/Form';
import { Combobox } from '../UI/Combobox';

/** Búsqueda remota paginada + elección inequívoca por ID; jamás convierte texto a un ID. */
export function MedicoSelector({ value, onChange, disabled, nombreActual }: {
  value: number | null; onChange: (id: number | null) => void; disabled?: boolean; nombreActual?: string | null;
}) {
  const [busqueda, setBusqueda] = useState('');
  const [ultimaSeleccion, setUltimaSeleccion] = useState<{ value: string; label: string } | null>(null);
  const q = useDebounce(busqueda.trim(), 300);
  const carga = useCarga(() => medicosApi.listar({ q, estado: 'activos', page: 1, pageSize: 25 }), [q]);
  const opciones = (carga.datos?.data ?? []).map(m => ({ value: String(m.id),
    label: `${nombreMedico(m)} · ID ${m.id}${m.registroProfesional ? ` · ${m.registroProfesional}` : ''}${m.institucion ? ` · ${m.institucion}` : ''}` }));
  if (value !== null && !opciones.some(o => o.value === String(value))) opciones.unshift({ value: String(value), label: ultimaSeleccion?.value === String(value) ? ultimaSeleccion.label : `${nombreActual ?? 'Médico'} · ID ${value}` });
  return <div className="space-y-3">
    <Campo etiqueta="Buscar en el directorio"><Input type="search" maxLength={120} disabled={disabled}
      placeholder="Nombre, registro o institución" value={busqueda} onChange={e => setBusqueda(e.target.value)} /></Campo>
    <Campo etiqueta="Médico del directorio (opcional)">
      <Combobox aria-label="Médico del directorio" disabled={disabled || carga.cargando || !!carga.error}
        value={value === null ? '' : String(value)} onValueChange={v => { setUltimaSeleccion(opciones.find(o => o.value === v) ?? null); onChange(v ? Number(v) : null); }} options={opciones} />
    </Campo>
    {carga.cargando && <p role="status">Buscando médicos…</p>}
    {carga.error && <Alert>{carga.error}</Alert>}
    {(carga.datos?.total ?? 0) > 25 && <p className="text-xs text-muted">Se muestran 25 coincidencias. Precise la búsqueda para encontrar otro médico.</p>}
  </div>;
}
