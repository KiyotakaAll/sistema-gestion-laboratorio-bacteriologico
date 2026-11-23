import { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import type { Examen } from '../../types/api';
import { catalogosApi, type CatalogoFlujo, type ExamenSolicitadoEntrada } from '../../services/catalogos';
import { mensajeDeError } from '../../services/api';
import { Campo, Input } from '../UI/Form';
import { Combobox } from '../UI/Combobox';
import { normalizarBusqueda } from '../UI/controlTypes';
import { Button } from '../UI/Button';
import { Alert } from '../UI/Alert';
import { SitioSelector } from '../muestras/SitioSelector';

export function ExamenesOrdenSelector({ examenes, catalogo, value, onChange, disabled, onCatalogoCambio }: {
  examenes: Examen[]; catalogo: CatalogoFlujo; value: ExamenSolicitadoEntrada[];
  onChange: (items: ExamenSolicitadoEntrada[]) => void; disabled?: boolean; onCatalogoCambio: () => void;
}) {
  const { puede } = useAuth();
  const [busqueda, setBusqueda] = useState('');
  const [plantilla, setPlantilla] = useState('');
  const [nombrePlantilla, setNombrePlantilla] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const visibles = examenes.filter(e => normalizarBusqueda(`${e.nombre} ${e.codigo}`).includes(normalizarBusqueda(busqueda)));
  function agregar(ids: number[]) {
    setError(null);
    if (ids.some(id => !examenes.some(e => e.id === id))) { setError('La plantilla contiene exámenes inactivos. Revise la selección.'); return; }
    onChange([...value,...ids.filter(id => !value.some(v => v.examenId === id)).map(id => {
      const examen = examenes.find(e => e.id === id)!;
      return { examenId: id, tipoMuestra: normalizarBusqueda(examen.tipoMuestraRequerida) === 'variable' ? '' : examen.tipoMuestraRequerida };
    })]);
  }
  function actualizar(id: number, datos: Partial<ExamenSolicitadoEntrada>) {
    onChange(value.map(v => v.examenId === id ? { ...v, ...datos } : v));
  }
  async function guardarPlantilla() {
    setGuardando(true); setError(null);
    try { await catalogosApi.crearPlantilla(nombrePlantilla, value.map(v => v.examenId)); setNombrePlantilla(''); onCatalogoCambio(); }
    catch(e) { setError(mensajeDeError(e)); }
    finally { setGuardando(false); }
  }
  return <fieldset className="space-y-4 rounded-xl border border-line bg-surface p-4">
    <legend className="font-serif text-lg text-heading">Exámenes de la orden</legend>
    {error && <Alert>{error}</Alert>}
    <div className="grid gap-4 md:grid-cols-2">
      <Campo etiqueta="Buscar exámenes"><Input type="search" disabled={disabled} value={busqueda} onChange={e => setBusqueda(e.target.value)} /></Campo>
      <Campo etiqueta="Selección frecuente">
        <Combobox aria-label="Selección frecuente" value={plantilla} disabled={disabled}
          options={catalogo.plantillas.map(p => ({ value: String(p.id), label: p.nombre }))}
          onValueChange={v => { setPlantilla(v); const p = catalogo.plantillas.find(p => String(p.id) === v); if (p) agregar(p.examenIds); }} />
      </Campo>
    </div>
    <div className="grid max-h-56 gap-2 overflow-y-auto md:grid-cols-2">
      {visibles.map(e => <label key={e.id} className="flex gap-2 rounded-lg border border-line p-3 text-sm">
        <input type="checkbox" disabled={disabled} checked={value.some(v => v.examenId === e.id)}
          onChange={ev => ev.target.checked ? agregar([e.id]) : onChange(value.filter(v => v.examenId !== e.id))} />
        <span>{e.nombre} <span className="text-muted">({e.tipoMuestraRequerida})</span></span>
      </label>)}
      {!visibles.length && <p className="text-sm text-muted">Sin coincidencias.</p>}
    </div>
    {value.map(item => {
      const examen = examenes.find(e => e.id === item.examenId)!;
      return <div key={item.examenId} className="space-y-3 rounded-lg border border-line bg-subtle p-4">
        <p className="font-semibold text-heading">{examen.nombre}</p>
        <Campo etiqueta={`Tipo de muestra para ${examen.nombre}`}>
          <Combobox aria-label={`Tipo de muestra para ${examen.nombre}`} value={item.tipoMuestra} disabled={disabled}
            options={(normalizarBusqueda(examen.tipoMuestraRequerida) === 'variable' ? catalogo.tiposMuestra : [examen.tipoMuestraRequerida]).map(t => ({value:t,label:t}))}
            onValueChange={t => actualizar(item.examenId, { tipoMuestra: t, sitioAnatomicoId: undefined })} />
        </Campo>
        <SitioSelector value={item.sitioAnatomicoId ?? null} onChange={id => actualizar(item.examenId, { sitioAnatomicoId: id ?? undefined })}
          tipoMuestra={item.tipoMuestra} sitios={catalogo.sitios} permitidos={examen.sitiosPermitidos ?? undefined}
          puedeCrear={puede('usuarios.administrar')} onCreado={onCatalogoCambio} disabled={disabled} />
        <p className="text-sm text-muted">Instrucciones de toma: {examen.instruccionesToma || 'No registradas en el catálogo.'}</p>
      </div>;
    })}
    <div className="flex flex-wrap items-end gap-3">
      <Campo etiqueta="Nombre de selección reutilizable"><Input maxLength={80} value={nombrePlantilla} disabled={disabled || guardando} onChange={e => setNombrePlantilla(e.target.value)} /></Campo>
      <Button disabled={disabled || !value.length || nombrePlantilla.trim().length < 2} cargando={guardando} onClick={() => void guardarPlantilla()}>Guardar selección frecuente</Button>
    </div>
    <p className="text-xs text-muted">Solo se reutilizan exámenes. El diagnóstico, la toma y los resultados no se completan automáticamente.</p>
  </fieldset>;
}
