import axiosClient from './axiosClient';

export function addToCart({ itemType, itemId, quantity, details }) {
  return axiosClient.post('/cart', { itemType, itemId, quantity, details });
}

export function getCart() {
  return axiosClient.get('/cart');
}

export function removeFromCart(id) {
  return axiosClient.delete(`/cart/${id}`);
}

export function updateCartQuantity(id, quantity) {
  return axiosClient.patch(`/cart/${id}`, { quantity });
}
