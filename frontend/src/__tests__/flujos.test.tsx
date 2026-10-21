import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../App';
import { AuthProvider } from '../context/AuthContext';
import { ToastProvider } from '../context/ToastContext';
import {
  authApi,
  examenesApi,
  muestrasApi,
  pacientesApi,
  resultadosApi,
  solicitudesApi,
} from '../services/laboratorio';
import type { RolNombre } from '../types/api';

vi.mock('../services/laboratorio', () => ({
  authApi: { perfil: vi.fn(), login: vi.fn() },
  pacientesApi: { listar: vi.fn(), obtener: vi.fn(), crear: vi.fn(), actualizar: vi.fn() },
  solicitudesApi: { listar: vi.fn(), obtener: vi.fn(), crear: vi.fn() },
  examenesApi: { listar: vi.fn() },
  muestrasApi: { listar: vi.fn(), obtener: vi.fn(), porCodigo: vi.fn(), trazabilidad: vi.fn(), registrar: vi.fn(), receptar: vi.fn(), procesar: vi.fn(), rechazar: vi.fn() },
  resultadosApi: { worklist: vi.fn(), listar: vi.fn(), obtener: vi.fn(), registrar: vi.fn(), actualizar: vi.fn(), validar: vi.fn() },
}));

/* ---------- datos de prueba ---------- */
const FECHA = '2026-10-14T13:00:00.000Z';
const paciente = (id: number, nombres: string, apellidos: string) => ({
  id, cedula: `1000${id}`, nombres, apellidos, fechaNacimiento: '1990-05-12T00:00:00.000Z', sexo: 'F' as const,
  telefono: null, email: null, direccion: null, createdAt: FECHA, updatedAt: FECHA,
});
const solicitud = (p: ReturnType<typeof paciente>) => ({
  id: 1, codigo: 'SOL-2026-000001', pacienteId: p.id, usuarioIdRegistra: 1, medicoSolicitante: 'Dr. Ruiz',
  diagnosticoPresuntivo: 'ITU', prioridad: 'URGENTE' as const, fechaSolicitud: FECHA, observaciones: null, createdAt: FECHA, updatedAt: FECHA, paciente: p,
});
const muestra = (p: ReturnType<typeof paciente>) => ({
  id: 3, codigoBarras: 'M261014-ABC234', solicitudId: 1, tipoMuestra: 'Orina', sitioAnatomico: null, estado: 'EN_PROCESAMIENTO' as const,
  fechaToma: FECHA, fechaRecepcion: FECHA, fechaProcesamiento: FECHA, usuarioIdRecepciona: 1, motivoRechazo: null, createdAt: FECHA, updatedAt: FECHA,
  solicitud: solicitud(p),
});
const examen = { id: 1, codigo: 'URO-CUL', nombre: 'Urocultivo', tipoMuestraRequerida: 'Orina', descripcion: null, precio: '8.50', activo: true };
const itemWorklist = (p: ReturnType<typeof paciente>, id: number) => ({ id, muestraId: 3, examenId: 1, createdAt: FECHA, examen, muestra: muestra(p), resultado: null });
const resultado = (p: ReturnType<typeof paciente>, usuarioIdRegistra: number) => ({
  id: 7, muestraExamenId: 5, usuarioIdRegistra, hallazgoGram: 'Bacilos Gram negativos', colonias: '>100000 UFC/mL', bacteriaAislada: 'Escherichia coli',
  observaciones: null, estado: 'PENDIENTE_VALIDACION' as const, fechaRegistro: FECHA, usuarioIdValida: null, fechaValidacion: null, updatedAt: FECHA,
  antibiograma: [{ id: 1, resultadoId: 7, antibiotico: 'Ciprofloxacino', sensibilidad: 'R' as const, haloMm: '12.0' }],
  registradoPor: { id: usuarioIdRegistra, username: 'bact', nombreCompleto: 'Carlos Gómez' }, validadoPor: null,
  muestraExamen: { id: 5, muestraId: 3, examenId: 1, createdAt: FECHA, examen, muestra: muestra(p) },
});
const paginado = <T,>(data: T[]) => ({ data, total: data.length, page: 1, pageSize: 25, totalPages: 1 });

const ana = paciente(1, 'Ana', 'Pérez');
const luis = paciente(2, 'Luis', 'Gómez');

function entrar(ruta: string, rol: RolNombre, id = 9) {
  localStorage.setItem('lab_token', 'token-de-prueba');
  vi.mocked(authApi.perfil).mockResolvedValue({ id, username: rol.toLowerCase(), nombreCompleto: `Usuario ${rol}`, rol });
  return render(
    <MemoryRouter initialEntries={[ruta]}>
      <ToastProvider>
        <AuthProvider>
          <App />
        </AuthProvider>
      </ToastProvider>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(muestrasApi.listar).mockResolvedValue(paginado([]) as never);
  vi.mocked(resultadosApi.listar).mockResolvedValue(paginado([]) as never);
});

describe('Acceso y roles', () => {
  it('sin sesión redirige al login', async () => {
    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <ToastProvider><AuthProvider><App /></AuthProvider></ToastProvider>
      </MemoryRouter>,
    );
    expect(await screen.findByRole('heading', { name: 'Iniciar sesión' })).toBeInTheDocument();
  });

  it('el login muestra el mensaje de error del backend', async () => {
    const error = Object.assign(new Error('x'), { isAxiosError: true, response: { status: 401, data: { error: { message: 'Usuario o contraseña incorrectos.' } } } });
    vi.mocked(authApi.login).mockRejectedValue(error);
    render(
      <MemoryRouter initialEntries={['/login']}>
        <ToastProvider><AuthProvider><App /></AuthProvider></ToastProvider>
      </MemoryRouter>,
    );
    const u = userEvent.setup();
    await u.type(await screen.findByLabelText('Usuario'), 'admin');
    await u.type(screen.getByLabelText('Contraseña'), 'mala');
    await u.click(screen.getByRole('button', { name: 'Iniciar sesión' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Usuario o contraseña incorrectos.');
  });

  it('un bacteriólogo no puede entrar a Admisión', async () => {
    entrar('/admision', 'BACTERIOLOGO');
    expect(await screen.findByText('Acceso restringido')).toBeInTheDocument();
  });

  it('el menú solo muestra las secciones del rol', async () => {
    entrar('/dashboard', 'VALIDADOR');
    const menu = await screen.findByRole('navigation', { name: 'Principal' });
    expect(within(menu).getByText('Validación de resultados')).toBeInTheDocument();
    expect(within(menu).queryByText('Admisión de pacientes')).not.toBeInTheDocument();
    expect(within(menu).queryByText('Worklist bacteriológico')).not.toBeInTheDocument();
  });
});

describe('Admisión (Master-Detail)', () => {
  it('abre el detalle del paciente con sus solicitudes', async () => {
    vi.mocked(pacientesApi.listar).mockResolvedValue(paginado([ana]) as never);
    vi.mocked(pacientesApi.obtener).mockResolvedValue({ ...ana, solicitudes: [{ ...solicitud(ana), _count: { muestras: 2 } }] } as never);
    entrar('/admision', 'RECEPCIONISTA');
    const u = userEvent.setup();
    await u.click(await screen.findByText('Pérez, Ana'));
    expect(await screen.findByRole('heading', { name: 'Solicitudes médicas' })).toBeInTheDocument();
    expect(screen.getByText('SOL-2026-000001')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Nueva solicitud/ })).toBeInTheDocument();
  });
});

describe('Tabla densa', () => {
  it('filtra en tiempo real sin distinguir tildes ni mayúsculas', async () => {
    vi.mocked(resultadosApi.worklist).mockResolvedValue([itemWorklist(ana, 5), itemWorklist(luis, 6)] as never);
    entrar('/worklist', 'BACTERIOLOGO');
    const u = userEvent.setup();
    expect(await screen.findByText('Pérez, Ana')).toBeInTheDocument();
    expect(screen.getByText('Gómez, Luis')).toBeInTheDocument();
    await u.type(screen.getByRole('searchbox'), 'PEREZ');
    expect(screen.getByText('Pérez, Ana')).toBeInTheDocument();
    expect(screen.queryByText('Gómez, Luis')).not.toBeInTheDocument();
  });

  it('ordena al hacer clic en el encabezado', async () => {
    vi.mocked(resultadosApi.worklist).mockResolvedValue([itemWorklist(ana, 5), itemWorklist(luis, 6)] as never);
    entrar('/worklist', 'BACTERIOLOGO');
    const u = userEvent.setup();
    await screen.findByText('Pérez, Ana');
    await u.click(screen.getByRole('button', { name: 'Paciente' }));
    const filas = screen.getAllByRole('row').slice(1);
    expect(filas[0]).toHaveTextContent('Gómez, Luis');
    expect(filas[1]).toHaveTextContent('Pérez, Ana');
  });
});

describe('Worklist: carga de resultado con antibiograma', () => {
  it('envía hallazgos y antibiograma al API', async () => {
    vi.mocked(resultadosApi.worklist).mockResolvedValue([itemWorklist(ana, 5)] as never);
    vi.mocked(resultadosApi.registrar).mockResolvedValue(resultado(ana, 9) as never);
    entrar('/worklist', 'BACTERIOLOGO');
    const u = userEvent.setup();
    await u.click(await screen.findByText('Pérez, Ana'));
    expect(await screen.findByRole('heading', { name: 'Cargar hallazgos' })).toBeInTheDocument();

    await u.type(screen.getByLabelText(/Bacteria aislada/), 'E. coli');
    await u.click(screen.getByRole('button', { name: /Agregar antibiótico/ }));
    await u.type(screen.getByLabelText('Antibiótico'), 'Ciprofloxacino');
    await u.click(screen.getByRole('radio', { name: 'R' }));
    await u.type(screen.getByLabelText('Halo en milímetros'), '12');
    await u.click(screen.getByRole('button', { name: 'Guardar resultado' }));

    await waitFor(() => expect(resultadosApi.registrar).toHaveBeenCalledTimes(1));
    expect(resultadosApi.registrar).toHaveBeenCalledWith({
      muestraExamenId: 5,
      bacteriaAislada: 'E. coli',
      antibiograma: [{ antibiotico: 'Ciprofloxacino', sensibilidad: 'R', haloMm: 12 }],
    });
  });

  it('el administrador ve el resultado pero no el formulario de carga', async () => {
    vi.mocked(resultadosApi.worklist).mockResolvedValue([itemWorklist(ana, 5)] as never);
    entrar('/worklist', 'ADMINISTRADOR');
    const u = userEvent.setup();
    await u.click(await screen.findByText('Pérez, Ana'));
    expect(await screen.findByText('Todavía no se cargó el resultado de este examen.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Guardar resultado' })).not.toBeInTheDocument();
  });
});

describe('Validación con doble firma', () => {
  it('un validador distinto firma el resultado tras confirmar', async () => {
    vi.mocked(resultadosApi.listar).mockResolvedValue(paginado([resultado(ana, 3)]) as never);
    vi.mocked(resultadosApi.validar).mockResolvedValue({ ...resultado(ana, 3), estado: 'VALIDADO', usuarioIdValida: 9, fechaValidacion: FECHA, validadoPor: { id: 9, username: 'val', nombreCompleto: 'Dra. Ortiz' } } as never);
    entrar('/validacion', 'VALIDADOR', 9);
    const u = userEvent.setup();
    await u.click(await screen.findByText('Pérez, Ana'));
    await u.click(await screen.findByRole('button', { name: /Validar resultado/ }));
    expect(screen.getByText(/ya no podrá modificarse/)).toBeInTheDocument();
    await u.click(screen.getByRole('button', { name: 'Confirmar validación' }));
    await waitFor(() => expect(resultadosApi.validar).toHaveBeenCalledWith(7));
    expect(await screen.findByText('Dra. Ortiz')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Validar resultado/ })).not.toBeInTheDocument();
  });

  it('quien registró el resultado no puede validarlo', async () => {
    vi.mocked(resultadosApi.listar).mockResolvedValue(paginado([resultado(ana, 9)]) as never);
    entrar('/validacion', 'VALIDADOR', 9);
    const u = userEvent.setup();
    await u.click(await screen.findByText('Pérez, Ana'));
    expect(await screen.findByText(/debe validarlo otra persona/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Validar resultado/ })).not.toBeInTheDocument();
    expect(resultadosApi.validar).not.toHaveBeenCalled();
  });

  it('el administrador solo consulta, no firma', async () => {
    vi.mocked(resultadosApi.listar).mockResolvedValue(paginado([resultado(ana, 3)]) as never);
    entrar('/validacion', 'ADMINISTRADOR', 1);
    const u = userEvent.setup();
    await u.click(await screen.findByText('Pérez, Ana'));
    expect(await screen.findByText(/solo un validador puede firmarlo/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Validar resultado/ })).not.toBeInTheDocument();
  });
});

describe('Recepción de muestras', () => {
  it('el bacteriólogo ve "Iniciar procesamiento" en una muestra receptada y no puede receptar', async () => {
    const m = { ...muestra(ana), estado: 'RECEPTADA' as const };
    vi.mocked(muestrasApi.listar).mockResolvedValue(paginado([{ ...m, examenes: [{ id: 5, examen: { id: 1, codigo: 'URO-CUL', nombre: 'Urocultivo' } }] }]) as never);
    vi.mocked(muestrasApi.obtener).mockResolvedValue({ ...m, solicitud: { ...solicitud(ana), paciente: ana }, recepcionadoPor: null, examenes: [{ id: 5, muestraId: 3, examenId: 1, createdAt: FECHA, examen, resultado: null }] } as never);
    vi.mocked(muestrasApi.trazabilidad).mockResolvedValue([{ id: 1, accion: 'REGISTRAR', estadoAnterior: null, estadoNuevo: 'REGISTRADA', detalle: null, fechaEvento: FECHA, usuario: { id: 1, username: 'rec', nombreCompleto: 'Rosa Martínez' } }] as never);
    vi.mocked(muestrasApi.procesar).mockResolvedValue({} as never);
    entrar('/recepcion', 'BACTERIOLOGO');
    const u = userEvent.setup();
    await u.click(await screen.findByText('Pérez, Ana'));
    expect(await screen.findByRole('heading', { name: 'Trazabilidad' })).toBeInTheDocument();
    expect(screen.getByText('Muestra registrada')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Receptar muestra/ })).not.toBeInTheDocument();
    await u.click(screen.getByRole('button', { name: /Iniciar procesamiento/ }));
    await waitFor(() => expect(muestrasApi.procesar).toHaveBeenCalledWith(3));
  });

  it('el rechazo exige un motivo de al menos 5 caracteres', async () => {
    const m = { ...muestra(ana), estado: 'REGISTRADA' as const };
    vi.mocked(muestrasApi.listar).mockResolvedValue(paginado([{ ...m, examenes: [] }]) as never);
    vi.mocked(muestrasApi.obtener).mockResolvedValue({ ...m, solicitud: { ...solicitud(ana), paciente: ana }, recepcionadoPor: null, examenes: [] } as never);
    vi.mocked(muestrasApi.trazabilidad).mockResolvedValue([] as never);
    vi.mocked(muestrasApi.rechazar).mockResolvedValue({} as never);
    entrar('/recepcion', 'RECEPCIONISTA');
    const u = userEvent.setup();
    await u.click(await screen.findByText('Pérez, Ana'));
    await u.click(await screen.findByRole('button', { name: /Rechazar muestra/ }));
    const confirmar = screen.getByRole('button', { name: 'Confirmar rechazo' });
    expect(confirmar).toBeDisabled();
    await u.type(screen.getByLabelText(/Motivo del rechazo/), 'Volumen insuficiente');
    expect(confirmar).toBeEnabled();
    await u.click(confirmar);
    await waitFor(() => expect(muestrasApi.rechazar).toHaveBeenCalledWith(3, 'Volumen insuficiente'));
  });
});

describe('Registro de muestra', () => {
  it('permite buscar la solicitud por cédula y registrar con exámenes', async () => {
    vi.mocked(solicitudesApi.listar).mockResolvedValue(paginado([{ ...solicitud(ana), _count: { muestras: 0 } }]) as never);
    vi.mocked(examenesApi.listar).mockResolvedValue([examen] as never);
    vi.mocked(muestrasApi.registrar).mockResolvedValue({ ...muestra(ana), examenes: [], recepcionadoPor: null, solicitud: { ...solicitud(ana), paciente: ana } } as never);
    vi.mocked(muestrasApi.obtener).mockResolvedValue({ ...muestra(ana), examenes: [], recepcionadoPor: null, solicitud: { ...solicitud(ana), paciente: ana } } as never);
    vi.mocked(muestrasApi.trazabilidad).mockResolvedValue([] as never);
    entrar('/recepcion', 'RECEPCIONISTA');
    const u = userEvent.setup();
    await u.click(await screen.findByRole('button', { name: /Registrar muestra/ }));
    await u.type(await screen.findByLabelText('Cédula del paciente'), '10001{Enter}');
    await u.click(await screen.findByText('SOL-2026-000001'));
    await u.click(await screen.findByRole('checkbox', { name: /Urocultivo/ }));
    // El tipo de muestra se sugiere a partir del examen elegido.
    expect(screen.getByLabelText('Tipo de muestra')).toHaveValue('Orina');
    await u.click(screen.getAllByRole('button', { name: 'Registrar muestra' }).at(-1) as HTMLElement);
    await waitFor(() => expect(muestrasApi.registrar).toHaveBeenCalledTimes(1));
    expect(muestrasApi.registrar).toHaveBeenCalledWith(expect.objectContaining({ solicitudId: 1, tipoMuestra: 'Orina', examenIds: [1] }));
  });
});
