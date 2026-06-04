import React from 'react';
import DashboardHero from '@/components/gamification/DashboardHero';
import { useAuth } from '@/lib/AuthContext';

export default function Dashboard() {
  const { user } = useAuth() || {};

  return (
    <main className="p-6">
      <DashboardHero user={user} />

      <section className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-md bg-white p-4 shadow">Upcoming hikes (placeholder)</div>
        <div className="rounded-md bg-white p-4 shadow">Community highlights (placeholder)</div>
      </section>
    </main>
  );
}
