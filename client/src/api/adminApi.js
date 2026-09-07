import axiosClient from './axiosClient';

export const getAdminStats = () => axiosClient.get('/admin/stats');
export const getAdminBookings = (params) => axiosClient.get('/admin/bookings', { params });
export const getAdminUsers = (params) => axiosClient.get('/admin/users', { params });
export const updateUserRole = (id, role) => axiosClient.patch(`/admin/users/${id}/role`, { role });
export const getAdminPayments = (params) => axiosClient.get('/admin/payments', { params });
export const getAdminRefunds = (params) => axiosClient.get('/admin/refunds', { params });
export const retryFailedRefunds = () => axiosClient.post('/admin/refunds/retry');
export const getAdminCoupons = () => axiosClient.get('/admin/coupons');
export const createCoupon = (payload) => axiosClient.post('/admin/coupons', payload);
export const toggleCoupon = (id, isActive) => axiosClient.patch(`/admin/coupons/${id}`, { isActive });
export const getAdminVisaApplications = (params) => axiosClient.get('/admin/visa-applications', { params });
export const updateVisaApplicationStatus = (id, status, notes) =>
  axiosClient.patch(`/admin/visa-applications/${id}`, { status, notes });