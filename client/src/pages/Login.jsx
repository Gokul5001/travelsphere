
//Login.jsx
import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import AuthTicketPanel from '../components/AuthTicketPanel';
import '../styles/travelsphere-theme.css';

export default function Login() {
  const { login, loading, error } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '' });

  function handleChange(e) {
    setForm({ ...form, [e.target.name]: e.target.value });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const success = await login(form);
    if (success) navigate('/');
  }

  return (
    <div className="ts-auth-layout">
      <AuthTicketPanel
        from="BLR"
        to="GOA"
        headline="Welcome back, explorer."
        body="Log in to manage your bookings, track visa applications, and spend your wallet credit — all in one place."
        details={[
          { label: 'Bookings', value: 'Synced across devices' },
          { label: 'Wallet', value: 'Balance ready to spend' },
          { label: 'Support', value: 'Live agents, 24/7' },
        ]}
      />

      <div className="ts-ticket-divider" aria-hidden="true">
        <span className="ts-notch ts-notch-top" />
        <span className="ts-notch ts-notch-bottom" />
      </div>

      <div className="ts-form-panel">
        <div className="ts-form-card">
          <Link to="/" className="ts-mobile-brand">
            Travel<span className="ts-brand-accent">Sphere</span>
          </Link>

          <h1 className="ts-form-heading">Log in to your account</h1>
          <p className="ts-form-subtext">Enter your details to continue.</p>

          {error && <div className="ts-alert-error">{error}</div>}

          <form onSubmit={handleSubmit} noValidate>
            <div className="mb-3">
              <label className="ts-label" htmlFor="login-email">Email</label>
              <input
                id="login-email"
                type="email"
                name="email"
                className="ts-input"
                placeholder="you@example.com"
                value={form.email}
                onChange={handleChange}
                required
              />
            </div>

            <div className="mb-4">
              <label className="ts-label" htmlFor="login-password">Password</label>
              <input
                id="login-password"
                type="password"
                name="password"
                className="ts-input"
                placeholder="••••••••"
                value={form.password}
                onChange={handleChange}
                required
              />
            </div>

            <button type="submit" className="ts-btn-primary" disabled={loading}>
              {loading ? 'Logging in...' : 'Log in'}
            </button>
          </form>

          <p className="mt-4 text-center text-muted mb-0">
            Don&apos;t have an account?{' '}
            <Link to="/register" className="ts-switch-link">
              Create one
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}