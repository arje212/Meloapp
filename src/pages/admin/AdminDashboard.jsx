import { useAuth } from '@/lib/AuthContext';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { BarChart3, Users, Mountain, Store, Package, CalendarDays, MessageSquare, CreditCard, ArrowLeft, WalletCards } from 'lucide-react';

const adminLinks = [
  { path: '/admin', label: 'Overview', icon: BarChart3 },
  { path: '/admin/users', label: 'Users', icon: Users },
  { path: '/admin/mountains', label: 'Mountains', icon: Mountain },
  { path: '/admin/agencies', label: 'Agencies', icon: Store },
  { path: '/admin/subscriptions', label: 'Subscriptions', icon: CreditCard },
  { path: '/admin/collectibles', label: 'Collectibles', icon: WalletCards },
  { path: '/admin/bookings', label: 'Bookings', icon: Package },
  { path: '/admin/trips', label: 'Trips', icon: CalendarDays },
  { path: '/admin/posts', label: 'Posts', icon: MessageSquare },
];

export default function AdminDashboard() {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  if (user?.role !== 'admin') {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-2">Access Denied</h1>
          <p className="text-muted-foreground mb-4">You need admin access to view this page.</p>
          <Link to="/" className="text-primary underline">Go Home</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Admin Header */}
      <div className="border-b bg-card px-4 py-3">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate('/')} className="text-muted-foreground hover:text-foreground">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h1 className="font-display text-lg font-bold">Admin Panel</h1>
          </div>
          <span className="max-w-[45vw] truncate text-xs text-muted-foreground sm:max-w-none">{user.email}</span>
        </div>
      </div>

      <div className="admin-content-shell mx-auto flex max-w-7xl flex-col md:flex-row">
        {/* Sidebar */}
        <aside className="w-56 shrink-0 border-r min-h-[calc(100vh-57px)] p-3 hidden md:block">
          <nav className="space-y-1">
            {adminLinks.map(link => {
              const isActive = location.pathname === link.path;
              return (
                <Link
                  key={link.path}
                  to={link.path}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all ${
                    isActive ? 'bg-primary text-primary-foreground font-medium' : 'text-muted-foreground hover:bg-muted'
                  }`}
                >
                  <link.icon className="w-4 h-4" />
                  {link.label}
                </Link>
              );
            })}
          </nav>
        </aside>

        {/* Mobile nav */}
        <nav aria-label="Admin sections" className="sticky top-0 z-20 w-full overflow-x-auto overscroll-x-contain border-b bg-background/95 backdrop-blur md:hidden">
          <div className="flex min-w-max gap-1 p-2">
            {adminLinks.map(link => {
              const isActive = location.pathname === link.path;
              return (
                <Link
                  key={link.path}
                  to={link.path}
                  aria-current={isActive ? 'page' : undefined}
                  className={`flex min-h-10 items-center gap-1.5 rounded-full px-3 text-xs whitespace-nowrap ${
                    isActive ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                  }`}
                >
                  <link.icon className="h-4 w-4" />
                  {link.label}
                </Link>
              );
            })}
          </div>
        </nav>

        {/* Content */}
        <main className="admin-page-content min-w-0 flex-1 p-4 md:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
