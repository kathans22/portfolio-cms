import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { updateProfileSchema, UpdateProfileInput } from '@portfolio/shared';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../hooks/useToast';
import { apiFetch } from '../../lib/api';
import { Shield, User, KeyRound } from 'lucide-react';

interface UpdateProfileResult {
  data: { id: string; name: string; email: string };
  passwordChanged: boolean;
}

export default function Settings() {
  const { user, updateUser, logout } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const { register, handleSubmit, reset, formState: { errors } } = useForm<UpdateProfileInput>({
    resolver: zodResolver(updateProfileSchema),
    defaultValues: { name: user?.name, email: user?.email, currentPassword: '', newPassword: '' },
  });

  const saveMutation = useMutation<UpdateProfileResult, Error, UpdateProfileInput>({
    mutationFn: async (formData) => {
      const payload: Partial<UpdateProfileInput> = { currentPassword: formData.currentPassword };
      if (formData.name && formData.name !== user?.name) payload.name = formData.name;
      if (formData.email && formData.email !== user?.email) payload.email = formData.email;
      if (formData.newPassword) payload.newPassword = formData.newPassword;

      const res = await apiFetch('/auth/me', { method: 'PATCH', body: JSON.stringify(payload) });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error?.message || 'Failed to update profile');
      }
      return { data: await res.json(), passwordChanged: !!formData.newPassword };
    },
    onSuccess: ({ data, passwordChanged }) => {
      if (passwordChanged) {
        // Changing the password revokes every existing session server-side, including
        // this one's refresh token — force a clean re-login rather than let the next
        // silent refresh fail unexpectedly.
        showToast('success', 'Password changed. Please sign in again.');
        logout();
        navigate('/admin/login');
        return;
      }
      updateUser({ name: data.name, email: data.email });
      showToast('success', 'Profile updated.');
      reset({ name: data.name, email: data.email, currentPassword: '', newPassword: '' });
    },
    onError: (err) => {
      showToast('error', err.message);
    },
  });

  return (
    <div className="space-y-6 text-slate-100">
      <header className="mb-8">
        <h1 className="text-3xl font-extrabold text-white">System Settings</h1>
        <p className="text-slate-400 text-sm">Update your profile and password.</p>
      </header>

      <div className="bg-slate-900 border border-slate-800 p-8 rounded-xl max-w-xl space-y-6">
        <h2 className="text-lg font-bold border-b border-slate-800 pb-3 flex items-center gap-2 text-white">
          <User size={18} className="text-indigo-400" /> Account Details
        </h2>

        <form onSubmit={handleSubmit((data) => saveMutation.mutate(data))} className="space-y-5 text-sm">
          <div>
            <span className="text-slate-500 text-xs block mb-1">Security Role</span>
            <p className="text-indigo-400 font-bold uppercase flex items-center gap-1.5">
              <Shield size={14} /> System Administrator
            </p>
          </div>

          <div>
            <label htmlFor="settings-name" className="text-slate-400 text-xs font-semibold block mb-2">Full Name</label>
            <input id="settings-name" type="text" {...register('name')} className="input-field" />
            {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name.message as string}</p>}
          </div>
          <div>
            <label htmlFor="settings-email" className="text-slate-400 text-xs font-semibold block mb-2">Email Address</label>
            <input id="settings-email" type="email" {...register('email')} className="input-field" />
            {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email.message as string}</p>}
          </div>

          <div className="pt-4 border-t border-slate-800">
            <h3 className="text-sm font-bold text-white flex items-center gap-2 mb-4">
              <KeyRound size={16} className="text-indigo-400" /> Change Password (optional)
            </h3>
            <label htmlFor="settings-new-password" className="text-slate-400 text-xs font-semibold block mb-2">New Password</label>
            <input id="settings-new-password" type="password" {...register('newPassword')} className="input-field" placeholder="Leave blank to keep current password" />
            {errors.newPassword && <p className="text-red-500 text-xs mt-1">{errors.newPassword.message as string}</p>}
          </div>

          <div>
            <label htmlFor="settings-current-password" className="text-slate-400 text-xs font-semibold block mb-2">Current Password <span className="text-slate-600">(required to save any change)</span></label>
            <input id="settings-current-password" type="password" {...register('currentPassword')} className="input-field" />
            {errors.currentPassword && <p className="text-red-500 text-xs mt-1">{errors.currentPassword.message as string}</p>}
          </div>

          <button type="submit" disabled={saveMutation.isPending} className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 rounded-lg font-semibold text-white transition-colors disabled:opacity-60">
            {saveMutation.isPending ? 'Saving...' : 'Save Changes'}
          </button>
        </form>
      </div>
    </div>
  );
}
