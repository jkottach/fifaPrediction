import React, { useState, useEffect } from 'react';
import { apiService } from '../services/apiService';
import { User } from '../types';
import PageHero from '../components/PageHero';
import { HOMETOWN_LABEL } from '../constants/branding';
import PhoneInput from '../components/PhoneInput';
import { formatQatarPhone, stripQatarDialCode } from '../utils/phone';
import {
  alertError,
  alertSuccess,
  btnOutline,
  btnPrimary,
  card,
  input,
  label,
  spinner,
} from '../theme';

const Profile: React.FC = () => {
  const [profile, setProfile] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [editLoading, setEditLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isEditing, setIsEditing] = useState(false);

  const [formData, setFormData] = useState({
    phoneLocal: '',
    city: '',
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const profileRes = await apiService.getProfile();
      const p = profileRes.data as User;
      setProfile(p);
      setFormData({
        phoneLocal: stripQatarDialCode(p.phoneNumber || ''),
        city: p.city === 'Not Set' ? '' : p.city || '',
      });
    } catch (err: unknown) {
      const message =
        err && typeof err === 'object' && 'response' in err
          ? (err as { response?: { data?: { error?: string } } }).response?.data?.error
          : undefined;
      setError(message || 'Failed to load profile');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSaveProfile = async () => {
    if (!formData.phoneLocal.trim()) {
      setError('Phone number is required.');
      return;
    }

    try {
      setEditLoading(true);
      setError('');
      setSuccess('');
      await apiService.updateProfile({
        city: formData.city,
        phoneNumber: formatQatarPhone(formData.phoneLocal),
      });
      setSuccess('Profile updated successfully');
      setIsEditing(false);
      fetchData();
    } catch (err: unknown) {
      const message =
        err && typeof err === 'object' && 'response' in err
          ? (err as { response?: { data?: { error?: string } } }).response?.data?.error
          : undefined;
      setError(message || 'Failed to update profile');
    } finally {
      setEditLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 bg-slate-50">
        <div className={spinner} />
      </div>
    );
  }

  if (!profile) return null;

  return (
    <div className="min-h-full bg-slate-50">
      <PageHero
        title={`${profile.firstName} ${profile.lastName}`}
        subtitle={profile.email}
        badge="My profile"
      />

      <div className="px-5 py-6">
        {success && <div className={alertSuccess}>{success}</div>}
        {error && <div className={alertError}>{error}</div>}

        <div className={`${card} overflow-hidden`}>
          <div className="p-5 space-y-5">
            <div className="flex justify-between items-center">
              <h2 className="font-display text-lg font-bold text-slate-900">Your details</h2>
              {!isEditing && (
                <button
                  onClick={() => setIsEditing(true)}
                  className="text-sm font-semibold text-emerald-600 hover:text-emerald-700 min-h-[44px] px-2"
                >
                  Edit
                </button>
              )}
            </div>

            {isEditing ? (
              <div className="space-y-4">
                <PhoneInput
                  labelText="Phone"
                  value={formData.phoneLocal}
                  onChange={(phoneLocal) => setFormData((prev) => ({ ...prev, phoneLocal }))}
                  required
                />
                <div>
                  <label className={label}>{HOMETOWN_LABEL}</label>
                  <input
                    type="text"
                    name="city"
                    value={formData.city}
                    onChange={handleChange}
                    className={input}
                  />
                </div>
                <div className="flex flex-col gap-3 pt-2">
                  <button type="button" onClick={() => setIsEditing(false)} className={btnOutline}>
                    Cancel
                  </button>
                  <button onClick={handleSaveProfile} disabled={editLoading} className={btnPrimary}>
                    {editLoading ? 'Saving...' : 'Save'}
                  </button>
                </div>
              </div>
            ) : (
              <dl className="space-y-4">
                <div>
                  <dt className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Phone</dt>
                  <dd className="font-medium text-slate-800">{profile.phoneNumber || '—'}</dd>
                </div>
                <div>
                  <dt className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{HOMETOWN_LABEL}</dt>
                  <dd className="font-medium text-slate-800">
                    {profile.city && profile.city !== 'Not Set' ? profile.city : '—'}
                  </dd>
                </div>
              </dl>
            )}
          </div>

          <div className="border-t border-slate-100 bg-slate-50 px-5 py-3 text-xs text-slate-500">
            Status:{' '}
            <span className="font-bold uppercase text-emerald-600">
              {(profile.isActive ?? true) &&
              (profile.status ?? 'active').toLowerCase() === 'active'
                ? 'Active'
                : 'Inactive'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Profile;
