import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Navbar from '../Components/Navbar';
import '../styles/travelsphere-theme.css';

function PlaneIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
      <path d="M21 16v-2l-8-5V3.5c0-.83-.67-1.5-1.5-1.5S10 2.67 10 3.5V9l-8 5v2l8-2.5V19l-2.5 1.5V22l4-1 4 1v-1.5L13 19v-5.5l8 2.5z" />
    </svg>
  );
}

function IconFlight() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 16v-1.6L13.5 9V4a1.5 1.5 0 0 0-3 0v5L3 14.4V16l7.5-2.3V19l-2.2 1.4V22l3.7-.9 3.7.9v-1.6L13.5 19v-5.3z" />
    </svg>
  );
}

function IconHotel() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 19V6M3 13h17a1 1 0 0 1 1 1v5M8 13V9a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v4" />
      <circle cx="7.5" cy="10.5" r="1" />
    </svg>
  );
}

function IconBus() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3.5" y="4.5" width="17" height="12" rx="2" />
      <path d="M3.5 11h17M7 20v-3.5M17 20v-3.5" />
      <circle cx="7.5" cy="17.5" r="0.9" fill="currentColor" stroke="none" />
      <circle cx="16.5" cy="17.5" r="0.9" fill="currentColor" stroke="none" />
    </svg>
  );
}

function IconPackage() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <rect x="4" y="8" width="16" height="12" rx="2" />
      <path d="M8 8V6a4 4 0 0 1 8 0v2" />
    </svg>
  );
}

function IconVisa() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="5.5" width="18" height="13" rx="2" />
      <circle cx="8.5" cy="11.5" r="1.75" />
      <path d="M13.5 10h5M13.5 13h3.5" />
    </svg>
  );
}

function IconShield() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3.5 19 6v6c0 4.5-3 7.5-7 8.5-4-1-7-4-7-8.5V6l7-2.5Z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}

const features = [
  { icon: <IconFlight />, title: 'Flights & buses', text: 'Compare fares in real time and lock in seats with instant, secure checkout.' },
  { icon: <IconHotel />, title: 'Hotels & stays', text: 'Filter by price, rating, and location with live availability and free-cancellation options.' },
  { icon: <IconPackage />, title: 'Holiday packages', text: 'Curated multi-day itineraries bundled with stays, transfers, and activities.' },
  { icon: <IconVisa />, title: 'Visa assistance', text: 'Upload documents and track your visa application status end to end.' },
  { icon: <IconBus />, title: 'Wallet & coupons', text: 'Store refunds in your wallet and apply offers automatically at checkout.' },
  { icon: <IconShield />, title: 'Secure by design', text: 'Role-based access, encrypted sessions, and audit-logged activity across the platform.' },
];

export default function Home() {
  const { user } = useAuth();

  return (
    <>
      <Navbar />

      <section className="ts-hero">
        <div className="ts-ticket-stripe" />
        <div className="container ts-hero-content">
          <div className="row align-items-center g-5">
            <div className="col-lg-7">
              <h1 className="ts-hero-headline">
                Your entire trip,
                <br />
                planned in one place.
              </h1>

              <p className="ts-hero-body">
                Search, book, and manage flights, hotels, buses, and holiday
                packages — with wallet, coupons, and instant confirmations,
                all under one roof.
              </p>

              <div className="mt-4">
                {user ? (
                  <div className="">
                    {/* <h4>Welcome back, {user.full_name}</h4> */}
                    {/* <p className="mb-0 small" style={{ color: 'rgba(255,255,255,0.7)' }}> */}
                      {/* {user.email} &middot; Role: {user.role} */}
                    {/* </p> */}
                  </div>
                ) : (
                  <div className="ts-hero-cta">
                    <Link to="/register" className="ts-btn-primary" style={{ width: 'auto' }}>
                      Get started
                    </Link>
                    <Link to="/login" className="ts-btn-outline-light">
                      Log in
                    </Link>
                  </div>
                )}
              </div>

              <div className="ts-hero-stats">
                <div>
                  <div className="ts-hero-stat-value">120+</div>
                  <div className="ts-hero-stat-label">Destinations</div>
                </div>
                <div>
                  <div className="ts-hero-stat-value">50K+</div>
                  <div className="ts-hero-stat-label">Bookings</div>
                </div>
                <div>
                  <div className="ts-hero-stat-value">4.8</div>
                  <div className="ts-hero-stat-label">Average rating</div>
                </div>
              </div>
            </div>

            <div className="col-lg-5 d-none d-lg-block">
              <div className="ts-hero-ticket">
                <div className="ts-hero-ticket-route">
                  <span className="ts-hero-ticket-code">BLR</span>
                  <span className="ts-hero-ticket-line">
                    <span className="ts-hero-ticket-plane">
                      <PlaneIcon />
                    </span>
                  </span>
                  <span className="ts-hero-ticket-code">GOA</span>
                </div>
                <div className="ts-hero-ticket-details">
                  <div>
                    <div className="ts-hero-ticket-detail-label">Departs</div>
                    <div className="ts-hero-ticket-detail-value">14 Oct, 06:20</div>
                  </div>
                  <div>
                    <div className="ts-hero-ticket-detail-label">Seat</div>
                    <div className="ts-hero-ticket-detail-value">14A</div>
                  </div>
                  <div>
                    <div className="ts-hero-ticket-detail-label">Status</div>
                    <div className="ts-hero-ticket-detail-value">Confirmed</div>
                  </div>
                </div>
                <div className="ts-hero-ticket-barcode" />
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="py-5" style={{ background: 'var(--ts-paper)' }}>
        <div className="container py-4">
          <div className="text-center mb-5">
            <h2 className="ts-section-title d-inline-block" style={{ borderLeft: 'none', paddingLeft: 0 }}>
              Everything you need to travel
            </h2>
            <p className="text-muted">One platform for search, booking, payments, and support.</p>
          </div>

          <div className="ts-feature-grid">
            {features.map((f) => (
              <div className="ts-feature-item" key={f.title}>
                <div className="ts-feature-icon">{f.icon}</div>
                <h5 className="ts-feature-title">{f.title}</h5>
                <p className="ts-feature-text">{f.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <footer className="ts-footer">
        &copy; {new Date().getFullYear()} Travel<span className="ts-brand-accent">Sphere</span>. Built for the LemonTrip
        technical assessment.
      </footer>
    </>
  );
}