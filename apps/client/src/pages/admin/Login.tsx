import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { loginSchema, LoginInput } from '@portfolio/shared';
import { useAuth } from '../../hooks/useAuth';
import { API_BASE } from '../../lib/api';
import { Shield } from 'lucide-react';

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const { setAuth, token } = useAuth();
  const [error, setError] = useState('');

  const from = location.state?.from?.pathname || '/admin/dashboard';

  useEffect(() => {
    if (token) navigate('/admin/dashboard', { replace: true });
  }, [token, navigate]);

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginInput) => {
    setError('');
    try {
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
        credentials: 'include',
      });
      const resData = await res.json();
      if (res.ok) {
        setAuth(resData.access_token, resData.user);
        navigate(from, { replace: true });
      } else {
        setError(resData.error?.message || 'Invalid credentials');
      }
    } catch {
      setError('Failed connecting to portfolio database.');
    }
  };

  return (
    <div className="flex justify-center items-center min-h-screen bg-slate-950 px-4">
      <div className="bg-slate-900 border border-slate-800 w-full max-w-md p-8 rounded-2xl shadow-xl">
        <div className="text-center mb-8">
          <div className="w-14 h-14 bg-indigo-500/10 border border-indigo-500/20 text-indigo-500 rounded-full flex items-center justify-center mx-auto mb-4">
            <Shield size={28} />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white mb-2 font-heading">Aura CMS Portal</h1>
          <p className="text-slate-400 text-sm">Sign in to manage database content.</p>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/20 text-red-500 text-xs py-3 px-4 rounded-lg mb-6 text-center font-medium">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <div>
            <label htmlFor="login-email" className="text-slate-400 text-xs font-semibold uppercase tracking-wider block mb-2">Email Address</label>
            <input
              id="login-email"
              type="email"
              {...register('email')}
              className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-lg text-white outline-none focus:border-indigo-500 transition-colors placeholder:text-slate-700 text-sm"
              placeholder="admin@portfolio.com"
            />
            {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email.message as string}</p>}
          </div>
          <div>
            <label htmlFor="login-password" className="text-slate-400 text-xs font-semibold uppercase tracking-wider block mb-2">Password</label>
            <input
              id="login-password"
              type="password"
              {...register('password')}
              className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-lg text-white outline-none focus:border-indigo-500 transition-colors placeholder:text-slate-700 text-sm"
              placeholder="••••••••"
            />
            {errors.password && <p className="text-red-500 text-xs mt-1">{errors.password.message as string}</p>}
          </div>
          <button 
            type="submit" 
            className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 rounded-lg font-semibold text-white transition-colors text-sm"
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Authenticating...' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  );
}
