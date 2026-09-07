// Components/VisaSection.jsx

import { useState, useEffect } from 'react';
import axiosClient from '../api/axiosClient';

const VISA_STATUS_STYLES = {
  submitted: { bg: 'var(--ts-neutral-bg)', color: 'var(--ts-neutral-text)', label: 'Submitted' },
  under_review: { bg: 'var(--ts-warning-bg)', color: 'var(--ts-warning-text)', label: 'Under review' },
  additional_info_needed: { bg: 'var(--ts-warning-bg)', color: 'var(--ts-warning-text)', label: 'Info needed' },
  approved: { bg: 'var(--ts-success-bg)', color: 'var(--ts-success-text)', label: 'Approved' },
  rejected: { bg: 'var(--ts-danger-bg)', color: 'var(--ts-danger-text)', label: 'Rejected' },
};

const DOC_STATUS_STYLES = {
  uploaded: { color: 'var(--ts-neutral-text)', label: 'Uploaded' },
  verified: { color: 'var(--ts-success-text)', label: 'Verified' },
  rejected: { color: 'var(--ts-danger-text)', label: 'Rejected' },
};

const DOCUMENT_TYPES = [
  { value: 'passport_copy', label: 'Passport copy' },
  { value: 'photo', label: 'Passport photo' },
  { value: 'bank_statement', label: 'Bank statement' },
  { value: 'itinerary', label: 'Travel itinerary' },
  { value: 'invitation_letter', label: 'Invitation letter' },
  { value: 'other', label: 'Other' },
];

const EMPTY_FORM = {
  destination_country: '',
  visa_type: 'tourist',
  passport_number: '',
  passport_expiry: '',
  travel_date: '',
  return_date: '',
};

function VisaStatusBadge({ status }) {
  const style = VISA_STATUS_STYLES[status] || VISA_STATUS_STYLES.submitted;
  return (
    <span
      className="badge rounded-pill fw-semibold px-3 py-2"
      style={{ backgroundColor: style.bg, color: style.color }}
    >
      {style.label}
    </span>
  );
}

export default function VisaSection() {
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);

  // documents keyed by application id
  const [documentsByApp, setDocumentsByApp] = useState({});
  const [docLoadingByApp, setDocLoadingByApp] = useState({});

  const [docTypeByApp, setDocTypeByApp] = useState({});
  const [fileByApp, setFileByApp] = useState({});
  const [uploadingAppId, setUploadingAppId] = useState(null);
  const [uploadErrorByApp, setUploadErrorByApp] = useState({});
  const [deletingDocId, setDeletingDocId] = useState(null);

  async function loadDocuments(applicationId) {
    setDocLoadingByApp((prev) => ({ ...prev, [applicationId]: true }));
    try {
      const { data } = await axiosClient.get(`/visa/applications/${applicationId}/documents`);
      setDocumentsByApp((prev) => ({ ...prev, [applicationId]: data.documents }));
    } catch {
      // document list is secondary to the application itself — fail quietly
    } finally {
      setDocLoadingByApp((prev) => ({ ...prev, [applicationId]: false }));
    }
  }

  async function loadApplications() {
    setLoading(true);
    setError(null);
    try {
      const { data } = await axiosClient.get('/visa/applications');
      setApplications(data.applications);
      data.applications.forEach((app) => loadDocuments(app.id));
    } catch (err) {
      setError(err.response?.data?.error || 'Could not load your visa applications.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadApplications();
  }, []);

  function handleFormChange(e) {
    setForm({ ...form, [e.target.name]: e.target.value });
  }

  async function handleSubmitApplication(e) {
    e.preventDefault();
    setSubmitError(null);

    if (!form.destination_country || !form.passport_number || !form.passport_expiry || !form.travel_date) {
      setSubmitError('Please fill in destination, passport number, passport expiry, and travel date.');
      return;
    }

    setSubmitting(true);
    try {
      const { data } = await axiosClient.post('/visa/applications', {
        destinationCountry: form.destination_country,
        visaType: form.visa_type,
        passportNumber: form.passport_number,
        passportExpiry: form.passport_expiry,
        travelDate: form.travel_date,
        returnDate: form.return_date || null,
      });
      setApplications((prev) => [data.application, ...prev]);
      setForm(EMPTY_FORM);
      setShowForm(false);
    } catch (err) {
      setSubmitError(err.response?.data?.error || 'Could not submit your application. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  const docTypeFor = (appId) => docTypeByApp[appId] ?? DOCUMENT_TYPES[0].value;
  const setDocTypeFor = (appId, v) => setDocTypeByApp((prev) => ({ ...prev, [appId]: v }));
  const fileFor = (appId) => fileByApp[appId] ?? null;
  const setFileFor = (appId, f) => setFileByApp((prev) => ({ ...prev, [appId]: f }));

  async function handleUploadDocument(applicationId) {
    const file = fileFor(applicationId);
    if (!file) {
      setUploadErrorByApp((prev) => ({ ...prev, [applicationId]: 'Choose a file first.' }));
      return;
    }

    setUploadingAppId(applicationId);
    setUploadErrorByApp((prev) => ({ ...prev, [applicationId]: null }));

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('documentType', docTypeFor(applicationId));

      const { data } = await axiosClient.post(
        `/visa/applications/${applicationId}/documents`,
        formData,
        { headers: { 'Content-Type': 'multipart/form-data' } }
      );

      setDocumentsByApp((prev) => ({
        ...prev,
        [applicationId]: [data.document, ...(prev[applicationId] || [])],
      }));
      setFileFor(applicationId, null);
    } catch (err) {
      setUploadErrorByApp((prev) => ({
        ...prev,
        [applicationId]: err.response?.data?.error || 'Upload failed. Please try again.',
      }));
    } finally {
      setUploadingAppId(null);
    }
  }

  async function handleViewDocument(doc) {
    try {
      const { data } = await axiosClient.get(`/visa/documents/${doc.id}/download`);
      window.open(data.url, '_blank', 'noopener,noreferrer');
    } catch (err) {
      alert(err.response?.data?.error || 'Could not open this document.');
    }
  }

  async function handleDeleteDocument(applicationId, docId) {
    const confirmed = window.confirm('Remove this document?');
    if (!confirmed) return;

    setDeletingDocId(docId);
    try {
      await axiosClient.delete(`/visa/documents/${docId}`);
      setDocumentsByApp((prev) => ({
        ...prev,
        [applicationId]: (prev[applicationId] || []).filter((d) => d.id !== docId),
      }));
    } catch (err) {
      alert(err.response?.data?.error || 'Could not remove this document.');
    } finally {
      setDeletingDocId(null);
    }
  }

  return (
    <>
      <div className="d-flex align-items-center justify-content-between">
        <div className="ts-section-title mb-0">Visa applications</div>
        <button className="ts-btn-outline-neutral mb-3" onClick={() => setShowForm((s) => !s)}>
          {showForm ? 'Cancel' : 'New application'}
        </button>
      </div>

      {showForm && (
        <div className="ts-panel p-4 mb-4">
          <form onSubmit={handleSubmitApplication}>
            <div className="row g-3">
              <div className="col-md-4">
                <label className="ts-label">Destination country</label>
                <input
                  type="text"
                  name="destination_country"
                  className="ts-input"
                  placeholder="e.g. Japan"
                  value={form.destination_country}
                  onChange={handleFormChange}
                />
              </div>
              <div className="col-md-4">
                <label className="ts-label">Visa type</label>
                <select name="visa_type" className="ts-input" value={form.visa_type} onChange={handleFormChange}>
                  <option value="tourist">Tourist</option>
                  <option value="business">Business</option>
                  <option value="student">Student</option>
                  <option value="transit">Transit</option>
                </select>
              </div>
              <div className="col-md-4">
                <label className="ts-label">Passport number</label>
                <input
                  type="text"
                  name="passport_number"
                  className="ts-input"
                  value={form.passport_number}
                  onChange={handleFormChange}
                />
              </div>
              <div className="col-md-4">
                <label className="ts-label">Passport expiry</label>
                <input
                  type="date"
                  name="passport_expiry"
                  className="ts-input"
                  value={form.passport_expiry}
                  onChange={handleFormChange}
                />
              </div>
              <div className="col-md-4">
                <label className="ts-label">Travel date</label>
                <input
                  type="date"
                  name="travel_date"
                  className="ts-input"
                  value={form.travel_date}
                  onChange={handleFormChange}
                />
              </div>
              <div className="col-md-4">
                <label className="ts-label">Return date (optional)</label>
                <input
                  type="date"
                  name="return_date"
                  className="ts-input"
                  value={form.return_date}
                  onChange={handleFormChange}
                />
              </div>
            </div>

            {submitError && (
              <div className="small mt-3" style={{ color: 'var(--ts-danger-text)' }}>{submitError}</div>
            )}

            <button type="submit" className="ts-btn-primary mt-3" disabled={submitting}>
              {submitting ? 'Submitting...' : 'Submit application'}
            </button>
          </form>
        </div>
      )}

      {loading && <p className="text-muted">Loading your visa applications...</p>}
      {error && <div className="ts-alert-error">{error}</div>}

      {!loading && !error && applications.length === 0 && (
        <div className="ts-empty-state mb-5">
          No visa applications yet. Click &quot;New application&quot; to start one.
        </div>
      )}

      {applications.length > 0 && (
        <div className="ts-panel ts-row-list mb-5">
          {applications.map((app) => {
            const docs = documentsByApp[app.id] || [];
            const docsLoading = docLoadingByApp[app.id];
            const isUploadingThis = uploadingAppId === app.id;

            return (
              <div className="ts-row-item" key={app.id}>
                <div className="row align-items-start g-3">
                  <div className="col-md-3">
                    <h6 className="fw-bold mb-0">{app.destination_country}</h6>
                    <span className="text-muted small text-capitalize">{app.visa_type} visa</span>
                  </div>

                  <div className="col-md-3">
                    <div className="small text-muted">
                      Travel {new Date(app.travel_date).toLocaleDateString()}
                      {app.return_date ? ` → ${new Date(app.return_date).toLocaleDateString()}` : ''}
                    </div>
                    <div className="small text-muted">Passport {app.passport_number}</div>
                  </div>

                  <div className="col-md-3">
                    <VisaStatusBadge status={app.status} />
                    <div className="small text-muted mt-1">
                      Submitted {new Date(app.created_at).toLocaleDateString()}
                    </div>
                    {app.notes && <div className="small mt-1">{app.notes}</div>}
                  </div>

                  <div className="col-md-3">
                    <div className="text-muted small mb-1">Documents</div>
                    {docsLoading ? (
                      <div className="small text-muted">Loading...</div>
                    ) : docs.length === 0 ? (
                      <div className="small text-muted">None uploaded yet.</div>
                    ) : (
                      <div style={{ maxHeight: 100, overflowY: 'auto' }}>
                        {docs.map((doc) => {
                          const docStyle = DOC_STATUS_STYLES[doc.status] || DOC_STATUS_STYLES.uploaded;
                          return (
                            <div
                              key={doc.id}
                              className="d-flex justify-content-between align-items-center small border-bottom py-1"
                            >
                              <button
                                type="button"
                                className="btn btn-link p-0 small text-start text-truncate"
                                style={{ color: 'var(--ts-ink)', maxWidth: 120 }}
                                onClick={() => handleViewDocument(doc)}
                              >
                                {doc.file_name}
                              </button>
                              <div className="d-flex align-items-center gap-2">
                                <span style={{ color: docStyle.color, fontSize: '0.7rem' }}>
                                  {docStyle.label}
                                </span>
                                <button
                                  type="button"
                                  className="btn btn-link p-0 small"
                                  style={{ color: 'var(--ts-danger-text)' }}
                                  disabled={deletingDocId === doc.id}
                                  onClick={() => handleDeleteDocument(app.id, doc.id)}
                                >
                                  &times;
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>

                <div className="row g-2 align-items-center mt-2">
                  <div className="col-md-3">
                    <select
                      className="ts-input"
                      value={docTypeFor(app.id)}
                      onChange={(e) => setDocTypeFor(app.id, e.target.value)}
                    >
                      {DOCUMENT_TYPES.map((dt) => (
                        <option key={dt.value} value={dt.value}>{dt.label}</option>
                      ))}
                    </select>
                  </div>
                  <div className="col-md-4">
                    <input
                      type="file"
                      className="ts-input"
                      accept=".pdf,.jpg,.jpeg,.png"
                      onChange={(e) => setFileFor(app.id, e.target.files?.[0] || null)}
                    />
                  </div>
                  <div className="col-md-2">
                    <button
                      type="button"
                      className="ts-btn-outline-neutral w-100"
                      disabled={isUploadingThis}
                      onClick={() => handleUploadDocument(app.id)}
                    >
                      {isUploadingThis ? 'Uploading...' : 'Upload'}
                    </button>
                  </div>
                </div>

                {uploadErrorByApp[app.id] && (
                  <div className="small mt-2" style={{ color: 'var(--ts-danger-text)' }}>
                    {uploadErrorByApp[app.id]}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}