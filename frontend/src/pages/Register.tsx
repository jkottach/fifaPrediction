import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { apiService } from '../services/apiService';
import { useAuth } from '../hooks/useAuth';
import AuthCard from '../components/AuthCard';
import PhoneInput from '../components/PhoneInput';
import { APP_NAME, HOMETOWN_LABEL } from '../constants/branding';
import { formatQatarPhone } from '../utils/phone';
import { alertError, btnPrimary, input, label, linkAccent } from '../theme';

const Register: React.FC = () => {
  const navigate = useNavigate();
  const { login } = useAuth();

  const [formData, setFormData] = useState({
    email: '',
    firstName: '',
    lastName: '',
    password: '',
    city: '',
    phoneLocal: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

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

    try {
      const { phoneLocal, ...profileFields } = formData;
      const response = await apiService.register({
        ...profileFields,
        phoneNumber: formatQatarPhone(phoneLocal),
      });
      login(response.data.token, response.data.user);
      navigate('/dashboard');
    } catch (err: unknown) {
      const message =
        err && typeof err === 'object' && 'response' in err
          ? (err as { response?: { data?: { error?: string } } }).response?.data?.error
          : undefined;
      setError(message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthCard title={`Join ${APP_NAME}`} subtitle="Create your account to start predicting">
      {error && <div className={alertError}>{error}</div>}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className={label}>Email</label>
          <input
            type="email"
            name="email"
            value={formData.email}
            onChange={handleChange}
            className={input}
            required
            autoComplete="email"
          />
        </div>

        <div className="space-y-4">
          <div>
            <label className={label}>First Name</label>
            <input
              type="text"
              name="firstName"
              value={formData.firstName}
              onChange={handleChange}
              className={input}
              required
            />
          </div>
          <div>
            <label className={label}>Last Name</label>
            <input
              type="text"
              name="lastName"
              value={formData.lastName}
              onChange={handleChange}
              className={input}
              required
            />
          </div>
        </div>

        <div>
          <label className={label}>Password</label>
          <input
            type="password"
            name="password"
            value={formData.password}
            onChange={handleChange}
            className={input}
            required
            autoComplete="new-password"
          />
        </div>

        <div>
          <label className={label}>{HOMETOWN_LABEL}</label>
          <input type="text" name="city" value={formData.city} onChange={handleChange} className={input} />
        </div>

        <PhoneInput
          value={formData.phoneLocal}
          onChange={(phoneLocal) => setFormData((prev) => ({ ...prev, phoneLocal }))}
          required
        />

        <button type="submit" disabled={loading} className={btnPrimary}>
          {loading ? 'Creating Account...' : 'Register'}
        </button>
      </form>

      <p className="text-center text-sm text-slate-600 mt-4">
        Already have an account?{' '}
        <Link to="/login" className={linkAccent}>
          Sign in
        </Link>
      </p>
    </AuthCard>
  );
};

export default Register;
