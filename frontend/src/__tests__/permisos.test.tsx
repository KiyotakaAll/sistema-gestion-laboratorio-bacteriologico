import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, expect, it, vi } from 'vitest';
import App from '../App';
import { AuthProvider } from '../context/AuthContext';
import { ToastProvider } from '../context/ToastContext';
import { authApi, pacientesApi, resultadosApi, muestrasApi, usuariosApi } from '../services/laboratorio';
import { medicosApi } from '../services/medicos';
import { autorizacionPara, type Autorizacion } from '../../../backend/src/domain/permisos';
import { puedeUsuario } from '../utils/permisos';
import type { RolNombre, UsuarioSesion, ResultadoDetalle } from '../types/api';

vi.mock('../services/laboratorio', () => ({
  authApi: { perfil: vi.fn(), login: vi.fn() },
  pacientesApi: { listar: vi.fn(), capacidades: vi.fn(), obtener: vi.fn() },
  resultadosApi: { listar: vi.fn(), worklist: vi.fn(), validar: vi.fn() },
  muestrasApi: { listar: vi.fn() }, usuariosApi: { listar: vi.fn(), activar: vi.fn(), capacidades: vi.fn(), crear: vi.fn() },
}));
vi.mock('../services/medicos', () => ({ medicosApi: { capacidades: vi.fn(async () => ({ directorioMedicos: false })) } }));
const fecha='2026-01-01T13:00:00Z';
const paciente={id:73,cedula:'00073',nombres:'Persona',apellidos:'Sintética',fechaNacimiento:'1990-01-01T00:00:00Z',sexo:'F'};
const resultado={
  id:20,usuarioIdRegistra:8,estado:'PENDIENTE_VALIDACION',fechaRegistro:fecha,updatedAt:fecha,
  hallazgoGram:'Hallazgo sintético',colonias:null,bacteriaAislada:null,observaciones:null,antibiograma:[],
  registradoPor:{id:8,nombreCompleto:'Profesional Prueba'},validadoPor:null,fechaValidacion:null,
  muestraExamen:{examen:{id:1,nombre:'Examen sintético',codigo:'EX'},muestra:{id:3,codigoBarras:'M261101-TEST01',
    tipoMuestra:'Orina',estado:'PROCESADA',fechaToma:fecha,solicitud:{id:1,prioridad:'RUTINA',paciente}}},
} as unknown as ResultadoDetalle;
const pagina=<T,>(data:T[])=>({data,total:data.length,page:1,pageSize:25,totalPages:1});
const sesion=(rol:RolNombre,operativa=true):UsuarioSesion=>({id:7,username:'prueba',nombreCompleto:'Persona Prueba',rol,autorizacion:autorizacionPara(rol,operativa)});
beforeEach(()=>{
  vi.resetAllMocks();
  vi.mocked(pacientesApi.listar).mockResolvedValue(pagina([]));
  vi.mocked(pacientesApi.capacidades).mockResolvedValue({identificacionPacientes:false,registroPacientes:true});
  vi.mocked(medicosApi.capacidades).mockResolvedValue({directorioMedicos:false});
  vi.mocked(resultadosApi.listar).mockResolvedValue(pagina([resultado]));
  vi.mocked(resultadosApi.worklist).mockResolvedValue([]);
  vi.mocked(resultadosApi.validar).mockResolvedValue({...resultado,estado:'VALIDADO'});
  vi.mocked(muestrasApi.listar).mockResolvedValue(pagina([]));
  vi.mocked(usuariosApi.listar).mockResolvedValue(pagina([]));
  vi.mocked(usuariosApi.capacidades).mockResolvedValue({ roles: ['BACTERIOLOGO'] });
});
function abrir(ruta:string,usuario:UsuarioSesion){
  localStorage.setItem('lab_token','token-ficticio');vi.mocked(authApi.perfil).mockResolvedValue(usuario);
  return render(<MemoryRouter initialEntries={[ruta]}><ToastProvider><AuthProvider><App /></AuthProvider></ToastProvider></MemoryRouter>);
}
for(const rol of ['AUXILIAR','BACTERIOLOGO','ADMINISTRADOR','RECEPCIONISTA','VALIDADOR'] as const)it(`capacidades explícitas: ${rol}`,()=>{
  const u=sesion(rol);
  expect(puedeUsuario(u,'usuarios.administrar')).toBe(rol==='ADMINISTRADOR');
  expect(puedeUsuario(u,'resultados.validar')).toBe(rol==='BACTERIOLOGO');
  expect(puedeUsuario(u,'pacientes.escribir')).toBe(['AUXILIAR','RECEPCIONISTA','ADMINISTRADOR'].includes(rol));
  expect(puedeUsuario(u,'muestras.procesar')).toBe(rol==='BACTERIOLOGO');
});
it('API antigua conserva política histórica y nunca infiere el perfil AUXILIAR',()=>{
  for(const rol of ['AUXILIAR','BACTERIOLOGO','VALIDADOR'] as const){
    const u=sesion(rol);delete u.autorizacion;
    expect(puedeUsuario(u,'resultados.validar')).toBe(rol==='VALIDADOR');
    if(rol==='AUXILIAR')expect(puedeUsuario(u,'pacientes.escribir')).toBe(false);
  }
});
it('capacidades vacías, inválidas o elevadas por respuesta inconsistente no conceden acceso',()=>{
  const u=sesion('AUXILIAR');
  u.autorizacion={politica:'operativa-v1',perfilOperativo:'AUXILIAR',permisos:['usuarios.administrar','resultados.validar']};
  expect(puedeUsuario(u,'usuarios.administrar')).toBe(false);expect(puedeUsuario(u,'resultados.validar')).toBe(false);
  const b=sesion('BACTERIOLOGO');b.autorizacion={...b.autorizacion!,permisos:[]};expect(puedeUsuario(b,'resultados.escribir')).toBe(false);
  b.autorizacion={politica:'desconocida',permisos:['resultados.escribir']} as unknown as Autorizacion;
  expect(puedeUsuario(b,'resultados.escribir')).toBe(false);expect(puedeUsuario(null,'resultados.leer')).toBe(false);
});
for(const [rol,ruta]of [
  ['AUXILIAR','/worklist'],['AUXILIAR','/validacion'],['AUXILIAR','/usuarios'],
  ['BACTERIOLOGO','/usuarios'],['BACTERIOLOGO','/admision'],
  ['RECEPCIONISTA','/validacion'],['VALIDADOR','/usuarios'],['VALIDADOR','/worklist'],
] as const)it(`${rol} no abre directamente ${ruta}`,async()=>{
  abrir(ruta,sesion(rol));expect(await screen.findByText('Acceso restringido')).toBeInTheDocument();
  expect(resultadosApi.listar).not.toHaveBeenCalled();expect(resultadosApi.worklist).not.toHaveBeenCalled();
  expect(usuariosApi.listar).not.toHaveBeenCalled();expect(pacientesApi.listar).not.toHaveBeenCalled();
});
it('auxiliar ve admisión y recepción sin enlaces profesionales ni administración',async()=>{
  abrir('/admision',sesion('AUXILIAR'));
  await waitFor(()=>expect(screen.getByRole('button',{name:/Registrar paciente/})).toBeEnabled());
  expect(screen.getByRole('link',{name:'Admisión de pacientes'})).toBeInTheDocument();
  expect(screen.getByRole('link',{name:'Recepción de muestras'})).toBeInTheDocument();
  expect(screen.queryByRole('link',{name:'Worklist bacteriológico'})).not.toBeInTheDocument();
  expect(screen.queryByRole('link',{name:'Consulta y validación'})).not.toBeInTheDocument();
  expect(screen.queryByRole('link',{name:'Gestión de usuarios'})).not.toBeInTheDocument();
});
it('bacteriólogo accede a worklist y validación sin administrar usuarios',async()=>{
  abrir('/worklist',sesion('BACTERIOLOGO'));
  await waitFor(()=>expect(resultadosApi.worklist).toHaveBeenCalled());
  expect(screen.getByRole('link',{name:'Consulta y validación'})).toBeInTheDocument();
  expect(screen.queryByRole('link',{name:'Gestión de usuarios'})).not.toBeInTheDocument();
});
it('administración histórica conserva su sección sin recibir firma clínica',async()=>{
  abrir('/usuarios',sesion('ADMINISTRADOR'));
  await waitFor(()=>expect(usuariosApi.listar).toHaveBeenCalled());
  expect(screen.getByRole('link',{name:'Gestión de usuarios'})).toHaveAttribute('aria-current','page');
});
async function abrirResultado(usuario:UsuarioSesion){
  abrir('/validacion',usuario);
  await userEvent.click(await screen.findByText('Sintética, Persona'));
  return screen.findByRole('dialog',{name:'Examen sintético'});
}
it('bacteriólogo confirma firma clínica de trabajo ajeno',async()=>{
  await abrirResultado(sesion('BACTERIOLOGO'));
  await userEvent.click(screen.getByRole('button',{name:'Validar resultado'}));
  expect(resultadosApi.validar).not.toHaveBeenCalled();
  await userEvent.click(screen.getByRole('button',{name:'Confirmar validación'}));
  await waitFor(()=>expect(resultadosApi.validar).toHaveBeenCalledExactlyOnceWith(20, fecha));
});
for(const rol of ['VALIDADOR','ADMINISTRADOR'] as const)it(`${rol} con política nueva consulta sin botón de firma`,async()=>{
  await abrirResultado(sesion(rol));expect(screen.queryByRole('button',{name:'Validar resultado'})).not.toBeInTheDocument();
  expect(screen.getByText('Su perfil permite consultar este resultado, pero no autoriza su firma.')).toBeInTheDocument();
});
it('bacteriólogo no puede firmar su propio resultado',async()=>{
  vi.mocked(resultadosApi.listar).mockResolvedValue(pagina([{...resultado,usuarioIdRegistra:7}]));
  await abrirResultado(sesion('BACTERIOLOGO'));
  expect(screen.queryByRole('button',{name:'Validar resultado'})).not.toBeInTheDocument();
  expect(screen.getByText(/Usted registró este resultado/)).toBeInTheDocument();
});
it('modo histórico mantiene el botón del validador y niega firma al bacteriólogo',async()=>{
  const vista=abrir('/validacion',sesion('VALIDADOR',false));
  await userEvent.click(await screen.findByText('Sintética, Persona'));
  expect(screen.getByRole('button',{name:'Validar resultado'})).toBeEnabled();vista.unmount();
  await abrirResultado(sesion('BACTERIOLOGO',false));expect(screen.queryByRole('button',{name:'Validar resultado'})).not.toBeInTheDocument();
});
it('capacidades presentes y vacías no se sustituyen por inferencia del rol',async()=>{
  const u=sesion('BACTERIOLOGO');u.autorizacion={...u.autorizacion!,permisos:[]};
  abrir('/worklist',u);expect(await screen.findByText('Acceso restringido')).toBeInTheDocument();expect(resultadosApi.worklist).not.toHaveBeenCalled();
});
it('separa editar paciente de crear solicitudes o registrar muestras según capacidades',async()=>{
  vi.mocked(pacientesApi.listar).mockResolvedValue(pagina([paciente]) as never);
  vi.mocked(pacientesApi.obtener).mockResolvedValue({...paciente,solicitudes:[{id:1,codigo:'SOL-PRUEBA',fechaSolicitud:fecha,prioridad:'RUTINA',medicoSolicitante:'Histórico',_count:{muestras:0}}]} as never);
  const u=sesion('AUXILIAR');u.autorizacion={...u.autorizacion!,permisos:u.autorizacion!.permisos.filter(p=>p!=='solicitudes.escribir'&&p!=='muestras.registrar')};
  abrir('/admision',u);await userEvent.click(await screen.findByText('Sintética, Persona'));
  expect(await screen.findByRole('button',{name:'Editar datos'})).toBeEnabled();
  expect(screen.queryByRole('button',{name:'Nueva solicitud'})).not.toBeInTheDocument();
  expect(screen.queryByRole('button',{name:'Registrar muestra'})).not.toBeInTheDocument();
});
it('login usa las capacidades del servidor y no decodifica privilegios del token local',async()=>{
  vi.mocked(authApi.login).mockResolvedValue({token:'token-ficticio',usuario:sesion('AUXILIAR')});
  render(<MemoryRouter initialEntries={['/login']}><ToastProvider><AuthProvider><App /></AuthProvider></ToastProvider></MemoryRouter>);
  fireEvent.change(screen.getByLabelText(/^Usuario$/i),{target:{value:'auxiliar'}});
  fireEvent.change(screen.getByLabelText(/^Contraseña$/i),{target:{value:'clave-sintetica'}});
  await userEvent.click(screen.getByRole('button',{name:/Iniciar sesión/i}));
  await waitFor(()=>expect(authApi.login).toHaveBeenCalled());
  expect(await screen.findByRole('link',{name:'Admisión de pacientes'})).toBeInTheDocument();
  expect(screen.queryByRole('link',{name:'Gestión de usuarios'})).not.toBeInTheDocument();
});
