export const STATUS_LABELS = {
  booked: "محجوز",
  confirmed: "مؤكد",
  arrived: "المريض حاضر",
  in_consultation: "داخل عند الطبيب",
  completed: "تم الانتهاء",
  absent: "غائب",
  cancelled: "ملغي",
  not_started: "لم تبدأ",
  active: "مفتوحة",
  open: "مفتوحة",
  delayed: "يوجد تأخير",
  paused: "متوقفة مؤقتاً",
  closed: "مغلقة",
  doctor_absent: "الطبيب غير موجود",
  pending: "بانتظار الموافقة",
  inactive: "غير مفعلة"
};

export const STATUS_TONE = {
  booked: "blue",
  confirmed: "green",
  arrived: "mint",
  in_consultation: "purple",
  completed: "gray",
  absent: "amber",
  cancelled: "red",
  not_started: "gray",
  active: "green",
  open: "green",
  paused: "amber",
  closed: "red",
  delayed: "amber",
  doctor_absent: "red",
  pending: "amber",
  inactive: "gray"
};

export function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export function iqd(value) {
  if (!value) return "غير محدد";
  return `${Number(value).toLocaleString("ar-IQ")} د.ع`;
}

function normalizeStatus(status) {
  return status === "active" ? "open" : status || "not_started";
}

export function queueStatusBadge(status, extraClass = "") {
  const normalized = normalizeStatus(status);
  const tone = STATUS_TONE[normalized] || "gray";
  return `<span class="status-badge ${tone} ${extraClass}">${escapeHtml(STATUS_LABELS[normalized] || normalized)}</span>`;
}

export function statusBadge(status) {
  return queueStatusBadge(status);
}

export function emptyState(title = "لا توجد بيانات", text = "غيّر الفلاتر أو جرّب لاحقاً.") {
  return `
    <div class="empty-state">
      <strong>${escapeHtml(title)}</strong>
      <p>${escapeHtml(text)}</p>
    </div>
  `;
}

export function loadingSkeleton(lines = 3) {
  return `
    <div class="loading-skeleton" aria-label="جاري التحميل">
      ${Array.from({ length: lines }, (_, index) => `<span style="--i:${index}"></span>`).join("")}
    </div>
  `;
}

export function doctorCard(doctor) {
  const clinic = doctor.clinic || {};
  const days = (doctor.working_days || []).slice(0, 5).join("، ");
  const nextDay = doctor.available_days?.find((day) => !day.is_full);

  return `
    <article class="doctor-card">
      <div class="doctor-card__top">
        <div class="avatar" aria-hidden="true">${escapeHtml(doctor.name?.replace("د. ", "").slice(0, 1) || "د")}</div>
        <div>
          <h3>${escapeHtml(doctor.name)}</h3>
          <p>${escapeHtml(doctor.specialty)} · ${escapeHtml(clinic.name || "")}</p>
        </div>
      </div>
      <dl class="meta-grid">
        <div><dt>المحافظة</dt><dd>${escapeHtml(clinic.governorate || "-")}</dd></div>
        <div><dt>المنطقة</dt><dd>${escapeHtml(clinic.area || "-")}</dd></div>
        <div><dt>الكشفية</dt><dd>${iqd(doctor.fee)}</dd></div>
        <div><dt>الانتظار</dt><dd>${escapeHtml(doctor.average_waiting_time || "تقريبي")}</dd></div>
      </dl>
      <div class="doctor-card__availability">
        ${queueStatusBadge(doctor.status)}
        <span>${nextDay ? `أقرب يوم: ${escapeHtml(nextDay.day_name)} ${escapeHtml(nextDay.date)}` : "لا توجد أيام متاحة حالياً"}</span>
      </div>
      <p class="muted small">أيام الدوام: ${escapeHtml(days || "غير محدد")}</p>
      <div class="rating-row">
        <span>التقييم: ${doctor.rating ? `${doctor.rating} / 5` : "قريباً"}</span>
        <span>${escapeHtml(clinic.area || "")}</span>
      </div>
      <div class="button-row">
        <a class="btn secondary" href="/doctors/${encodeURIComponent(doctor.id)}" data-link>عرض المواعيد</a>
        <a class="btn primary" href="/book/${encodeURIComponent(doctor.id)}" data-link>احجز الآن</a>
      </div>
    </article>
  `;
}

export function bookingCard(booking, actionHtml = "") {
  return `
    <article class="booking-card">
      <div>
        <span class="eyebrow">حجز ${escapeHtml(booking.booking_code)}</span>
        <h3>${escapeHtml(booking.doctor?.name || "طبيب")}</h3>
        <p>${escapeHtml(booking.clinic?.name || "")} · ${escapeHtml(booking.booking_date)} · ${escapeHtml(booking.approximate_time)}</p>
      </div>
      <div class="booking-card__queue">
        <span>رقم الدور</span>
        <strong>${escapeHtml(booking.queue_number)}</strong>
      </div>
      ${actionHtml ? `<div class="booking-card__action">${actionHtml}</div>` : ""}
    </article>
  `;
}

export function queueProgress(booking) {
  const session = booking.queue_session || {};
  const current = Number(session.current_queue_number || 0);
  const target = Math.max(Number(booking.queue_number || 0), 1);
  const percent = Math.max(0, Math.min(100, Number(booking.queue_progress_percent ?? Math.round((current / target) * 100))));

  return `
    <div class="queue-progress" role="progressbar" aria-valuenow="${percent}" aria-valuemin="0" aria-valuemax="100">
      <div class="queue-progress__top">
        <span>تقدم الدور</span>
        <strong>${percent}%</strong>
      </div>
      <div class="queue-progress__bar"><span style="width:${percent}%"></span></div>
      <div class="queue-progress__scale">
        <span>الدور الحالي ${escapeHtml(current)}</span>
        <span>دورك ${escapeHtml(target)}</span>
      </div>
    </div>
  `;
}

export function queueStatusCard(booking) {
  const session = booking.queue_session || {};
  const status = normalizeStatus(session.status || booking.clinic_status);
  const delayedDetails =
    status === "delayed"
      ? `
        <div class="delay-details">
          ${session.delay_reason || session.delay_message ? `<span>السبب: ${escapeHtml(session.delay_reason || session.delay_message)}</span>` : ""}
          ${session.delay_duration_minutes ? `<span>مدة التأخير المتوقعة: ${escapeHtml(session.delay_duration_minutes)} دقيقة</span>` : ""}
        </div>
      `
      : "";

  return `
    <section class="queue-card">
      <div>
        <span class="eyebrow">الدور الحالي</span>
        <strong>${escapeHtml(session.current_queue_number ?? 0)}</strong>
      </div>
      <div>
        <span class="eyebrow">رقم دورك</span>
        <strong>${escapeHtml(booking.queue_number)}</strong>
      </div>
      <div>
        <span class="eyebrow">المتبقي</span>
        <strong>${escapeHtml(booking.estimated_remaining_patients ?? 0)}</strong>
      </div>
      <div>
        <span class="eyebrow">الانتظار التقريبي</span>
        <strong>${escapeHtml(booking.estimated_waiting_time_minutes ?? 0)} دقيقة</strong>
      </div>
    </section>
    ${queueProgress(booking)}
    <div class="notice queue-notice ${status === "delayed" ? "warning" : ""}">
      <div class="notice-head">
        <strong>حالة العيادة</strong>
        ${queueStatusBadge(status)}
      </div>
      <p>${escapeHtml(booking.reminder_message || "يرجى متابعة الدور قبل التوجه إلى العيادة")}</p>
      ${delayedDetails}
    </div>
  `;
}

export function formatIraqiWhatsAppPhone(phone) {
  const digits = String(phone || "").replace(/\D/g, "");
  if (digits.startsWith("964")) return digits;
  if (digits.startsWith("07") && digits.length === 11) return `964${digits.slice(1)}`;
  if (digits.startsWith("7") && digits.length === 10) return `964${digits}`;
  return "";
}

export const PLATFORM_OWNER_WHATSAPP = "07767088664";

export function whatsAppLink(phone, message) {
  const normalizedPhone = formatIraqiWhatsAppPhone(phone);
  const encodedMessage = encodeURIComponent(message);
  return normalizedPhone
    ? `https://wa.me/${normalizedPhone}?text=${encodedMessage}`
    : `https://wa.me/?text=${encodedMessage}`;
}

export function whatsAppShareButton(booking, origin = window.location.origin) {
  const trackingLink = `${origin}/track/${encodeURIComponent(booking.booking_code)}`;
  const message = [
    "تم تأكيد حجزك في دوري الطبي",
    `المريض: ${booking.patient_name || ""}`,
    `الطبيب: ${booking.doctor?.name || ""}`,
    `العيادة: ${booking.clinic?.name || ""}`,
    `التاريخ: ${booking.booking_date}`,
    `الوقت التقريبي: ${booking.approximate_time}`,
    `رقم الدور: ${booking.queue_number}`,
    `رابط المتابعة: ${trackingLink}`
  ].join("\n");
  const href = whatsAppLink(booking.patient_phone, message);

  return `<a class="btn whatsapp large" href="${href}" target="_blank" rel="noopener">مشاركة عبر واتساب</a>`;
}

export function clinicRegistrationOwnerWhatsAppButton(clinic, origin = window.location.origin) {
  const message = [
    "طلب تسجيل عيادة جديد في دوري الطبي",
    `العيادة: ${clinic.name || ""}`,
    `المسؤول: ${clinic.owner_name || "-"}`,
    `إيميل المدير: ${clinic.admin_email || "-"}`,
    `واتساب المسؤول: ${clinic.owner_phone || clinic.phone || ""}`,
    `المحافظة/المنطقة: ${clinic.governorate || ""} / ${clinic.area || ""}`,
    `العنوان: ${clinic.address || ""}`,
    `الرابط بعد الموافقة: ${origin}/clinics/${encodeURIComponent(clinic.slug || clinic.id || "")}`,
    "يرجى مراجعة لوحة المالك والموافقة قبل إرسال كود الدخول."
  ].join("\n");

  return `<a class="btn whatsapp large" href="${whatsAppLink(PLATFORM_OWNER_WHATSAPP, message)}" target="_blank" rel="noopener">إرسال الطلب للمالك عبر واتساب</a>`;
}

export function clinicAccessCodeWhatsAppButton(clinic, origin = window.location.origin) {
  const phone = clinic.owner_phone || clinic.phone || "";
  if (!formatIraqiWhatsAppPhone(phone)) {
    return `<span class="tiny-note">لا يوجد رقم واتساب صالح</span>`;
  }

  const dashboardLink = `${origin}/login`;
  const clinicLink = `${origin}/clinics/${encodeURIComponent(clinic.slug || clinic.id || "")}`;
  const message = [
    "أهلاً بيكم في دوري الطبي",
    `تمت الموافقة على عيادتكم: ${clinic.name || ""}`,
    `رابط دخول لوحة العيادة: ${dashboardLink}`,
    `كود الدخول الخاص بالعيادة: ${clinic.access_code || ""}`,
    `رابط صفحة العيادة للمرضى: ${clinicLink}`,
    "يرجى عدم مشاركة الكود إلا مع السكرتير أو إدارة العيادة."
  ].join("\n");

  return `<a class="tiny-btn whatsapp" href="${whatsAppLink(phone, message)}" target="_blank" rel="noopener">إرسال الكود واتساب</a>`;
}

export function bookingWhatsAppButton(booking, origin = window.location.origin) {
  const message = [
    "تأكيد حجز من دوري الطبي",
    `العيادة: ${booking.clinic?.name || ""}`,
    `الطبيب: ${booking.doctor?.name || ""}`,
    `التاريخ: ${booking.booking_date || ""}`,
    `الوقت التقريبي: ${booking.approximate_time || ""}`,
    `رقم الدور: ${booking.queue_number || ""}`,
    `رابط المتابعة: ${origin}/track/${encodeURIComponent(booking.booking_code || "")}`,
    "يرجى متابعة رقم الدور قبل التوجه إلى العيادة."
  ].join("\n");

  return `<a class="tiny-btn whatsapp" href="${whatsAppLink(booking.patient_phone, message)}" target="_blank" rel="noopener">إرسال واتساب</a>`;
}

export function confirmationCard(booking, origin = window.location.origin) {
  const session = booking.queue_session || {};
  return `
    <article class="confirmation-card">
      <div class="confirmation-card__hero">
        <span class="success-ring">✓</span>
        <span class="eyebrow">تم تأكيد حجزك بنجاح</span>
        <h1>تم تأكيد حجزك بنجاح</h1>
        <p>يمكنك متابعة رقم الدور مباشرة قبل التوجه إلى العيادة لتقليل وقت الانتظار.</p>
      </div>
      <dl class="confirmation-details">
        <div><dt>رقم الحجز</dt><dd dir="ltr">${escapeHtml(booking.booking_code)}</dd></div>
        <div><dt>الطبيب</dt><dd>${escapeHtml(booking.doctor?.name)}</dd></div>
        <div><dt>العيادة</dt><dd>${escapeHtml(booking.clinic?.name)}</dd></div>
        <div><dt>التاريخ</dt><dd>${escapeHtml(booking.booking_date)}</dd></div>
        <div><dt>الوقت التقريبي</dt><dd>${escapeHtml(booking.approximate_time)}</dd></div>
        <div><dt>رقم الدور</dt><dd>${escapeHtml(booking.queue_number)}</dd></div>
        <div><dt>الدور الحالي</dt><dd>${escapeHtml(session.current_queue_number ?? 0)}</dd></div>
        <div><dt>المتبقي</dt><dd>${escapeHtml(booking.estimated_remaining_patients ?? 0)} مريض</dd></div>
      </dl>
      ${queueProgress(booking)}
      <div class="button-row confirmation-actions">
        <a class="btn primary large" href="/track/${encodeURIComponent(booking.booking_code)}" data-link>متابعة الحجز</a>
        ${whatsAppShareButton(booking, origin)}
        <a class="btn secondary large" href="/doctors" data-link>حجز آخر</a>
      </div>
    </article>
  `;
}

export function dashboardStats(items) {
  return `
    <section class="metric-grid dashboard-stats">
      ${items
        .map(
          (item) => `
            <article class="metric ${escapeHtml(item.tone || "")}">
              <span>${escapeHtml(item.label)}</span>
              <strong>${escapeHtml(item.value)}</strong>
              ${item.caption ? `<small>${escapeHtml(item.caption)}</small>` : ""}
            </article>
          `
        )
        .join("")}
    </section>
  `;
}

export function bookingTable(bookings, showActions = true, options = {}) {
  if (!bookings.length) {
    return emptyState("لا توجد حجوزات لهذا اليوم", "عند وصول حجوزات جديدة ستظهر هنا مباشرة.");
  }

  const whatsappEnabled = options.whatsappEnabled !== false;
  const origin = options.origin || window.location.origin;

  return `
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>رقم الدور</th>
            <th>المريض</th>
            <th>الهاتف</th>
            <th>الوقت التقريبي</th>
            <th>الحالة</th>
            <th>الملاحظات</th>
            ${showActions ? "<th>إجراءات</th>" : ""}
          </tr>
        </thead>
        <tbody>
          ${bookings
            .map(
              (booking) => `
                <tr>
                  <td><strong class="queue-number">${escapeHtml(booking.queue_number)}</strong></td>
                  <td>
                    <strong>${escapeHtml(booking.patient_name)}</strong>
                    <small dir="ltr">${escapeHtml(booking.booking_code)}</small>
                  </td>
                  <td dir="ltr">${escapeHtml(booking.patient_phone)}</td>
                  <td>${escapeHtml(booking.approximate_time)}</td>
                  <td>${queueStatusBadge(booking.status)}</td>
                  <td>${escapeHtml(booking.visit_reason || "-")}</td>
                  ${
                    showActions
                      ? `<td>
                          <div class="table-actions">
                            <button class="tiny-btn" data-booking-action="arrived" data-code="${escapeHtml(booking.booking_code)}">المريض حاضر</button>
                            <button class="tiny-btn" data-booking-action="in_consultation" data-code="${escapeHtml(booking.booking_code)}">إدخال المريض</button>
                            <button class="tiny-btn" data-booking-action="completed" data-code="${escapeHtml(booking.booking_code)}">تم الانتهاء</button>
                            <button class="tiny-btn danger" data-booking-action="absent" data-code="${escapeHtml(booking.booking_code)}">غائب</button>
                            ${whatsappEnabled ? bookingWhatsAppButton(booking, origin) : ""}
                          </div>
                        </td>`
                      : ""
                  }
                </tr>
              `
            )
            .join("")}
        </tbody>
      </table>
    </div>
  `;
}

export function optionList(items, selected = "", label = "الكل") {
  return `
    <option value="">${label}</option>
    ${items
      .map((item) => {
        const value = typeof item === "string" ? item : item.name;
        return `<option value="${escapeHtml(value)}" ${value === selected ? "selected" : ""}>${escapeHtml(value)}</option>`;
      })
      .join("")}
  `;
}
