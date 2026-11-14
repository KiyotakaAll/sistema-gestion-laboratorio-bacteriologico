
import { Outlet } from 'react-router-dom';
import { Header } from './Header';
import { Sidebar } from './Sidebar';

export function LayoutDesktop() {
  return (
    <div className="flex min-h-screen bg-[#F5F7FA]">
      <Sidebar />

      <div className="flex min-h-screen min-w-0 flex-1 flex-col">
        <Header />

        <main className="min-h-0 flex-1 overflow-y-auto bg-[#F5F7FA] p-5 lg:p-6">
          <div className="mx-auto w-full max-w-[1800px]">
          <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
