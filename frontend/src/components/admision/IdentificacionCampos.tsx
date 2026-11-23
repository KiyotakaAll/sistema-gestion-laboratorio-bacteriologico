import type { IdentificacionEntrada, IdentificacionPublica, TipoDocumento } from '../../types/api';
import { CATALOGO_DOCUMENTOS } from '../../utils/identificacion';
import { Campo, Input, Select, Textarea } from '../UI/Form';
import { Combobox } from '../UI/Combobox';

export interface IdentificacionFormulario {
  estado: 'DOCUMENTADO' | 'SIN_DOCUMENTO_ASIGNADO' | 'DOCUMENTO_NO_DISPONIBLE';
  tipo: TipoDocumento | ''; numero: string; pais: string; motivo: string;
}
export class ErrorIdentificacionFormulario extends Error {}
export function identificacionInicial(i?: IdentificacionPublica): IdentificacionFormulario {
  return i?.estado === 'DOCUMENTADO'
    ? { estado: i.estado, tipo: i.tipo, numero: i.numero, pais: i.paisEmisor, motivo: '' }
    : { estado: i && i.estado !== 'LEGADO_POR_REVISAR' ? i.estado : 'DOCUMENTADO',
        tipo: '', numero: i?.estado === 'LEGADO_POR_REVISAR' ? i.valorLegado : '', pais: '',
        motivo: i && 'motivoAusencia' in i ? i.motivoAusencia : '' };
}
export function entradaIdentificacion(v: IdentificacionFormulario): IdentificacionEntrada {
  if (v.estado !== 'DOCUMENTADO') return { estado: v.estado, tipo: null, numero: null,
    paisEmisor: null, motivoAusencia: v.motivo };
  if (!v.tipo) throw new ErrorIdentificacionFormulario('Seleccione el tipo de documento.');
  if (v.tipo === 'PA' && !/^[A-Za-z]{2}$/.test(v.pais.trim())) throw new ErrorIdentificacionFormulario('Seleccione o escriba dos letras para el país emisor.');
  return { estado: v.estado, tipo: v.tipo, numero: v.numero,
    ...(v.tipo === 'PA' ? { paisEmisor: v.pais } : {}) };
}

// Etiquetas CLDR del navegador, no un catálogo normativo. También admite código libre de dos letras.
const nombresPaises = new Intl.DisplayNames(['es'], { type: 'region', fallback: 'none' });
const paises = Array.from({ length: 676 }, (_, n) => String.fromCharCode(65 + Math.floor(n / 26), 65 + n % 26))
  .flatMap(code => { const label = nombresPaises.of(code); return label ? [{ value: code, label: `${label} (${code})` }] : []; })
  .sort((a, b) => a.label.localeCompare(b.label, 'es'));

export function IdentificacionCampos({ value, onChange }: {
  value: IdentificacionFormulario; onChange: (v: IdentificacionFormulario) => void;
}) {
  const regla = value.tipo ? CATALOGO_DOCUMENTOS[value.tipo] : null;
  return <fieldset className="lz-form-section"><legend>Identificación del paciente</legend>
    <div className="grid grid-cols-2 gap-x-4 gap-y-4">
      <Campo etiqueta="Estado de identificación" className="col-span-2">
        <Select value={value.estado} onValueChange={estado => onChange({ ...value, estado: estado as IdentificacionFormulario['estado'] })}>
          <option value="DOCUMENTADO">Con documento</option>
          <option value="SIN_DOCUMENTO_ASIGNADO">Sin documento asignado</option>
          <option value="DOCUMENTO_NO_DISPONIBLE">Documento existente, no disponible</option>
        </Select>
      </Campo>
      {value.estado === 'DOCUMENTADO' ? <>
        <Campo etiqueta="Tipo de documento"><Select value={value.tipo} aria-required="true"
          options={[{ value: '', label: 'Seleccione un tipo', disabled: true },
            ...Object.entries(CATALOGO_DOCUMENTOS).map(([tipo, regla]) => ({ value: tipo, label: `${tipo} · ${regla.etiqueta}` }))]}
          onValueChange={tipo => onChange({ ...value, tipo: tipo as TipoDocumento })} /></Campo>
        <Campo etiqueta="Número de documento"><Input value={value.numero} required
          minLength={regla?.minLongitud} maxLength={regla?.maxLongitud}
          onChange={e => onChange({ ...value, numero: e.target.value })} /></Campo>
        {value.tipo === 'PA' && <Campo etiqueta="País emisor" className="col-span-2" ayuda="Seleccione el país o escriba su código de dos letras.">
          <Combobox value={value.pais} onValueChange={pais => onChange({ ...value, pais })} options={paises} allowFreeText required />
        </Campo>}
      </> : <Campo etiqueta="Motivo de ausencia del documento" className="col-span-2">
        <Textarea value={value.motivo} onChange={e => onChange({ ...value, motivo: e.target.value })} minLength={5} maxLength={255} required />
      </Campo>}
    </div></fieldset>;
}
