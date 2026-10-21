import { Plus, Trash2 } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { useToast } from '../../context/ToastContext';
import { detallesDeError, mensajeDeError, type DetalleCampo } from '../../services/api';
import { resultadosApi } from '../../services/laboratorio';
import type { AntibiogramaEntrada, Sensibilidad, WorklistItem } from '../../types/api';
import { SEXO_ETIQUETA, calcularEdad, formatFechaHora, nombrePaciente, opcional } from '../../utils/format';
import { Alert } from '../UI/Alert';
import { EstadoResultadoBadge, ETIQUETA_SENSIBILIDAD, PrioridadBadge } from '../UI/Badge';
import { Button } from '../UI/Button';
import { Dato, Datos, Seccion } from '../UI/Dato';
import { Campo, Input, Textarea } from '../UI/Form';
import { Modal } from '../UI/Modal';
import { ResultadoLectura } from './ResultadoLectura';

interface Props {
  item: WorklistItem;
  /** Solo el bacteriólogo carga o corrige hallazgos. */
  puedeEditar: boolean;
  onCerrar: () => void;
  onGuardado: () => void;
}

interface FilaAntibiograma {
  clave: string;
  antibiotico: string;
  sensibilidad: Sensibilidad;
  haloMm: string;
}

const ANTIBIOTICOS = [
  'Amikacina', 'Amoxicilina', 'Amoxicilina/Ácido clavulánico', 'Ampicilina', 'Azitromicina', 'Cefazolina',
  'Cefalexina', 'Ceftriaxona', 'Ciprofloxacino', 'Clindamicina', 'Eritromicina', 'Gentamicina', 'Imipenem',
  'Levofloxacino', 'Meropenem', 'Nitrofurantoína', 'Oxacilina', 'Penicilina', 'Trimetoprima/Sulfametoxazol', 'Vancomicina',
];

const OPCIONES_SENSIBILIDAD: Sensibilidad[] = ['S', 'I', 'R'];
const ID_FORMULARIO = 'form-resultado';

let contadorFilas = 0;
const nuevaClave = () => `fila-${(contadorFilas += 1)}`;

export function ResultadoFormModal({ item, puedeEditar, onCerrar, onGuardado }: Props) {
  const toast = useToast();
  const existente = item.resultado;
  const bloqueado = existente?.estado === 'VALIDADO';
  const soloLectura = bloqueado || !puedeEditar;

  const [hallazgoGram, setHallazgoGram] = useState(existente?.hallazgoGram ?? '');
  const [colonias, setColonias] = useState(existente?.colonias ?? '');
  const [bacteria, setBacteria] = useState(existente?.bacteriaAislada ?? '');
  const [observaciones, setObservaciones] = useState(existente?.observaciones ?? '');
  const [filas, setFilas] = useState<FilaAntibiograma[]>(
    () =>
      existente?.antibiograma.map((a) => ({
        clave: nuevaClave(),
        antibiotico: a.antibiotico,
        sensibilidad: a.sensibilidad,
        haloMm: a.haloMm ?? '',
      })) ?? [],
  );
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [detalles, setDetalles] = useState<DetalleCampo[]>([]);

  const paciente = item.muestra.solicitud.paciente;

  function actualizarFila(clave: string, cambios: Partial<FilaAntibiograma>) {
    setFilas((actuales) => actuales.map((f) => (f.clave === clave ? { ...f, ...cambios } : f)));
  }

  async function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setError(null);
    setDetalles([]);

    const antibiograma: AntibiogramaEntrada[] = filas
      .filter((f) => f.antibiotico.trim() !== '')
      .map((f) => ({
        antibiotico: f.antibiotico.trim(),
        sensibilidad: f.sensibilidad,
        haloMm: f.haloMm.trim() === '' ? undefined : Number(f.haloMm),
      }));

    const hallazgos = {
      hallazgoGram: opcional(hallazgoGram),
      colonias: opcional(colonias),
      bacteriaAislada: opcional(bacteria),
      observaciones: opcional(observaciones),
      antibiograma,
    };

    setGuardando(true);
    try {
      if (existente) {
        await resultadosApi.actualizar(existente.id, hallazgos);
        toast.exito('Resultado corregido, queda pendiente de validación');
      } else {
        await resultadosApi.registrar({ muestraExamenId: item.id, ...hallazgos });
        toast.exito('Resultado guardado, queda pendiente de validación');
      }
      onGuardado();
    } catch (e) {
      setError(mensajeDeError(e));
      setDetalles(detallesDeError(e));
      setGuardando(false);
    }
  }

  return (
    <Modal
      abierto
      ancho="xl"
      titulo={item.examen.nombre}
      subtitulo={existente ? <EstadoResultadoBadge estado={existente.estado} /> : 'Sin resultado cargado'}
      onCerrar={onCerrar}
      pie={
        soloLectura ? (
          <Button onClick={onCerrar}>Cerrar</Button>
        ) : (
          <>
            <Button onClick={onCerrar} disabled={guardando}>
              Cancelar
            </Button>
            <Button type="submit" form={ID_FORMULARIO} variante="primario" cargando={guardando}>
              {existente ? 'Guardar corrección' : 'Guardar resultado'}
            </Button>
          </>
        )
      }
    >
      <Datos columnas={4}>
        <Dato etiqueta="Paciente" className="col-span-2">
          <span className="font-semibold">{nombrePaciente(paciente)}</span>
        </Dato>
        <Dato etiqueta="Cédula">{paciente.cedula}</Dato>
        <Dato etiqueta="Edad y sexo">{`${calcularEdad(paciente.fechaNacimiento)} años, ${SEXO_ETIQUETA[paciente.sexo]}`}</Dato>
        <Dato etiqueta="Código de barras">
          <span className="font-mono text-xs">{item.muestra.codigoBarras}</span>
        </Dato>
        <Dato etiqueta="Tipo de muestra">{item.muestra.tipoMuestra}</Dato>
        <Dato etiqueta="Fecha de toma">{formatFechaHora(item.muestra.fechaToma)}</Dato>
        <Dato etiqueta="Prioridad">
          <PrioridadBadge prioridad={item.muestra.solicitud.prioridad} />
        </Dato>
        <Dato etiqueta="Diagnóstico presuntivo" className="col-span-4">{item.muestra.solicitud.diagnosticoPresuntivo}</Dato>
      </Datos>

      <Seccion titulo={soloLectura ? 'Hallazgos' : existente ? 'Corregir hallazgos' : 'Cargar hallazgos'}>
        {soloLectura ? (
          existente ? (
            <>
              {bloqueado && <div className="mb-3"><Alert tipo="info">Este resultado ya fue validado y no puede modificarse.</Alert></div>}
              <ResultadoLectura resultado={existente} />
            </>
          ) : (
            <p className="text-slate-500">Todavía no se cargó el resultado de este examen.</p>
          )
        ) : (
          <form id={ID_FORMULARIO} onSubmit={enviar} className="space-y-3">
            {existente && (
              <Alert tipo="aviso">Al guardar la corrección, usted pasa a ser quien registra este resultado y otra persona deberá validarlo.</Alert>
            )}
            {error && <Alert detalles={detalles}>{error}</Alert>}
            <div className="grid grid-cols-2 gap-3">
              <Campo etiqueta="Hallazgo microscópico (Gram)">
                <Textarea value={hallazgoGram} onChange={(e) => setHallazgoGram(e.target.value)} rows={3} placeholder="Por ejemplo: bacilos Gram negativos, abundantes leucocitos" />
              </Campo>
              <Campo etiqueta="Colonias">
                <Textarea value={colonias} onChange={(e) => setColonias(e.target.value)} rows={3} placeholder="Descripción y recuento en UFC/mL" />
              </Campo>
              <Campo etiqueta="Bacteria aislada" ayuda="Obligatoria si va a registrar antibiograma.">
                <Input value={bacteria} onChange={(e) => setBacteria(e.target.value)} />
              </Campo>
              <Campo etiqueta="Observaciones">
                <Input value={observaciones} onChange={(e) => setObservaciones(e.target.value)} />
              </Campo>
            </div>

            <div>
              <div className="mb-1 flex items-center justify-between">
                <h4 className="font-serif text-base font-semibold text-slate-900">Antibiograma</h4>
                <Button tamano="sm" icono={<Plus className="h-3.5 w-3.5" aria-hidden />} onClick={() => setFilas((a) => [...a, { clave: nuevaClave(), antibiotico: '', sensibilidad: 'S', haloMm: '' }])}>
                  Agregar antibiótico
                </Button>
              </div>
              <datalist id="lista-antibioticos">
                {ANTIBIOTICOS.map((a) => (
                  <option key={a} value={a} />
                ))}
              </datalist>
              {filas.length === 0 ? (
                <p className="text-xs text-slate-500">Sin antibiograma. Agregue antibióticos si se aisló una bacteria.</p>
              ) : (
                <ul className="space-y-1.5">
                  {filas.map((fila) => (
                    <li key={fila.clave} className="grid grid-cols-[1fr_auto_6rem_auto] items-center gap-2">
                      <Input aria-label="Antibiótico" list="lista-antibioticos" value={fila.antibiotico} onChange={(e) => actualizarFila(fila.clave, { antibiotico: e.target.value })} placeholder="Antibiótico" />
                      <div role="radiogroup" aria-label="Interpretación" className="flex overflow-hidden rounded-sm border border-slate-300">
                        {OPCIONES_SENSIBILIDAD.map((opcion) => {
                          const activa = fila.sensibilidad === opcion;
                          const color = { S: 'bg-emerald-600', I: 'bg-amber-500', R: 'bg-rose-600' }[opcion];
                          return (
                            <button
                              key={opcion}
                              type="button"
                              role="radio"
                              aria-checked={activa}
                              title={ETIQUETA_SENSIBILIDAD[opcion]}
                              onClick={() => actualizarFila(fila.clave, { sensibilidad: opcion })}
                              className={`h-8 w-9 text-sm font-bold ${activa ? `${color} text-white` : 'bg-white text-slate-600 hover:bg-slate-100'}`}
                            >
                              {opcion}
                            </button>
                          );
                        })}
                      </div>
                      <Input aria-label="Halo en milímetros" type="number" min={0} max={99.9} step={0.1} value={fila.haloMm} onChange={(e) => actualizarFila(fila.clave, { haloMm: e.target.value })} placeholder="Halo mm" />
                      <button type="button" aria-label="Quitar antibiótico" onClick={() => setFilas((a) => a.filter((f) => f.clave !== fila.clave))} className="rounded-sm p-1.5 text-slate-500 hover:bg-rose-50 hover:text-rose-700">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </form>
        )}
      </Seccion>
    </Modal>
  );
}
