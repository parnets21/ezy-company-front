import api from './index'

/** Current-user account APIs. All endpoints are scoped by the authenticated JWT. */
export const profileApi = {
  get: () => api.get('/profile').then(response => response.data),
  update: data => api.put('/profile', data).then(response => response.data),
  updateCompany: data => api.put('/profile/company', data).then(response => response.data),
  changePassword: (currentPassword, newPassword) =>
    api.post('/profile/change-password', { currentPassword, newPassword })
      .then(response => response.data),
}
