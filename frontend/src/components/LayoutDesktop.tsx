import { Outlet } from 'react-router-dom';
import { Header } from './Header';
import { Sidebar } from './Sidebar';

/**
 * Estructura fija de escritorio: barra lateral y cabecera permanecen visibles;
 * solo el área de contenido hace scroll. Sin adaptación móvil (por requisito).
 */
export function LayoutDesktop() {
  return (
    <div className="flex h-full">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Header />
        <main className="min-h-0 flex-1 overflow-y-auto p-4">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
