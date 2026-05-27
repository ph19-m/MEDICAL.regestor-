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

function normalizeSessionStatus(status) {
  if (status === "active") return "open";
  return SESSION_STATUSES.has(status) ? status : "not_started";
}

function isClinicOpen(status) {
  return status === "open" || status === "active";
}

function publicDoctor(db, doctor) {
  const clinic = findClinic(db, doctor.clinic_id);
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
  const session = getOrCreateQueueSession(db, booking.doctor_id, booking.booking_date);
  const remainingPatients = Math.max(booking.queue_number - session.current_queue_number, 0);
  const schedule = findScheduleForDate(db, booking.doctor_id, booking.booking_date);
  const averageMinutes = schedule?.average_consultation_minutes || 10;

  return {
    ...booking,
    doctor,
    clinic,
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

  return { booking };
}

function todayDashboard(db, searchParams) {
  const date = searchParams.get("date") || todayISO();
  const doctorId = searchParams.get("doctorId") || db.doctors[0]?.id;
  const doctor = findDoctor(db, doctorId);
  const bookings = db.bookings
    .filter((booking) => booking.doctor_id === doctorId && booking.booking_date === date)
    .sort((a, b) => a.queue_number - b.queue_number)
    .map((booking) => publicBooking(db, booking));
  const session = doctor ? getOrCreateQueueSession(db, doctorId, date) : null;

  return {
    date,
    doctor: doctor ? publicDoctor(db, doctor) : null,
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

  const session = getOrCreateQueueSession(db, booking.doctor_id, booking.booking_date);
  if (isClinicOpen(session.status) && booking.queue_number <= session.current_queue_number) {
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
  const segments = url.pathname.split("/").filter(Boolean);
  const method = request.method;

  try {
    const db = await readDb();

    if (method === "GET" && url.pathname === "/api/bootstrap") {
      return sendJson(response, 200, {
        ok: true,
        data: {
          users: db.users.map(sanitizeUser),
          clinics: db.clinics,
          doctors: db.doctors.map((doctor) => publicDoctor(db, doctor)),
          schedules: db.schedules,
          bookings: db.bookings.map((booking) => publicBooking(db, booking)),
          queueSessions: db.queueSessions,
          notifications: db.notifications,
          specialties: db.specialties,
          governorates: db.governorates,
          stats: stats(db),
          today: todayISO()
        }
      });
    }

    if (method === "GET" && url.pathname === "/api/doctors") {
      return sendJson(response, 200, {
        ok: true,
        data: filterDoctors(db, url.searchParams)
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

    if (method === "POST" && url.pathname === "/api/bookings") {
      const payload = await parseBody(request);
      const result = createBooking(db, payload);
      if (result.error) return sendError(response, 400, result.error, result);
      await writeDb(db);
      return sendJson(response, 201, {
        ok: true,
        data: publicBooking(db, result.booking)
      });
    }

    if (method === "GET" && segments[1] === "bookings" && segments[2]) {
      const booking = db.bookings.find((item) => item.booking_code === segments[2] || item.id === segments[2]);
      if (!booking) return sendError(response, 404, "لم يتم العثور على الحجز.");
      await writeDb(db);
      return sendJson(response, 200, {
        ok: true,
        data: publicBooking(db, booking)
      });
    }

    if (method === "PATCH" && segments[1] === "bookings" && segments[2] && segments[3] === "cancel") {
      const result = cancelBooking(db, segments[2]);
      if (result.error) return sendError(response, 400, result.error);
      await writeDb(db);
      return sendJson(response, 200, {
        ok: true,
        data: publicBooking(db, result.booking)
      });
    }

    if (method === "PATCH" && segments[1] === "bookings" && segments[2]) {
      const payload = await parseBody(request);
      const result = patchBooking(db, segments[2], payload);
      if (result.error) return sendError(response, 400, result.error);
      await writeDb(db);
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
        await writeDb(db);
        return sendJson(response, 200, { ok: true, data: publicBooking(db, booking) });
      }
      if (phone) {
        const bookings = db.bookings
          .filter((booking) => booking.patient_phone === phone)
          .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
          .map((booking) => publicBooking(db, booking));
        await writeDb(db);
        return sendJson(response, 200, { ok: true, data: bookings });
      }
      return sendError(response, 400, "أدخل رقم الحجز أو رقم الهاتف.");
    }

    if (method === "GET" && url.pathname === "/api/dashboard/today") {
      await writeDb(db);
      return sendJson(response, 200, {
        ok: true,
        data: todayDashboard(db, url.searchParams)
      });
    }

    if (method === "PATCH" && segments[1] === "queue" && segments[2] && segments[3]) {
      const payload = await parseBody(request);
      const result = patchQueue(db, segments[2], segments[3], payload);
      if (result.error) return sendError(response, 400, result.error);
      await writeDb(db);
      return sendJson(response, 200, {
        ok: true,
        data: result.session
      });
    }

    if (method === "PATCH" && segments[1] === "schedules" && segments[2]) {
      const payload = await parseBody(request);
      const result = updateSchedule(db, segments[2], payload);
      if (result.error) return sendError(response, 400, result.error);
      await writeDb(db);
      return sendJson(response, 200, { ok: true, data: result.schedule });
    }

    if (method === "POST" && url.pathname === "/api/doctors") {
      const payload = await parseBody(request);
      const result = createDoctor(db, payload);
      if (result.error) return sendError(response, 400, result.error);
      await writeDb(db);
      return sendJson(response, 201, { ok: true, data: publicDoctor(db, result.doctor) });
    }

    if (method === "PATCH" && segments[1] === "doctors" && segments[2]) {
      const payload = await parseBody(request);
      const result = updateDoctor(db, segments[2], payload);
      if (result.error) return sendError(response, 400, result.error);
      await writeDb(db);
      return sendJson(response, 200, { ok: true, data: publicDoctor(db, result.doctor) });
    }

    if (method === "PATCH" && segments[1] === "clinics" && segments[2]) {
      const payload = await parseBody(request);
      const clinic = findClinic(db, segments[2]);
      if (!clinic) return sendError(response, 404, "لم يتم العثور على العيادة.");
      ["name", "governorate", "area", "address", "phone", "status"].forEach((field) => {
        if (payload[field] !== undefined) clinic[field] = payload[field];
      });
      await writeDb(db);
      return sendJson(response, 200, { ok: true, data: clinic });
    }

    if (method === "GET" && url.pathname === "/api/admin/stats") {
      return sendJson(response, 200, { ok: true, data: stats(db) });
    }

    if (method === "POST" && url.pathname === "/api/specialties") {
      const payload = await parseBody(request);
      const result = upsertNamedItem(db.specialties, payload, "spec");
      if (result.error) return sendError(response, 400, result.error);
      await writeDb(db);
      return sendJson(response, 201, { ok: true, data: result.item });
    }

    if (method === "DELETE" && segments[1] === "specialties" && segments[2]) {
      db.specialties = db.specialties.filter((item) => item.id !== segments[2]);
      await writeDb(db);
      return sendJson(response, 200, { ok: true });
    }

    if (method === "POST" && url.pathname === "/api/governorates") {
      const payload = await parseBody(request);
      const result = upsertNamedItem(db.governorates, payload, "gov");
      if (result.error) return sendError(response, 400, result.error);
      await writeDb(db);
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
    console.log(`Dawri Medical MVP is running at http://localhost:${PORT}`);
  });
}

module.exports = {
  createAppServer,
  handleApi,
  serveStatic
};
