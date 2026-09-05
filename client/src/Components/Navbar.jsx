//navbar.jsx
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import '../styles/travelsphere-theme.css';

function UserIcon() {
  return (
    <svg width="19" height="19" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="12" cy="8.2" r="3.4" fill="currentColor" />
      <path
        d="M4.5 20c.5-4.3 3.7-6.9 7.5-6.9s7 2.6 7.5 6.9"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  );
}

function ProfileIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="8" r="3.2" />
      <path d="M5 20c.5-3.8 3.4-6 7-6s6.5 2.2 7 6" />
    </svg>
  );
}

function LogoutIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <path d="M16 17l5-5-5-5" />
      <path d="M21 12H9" />
    </svg>
  );
}

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate('/login');
  }

  return (
    <nav className="navbar navbar-expand-lg navbar-dark ts-navbar sticky-top w-100">
      <div className="ts-ticket-stripe w-100 position-absolute top-0 start-0" />
      <div className="container py-3">
        <Link to="/" className="ts-navbar-brand">
          Travel<span className="ts-brand-accent">Sphere</span>
        </Link>

        <button
          className="navbar-toggler"
          type="button"
          data-bs-toggle="collapse"
          data-bs-target="#tsNavbarContent"
        >
          <span className="navbar-toggler-icon"></span>
        </button>

        <div className="collapse navbar-collapse" id="tsNavbarContent">
          <ul className="navbar-nav ms-auto align-items-lg-center gap-lg-4">
            <li className="nav-item">
              <Link to="/" className="ts-nav-link">Home</Link>
            </li>
            <li className="nav-item">
              <Link to="/flights" className="ts-nav-link">Flights</Link>
            </li>
            <li className="nav-item">
              <Link to="/hotels" className="ts-nav-link">Hotels</Link>
            </li>
            <li className="nav-item">
              <Link to="/buses" className="ts-nav-link">Buses</Link>
            </li>
            <li className="nav-item">
              <Link to="/packages" className="ts-nav-link">Packages</Link>
            </li>

            {user ? (
              <li className="nav-item dropdown">
                <button
                  className="ts-user-toggle"
                  type="button"
                  id="tsUserMenuToggle"
                  data-bs-toggle="dropdown"
                  aria-expanded="false"
                  aria-label="Account menu"
                >
                  <UserIcon />
                </button>
                <ul className="dropdown-menu dropdown-menu-end ts-user-menu" aria-labelledby="tsUserMenuToggle">
                  <li>
                    <span className="ts-user-menu-name">{user.full_name}</span>
                    <span className="ts-user-menu-email">{user.email}</span>
                  </li>
                  <li>
                    <hr className="ts-user-menu-divider" />
                  </li>
                  <li>
                    <Link to="/profile" className="ts-user-menu-item">
                      <ProfileIcon />
                      My profile
                    </Link>
                  </li>
                  <li>
                    <button onClick={handleLogout} className="ts-user-menu-item ts-user-menu-item-danger">
                      <LogoutIcon />
                      Log out
                    </button>
                  </li>
                </ul>
              </li>
            ) : (
              <>
                <li className="nav-item">
                  <Link to="/login" className="ts-nav-link">Log in</Link>
                </li>
                <li className="nav-item">
                  <Link to="/register" className="ts-btn-primary ts-btn-sm">
                    Sign up
                  </Link>
                </li>
              </>
            )}
          </ul>
        </div>
      </div>
    </nav>
  );
}