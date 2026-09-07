// AdminDashboard.jsx
import { useState, useEffect, useCallback } from 'react';
import Navbar from '../Components/Navbar';
import { getAdminStats, getAdminBookings } from '../api/adminApi';
import '../styles/travelsphere-theme.css';

const STATUS_STYLES = {
  confirmed: { bg: 'var(--ts-success-bg)', color: 'var(--ts-success-text)', label: 'Confirmed' },
  pending: { bg: 'var(--ts-warning-bg)', color: 'var(--ts-warning-text)', label: 'Pending' },
  expired: { bg: 'var(--ts-neutral-bg)', color: 'var(--ts-neutral-text)', label: 'Expired' },
  cancelled: { bg: 'var(--ts-danger-bg)', color: 'var(--ts-danger-text)', label: 'Cancelled' },
};

const ITEM_TYPES = ['flight', 'hotel', 'bus', 'package'];
const STATUSES = ['pending', 'confirmed', 'cancelled', 'expired'];
const PAGE_SIZE = 25;

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

function StatCard({ label, value, accent }) {
  return (
    <div className="ts-panel p-4" style={{ minWidth: 180 }}>
      <div className="small text-muted mb-1">{label}</div>
      <div className="fw-bold" style={{ fontSize: '1.6rem', color: accent ? 'var(--ts-ink)' : undefined }}>
        {value}
      </div>
    </div>
  );
}

function Overview() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const { data } = await getAdminStats();
        setStats(data);
      } catch (err) {
        setError(err.response?.data?.error || 'Could not load dashboard stats.');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) return <p className="text-muted">Loading stats...</p>;
  if (error) return <div className="ts-alert-error">{error}</div>;
  if (!stats) return null;

  return (
    <>
      <div className="d-flex flex-wrap gap-3 mb-4">
        <StatCard label="Total users" value={stats.totalUsers} />
        <StatCard label="Total bookings" value={stats.totalBookings} />
        <StatCard label="Total revenue" value={`₹${Number(stats.totalRevenue).toLocaleString('en-IN')}`} />
        <StatCard label="Pending visa applications" value={stats.pendingVisaApplications} />
        <StatCard label="Failed refunds" value={stats.failedRefunds} />
        <StatCard label="Wallet liability" value={`₹${Number(stats.totalWalletLiability).toLocaleString('en-IN')}`} />
      </div>

      <div className="ts-section-title">Bookings by type</div>
      <div className="ts-panel ts-row-list">
        {ITEM_TYPES.map((type) => (
          <div className="ts-row-item d-flex justify-content-between align-items-center" key={type}>
            <span className="text-capitalize fw-semibold">{type}</span>
            <span className="fw-bold">{stats.bookingsByType[type] ?? 0}</span>
          </div>
        ))}
      </div>
    </>
  );
}

function BookingsTab() {
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [itemType, setItemType] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await getAdminBookings({
        itemType: itemType || undefined,
        status: status || undefined,
        limit: PAGE_SIZE,
        offset: page * PAGE_SIZE,
      });
      setRows(data.rows);
      setTotal(data.total);
    } catch (err) {
      setError(err.response?.data?.error || 'Could not load bookings.');
    } finally {
      setLoading(false);
    }
  }, [itemType, status, page]);

  useEffect(() => { load(); }, [load]);

  function handleFilterChange(setter) {
    return (e) => {
      setter(e.target.value);
      setPage(0);
    };
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <>
      <div className="d-flex flex-wrap gap-2 mb-3">
        <select className="ts-input" style={{ maxWidth: 160 }} value={itemType} onChange={handleFilterChange(setItemType)}>
          <option value="">All types</option>
          {ITEM_TYPES.map((t) => (
            <option key={t} value={t} className="text-capitalize">{t}</option>
          ))}
        </select>
        <select className="ts-input" style={{ maxWidth: 160 }} value={status} onChange={handleFilterChange(setStatus)}>
          <option value="">All statuses</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </div>

      {error && <div className="ts-alert-error">{error}</div>}
      {loading && <p className="text-muted">Loading bookings...</p>}

      {!loading && !error && rows.length === 0 && (
        <div className="ts-empty-state">No bookings match these filters.</div>
      )}

      {rows.length > 0 && (
        <div className="ts-panel ts-row-list">
          {rows.map((b) => (
            <div className="ts-row-item" key={`${b.item_type}-${b.id}`}>
              <div className="row align-items-center g-3">
                <div className="col-md-2">
                  <span className="badge ts-badge-role text-capitalize">{b.item_type}</span>
                </div>
                <div className="col-md-3">
                  <h6 className="fw-bold mb-0">{b.item_label}</h6>
                  <span className="small text-muted">Qty {b.quantity}</span>
                </div>
                <div className="col-md-3">
                  <div className="fw-semibold">{b.user_name}</div>
                  <div className="small text-muted">{b.user_email}</div>
                </div>
                <div className="col-md-2">
                  <div className="fw-bold" style={{ color: 'var(--ts-ink)' }}>
                    ₹{Number(b.total_price).toLocaleString('en-IN')}
                  </div>
                  <div className="small text-muted">
                    {new Date(b.created_at).toLocaleDateString()}
                  </div>
                </div>
                <div className="col-md-2 text-md-end">
                  <StatusBadge status={b.status} />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {total > PAGE_SIZE && (
        <div className="d-flex justify-content-between align-items-center mt-3">
          <button
            className="ts-btn-outline-neutral"
            disabled={page === 0}
            onClick={() => setPage((p) => Math.max(0, p - 1))}
          >
            Previous
          </button>
          <span className="small text-muted">
            Page {page + 1} of {totalPages}
          </span>
          <button
            className="ts-btn-outline-neutral"
            disabled={page + 1 >= totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </button>
        </div>
      )}
    </>
  );
}

export default function AdminDashboard() {
  const [tab, setTab] = useState('overview');

  return (
    <>
      <Navbar />
      <div className="ts-page-bg">
        <div className="container py-5">
          <div className="ts-section-title">Admin dashboard</div>

          <ul className="nav mb-4" style={{ borderBottom: '1px solid var(--ts-border, #e5e5e5)' }}>
            {['overview', 'bookings'].map((t) => (
              <li className="nav-item" key={t}>
                <button
                  className="nav-link text-capitalize"
                  style={{
                    color: tab === t ? 'var(--ts-ink)' : 'var(--ts-neutral-text, #888)',
                    fontWeight: tab === t ? 700 : 500,
                    borderBottom: tab === t ? '2px solid var(--ts-ink)' : '2px solid transparent',
                    background: 'none',
                  }}
                  onClick={() => setTab(t)}
                >
                  {t}
                </button>
              </li>
            ))}
          </ul>

          {tab === 'overview' && <Overview />}
          {tab === 'bookings' && <BookingsTab />}
        </div>
      </div>
    </>
  );
}