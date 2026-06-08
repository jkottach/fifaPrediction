import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiService } from '../services/apiService';
import { useAuth } from '../hooks/useAuth';
import { useAzureAuth } from '../services/swaAuth';
import AuthCard from '../components/AuthCard';
import PhoneInput from '../components/PhoneInput';
import { formatQatarPhone, stripQatarDialCode } from '../utils/phone';
import { alertError, btnPrimary, input, label } from '../theme';

const ProfileSetup: React.FC = () => {
  const navigate = useNavigate();
  const { user, login, token } = useAuth();

  const [formData, setFormData] = useState({
    city: '',
    phoneLocal: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (user && user.city !== 'Not Set' && user.phoneNumber?.trim()) {
      navigate('/dashboard');
    }

    if (user) {
      setFormData({
        city: user.city === 'Not Set' ? '' : user.city || '',
        phoneLocal: stripQatarDialCode(user.phoneNumber || ''),
      });
    }
  }, [user, navigate]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    if (!formData.phoneLocal.trim()) {
      setError('Phone number is required.');
      setLoading(false);
      return;
    }

    if (!formData.city.trim()) {
      setError('Hometown is required.');
      setLoading(false);
      return;
    }

    try {
      const response = await apiService.updateProfile({
        city: formData.city,
        phoneNumber: formatQatarPhone(formData.phoneLocal),
      });
      if (useAzureAuth) {
        login(response.data.user);
      } else {
        login(token || localStorage.getItem('token') || '', response.data.user);
      }
      navigate('/dashboard');
    } catch (err: unknown) {
      const message =
        err && typeof err === 'object' && 'response' in err
          ? (err as { response?: { data?: { error?: string } } }).response?.data?.error
          : undefined;
      setError(message || 'Profile setup failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthCard
      title="Complete your profile"
      subtitle={
        user?.firstName
          ? `Welcome, ${user.firstName}! Add a few details to get started.`
          : 'Add a few details to get started.'
      }
    >
      {error && <div className={alertError}>{error}</div>}

      <form onSubmit={handleSubmit} className="space-y-4">
        <PhoneInput
          value={formData.phoneLocal}
          onChange={(phoneLocal) => setFormData((prev) => ({ ...prev, phoneLocal }))}
          required
        />

        <div>
          <label className={label}>
            Hometown <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            name="city"
            value={formData.city}
            onChange={handleChange}
            className={input}
            required
          />
        </div>

        <button type="submit" disabled={loading} className={btnPrimary}>
          {loading ? 'Saving...' : 'Finish setup'}
        </button>
      </form>
    </AuthCard>
  );
};

export default ProfileSetup;
