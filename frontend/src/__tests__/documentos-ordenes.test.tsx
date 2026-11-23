import { useState } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, expect, it, vi } from 'vitest';
import { SitioSelector } from '../components/muestras/SitioSelector';
import { NuevaSolicitudForm } from '../components/admision/PacienteDetalleModal';
import { MuestraFormModal } from '../components/muestras/MuestraFormModal';
import { DocumentoAcciones } from '../components/documentos/DocumentoAcciones';
import { ToastProvider } from '../context/ToastContext';
import { catalogosApi, type CatalogoFlujo } from '../services/catalogos';
import { documentosApi } from '../services/documentos';
import { examenesApi, muestrasApi, solicitudesApi } from '../services/laboratorio';
import type { SolicitudDetalle } from '../types/api';

vi.mock('../context/AuthContext', () => ({ useAuth: () => ({ puede: (p: string) => p !== 'usuarios.administrar' }) }));
vi.mock('../services/catalogos', () => ({ catalogosApi: { flujo: vi.fn(), crearSitio: vi.fn(), crearPlantilla: vi.fn() } }));
vi.mock('../services/documentos', () => ({ documentosApi: { obtener: vi.fn() } }));
vi.mock('../services/laboratorio', () => ({ examenesApi: { listar: vi.fn() }, solicitudesApi: { crear: vi.fn(), obtener: vi.fn() }, muestrasApi: { registrar: vi.fn() }, pacientesApi: {} }));
const sitios = [{ id: 1, nombre: 'Faríngeo', tiposMuestra: ['Exudado'] }, { id: 2, nombre: 'Nasal', tiposMuestra: ['Exudado'] }, { id: 3, nombre: 'Herida', tiposMuestra: ['Secreción'] }];
const catalogo: CatalogoFlujo = { habilitado: true, tiposMuestra: ['Orina', 'Exudado', 'Secreción'], sitios, plantillas: [{ id: 8, nombre: 'Selección habitual', examenIds: [10] }] };
const examen = { id: 10, codigo: 'URO', nombre: 'Urocultivo', tipoMuestraRequerida: 'Orina', descripcion: null, activo: true, precio: '0' };
const fecha = '2026-11-23T12:00:00.000Z';
const solicitudBase: SolicitudDetalle = { id:42,codigo:'SOL-42',pacienteId:9,usuarioIdRegistra:1,
  medicoSolicitante:null,diagnosticoPresuntivo:null,prioridad:'RUTINA',fechaSolicitud:fecha,
  observaciones:null,createdAt:fecha,updatedAt:fecha,muestras:[],
  registradoPor:{id:1,username:'auxiliar',nombreCompleto:'Persona auxiliar'},
  paciente:{id:9,cedula:'009',nombres:'Persona',apellidos:'Sintética',fechaNacimiento:'1990-01-01',
    sexo:'F',telefono:null,email:null,direccion:null,createdAt:fecha,updatedAt:fecha},
};
const fallo = { isAxiosError: true, response: { status: 409, data: { error: { message: 'Todos los resultados deben estar validados.' } } } };
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(catalogosApi.flujo).mockResolvedValue(catalogo);
  vi.mocked(examenesApi.listar).mockResolvedValue([examen]);
  vi.mocked(solicitudesApi.crear).mockResolvedValue(solicitudBase);
});
it('sitio admite búsqueda sin acentos, teclado, cambio y limpieza', async () => {
  function Elegir() { const [v,setV] = useState<number | null>(null);return <SitioSelector value={v} onChange={setV} tipoMuestra="Exudado" sitios={sitios} />; }
  const u=userEvent.setup();render(<Elegir />);
  const input=screen.getByRole('combobox',{name:'Sitio anatómico'});
  await u.click(input);await u.type(input,'faring');expect(screen.queryByRole('option',{name:'Herida'})).not.toBeInTheDocument();
  await u.keyboard('{ArrowDown}{Enter}');expect(input).toHaveValue('Faríngeo');
  await u.click(input);await u.click(screen.getByRole('option',{name:'Nasal'}));expect(input).toHaveValue('Nasal');
  await u.click(screen.getByRole('button',{name:'Limpiar Sitio anatómico'}));expect(input).toHaveValue('');
});
it('agrega sitio mediante API, conserva y permite volver a seleccionarlo',async()=>{
  vi.mocked(catalogosApi.crearSitio).mockResolvedValue({id:7,nombre:'Nuevo sitio confirmado',tiposMuestra:['Exudado']});
  function Elegir(){const [v,setV]=useState<number|null>(null);return <SitioSelector value={v} onChange={setV} tipoMuestra="Exudado" sitios={sitios} puedeCrear />;}
  const u=userEvent.setup();render(<Elegir />);await u.click(screen.getByText('Agregar sitio'));
  await u.type(screen.getByLabelText('Nuevo sitio anatómico'),'Nuevo sitio confirmado');await u.click(screen.getByText('Guardar sitio'));
  await waitFor(()=>expect(catalogosApi.crearSitio).toHaveBeenCalledWith('Nuevo sitio confirmado',['Exudado']));
  const input=screen.getByRole('combobox',{name:'Sitio anatómico'});await waitFor(()=>expect(input).toHaveValue('Nuevo sitio confirmado'));
  await u.click(screen.getByRole('button',{name:'Limpiar Sitio anatómico'}));await u.click(input);
  await u.click(screen.getByRole('option',{name:'Nuevo sitio confirmado'}));expect(input).toHaveValue('Nuevo sitio confirmado');
});
it('sin permiso no muestra alta de sitios ni opciones incompatibles',async()=>{
  render(<SitioSelector value={null} onChange={vi.fn()} tipoMuestra="Orina" sitios={sitios} />);
  expect(screen.queryByText('Agregar sitio')).not.toBeInTheDocument();fireEvent.focus(screen.getByRole('combobox'));
  expect(screen.queryByRole('option',{name:'Faríngeo'})).not.toBeInTheDocument();
});
it('duplicado de sitio conserva el texto y presenta el error',async()=>{
  vi.mocked(catalogosApi.crearSitio).mockRejectedValue({isAxiosError:true,response:{data:{error:{message:'Ya existe una opción con ese nombre.'}}}});
  const u=userEvent.setup();render(<SitioSelector value={null} onChange={vi.fn()} tipoMuestra="Exudado" sitios={sitios} puedeCrear />);
  await u.click(screen.getByText('Agregar sitio'));await u.type(screen.getByLabelText('Nuevo sitio anatómico'),'Faringeo');await u.click(screen.getByText('Guardar sitio'));
  expect(await screen.findByText('Ya existe una opción con ese nombre.')).toBeInTheDocument();expect(screen.getByLabelText('Nuevo sitio anatómico')).toHaveValue('Faringeo');
});
function Orden({onCreada=vi.fn()}: {onCreada?: (codigo:string)=>void}) {
  const [guardando,setGuardando]=useState(false);
  return <NuevaSolicitudForm pacienteId={9} directorioMedicos={false} guardando={guardando} setGuardando={setGuardando} onCancelar={vi.fn()} onCreada={onCreada} />;
}
it('selección frecuente completa exámenes reales, conserva observaciones y envía una orden estructurada',async()=>{
  const u=userEvent.setup();const onCreada=vi.fn();render(<Orden onCreada={onCreada} />);
  await screen.findByText('Urocultivo');await u.type(screen.getByLabelText('Observaciones'),'Observación proporcionada');
  await u.click(screen.getByRole('combobox',{name:'Selección frecuente'}));await u.click(screen.getByRole('option',{name:'Selección habitual'}));
  expect(screen.getByRole('checkbox')).toBeChecked();await u.click(screen.getByText('Crear solicitud'));
  await waitFor(()=>expect(solicitudesApi.crear).toHaveBeenCalledWith(expect.objectContaining({pacienteId:9,observaciones:'Observación proporcionada',examenesSolicitados:[{examenId:10,tipoMuestra:'Orina'}]})));
  expect(onCreada).toHaveBeenCalledWith('SOL-42');
});
it('guarda una plantilla reutilizable sin copiar diagnóstico ni observaciones',async()=>{
  vi.mocked(catalogosApi.crearPlantilla).mockResolvedValue({id:9,nombre:'Diaria',examenIds:[10]});
  const u=userEvent.setup();render(<Orden />);await screen.findByText('Urocultivo');await u.click(screen.getByRole('checkbox'));
  await u.type(screen.getByLabelText('Diagnóstico presuntivo'),'Dato aportado');await u.type(screen.getByLabelText('Nombre de selección reutilizable'),'Diaria');
  await u.click(screen.getByText('Guardar selección frecuente'));await waitFor(()=>expect(catalogosApi.crearPlantilla).toHaveBeenCalledWith('Diaria',[10]));
  expect(screen.getByLabelText('Diagnóstico presuntivo')).toHaveValue('Dato aportado');
});
it('error de guardado no pierde selecciones ni confirma creación',async()=>{
  vi.mocked(solicitudesApi.crear).mockRejectedValue(fallo);const onCreada=vi.fn();const u=userEvent.setup();render(<Orden onCreada={onCreada} />);
  await screen.findByText('Urocultivo');await u.click(screen.getByRole('checkbox'));await u.type(screen.getByLabelText('Médico solicitante'),'Médico externo proporcionado');
  await u.click(screen.getByText('Crear solicitud'));expect(await screen.findByText('Todos los resultados deben estar validados.')).toBeInTheDocument();
  expect(screen.getByRole('checkbox')).toBeChecked();expect(screen.getByLabelText('Médico solicitante')).toHaveValue('Médico externo proporcionado');expect(onCreada).not.toHaveBeenCalled();
});
it('bandera apagada conserva solicitud histórica sin líneas nuevas',async()=>{
  vi.mocked(catalogosApi.flujo).mockResolvedValue({...catalogo,habilitado:false});const u=userEvent.setup();render(<Orden />);
  await waitFor(()=>expect(screen.getByText('Crear solicitud')).toBeEnabled());expect(screen.queryByText('Exámenes de la orden')).not.toBeInTheDocument();
  await u.click(screen.getByText('Crear solicitud'));await waitFor(()=>expect(solicitudesApi.crear).toHaveBeenCalledWith(expect.not.objectContaining({examenesSolicitados:expect.anything()})));
});
it('muestra reutiliza exámenes, material y sitio de la orden sin volver a escribirlos',async()=>{
  vi.mocked(solicitudesApi.obtener).mockResolvedValue({...solicitudBase,
    examenesSolicitados:[{id:1,examenId:10,tipoMuestra:'Orina',sitioAnatomicoId:null,sitioAnatomico:null,instruccionesToma:null,examen}]});
  vi.mocked(muestrasApi.registrar).mockRejectedValue(fallo);
  const u=userEvent.setup();render(<ToastProvider><MuestraFormModal solicitudIdInicial={42} onCerrar={vi.fn()} onRegistrada={vi.fn()} /></ToastProvider>);
  await waitFor(()=>expect(screen.getByLabelText('Tipo de muestra')).toHaveValue('Orina'));expect(screen.getByRole('checkbox')).toBeChecked();
  await u.click(screen.getByRole('button',{name:'Registrar muestra'}));await waitFor(()=>expect(muestrasApi.registrar).toHaveBeenCalledWith(expect.objectContaining({solicitudId:42,tipoMuestra:'Orina',examenIds:[10]})));
});
it('descarga usa la solicitud correcta y una URL blob temporal',async()=>{
  vi.mocked(documentosApi.obtener).mockResolvedValue(new Blob(['PDF de prueba'],{type:'application/pdf'}));
  const crear=vi.fn(()=> 'blob:local-temporal');URL.createObjectURL=crear;URL.revokeObjectURL=vi.fn();
  const click=vi.spyOn(HTMLAnchorElement.prototype,'click').mockImplementation(()=>{});
  const u=userEvent.setup();render(<DocumentoAcciones clase="informe" solicitudId={42} />);await u.click(screen.getByText('Informe final PDF'));
  await waitFor(()=>expect(documentosApi.obtener).toHaveBeenCalledWith('informe',42));expect(crear).toHaveBeenCalled();expect(click).toHaveBeenCalled();click.mockRestore();
});
it('HTTP 409 no descarga ni comunica éxito',async()=>{
  vi.mocked(documentosApi.obtener).mockRejectedValue(fallo);const crear=vi.fn();URL.createObjectURL=crear;
  const u=userEvent.setup();render(<DocumentoAcciones clase="informe" solicitudId={42} />);await u.click(screen.getByText('Informe final PDF'));
  expect(await screen.findByText('Todos los resultados deben estar validados.')).toBeInTheDocument();expect(crear).not.toHaveBeenCalled();
});
it('impresión fallida cierra la pestaña vacía y muestra el conflicto',async()=>{
  vi.mocked(documentosApi.obtener).mockRejectedValue(fallo);const close=vi.fn();const abrir=vi.spyOn(window,'open').mockReturnValue({close} as unknown as Window);
  const u=userEvent.setup();render(<DocumentoAcciones clase="orden" solicitudId={42} />);await u.click(screen.getByText('Imprimir orden'));
  expect(await screen.findByText('Todos los resultados deben estar validados.')).toBeInTheDocument();expect(close).toHaveBeenCalled();abrir.mockRestore();
});
