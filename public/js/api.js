const JSON_HEADERS = {
  "Content-Type": "application/json"
};

function apiPath(path) {
  if (!path.startsWith("/api/") || path.startsWith("/api/rpc")) return path;
  return `/api/rpc?__path=${encodeURIComponent(path)}`;
}

async function request(path, options = {}) {
  const response = await fetch(apiPath(path), {
    ...options,
    headers: {
      ...JSON_HEADERS,
      ...(options.headers || {})
    }
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload.ok === false) {
    const message = payload.message || "حدث خطأ أثناء تنفيذ الطلب.";
    const error = new Error(message);
    error.payload = payload;
    throw error;
  }
  return payload.data;
}

export const api = {
  bootstrap: () => request("/api/bootstrap"),
  doctors: (params = {}) => {
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value) searchParams.set(key, value);
    });
    return request(`/api/doctors?${searchParams.toString()}`);
  },
  doctor: (id) => request(`/api/doctors/${encodeURIComponent(id)}`),
  availability: (doctorId) => request(`/api/availability/${encodeURIComponent(doctorId)}`),
  createBooking: (payload) =>
    request("/api/bookings", {
      method: "POST",
      body: JSON.stringify(payload)
    }),
  booking: (code) => request(`/api/bookings/${encodeURIComponent(code)}`),
  cancelBooking: (code) =>
    request(`/api/bookings/${encodeURIComponent(code)}/cancel`, {
      method: "PATCH",
      body: JSON.stringify({})
    }),
  track: (params) => {
    const searchParams = new URLSearchParams(params);
    return request(`/api/track?${searchParams.toString()}`);
  },
  todayDashboard: (params = {}) => {
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value) searchParams.set(key, value);
    });
    return request(`/api/dashboard/today?${searchParams.toString()}`);
  },
  updateBooking: (code, payload) =>
    request(`/api/bookings/${encodeURIComponent(code)}`, {
      method: "PATCH",
      body: JSON.stringify(payload)
    }),
  updateQueue: (doctorId, date, payload) =>
    request(`/api/queue/${encodeURIComponent(doctorId)}/${encodeURIComponent(date)}`, {
      method: "PATCH",
      body: JSON.stringify(payload)
    }),
  updateSchedule: (id, payload) =>
    request(`/api/schedules/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify(payload)
    }),
  createDoctor: (payload) =>
    request("/api/doctors", {
      method: "POST",
      body: JSON.stringify(payload)
    }),
  updateDoctor: (id, payload) =>
    request(`/api/doctors/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify(payload)
    }),
  updateClinic: (id, payload) =>
    request(`/api/clinics/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify(payload)
    }),
  createSpecialty: (payload) =>
    request("/api/specialties", {
      method: "POST",
      body: JSON.stringify(payload)
    }),
  deleteSpecialty: (id) =>
    request(`/api/specialties/${encodeURIComponent(id)}`, {
      method: "DELETE"
    }),
  createGovernorate: (payload) =>
    request("/api/governorates", {
      method: "POST",
      body: JSON.stringify(payload)
    })
};
