
import { Outlet } from 'react-router-dom';
import { Header } from './Header';
import { Sidebar } from './Sidebar';

export function LayoutDesktop() {
  return (
    <div className="flex h-screen overflow-hidden bg-canvas">
      <a href="#contenido-principal" className="skip-link">Saltar al contenido</a>
      <Sidebar />

      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <Header />

        <main id="contenido-principal" tabIndex={-1} className="min-h-0 flex-1 overflow-y-auto bg-canvas p-5 lg:p-6">
          <div className="mx-auto w-full max-w-[1800px]">
          <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
