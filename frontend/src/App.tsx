import { Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom';
import { LayoutDesktop } from './components/LayoutDesktop';
import { permisoDeRuta } from './components/navigation';
import { useAuth } from './context/AuthContext';
import type { Permiso } from './utils/permisos';
import AdmisionPacientes from './pages/AdmisionPacientes';
import Dashboard from './pages/Dashboard';
import Login, { PantallaCarga } from './pages/Login';
import RecepcionMuestras from './pages/RecepcionMuestras';
import ValidacionAthenea from './pages/ValidacionAthenea';
import WorklistResultados from './pages/WorklistResultados';
import Configuracion from './pages/Configuracion';
import GestionUsuarios from './pages/GestionUsuarios';
import MedicosRemitentes from './pages/MedicosRemitentes';

/** Exige sesión; si no la hay, envía al login recordando a dónde quería ir. */
function RutaProtegida() {
  const { usuario, cargando } = useAuth();
  const location = useLocation();

  if (cargando) return <PantallaCarga />;
  if (!usuario) return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  return <Outlet />;
}

/** Control de acceso por rol (RBAC) en el cliente. El backend lo vuelve a exigir. */
function ConPermiso({ permiso, children }: { permiso: Permiso | undefined; children: React.ReactNode }) {
  const { puede } = useAuth();
  if (!puede(permiso)) {
    return (
      <div className="mx-auto mt-16 max-w-md rounded border border-amber-300 bg-amber-50 p-5 text-amber-900">
        <h2 className="font-serif text-lg font-semibold">Acceso restringido</h2>
        <p className="mt-1 text-sm">Su rol no tiene permiso para usar esta sección. Si lo necesita, solicítelo al administrador.</p>
      </div>
    );
  }
  return <>{children}</>;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/registro" element={<Login />} />
      <Route element={<RutaProtegida />}>
        <Route element={<LayoutDesktop />}>
	<Route path="/configuracion" element={<ConPermiso permiso={permisoDeRuta('/configuracion')}><Configuracion /></ConPermiso>} />
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<ConPermiso permiso={permisoDeRuta('/dashboard')}><Dashboard /></ConPermiso>} />
          <Route path="/admision" element={<ConPermiso permiso={permisoDeRuta('/admision')}><AdmisionPacientes /></ConPermiso>} />
          <Route path="/recepcion" element={<ConPermiso permiso={permisoDeRuta('/recepcion')}><RecepcionMuestras /></ConPermiso>} />
          <Route path="/worklist" element={<ConPermiso permiso={permisoDeRuta('/worklist')}><WorklistResultados /></ConPermiso>} />
          <Route path="/validacion" element={<ConPermiso permiso={permisoDeRuta('/validacion')}><ValidacionAthenea /></ConPermiso>} />
          <Route path="/usuarios" element={<ConPermiso permiso={permisoDeRuta('/usuarios')}><GestionUsuarios /></ConPermiso>} />
          <Route path="/medicos" element={<ConPermiso permiso={permisoDeRuta('/medicos')}><MedicosRemitentes /></ConPermiso>} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}
