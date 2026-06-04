import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import { useState, useEffect } from 'react';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import Login from '@/pages/Login';

// Layout
import AppLayout from '@/components/layout/AppLayout';

// Pages
import Feed from '@/pages/Feed';
import Mountains from '@/pages/Mountains';
import MountainDetail from '@/pages/MountainDetail';
import Trips from '@/pages/Trips';
import CreateTrip from '@/pages/CreateTrip';
import TripDetail from '@/pages/TripDetail';
import Agencies from '@/pages/Agencies';
import AgencyDetail from '@/pages/AgencyDetail';
import Chat from '@/pages/Chat';
import ChatRoom from '@/pages/ChatRoom';
import Profile from '@/pages/Profile';
import PublicProfile from '@/pages/PublicProfile'; // ✅ bagong import

// Admin
import AdminDashboard from '@/pages/admin/AdminDashboard';
import AdminOverview from '@/pages/admin/AdminOverview';
import AdminUsers from '@/pages/admin/AdminUsers';
import AdminMountains from '@/pages/admin/AdminMountains';
import AdminAgencies from '@/pages/admin/AdminAgencies';
import AdminBookings from '@/pages/admin/AdminBookings';
import AdminTrips from '@/pages/admin/AdminTrips';
import AdminPosts from '@/pages/admin/AdminPosts';
import AdminSubscriptions from '@/pages/admin/AdminSubscriptions';
import AdminCollectibles from '@/pages/admin/AdminCollectibles';

// Feature pages
import RoadmapPage from '@/pages/Roadmap';
import AchievementsPage from '@/pages/Achievements';
import NotificationsPage from '@/pages/Notifications';
import AgencyRegister from '@/pages/AgencyRegister';
import AgencySubscribe from '@/pages/AgencySubscribe';
import AgencyDashboard from '@/pages/AgencyDashboard';
import Leaderboard from '@/pages/Leaderboard';

const AuthenticatedApp = () => {
  const { isLoadingAuth, isAuthenticated } = useAuth();
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setTimedOut(true), 3000);
    return () => clearTimeout(t);
  }, []);

  if (isLoadingAuth && !timedOut) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-background">
        <div className="text-center">
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
          <AuthenticatedApp />
        </Router>
        <Toaster />
      </QueryClientProvider>
    </AuthProvider>
  );
}

export default App;
