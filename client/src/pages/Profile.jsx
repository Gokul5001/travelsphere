// profile.jsx

import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import axiosClient from '../api/axiosClient';
import Navbar from '../Components/Navbar';
import '../styles/travelsphere-theme.css';
import VisaSection from '../Components/VisaSection';

const STATUS_STYLES = {
  confirmed: { bg: 'var(--ts-success-bg)', color: 'var(--ts-success-text)', label: 'Confirmed' },
  pending: { bg: 'var(--ts-warning-bg)', color: 'var(--ts-warning-text)', label: 'Payment pending' },
  expired: { bg: 'var(--ts-neutral-bg)', color: 'var(--ts-neutral-text)', label: 'Expired' },
  cancelled: { bg: 'var(--ts-danger-bg)', color: 'var(--ts-danger-text)', label: 'Cancelled' },
};

const REFUND_STATUS_LABELS = {
  initiated: 'Refund in progress',
  processed: 'Refund completed',
  failed: 'Refund pending retry',
};

function StatusBadge({ status }) {
  const style = STATUS_STYLES[status] || STATUS_STYLES.pending;
  return (
    <span
      className="badge rounded-pill fw-semibold px-3 py-2"
      style={{ backgroundColor: style.bg, color: style.color }}
    >
      {style.label}
    </span>
  );
}

// Distinguishes bookings paid for with wallet balance vs. a direct Razorpay checkout.
// Assumes each booking row returned by the backend includes a `payment_method` field
// ('wallet' | anything else). Adjust the field name here if your API uses something else.
function PaymentMethodBadge({ method }) {
  const isWallet = method === 'wallet';
  return (
    <span
      className="badge rounded-pill fw-semibold px-2 py-1 ms-2"
      style={{
        backgroundColor: isWallet ? 'var(--ts-neutral-bg)' : 'var(--ts-neutral-bg)',
        color: 'var(--ts-neutral-text)',
        fontSize: '0.7rem',
      }}
    >
      {isWallet ? 'Booked with wallet' : 'Booked online'}
    </span>
  );
}

function loadRazorpayScript() {
  return new Promise((resolve) => {
    if (window.Razorpay) return resolve(true);
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

export default function Profile() {
  const { user } = useAuth();

  // ----- Bookings -----
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [cancellingId, setCancellingId] = useState(null);
  const [cancelErrors, setCancelErrors] = useState({});
  const [cancelNotices, setCancelNotices] = useState({});

  // ----- Wallet -----
  const [walletBalance, setWalletBalance] = useState(null);
  const [walletTransactions, setWalletTransactions] = useState([]);
  const [walletLoading, setWalletLoading] = useState(true);
  const [walletError, setWalletError] = useState(null);

  const [topupAmount, setTopupAmount] = useState('');
  const [topupSubmitting, setTopupSubmitting] = useState(false);
  const [topupError, setTopupError] = useState(null);
  const [topupNotice, setTopupNotice] = useState(null);

  // ----- Hotel bookings -----
  const [hotelBookings, setHotelBookings] = useState([]);
  const [hotelLoading, setHotelLoading] = useState(true);
  const [hotelError, setHotelError] = useState(null);

  const [hotelCancellingId, setHotelCancellingId] = useState(null);
  const [hotelCancelErrors, setHotelCancelErrors] = useState({});
  const [hotelCancelNotices, setHotelCancelNotices] = useState({});

  // ----- Bus bookings -----
  const [busBookings, setBusBookings] = useState([]);
  const [busLoading, setBusLoading] = useState(true);
  const [busError, setBusError] = useState(null);

  const [busCancellingId, setBusCancellingId] = useState(null);
  const [busCancelErrors, setBusCancelErrors] = useState({});
  const [busCancelNotices, setBusCancelNotices] = useState({});

  // ----- Package bookings -----
  const [packageBookings, setPackageBookings] = useState([]);
  const [packageLoading, setPackageLoading] = useState(true);
  const [packageError, setPackageError] = useState(null);

  const [packageCancellingId, setPackageCancellingId] = useState(null);
  const [packageCancelErrors, setPackageCancelErrors] = useState({});
  const [packageCancelNotices, setPackageCancelNotices] = useState({});

  async function loadBookings() {
    setLoading(true);
    setError(null);
    try {
      const { data } = await axiosClient.get('/flights/my-bookings');
      setBookings(data.bookings);
    } catch (err) {
      setError(err.response?.data?.error || 'Could not load your bookings.');
    } finally {
      setLoading(false);
    }
  }

  async function loadWallet() {
    setWalletLoading(true);
    setWalletError(null);
    try {
      const { data } = await axiosClient.get('/wallet');
      setWalletBalance(data.balance);
      setWalletTransactions(data.transactions);
    } catch (err) {
      setWalletError(err.response?.data?.error || 'Could not load your wallet.');
    } finally {
      setWalletLoading(false);
    }
  }

  async function loadHotelBookings() {
    setHotelLoading(true);
    setHotelError(null);
    try {
      const { data } = await axiosClient.get('/hotels/my-bookings');
      setHotelBookings(data.bookings);
    } catch (err) {
      setHotelError(err.response?.data?.error || 'Could not load your hotel bookings.');
    } finally {
      setHotelLoading(false);
    }
  }

  async function loadBusBookings() {
    setBusLoading(true);
    setBusError(null);
    try {
      const { data } = await axiosClient.get('/buses/my-bookings');
      setBusBookings(data.bookings);
    } catch (err) {
      setBusError(err.response?.data?.error || 'Could not load your bus bookings.');
    } finally {
      setBusLoading(false);
    }
  }

  async function loadPackageBookings() {
    setPackageLoading(true);
    setPackageError(null);
    try {
      const { data } = await axiosClient.get('/packages/my-bookings');
      setPackageBookings(data.bookings);
    } catch (err) {
      setPackageError(err.response?.data?.error || 'Could not load your package bookings.');
    } finally {
      setPackageLoading(false);
    }
  }

  useEffect(() => {
    loadBookings();
    loadWallet();
    loadHotelBookings();
    loadBusBookings();
    loadPackageBookings();
  }, []);

  async function handleCancel(booking) {
    const confirmed = window.confirm(
      `Cancel this ${booking.airline} ${booking.flight_number} booking? ` +
        (booking.status === 'confirmed'
          ? 'A refund will be initiated automatically.'
          : 'No payment was completed, so no refund is needed.')
    );
    if (!confirmed) return;

    setCancellingId(booking.id);
    setCancelErrors((prev) => ({ ...prev, [booking.id]: null }));
    setCancelNotices((prev) => ({ ...prev, [booking.id]: null }));

    try {
      const { data } = await axiosClient.post(`/bookings/${booking.id}/cancel`);

      setBookings((prev) =>
        prev.map((b) => (b.id === booking.id ? { ...b, status: data.booking.status } : b))
      );

      if (data.refund) {
        const label = REFUND_STATUS_LABELS[data.refund.status] || data.refund.status;
        setCancelNotices((prev) => ({
          ...prev,
          [booking.id]: `Booking cancelled. ${label}.`,
        }));
      } else {
        setCancelNotices((prev) => ({ ...prev, [booking.id]: 'Booking cancelled.' }));
      }
    } catch (err) {
      setCancelErrors((prev) => ({
        ...prev,
        [booking.id]: err.response?.data?.error || 'Cancellation failed. Please try again.',
      }));
    } finally {
      setCancellingId(null);
    }
  }

  async function handleHotelCancel(booking) {
    const confirmed = window.confirm(
      `Cancel this ${booking.hotel_name} booking? ` +
        (booking.status === 'confirmed'
          ? 'A refund will be initiated automatically.'
          : 'No payment was completed, so no refund is needed.')
    );
    if (!confirmed) return;

    setHotelCancellingId(booking.id);
    setHotelCancelErrors((prev) => ({ ...prev, [booking.id]: null }));
    setHotelCancelNotices((prev) => ({ ...prev, [booking.id]: null }));

    try {
      const { data } = await axiosClient.post(`/hotels/${booking.id}/cancel`);

      setHotelBookings((prev) =>
        prev.map((b) => (b.id === booking.id ? { ...b, status: data.booking.status } : b))
      );

      if (data.refund) {
        const label = REFUND_STATUS_LABELS[data.refund.status] || data.refund.status;
        setHotelCancelNotices((prev) => ({ ...prev, [booking.id]: `Booking cancelled. ${label}.` }));
      } else {
        setHotelCancelNotices((prev) => ({ ...prev, [booking.id]: 'Booking cancelled.' }));
      }
    } catch (err) {
      setHotelCancelErrors((prev) => ({
        ...prev,
        [booking.id]: err.response?.data?.error || 'Cancellation failed. Please try again.',
      }));
    } finally {
      setHotelCancellingId(null);
    }
  }

  // Assumes bus cancel endpoint follows the hotel/package pattern (/buses/:id/cancel).
  // Change this if your busRoutes.js defines a different path.
  async function handleBusCancel(booking) {
    const confirmed = window.confirm(
      `Cancel this ${booking.operator_name} bus booking? ` +
        (booking.status === 'confirmed'
          ? 'A refund will be initiated automatically.'
          : 'No payment was completed, so no refund is needed.')
    );
    if (!confirmed) return;

    setBusCancellingId(booking.id);
    setBusCancelErrors((prev) => ({ ...prev, [booking.id]: null }));
    setBusCancelNotices((prev) => ({ ...prev, [booking.id]: null }));

    try {
      const { data } = await axiosClient.post(`/buses/${booking.id}/cancel`);

      setBusBookings((prev) =>
        prev.map((b) => (b.id === booking.id ? { ...b, status: data.booking.status } : b))
      );

      if (data.refund) {
        const label = REFUND_STATUS_LABELS[data.refund.status] || data.refund.status;
        setBusCancelNotices((prev) => ({ ...prev, [booking.id]: `Booking cancelled. ${label}.` }));
      } else {
        setBusCancelNotices((prev) => ({ ...prev, [booking.id]: 'Booking cancelled.' }));
      }
    } catch (err) {
      setBusCancelErrors((prev) => ({
        ...prev,
        [booking.id]: err.response?.data?.error || 'Cancellation failed. Please try again.',
      }));
    } finally {
      setBusCancellingId(null);
    }
  }

  // Assumes package cancel endpoint follows the hotel pattern (/packages/:id/cancel).
  // Change this if your packageRoutes.js defines a different path.
  async function handlePackageCancel(booking) {
    const confirmed = window.confirm(
      `Cancel this ${booking.package_name} booking? ` +
        (booking.status === 'confirmed'
          ? 'A refund will be initiated automatically.'
          : 'No payment was completed, so no refund is needed.')
    );
    if (!confirmed) return;

    setPackageCancellingId(booking.id);
    setPackageCancelErrors((prev) => ({ ...prev, [booking.id]: null }));
    setPackageCancelNotices((prev) => ({ ...prev, [booking.id]: null }));

    try {
      const { data } = await axiosClient.post(`/packages/${booking.id}/cancel`);

      setPackageBookings((prev) =>
        prev.map((b) => (b.id === booking.id ? { ...b, status: data.booking.status } : b))
      );

      if (data.refund) {
        const label = REFUND_STATUS_LABELS[data.refund.status] || data.refund.status;
        setPackageCancelNotices((prev) => ({ ...prev, [booking.id]: `Booking cancelled. ${label}.` }));
      } else {
        setPackageCancelNotices((prev) => ({ ...prev, [booking.id]: 'Booking cancelled.' }));
      }
    } catch (err) {
      setPackageCancelErrors((prev) => ({
        ...prev,
        [booking.id]: err.response?.data?.error || 'Cancellation failed. Please try again.',
      }));
    } finally {
      setPackageCancellingId(null);
    }
  }

  async function handleTopup(e) {
    e.preventDefault();
    setTopupError(null);
    setTopupNotice(null);

    const amount = Number(topupAmount);
    if (!amount || amount <= 0) {
      setTopupError('Enter a valid amount.');
      return;
    }

    setTopupSubmitting(true);

    try {
      const scriptReady = await loadRazorpayScript();
      if (!scriptReady) {
        setTopupError('Unable to load payment gateway. Check your connection and try again.');
        setTopupSubmitting(false);
        return;
      }

      const { data } = await axiosClient.post('/wallet/topup', { amount });
      const { razorpayOrder, razorpayKeyId } = data;

      const options = {
        key: razorpayKeyId,
        order_id: razorpayOrder.id,
        amount: razorpayOrder.amount,
        currency: razorpayOrder.currency,
        name: 'TravelSphere Wallet',
        description: `Add ₹${amount.toLocaleString('en-IN')} to wallet`,
        prefill: {
          name: user.full_name,
          email: user.email,
        },
        theme: { color: '#e8572e' },
        handler: function () {
          setTopupNotice(
            `Payment received. Your wallet balance updates in a few seconds — click Refresh below to see it.`
          );
          setTopupAmount('');
        },
        modal: {
          ondismiss: function () {
            setTopupError('Top-up cancelled — no amount was added.');
          },
        },
      };

      const rzp = new window.Razorpay(options);
      rzp.on('payment.failed', function (response) {
        setTopupError(`Payment failed: ${response.error.description}`);
      });
      rzp.open();
    } catch (err) {
      setTopupError(err.response?.data?.error || 'Top-up could not be started. Please try again.');
    } finally {
      setTopupSubmitting(false);
    }
  }

  return (
    <>
      <Navbar />

      <div className="ts-page-bg">
        <div className="container py-5">
          {/* Profile summary */}
          <div className="ts-panel ts-panel-accent p-4 mb-4">
            <div className="d-flex align-items-center gap-3">
              <div className="ts-avatar">{user?.full_name?.[0]?.toUpperCase()}</div>
              <div>
                <h4 className="mb-0" style={{ fontFamily: 'var(--ts-font-display)', fontWeight: 600, color: 'var(--ts-ink)' }}>
                  {user?.full_name}
                </h4>
                <div className="text-muted small">{user?.email}</div>
                <span className="badge ts-badge-role mt-1">{user?.role}</span>
              </div>
            </div>
          </div>

          {/* Wallet */}
          <div className="ts-panel p-4 mb-5">
            <div className="row g-4 align-items-start">
              <div className="col-md-4">
                <div className="text-muted small mb-1">Wallet balance</div>
                {walletLoading ? (
                  <div className="text-muted">Loading...</div>
                ) : walletError ? (
                  <div className="small" style={{ color: 'var(--ts-danger-text)' }}>{walletError}</div>
                ) : (
                  <div
                    className="fw-bold display-6"
                    style={{ color: 'var(--ts-ink)', fontFamily: 'var(--ts-font-display)' }}
                  >
                    &#8377;{Number(walletBalance).toLocaleString('en-IN')}
                  </div>
                )}
                <button className="ts-btn-outline-neutral mt-2" onClick={loadWallet} disabled={walletLoading}>
                  Refresh
                </button>
              </div>

              <div className="col-md-4">
                <form onSubmit={handleTopup}>
                  <label className="ts-label">Add money</label>
                  <div className="d-flex gap-2">
                    <input
                      type="number"
                      min="1"
                      step="1"
                      className="ts-input"
                      placeholder="Amount in ₹"
                      value={topupAmount}
                      onChange={(e) => setTopupAmount(e.target.value)}
                    />
                    <button type="submit" className="ts-btn-topup" disabled={topupSubmitting}>
                      {topupSubmitting ? 'Please wait...' : 'Top up'}
                    </button>
                  </div>
                  {topupError && <div className="small mt-2" style={{ color: 'var(--ts-danger-text)' }}>{topupError}</div>}
                  {topupNotice && <div className="small mt-2" style={{ color: 'var(--ts-success-text)' }}>{topupNotice}</div>}
                </form>
              </div>

              <div className="col-md-4">
                <div className="text-muted small mb-1">Recent activity</div>
                {walletLoading ? (
                  <div className="text-muted small">Loading...</div>
                ) : walletTransactions.length === 0 ? (
                  <div className="text-muted small">No wallet activity yet.</div>
                ) : (
                  <div style={{ maxHeight: 140, overflowY: 'auto' }}>
                    {walletTransactions.map((tx) => (
                      <div key={tx.id} className="d-flex justify-content-between small border-bottom py-1">
                        <span className="text-capitalize">{tx.reason.replace('_', ' ')}</span>
                        <span
                          style={{
                            fontWeight: 600,
                            color: tx.type === 'credit' ? 'var(--ts-success-text)' : 'var(--ts-danger-text)',
                          }}
                        >
                          {tx.type === 'credit' ? '+' : '-'}&#8377;{Number(tx.amount).toLocaleString('en-IN')}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Flight bookings */}
          <div className="ts-section-title">Flight bookings</div>

          {loading && <p className="text-muted">Loading your bookings...</p>}
          {error && <div className="ts-alert-error">{error}</div>}

          {!loading && !error && bookings.length === 0 && (
            <div className="ts-empty-state mb-5">
              No flights booked yet. <a href="/flights" className="ts-switch-link">Search flights</a> to add your first trip.
            </div>
          )}

          {bookings.length > 0 && (
            <div className="ts-panel ts-row-list mb-5">
              {bookings.map((b) => {
                const isCancellable = b.status === 'pending' || b.status === 'confirmed';
                const isCancellingThis = cancellingId === b.id;

                return (
                  <div className="ts-row-item" key={b.id}>
                    <div className="row align-items-center g-3">
                      <div className="col-md-3">
                        <h6 className="fw-bold mb-0">{b.airline}</h6>
                        <span className="text-muted small">{b.flight_number}</span>
                      </div>

                      <div className="col-md-3">
                        <div className="d-flex align-items-center gap-2">
                          <div>
                            <div className="fw-semibold">{b.origin}</div>
                            <div className="small text-muted">
                              {new Date(b.departure_time).toLocaleString()}
                            </div>
                          </div>
                          <div className="text-muted">&rarr;</div>
                          <div>
                            <div className="fw-semibold">{b.destination}</div>
                            <div className="small text-muted">
                              {new Date(b.arrival_time).toLocaleString()}
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="col-md-2">
                        <div className="fw-bold" style={{ color: 'var(--ts-ink)' }}>
                          &#8377;{Number(b.total_price).toLocaleString('en-IN')}
                        </div>
                        <div className="small text-muted">
                          {b.seats_booked} seat{b.seats_booked > 1 ? 's' : ''}
                        </div>
                      </div>

                      <div className="col-md-2">
                        <StatusBadge status={b.status} />
                        <PaymentMethodBadge method={b.payment_method} />
                        <div className="small text-muted mt-1">
                          Booked {new Date(b.created_at).toLocaleDateString()}
                        </div>
                      </div>

                      <div className="col-md-2 text-md-end">
                        {isCancellable && (
                          <button
                            className="ts-btn-outline-cancel"
                            disabled={isCancellingThis}
                            onClick={() => handleCancel(b)}
                          >
                            {isCancellingThis ? 'Cancelling...' : 'Cancel'}
                          </button>
                        )}
                      </div>
                    </div>

                    {cancelNotices[b.id] && (
                      <div className="small mt-3" style={{ color: 'var(--ts-success-text)' }}>
                        {cancelNotices[b.id]}
                      </div>
                    )}
                    {cancelErrors[b.id] && (
                      <div className="small mt-3" style={{ color: 'var(--ts-danger-text)' }}>
                        {cancelErrors[b.id]}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Hotel bookings */}
          <div className="ts-section-title">Hotel bookings</div>

          {hotelLoading && <p className="text-muted">Loading your hotel bookings...</p>}
          {hotelError && <div className="ts-alert-error">{hotelError}</div>}

          {!hotelLoading && !hotelError && hotelBookings.length === 0 && (
            <div className="ts-empty-state mb-5">
              No hotels booked yet. <a href="/hotels" className="ts-switch-link">Search hotels</a> to add your first stay.
            </div>
          )}

          {hotelBookings.length > 0 && (
            <div className="ts-panel ts-row-list mb-5">
              {hotelBookings.map((b) => {
                const isCancellable = b.status === 'pending' || b.status === 'confirmed';
                const isCancellingThis = hotelCancellingId === b.id;

                return (
                  <div className="ts-row-item" key={b.id}>
                    <div className="row align-items-center g-3">
                      <div className="col-md-3">
                        <h6 className="fw-bold mb-0">{b.hotel_name}</h6>
                        <span className="text-muted small">{b.city}</span>
                      </div>

                      <div className="col-md-3">
                        <div className="small text-muted">
                          {new Date(b.check_in).toLocaleDateString()} &rarr; {new Date(b.check_out).toLocaleDateString()}
                        </div>
                      </div>

                      <div className="col-md-2">
                        <div className="fw-bold" style={{ color: 'var(--ts-ink)' }}>
                          &#8377;{Number(b.total_price).toLocaleString('en-IN')}
                        </div>
                        <div className="small text-muted">
                          {b.rooms_booked} room{b.rooms_booked > 1 ? 's' : ''}
                        </div>
                      </div>

                      <div className="col-md-2">
                        <StatusBadge status={b.status} />
                        <PaymentMethodBadge method={b.payment_method} />
                        <div className="small text-muted mt-1">
                          Booked {new Date(b.created_at).toLocaleDateString()}
                        </div>
                      </div>

                      <div className="col-md-2 text-md-end">
                        {isCancellable && (
                          <button
                            className="ts-btn-outline-cancel"
                            disabled={isCancellingThis}
                            onClick={() => handleHotelCancel(b)}
                          >
                            {isCancellingThis ? 'Cancelling...' : 'Cancel'}
                          </button>
                        )}
                      </div>
                    </div>

                    {hotelCancelNotices[b.id] && (
                      <div className="small mt-3" style={{ color: 'var(--ts-success-text)' }}>
                        {hotelCancelNotices[b.id]}
                      </div>
                    )}
                    {hotelCancelErrors[b.id] && (
                      <div className="small mt-3" style={{ color: 'var(--ts-danger-text)' }}>
                        {hotelCancelErrors[b.id]}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Bus bookings */}
          <div className="ts-section-title">Bus bookings</div>

          {busLoading && <p className="text-muted">Loading your bus bookings...</p>}
          {busError && <div className="ts-alert-error">{busError}</div>}

          {!busLoading && !busError && busBookings.length === 0 && (
            <div className="ts-empty-state mb-5">
              No buses booked yet. <a href="/buses" className="ts-switch-link">Search buses</a> to add your first trip.
            </div>
          )}

          {busBookings.length > 0 && (
            <div className="ts-panel ts-row-list mb-5">
              {busBookings.map((b) => {
                const isCancellable = b.status === 'pending' || b.status === 'confirmed';
                const isCancellingThis = busCancellingId === b.id;

                return (
                  <div className="ts-row-item" key={b.id}>
                    <div className="row align-items-center g-3">
                      <div className="col-md-3">
                        <h6 className="fw-bold mb-0">{b.operator_name}</h6>
                        <span className="text-muted small">{b.bus_number}</span>
                      </div>

                      <div className="col-md-3">
                        <div className="d-flex align-items-center gap-2">
                          <div>
                            <div className="fw-semibold">{b.origin}</div>
                            <div className="small text-muted">
                              {new Date(b.departure_time).toLocaleString()}
                            </div>
                          </div>
                          <div className="text-muted">&rarr;</div>
                          <div>
                            <div className="fw-semibold">{b.destination}</div>
                            <div className="small text-muted">
                              {new Date(b.arrival_time).toLocaleString()}
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="col-md-2">
                        <div className="fw-bold" style={{ color: 'var(--ts-ink)' }}>
                          &#8377;{Number(b.total_price).toLocaleString('en-IN')}
                        </div>
                        <div className="small text-muted">
                          {b.seats_booked} seat{b.seats_booked > 1 ? 's' : ''}
                        </div>
                      </div>

                      <div className="col-md-2">
                        <StatusBadge status={b.status} />
                        <PaymentMethodBadge method={b.payment_method} />
                        <div className="small text-muted mt-1">
                          Booked {new Date(b.created_at).toLocaleDateString()}
                        </div>
                      </div>

                      <div className="col-md-2 text-md-end">
                        {isCancellable && (
                          <button
                            className="ts-btn-outline-cancel"
                            disabled={isCancellingThis}
                            onClick={() => handleBusCancel(b)}
                          >
                            {isCancellingThis ? 'Cancelling...' : 'Cancel'}
                          </button>
                        )}
                      </div>
                    </div>

                    {busCancelNotices[b.id] && (
                      <div className="small mt-3" style={{ color: 'var(--ts-success-text)' }}>
                        {busCancelNotices[b.id]}
                      </div>
                    )}
                    {busCancelErrors[b.id] && (
                      <div className="small mt-3" style={{ color: 'var(--ts-danger-text)' }}>
                        {busCancelErrors[b.id]}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Package bookings */}
          <div className="ts-section-title">Package bookings</div>

          {packageLoading && <p className="text-muted">Loading your package bookings...</p>}
          {packageError && <div className="ts-alert-error">{packageError}</div>}

          {!packageLoading && !packageError && packageBookings.length === 0 && (
            <div className="ts-empty-state">
              No packages booked yet. <a href="/packages" className="ts-switch-link">Search packages</a> to add your first trip.
            </div>
          )}

          {packageBookings.length > 0 && (
            <div className="ts-panel ts-row-list">
              {packageBookings.map((b) => {
                const isCancellable = b.status === 'pending' || b.status === 'confirmed';
                const isCancellingThis = packageCancellingId === b.id;

                return (
                  <div className="ts-row-item" key={b.id}>
                    <div className="row align-items-center g-3">
                      <div className="col-md-3">
                        <h6 className="fw-bold mb-0">{b.package_name}</h6>
                      </div>

                      <div className="col-md-3">
                        <div className="small text-muted">
                          {new Date(b.start_date).toLocaleDateString()} &rarr; {new Date(b.end_date).toLocaleDateString()}
                        </div>
                      </div>

                      <div className="col-md-2">
                        <div className="fw-bold" style={{ color: 'var(--ts-ink)' }}>
                          &#8377;{Number(b.total_price).toLocaleString('en-IN')}
                        </div>
                        <div className="small text-muted">
                          {b.travelers_booked} traveler{b.travelers_booked > 1 ? 's' : ''}
                        </div>
                      </div>

                      <div className="col-md-2">
                        <StatusBadge status={b.status} />
                        <PaymentMethodBadge method={b.payment_method} />
                        <div className="small text-muted mt-1">
                          Booked {new Date(b.created_at).toLocaleDateString()}
                        </div>
                      </div>

                      <div className="col-md-2 text-md-end">
                        {isCancellable && (
                          <button
                            className="ts-btn-outline-cancel"
                            disabled={isCancellingThis}
                            onClick={() => handlePackageCancel(b)}
                          >
                            {isCancellingThis ? 'Cancelling...' : 'Cancel'}
                          </button>
                        )}
                      </div>
                    </div>

                    {packageCancelNotices[b.id] && (
                      <div className="small mt-3" style={{ color: 'var(--ts-success-text)' }}>
                        {packageCancelNotices[b.id]}
                      </div>
                    )}
                    {packageCancelErrors[b.id] && (
                      <div className="small mt-3" style={{ color: 'var(--ts-danger-text)' }}>
                        {packageCancelErrors[b.id]}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

<VisaSection />
        </div>
      </div>
    </>
  );
}