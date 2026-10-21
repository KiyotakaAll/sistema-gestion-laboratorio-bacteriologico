import { Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom';
import { LayoutDesktop } from './components/LayoutDesktop';
import { rolesDeRuta } from './components/navigation';
import { useAuth } from './context/AuthContext';
import type { RolNombre } from './types/api';
import AdmisionPacientes from './pages/AdmisionPacientes';
import Dashboard from './pages/Dashboard';
import Login, { PantallaCarga } from './pages/Login';
import RecepcionMuestras from './pages/RecepcionMuestras';
import ValidacionAthenea from './pages/ValidacionAthenea';
import WorklistResultados from './pages/WorklistResultados';

/** Exige sesión; si no la hay, envía al login recordando a dónde quería ir. */
function RutaProtegida() {
  const { usuario, cargando } = useAuth();
  const location = useLocation();

  if (cargando) return <PantallaCarga />;
  if (!usuario) return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  return <Outlet />;
}

/** Control de acceso por rol (RBAC) en el cliente. El backend lo vuelve a exigir. */
function ConRol({ roles, children }: { roles: RolNombre[]; children: React.ReactNode }) {
  const { tieneRol } = useAuth();
  if (!tieneRol(...roles)) {
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
      <Route element={<RutaProtegida />}>
        <Route element={<LayoutDesktop />}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/admision" element={<ConRol roles={rolesDeRuta('/admision')}><AdmisionPacientes /></ConRol>} />
          <Route path="/recepcion" element={<ConRol roles={rolesDeRuta('/recepcion')}><RecepcionMuestras /></ConRol>} />
          <Route path="/worklist" element={<ConRol roles={rolesDeRuta('/worklist')}><WorklistResultados /></ConRol>} />
          <Route path="/validacion" element={<ConRol roles={rolesDeRuta('/validacion')}><ValidacionAthenea /></ConRol>} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}
