// Register.jsx

import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import AuthTicketPanel from '../Components/AuthTicketPanel';
import '../styles/travelsphere-theme.css';

export default function Register() {
  const { register, loading, error } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    fullName: '',
    email: '',
    password: '',
    phone: '',
  });

  function handleChange(e) {
    setForm({ ...form, [e.target.name]: e.target.value });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const success = await register(form);
    if (success) navigate('/');
  }

  return (
    <div className="ts-auth-layout">
      <AuthTicketPanel
        from="BLR"
        to="PAR"
        headline="Start planning your next trip."
        body="Create a free account to search flights and hotels, save your travel documents, and check out in seconds."
        details={[
          { label: 'Cost', value: 'Free, always' },
          { label: 'Data', value: 'Encrypted end to end' },
          { label: 'Tracking', value: 'Every booking, one place' },
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

          <h1 className="ts-form-heading">Create your account</h1>
          <p className="ts-form-subtext">Join TravelSphere in less than a minute.</p>

          {error && <div className="ts-alert-error">{error}</div>}

          <form onSubmit={handleSubmit} noValidate>
            <div className="mb-3">
              <label className="ts-label" htmlFor="register-name">Full name</label>
              <input
                id="register-name"
                type="text"
                name="fullName"
                className="ts-input"
                placeholder="Gokul Kannan"
                value={form.fullName}
                onChange={handleChange}
                required
              />
            </div>

            <div className="mb-3">
              <label className="ts-label" htmlFor="register-email">Email</label>
              <input
                id="register-email"
                type="email"
                name="email"
                className="ts-input"
                placeholder="you@example.com"
                value={form.email}
                onChange={handleChange}
                required
              />
            </div>

            <div className="mb-3">
              <label className="ts-label" htmlFor="register-phone">Phone</label>
              <input
                id="register-phone"
                type="text"
                name="phone"
                className="ts-input"
                placeholder="98765 43210"
                value={form.phone}
                onChange={handleChange}
              />
            </div>

            <div className="mb-4">
              <label className="ts-label" htmlFor="register-password">Password</label>
              <input
                id="register-password"
                type="password"
                name="password"
                className="ts-input"
                placeholder="At least 8 characters"
                value={form.password}
                onChange={handleChange}
                required
                minLength={8}
              />
            </div>

            <button type="submit" className="ts-btn-primary" disabled={loading}>
              {loading ? 'Creating account...' : 'Create account'}
            </button>
          </form>

          <p className="mt-4 text-center text-muted mb-0">
            Already have an account?{' '}
            <Link to="/login" className="ts-switch-link">
              Log in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}