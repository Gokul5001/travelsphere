//hotelsearch.jsx

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axiosClient from '../api/axiosClient';
import { useAuth } from '../context/AuthContext';
import Navbar from '../components/Navbar';
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

function nightsBetween(checkIn, checkOut) {
  if (!checkIn || !checkOut) return 1;
  const ms = new Date(checkOut) - new Date(checkIn);
  return Math.max(1, Math.round(ms / (1000 * 60 * 60 * 24)));
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

export default function HotelSearch() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState({ city: '', checkIn: '', checkOut: '' });
  const [results, setResults] = useState([]);
  const [searched, setSearched] = useState(false);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState(null);

  const [roomsById, setRoomsById] = useState({});
  const [couponById, setCouponById] = useState({});
  const [bookingId, setBookingId] = useState(null);
  const [walletBookingId, setWalletBookingId] = useState(null);
  const [bookingError, setBookingError] = useState(null);
  const [bookingSuccess, setBookingSuccess] = useState(null);

  function handleChange(e) {
    setForm({ ...form, [e.target.name]: e.target.value });
  }

  const roomsFor = (id) => roomsById[id] ?? 1;
  const setRoomsFor = (id, v) => setRoomsById({ ...roomsById, [id]: v });
  const couponFor = (id) => couponById[id] ?? '';
  const setCouponFor = (id, v) => setCouponById({ ...couponById, [id]: v });

  async function handleSearch(e) {
    e.preventDefault();
    setSearching(true);
    setSearchError(null);
    setBookingSuccess(null);
    setBookingError(null);

    try {
      const params = {};
      if (form.city) params.city = form.city;

      const { data } = await axiosClient.get('/hotels/search', { params });
      setResults(data.results);
      setSearched(true);
    } catch (err) {
      setSearchError(err.response?.data?.error || 'Search failed. Please try again.');
    } finally {
      setSearching(false);
    }
  }

  async function handleBook(hotel) {
    if (!user) {
      navigate('/login');
      return;
    }
    if (!form.checkIn || !form.checkOut) {
      setBookingError('Please select check-in and check-out dates before booking.');
      return;
    }

    setBookingId(hotel.id);
    setBookingError(null);
    setBookingSuccess(null);

    try {
      const scriptReady = await loadRazorpayScript();
      if (!scriptReady) {
        setBookingError('Unable to load payment gateway. Check your connection and try again.');
        setBookingId(null);
        return;
      }

      const trimmedCoupon = couponFor(hotel.id).trim();

      const { data } = await axiosClient.post('/payments/hotels/checkout', {
        hotelId: hotel.id,
        checkIn: form.checkIn,
        checkOut: form.checkOut,
        rooms: roomsFor(hotel.id),
        ...(trimmedCoupon ? { couponCode: trimmedCoupon } : {}),
      });

      const { booking, razorpayOrder, razorpayKeyId } = data;

      setResults((prev) =>
        prev.map((h) =>
          h.id === hotel.id ? { ...h, available_rooms: h.available_rooms - roomsFor(hotel.id) } : h
        )
      );

      const nights = nightsBetween(form.checkIn, form.checkOut);
      const basePrice = hotel.price_per_night * roomsFor(hotel.id) * nights;
      const discountApplied = trimmedCoupon && Number(booking.total_price) < basePrice;

      const options = {
        key: razorpayKeyId,
        order_id: razorpayOrder.id,
        amount: razorpayOrder.amount,
        currency: razorpayOrder.currency,
        name: 'TravelSphere',
        description: `${hotel.name}, ${hotel.city}`,
        prefill: { name: user.full_name, email: user.email },
        theme: { color: '#e8572e' },
        handler: function () {
          const discountNote = discountApplied
            ? ` Coupon "${trimmedCoupon}" applied — you paid ₹${Number(booking.total_price).toLocaleString('en-IN')} instead of ₹${basePrice.toLocaleString('en-IN')}.`
            : '';
          setBookingSuccess(
            `Payment received for booking ${booking.id}.${discountNote} Confirming your reservation — refresh in a few seconds to see it finalized.`
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
      setBookingError(`${hotel.name}: ${msg}`);
    } finally {
      setBookingId(null);
    }
  }

  async function handleBookWithWallet(hotel) {
    if (!user) {
      navigate('/login');
      return;
    }
    if (!form.checkIn || !form.checkOut) {
      setBookingError('Please select check-in and check-out dates before booking.');
      return;
    }

    setWalletBookingId(hotel.id);
    setBookingError(null);
    setBookingSuccess(null);

    try {
      const { data } = await axiosClient.post('/hotels/pay-with-wallet', {
        hotelId: hotel.id,
        checkIn: form.checkIn,
        checkOut: form.checkOut,
        rooms: roomsFor(hotel.id),
      });

      setResults((prev) =>
        prev.map((h) =>
          h.id === hotel.id ? { ...h, available_rooms: h.available_rooms - roomsFor(hotel.id) } : h
        )
      );

      setBookingSuccess(
        `Booking ${data.booking.id} confirmed and paid from your wallet. New wallet balance: ₹${Number(data.newBalance).toLocaleString('en-IN')}.`
      );
    } catch (err) {
      if (err.response?.status === 402) {
        const { balance, required } = err.response.data;
        setBookingError(
          `${hotel.name}: Insufficient wallet balance. You have ₹${Number(balance).toLocaleString('en-IN')}, need ₹${Number(required).toLocaleString('en-IN')}. Top up your wallet from your profile.`
        );
      } else {
        const msg = err.response?.data?.error || 'Wallet payment failed. Please try again.';
        setBookingError(`${hotel.name}: ${msg}`);
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
            Search hotels
          </h2>
          <p className="ts-hero-body mb-2" style={{ fontSize: '0.9rem' }}>
            Find and book hotels across TravelSphere&apos;s network.
          </p>

          <form
            onSubmit={handleSearch}
            className="ts-panel p-3 row g-2 align-items-end"
            style={{ background: 'transparent', border: 'none' }}
          >
            <div className="col-md-4">
              <label className="ts-label" htmlFor="hotel-city">City</label>
              <input
                id="hotel-city"
                type="text"
                name="city"
                className="ts-input"
                placeholder="Chennai"
                value={form.city}
                onChange={handleChange}
              />
            </div>
            <div className="col-md-3">
              <label className="ts-label" htmlFor="hotel-checkin">Check-in</label>
              <input
                id="hotel-checkin"
                type="date"
                name="checkIn"
                className="ts-input"
                value={form.checkIn}
                onChange={handleChange}
              />
            </div>
            <div className="col-md-3">
              <label className="ts-label" htmlFor="hotel-checkout">Check-out</label>
              <input
                id="hotel-checkout"
                type="date"
                name="checkOut"
                className="ts-input"
                value={form.checkOut}
                onChange={handleChange}
              />
            </div>
            <div className="col-md-2">
              <button type="submit" className="ts-btn-primary" disabled={searching}>
                {searching ? 'Searching...' : 'Search'}
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

          {!user && (
            <Notice tone="info">
              You can search freely — <a href="/login" className="ts-switch-link">log in</a> to book a hotel.
            </Notice>
          )}

          {searched && (
            <div className="ts-section-title">
              {results.length > 0 ? 'Available hotels' : 'No hotels found'}
            </div>
          )}

          {searched && results.length === 0 && !searchError && (
            <div className="ts-empty-state">No hotels found. Try a different city.</div>
          )}

          {results.length > 0 && (
            <div className="ts-panel ts-row-list">
              {results.map((hotel) => {
                const isFull = hotel.available_rooms <= 0;
                const isBookingThis = bookingId === hotel.id;
                const isWalletBookingThis = walletBookingId === hotel.id;
                const nights = nightsBetween(form.checkIn, form.checkOut);

                return (
                  <div className="ts-row-item" key={hotel.id}>
                    <div className="row align-items-center g-3">
                      <div className="col-md-3">
                        <h6 className="fw-bold mb-0" style={{ color: 'var(--ts-ink)' }}>
                          {hotel.name}
                        </h6>
                        <span className="text-muted small">
                          {hotel.city}
                          {hotel.rating ? ` · ★ ${hotel.rating}` : ''}
                        </span>
                      </div>

                      <div className="col-md-3">
                        <div className="small text-muted">{hotel.address}</div>
                        <div className="small text-muted">
                          {nights} night{nights > 1 ? 's' : ''}
                        </div>
                      </div>

                      <div className="col-md-2">
                        <div className="fw-bold" style={{ color: 'var(--ts-ink)' }}>
                          &#8377;{Number(hotel.price_per_night).toLocaleString('en-IN')}/night
                        </div>
                        <div className="small text-muted">
                          {isFull ? (
                            <span style={{ color: 'var(--ts-danger-text)', fontWeight: 600 }}>Sold out</span>
                          ) : (
                            `${hotel.available_rooms} rooms left`
                          )}
                        </div>
                      </div>

                      <div className="col-md-4">
                        <div className="d-flex gap-2 mb-2">
                          <select
                            className="ts-input"
                            style={{ maxWidth: 100 }}
                            value={roomsFor(hotel.id)}
                            onChange={(e) => setRoomsFor(hotel.id, Number(e.target.value))}
                            disabled={isFull}
                          >
                            {[1, 2, 3, 4].map((n) => (
                              <option key={n} value={n}>
                                {n} room{n > 1 ? 's' : ''}
                              </option>
                            ))}
                          </select>

                          <button
                            className="ts-btn-primary"
                            disabled={isFull || isBookingThis || isWalletBookingThis}
                            onClick={() => handleBook(hotel)}
                          >
                            {isBookingThis ? 'Processing...' : isFull ? 'Sold out' : 'Book'}
                          </button>
                        </div>

                        {!isFull && (
                          <button
                            className="ts-btn-outline-neutral w-100 mb-2"
                            disabled={isBookingThis || isWalletBookingThis}
                            onClick={() => handleBookWithWallet(hotel)}
                          >
                            {isWalletBookingThis ? 'Paying from wallet...' : 'Pay with wallet'}
                          </button>
                        )}

                        {!isFull && (
                          <input
                            type="text"
                            className="ts-input"
                            placeholder="Coupon code (optional)"
                            value={couponFor(hotel.id)}
                            onChange={(e) => setCouponFor(hotel.id, e.target.value.toUpperCase())}
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