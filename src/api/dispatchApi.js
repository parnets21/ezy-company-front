import api from './index'

export const dispatchApi = {
  list:         (p={}) => api.get('/dispatches', { params: p }).then(r => r.data),
  get:          (id)   => api.get(`/dispatches/${id}`).then(r => r.data),
  create:       (data) => api.post('/dispatches', data).then(r => r.data),
  markInTransit:(id)   => api.patch(`/dispatches/${id}/intransit`, {}).then(r => r.data),
  markDelivered:(id,d) => api.patch(`/dispatches/${id}/deliver`, { delivered_date: d }).then(r => r.data),
  update:       (id,d) => api.put(`/dispatches/${id}`, d).then(r => r.data),
}
