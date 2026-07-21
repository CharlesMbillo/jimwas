import { NavLink, useNavigate } from 'react-router-dom';
import { LayoutDashboard, ShoppingCart, Package, Users, FileX, LogOut, Leaf } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { canApproveVoid } from '../lib/permissions';
import type { ReactNode } from 'react';

interface NavItem {
  to: string;
  label: string;
  icon: ReactNode;
  show: boolean;
}

export function Layout({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const navItems: NavItem[] = [
    { to: '/', label: 'Dashboard', icon: <LayoutDashboard size={18} />, show: true },
    { to: '/pos', label: 'New Sale', icon: <ShoppingCart size={18} />, show: true },
    { to: '/products', label: 'Products', icon: <Package size={18} />, show: true },
    { to: '/customers', label: 'Customers', icon: <Users size={18} />, show: true },
    { to: '/void-requests', label: 'Void Requests', icon: <FileX size={18} />, show: canApproveVoid(user?.role ?? 'cashier') },
  ];

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen flex bg-slate-900">
      <aside className="w-60 bg-slate-950 border-r border-slate-800 flex flex-col">
        <div className="p-5 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-lg bg-emerald-600 flex items-center justify-center">
              <Leaf className="text-white" size={20} />
            </div>
            <div>
              <h1 className="text-white font-bold text-lg leading-none">Jimwas</h1>
              <p className="text-emerald-500 text-xs mt-0.5">POS System</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-3 space-y-1">
          {navItems.filter((n) => n.show).map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition ${
                  isActive
                    ? 'bg-emerald-600 text-white'
                    : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                }`
              }
            >
              {item.icon}
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="p-3 border-t border-slate-800">
          <div className="px-3 py-2 mb-2">
            <p className="text-sm text-white font-medium">{user?.name}</p>
            <p className="text-xs text-slate-500 capitalize">{user?.role}</p>
          </div>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-slate-400 hover:bg-slate-800 hover:text-white transition"
          >
            <LogOut size={18} />
            Logout
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto">
        <div className="p-8">{children}</div>
      </main>
    </div>
  );
}
