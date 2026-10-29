/**
 * hrApi.js — Employees · Attendance · Salary
 *
 * Employee:   GET|POST /employees  •  GET|PUT|DELETE /employees/:id
 * Attendance: GET /employees/attendance/list  •  GET /employees/attendance/summary
 *             GET /employees/attendance/monthly  •  POST /employees/attendance/mark
 * Salary:     GET|POST /employees/salary/records
 *             PATCH /employees/salary/records/:id/pay
 */
import api from './index'

export const hrApi = {
  // ── Employees ─────────────────────────────────────────────
  // params: { department, branch, is_active, page, limit }
  listEmployees: (params = {}) =>
    api.get('/employees', { params }).then(r => r.data),

  // Super Admin — all staff across every company, joined with company biz_type.
  listAllEmployees: (params = {}) =>
    api.get('/employees/admin/all', { params }).then(r => r.data),

  // Returns employee + last 30 attendance records
  getEmployee: (id) =>
    api.get(`/employees/${id}`).then(r => r.data),

  createEmployee: (data) =>
    api.post('/employees', data).then(r => r.data),

  updateEmployee: (id, data) =>
    api.put(`/employees/${id}`, data).then(r => r.data),

  deleteEmployee: (id) =>
    api.delete(`/employees/${id}`).then(r => r.data),

  // ── Attendance ────────────────────────────────────────────
  // params: { employee_id, date, month, year, department, branch, status, page, limit }
  listAttendance: (params = {}) =>
    api.get('/employees/attendance/list', { params }).then(r => r.data),

  // params: { date }  → returns { total, present, absent, late, halfDay, onLeave, holiday }
  getAttendanceSummary: (params = {}) =>
    api.get('/employees/attendance/summary', { params }).then(r => r.data),

  // params: { employee_id?, month, year } → per-employee monthly rollup
  // returns { month, year, report: [{ employee_id, present, absent, late, half_day, on_leave, holiday, payable_days, work_hours }] }
  getMonthlyAttendance: (params = {}) =>
    api.get('/employees/attendance/monthly', { params }).then(r => r.data),

  // Body: { employee_id, date, status, check_in?, check_out?, notes? }
  markAttendance: (data) =>
    api.post('/employees/attendance/mark', data).then(r => r.data),

  // ── Salary ────────────────────────────────────────────────
  // params: { employee_id, month, year, page, limit }
  listSalary: (params = {}) =>
    api.get('/employees/salary/records', { params }).then(r => r.data),

  // Full salary record body (all breakdown fields)
  createSalary: (data) =>
    api.post('/employees/salary/records', data).then(r => r.data),

  // Body: { payment_date, payment_mode, payment_reference? }
  paySalary: (id, data) =>
    api.patch(`/employees/salary/records/${id}/pay`, data).then(r => r.data),
}
