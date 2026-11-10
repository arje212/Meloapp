import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, User, Bell, Lock, ShieldCheck, UserX, Trash2, ChevronRight, Loader2, Check } from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/AuthContext';
import { initPush } from '@/lib/pushNotifications';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';

function Section({ icon: Icon, title, children }) {
  return (
    <section className="bg-card border rounded-2xl overflow-hidden">
      <h2 className="flex items-center gap-2 px-4 pt-4 pb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        <Icon className="w-4 h-4" />{title}
      </h2>
      <div className="px-4 pb-4 space-y-3">{children}</div>
    </section>
  );
}

export default function Settings() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  // notifications
  const native = Capacitor.isNativePlatform();
  const [pushState, setPushState] = useState(native ? 'checking' : 'web');
  useEffect(() => {
    if (!native) return;
    PushNotifications.checkPermissions()
      .then((p) => setPushState(p.receive === 'granted' ? 'granted' : p.receive === 'denied' ? 'denied' : 'prompt'))
      .catch(() => setPushState('prompt'));
  }, [native]);
  const enablePush = async () => {
    const r = await initPush({ user, onOpen: (url) => url?.startsWith('/') && navigate(url), onForeground: () => {} });
    setPushState(r.status === 'registered' ? 'granted' : r.status === 'denied' ? 'denied' : pushState);
  };

  // password
  const [pw, setPw] = useState({ next: '', confirm: '' });
  const [pwMsg, setPwMsg] = useState({ type: '', text: '' });
  const [pwBusy, setPwBusy] = useState(false);
  const changePassword = async () => {
    if (pw.next.length < 8) return setPwMsg({ type: 'error', text: 'Use at least 8 characters.' });
    if (pw.next !== pw.confirm) return setPwMsg({ type: 'error', text: 'The two passwords do not match.' });
    setPwBusy(true); setPwMsg({ type: '', text: '' });
    const { error } = await supabase.auth.updateUser({ password: pw.next });
    setPwBusy(false);
    if (error) return setPwMsg({ type: 'error', text: error.message || 'Could not update the password.' });
    setPw({ next: '', confirm: '' });
    setPwMsg({ type: 'ok', text: 'Your password has been updated.' });
  };

  // deactivate / delete
  const [confirm, setConfirm] = useState(null); // 'deactivate' | 'delete'
  const [busy, setBusy] = useState(false);
  const [dangerMsg, setDangerMsg] = useState({ type: '', text: '' });

  const deactivate = async () => {
    setBusy(true); setDangerMsg({ type: '', text: '' });
    const { error } = await supabase.from('profiles').update({ deactivated_at: new Date().toISOString() }).eq('id', user.id);
    if (error) {
      setBusy(false); setConfirm(null);
      return setDangerMsg({ type: 'error', text: /deactivated_at|column/i.test(error.message || '') ? 'Deactivation is not set up in the database yet. Ask the admin to run the latest migration.' : 'Could not deactivate. Please try again.' });
    }
    await logout(); // signing in again reactivates the account
  };

  const requestDeletion = async () => {
    setBusy(true); setDangerMsg({ type: '', text: '' });
    const { error } = await supabase.from('account_deletion_requests').insert({ user_id: user.id, email: user.email });
    setBusy(false); setConfirm(null);
    if (error && error.code !== '23505') {
      return setDangerMsg({ type: 'error', text: 'Could not send the request. Please try again later.' });
    }
    setDangerMsg({ type: 'ok', text: 'Your request was received. Your account and data will be deleted within 30 days.' });
  };

  return (
    <div className="max-w-xl mx-auto px-4 py-4 pb-28 space-y-4">
      <div className="flex items-center gap-2">
        <button onClick={() => navigate(-1)} aria-label="Back" className="w-9 h-9 rounded-full hover:bg-muted flex items-center justify-center"><ArrowLeft className="w-5 h-5" /></button>
        <h1 className="font-display text-2xl font-bold">Settings</h1>
      </div>

      <Section icon={User} title="Account">
        <button onClick={() => navigate('/profile')} className="w-full flex items-center justify-between rounded-xl bg-muted/50 px-3 py-3 text-left">
          <span>
            <span className="block text-sm font-semibold">{user?.full_name || 'Your profile'}</span>
            <span className="block text-xs text-muted-foreground">Edit your name, photo, bio and location</span>
          </span>
          <ChevronRight className="w-4 h-4 text-muted-foreground" />
        </button>
        <div>
          <Label className="text-xs text-muted-foreground">Email (only you can see it)</Label>
          <p className="text-sm mt-0.5">{user?.email}</p>
        </div>
      </Section>

      <Section icon={Bell} title="Notifications">
        {pushState === 'web' && <p className="text-sm text-muted-foreground">Push notifications are available in the Android and iPhone app.</p>}
        {pushState === 'checking' && <p className="text-sm text-muted-foreground">Checking...</p>}
        {pushState === 'granted' && <p className="text-sm flex items-center gap-2 text-green-600"><Check className="w-4 h-4" />Notifications are on for this phone.</p>}
        {pushState === 'prompt' && <Button className="rounded-full" onClick={enablePush}>Turn on notifications</Button>}
        {pushState === 'denied' && <p className="text-sm text-muted-foreground">Notifications are blocked. Turn them on in your phone: Settings → Apps → Melotrip → Notifications.</p>}
        <Button variant="outline" className="rounded-full" onClick={() => navigate('/notifications')}>View notifications</Button>
      </Section>

      <Section icon={Lock} title="Password">
        <div><Label>New password</Label><Input className="mt-1" type="password" autoComplete="new-password" value={pw.next} onChange={e => setPw(p => ({ ...p, next: e.target.value }))} /></div>
        <div><Label>Repeat password</Label><Input className="mt-1" type="password" autoComplete="new-password" value={pw.confirm} onChange={e => setPw(p => ({ ...p, confirm: e.target.value }))} /></div>
        {pwMsg.text && <p className={`text-xs ${pwMsg.type === 'ok' ? 'text-green-600' : 'text-destructive'}`}>{pwMsg.text}</p>}
        <Button className="rounded-full" onClick={changePassword} disabled={pwBusy || !pw.next}>{pwBusy ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}Update password</Button>
      </Section>

      <Section icon={ShieldCheck} title="Privacy">
        <p className="text-sm text-muted-foreground">Your email is not shown to other users. Only your name and photo appear on your profile, in chat and in search.</p>
      </Section>

      <Section icon={UserX} title="Account">
        {dangerMsg.text && <p className={`text-xs ${dangerMsg.type === 'ok' ? 'text-green-600' : 'text-destructive'}`}>{dangerMsg.text}</p>}
        <Button variant="outline" className="w-full rounded-full justify-start" onClick={() => setConfirm('deactivate')}>
          <UserX className="w-4 h-4 mr-2" />Deactivate account
        </Button>
        <p className="text-xs text-muted-foreground -mt-1">You will be hidden from search. Log in again any time to reactivate.</p>
        <Button variant="outline" className="w-full rounded-full justify-start text-destructive border-destructive/40 hover:text-destructive" onClick={() => setConfirm('delete')}>
          <Trash2 className="w-4 h-4 mr-2" />Delete my account and data
        </Button>
      </Section>

      <AlertDialog open={!!confirm} onOpenChange={(o) => !o && !busy && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirm === 'delete' ? 'Delete account?' : 'Deactivate account?'}</AlertDialogTitle>
            <AlertDialogDescription>
              {confirm === 'delete'
                ? 'This sends a request to permanently delete your account and data (within 30 days). It cannot be undone once deleted.'
                : 'You will no longer appear in search and cannot receive chats while deactivated. Logging in again reactivates your account.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
            <AlertDialogAction disabled={busy} onClick={(e) => { e.preventDefault(); confirm === 'delete' ? requestDeletion() : deactivate(); }} className={confirm === 'delete' ? 'bg-destructive hover:bg-destructive/90' : ''}>
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : confirm === 'delete' ? 'Yes, delete' : 'Deactivate'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
