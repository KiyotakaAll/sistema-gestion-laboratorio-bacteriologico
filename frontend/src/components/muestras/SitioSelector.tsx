import { useState } from 'react';
import { sitioCompatible } from '../../../../backend/src/domain/catalogo-clinico';
import { catalogosApi, type SitioAnatomico } from '../../services/catalogos';
import { mensajeDeError } from '../../services/api';
import { Button } from '../UI/Button';
import { Combobox } from '../UI/Combobox';
import { Campo, Input } from '../UI/Form';
import { Alert } from '../UI/Alert';

export function SitioSelector({ value, onChange, tipoMuestra, sitios, permitidos, puedeCrear = false, onCreado, disabled }: {
  value: number | null; onChange: (id: number | null) => void; tipoMuestra: string;
  sitios: SitioAnatomico[]; permitidos?: string[]; puedeCrear?: boolean; onCreado?: () => void; disabled?: boolean;
}) {
  const [nombre, setNombre] = useState('');
  const [agregando, setAgregando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nuevos, setNuevos] = useState<SitioAnatomico[]>([]);
  const opciones = [...sitios, ...nuevos.filter(n => !sitios.some(s => s.id === n.id))]
    .filter(s => sitioCompatible(s.tiposMuestra, tipoMuestra))
    .filter(s => !permitidos?.length || permitidos.includes(s.nombre.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('es')));
  async function crear() {
    setGuardando(true); setError(null);
    try {
      const sitio = await catalogosApi.crearSitio(nombre, [tipoMuestra]);
      setNuevos(actual => [...actual, sitio]);
      // Un nuevo sitio no modifica restricciones particulares de un examen.
      if (!permitidos?.length) onChange(sitio.id);
      setAgregando(false); setNombre(''); onCreado?.();
    } catch(e) { setError(mensajeDeError(e)); }
    finally { setGuardando(false); }
  }
  return <div className="space-y-2">
    <Campo etiqueta="Sitio anatómico">
      <Combobox aria-label="Sitio anatómico" value={value ? String(value) : ''}
        onValueChange={v => onChange(v ? Number(v) : null)} disabled={disabled || !tipoMuestra}
        options={opciones.map(s => ({ value: String(s.id), label: s.nombre }))} />
    </Campo>
    {puedeCrear && !agregando && <Button tamano="sm" disabled={disabled || !tipoMuestra} onClick={() => setAgregando(true)}>Agregar sitio</Button>}
    {agregando && <div className="space-y-2 rounded-lg border border-line p-3">
      <Campo etiqueta="Nuevo sitio anatómico"><Input maxLength={80} value={nombre} disabled={guardando} onChange={e => setNombre(e.target.value)} /></Campo>
      <p className="text-xs text-muted">Compatible con {tipoMuestra}. Registre únicamente una localización confirmada; no un material biológico.</p>
      <div className="flex gap-2"><Button tamano="sm" onClick={() => setAgregando(false)} disabled={guardando}>Cancelar</Button>
        <Button tamano="sm" onClick={() => void crear()} disabled={nombre.trim().length < 2} cargando={guardando}>Guardar sitio</Button></div>
    </div>}
    {error && <Alert>{error}</Alert>}
  </div>;
}
