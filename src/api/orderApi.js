import api from './index'

export const orderApi = {
  getTransitions:  ()     => api.get('/orders/transitions').then(r => r.data),
  list:            (p={}) => api.get('/orders', { params: p }).then(r => r.data),
  get:             (id)   => api.get(`/orders/${id}`).then(r => r.data),
  getNextStatuses: (id)   => api.get(`/orders/${id}/next-statuses`).then(r => r.data),
  fromEnquiry:     (data) => api.post('/orders/from-enquiry', data).then(r => r.data),
  create:          (data) => api.post('/orders', data).then(r => r.data),
  updateStatus:    (id,d) => api.patch(`/orders/${id}/status`, d).then(r => r.data),
  update:          (id,d) => api.put(`/orders/${id}`, d).then(r => r.data),
  delete:          (id)   => api.delete(`/orders/${id}`).then(r => r.data),
  pack:            (id,d) => api.post(`/orders/${id}/pack`, d).then(r => r.data),
  assign:          (id,d) => api.post(`/orders/${id}/assign`, d).then(r => r.data),
}
