import { BadgeCheck, Check } from 'lucide-react';
import { useState } from 'react';
import { useToast } from '../../context/ToastContext';
import { mensajeDeError } from '../../services/api';
import { resultadosApi } from '../../services/laboratorio';
import type { ResultadoDetalle } from '../../types/api';
import { SEXO_ETIQUETA, calcularEdad, formatFechaHora, nombrePaciente } from '../../utils/format';
import { Alert } from '../UI/Alert';
import { EstadoResultadoBadge, PrioridadBadge } from '../UI/Badge';
import { Button } from '../UI/Button';
import { Dato, Datos, Seccion } from '../UI/Dato';
import { Modal } from '../UI/Modal';
import { ResultadoLectura } from './ResultadoLectura';

interface Props {
  resultado: ResultadoDetalle;
  usuarioActualId: number;
  /** Solo el rol VALIDADOR puede firmar; el administrador solo consulta. */
  puedeValidar: boolean;
  onCerrar: () => void;
  onValidado: (resultado: ResultadoDetalle) => void;
}

/** Revisión y validación formal (doble firma) de un resultado. */
export function ResultadoRevisionModal({ resultado: inicial, usuarioActualId, puedeValidar, onCerrar, onValidado }: Props) {
  const toast = useToast();
  const [resultado, setResultado] = useState(inicial);
  const [confirmando, setConfirmando] = useState(false);
  const [validando, setValidando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { muestra, examen } = resultado.muestraExamen;
  const paciente = muestra.solicitud.paciente;
  const validado = resultado.estado === 'VALIDADO';
  const esQuienRegistro = resultado.usuarioIdRegistra === usuarioActualId;
  const puedeFirmar = puedeValidar && !validado && !esQuienRegistro;

  async function validar() {
    setValidando(true);
    setError(null);
    try {
      const actualizado = await resultadosApi.validar(resultado.id);
      setResultado(actualizado);
      setConfirmando(false);
      toast.exito('Resultado validado');
      onValidado(actualizado);
    } catch (e) {
      setError(mensajeDeError(e));
    } finally {
      setValidando(false);
    }
  }

  return (
    <Modal
      abierto
      ancho="xl"
      titulo={examen.nombre}
      subtitulo={<EstadoResultadoBadge estado={resultado.estado} />}
      onCerrar={onCerrar}
      pie={<Button onClick={onCerrar}>Cerrar</Button>}
    >
      <Datos columnas={4}>
        <Dato etiqueta="Paciente" className="col-span-2">
          <span className="font-semibold">{nombrePaciente(paciente)}</span>
        </Dato>
        <Dato etiqueta="Cédula">{paciente.cedula}</Dato>
        <Dato etiqueta="Edad y sexo">{`${calcularEdad(paciente.fechaNacimiento)} años, ${SEXO_ETIQUETA[paciente.sexo]}`}</Dato>
        <Dato etiqueta="Código de barras">
          <span className="font-mono text-xs">{muestra.codigoBarras}</span>
        </Dato>
        <Dato etiqueta="Tipo de muestra">{muestra.tipoMuestra}</Dato>
        <Dato etiqueta="Fecha de toma">{formatFechaHora(muestra.fechaToma)}</Dato>
        <Dato etiqueta="Prioridad">
          <PrioridadBadge prioridad={muestra.solicitud.prioridad} />
        </Dato>
      </Datos>

      <Seccion titulo="Hallazgos registrados">
        <ResultadoLectura resultado={resultado} />
      </Seccion>

      <Seccion titulo="Doble firma">
        {error && <div className="mb-3"><Alert>{error}</Alert></div>}

        <div className="grid grid-cols-2 gap-8 rounded border border-slate-300 bg-slate-50 px-6 py-4">
          <FirmaBloque
            rol="Registró el resultado"
            nombre={resultado.registradoPor.nombreCompleto}
            fecha={formatFechaHora(resultado.fechaRegistro)}
            firmado
          />
          <FirmaBloque
            rol="Valida el resultado"
            nombre={resultado.validadoPor?.nombreCompleto ?? null}
            fecha={resultado.fechaValidacion ? formatFechaHora(resultado.fechaValidacion) : null}
            firmado={validado}
          />
        </div>

        {!validado && puedeValidar && esQuienRegistro && (
          <div className="mt-3">
            <Alert tipo="aviso">Usted registró este resultado. Por la regla de doble firma, debe validarlo otra persona.</Alert>
          </div>
        )}
        {!validado && !puedeValidar && (
          <div className="mt-3">
            <Alert tipo="info">Su rol puede consultar este resultado, pero solo un validador puede firmarlo.</Alert>
          </div>
        )}

        {puedeFirmar && !confirmando && (
          <div className="mt-3 flex justify-end">
            <Button variante="primario" icono={<BadgeCheck className="h-4 w-4" aria-hidden />} onClick={() => setConfirmando(true)}>
              Validar resultado
            </Button>
          </div>
        )}
        {puedeFirmar && confirmando && (
          <div className="mt-3 flex items-center justify-between gap-4 rounded border border-violeta-300 bg-violeta-50 px-4 py-3">
            <p className="text-sm text-violeta-900">Al validar, el resultado queda firmado con su nombre y ya no podrá modificarse.</p>
            <div className="flex shrink-0 gap-2">
              <Button onClick={() => setConfirmando(false)} disabled={validando}>
                Cancelar
              </Button>
              <Button variante="primario" cargando={validando} onClick={() => void validar()}>
                Confirmar validación
              </Button>
            </div>
          </div>
        )}
      </Seccion>
    </Modal>
  );
}

interface FirmaProps {
  rol: string;
  nombre: string | null;
  fecha: string | null;
  firmado: boolean;
}

/** Una de las dos firmas: línea de firma con el nombre en cursiva, o vacía si aún está pendiente. */
function FirmaBloque({ rol, nombre, fecha, firmado }: FirmaProps) {
  return (
    <div>
      <p className="mb-1 text-xs text-slate-500">{rol}</p>
      <div className={`flex min-h-[3.25rem] items-end justify-between border-b-2 pb-1 ${firmado ? 'border-violeta-700' : 'border-dashed border-slate-400'}`}>
        {firmado && nombre ? (
          <>
            <span className="font-serif text-xl italic text-violeta-900">{nombre}</span>
            <Check className="mb-1 h-5 w-5 text-emerald-600" aria-label="Firmado" />
          </>
        ) : (
          <span className="pb-1 text-sm text-slate-400">Pendiente de firma</span>
        )}
      </div>
      <p className="mt-1 text-xs text-slate-600">{fecha ?? '—'}</p>
    </div>
  );
}
