import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { App as CapacitorApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { BrowserRouter as Router, Route, Routes, useLocation, useNavigate, useNavigationType } from 'react-router-dom';
import { lazy, Suspense, useState, useEffect, useRef } from 'react';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import BrandLogo from '@/components/BrandLogo';
import { toast } from '@/components/ui/use-toast';

const PageNotFound = lazy(() => import('./lib/PageNotFound'));
const Login = lazy(() => import('@/pages/Login'));
const AppLayout = lazy(() => import('@/components/layout/AppLayout'));
const Feed = lazy(() => import('@/pages/Feed'));
const Mountains = lazy(() => import('@/pages/Mountains'));
const MountainDetail = lazy(() => import('@/pages/MountainDetail'));
const Trips = lazy(() => import('@/pages/Trips'));
const CreateTrip = lazy(() => import('@/pages/CreateTrip'));
const TripDetail = lazy(() => import('@/pages/TripDetail'));
const Agencies = lazy(() => import('@/pages/Agencies'));
const AgencyDetail = lazy(() => import('@/pages/AgencyDetail'));
const Chat = lazy(() => import('@/pages/Chat'));
const ChatRoom = lazy(() => import('@/pages/ChatRoom'));
const Profile = lazy(() => import('@/pages/Profile'));
const PublicProfile = lazy(() => import('@/pages/PublicProfile'));
const AdminDashboard = lazy(() => import('@/pages/admin/AdminDashboard'));
const AdminOverview = lazy(() => import('@/pages/admin/AdminOverview'));
const AdminUsers = lazy(() => import('@/pages/admin/AdminUsers'));
const AdminMountains = lazy(() => import('@/pages/admin/AdminMountains'));
const AdminAgencies = lazy(() => import('@/pages/admin/AdminAgencies'));
const AdminBookings = lazy(() => import('@/pages/admin/AdminBookings'));
const AdminTrips = lazy(() => import('@/pages/admin/AdminTrips'));
const AdminPosts = lazy(() => import('@/pages/admin/AdminPosts'));
const AdminSubscriptions = lazy(() => import('@/pages/admin/AdminSubscriptions'));
const AdminCollectibles = lazy(() => import('@/pages/admin/AdminCollectibles'));
const RoadmapPage = lazy(() => import('@/pages/Roadmap'));
const AchievementsPage = lazy(() => import('@/pages/Achievements'));
const NotificationsPage = lazy(() => import('@/pages/Notifications'));
const AgencyRegister = lazy(() => import('@/pages/AgencyRegister'));
const AgencySubscribe = lazy(() => import('@/pages/AgencySubscribe'));
const AgencyDashboard = lazy(() => import('@/pages/AgencyDashboard'));
const Leaderboard = lazy(() => import('@/pages/Leaderboard'));

const RouteLoading = () => (
  <div className="fixed inset-0 flex items-center justify-center bg-background">
    <div className="w-10 h-10 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
  </div>
);

function NativeBackHandler() {
  const location = useLocation();
  const navigate = useNavigate();
  const navigationType = useNavigationType();
  const routeHistoryRef = useRef({ entries: [], cursor: -1 });
  const lastBackAtRef = useRef(0);

  useEffect(() => {
    const history = routeHistoryRef.current;
    const currentEntry = history.entries[history.cursor];

    if (currentEntry?.key === location.key) return;
    if (navigationType === 'POP') {
      const historyIndex = history.entries.findIndex(entry => entry.key === location.key);
      if (historyIndex >= 0) {
        routeHistoryRef.current = { ...history, cursor: historyIndex };
      } else {
        routeHistoryRef.current = {
          entries: [{ key: location.key, pathname: location.pathname }],
          cursor: 0,
        };
      }
    } else if (navigationType === 'REPLACE' && currentEntry) {
      const entries = [...history.entries];
      entries[history.cursor] = { key: location.key, pathname: location.pathname };
      routeHistoryRef.current = { ...history, entries };
    } else {
      const entries = history.entries.slice(0, history.cursor + 1);
      entries.push({ key: location.key, pathname: location.pathname });
      routeHistoryRef.current = { entries, cursor: entries.length - 1 };
    }
  }, [location.key, location.pathname, navigationType]);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return undefined;

    let active = true;
    let backButtonListener;

    CapacitorApp.addListener('backButton', () => {
      const history = routeHistoryRef.current;
      if (history.cursor > 0) {
        lastBackAtRef.current = 0;
        navigate(-1);
        return;
      }

      const currentPath = history.entries[history.cursor]?.pathname || '/';
      if (currentPath !== '/') {
        lastBackAtRef.current = 0;
        navigate('/', { replace: true });
        return;
      }

      const now = Date.now();
      if (now - lastBackAtRef.current < 2000) {
        CapacitorApp.exitApp();
        return;
      }

      lastBackAtRef.current = now;
      toast({ title: 'Pindutin ulit ang back para lumabas.' });
    }).then(listener => {
      if (active) backButtonListener = listener;
      else listener.remove();
    }).catch(error => {
      console.error('Could not register the native back button handler:', error);
    });

    return () => {
      active = false;
      backButtonListener?.remove();
    };
  }, [navigate]);

  return null;
}

const AuthenticatedApp = () => {
  const { isLoadingAuth, isAuthenticated } = useAuth();
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setTimedOut(true), 8000);
    return () => clearTimeout(t);
  }, []);

  if (isLoadingAuth && !timedOut) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-background">
        <div className="text-center">
          <BrandLogo size={72} className="mx-auto mb-3" rounded="xl" />
          <div className="w-10 h-10 border-4 border-primary/20 border-t-primary rounded-full animate-spin mx-auto mb-3"></div>
          <p className="text-sm text-muted-foreground">Loading Melotrip...</p>
        </div>
      </div>
    );
  }

  // Public routes - accessible without authentication
  const publicRoutes = (
    <Routes>
      <Route path="/profile/:id" element={<PublicProfile />} />
      <Route path="*" element={isAuthenticated ? null : <Login />} />
    </Routes>
  );

  if (!isAuthenticated) {
    return publicRoutes;
  }

  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route path="/" element={<Feed />} />
        <Route path="/mountains" element={<Mountains />} />
        <Route path="/mountains/:id" element={<MountainDetail />} />
        <Route path="/trips" element={<Trips />} />
        <Route path="/trips/new" element={<CreateTrip />} />
        <Route path="/trips/:id" element={<TripDetail />} />
        <Route path="/agencies" element={<Agencies />} />
        <Route path="/agencies/:id" element={<AgencyDetail />} />
        <Route path="/chat" element={<Chat />} />
        <Route path="/chat/:id" element={<ChatRoom />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/profile/:id" element={<PublicProfile />} />
        <Route path="/roadmap" element={<RoadmapPage />} />
        <Route path="/achievements" element={<AchievementsPage />} />
        <Route path="/notifications" element={<NotificationsPage />} />
        <Route path="/agency-register" element={<AgencyRegister />} />
        <Route path="/agency-subscribe" element={<AgencySubscribe />} />
        <Route path="/agency-dashboard" element={<AgencyDashboard />} />
        <Route path="/leaderboard" element={<Leaderboard />} />
      </Route>

      <Route element={<AdminDashboard />}>
        <Route path="/admin" element={<AdminOverview />} />
        <Route path="/admin/users" element={<AdminUsers />} />
        <Route path="/admin/mountains" element={<AdminMountains />} />
        <Route path="/admin/agencies" element={<AdminAgencies />} />
        <Route path="/admin/bookings" element={<AdminBookings />} />
        <Route path="/admin/trips" element={<AdminTrips />} />
        <Route path="/admin/posts" element={<AdminPosts />} />
        <Route path="/admin/subscriptions" element={<AdminSubscriptions />} />
        <Route path="/admin/collectibles" element={<AdminCollectibles />} />
      </Route>

      <Route path="*" element={<PageNotFound />} />
    </Routes>
  );
};

function App() {
  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <Suspense fallback={<RouteLoading />}>
            <NativeBackHandler />
            <AuthenticatedApp />
          </Suspense>
        </Router>
        <Toaster />
      </QueryClientProvider>
    </AuthProvider>
  );
}

export default App;
