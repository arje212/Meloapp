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
    if (pw.next.length < 8) return setPwMsg({ type: 'error', text: 'Kailangan ng kahit 8 characters.' });
    if (pw.next !== pw.confirm) return setPwMsg({ type: 'error', text: 'Hindi magkapareho ang dalawang password.' });
    setPwBusy(true); setPwMsg({ type: '', text: '' });
    const { error } = await supabase.auth.updateUser({ password: pw.next });
    setPwBusy(false);
    if (error) return setPwMsg({ type: 'error', text: error.message || 'Hindi ma-update ang password.' });
    setPw({ next: '', confirm: '' });
    setPwMsg({ type: 'ok', text: 'Na-update na ang password mo.' });
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
      return setDangerMsg({ type: 'error', text: /deactivated_at|column/i.test(error.message || '') ? 'Hindi pa naka-setup ang deactivation sa database. Hilingin sa admin na i-run ang latest migration.' : 'Hindi ma-deactivate. Subukan ulit.' });
    }
    await logout(); // signing in again reactivates the account
  };

  const requestDeletion = async () => {
    setBusy(true); setDangerMsg({ type: '', text: '' });
    const { error } = await supabase.from('account_deletion_requests').insert({ user_id: user.id, email: user.email });
    setBusy(false); setConfirm(null);
    if (error && error.code !== '23505') {
      return setDangerMsg({ type: 'error', text: 'Hindi ma-send ang request. Subukan ulit mamaya.' });
    }
    setDangerMsg({ type: 'ok', text: 'Natanggap na ang request mo. Buburahin ang account at data mo sa loob ng 30 araw.' });
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
            <span className="block text-xs text-muted-foreground">I-edit ang pangalan, photo, bio at location</span>
          </span>
          <ChevronRight className="w-4 h-4 text-muted-foreground" />
        </button>
        <div>
          <Label className="text-xs text-muted-foreground">Email (ikaw lang ang nakakakita)</Label>
          <p className="text-sm mt-0.5">{user?.email}</p>
        </div>
      </Section>

      <Section icon={Bell} title="Notifications">
        {pushState === 'web' && <p className="text-sm text-muted-foreground">Ang push notifications ay para sa Android/iPhone app.</p>}
        {pushState === 'checking' && <p className="text-sm text-muted-foreground">Chine-check...</p>}
        {pushState === 'granted' && <p className="text-sm flex items-center gap-2 text-green-600"><Check className="w-4 h-4" />Naka-on ang notifications sa phone na ito.</p>}
        {pushState === 'prompt' && <Button className="rounded-full" onClick={enablePush}>I-on ang notifications</Button>}
        {pushState === 'denied' && <p className="text-sm text-muted-foreground">Naka-block ang notifications. I-on sa phone: Settings → Apps → Melotrip → Notifications.</p>}
        <Button variant="outline" className="rounded-full" onClick={() => navigate('/notifications')}>Tingnan ang mga notification</Button>
      </Section>

      <Section icon={Lock} title="Password">
        <div><Label>Bagong password</Label><Input className="mt-1" type="password" autoComplete="new-password" value={pw.next} onChange={e => setPw(p => ({ ...p, next: e.target.value }))} /></div>
        <div><Label>Ulitin ang password</Label><Input className="mt-1" type="password" autoComplete="new-password" value={pw.confirm} onChange={e => setPw(p => ({ ...p, confirm: e.target.value }))} /></div>
        {pwMsg.text && <p className={`text-xs ${pwMsg.type === 'ok' ? 'text-green-600' : 'text-destructive'}`}>{pwMsg.text}</p>}
        <Button className="rounded-full" onClick={changePassword} disabled={pwBusy || !pw.next}>{pwBusy ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}I-update ang password</Button>
      </Section>

      <Section icon={ShieldCheck} title="Privacy">
        <p className="text-sm text-muted-foreground">Hindi ipinapakita ang email mo sa ibang users. Pangalan at photo lang ang nakikita sa profile, chat at search.</p>
      </Section>

      <Section icon={UserX} title="Account">
        {dangerMsg.text && <p className={`text-xs ${dangerMsg.type === 'ok' ? 'text-green-600' : 'text-destructive'}`}>{dangerMsg.text}</p>}
        <Button variant="outline" className="w-full rounded-full justify-start" onClick={() => setConfirm('deactivate')}>
          <UserX className="w-4 h-4 mr-2" />I-deactivate ang account
        </Button>
        <p className="text-xs text-muted-foreground -mt-1">Itatago ka sa search. Mag-login ulit anumang oras para ma-reactivate.</p>
        <Button variant="outline" className="w-full rounded-full justify-start text-destructive border-destructive/40 hover:text-destructive" onClick={() => setConfirm('delete')}>
          <Trash2 className="w-4 h-4 mr-2" />Burahin ang account at data ko
        </Button>
      </Section>

      <AlertDialog open={!!confirm} onOpenChange={(o) => !o && !busy && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirm === 'delete' ? 'Burahin ang account?' : 'I-deactivate ang account?'}</AlertDialogTitle>
            <AlertDialogDescription>
              {confirm === 'delete'
                ? 'Magpapadala kami ng request para tuluyang burahin ang account at data mo (hanggang 30 araw). Hindi ito mababawi kapag nabura na.'
                : 'Hindi ka na lalabas sa search at hindi ka na makakatanggap ng chat habang deactivated. Mare-reactivate ito kapag nag-login ka ulit.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
            <AlertDialogAction disabled={busy} onClick={(e) => { e.preventDefault(); confirm === 'delete' ? requestDeletion() : deactivate(); }} className={confirm === 'delete' ? 'bg-destructive hover:bg-destructive/90' : ''}>
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : confirm === 'delete' ? 'Oo, burahin' : 'I-deactivate'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
