import { Link } from 'react-router-dom';

function PlaneIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
      <path d="M21 16v-2l-8-5V3.5c0-.83-.67-1.5-1.5-1.5S10 2.67 10 3.5V9l-8 5v2l8-2.5V19l-2.5 1.5V22l4-1 4 1v-1.5L13 19v-5.5l8 2.5z" />
    </svg>
  );
}

/**
 * Boarding-pass style visual panel shared by Login and Register.
 * `details` is an array of { label, value } shown like a ticket's fine print.
 */
export default function AuthTicketPanel({ from, to, headline, body, details }) {
  return (
    <div className="ts-ticket-panel">
      <div className="ts-ticket-stripe" />
      <div className="ts-ticket-content">
        <Link to="/" className="ts-ticket-brand">
          Travel<span className="ts-brand-accent">Sphere</span>
        </Link>

        <div className="ts-route">
          <span className="ts-route-code">{from}</span>
          <span className="ts-route-line">
            <span className="ts-route-plane">
              <PlaneIcon />
            </span>
          </span>
          <span className="ts-route-code">{to}</span>
        </div>

        <h2 className="ts-ticket-headline">{headline}</h2>
        <p className="ts-ticket-body">{body}</p>

        <div className="ts-ticket-details">
          {details.map((d) => (
            <div className="ts-detail-row" key={d.label}>
              <span className="ts-detail-label">{d.label}</span>
              <span className="ts-detail-value">{d.value}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
