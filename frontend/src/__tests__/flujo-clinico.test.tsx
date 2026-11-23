import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, expect, it, vi } from 'vitest';
import { ResultadoFormModal } from '../components/resultados/ResultadoFormModal';
import { ResultadoRevisionModal } from '../components/resultados/ResultadoRevisionModal';
import { MuestraDetalleModal } from '../components/muestras/MuestraDetalleModal';
import { ToastProvider } from '../context/ToastContext';
import { muestrasApi, resultadosApi } from '../services/laboratorio';
import type { MuestraDetalle, ResultadoDetalle, WorklistItem } from '../types/api';

vi.mock('../services/laboratorio', () => ({
  resultadosApi: { registrar: vi.fn(), actualizar: vi.fn(), validar: vi.fn(), obtener: vi.fn() },
  muestrasApi: { obtener: vi.fn(), trazabilidad: vi.fn(), procesar: vi.fn() },
}));
vi.mock('../context/AuthContext', () => ({ useAuth: () => ({ puede: () => true }) }));
const version = '2026-01-01T00:00:00.000Z';
const versionNueva = '2026-01-02T00:00:00.000Z';
const paciente = { id: 1, cedula: 'FICTICIA', nombres: 'Persona', apellidos: 'Prueba', sexo: 'F', fechaNacimiento: '2000-01-01' };
const muestra = { id: 3, estado: 'EN_PROCESAMIENTO', codigoBarras: 'M260101-ABC234', tipoMuestra: 'Orina', fechaToma: version,
  solicitud: { prioridad: 'RUTINA', paciente }, examenes: [], recepcionadoPor: null } as unknown as MuestraDetalle;
const examen = { id: 1, codigo: 'URO', nombre: 'Urocultivo' };
const resultado = { id: 20, usuarioIdRegistra: 8, estado: 'PENDIENTE_VALIDACION', updatedAt: version,
  hallazgoGram: 'Gram inicial', bacteriaAislada: null, colonias: null, observaciones: null, antibiograma: [],
  registradoPor: { nombreCompleto: 'Profesional Prueba' }, validadoPor: null, fechaRegistro: version, fechaValidacion: null,
  muestraExamen: { id: 10, muestraId: 3, examen, muestra } } as unknown as ResultadoDetalle;
const item = { id: 10, examen, muestra, resultado } as unknown as WorklistItem;
const conflicto = { isAxiosError: true, response: { status: 409, data: { error: { code: 'CONFLICTO_CONCURRENCIA', message: 'El registro cambió.' } } } };
function abrirFormulario(valor = item) {
  const guardado = vi.fn(), recargar = vi.fn();
  render(<ToastProvider><ResultadoFormModal item={valor} puedeEditar onCerrar={vi.fn()} onGuardado={guardado} onConflicto={recargar} /></ToastProvider>);
  return { guardado, recargar };
}
function abrirRevision() {
  const validado = vi.fn(), recargar = vi.fn();
  render(<ToastProvider><ResultadoRevisionModal resultado={resultado} usuarioActualId={7} puedeValidar onCerrar={vi.fn()} onValidado={validado} onConflicto={recargar} /></ToastProvider>);
  return { validado, recargar };
}
async function confirmarFirma() {
  await userEvent.click(screen.getByRole('button', { name: 'Validar resultado' }));
  await userEvent.click(screen.getByRole('button', { name: 'Confirmar validación' }));
}
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(muestrasApi.obtener).mockResolvedValue(muestra);
  vi.mocked(muestrasApi.trazabilidad).mockResolvedValue([]);
});
it('edición envía la versión del contenido abierto y actualiza solo tras éxito', async () => {
  vi.mocked(resultadosApi.actualizar).mockResolvedValue({ ...resultado, updatedAt: versionNueva });
  const { guardado } = abrirFormulario();
  await userEvent.click(screen.getByRole('button', { name: 'Guardar corrección' }));
  await waitFor(() => expect(guardado).toHaveBeenCalledOnce());
  expect(resultadosApi.actualizar).toHaveBeenCalledWith(20, expect.objectContaining({ updatedAt: version, hallazgoGram: 'Gram inicial' }));
});
it('conflicto al corregir conserva el texto y bloquea reenvío hasta volver a abrir', async () => {
  vi.mocked(resultadosApi.actualizar).mockRejectedValue(conflicto);
  const { guardado, recargar } = abrirFormulario();
  fireEvent.change(screen.getByLabelText('Hallazgo microscópico (Gram)'), { target: { value: 'Mi corrección' } });
  await userEvent.click(screen.getByRole('button', { name: 'Guardar corrección' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Sus cambios no se han guardado');
  expect(screen.getByLabelText('Hallazgo microscópico (Gram)')).toHaveValue('Mi corrección');
  expect(screen.getByRole('button', { name: 'Guardar corrección' })).toBeDisabled();
  fireEvent.submit(document.getElementById('form-resultado')!);
  expect(resultadosApi.actualizar).toHaveBeenCalledOnce(); expect(guardado).not.toHaveBeenCalled(); expect(recargar).toHaveBeenCalledOnce();
  expect(screen.queryByText('Resultado corregido, queda pendiente de validación')).not.toBeInTheDocument();
});
for (const estado of ['REGISTRADA', 'RECEPTADA', 'RECHAZADA', 'PROCESADA'] as const) it(`no ofrece registrar resultado sobre muestra ${estado}`, () => {
  abrirFormulario({ ...item, resultado: null, muestra: { ...item.muestra, estado } });
  expect(screen.queryByRole('button', { name: 'Guardar resultado' })).not.toBeInTheDocument();
  expect(resultadosApi.registrar).not.toHaveBeenCalled();
});
it('doble submit inmediato produce una sola corrección', async () => {
  let resolver!: (value: ResultadoDetalle) => void;
  vi.mocked(resultadosApi.actualizar).mockReturnValue(new Promise(resolve => { resolver = resolve; }));
  abrirFormulario();
  const form = document.getElementById('form-resultado')!;
  fireEvent.submit(form); fireEvent.submit(form);
  expect(resultadosApi.actualizar).toHaveBeenCalledOnce();
  await act(async () => resolver(resultado));
});
it('conflicto de firma recarga los hallazgos, quita confirmación y exige revisión nueva', async () => {
  vi.mocked(resultadosApi.validar).mockRejectedValueOnce(conflicto).mockResolvedValueOnce({ ...resultado, estado: 'VALIDADO' });
  vi.mocked(resultadosApi.obtener).mockResolvedValue({ ...resultado, updatedAt: versionNueva, hallazgoGram: 'Gram corregido por otra persona' });
  const { validado, recargar } = abrirRevision(); await confirmarFirma();
  expect(await screen.findByText('Gram corregido por otra persona')).toBeInTheDocument();
  expect(screen.getByRole('alert')).toHaveTextContent('No se confirmó la firma');
  expect(screen.queryByRole('button', { name: 'Confirmar validación' })).not.toBeInTheDocument();
  expect(validado).not.toHaveBeenCalled(); expect(recargar).toHaveBeenCalledOnce();
  expect(resultadosApi.validar).toHaveBeenCalledExactlyOnceWith(20, version);
  await confirmarFirma(); await waitFor(() => expect(validado).toHaveBeenCalledOnce());
  expect(resultadosApi.validar).toHaveBeenLastCalledWith(20, versionNueva);
});
it('si falla la recarga tras conflicto no permite firmar la copia antigua', async () => {
  vi.mocked(resultadosApi.validar).mockRejectedValue(conflicto);
  vi.mocked(resultadosApi.obtener).mockRejectedValue(new Error('offline'));
  const { validado } = abrirRevision(); await confirmarFirma();
  expect(await screen.findByRole('alert')).toHaveTextContent('Cierre y vuelva a abrir');
  expect(screen.queryByRole('button', { name: 'Validar resultado' })).not.toBeInTheDocument(); expect(validado).not.toHaveBeenCalled();
});
it('no firma un resultado de muestra rechazada aunque tenga hallazgos históricos', () => {
  render(<ToastProvider><ResultadoRevisionModal resultado={{ ...resultado, muestraExamen: { ...resultado.muestraExamen,
    muestra: { ...resultado.muestraExamen.muestra, estado: 'RECHAZADA' } } }} usuarioActualId={7} puedeValidar onCerrar={vi.fn()} onValidado={vi.fn()} /></ToastProvider>);
  expect(screen.queryByRole('button', { name: 'Validar resultado' })).not.toBeInTheDocument();
});
it('conflicto de procesamiento recarga estado y trazabilidad sin anunciar éxito', async () => {
  vi.mocked(muestrasApi.obtener).mockResolvedValueOnce({ ...muestra, estado: 'RECEPTADA' }).mockResolvedValue({ ...muestra, estado: 'EN_PROCESAMIENTO' });
  vi.mocked(muestrasApi.procesar).mockRejectedValue(conflicto);
  const cambio = vi.fn();
  render(<ToastProvider><MuestraDetalleModal muestraId={3} onCerrar={vi.fn()} onCambio={cambio} /></ToastProvider>);
  await userEvent.click(await screen.findByRole('button', { name: 'Iniciar procesamiento' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('El registro cambió');
  await waitFor(() => expect(muestrasApi.obtener).toHaveBeenCalledTimes(2));
  expect(muestrasApi.trazabilidad).toHaveBeenCalledTimes(2);
  expect(screen.queryByRole('button', { name: 'Iniciar procesamiento' })).not.toBeInTheDocument();
  expect(screen.queryByText('Procesamiento iniciado')).not.toBeInTheDocument(); expect(cambio).not.toHaveBeenCalled();
});
