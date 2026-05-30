const fs = require("fs");
const http = require("http");
const path = require("path");
const { URL } = require("url");
const { readDb, writeDb } = require("./database");
const { WEEK_DAYS_AR } = require("./seed");

const PORT = Number(process.env.PORT || 4173);
const PUBLIC_DIR = path.join(__dirname, "..", "public");

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon"
};

const BOOKING_STATUSES = new Set([
  "booked",
  "confirmed",
  "arrived",
  "in_consultation",
  "completed",
  "absent",
  "cancelled"
]);

const SESSION_STATUSES = new Set([
  "not_started",
  "active",
  "open",
  "paused",
  "closed",
  "delayed",
  "doctor_absent"
]);
const SESSION_LABELS = {
  not_started: "لم تبدأ",
  active: "مفتوحة",
  open: "مفتوحة",
  delayed: "يوجد تأخير",
  paused: "متوقفة مؤقتاً",
  closed: "مغلقة",
  doctor_absent: "الطبيب غير موجود"
};
const APP_TIME_ZONE = "Asia/Baghdad";
const DEMO_STAFF_ACCESS_CODE = "clinic-2026";
const DEMO_SUPER_ADMIN_ACCESS_CODE = "owner-2026";
const PUBLIC_BOOTSTRAP_CACHE_MS = Number(process.env.PUBLIC_BOOTSTRAP_CACHE_MS || 20000);
const SAAS_PLANS = new Set(["free", "basic", "pro", "trial"]);

let publicBootstrapCache = null;

function todayISO() {
  return toBaghdadDateString(new Date());
}

function toBaghdadDateString(date) {
  const parts = new Intl.DateTimeFormat("en", {
    timeZone: APP_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store"
  });
  response.end(JSON.stringify(payload));
}

function sendError(response, statusCode, message, details = {}) {
  sendJson(response, statusCode, {
    ok: false,
    message,
    details
  });
}

function getPublicBootstrapCache(method, url, auth) {
  if (method !== "GET" || url.pathname !== "/api/bootstrap" || auth.accessCode || auth.bearerToken) return null;
  if (!publicBootstrapCache || publicBootstrapCache.expiresAt <= Date.now()) return null;
  return publicBootstrapCache.data;
}

function setPublicBootstrapCache(data) {
  if (PUBLIC_BOOTSTRAP_CACHE_MS <= 0) return;
  publicBootstrapCache = {
    data,
    expiresAt: Date.now() + PUBLIC_BOOTSTRAP_CACHE_MS
  };
}

async function persistDb(db, collections) {
  publicBootstrapCache = null;
  return writeDb(db, { collections });
}

function getHeader(request, name) {
  const target = name.toLowerCase();
  return Object.entries(request.headers || {}).find(([key]) => key.toLowerCase() === target)?.[1] || "";
}

function decodePathSegment(segment) {
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}

function configuredStaffCode() {
  return process.env.STAFF_ACCESS_CODE || DEMO_STAFF_ACCESS_CODE;
}

function configuredSuperAdminCode() {
  return process.env.SUPER_ADMIN_ACCESS_CODE || DEMO_SUPER_ADMIN_ACCESS_CODE;
}

function allowGlobalStaffAccess() {
  return process.env.ALLOW_GLOBAL_STAFF_ACCESS === "true";
}

function getRequestAuth(request) {
  const role = String(getHeader(request, "x-dawri-role") || "patient");
  const accessCode = String(getHeader(request, "x-dawri-access-code") || "").trim();
  const authorization = String(getHeader(request, "authorization") || "").trim();
  const bearerToken = authorization.toLowerCase().startsWith("bearer ")
    ? authorization.slice(7).trim()
    : "";
  const isSuperAdmin = Boolean(accessCode && accessCode === configuredSuperAdminCode());
  const isGlobalStaff = Boolean(accessCode && accessCode === configuredStaffCode() && allowGlobalStaffAccess());
  return {
    role,
    accessCode,
    bearerToken,
    isGlobalStaff,
    isStaff: isSuperAdmin || isGlobalStaff,
    isSuperAdmin,
    clinicId: "",
    userId: "",
    authUserId: "",
    authProvider: accessCode ? "access_code" : "public"
  };
}

function supabaseAuthConfig() {
  return {
    url: process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "",
    anonKey: process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "",
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || ""
  };
}

async function fetchSupabaseAuthUser(token) {
  const config = supabaseAuthConfig();
  const apiKey = config.serviceRoleKey || config.anonKey;
  if (!token || !config.url || !apiKey || typeof fetch !== "function") return null;

  const response = await fetch(`${config.url.replace(/\/$/, "")}/auth/v1/user`, {
    headers: {
      Authorization: `Bearer ${token}`,
      apikey: apiKey
    }
  });

  if (!response.ok) return null;
  return response.json();
}

async function loginWithSupabase(email, password) {
  const config = supabaseAuthConfig();
  if (!config.url || !config.anonKey) {
    return { error: "Supabase Auth غير مفعّل. أضف SUPABASE_URL و SUPABASE_ANON_KEY في Vercel." };
  }

  const response = await fetch(`${config.url.replace(/\/$/, "")}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: config.anonKey
    },
    body: JSON.stringify({ email, password })
  });
  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    return { error: payload.error_description || payload.msg || "بيانات الدخول غير صحيحة." };
  }

  return { session: payload };
}

function userRoleFromAuth(authUser, dbUser) {
  return (
    dbUser?.role ||
    authUser?.app_metadata?.role ||
    authUser?.user_metadata?.role ||
    "patient"
  );
}

function clinicIdFromAuth(authUser, dbUser) {
  return (
    dbUser?.clinic_id ||
    authUser?.app_metadata?.clinic_id ||
    authUser?.user_metadata?.clinic_id ||
    ""
  );
}

async function resolveRequestAuth(db, request) {
  const auth = getRequestAuth(request);

  if (auth.bearerToken) {
    const authUser = await fetchSupabaseAuthUser(auth.bearerToken);
    if (authUser?.id) {
      const dbUser = db.users.find(
        (user) =>
          user.auth_user_id === authUser.id ||
          (authUser.email && user.email && user.email.toLowerCase() === authUser.email.toLowerCase())
      );
      const resolvedRole = userRoleFromAuth(authUser, dbUser);
      auth.role = resolvedRole;
      auth.userId = dbUser?.id || "";
      auth.authUserId = authUser.id;
      auth.clinicId = clinicIdFromAuth(authUser, dbUser);
      auth.isSuperAdmin = resolvedRole === "super_admin";
      auth.isGlobalStaff = false;
      auth.isStaff = ["super_admin", "clinic_admin", "secretary", "doctor"].includes(resolvedRole);
      auth.authProvider = "supabase";
      return auth;
    }
  }

  if (!auth.isStaff && auth.accessCode) {
    const clinic = db.clinics.find((item) => item.access_code && item.access_code === auth.accessCode);
    if (clinic && clinic.status === "active") {
      auth.isStaff = true;
      auth.clinicId = clinic.id;
    }
  }
  return auth;
}

function routeProtection(method, url, segments) {
  if (method === "GET" && url.pathname === "/api/dashboard/today") return "staff";
  if (method === "GET" && url.pathname === "/api/admin/stats") return "super_admin";
  if (method === "PATCH" && segments[1] === "bookings" && segments[2] && segments[3] !== "cancel") return "staff";
  if (method === "PATCH" && segments[1] === "queue") return "staff";
  if (method === "PATCH" && segments[1] === "schedules") return "staff";
  if (method === "POST" && url.pathname === "/api/doctors") return "staff";
  if (method === "PATCH" && segments[1] === "doctors") return "staff";
  if (method === "PATCH" && segments[1] === "clinics" && segments[3] === "settings") return "staff";
  if (method === "PATCH" && segments[1] === "clinics") return "super_admin";
  if (method === "POST" && url.pathname === "/api/specialties") return "super_admin";
  if (method === "DELETE" && segments[1] === "specialties") return "super_admin";
  if (method === "POST" && url.pathname === "/api/governorates") return "super_admin";
  return null;
}

function hasRequiredAccess(auth, requiredLevel) {
  if (requiredLevel === "super_admin") return auth.isSuperAdmin;
  if (requiredLevel === "staff") return auth.isStaff;
  return true;
}

function canAccessClinic(auth, clinicId) {
  return auth.isSuperAdmin || !auth.clinicId || auth.clinicId === clinicId;
}

function canAccessDoctor(db, auth, doctorId) {
  const doctor = findDoctor(db, doctorId);
  return Boolean(doctor && canAccessClinic(auth, doctor.clinic_id));
}

function publicBootstrap(db) {
  return {
    clinics: db.clinics.filter((clinic) => clinic.status === "active").map(publicClinic),
    doctors: db.doctors.map((doctor) => publicDoctor(db, doctor)).filter((doctor) => doctor.clinic?.status === "active"),
    schedules: db.schedules,
    bookings: [],
    queueSessions: db.queueSessions,
    notifications: [],
    subscriptions: [],
    specialties: db.specialties,
    governorates: db.governorates,
    stats: stats(db),
    today: todayISO()
  };
}

function scopedDbForAuth(db, auth) {
  if (!auth?.clinicId || auth.isSuperAdmin) return db;
  const doctorIds = db.doctors
    .filter((doctor) => doctor.clinic_id === auth.clinicId)
    .map((doctor) => doctor.id);
  const doctorIdSet = new Set(doctorIds);
  const bookingIds = new Set(
    db.bookings
      .filter((booking) => booking.clinic_id === auth.clinicId || doctorIdSet.has(booking.doctor_id))
      .map((booking) => booking.id)
  );
  return {
    ...db,
    clinics: db.clinics.filter((clinic) => clinic.id === auth.clinicId),
    doctors: db.doctors.filter((doctor) => doctorIdSet.has(doctor.id)),
    schedules: db.schedules.filter((schedule) => doctorIdSet.has(schedule.doctor_id)),
    bookings: db.bookings.filter((booking) => bookingIds.has(booking.id)),
    queueSessions: db.queueSessions.filter((session) => session.clinic_id === auth.clinicId || doctorIdSet.has(session.doctor_id)),
    notifications: db.notifications.filter((notification) => bookingIds.has(notification.booking_id) || notification.clinic_id === auth.clinicId),
    subscriptions: (db.subscriptions || []).filter((subscription) => subscription.clinic_id === auth.clinicId)
  };
}

function fullBootstrap(db, auth = {}) {
  const scoped = scopedDbForAuth(db, auth);
  return {
    users: auth.isSuperAdmin ? db.users.map(sanitizeUser) : [],
    clinics: scoped.clinics.map((clinic) => ({
      ...publicClinic(clinic),
      access_code: auth.isSuperAdmin ? clinic.access_code : undefined,
      owner_name: clinic.owner_name,
      owner_phone: clinic.owner_phone,
      clinic_type: clinic.clinic_type,
      ...clinicSaasSettings(clinic)
    })),
    doctors: scoped.doctors.map((doctor) => publicDoctor(scoped, doctor)),
    schedules: scoped.schedules,
    bookings: scoped.bookings.map((booking) => publicBooking(scoped, booking)),
    queueSessions: scoped.queueSessions,
    notifications: scoped.notifications,
    subscriptions: scoped.subscriptions || [],
    specialties: db.specialties,
    governorates: db.governorates,
    stats: stats(scoped),
    today: todayISO()
  };
}

function parseBody(request) {
  if (request.body !== undefined) {
    if (Buffer.isBuffer(request.body)) {
      const text = request.body.toString("utf8");
      return Promise.resolve(text.trim() ? JSON.parse(text) : {});
    }
    if (typeof request.body === "string") {
      return Promise.resolve(request.body.trim() ? JSON.parse(request.body) : {});
    }
    if (typeof request.body === "object" && request.body !== null) {
      return Promise.resolve(request.body);
    }
  }

  return new Promise((resolve, reject) => {
    let body = "";
    request.on("data", (chunk) => {
      body += chunk.toString();
      if (body.length > 1_000_000) {
        request.destroy();
        reject(new Error("Request body is too large"));
      }
    });
    request.on("end", () => {
      if (!body.trim()) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(body));
      } catch (error) {
        reject(new Error("Invalid JSON body"));
      }
    });
  });
}

function getDayName(dateString) {
  const date = new Date(`${dateString}T12:00:00+03:00`);
  return WEEK_DAYS_AR[date.getUTCDay()];
}

function addDays(date, amount) {
  const next = new Date(date);
  next.setDate(next.getDate() + amount);
  return next;
}

function minutesFromTime(time) {
  const [hours, minutes] = String(time).split(":").map(Number);
  return hours * 60 + minutes;
}

function timeFromMinutes(totalMinutes) {
  const hours = Math.floor(totalMinutes / 60) % 24;
  const minutes = totalMinutes % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

function formatTimeBlock(startMinutes, blockMinutes = 60) {
  return `${timeFromMinutes(startMinutes)} - ${timeFromMinutes(startMinutes + blockMinutes)}`;
}

function makeId(prefix) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function slugify(value, fallback = "clinic") {
  const ascii = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return ascii || `${fallback}-${Math.random().toString(36).slice(2, 7)}`;
}

function uniqueSlug(collection, base) {
  let slug = base;
  let index = 2;
  while (collection.some((item) => item.slug === slug || item.id === slug)) {
    slug = `${base}-${index}`;
    index += 1;
  }
  return slug;
}

function makeAccessCode(prefix = "clinic") {
  return `${prefix}-${Math.floor(1000 + Math.random() * 9000)}`;
}

function makeBookingCode(db) {
  let code = "";
  do {
    code = `DW-${Math.floor(100000 + Math.random() * 899999)}`;
  } while (db.bookings.some((booking) => booking.booking_code === code));
  return code;
}

function sanitizeUser(user) {
  const { password_hash: _passwordHash, ...safeUser } = user;
  return safeUser;
}

function findClinic(db, clinicId) {
  return db.clinics.find((clinic) => clinic.id === clinicId);
}

function findClinicBySlug(db, slug) {
  return db.clinics.find((clinic) => clinic.slug === slug || clinic.id === slug);
}

function findDoctor(db, doctorId) {
  return db.doctors.find((doctor) => doctor.id === doctorId);
}

function findScheduleForDate(db, doctorId, dateString) {
  const dayName = getDayName(dateString);
  return db.schedules.find(
    (schedule) =>
      schedule.doctor_id === doctorId &&
      schedule.day_of_week === dayName &&
      schedule.is_active
  );
}

function getBlocks(schedule) {
  const blocks = [];
  const start = minutesFromTime(schedule.start_time);
  const end = minutesFromTime(schedule.end_time);
  for (let cursor = start; cursor < end; cursor += 60) {
    blocks.push(formatTimeBlock(cursor, Math.min(60, end - cursor)));
  }
  return blocks;
}

function appointmentDays(db, doctorId, count = 10) {
  const today = new Date();
  const days = [];

  for (let offset = 0; offset < 21 && days.length < count; offset += 1) {
    const date = addDays(today, offset);
    const dateString = toBaghdadDateString(date);
    const schedule = findScheduleForDate(db, doctorId, dateString);
    if (!schedule) continue;

    const activeBookings = db.bookings.filter(
      (booking) =>
        booking.doctor_id === doctorId &&
        booking.booking_date === dateString &&
        booking.status !== "cancelled"
    );

    days.push({
      date: dateString,
      day_name: getDayName(dateString),
      label: `${getDayName(dateString)} ${dateString}`,
      schedule_id: schedule.id,
      start_time: schedule.start_time,
      end_time: schedule.end_time,
      max_patients: schedule.max_patients,
      remaining_capacity: Math.max(schedule.max_patients - activeBookings.length, 0),
      is_full: activeBookings.length >= schedule.max_patients,
      time_blocks: getBlocks(schedule)
    });
  }

  return days;
}

function getOrCreateQueueSession(db, doctorId, dateString) {
  const doctor = findDoctor(db, doctorId);
  if (!doctor) return null;

  let session = db.queueSessions.find(
    (item) => item.doctor_id === doctorId && item.date === dateString
  );

  if (!session) {
    session = {
      id: makeId("queue"),
      clinic_id: doctor.clinic_id,
      doctor_id: doctorId,
      date: dateString,
      current_queue_number: 0,
      status: "not_started",
      delay_message: "",
      delay_reason: "",
      delay_duration_minutes: 0,
      started_at: null,
      closed_at: null
    };
    db.queueSessions.push(session);
  }

  session.status = normalizeSessionStatus(session.status);
  if (session.delay_reason === undefined) session.delay_reason = session.delay_message || "";
  if (session.delay_duration_minutes === undefined) session.delay_duration_minutes = 0;
  if (session.delay_message === undefined) session.delay_message = "";

  return session;
}

function getQueueSession(db, doctorId, dateString) {
  const doctor = findDoctor(db, doctorId);
  if (!doctor) return null;

  const session = db.queueSessions.find(
    (item) => item.doctor_id === doctorId && item.date === dateString
  );

  if (session) {
    session.status = normalizeSessionStatus(session.status);
    if (session.delay_reason === undefined) session.delay_reason = session.delay_message || "";
    if (session.delay_duration_minutes === undefined) session.delay_duration_minutes = 0;
    if (session.delay_message === undefined) session.delay_message = "";
    return session;
  }

  return {
    id: "",
    clinic_id: doctor.clinic_id,
    doctor_id: doctorId,
    date: dateString,
    current_queue_number: 0,
    status: "not_started",
    delay_message: "",
    delay_reason: "",
    delay_duration_minutes: 0,
    started_at: null,
    closed_at: null
  };
}

function normalizeSessionStatus(status) {
  if (status === "active") return "open";
  return SESSION_STATUSES.has(status) ? status : "not_started";
}

function isClinicOpen(status) {
  return status === "open" || status === "active";
}

function publicClinic(clinic) {
  if (!clinic) return null;
  const slug = clinic.slug || clinic.id;
  const {
    access_code: _accessCode,
    internal_notes: _internalNotes,
    owner_name: _ownerName,
    owner_phone: _ownerPhone,
    plan: _plan,
    subscription_status: _subscriptionStatus,
    trial_ends_at: _trialEndsAt,
    approved_at: _approvedAt,
    whatsapp_booking_enabled: _whatsAppBookingEnabled,
    whatsapp_sender_phone: _whatsAppSenderPhone,
    whatsapp_delivery_mode: _whatsAppDeliveryMode,
    ...safeClinic
  } = clinic;
  return {
    ...safeClinic,
    slug,
    public_path: `/clinics/${encodeURIComponent(slug)}`,
    public_url: `/clinics/${encodeURIComponent(slug)}`
  };
}

function clinicSaasSettings(clinic) {
  return {
    plan: clinic?.plan || "free",
    subscription_status: clinic?.subscription_status || "trial",
    trial_ends_at: clinic?.trial_ends_at || "",
    whatsapp_booking_enabled: clinic?.whatsapp_booking_enabled !== false,
    whatsapp_sender_phone: clinic?.whatsapp_sender_phone || clinic?.phone || "",
    whatsapp_delivery_mode: clinic?.whatsapp_delivery_mode || "manual_handoff"
  };
}

function publicDoctor(db, doctor) {
  const clinic = publicClinic(findClinic(db, doctor.clinic_id));
  const schedules = db.schedules.filter((schedule) => schedule.doctor_id === doctor.id);
  const activeSchedules = schedules.filter((schedule) => schedule.is_active);
  const session = db.queueSessions.find(
    (item) => item.doctor_id === doctor.id && item.date === todayISO()
  );

  return {
    ...doctor,
    clinic,
    schedules,
    working_days: activeSchedules.map((schedule) => schedule.day_of_week),
    working_hours:
      activeSchedules.length > 0
        ? `${activeSchedules[0].start_time} - ${activeSchedules[0].end_time}`
        : "غير محدد",
    current_queue_status: session || null,
    available_days: appointmentDays(db, doctor.id, 7)
  };
}

function publicBooking(db, booking) {
  const doctor = findDoctor(db, booking.doctor_id);
  const clinic = doctor ? findClinic(db, doctor.clinic_id) : findClinic(db, booking.clinic_id);
  const session = getQueueSession(db, booking.doctor_id, booking.booking_date) || {
    current_queue_number: 0,
    status: "not_started",
    delay_message: "",
    delay_reason: "",
    delay_duration_minutes: 0
  };
  const remainingPatients = Math.max(booking.queue_number - session.current_queue_number, 0);
  const schedule = findScheduleForDate(db, booking.doctor_id, booking.booking_date);
  const averageMinutes = schedule?.average_consultation_minutes || 10;

  return {
    ...booking,
    doctor: doctor ? publicDoctor(db, doctor) : null,
    clinic: publicClinic(clinic),
    queue_session: session,
    clinic_status: session.status,
    clinic_status_label: SESSION_LABELS[session.status] || session.status,
    queue_progress_percent: Math.max(
      0,
      Math.min(100, Math.round((session.current_queue_number / Math.max(booking.queue_number, 1)) * 100))
    ),
    estimated_remaining_patients: remainingPatients,
    estimated_waiting_time_minutes: remainingPatients * averageMinutes,
    reminder_message: buildReminderMessage(booking, session)
  };
}

function buildReminderMessage(booking, session) {
  const status = normalizeSessionStatus(session.status);
  if (booking.status === "cancelled") return "تم إلغاء الحجز.";
  if (booking.status === "completed") return "تم الانتهاء من الزيارة، نتمنى لك الصحة.";
  if (status === "closed") return "العيادة مغلقة حالياً";
  if (status === "doctor_absent") return "الطبيب غير موجود حالياً";
  if (status === "paused") return "الدور متوقف مؤقتاً، يرجى متابعة التحديثات.";
  if (status === "delayed") {
    const duration = Number(session.delay_duration_minutes || 0);
    const reason = session.delay_reason || session.delay_message || "";
    const details = [reason, duration ? `مدة التأخير المتوقعة ${duration} دقيقة` : ""]
      .filter(Boolean)
      .join(" - ");
    return details ? `يوجد تأخير حالياً في العيادة: ${details}` : "يوجد تأخير حالياً في العيادة";
  }

  const remaining = booking.queue_number - session.current_queue_number;
  if (remaining <= 0 && isClinicOpen(status)) return "دورك الآن، يرجى مراجعة السكرتارية.";
  if (remaining <= 3 && isClinicOpen(status)) {
    return "اقترب دورك، يرجى التوجه إلى العيادة";
  }
  return "يرجى متابعة الدور قبل التوجه إلى العيادة.";
}

function stats(db) {
  const today = todayISO();
  const todayBookings = db.bookings.filter((booking) => booking.booking_date === today);
  return {
    total_doctors: db.doctors.length,
    total_clinics: db.clinics.length,
    total_bookings: db.bookings.length,
    today_bookings: todayBookings.length,
    active_clinics: db.clinics.filter((clinic) => clinic.status === "active").length,
    pending_clinic_approvals: db.clinics.filter((clinic) => clinic.status === "pending").length,
    free_subscriptions: (db.subscriptions || []).filter((subscription) => subscription.plan === "free").length,
    basic_subscriptions: (db.subscriptions || []).filter((subscription) => subscription.plan === "basic").length,
    pro_subscriptions: (db.subscriptions || []).filter((subscription) => subscription.plan === "pro").length,
    revenue_placeholder: db.revenue?.placeholder_monthly_iqd || 0
  };
}

function filterDoctors(db, searchParams) {
  const search = (searchParams.get("search") || "").trim().toLowerCase();
  const specialty = searchParams.get("specialty") || "";
  const governorate = searchParams.get("governorate") || "";
  const area = searchParams.get("area") || "";

  return db.doctors
    .filter((doctor) => doctor.status === "active")
    .map((doctor) => publicDoctor(db, doctor))
    .filter((doctor) => doctor.clinic?.status === "active")
    .filter((doctor) => !specialty || doctor.specialty === specialty)
    .filter((doctor) => !governorate || doctor.clinic?.governorate === governorate)
    .filter((doctor) => !area || doctor.clinic?.area === area)
    .filter((doctor) => {
      if (!search) return true;
      return [doctor.name, doctor.specialty, doctor.clinic?.name, doctor.clinic?.area]
        .filter(Boolean)
        .some((value) => value.toLowerCase().includes(search));
    });
}

function validatePhone(phone) {
  return /^07\d{9}$/.test(String(phone || "").trim());
}

function createBooking(db, payload) {
  const doctorId = payload.doctor_id || payload.doctorId;
  const bookingDate = payload.booking_date || payload.bookingDate;
  const timeBlock = payload.time_block || payload.timeBlock;
  const patientName = String(payload.patient_name || payload.patientName || "").trim();
  const patientPhone = String(payload.patient_phone || payload.patientPhone || "").trim();
  const patientAge = Number(payload.patient_age || payload.patientAge || 0);
  const patientGender = payload.patient_gender || payload.patientGender || "";
  const visitReason = String(payload.visit_reason || payload.visitReason || "").trim();

  if (!doctorId) return { error: "يرجى اختيار الطبيب." };
  if (!bookingDate) return { error: "يرجى اختيار تاريخ الحجز." };
  if (!timeBlock) return { error: "يرجى اختيار الوقت التقريبي." };
  if (!patientName) return { error: "اسم المريض مطلوب." };
  if (!validatePhone(patientPhone)) return { error: "رقم الهاتف يجب أن يبدأ بـ 07 ويتكون من 11 رقم." };

  const doctor = findDoctor(db, doctorId);
  if (!doctor || doctor.status !== "active") return { error: "الطبيب غير متاح حالياً." };

  const clinic = findClinic(db, doctor.clinic_id);
  if (!clinic || clinic.status !== "active") return { error: "العيادة غير متاحة للحجز حالياً." };

  const schedule = findScheduleForDate(db, doctorId, bookingDate);
  if (!schedule) return { error: "لا توجد مواعيد متاحة لهذا اليوم." };

  const activeBookings = db.bookings.filter(
    (booking) =>
      booking.doctor_id === doctorId &&
      booking.booking_date === bookingDate &&
      booking.status !== "cancelled"
  );

  const duplicate = activeBookings.find((booking) => booking.patient_phone === patientPhone);
  if (duplicate) {
    return {
      error: "لديك حجز سابق لنفس الطبيب في هذا اليوم.",
      duplicate_code: duplicate.booking_code
    };
  }

  if (activeBookings.length >= schedule.max_patients) {
    return { error: "الحجوزات ممتلئة لهذا اليوم" };
  }

  const queueNumber =
    activeBookings.reduce((max, booking) => Math.max(max, Number(booking.queue_number) || 0), 0) + 1;
  const approximateTime = timeFromMinutes(
    minutesFromTime(schedule.start_time) + (queueNumber - 1) * schedule.average_consultation_minutes
  );
  const session = getOrCreateQueueSession(db, doctorId, bookingDate);
  const now = new Date().toISOString();

  const booking = {
    id: makeId("booking"),
    booking_code: makeBookingCode(db),
    clinic_id: clinic.id,
    doctor_id: doctorId,
    patient_name: patientName,
    patient_phone: patientPhone,
    patient_age: patientAge || "",
    patient_gender: patientGender,
    visit_reason: visitReason,
    booking_date: bookingDate,
    approximate_time: approximateTime,
    time_block: timeBlock,
    queue_number: queueNumber,
    status: "booked",
    current_queue_snapshot: session.current_queue_number,
    created_at: now,
    updated_at: now
  };

  db.bookings.push(booking);
  db.notifications.push({
    id: makeId("notification"),
    booking_id: booking.id,
    type: "in_app",
    message: `تم تأكيد حجزك برقم دور ${queueNumber}. يرجى متابعة الدور قبل التوجه إلى العيادة.`,
    status: "sent",
    created_at: now
  });

  if (clinic.whatsapp_booking_enabled !== false) {
    db.notifications.push({
      id: makeId("notification"),
      booking_id: booking.id,
      type: "whatsapp",
      message: [
        "تأكيد حجز من دوري الطبي",
        `العيادة: ${clinic.name}`,
        `الطبيب: ${doctor.name}`,
        `التاريخ: ${bookingDate}`,
        `الوقت التقريبي: ${approximateTime}`,
        `رقم الدور: ${queueNumber}`
      ].join("\n"),
      status: clinic.whatsapp_delivery_mode === "official_api_ready" ? "pending" : "manual_ready",
      created_at: now
    });
  }

  return { booking };
}

function todayDashboard(db, searchParams, auth = {}) {
  const date = searchParams.get("date") || todayISO();
  const availableDoctors = auth.clinicId
    ? db.doctors.filter((doctor) => doctor.clinic_id === auth.clinicId)
    : db.doctors;
  const doctorId = searchParams.get("doctorId") || availableDoctors[0]?.id;
  const doctor = findDoctor(db, doctorId);
  const clinic = doctor ? findClinic(db, doctor.clinic_id) : null;
  const bookings = db.bookings
    .filter((booking) => booking.doctor_id === doctorId && booking.booking_date === date)
    .sort((a, b) => a.queue_number - b.queue_number)
    .map((booking) => publicBooking(db, booking));
  const session = doctor ? getOrCreateQueueSession(db, doctorId, date) : null;

  return {
    date,
    doctor: doctor ? publicDoctor(db, doctor) : null,
    clinic_settings: clinicSaasSettings(clinic),
    session,
    bookings,
    metrics: {
      today_bookings: bookings.length,
      waiting_patients: bookings.filter((booking) =>
        ["booked", "confirmed", "arrived"].includes(booking.status)
      ).length,
      completed_patients: bookings.filter((booking) => booking.status === "completed").length,
      absent_patients: bookings.filter((booking) => booking.status === "absent").length,
      cancelled_bookings: bookings.filter((booking) => booking.status === "cancelled").length
    }
  };
}

function patchBooking(db, code, payload) {
  const booking = db.bookings.find((item) => item.booking_code === code || item.id === code);
  if (!booking) return { error: "لم يتم العثور على الحجز." };

  if (payload.status) {
    if (!BOOKING_STATUSES.has(payload.status)) return { error: "حالة الحجز غير صحيحة." };
    booking.status = payload.status;
  }

  if (payload.note !== undefined) {
    const previous = booking.visit_reason ? `${booking.visit_reason}\n` : "";
    booking.visit_reason = `${previous}${String(payload.note).trim()}`.trim();
  }

  if (payload.visit_reason !== undefined) {
    booking.visit_reason = String(payload.visit_reason).trim();
  }

  if (payload.approximate_time !== undefined) {
    booking.approximate_time = String(payload.approximate_time).trim();
  }

  if (payload.time_block !== undefined) {
    booking.time_block = String(payload.time_block).trim();
  }

  booking.updated_at = new Date().toISOString();
  return { booking };
}

function cancelBooking(db, code) {
  const booking = db.bookings.find((item) => item.booking_code === code);
  if (!booking) return { error: "لم يتم العثور على الحجز." };

  if (["arrived", "in_consultation", "completed"].includes(booking.status)) {
    return { error: "لا يمكن إلغاء الحجز بعد وصول المريض أو دخوله للطبيب." };
  }

  const session = getQueueSession(db, booking.doctor_id, booking.booking_date);
  if (session && isClinicOpen(session.status) && booking.queue_number <= session.current_queue_number) {
    return { error: "لا يمكن إلغاء الحجز بعد وصول الدور." };
  }

  booking.status = "cancelled";
  booking.updated_at = new Date().toISOString();
  return { booking };
}

function patchQueue(db, doctorId, dateString, payload) {
  const session = getOrCreateQueueSession(db, doctorId, dateString);
  if (!session) return { error: "لم يتم العثور على الطبيب." };

  const maxQueue = db.bookings
    .filter(
      (booking) =>
        booking.doctor_id === doctorId &&
        booking.booking_date === dateString &&
        booking.status !== "cancelled"
    )
    .reduce((max, booking) => Math.max(max, Number(booking.queue_number) || 0), 0);

  if (payload.action === "pause") {
    session.status = "paused";
  }

  if (payload.action === "resume" || payload.action === "open") {
    session.status = "open";
    if (!session.started_at) session.started_at = new Date().toISOString();
  }

  if (payload.action === "close") {
    session.status = "closed";
    session.closed_at = new Date().toISOString();
  }

  if (payload.action === "next") {
    session.current_queue_number = Math.min(session.current_queue_number + 1, Math.max(maxQueue, 0));
    session.status = session.status === "not_started" || session.status === "paused" ? "open" : session.status;
    if (!session.started_at) session.started_at = new Date().toISOString();
  }

  if (payload.action === "previous") {
    session.current_queue_number = Math.max(session.current_queue_number - 1, 0);
  }

  if (payload.action === "set") {
    const nextValue = Number(payload.value);
    if (Number.isNaN(nextValue) || nextValue < 0) return { error: "رقم الدور غير صحيح." };
    session.current_queue_number = Math.min(nextValue, Math.max(maxQueue, nextValue));
  }

  if (payload.status) {
    const nextStatus = normalizeSessionStatus(payload.status);
    if (!SESSION_STATUSES.has(nextStatus)) return { error: "حالة العيادة غير صحيحة." };
    session.status = nextStatus;
    if (isClinicOpen(nextStatus) && !session.started_at) session.started_at = new Date().toISOString();
    if (nextStatus === "closed") session.closed_at = new Date().toISOString();
  }

  if (
    payload.delay_message !== undefined ||
    payload.delayMessage !== undefined ||
    payload.delay_reason !== undefined ||
    payload.delayReason !== undefined ||
    payload.delay_duration_minutes !== undefined ||
    payload.delayDurationMinutes !== undefined
  ) {
    const delayReason = String(
      payload.delay_reason ||
        payload.delayReason ||
        payload.delay_message ||
        payload.delayMessage ||
        ""
    ).trim();
    const delayDuration = Number(payload.delay_duration_minutes || payload.delayDurationMinutes || 0);
    session.delay_reason = delayReason;
    session.delay_message = delayReason;
    session.delay_duration_minutes = Number.isNaN(delayDuration) ? 0 : Math.max(delayDuration, 0);
    if (delayReason || session.delay_duration_minutes) session.status = "delayed";
  }

  return { session };
}

function updateSchedule(db, scheduleId, payload) {
  const schedule = db.schedules.find((item) => item.id === scheduleId);
  if (!schedule) return { error: "لم يتم العثور على الجدول." };

  const fields = [
    "day_of_week",
    "start_time",
    "end_time",
    "max_patients",
    "average_consultation_minutes",
    "is_active"
  ];
  fields.forEach((field) => {
    if (payload[field] !== undefined) schedule[field] = payload[field];
  });

  schedule.max_patients = Number(schedule.max_patients);
  schedule.average_consultation_minutes = Number(schedule.average_consultation_minutes);
  schedule.is_active = Boolean(schedule.is_active);
  return { schedule };
}

function createDoctor(db, payload) {
  const clinicId = payload.clinic_id || payload.clinicId || db.clinics[0]?.id;
  const name = String(payload.name || "").trim();
  const specialty = String(payload.specialty || "").trim();

  if (!name) return { error: "اسم الطبيب مطلوب." };
  if (!specialty) return { error: "الاختصاص مطلوب." };
  if (!findClinic(db, clinicId)) return { error: "العيادة غير موجودة." };

  const now = new Date().toISOString();
  const doctor = {
    id: makeId("doctor"),
    clinic_id: clinicId,
    name,
    specialty,
    bio: String(payload.bio || "").trim(),
    fee: Number(payload.fee || 0),
    gender: payload.gender || "male",
    status: payload.status || "active",
    rating: 0,
    average_waiting_time: "غير محسوب",
    created_at: now
  };

  db.doctors.push(doctor);
  ["السبت", "الأحد", "الإثنين", "الثلاثاء", "الأربعاء"].forEach((day) => {
    db.schedules.push({
      id: `schedule-${doctor.id}-${day}`,
      doctor_id: doctor.id,
      day_of_week: day,
      start_time: "16:00",
      end_time: "21:00",
      max_patients: 25,
      average_consultation_minutes: 10,
      is_active: true
    });
  });

  return { doctor };
}

function updateDoctor(db, doctorId, payload) {
  const doctor = findDoctor(db, doctorId);
  if (!doctor) return { error: "لم يتم العثور على الطبيب." };

  ["name", "specialty", "bio", "fee", "gender", "status", "clinic_id"].forEach((field) => {
    if (payload[field] !== undefined) doctor[field] = payload[field];
  });
  doctor.fee = Number(doctor.fee || 0);

  return { doctor };
}

function updateClinicSettings(db, clinicId, payload) {
  const clinic = findClinic(db, clinicId);
  if (!clinic) return { error: "لم يتم العثور على العيادة." };

  if (payload.whatsapp_booking_enabled !== undefined) {
    clinic.whatsapp_booking_enabled =
      payload.whatsapp_booking_enabled === true ||
      payload.whatsapp_booking_enabled === "true" ||
      payload.whatsapp_booking_enabled === "on";
  }

  if (payload.whatsapp_sender_phone !== undefined) {
    const phone = String(payload.whatsapp_sender_phone || "").trim();
    if (phone && !validatePhone(phone)) {
      return { error: "رقم واتساب العيادة يجب أن يبدأ بـ 07 ويتكون من 11 رقم." };
    }
    clinic.whatsapp_sender_phone = phone || clinic.phone || "";
  }

  if (payload.whatsapp_delivery_mode !== undefined) {
    const mode = String(payload.whatsapp_delivery_mode || "manual_handoff");
    if (!["manual_handoff", "official_api_ready"].includes(mode)) {
      return { error: "طريقة إرسال واتساب غير صحيحة." };
    }
    clinic.whatsapp_delivery_mode = mode;
  }

  return { clinic };
}

function createClinicRegistration(db, payload) {
  const name = String(payload.clinic_name || payload.name || "").trim();
  const phone = String(payload.phone || "").trim();
  const governorate = String(payload.governorate || "").trim();
  const area = String(payload.area || "").trim();
  const address = String(payload.address || "").trim();
  const ownerName = String(payload.owner_name || payload.ownerName || "").trim();
  const ownerPhone = String(payload.owner_phone || payload.ownerPhone || phone).trim();
  const clinicType = String(payload.clinic_type || payload.clinicType || "عيادة خاصة").trim();
  const now = new Date();

  if (!name) return { error: "اسم العيادة مطلوب." };
  if (!validatePhone(phone)) return { error: "رقم هاتف العيادة يجب أن يبدأ بـ 07 ويتكون من 11 رقم." };
  if (!governorate) return { error: "يرجى اختيار المحافظة." };
  if (!area) return { error: "المنطقة مطلوبة." };
  if (!address) return { error: "عنوان العيادة مطلوب." };
  if (ownerPhone && !validatePhone(ownerPhone)) return { error: "رقم مسؤول العيادة يجب أن يبدأ بـ 07 ويتكون من 11 رقم." };

  const duplicate = db.clinics.find((clinic) => clinic.phone === phone || (ownerPhone && clinic.owner_phone === ownerPhone));
  if (duplicate && duplicate.status !== "inactive") {
    return { error: "يوجد طلب أو عيادة مسجلة بهذا الرقم." };
  }

  const id = makeId("clinic");
  const baseSlug = slugify(`${name}-${area}`, id);
  const clinic = {
    id,
    slug: uniqueSlug(db.clinics, baseSlug),
    name,
    governorate,
    area,
    address,
    phone,
    owner_name: ownerName,
    owner_phone: ownerPhone,
    clinic_type: clinicType,
    status: "pending",
    registration_status: "pending",
    access_code: makeAccessCode("clinic"),
    plan: "free",
    subscription_status: "trial",
    trial_ends_at: new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000).toISOString(),
    whatsapp_booking_enabled: true,
    whatsapp_sender_phone: phone,
    whatsapp_delivery_mode: "manual_handoff",
    created_at: now.toISOString(),
    approved_at: null,
    internal_notes: String(payload.notes || "").trim()
  };
  const subscription = {
    id: makeId("subscription"),
    clinic_id: id,
    plan: "free",
    status: "trial",
    started_at: now.toISOString(),
    current_period_end: clinic.trial_ends_at,
    trial_ends_at: clinic.trial_ends_at,
    seats: 1,
    price_iqd: 0,
    created_at: now.toISOString(),
    updated_at: now.toISOString()
  };

  db.clinics.push(clinic);
  db.subscriptions = Array.isArray(db.subscriptions) ? db.subscriptions : [];
  db.subscriptions.push(subscription);
  return { clinic, subscription };
}

function ensureTenantFields(db) {
  let changed = false;
  db.subscriptions = Array.isArray(db.subscriptions) ? db.subscriptions : [];
  db.clinics.forEach((clinic) => {
    if (!clinic.slug) {
      clinic.slug = uniqueSlug(db.clinics.filter((item) => item.id !== clinic.id), slugify(`${clinic.name}-${clinic.area}`, clinic.id));
      changed = true;
    }
    if (!clinic.access_code) {
      clinic.access_code = makeAccessCode("clinic");
      changed = true;
    }
    if (!clinic.plan || !SAAS_PLANS.has(clinic.plan)) {
      clinic.plan = clinic.plan === "trial" ? "free" : "free";
      changed = true;
    }
    if (!clinic.subscription_status) {
      clinic.subscription_status = clinic.status === "active" ? "trial" : "pending";
      changed = true;
    }
    if (!clinic.registration_status) {
      clinic.registration_status = clinic.status === "active" ? "approved" : clinic.status || "pending";
      changed = true;
    }
    if (clinic.whatsapp_booking_enabled === undefined) {
      clinic.whatsapp_booking_enabled = true;
      changed = true;
    }
    if (!clinic.whatsapp_sender_phone) {
      clinic.whatsapp_sender_phone = clinic.phone || "";
      changed = true;
    }
    if (!clinic.whatsapp_delivery_mode) {
      clinic.whatsapp_delivery_mode = "manual_handoff";
      changed = true;
    }

    let subscription = db.subscriptions.find((item) => item.clinic_id === clinic.id);
    if (!subscription) {
      subscription = {
        id: makeId("subscription"),
        clinic_id: clinic.id,
        plan: clinic.plan || "free",
        status: clinic.subscription_status || (clinic.status === "active" ? "trial" : "pending"),
        started_at: clinic.created_at || new Date().toISOString(),
        current_period_end: clinic.trial_ends_at || null,
        trial_ends_at: clinic.trial_ends_at || null,
        seats: clinic.status === "active" ? 3 : 1,
        price_iqd: 0,
        created_at: clinic.created_at || new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      db.subscriptions.push(subscription);
      changed = true;
    } else {
      if (!SAAS_PLANS.has(subscription.plan)) subscription.plan = clinic.plan || "free";
      if (!subscription.status) subscription.status = clinic.subscription_status || "trial";
      if (!subscription.updated_at) subscription.updated_at = new Date().toISOString();
    }
  });
  return changed;
}

function upsertNamedItem(collection, payload, prefix) {
  const name = String(payload.name || "").trim();
  if (!name) return { error: "الاسم مطلوب." };
  const existing = collection.find((item) => item.name === name);
  if (existing) return { item: existing };

  const item = {
    id: makeId(prefix),
    name,
    status: payload.status || "active"
  };
  if (Array.isArray(payload.areas)) item.areas = payload.areas;
  collection.push(item);
  return { item };
}

async function handleApi(request, response, url) {
  const segments = url.pathname.split("/").filter(Boolean).map(decodePathSegment);
  const method = request.method;

  try {
    const requestAuth = getRequestAuth(request);
    const cachedPublicBootstrap = getPublicBootstrapCache(method, url, requestAuth);
    if (cachedPublicBootstrap) {
      return sendJson(response, 200, {
        ok: true,
        data: cachedPublicBootstrap
      });
    }

    const db = await readDb();
    const normalizedTenants = ensureTenantFields(db);
    if (normalizedTenants) await persistDb(db, ["clinics", "subscriptions"]);
    const auth = await resolveRequestAuth(db, request);

    if (method === "GET" && url.pathname === "/api/auth/check") {
      const requiredLevel = auth.role === "super_admin" ? "super_admin" : "staff";
      if (!hasRequiredAccess(auth, requiredLevel)) {
        return sendError(response, 401, "كود الدخول غير صحيح.");
      }
      return sendJson(response, 200, {
        ok: true,
        data: {
          role: auth.role,
          clinic_id: auth.clinicId,
          auth_provider: auth.authProvider,
          access: requiredLevel
        }
      });
    }

    if (method === "POST" && url.pathname === "/api/auth/login") {
      const payload = await parseBody(request);
      const email = String(payload.email || "").trim().toLowerCase();
      const password = String(payload.password || "");
      if (!email || !password) return sendError(response, 400, "أدخل البريد الإلكتروني وكلمة المرور.");

      const result = await loginWithSupabase(email, password);
      if (result.error) return sendError(response, 401, result.error);

      const authUser = result.session.user;
      const dbUser = db.users.find(
        (user) =>
          user.auth_user_id === authUser?.id ||
          (authUser?.email && user.email && user.email.toLowerCase() === authUser.email.toLowerCase())
      );
      const role = userRoleFromAuth(authUser, dbUser);

      return sendJson(response, 200, {
        ok: true,
        data: {
          access_token: result.session.access_token,
          refresh_token: result.session.refresh_token,
          expires_in: result.session.expires_in,
          role,
          clinic_id: clinicIdFromAuth(authUser, dbUser),
          user: dbUser ? sanitizeUser(dbUser) : { id: authUser.id, email: authUser.email, role }
        }
      });
    }

    const requiredLevel = routeProtection(method, url, segments);
    if (requiredLevel && !hasRequiredAccess(auth, requiredLevel)) {
      return sendError(response, 401, "هذا المسار يحتاج صلاحية دخول.");
    }

    if (method === "GET" && url.pathname === "/api/bootstrap") {
      const data = auth.isStaff ? fullBootstrap(db, auth) : publicBootstrap(db);
      if (!auth.isStaff && !auth.accessCode) setPublicBootstrapCache(data);
      return sendJson(response, 200, {
        ok: true,
        data
      });
    }

    if (method === "GET" && url.pathname === "/api/doctors") {
      return sendJson(response, 200, {
        ok: true,
        data: filterDoctors(db, url.searchParams)
      });
    }

    if (method === "GET" && segments[1] === "clinics" && segments[2] && segments[3] === "public") {
      const clinic = findClinicBySlug(db, segments[2]);
      if (!clinic || clinic.status !== "active") return sendError(response, 404, "العيادة غير متاحة حالياً.");
      const clinicDoctors = db.doctors
        .filter((doctor) => doctor.clinic_id === clinic.id && doctor.status === "active")
        .map((doctor) => publicDoctor(db, doctor));
      return sendJson(response, 200, {
        ok: true,
        data: {
          clinic: publicClinic(clinic),
          doctors: clinicDoctors
        }
      });
    }

    if (method === "GET" && segments[1] === "doctors" && segments[2]) {
      const doctor = findDoctor(db, segments[2]);
      if (!doctor) return sendError(response, 404, "لم يتم العثور على الطبيب.");
      const clinic = findClinic(db, doctor.clinic_id);
      if (!clinic || clinic.status !== "active") {
        return sendError(response, 404, "الطبيب غير متاح للحجز حالياً.");
      }
      return sendJson(response, 200, {
        ok: true,
        data: publicDoctor(db, doctor)
      });
    }

    if (method === "GET" && segments[1] === "availability" && segments[2]) {
      const doctor = findDoctor(db, segments[2]);
      if (!doctor) return sendError(response, 404, "لم يتم العثور على الطبيب.");
      const clinic = findClinic(db, doctor.clinic_id);
      if (!clinic || clinic.status !== "active") {
        return sendError(response, 404, "الطبيب غير متاح للحجز حالياً.");
      }
      return sendJson(response, 200, {
        ok: true,
        data: appointmentDays(db, doctor.id, 14)
      });
    }

    if (method === "POST" && url.pathname === "/api/clinic-registrations") {
      const payload = await parseBody(request);
      const result = createClinicRegistration(db, payload);
      if (result.error) return sendError(response, 400, result.error);
      await persistDb(db, ["clinics", "subscriptions"]);
      return sendJson(response, 201, {
        ok: true,
        data: publicClinic(result.clinic)
      });
    }

    if (method === "POST" && url.pathname === "/api/bookings") {
      const payload = await parseBody(request);
      const result = createBooking(db, payload);
      if (result.error) return sendError(response, 400, result.error, result);
      await persistDb(db, ["bookings", "notifications", "queueSessions"]);
      return sendJson(response, 201, {
        ok: true,
        data: publicBooking(db, result.booking)
      });
    }

    if (method === "GET" && segments[1] === "bookings" && segments[2]) {
      const booking = db.bookings.find((item) => item.booking_code === segments[2] || item.id === segments[2]);
      if (!booking) return sendError(response, 404, "لم يتم العثور على الحجز.");
      return sendJson(response, 200, {
        ok: true,
        data: publicBooking(db, booking)
      });
    }

    if (method === "PATCH" && segments[1] === "bookings" && segments[2] && segments[3] === "cancel") {
      const result = cancelBooking(db, segments[2]);
      if (result.error) return sendError(response, 400, result.error);
      await persistDb(db, ["bookings"]);
      return sendJson(response, 200, {
        ok: true,
        data: publicBooking(db, result.booking)
      });
    }

    if (method === "PATCH" && segments[1] === "bookings" && segments[2]) {
      const payload = await parseBody(request);
      const existingBooking = db.bookings.find((item) => item.booking_code === segments[2] || item.id === segments[2]);
      if (existingBooking && !canAccessClinic(auth, existingBooking.clinic_id)) return sendError(response, 403, "لا تملك صلاحية تعديل هذا الحجز.");
      const result = patchBooking(db, segments[2], payload);
      if (result.error) return sendError(response, 400, result.error);
      await persistDb(db, ["bookings"]);
      return sendJson(response, 200, {
        ok: true,
        data: publicBooking(db, result.booking)
      });
    }

    if (method === "GET" && url.pathname === "/api/track") {
      const code = url.searchParams.get("code");
      const phone = url.searchParams.get("phone");
      if (code) {
        const booking = db.bookings.find((item) => item.booking_code === code);
        if (!booking) return sendError(response, 404, "لم يتم العثور على الحجز.");
        return sendJson(response, 200, { ok: true, data: publicBooking(db, booking) });
      }
      if (phone) {
        const bookings = db.bookings
          .filter((booking) => booking.patient_phone === phone)
          .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
          .map((booking) => publicBooking(db, booking));
        return sendJson(response, 200, { ok: true, data: bookings });
      }
      return sendError(response, 400, "أدخل رقم الحجز أو رقم الهاتف.");
    }

    if (method === "GET" && url.pathname === "/api/dashboard/today") {
      if (auth.clinicId) {
        const requestedDoctorId = url.searchParams.get("doctorId");
        if (requestedDoctorId && !canAccessDoctor(db, auth, requestedDoctorId)) {
          return sendError(response, 403, "لا تملك صلاحية عرض هذا الطبيب.");
        }
        if (!requestedDoctorId) {
          const firstDoctor = db.doctors.find((doctor) => doctor.clinic_id === auth.clinicId);
          if (firstDoctor) url.searchParams.set("doctorId", firstDoctor.id);
        }
      }
      const dashboardData = todayDashboard(db, url.searchParams, auth);
      await persistDb(db, ["queueSessions"]);
      return sendJson(response, 200, {
        ok: true,
        data: dashboardData
      });
    }

    if (method === "PATCH" && segments[1] === "queue" && segments[2] && segments[3]) {
      const payload = await parseBody(request);
      if (!canAccessDoctor(db, auth, segments[2])) return sendError(response, 403, "لا تملك صلاحية تعديل هذا الدور.");
      const result = patchQueue(db, segments[2], segments[3], payload);
      if (result.error) return sendError(response, 400, result.error);
      await persistDb(db, ["queueSessions"]);
      return sendJson(response, 200, {
        ok: true,
        data: result.session
      });
    }

    if (method === "PATCH" && segments[1] === "schedules" && segments[2]) {
      const payload = await parseBody(request);
      const schedule = db.schedules.find((item) => item.id === segments[2]);
      if (schedule && !canAccessDoctor(db, auth, schedule.doctor_id)) return sendError(response, 403, "لا تملك صلاحية تعديل هذا الجدول.");
      const result = updateSchedule(db, segments[2], payload);
      if (result.error) return sendError(response, 400, result.error);
      await persistDb(db, ["schedules"]);
      return sendJson(response, 200, { ok: true, data: result.schedule });
    }

    if (method === "POST" && url.pathname === "/api/doctors") {
      const payload = await parseBody(request);
      if (auth.clinicId) payload.clinic_id = auth.clinicId;
      const result = createDoctor(db, payload);
      if (result.error) return sendError(response, 400, result.error);
      await persistDb(db, ["doctors", "schedules"]);
      return sendJson(response, 201, { ok: true, data: publicDoctor(db, result.doctor) });
    }

    if (method === "PATCH" && segments[1] === "doctors" && segments[2]) {
      const payload = await parseBody(request);
      if (!canAccessDoctor(db, auth, segments[2])) return sendError(response, 403, "لا تملك صلاحية تعديل هذا الطبيب.");
      if (auth.clinicId) delete payload.clinic_id;
      const result = updateDoctor(db, segments[2], payload);
      if (result.error) return sendError(response, 400, result.error);
      await persistDb(db, ["doctors"]);
      return sendJson(response, 200, { ok: true, data: publicDoctor(db, result.doctor) });
    }

    if (method === "PATCH" && segments[1] === "clinics" && segments[2] && segments[3] === "settings") {
      const payload = await parseBody(request);
      if (!canAccessClinic(auth, segments[2])) return sendError(response, 403, "لا تملك صلاحية تعديل إعدادات هذه العيادة.");
      const result = updateClinicSettings(db, segments[2], payload);
      if (result.error) return sendError(response, 400, result.error);
      await persistDb(db, ["clinics"]);
      return sendJson(response, 200, { ok: true, data: { ...publicClinic(result.clinic), ...clinicSaasSettings(result.clinic) } });
    }

    if (method === "PATCH" && segments[1] === "clinics" && segments[2]) {
      const payload = await parseBody(request);
      const clinic = findClinic(db, segments[2]);
      if (!clinic) return sendError(response, 404, "لم يتم العثور على العيادة.");
      ["name", "governorate", "area", "address", "phone", "status", "plan", "subscription_status"].forEach((field) => {
        if (payload[field] !== undefined) clinic[field] = payload[field];
      });
      if (!SAAS_PLANS.has(clinic.plan)) clinic.plan = "free";
      if (payload.status === "active") {
        clinic.registration_status = "approved";
        clinic.approved_at = clinic.approved_at || new Date().toISOString();
        clinic.subscription_status = clinic.subscription_status === "pending" ? "trial" : clinic.subscription_status;
      }
      if (payload.status === "inactive") {
        clinic.registration_status = clinic.registration_status === "pending" ? "rejected" : "inactive";
      }
      const subscription = (db.subscriptions || []).find((item) => item.clinic_id === clinic.id);
      if (subscription) {
        subscription.plan = clinic.plan || subscription.plan || "free";
        subscription.status = clinic.subscription_status || subscription.status || "trial";
        subscription.trial_ends_at = clinic.trial_ends_at || subscription.trial_ends_at || null;
        subscription.current_period_end = subscription.current_period_end || clinic.trial_ends_at || null;
        subscription.updated_at = new Date().toISOString();
      }
      await persistDb(db, ["clinics", "subscriptions"]);
      return sendJson(response, 200, { ok: true, data: clinic });
    }

    if (method === "GET" && url.pathname === "/api/admin/stats") {
      return sendJson(response, 200, { ok: true, data: stats(db) });
    }

    if (method === "POST" && url.pathname === "/api/specialties") {
      const payload = await parseBody(request);
      const result = upsertNamedItem(db.specialties, payload, "spec");
      if (result.error) return sendError(response, 400, result.error);
      await persistDb(db, ["specialties"]);
      return sendJson(response, 201, { ok: true, data: result.item });
    }

    if (method === "DELETE" && segments[1] === "specialties" && segments[2]) {
      db.specialties = db.specialties.filter((item) => item.id !== segments[2]);
      await persistDb(db, ["specialties"]);
      return sendJson(response, 200, { ok: true });
    }

    if (method === "POST" && url.pathname === "/api/governorates") {
      const payload = await parseBody(request);
      const result = upsertNamedItem(db.governorates, payload, "gov");
      if (result.error) return sendError(response, 400, result.error);
      await persistDb(db, ["governorates"]);
      return sendJson(response, 201, { ok: true, data: result.item });
    }

    return sendError(response, 404, "المسار غير موجود.");
  } catch (error) {
    return sendError(response, 500, "حدث خطأ غير متوقع.", { error: error.message });
  }
}

function serveStatic(request, response, url) {
  let requestedPath = decodeURIComponent(url.pathname);
  if (requestedPath === "/") requestedPath = "/index.html";

  const filePath = path.normalize(path.join(PUBLIC_DIR, requestedPath));
  const isInsidePublic = filePath.startsWith(PUBLIC_DIR);
  const finalPath = isInsidePublic && fs.existsSync(filePath) && fs.statSync(filePath).isFile()
    ? filePath
    : path.join(PUBLIC_DIR, "index.html");
  const extension = path.extname(finalPath).toLowerCase();
  const contentType = MIME_TYPES[extension] || "application/octet-stream";

  fs.readFile(finalPath, (error, content) => {
    if (error) {
      response.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
      response.end("Unable to load application.");
      return;
    }
    response.writeHead(200, {
      "Content-Type": contentType,
      "Cache-Control": "no-store"
    });
    response.end(content);
  });
}

function createAppServer() {
  return http.createServer((request, response) => {
    const url = new URL(request.url, `http://${request.headers.host}`);
    if (url.pathname.startsWith("/api/")) {
      handleApi(request, response, url);
      return;
    }
    serveStatic(request, response, url);
  });
}

const server = createAppServer();

if (require.main === module) {
  server.listen(PORT, () => {
    console.log(`Dawri Medical SaaS is running at http://localhost:${PORT}`);
  });
}

module.exports = {
  createAppServer,
  handleApi,
  serveStatic
};
