import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axiosClient from '../api/axiosClient';
import { addToCart } from '../api/cartApi';
import { useAuth } from '../context/AuthContext';
import Navbar from '../Components/Navbar';
import '../styles/travelsphere-theme.css';

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

function Notice({ tone, children }) {
  const styles = {
    error: { bg: 'var(--ts-danger-bg)', color: 'var(--ts-danger-text)' },
    success: { bg: 'var(--ts-success-bg)', color: 'var(--ts-success-text)' },
    info: { bg: 'var(--ts-neutral-bg)', color: 'var(--ts-neutral-text)' },
  };
  const style = styles[tone] || styles.info;
  return (
    <div
      className="rounded-3 px-3 py-2 mb-4 small"
      style={{ backgroundColor: style.bg, color: style.color }}
    >
      {children}
    </div>
  );
}

export default function FlightSearch() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState({ origin: '', destination: '', date: '' });
  const [results, setResults] = useState([]);
  const [searched, setSearched] = useState(false);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState(null);

  // per-flight booking state, keyed by flight id
  const [seatsById, setSeatsById] = useState({});
  const [couponById, setCouponById] = useState({});
  const [bookingId, setBookingId] = useState(null); // which flight is currently being booked
  const [bookingError, setBookingError] = useState(null);
  const [walletBookingId, setWalletBookingId] = useState(null); // which flight is being paid via wallet
  const [bookingSuccess, setBookingSuccess] = useState(null);

  // cart state, keyed by flight id
  const [cartAddingId, setCartAddingId] = useState(null);
  const [cartNotice, setCartNotice] = useState(null);

  function handleChange(e) {
    setForm({ ...form, [e.target.name]: e.target.value });
  }

  function seatsFor(flightId) {
    return seatsById[flightId] ?? 1;
  }

  function setSeatsFor(flightId, value) {
    setSeatsById({ ...seatsById, [flightId]: value });
  }

  function couponFor(flightId) {
    return couponById[flightId] ?? '';
  }

  function setCouponFor(flightId, value) {
    setCouponById({ ...couponById, [flightId]: value });
  }

  async function handleSearch(e) {
    e.preventDefault();
    setSearching(true);
    setSearchError(null);
    setBookingSuccess(null);
    setBookingError(null);
    setCartNotice(null);

    try {
      const params = {};
      if (form.origin) params.origin = form.origin;
      if (form.destination) params.destination = form.destination;
      if (form.date) params.date = form.date;

      const { data } = await axiosClient.get('/flights/search', { params });
      setResults(data.results);
      setSearched(true);
    } catch (err) {
      setSearchError(err.response?.data?.error || 'Search failed. Please try again.');
    } finally {
      setSearching(false);
    }
  }

  async function handleAddToCart(flight) {
    if (!user) {
      navigate('/login');
      return;
    }

    setCartAddingId(flight.id);
    setCartNotice(null);

    try {
      const trimmedCoupon = couponFor(flight.id).trim();
      await addToCart({
        itemType: 'flight',
        itemId: flight.id,
        quantity: seatsFor(flight.id),
        details: trimmedCoupon ? { couponCode: trimmedCoupon } : {},
      });
      setCartNotice(`${flight.airline} ${flight.flight_number} added to your cart.`);
    } catch (err) {
      setCartNotice(err.response?.data?.error || 'Could not add this flight to your cart.');
    } finally {
      setCartAddingId(null);
    }
  }

  async function handleBook(flight) {
    if (!user) {
      navigate('/login');
      return;
    }

    setBookingId(flight.id);
    setBookingError(null);
    setBookingSuccess(null);

    try {
      const scriptReady = await loadRazorpayScript();
      if (!scriptReady) {
        setBookingError('Unable to load payment gateway. Check your connection and try again.');
        setBookingId(null);
        return;
      }

      const trimmedCoupon = couponFor(flight.id).trim();

      const { data } = await axiosClient.post('/payments/checkout', {
        flightId: flight.id,
        seats: seatsFor(flight.id),
        ...(trimmedCoupon ? { couponCode: trimmedCoupon } : {}),
      });

      const { booking, razorpayOrder, razorpayKeyId } = data;

      // Seats are already reserved server-side at this point (status: 'pending'),
      // so reflect the reduction immediately — don't wait for payment to complete.
      setResults((prev) =>
        prev.map((f) =>
          f.id === flight.id
            ? { ...f, available_seats: f.available_seats - seatsFor(flight.id) }
            : f
        )
      );

      const basePrice = flight.base_price * seatsFor(flight.id);
      const discountApplied = trimmedCoupon && Number(booking.total_price) < basePrice;

      const options = {
        key: razorpayKeyId,
        order_id: razorpayOrder.id,
        amount: razorpayOrder.amount,
        currency: razorpayOrder.currency,
        name: 'TravelSphere',
        description: `${flight.airline} ${flight.flight_number}`,
        prefill: {
          name: user.full_name,
          email: user.email,
        },
        theme: { color: '#e8572e' },
        handler: function () {
          // This fires the instant Razorpay confirms payment client-side.
          // The actual booking confirmation happens server-side via webhook —
          // this message just reflects that payment was accepted.
          const discountNote = discountApplied
            ? ` Coupon "${trimmedCoupon}" applied — you paid ₹${Number(booking.total_price).toLocaleString('en-IN')} instead of ₹${basePrice.toLocaleString('en-IN')}.`
            : '';
          setBookingSuccess(
            `Payment received for booking ${booking.id}.${discountNote} Confirming your seat — refresh in a few seconds to see it finalized.`
          );
        },
        modal: {
          ondismiss: function () {
            setBookingError(
              `Payment cancelled. Booking ${booking.id} is held as pending but not confirmed — it will be released automatically if unpaid.`
            );
          },
        },
      };

      const rzp = new window.Razorpay(options);
      rzp.on('payment.failed', function (response) {
        setBookingError(`Payment failed: ${response.error.description}`);
      });
      rzp.open();
    } catch (err) {
      const msg = err.response?.data?.error || 'Checkout failed. Please try again.';
      setBookingError(`${flight.flight_number}: ${msg}`);
    } finally {
      setBookingId(null);
    }
  }

  async function handleBookWithWallet(flight) {
    if (!user) {
      navigate('/login');
      return;
    }

    setWalletBookingId(flight.id);
    setBookingError(null);
    setBookingSuccess(null);

    try {
      const { data } = await axiosClient.post('/bookings/pay-with-wallet', {
        flightId: flight.id,
        seats: seatsFor(flight.id),
      });

      setResults((prev) =>
        prev.map((f) =>
          f.id === flight.id
            ? { ...f, available_seats: f.available_seats - seatsFor(flight.id) }
            : f
        )
      );

      setBookingSuccess(
        `Booking ${data.booking.id} confirmed and paid from your wallet. New wallet balance: ₹${Number(data.newBalance).toLocaleString('en-IN')}.`
      );
    } catch (err) {
      if (err.response?.status === 402) {
        const { balance, required } = err.response.data;
        setBookingError(
          `${flight.flight_number}: Insufficient wallet balance. You have ₹${Number(balance).toLocaleString('en-IN')}, need ₹${Number(required).toLocaleString('en-IN')}. Top up your wallet from your profile.`
        );
      } else {
        const msg = err.response?.data?.error || 'Wallet payment failed. Please try again.';
        setBookingError(`${flight.flight_number}: ${msg}`);
      }
    } finally {
      setWalletBookingId(null);
    }
  }

  return (
    <>
      <Navbar />

      {/* Hero + search */}
      <section className="ts-hero" style={{ minHeight: 'auto', height: 'auto' }}>
        <div className="ts-ticket-stripe" />
        <div className="container ts-hero-content" style={{ padding: '1.5rem 0 1.25rem' }}>
          <h2 className="ts-hero-headline" style={{ fontSize: 'clamp(1.4rem, 2.2vw, 1.9rem)', marginBottom: '0.3rem' }}>
            Search flights
          </h2>
          <p className="ts-hero-body mb-2" style={{ fontSize: '0.9rem' }}>
            Find and book flights across TravelSphere&apos;s network.
          </p>

          <form
            onSubmit={handleSearch}
            className="ts-panel p-3 row g-2 align-items-end"
            style={{ background: 'transparent', border: 'none' }}
          >
            <div className="col-md-3">
              <label className="ts-label" htmlFor="flight-origin">Origin</label>
              <input
                id="flight-origin"
                type="text"
                name="origin"
                className="ts-input"
                placeholder="Chennai"
                value={form.origin}
                onChange={handleChange}
              />
            </div>

            <div className="col-md-3">
              <label className="ts-label" htmlFor="flight-destination">Destination</label>
              <input
                id="flight-destination"
                type="text"
                name="destination"
                className="ts-input"
                placeholder="Bangalore"
                value={form.destination}
                onChange={handleChange}
              />
            </div>

            <div className="col-md-3">
              <label className="ts-label" htmlFor="flight-date">Date</label>
              <input
                id="flight-date"
                type="date"
                name="date"
                className="ts-input"
                value={form.date}
                onChange={handleChange}
              />
            </div>

            <div className="col-md-3">
              <button type="submit" className="ts-btn-primary" disabled={searching}>
                {searching ? 'Searching...' : 'Search flights'}
              </button>
            </div>
          </form>
        </div>
      </section>

      {/* Results */}
      <div className="ts-page-bg">
        <div className="container pt-3 pb-5">
          {searchError && <Notice tone="error">{searchError}</Notice>}
          {bookingSuccess && <Notice tone="success">{bookingSuccess}</Notice>}
          {bookingError && <Notice tone="error">{bookingError}</Notice>}
          {cartNotice && <Notice tone="info">{cartNotice}</Notice>}

          {!user && (
            <Notice tone="info">
              You can search freely — <a href="/login" className="ts-switch-link">log in</a> to book a flight.
            </Notice>
          )}

          {searched && (
            <div className="ts-section-title">
              {results.length > 0 ? 'Available flights' : 'No flights found'}
            </div>
          )}

          {searched && results.length === 0 && !searchError && (
            <div className="ts-empty-state">
              No flights found for that search. Try different dates or cities.
            </div>
          )}

          {results.length > 0 && (
            <div className="ts-panel ts-row-list">
              {results.map((flight) => {
                const isFull = flight.available_seats <= 0;
                const isBookingThis = bookingId === flight.id;
                const isWalletBookingThis = walletBookingId === flight.id;
                const isAddingToCart = cartAddingId === flight.id;

                return (
                  <div className="ts-row-item" key={flight.id}>
                    <div className="row align-items-center g-3">
                      <div className="col-md-3">
                        <h6 className="fw-bold mb-0" style={{ color: 'var(--ts-ink)' }}>
                          {flight.airline}
                        </h6>
                        <span className="text-muted small">{flight.flight_number}</span>
                      </div>

                      <div className="col-md-3">
                        <div className="d-flex align-items-center gap-2">
                          <div>
                            <div className="fw-semibold">{flight.origin}</div>
                            <div className="small text-muted">
                              {new Date(flight.departure_time).toLocaleString()}
                            </div>
                          </div>
                          <div className="text-muted">&rarr;</div>
                          <div>
                            <div className="fw-semibold">{flight.destination}</div>
                            <div className="small text-muted">
                              {new Date(flight.arrival_time).toLocaleString()}
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="col-md-2">
                        <div className="fw-bold" style={{ color: 'var(--ts-ink)' }}>
                          &#8377;{Number(flight.base_price).toLocaleString('en-IN')}
                        </div>
                        <div className="small text-muted">
                          {isFull ? (
                            <span style={{ color: 'var(--ts-danger-text)', fontWeight: 600 }}>Sold out</span>
                          ) : (
                            `${flight.available_seats} seats left`
                          )}
                        </div>
                      </div>

                      <div className="col-md-4">
                        <div className="d-flex gap-2 mb-2">
                          <select
                            className="ts-input"
                            style={{ maxWidth: 100 }}
                            value={seatsFor(flight.id)}
                            onChange={(e) => setSeatsFor(flight.id, Number(e.target.value))}
                            disabled={isFull}
                          >
                            {[1, 2, 3, 4].map((n) => (
                              <option key={n} value={n}>
                                {n} seat{n > 1 ? 's' : ''}
                              </option>
                            ))}
                          </select>

                          <button
                            className="ts-btn-primary"
                            disabled={isFull || isBookingThis}
                            onClick={() => handleBook(flight)}
                          >
                            {isBookingThis ? 'Processing...' : isFull ? 'Sold out' : 'Book'}
                          </button>
                        </div>

                        {!isFull && (
                          <button
                            className="ts-btn-outline-neutral w-100 mb-2"
                            disabled={isBookingThis || isWalletBookingThis}
                            onClick={() => handleBookWithWallet(flight)}
                          >
                            {isWalletBookingThis ? 'Paying from wallet...' : 'Pay with wallet'}
                          </button>
                        )}

                        {!isFull && (
                          <button
                            className="ts-btn-outline-neutral w-100 mb-2"
                            disabled={isAddingToCart}
                            onClick={() => handleAddToCart(flight)}
                          >
                            {isAddingToCart ? 'Adding...' : 'Add to cart'}
                          </button>
                        )}

                        {!isFull && (
                          <input
                            type="text"
                            className="ts-input"
                            placeholder="Coupon code (optional)"
                            value={couponFor(flight.id)}
                            onChange={(e) => setCouponFor(flight.id, e.target.value.toUpperCase())}
                            disabled={isBookingThis}
                          />
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </>
  );
}