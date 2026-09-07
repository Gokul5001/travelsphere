import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axiosClient from '../api/axiosClient';
import { getCart, removeFromCart } from '../api/cartApi';
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

// Maps each cart item's type to the checkout endpoint your search pages
// already use, and builds the request body that endpoint expects.
// NOTE: the 'package' entries assume /payments/packages/checkout and
// /packages/pay-with-wallet exist with this shape — adjust if your actual
// package payment routes differ.
function buildCheckoutRequest(cartItem) {
  const { item_type, item_id, quantity, details } = cartItem;
  const couponCode = details?.couponCode?.trim();

  if (item_type === 'flight') {
    return {
      endpoint: '/payments/checkout',
      walletEndpoint: '/bookings/pay-with-wallet',
      payload: { flightId: item_id, seats: quantity, ...(couponCode ? { couponCode } : {}) },
      walletPayload: { flightId: item_id, seats: quantity },
    };
  }
  if (item_type === 'hotel') {
    return {
      endpoint: '/payments/hotels/checkout',
      walletEndpoint: '/hotels/pay-with-wallet',
      payload: {
        hotelId: item_id,
        checkIn: details?.checkIn,
        checkOut: details?.checkOut,
        rooms: quantity,
        ...(couponCode ? { couponCode } : {}),
      },
      walletPayload: { hotelId: item_id, checkIn: details?.checkIn, checkOut: details?.checkOut, rooms: quantity },
    };
  }
  if (item_type === 'bus') {
    return {
      endpoint: '/payments/buses/checkout',
      walletEndpoint: '/buses/pay-with-wallet',
      payload: { busId: item_id, seats: quantity, ...(couponCode ? { couponCode } : {}) },
      walletPayload: { busId: item_id, seats: quantity },
    };
  }
  // package
  return {
    endpoint: '/payments/packages/checkout',
    walletEndpoint: '/packages/pay-with-wallet',
    payload: { packageId: item_id, quantity, ...(couponCode ? { couponCode } : {}) },
    walletPayload: { packageId: item_id, quantity },
  };
}

function itemLabel(cartItem) {
  const { item_type, item } = cartItem;
  if (!item) return 'Item no longer available';
  if (item_type === 'flight') return `${item.airline} ${item.flight_number}`;
  if (item_type === 'hotel') return item.name;
  if (item_type === 'bus') return `${item.operator} ${item.bus_number}`;
  return item.name || 'Package';
}

function itemPrice(cartItem) {
  const { item_type, item, quantity } = cartItem;
  if (!item) return null;
  if (item_type === 'flight') return item.base_price * quantity;
  if (item_type === 'hotel') return item.price_per_night * quantity;
  if (item_type === 'bus') return item.seat_price * quantity;
  return item.price ? item.price * quantity : null;
}

export default function CartPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);

  const [removingId, setRemovingId] = useState(null);
  const [checkoutId, setCheckoutId] = useState(null);
  const [walletCheckoutId, setWalletCheckoutId] = useState(null);
  const [checkoutError, setCheckoutError] = useState(null);
  const [checkoutSuccess, setCheckoutSuccess] = useState(null);

  async function loadCart() {
    setLoading(true);
    setLoadError(null);
    try {
      const { data } = await getCart();
      setItems(data.items);
    } catch (err) {
      setLoadError(err.response?.data?.error || 'Could not load your cart.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadCart();
  }, []);

  async function handleRemove(cartItem) {
    setRemovingId(cartItem.id);
    try {
      await removeFromCart(cartItem.id);
      setItems((prev) => prev.filter((ci) => ci.id !== cartItem.id));
    } catch (err) {
      setCheckoutError(err.response?.data?.error || 'Could not remove item from cart.');
    } finally {
      setRemovingId(null);
    }
  }

  async function handleCheckout(cartItem) {
    setCheckoutId(cartItem.id);
    setCheckoutError(null);
    setCheckoutSuccess(null);

    const { endpoint, payload } = buildCheckoutRequest(cartItem);
    const label = itemLabel(cartItem);

    try {
      const scriptReady = await loadRazorpayScript();
      if (!scriptReady) {
        setCheckoutError('Unable to load payment gateway. Check your connection and try again.');
        return;
      }

      const { data } = await axiosClient.post(endpoint, payload);
      const { booking, razorpayOrder, razorpayKeyId } = data;

      const options = {
        key: razorpayKeyId,
        order_id: razorpayOrder.id,
        amount: razorpayOrder.amount,
        currency: razorpayOrder.currency,
        name: 'TravelSphere',
        description: label,
        prefill: { name: user.full_name, email: user.email },
        theme: { color: '#e8572e' },
        handler: async function () {
          setCheckoutSuccess(
            `Payment received for booking ${booking.id}. Confirming — check your profile in a few seconds to see it finalized.`
          );
          try {
            await removeFromCart(cartItem.id);
            setItems((prev) => prev.filter((ci) => ci.id !== cartItem.id));
          } catch {
            // Payment already succeeded — a leftover cart row isn't worth surfacing an error for.
          }
        },
        modal: {
          ondismiss: function () {
            setCheckoutError(`Payment cancelled for ${label}. It's still in your cart.`);
          },
        },
      };

      const rzp = new window.Razorpay(options);
      rzp.on('payment.failed', function (response) {
        setCheckoutError(`Payment failed for ${label}: ${response.error.description}`);
      });
      rzp.open();
    } catch (err) {
      setCheckoutError(err.response?.data?.error || `Checkout failed for ${label}. Please try again.`);
    } finally {
      setCheckoutId(null);
    }
  }

  async function handleWalletCheckout(cartItem) {
    setWalletCheckoutId(cartItem.id);
    setCheckoutError(null);
    setCheckoutSuccess(null);

    const { walletEndpoint, walletPayload } = buildCheckoutRequest(cartItem);
    const label = itemLabel(cartItem);

    try {
      const { data } = await axiosClient.post(walletEndpoint, walletPayload);
      setCheckoutSuccess(
        `${label} booked and paid from your wallet. New wallet balance: ₹${Number(data.newBalance).toLocaleString('en-IN')}.`
      );
      await removeFromCart(cartItem.id);
      setItems((prev) => prev.filter((ci) => ci.id !== cartItem.id));
    } catch (err) {
      if (err.response?.status === 402) {
        const { balance, required } = err.response.data;
        setCheckoutError(
          `${label}: Insufficient wallet balance. You have ₹${Number(balance).toLocaleString('en-IN')}, need ₹${Number(required).toLocaleString('en-IN')}. Top up your wallet from your profile.`
        );
      } else {
        setCheckoutError(err.response?.data?.error || `Wallet payment failed for ${label}. Please try again.`);
      }
    } finally {
      setWalletCheckoutId(null);
    }
  }

  if (!user) {
    navigate('/login');
    return null;
  }

  return (
    <>
      <Navbar />

      <div className="ts-page-bg">
        <div className="container py-5">
          <div className="ts-section-title">Your cart</div>

          {loading && <p className="text-muted">Loading your cart...</p>}
          {loadError && <div className="ts-alert-error">{loadError}</div>}
          {checkoutError && <div className="ts-alert-error">{checkoutError}</div>}
          {checkoutSuccess && <div className="ts-alert-success">{checkoutSuccess}</div>}

          {!loading && !loadError && items.length === 0 && (
            <div className="ts-empty-state">
              Your cart is empty. Search{' '}
              <a href="/flights" className="ts-switch-link">flights</a>,{' '}
              <a href="/hotels" className="ts-switch-link">hotels</a>,{' '}
              <a href="/buses" className="ts-switch-link">buses</a>, or{' '}
              <a href="/packages" className="ts-switch-link">packages</a> to add something.
            </div>
          )}

          {items.length > 0 && (
            <div className="ts-panel ts-row-list">
              {items.map((cartItem) => {
                const isCheckingOut = checkoutId === cartItem.id;
                const isWalletCheckingOut = walletCheckoutId === cartItem.id;
                const isRemoving = removingId === cartItem.id;
                const price = itemPrice(cartItem);
                const unavailable = !cartItem.item;

                return (
                  <div className="ts-row-item" key={cartItem.id}>
                    <div className="row align-items-center g-3">
                      <div className="col-md-3">
                        <span className="badge ts-badge-role mb-1 text-capitalize">{cartItem.item_type}</span>
                        <h6 className="fw-bold mb-0">{itemLabel(cartItem)}</h6>
                        {cartItem.item_type === 'hotel' && cartItem.details?.checkIn && (
                          <div className="small text-muted">
                            {new Date(cartItem.details.checkIn).toLocaleDateString()} &rarr;{' '}
                            {new Date(cartItem.details.checkOut).toLocaleDateString()}
                          </div>
                        )}
                      </div>

                      <div className="col-md-2">
                        <div className="small text-muted">
                          {cartItem.item_type === 'hotel' ? 'Rooms' : cartItem.item_type === 'package' ? 'Qty' : 'Seats'}
                        </div>
                        <div className="fw-semibold">{cartItem.quantity}</div>
                      </div>

                      <div className="col-md-2">
                        <div className="fw-bold" style={{ color: 'var(--ts-ink)' }}>
                          {price != null ? `₹${Number(price).toLocaleString('en-IN')}` : '—'}
                        </div>
                      </div>

                      <div className="col-md-3">
                        {unavailable ? (
                          <div className="small" style={{ color: 'var(--ts-danger-text)' }}>
                            No longer available
                          </div>
                        ) : (
                          <>
                            <button
                              className="ts-btn-primary mb-2"
                              disabled={isCheckingOut}
                              onClick={() => handleCheckout(cartItem)}
                            >
                              {isCheckingOut ? 'Processing...' : 'Checkout'}
                            </button>
                            <button
                              className="ts-btn-outline-neutral w-100"
                              disabled={isWalletCheckingOut}
                              onClick={() => handleWalletCheckout(cartItem)}
                            >
                              {isWalletCheckingOut ? 'Paying from wallet...' : 'Pay with wallet'}
                            </button>
                          </>
                        )}
                      </div>

                      <div className="col-md-2 text-md-end">
                        <button
                          className="ts-btn-outline-cancel"
                          disabled={isRemoving}
                          onClick={() => handleRemove(cartItem)}
                        >
                          {isRemoving ? 'Removing...' : 'Remove'}
                        </button>
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
