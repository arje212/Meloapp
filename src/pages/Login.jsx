import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Mountain, Mail, Lock, Eye, EyeOff } from 'lucide-react';

export default function Login() {
  const [tab, setTab] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleLogin = async () => {
    if (!email || !password) { setError('Please enter email and password.'); return; }
    setLoading(true);
    setError('');
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    console.log('Login result:', data, error);
    if (error) setError(error.message);
    setLoading(false);
  };

  const handleSignup = async () => {
    if (!email || !password || !fullName) { setError('Please fill in all fields.'); return; }
    setLoading(true);
    setError('');
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName } }
    });
    console.log('Signup result:', data, error);
    if (error) {
      setError(error.message);
    } else {
      await supabase.from('profiles').upsert({
        id: data.user.id,
        email,
        full_name: fullName,
        role: 'user',
      });
      setSuccess('Account created! You can now sign in.');
      setTab('login');
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-primary/10 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="w-20 h-20 rounded-full bg-amber-500 flex items-center justify-center mx-auto mb-4 shadow-lg">
            <Mountain className="w-10 h-10 text-white" />
          </div>
          <h1 className="font-display text-2xl font-bold">
            Welcome to <span className="text-primary">SummitPilipinas</span>
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {tab === 'login' ? 'Sign in to continue' : 'Create your account'}
          </p>
        </div>

        <div className="bg-card border rounded-3xl p-6 shadow-sm">
          <div className="flex bg-muted rounded-full p-1 mb-4">
            <button
              onClick={() => { setTab('login'); setError(''); setSuccess(''); }}
              className={`flex-1 py-1.5 text-sm font-medium rounded-full transition-all ${tab === 'login' ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground'}`}
            >
              Sign In
            </button>
            <button
              onClick={() => { setTab('signup'); setError(''); setSuccess(''); }}
              className={`flex-1 py-1.5 text-sm font-medium rounded-full transition-all ${tab === 'signup' ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground'}`}
            >
              Sign Up
            </button>
          </div>

          <div className="space-y-3">
            {tab === 'signup' && (
              <div>
                <Label>Full Name</Label>
                <Input
                  placeholder="Juan dela Cruz"
                  value={fullName}
                  onChange={e => setFullName(e.target.value)}
                  className="mt-1 rounded-xl"
                />
              </div>
            )}
            <div>
              <Label>Email</Label>
              <div className="relative mt-1">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="pl-9 rounded-xl"
                />
              </div>
            </div>
            <div>
              <Label>Password</Label>
              <div className="relative mt-1">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  type={showPass ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && (tab === 'login' ? handleLogin() : handleSignup())}
                  className="pl-9 pr-9 rounded-xl"
                />
                <button
                  type="button"
                  onClick={() => setShowPass(!showPass)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                >
                  {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {error && (
              <p className="text-xs text-destructive bg-destructive/10 rounded-lg px-3 py-2">{error}</p>
            )}
            {success && (
              <p className="text-xs text-green-700 bg-green-50 rounded-lg px-3 py-2">{success}</p>
            )}

            <Button
              type="button"
              className="w-full rounded-full"
              disabled={loading}
              onClick={tab === 'login' ? handleLogin : handleSignup}
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              {tab === 'login' ? 'Sign in' : 'Create Account'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}