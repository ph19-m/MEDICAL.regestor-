import { api } from "./api.js?v=9";
import {
  bookingCard,
  bookingTable,
  clinicAccessCodeWhatsAppButton,
  clinicRegistrationOwnerWhatsAppButton,
  confirmationCard,
  dashboardStats,
  doctorCard,
  emptyState,
  escapeHtml,
  iqd,
  loadingSkeleton,
  optionList,
  queueStatusCard,
  statusBadge,
  whatsAppShareButton
} from "./components.js?v=9";

const app = document.querySelector("#app");

const state = {
  data: null,
  role: localStorage.getItem("dawri-role") || "patient",
  authToken: localStorage.getItem("dawri-auth-token") || "",
  timer: null,
  bookingDraft: {},
  dashboardDoctorId: localStorage.getItem("dawri-dashboard-doctor") || "",
  dashboardDate: ""
};

const roleLabels = {
  patient: "مريض",
  secretary: "سكرتير العيادة",
  clinic_admin: "مدير العيادة",
  super_admin: "مالك المنصة"
};

function setTitle(title) {
  document.title = title ? `${title} | دوري الطبي` : "دوري الطبي | Dawri Medical";
}

function clearTimer() {
  if (state.timer) {
    clearInterval(state.timer);
    state.timer = null;
  }
}

async function refreshData() {
  state.data = await api.bootstrap();
  if (state.dashboardDoctorId && !state.data.doctors.some((doctor) => doctor.id === state.dashboardDoctorId)) {
    state.dashboardDoctorId = "";
    localStorage.removeItem("dawri-dashboard-doctor");
  }
  if (!state.dashboardDoctorId && state.data.doctors.length) {
    state.dashboardDoctorId = state.data.doctors[0].id;
  }
  state.dashboardDate = state.dashboardDate || state.data.today;
}

function navigate(path) {
  history.pushState({}, "", path);
  route();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function queryParams() {
  return Object.fromEntries(new URLSearchParams(location.search));
}

function pageShell(content, options = {}) {
  const dashboardLink =
    state.role === "super_admin"
      ? `<a href="/admin" data-link>لوحة المالك</a>`
      : state.role === "secretary" || state.role === "clinic_admin"
        ? `<a href="/dashboard" data-link>لوحة العيادة</a>`
        : "";

  return `
    <header class="site-header">
      <a class="brand" href="/" data-link aria-label="دوري الطبي">
        <span class="brand-mark">د</span>
        <span>
          <strong>دوري الطبي</strong>
          <small>Dawri Medical</small>
        </span>
      </a>
      <nav class="site-nav" aria-label="التنقل الرئيسي">
        <a href="/doctors" data-link>الأطباء</a>
        <a href="/track" data-link>متابعة دوري</a>
        <a href="/clinic-register" data-link>سجل عيادتك</a>
        ${dashboardLink}
      </nav>
      <a class="role-pill" href="/login" data-link>${roleLabels[state.role] || "تسجيل الدخول"}</a>
    </header>
    ${options.fullBleed ? content : `<main>${content}</main>`}
  `;
}

function dashboardShell(activePath, content, title = "لوحة العيادة") {
  const links = [
    ["/dashboard", "الملخص"],
    ["/dashboard/today", "حجوزات اليوم"],
    ["/dashboard/bookings", "إدارة الحجوزات"],
    ["/dashboard/queue", "التحكم بالدور"],
    ["/dashboard/schedule", "جدول الدوام"],
    ["/dashboard/doctors", "الأطباء"],
    ["/dashboard/settings", "الإعدادات"]
  ];

  return pageShell(
    `
      <main class="dashboard-layout">
        <aside class="dashboard-sidebar">
          <h2>${title}</h2>
          <p>النظام مصمم حتى تقدر السكرتارية تنظم الدور بأقل خطوات.</p>
          <nav>
            ${links
              .map(
                ([href, label]) =>
                  `<a class="${activePath === href ? "active" : ""}" href="${href}" data-link>${label}</a>`
              )
              .join("")}
          </nav>
        </aside>
        <section class="dashboard-content">${content}</section>
      </main>
    `,
    { fullBleed: true }
  );
}

function adminShell(activePath, content) {
  const links = [
    ["/admin", "الإحصائيات"],
    ["/admin/clinics", "العيادات"],
    ["/admin/doctors", "الأطباء"],
    ["/admin/specialties", "الاختصاصات"],
    ["/admin/areas", "المحافظات والمناطق"],
    ["/admin/bookings", "الحجوزات"]
  ];

  return pageShell(
    `
      <main class="dashboard-layout admin-layout">
        <aside class="dashboard-sidebar">
          <h2>لوحة مالك المنصة</h2>
          <p>نظرة تشغيلية على المنصة والتحكم بالبيانات الأساسية.</p>
          <nav>
            ${links
              .map(
                ([href, label]) =>
                  `<a class="${activePath === href ? "active" : ""}" href="${href}" data-link>${label}</a>`
              )
              .join("")}
          </nav>
        </aside>
        <section class="dashboard-content">${content}</section>
      </main>
    `,
    { fullBleed: true }
  );
}

function render(html, title, options = {}) {
  setTitle(title);
  app.innerHTML = pageShell(html, options);
}

function toast(message, tone = "info") {
  const existing = document.querySelector(".toast");
  if (existing) existing.remove();
  const element = document.createElement("div");
  element.className = `toast ${tone}`;
  element.textContent = message;
  document.body.append(element);
  setTimeout(() => element.remove(), 3500);
}

function governorateAreas(governorateName) {
  const gov = state.data.governorates.find((item) => item.name === governorateName);
  return gov?.areas || state.data.governorates.flatMap((item) => item.areas);
}

function searchFilters(params = {}) {
  const areas = params.governorate ? governorateAreas(params.governorate) : state.data.governorates.flatMap((g) => g.areas);
  return `
    <form class="search-panel" id="doctor-search-form">
      <label>
        <span>ابحث عن طبيب أو عيادة</span>
        <input name="search" type="search" value="${escapeHtml(params.search || "")}" placeholder="مثلاً: أسنان، كرادة، د. أحمد" />
      </label>
      <label>
        <span>الاختصاص</span>
        <select name="specialty">${optionList(state.data.specialties, params.specialty, "كل الاختصاصات")}</select>
      </label>
      <label>
        <span>المحافظة</span>
        <select name="governorate" id="governorate-filter">${optionList(state.data.governorates, params.governorate, "كل المحافظات")}</select>
      </label>
      <label>
        <span>المنطقة</span>
        <select name="area" id="area-filter">${optionList(areas, params.area, "كل المناطق")}</select>
      </label>
      <button class="btn primary large" type="submit">بحث</button>
    </form>
  `;
}

function bindSearchForm() {
  const form = document.querySelector("#doctor-search-form");
  const govFilter = document.querySelector("#governorate-filter");
  const areaFilter = document.querySelector("#area-filter");
  if (!form) return;

  govFilter?.addEventListener("change", () => {
    areaFilter.innerHTML = optionList(governorateAreas(govFilter.value), "", "كل المناطق");
  });

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(form));
    const params = new URLSearchParams();
    Object.entries(data).forEach(([key, value]) => {
      if (value) params.set(key, value);
    });
    navigate(`/doctors?${params.toString()}`);
  });
}

function homePage() {
  const featured = state.data.doctors
    .filter((doctor) => doctor.status === "active" && doctor.clinic?.status === "active")
    .slice(0, 5);
  render(
    `
      <section class="hero">
        <div class="hero__overlay">
          <div class="hero__content">
            <span class="eyebrow">منصة عراقية لإدارة المواعيد والدور المباشر</span>
            <h1>احجز موعدك الطبي بدون انتظار</h1>
            <p>تابع رقم دورك مباشرة واذهب للعيادة فقط عند اقتراب موعدك</p>
            <div class="hero__actions">
              <a class="btn primary large" href="/doctors" data-link>احجز الآن</a>
              <a class="btn glass large" href="/clinic-register" data-link>سجل عيادتك</a>
            </div>
          </div>
        </div>
      </section>
      <main>
        <section class="section compact-up">
          ${searchFilters({})}
        </section>
        <section class="section">
          <div class="section-heading">
            <span class="eyebrow">كيف تعمل المنصة</span>
            <h2>احجز دورك، تابع رقمك، وروح للعيادة بس يقرب موعدك.</h2>
            <p>لا نعتمد على وقت ثابت فقط. نجمع الوقت التقريبي، رقم الدور، وحالة العيادة المباشرة حتى تكون التجربة أوضح للمريض والسكرتارية.</p>
          </div>
          <div class="steps-grid">
            ${["اختر الطبيب", "احجز الموعد", "تابع رقم دورك", "اذهب للعيادة عند اقتراب دورك"]
              .map((step, index) => `<article class="step"><span>${index + 1}</span><h3>${step}</h3></article>`)
              .join("")}
          </div>
        </section>
        <section class="section split-band">
          <div>
            <span class="eyebrow">للمرضى</span>
            <h2>انتظار أقل وتنظيم أوضح</h2>
            <ul class="check-list">
              <li>بدون اتصال</li>
              <li>انتظار أقل</li>
              <li>متابعة الدور مباشرة</li>
              <li>تذكير قبل الموعد</li>
              <li>معرفة عنوان العيادة</li>
            </ul>
          </div>
          <div>
            <span class="eyebrow">للعيادات</span>
            <h2>لوحة سهلة للسكرتارية والطبيب</h2>
            <ul class="check-list">
              <li>تقليل الاتصالات</li>
              <li>تنظيم المرضى</li>
              <li>تقليل الازدحام</li>
              <li>تقارير يومية</li>
              <li>تحكم مباشر بالدور الحالي</li>
            </ul>
          </div>
        </section>
        <section class="section">
          <div class="section-heading inline">
            <div>
              <span class="eyebrow">أطباء متاحون</span>
              <h2>أطباء متاحون للحجز الآن</h2>
            </div>
            <a class="btn secondary" href="/doctors" data-link>عرض كل الأطباء</a>
          </div>
          <div class="doctor-grid">${featured.map(doctorCard).join("")}</div>
        </section>
        <section class="clinic-cta">
          <div>
            <span class="eyebrow">للعيادات الخاصة</span>
            <h2>سجل عيادتك الآن وخل المرضى يتابعون دورهم بدون اتصالات متكررة.</h2>
          </div>
          <a class="btn primary large" href="/clinic-register" data-link>سجل عيادتك الآن</a>
        </section>
      </main>
    `,
    "الرئيسية",
    { fullBleed: true }
  );
  bindSearchForm();
}

async function doctorsPage() {
  const params = queryParams();
  const doctors = await api.doctors(params);
  render(
    `
      <section class="section page-title">
        <span class="eyebrow">البحث عن طبيب</span>
        <h1>اختار الطبيب والوقت التقريبي المناسب</h1>
        <p>دوري الطبي يجمع الوقت التقريبي، رقم الدور، وحالة العيادة المباشرة حتى ما تضطر تنتظر فترة طويلة.</p>
      </section>
      <section class="section compact-top">${searchFilters(params)}</section>
      <section class="section">
        <div class="doctor-grid">
          ${doctors.length ? doctors.map(doctorCard).join("") : emptyState("لا توجد نتائج مطابقة", "جرّب تغيير الاختصاص أو المحافظة أو المنطقة.")}
        </div>
      </section>
    `,
    "الأطباء"
  );
  bindSearchForm();
}

async function doctorProfilePage(id) {
  const doctor = await api.doctor(id);
  const clinic = doctor.clinic || {};
  const session = doctor.current_queue_status || {};
  render(
    `
      <section class="section profile-header">
        <div>
          <span class="eyebrow">${escapeHtml(doctor.specialty)}</span>
          <h1>${escapeHtml(doctor.name)}</h1>
          <p>${escapeHtml(doctor.bio)}</p>
          <div class="profile-actions">
            <a class="btn primary large" href="/book/${encodeURIComponent(doctor.id)}" data-link>احجز الآن</a>
            <a class="btn secondary large" href="/track" data-link>متابعة دوري</a>
          </div>
        </div>
        <aside class="profile-summary">
          <dl class="meta-grid">
            <div><dt>العيادة</dt><dd>${escapeHtml(clinic.name)}</dd></div>
            <div><dt>الموقع</dt><dd>${escapeHtml(clinic.governorate)} / ${escapeHtml(clinic.area)}</dd></div>
            <div><dt>الكشفية</dt><dd>${iqd(doctor.fee)}</dd></div>
            <div><dt>الانتظار</dt><dd>${escapeHtml(doctor.average_waiting_time)}</dd></div>
          </dl>
        </aside>
      </section>
      <section class="section details-grid">
        <article>
          <h2>معلومات العيادة</h2>
          <p>${escapeHtml(clinic.address)}</p>
          <p>هاتف العيادة: <span dir="ltr">${escapeHtml(clinic.phone)}</span></p>
          <p>ساعات العمل: ${escapeHtml(doctor.working_hours)}</p>
        </article>
        <article class="map-placeholder">
          <span>خريطة العيادة</span>
          <strong>${escapeHtml(clinic.area)}</strong>
        </article>
        <article>
          <h2>الأيام المتاحة</h2>
          <div class="chip-list">
            ${(doctor.available_days || [])
              .map((day) => `<span class="chip ${day.is_full ? "disabled" : ""}">${escapeHtml(day.day_name)} · ${escapeHtml(day.date)}</span>`)
              .join("")}
          </div>
        </article>
        <article>
          <h2>حالة الدور الحالية</h2>
          <div class="queue-mini">
            <span>الدور الحالي</span>
            <strong>${escapeHtml(session.current_queue_number ?? 0)}</strong>
            ${statusBadge(session.status || "not_started")}
          </div>
          <p class="muted">الوقت تقريبي، والأفضل متابعة الدور قبل التوجه إلى العيادة.</p>
        </article>
      </section>
    `,
    doctor.name
  );
}

async function clinicPublicPage(slug) {
  const data = await api.clinicPublic(slug);
  const clinic = data.clinic;
  const doctors = data.doctors || [];
  render(
    `
      <section class="section profile-header clinic-public-header">
        <div>
          <span class="eyebrow">صفحة عيادة خاصة</span>
          <h1>${escapeHtml(clinic.name)}</h1>
          <p>${escapeHtml(clinic.address)}</p>
          <div class="profile-actions">
            <a class="btn primary large" href="#clinic-doctors">احجز عند طبيب</a>
            <a class="btn secondary large" href="/track" data-link>متابعة دوري</a>
          </div>
        </div>
        <aside class="profile-summary">
          <dl class="meta-grid">
            <div><dt>المحافظة</dt><dd>${escapeHtml(clinic.governorate)}</dd></div>
            <div><dt>المنطقة</dt><dd>${escapeHtml(clinic.area)}</dd></div>
            <div><dt>الهاتف</dt><dd dir="ltr">${escapeHtml(clinic.phone)}</dd></div>
            <div><dt>حالة العيادة</dt><dd>${statusBadge(clinic.status)}</dd></div>
          </dl>
        </aside>
      </section>
      <section class="section" id="clinic-doctors">
        <div class="section-heading inline">
          <div>
            <span class="eyebrow">أطباء العيادة</span>
            <h2>اختر الطبيب واحجز دورك</h2>
          </div>
          <span class="chip">${escapeHtml(doctors.length)} طبيب</span>
        </div>
        <div class="doctor-grid">
          ${doctors.length ? doctors.map(doctorCard).join("") : emptyState("لا يوجد أطباء مفعّلين بعد", "بعد موافقة العيادة يمكن إضافة الأطباء والجداول من لوحة العيادة.")}
        </div>
      </section>
    `,
    clinic.name
  );
}

async function bookingPage(doctorId) {
  const doctor = await api.doctor(doctorId);
  const availability = await api.availability(doctorId);
  if (state.bookingDraft.doctorId !== doctorId) {
    state.bookingDraft = {
      doctorId,
      date: availability[0]?.date || "",
      timeBlock: availability[0]?.time_blocks?.[0] || ""
    };
  }
  const selectedDay = availability.find((day) => day.date === state.bookingDraft.date) || availability[0];
  const selectedBlock = state.bookingDraft.timeBlock || selectedDay?.time_blocks?.[0] || "";

  render(
    `
      <section class="section page-title">
        <span class="eyebrow">حجز موعد</span>
        <h1>${escapeHtml(doctor.name)}</h1>
        <p>${escapeHtml(doctor.clinic?.name)} · ${escapeHtml(doctor.specialty)}</p>
      </section>
      <section class="section booking-flow">
        <div class="booking-steps">
          <article>
            <span class="step-number">1</span>
            <h2>اختر اليوم</h2>
            <div class="slot-grid">
              ${availability
                .map(
                  (day) => `
                    <button class="slot ${day.date === selectedDay?.date ? "selected" : ""} ${day.is_full ? "disabled" : ""}" data-date-choice="${escapeHtml(day.date)}" ${day.is_full ? "disabled" : ""}>
                      <strong>${escapeHtml(day.day_name)}</strong>
                      <span>${escapeHtml(day.date)}</span>
                      <small>${day.is_full ? "الحجوزات ممتلئة لهذا اليوم" : `متبقي ${day.remaining_capacity}`}</small>
                    </button>
                  `
                )
                .join("")}
            </div>
          </article>
          <article>
            <span class="step-number">2</span>
            <h2>اختر الوقت التقريبي</h2>
            <div class="slot-grid compact">
              ${(selectedDay?.time_blocks || [])
                .map(
                  (block) => `
                    <button class="slot ${block === selectedBlock ? "selected" : ""}" data-block-choice="${escapeHtml(block)}">
                      ${escapeHtml(block)}
                    </button>
                  `
                )
                .join("")}
            </div>
          </article>
          <article>
            <span class="step-number">3</span>
            <h2>بيانات المريض</h2>
            <form class="form-grid" id="booking-form">
              <input type="hidden" name="doctor_id" value="${escapeHtml(doctor.id)}" />
              <input type="hidden" name="booking_date" value="${escapeHtml(selectedDay?.date || "")}" />
              <input type="hidden" name="time_block" value="${escapeHtml(selectedBlock)}" />
              <label>
                <span>الاسم الكامل</span>
                <input name="patient_name" required placeholder="اكتب اسم المريض" />
              </label>
              <label>
                <span>رقم الهاتف</span>
                <input name="patient_phone" required dir="ltr" inputmode="tel" placeholder="07xxxxxxxxx" />
              </label>
              <label>
                <span>العمر</span>
                <input name="patient_age" type="number" min="0" max="120" placeholder="مثلاً 35" />
              </label>
              <label>
                <span>الجنس</span>
                <select name="patient_gender">
                  <option value="male">ذكر</option>
                  <option value="female">أنثى</option>
                </select>
              </label>
              <label class="wide">
                <span>ملاحظات / سبب الزيارة</span>
                <textarea name="visit_reason" rows="3" placeholder="اختياري"></textarea>
              </label>
              <div class="notice wide">
                <strong>الوقت تقريبي وليس وعداً بالدقيقة.</strong>
                <p>سيتم توليد رقم الدور تلقائياً حسب ترتيب الحجز، ويمكنك متابعة الدور مباشرة.</p>
              </div>
              <button class="btn primary large wide" type="submit">تأكيد الحجز</button>
            </form>
          </article>
        </div>
      </section>
    `,
    "حجز موعد"
  );
  bindBookingFlow();
}

function bindBookingFlow() {
  document.querySelectorAll("[data-date-choice]").forEach((button) => {
    button.addEventListener("click", () => {
      state.bookingDraft.date = button.dataset.dateChoice;
      state.bookingDraft.timeBlock = "";
      route();
    });
  });
  document.querySelectorAll("[data-block-choice]").forEach((button) => {
    button.addEventListener("click", () => {
      state.bookingDraft.timeBlock = button.dataset.blockChoice;
      route();
    });
  });

  document.querySelector("#booking-form")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const button = form.querySelector("button[type='submit']");
    button.disabled = true;
    button.textContent = "جاري تثبيت الحجز...";
    try {
      const booking = await api.createBooking(Object.fromEntries(new FormData(form)));
      await refreshData();
      navigate(`/booking-confirmation/${encodeURIComponent(booking.booking_code)}`);
    } catch (error) {
      toast(error.message, "error");
      if (error.payload?.details?.duplicate_code) {
        setTimeout(() => navigate(`/track/${error.payload.details.duplicate_code}`), 1200);
      }
    } finally {
      button.disabled = false;
      button.textContent = "تأكيد الحجز";
    }
  });
}

async function confirmationPage(code) {
  const booking = await api.booking(code);
  render(
    `
      <section class="section confirmation">
        ${confirmationCard(booking, window.location.origin)}
      </section>
    `,
    "تم تأكيد الحجز"
  );
}

function trackPage(code = "") {
  render(
    `
      <section class="section page-title">
        <span class="eyebrow">متابعة دوري</span>
        <h1>تابع رقم الدور وحالة العيادة مباشرة</h1>
        <p>أدخل رقم الحجز أو رقم الهاتف، وسيظهر لك الدور الحالي، المرضى المتبقين، ووقت الانتظار التقريبي. الصفحة تتحدث تلقائياً كل 15 ثانية.</p>
      </section>
      <section class="section">
        <form class="track-form" id="track-form">
          <label>
            <span>رقم الحجز</span>
            <input name="code" dir="ltr" value="${escapeHtml(code)}" placeholder="DW-100241" />
          </label>
          <span class="or">أو</span>
          <label>
            <span>رقم الهاتف</span>
            <input name="phone" dir="ltr" inputmode="tel" placeholder="07xxxxxxxxx" />
          </label>
          <button class="btn primary large" type="submit">متابعة</button>
        </form>
        <div id="track-result">${code ? loadingSkeleton(4) : ""}</div>
      </section>
    `,
    "متابعة دوري"
  );
  bindTrackPage(code);
}

function bindTrackPage(code) {
  const form = document.querySelector("#track-form");
  form?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(form));
    if (data.code) {
      navigate(`/track/${encodeURIComponent(data.code.trim())}`);
      return;
    }
    if (data.phone) {
      await renderTrackByPhone(data.phone.trim());
      return;
    }
    toast("أدخل رقم الحجز أو رقم الهاتف.", "error");
  });

  if (code) {
    renderTrackResult(code);
    state.timer = setInterval(() => renderTrackResult(code, true), 15000);
  }
}

async function renderTrackByPhone(phone) {
  const result = document.querySelector("#track-result");
  result.innerHTML = `<div class="loading-inline">جاري البحث...</div>`;
  try {
    const bookings = await api.track({ phone });
    result.innerHTML = bookings.length
      ? `<div class="booking-list">${bookings
          .map(
            (booking) => `
              ${bookingCard(
                booking,
                `<a class="btn secondary" href="/track/${encodeURIComponent(booking.booking_code)}" data-link>فتح المتابعة</a>`
              )}
            `
          )
          .join("")}</div>`
      : emptyState("لا توجد حجوزات مرتبطة بهذا الرقم", "تأكد من رقم الهاتف أو جرّب رقم الحجز.");
  } catch (error) {
    result.innerHTML = `<div class="empty-state">${escapeHtml(error.message)}</div>`;
  }
}

async function renderTrackResult(code, silent = false) {
  const result = document.querySelector("#track-result");
  if (!result) return;
  try {
    const booking = await api.booking(code);
    result.innerHTML = `
      <article class="track-result live-track-card">
        <div class="section-heading inline">
          <div>
            <span class="eyebrow">الحجز ${escapeHtml(booking.booking_code)}</span>
            <h2>${escapeHtml(booking.doctor?.name)} · ${escapeHtml(booking.clinic?.name)}</h2>
            <p>${escapeHtml(booking.booking_date)} · الوقت التقريبي ${escapeHtml(booking.approximate_time)} · آخر تحديث الآن</p>
          </div>
          ${statusBadge(booking.status)}
        </div>
        ${queueStatusCard(booking)}
        <div class="button-row">
          <button class="btn danger" id="cancel-booking" ${["arrived", "in_consultation", "completed", "cancelled"].includes(booking.status) ? "disabled" : ""}>إلغاء الحجز</button>
          ${whatsAppShareButton(booking, window.location.origin)}
          <a class="btn secondary" href="/doctors/${encodeURIComponent(booking.doctor_id)}" data-link>صفحة الطبيب</a>
        </div>
      </article>
    `;
    document.querySelector("#cancel-booking")?.addEventListener("click", async () => {
      try {
        await api.cancelBooking(booking.booking_code);
        await renderTrackResult(booking.booking_code);
        toast("تم إلغاء الحجز.", "success");
      } catch (error) {
        toast(error.message, "error");
      }
    });
  } catch (error) {
    result.innerHTML = silent ? result.innerHTML : emptyState("تعذر تحميل الحجز", error.message);
  }
}

function clinicRegisterPage() {
  render(
    `
      <section class="section page-title">
        <span class="eyebrow">للعيادات</span>
        <h1>سجل عيادتك الآن</h1>
        <p>قدّم طلب الانضمام، ومالك المنصة يراجع العيادة ثم يفعّل رابطها ولوحة التحكم الخاصة بها.</p>
      </section>
      <section class="section narrow">
        <form class="form-grid" id="clinic-register-form">
          <label><span>اسم العيادة</span><input required name="clinic_name" placeholder="مثلاً عيادة الكرادة التخصصية" /></label>
          <label><span>رقم الهاتف</span><input required name="phone" dir="ltr" inputmode="tel" placeholder="07xxxxxxxxx" /></label>
          <label><span>اسم المسؤول</span><input name="owner_name" placeholder="اسم صاحب العيادة أو المدير" /></label>
          <label><span>واتساب المسؤول</span><input name="owner_phone" dir="ltr" inputmode="tel" placeholder="07xxxxxxxxx" /></label>
          <label><span>نوع العيادة</span><select name="clinic_type"><option>عيادة خاصة</option><option>مجمع طبي</option><option>مركز تخصصي</option><option>مختبر أو أشعة</option></select></label>
          <label><span>المحافظة</span><select name="governorate">${optionList(state.data.governorates, "", "اختر المحافظة")}</select></label>
          <label><span>المنطقة</span><input name="area" placeholder="المنطقة" /></label>
          <label class="wide"><span>العنوان</span><textarea rows="3" name="address"></textarea></label>
          <label class="wide"><span>ملاحظات إضافية</span><textarea rows="3" name="notes" placeholder="عدد الأطباء، الاختصاصات، أو أوقات الدوام المتوقعة"></textarea></label>
          <button class="btn primary large wide" type="submit">إرسال طلب التسجيل</button>
        </form>
        <div class="notice">
          <strong>ماذا يحدث بعد التسجيل؟</strong>
          <p>يبقى الطلب بانتظار موافقة مالك المنصة. كود الدخول لا يظهر تلقائياً، ويصل لمسؤول العيادة عبر واتساب من المالك فقط بعد التفعيل.</p>
        </div>
      </section>
    `,
    "سجل عيادتك"
  );
  document.querySelector("#clinic-register-form")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    try {
      const formPayload = Object.fromEntries(new FormData(event.currentTarget));
      const clinic = await api.createClinicRegistration(formPayload);
      const clinicForOwnerMessage = {
        ...clinic,
        ...formPayload,
        name: clinic.name || formPayload.clinic_name
      };
      toast("تم استلام طلب العيادة وهو الآن بانتظار موافقة مالك المنصة.", "success");
      event.currentTarget.reset();
      render(
        `
          <section class="section confirmation">
            <article class="confirmation-card">
              <div class="confirmation-card__hero">
                <span class="success-ring">✓</span>
                <span class="eyebrow">تم إرسال طلب التسجيل</span>
                <h1>${escapeHtml(clinic.name)}</h1>
                <p>الطلب الآن بانتظار موافقة مالك المنصة. بعد التفعيل يتم إرسال كود الدخول عبر واتساب، ولا يتم تسليم الكود تلقائياً من الموقع.</p>
              </div>
              <dl class="confirmation-details">
                <div><dt>حالة الطلب</dt><dd>بانتظار الموافقة</dd></div>
                <div><dt>المحافظة</dt><dd>${escapeHtml(clinic.governorate)}</dd></div>
                <div><dt>المنطقة</dt><dd>${escapeHtml(clinic.area)}</dd></div>
                <div><dt>الرابط بعد التفعيل</dt><dd dir="ltr">/clinics/${escapeHtml(clinic.slug)}</dd></div>
              </dl>
              <div class="button-row confirmation-actions">
                ${clinicRegistrationOwnerWhatsAppButton(clinicForOwnerMessage, window.location.origin)}
                <a class="btn primary large" href="/" data-link>العودة للرئيسية</a>
                <a class="btn secondary large" href="/login" data-link>دخول الإدارة</a>
              </div>
            </article>
          </section>
        `,
        "تم إرسال الطلب"
      );
    } catch (error) {
      toast(error.message, "error");
    }
  });
}

function loginPage() {
  const hasAccessCode = Boolean(localStorage.getItem("dawri-access-code"));
  const hasSupabaseSession = Boolean(localStorage.getItem("dawri-auth-token"));
  const hasSession = hasAccessCode || hasSupabaseSession;
  render(
    `
      <section class="section page-title">
        <span class="eyebrow">تسجيل الدخول</span>
        <h1>دخول آمن للعيادة وإدارة المنصة</h1>
        <p>المرضى يقدرون يحجزون ويتابعون بدون حساب. لوحة العيادة ولوحة المالك تحتاج كود دخول حتى نحمي بيانات الحجز والطابور.</p>
      </section>
      <section class="section">
        <div class="role-grid">
          <article class="role-card ${state.role === "patient" ? "active" : ""}">
            <strong>دخول كمريض</strong>
            <span>حجز موعد ومتابعة رقم الدور بدون كود.</span>
            <button class="btn primary" type="button" data-patient-login>متابعة كمريض</button>
          </article>

          <form class="role-card secure-login-card" id="supabase-login-form">
            <strong>دخول حساب SaaS</strong>
            <span>دخول فعلي عبر Supabase Auth للمالك، مدير العيادة، أو السكرتير.</span>
            <label>
              <span>البريد الإلكتروني</span>
              <input name="email" type="email" autocomplete="email" placeholder="name@clinic.com" required />
            </label>
            <label>
              <span>كلمة المرور</span>
              <input name="password" type="password" autocomplete="current-password" placeholder="كلمة المرور" required />
            </label>
            <button class="btn primary" type="submit">دخول بالحساب</button>
          </form>

          <form class="role-card secure-login-card" id="staff-login-form">
            <strong>دخول العيادة</strong>
            <span>خاص بالسكرتير أو مدير العيادة لإدارة حجوزات اليوم والطابور.</span>
            <label>
              <span>الدور</span>
              <select name="role">
                <option value="secretary" ${state.role === "secretary" ? "selected" : ""}>سكرتير العيادة</option>
                <option value="clinic_admin" ${state.role === "clinic_admin" ? "selected" : ""}>مدير العيادة</option>
              </select>
            </label>
            <label>
              <span>كود دخول العيادة</span>
              <input name="accessCode" type="password" autocomplete="current-password" placeholder="أدخل الكود" required />
            </label>
            <button class="btn primary" type="submit">دخول لوحة العيادة</button>
          </form>

          <form class="role-card secure-login-card" id="owner-login-form">
            <strong>دخول مالك المنصة</strong>
            <span>إدارة العيادات والاختصاصات وإحصائيات المنصة.</span>
            <input name="accessCode" type="password" autocomplete="current-password" placeholder="كود مالك المنصة" required />
            <button class="btn secondary" type="submit">دخول لوحة المالك</button>
          </form>
        </div>
        ${
          hasSession
            ? `<div class="panel auth-session-panel">
                <p>أنت مسجل حالياً كـ <strong>${roleLabels[state.role] || "مستخدم"}</strong>.</p>
                <button class="btn ghost" type="button" data-logout>تسجيل خروج</button>
              </div>`
            : ""
        }
      </section>
    `,
    "تسجيل الدخول"
  );

  document.querySelector("[data-patient-login]")?.addEventListener("click", async () => {
    state.role = "patient";
    state.authToken = "";
    localStorage.setItem("dawri-role", state.role);
    localStorage.removeItem("dawri-access-code");
    localStorage.removeItem("dawri-auth-token");
    await refreshData();
    toast("تم الدخول كمريض", "success");
    navigate("/");
  });

  document.querySelector("#supabase-login-form")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const email = form.email.value.trim();
    const password = form.password.value;
    try {
      const session = await api.authLogin({ email, password });
      state.role = session.role || "patient";
      state.authToken = session.access_token;
      localStorage.setItem("dawri-role", state.role);
      localStorage.setItem("dawri-auth-token", session.access_token);
      localStorage.removeItem("dawri-access-code");
      await refreshData();
      toast(`تم الدخول كـ ${roleLabels[state.role] || "مستخدم"}`, "success");
      navigate(state.role === "super_admin" ? "/admin" : state.role === "patient" ? "/" : "/dashboard");
    } catch (error) {
      toast(error.message || "تعذر تسجيل الدخول بالحساب.", "error");
    }
  });

  document.querySelector("#staff-login-form")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const role = form.role.value;
    const accessCode = form.accessCode.value.trim();
    try {
      await api.authCheck(role, accessCode);
      state.role = role;
      state.authToken = "";
      localStorage.setItem("dawri-role", role);
      localStorage.setItem("dawri-access-code", accessCode);
      localStorage.removeItem("dawri-auth-token");
      await refreshData();
      toast(`تم الدخول كـ ${roleLabels[role]}`, "success");
      navigate("/dashboard");
    } catch (error) {
      toast(error.message || "كود الدخول غير صحيح.", "error");
    }
  });

  document.querySelector("#owner-login-form")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const accessCode = event.currentTarget.accessCode.value.trim();
    try {
      await api.authCheck("super_admin", accessCode);
      state.role = "super_admin";
      state.authToken = "";
      localStorage.setItem("dawri-role", "super_admin");
      localStorage.setItem("dawri-access-code", accessCode);
      localStorage.removeItem("dawri-auth-token");
      await refreshData();
      toast("تم الدخول كمالك المنصة", "success");
      navigate("/admin");
    } catch (error) {
      toast(error.message || "كود مالك المنصة غير صحيح.", "error");
    }
  });

  document.querySelector("[data-logout]")?.addEventListener("click", async () => {
    state.role = "patient";
    state.authToken = "";
    localStorage.setItem("dawri-role", "patient");
    localStorage.removeItem("dawri-access-code");
    localStorage.removeItem("dawri-auth-token");
    await refreshData();
    toast("تم تسجيل الخروج", "success");
    navigate("/");
  });
  return;
}

function registerPage() {
  render(
    `
      <section class="section page-title">
        <span class="eyebrow">حساب جديد</span>
        <h1>تسجيل حساب مريض</h1>
        <p>في نسخة SaaS الحالية يمكن الحجز بدون حساب مريض، مع تجهيز النظام لإضافة حسابات المرضى لاحقاً.</p>
      </section>
      <section class="section narrow">
        <form class="form-grid">
          <label><span>الاسم الكامل</span><input placeholder="اسمك" /></label>
          <label><span>رقم الهاتف</span><input dir="ltr" placeholder="07xxxxxxxxx" /></label>
          <label><span>البريد الإلكتروني</span><input type="email" placeholder="optional@email.com" /></label>
          <button class="btn primary large wide" type="button">إنشاء حساب تجريبي</button>
        </form>
      </section>
    `,
    "تسجيل"
  );
}

function doctorSelect(doctors) {
  return `
    <label class="inline-field">
      <span>الطبيب</span>
      <select id="dashboard-doctor">
        ${doctors
          .map((doctor) => `<option value="${escapeHtml(doctor.id)}" ${doctor.id === state.dashboardDoctorId ? "selected" : ""}>${escapeHtml(doctor.name)} - ${escapeHtml(doctor.specialty)}</option>`)
          .join("")}
      </select>
    </label>
  `;
}

async function dashboardTodayPage(activePath = "/dashboard") {
  if (!state.data.doctors.length) {
    app.innerHTML = dashboardShell(
      activePath,
      `
        <div class="dashboard-toolbar">
          <div>
            <span class="eyebrow">إعداد العيادة</span>
            <h1>ابدأ بإضافة أول طبيب</h1>
          </div>
        </div>
        <section class="panel onboarding-panel">
          <h2>عيادتك جاهزة للتفعيل التشغيلي</h2>
          <p>بعد موافقة مالك المنصة، الخطوة التالية هي إضافة الطبيب وتحديد جدول الدوام حتى تظهر المواعيد للمرضى في صفحة العيادة.</p>
          <div class="button-row">
            <a class="btn primary" href="/dashboard/doctors" data-link>إضافة طبيب</a>
            <a class="btn secondary" href="/dashboard/settings" data-link>بيانات العيادة</a>
          </div>
        </section>
      `,
      "لوحة العيادة"
    );
    setTitle("لوحة العيادة");
    return;
  }

  const data = await api.todayDashboard({
    doctorId: state.dashboardDoctorId || state.data.doctors[0]?.id,
    date: state.dashboardDate || state.data.today
  });
  state.dashboardDoctorId = data.doctor?.id || state.dashboardDoctorId;
  localStorage.setItem("dawri-dashboard-doctor", state.dashboardDoctorId);

  app.innerHTML = dashboardShell(
    activePath,
    `
      <div class="dashboard-toolbar">
        <div>
          <span class="eyebrow">اليوم ${escapeHtml(data.date)}</span>
          <h1>${escapeHtml(data.doctor?.name || "لا يوجد طبيب")}</h1>
        </div>
        ${doctorSelect(state.data.doctors)}
      </div>
      ${dashboardStats([
        { label: "حجوزات اليوم", value: data.metrics.today_bookings, tone: "blue", caption: "Today's bookings" },
        { label: "بانتظار الدور", value: data.metrics.waiting_patients, tone: "green", caption: "Waiting patients" },
        { label: "تم الانتهاء", value: data.metrics.completed_patients, caption: "Completed" },
        { label: "غائب", value: data.metrics.absent_patients, tone: "amber", caption: "Absent" },
        { label: "ملغي", value: data.metrics.cancelled_bookings, tone: "red", caption: "Cancelled" },
        { label: "الدور الحالي", value: data.session?.current_queue_number ?? 0, tone: "blue", caption: "Current queue" }
      ])}
      ${queueControlPanel(data)}
      <section class="panel">
        <div class="section-heading inline">
          <div>
            <span class="eyebrow">إدارة الحجوزات</span>
            <h2>قائمة المرضى لهذا اليوم</h2>
          </div>
          ${statusBadge(data.session?.status || "not_started")}
        </div>
        ${bookingTable(data.bookings, true, {
          whatsappEnabled: data.clinic_settings?.whatsapp_booking_enabled !== false,
          origin: window.location.origin
        })}
      </section>
    `,
    "لوحة العيادة"
  );
  setTitle("لوحة العيادة");
  bindDashboardControls(data);
}

function queueControlPanel(data) {
  return `
    <section class="panel queue-control">
      <div>
        <span class="eyebrow">الدور الحالي</span>
        <strong>${escapeHtml(data.session?.current_queue_number ?? 0)}</strong>
        <p>${escapeHtml(data.session?.delay_message || "لا يوجد تأخير معلن حالياً.")}</p>
      </div>
      <div class="queue-buttons">
        <button class="btn secondary" data-queue-action="previous">المريض السابق</button>
        <button class="btn primary" data-queue-action="next">المريض التالي</button>
        <button class="btn secondary" data-session-status="open">استئناف الدور</button>
        <button class="btn warning" data-session-status="paused">إيقاف الدور مؤقتاً</button>
        <button class="btn warning" data-session-status="doctor_absent">الطبيب غير موجود</button>
        <button class="btn danger" data-session-status="closed">إغلاق العيادة</button>
      </div>
      <form class="manual-queue" id="manual-queue-form">
        <label>
          <span>تعيين الدور الحالي يدوياً</span>
          <input name="queue" type="number" min="0" value="${escapeHtml(data.session?.current_queue_number ?? 0)}" />
        </label>
        <button class="btn secondary" type="submit">تثبيت</button>
      </form>
      <form class="manual-queue" id="delay-form">
        <label>
          <span>سبب التأخير</span>
          <input name="delay_reason" value="${escapeHtml(data.session?.delay_reason || data.session?.delay_message || "")}" placeholder="مثلاً الطبيب متأخر بسبب عملية طارئة" />
        </label>
        <label>
          <span>مدة التأخير المتوقعة بالدقائق</span>
          <input name="delay_duration_minutes" type="number" min="0" value="${escapeHtml(data.session?.delay_duration_minutes || 0)}" />
        </label>
        <button class="btn warning" type="submit">تثبيت التأخير</button>
      </form>
    </section>
  `;
}

function bindDashboardControls(data) {
  document.querySelector("#dashboard-doctor")?.addEventListener("change", (event) => {
    state.dashboardDoctorId = event.currentTarget.value;
    localStorage.setItem("dawri-dashboard-doctor", state.dashboardDoctorId);
    route();
  });

  document.querySelectorAll("[data-queue-action]").forEach((button) => {
    button.addEventListener("click", async () => {
      try {
        await api.updateQueue(data.doctor.id, data.date, { action: button.dataset.queueAction });
        route();
      } catch (error) {
        toast(error.message, "error");
      }
    });
  });

  document.querySelectorAll("[data-session-status]").forEach((button) => {
    button.addEventListener("click", async () => {
      try {
        await api.updateQueue(data.doctor.id, data.date, { status: button.dataset.sessionStatus });
        route();
      } catch (error) {
        toast(error.message, "error");
      }
    });
  });

  document.querySelector("#manual-queue-form")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const queue = new FormData(event.currentTarget).get("queue");
    try {
      await api.updateQueue(data.doctor.id, data.date, { action: "set", value: queue });
      route();
    } catch (error) {
      toast(error.message, "error");
    }
  });

  document.querySelector("#delay-form")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    try {
      await api.updateQueue(data.doctor.id, data.date, {
        delay_reason: formData.get("delay_reason"),
        delay_duration_minutes: formData.get("delay_duration_minutes")
      });
      route();
    } catch (error) {
      toast(error.message, "error");
    }
  });

  document.querySelectorAll("[data-booking-action]").forEach((button) => {
    button.addEventListener("click", async () => {
      try {
        await api.updateBooking(button.dataset.code, { status: button.dataset.bookingAction });
        route();
      } catch (error) {
        toast(error.message, "error");
      }
    });
  });
}

async function dashboardSchedulePage() {
  const doctorId = state.dashboardDoctorId || state.data.doctors[0]?.id;
  const doctor = state.data.doctors.find((item) => item.id === doctorId) || state.data.doctors[0];
  const schedules = state.data.schedules.filter((schedule) => schedule.doctor_id === doctor?.id);
  app.innerHTML = dashboardShell(
    "/dashboard/schedule",
    `
      <div class="dashboard-toolbar">
        <div>
          <span class="eyebrow">إدارة الجدول</span>
          <h1>جدول دوام الطبيب</h1>
        </div>
        ${doctorSelect(state.data.doctors)}
      </div>
      <section class="panel">
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>اليوم</th>
                <th>البداية</th>
                <th>النهاية</th>
                <th>أقصى عدد</th>
                <th>متوسط الكشف</th>
                <th>الحجز</th>
                <th>حفظ</th>
              </tr>
            </thead>
            <tbody>
              ${schedules
                .map(
                  (schedule) => `
                    <tr>
                      <td>${escapeHtml(schedule.day_of_week)}</td>
                      <td><input class="table-input" data-field="start_time" data-id="${escapeHtml(schedule.id)}" value="${escapeHtml(schedule.start_time)}" /></td>
                      <td><input class="table-input" data-field="end_time" data-id="${escapeHtml(schedule.id)}" value="${escapeHtml(schedule.end_time)}" /></td>
                      <td><input class="table-input" type="number" data-field="max_patients" data-id="${escapeHtml(schedule.id)}" value="${escapeHtml(schedule.max_patients)}" /></td>
                      <td><input class="table-input" type="number" data-field="average_consultation_minutes" data-id="${escapeHtml(schedule.id)}" value="${escapeHtml(schedule.average_consultation_minutes)}" /></td>
                      <td>
                        <select class="table-input" data-field="is_active" data-id="${escapeHtml(schedule.id)}">
                          <option value="true" ${schedule.is_active ? "selected" : ""}>مفتوح</option>
                          <option value="false" ${!schedule.is_active ? "selected" : ""}>مغلق</option>
                        </select>
                      </td>
                      <td><button class="tiny-btn" data-save-schedule="${escapeHtml(schedule.id)}">حفظ</button></td>
                    </tr>
                  `
                )
                .join("")}
            </tbody>
          </table>
        </div>
      </section>
    `,
    "جدول الدوام"
  );
  setTitle("جدول الدوام");
  document.querySelector("#dashboard-doctor")?.addEventListener("change", (event) => {
    state.dashboardDoctorId = event.currentTarget.value;
    localStorage.setItem("dawri-dashboard-doctor", state.dashboardDoctorId);
    route();
  });
  document.querySelectorAll("[data-save-schedule]").forEach((button) => {
    button.addEventListener("click", async () => {
      const id = button.dataset.saveSchedule;
      const fields = [...document.querySelectorAll(`[data-id="${CSS.escape(id)}"]`)];
      const payload = {};
      fields.forEach((field) => {
        payload[field.dataset.field] = field.dataset.field === "is_active" ? field.value === "true" : field.value;
      });
      try {
        await api.updateSchedule(id, payload);
        await refreshData();
        toast("تم تحديث جدول الدوام.", "success");
        route();
      } catch (error) {
        toast(error.message, "error");
      }
    });
  });
}

function dashboardDoctorsPage() {
  app.innerHTML = dashboardShell(
    "/dashboard/doctors",
    `
      <div class="dashboard-toolbar">
        <div>
          <span class="eyebrow">إدارة الأطباء</span>
          <h1>إضافة وتعديل الأطباء</h1>
        </div>
      </div>
      <section class="panel">
        <form class="form-grid" id="doctor-create-form">
          <label><span>اسم الطبيب</span><input name="name" required placeholder="د. اسم الطبيب" /></label>
          <label><span>الاختصاص</span><select name="specialty">${optionList(state.data.specialties, "", "اختر الاختصاص")}</select></label>
          <label><span>العيادة</span><select name="clinic_id">${state.data.clinics.map((clinic) => `<option value="${escapeHtml(clinic.id)}">${escapeHtml(clinic.name)}</option>`).join("")}</select></label>
          <label><span>الكشفية</span><input name="fee" type="number" min="0" placeholder="25000" /></label>
          <label class="wide"><span>نبذة</span><textarea name="bio" rows="3"></textarea></label>
          <button class="btn primary wide" type="submit">إضافة طبيب</button>
        </form>
      </section>
      <section class="doctor-list-admin">
        ${state.data.doctors
          .map(
            (doctor) => `
              <article class="admin-row">
                <div>
                  <h3>${escapeHtml(doctor.name)}</h3>
                  <p>${escapeHtml(doctor.specialty)} · ${escapeHtml(doctor.clinic?.name || "")}</p>
                </div>
                ${statusBadge(doctor.status)}
                <button class="tiny-btn" data-toggle-doctor="${escapeHtml(doctor.id)}" data-next-status="${doctor.status === "active" ? "inactive" : "active"}">
                  ${doctor.status === "active" ? "إيقاف" : "تفعيل"}
                </button>
              </article>
            `
          )
          .join("")}
      </section>
    `,
    "الأطباء"
  );
  setTitle("إدارة الأطباء");
  document.querySelector("#doctor-create-form")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    try {
      await api.createDoctor(Object.fromEntries(new FormData(event.currentTarget)));
      await refreshData();
      toast("تم إضافة الطبيب.", "success");
      route();
    } catch (error) {
      toast(error.message, "error");
    }
  });
  document.querySelectorAll("[data-toggle-doctor]").forEach((button) => {
    button.addEventListener("click", async () => {
      try {
        await api.updateDoctor(button.dataset.toggleDoctor, { status: button.dataset.nextStatus });
        await refreshData();
        route();
      } catch (error) {
        toast(error.message, "error");
      }
    });
  });
}

function dashboardSettingsPage() {
  const activeClinics = state.data.clinics.filter((clinic) => clinic.status === "active");
  app.innerHTML = dashboardShell(
    "/dashboard/settings",
    `
      <div class="dashboard-toolbar">
        <div>
          <span class="eyebrow">إعدادات العيادة</span>
          <h1>إعدادات التشغيل العامة</h1>
        </div>
      </div>
      <section class="panel">
        <div class="settings-grid">
          ${activeClinics
            .map(
              (clinic) => `
                <article>
                  <h3>${escapeHtml(clinic.name)}</h3>
                  <p>${escapeHtml(clinic.address)}</p>
                  <p>الهاتف: <span dir="ltr">${escapeHtml(clinic.phone)}</span></p>
                  <p>رابط العيادة: <a dir="ltr" href="/clinics/${encodeURIComponent(clinic.slug || clinic.id)}" data-link>/clinics/${escapeHtml(clinic.slug || clinic.id)}</a></p>
                  <p>الخطة: ${escapeHtml(clinic.plan || "trial")} · الاشتراك: ${escapeHtml(clinic.subscription_status || "trial")}</p>
                  ${statusBadge(clinic.status)}
                  <form class="clinic-settings-form" data-clinic-settings="${escapeHtml(clinic.id)}">
                    <label class="check-row">
                      <input type="checkbox" name="whatsapp_booking_enabled" ${clinic.whatsapp_booking_enabled !== false ? "checked" : ""} />
                      <span>تفعيل إرسال تفاصيل الحجز للمريض عبر واتساب من لوحة العيادة</span>
                    </label>
                    <label>
                      <span>رقم واتساب العيادة</span>
                      <input name="whatsapp_sender_phone" dir="ltr" inputmode="tel" placeholder="07xxxxxxxxx" value="${escapeHtml(clinic.whatsapp_sender_phone || clinic.phone || "")}" />
                    </label>
                    <label>
                      <span>طريقة الإرسال</span>
                      <select name="whatsapp_delivery_mode">
                        <option value="manual_handoff" ${clinic.whatsapp_delivery_mode !== "official_api_ready" ? "selected" : ""}>زر إرسال سريع عبر wa.me</option>
                        <option value="official_api_ready" ${clinic.whatsapp_delivery_mode === "official_api_ready" ? "selected" : ""}>جاهز لربط WhatsApp Business API لاحقاً</option>
                      </select>
                    </label>
                    <button class="btn primary" type="submit">حفظ إعدادات واتساب</button>
                  </form>
                </article>
              `
            )
            .join("")}
        </div>
        <div class="notice">
          <strong>وضع SaaS تشغيلي</strong>
          <p>البيانات محفوظة في قاعدة البيانات، وكل عيادة تملك إعدادات ورسائل واتساب خاصة بها. الإرسال الرسمي التلقائي بالكامل يحتاج WhatsApp Business API عند توفر مزود الرسائل.</p>
        </div>
      </section>
    `,
    "الإعدادات"
  );
  setTitle("الإعدادات");
  document.querySelectorAll("[data-clinic-settings]").forEach((form) => {
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const formData = new FormData(event.currentTarget);
      const payload = {
        whatsapp_booking_enabled: formData.get("whatsapp_booking_enabled") === "on",
        whatsapp_sender_phone: formData.get("whatsapp_sender_phone"),
        whatsapp_delivery_mode: formData.get("whatsapp_delivery_mode")
      };
      try {
        await api.updateClinicSettings(event.currentTarget.dataset.clinicSettings, payload);
        await refreshData();
        toast("تم حفظ إعدادات واتساب للعيادة.", "success");
        route();
      } catch (error) {
        toast(error.message, "error");
      }
    });
  });
}

function adminDashboardPage(activePath = "/admin") {
  const stats = state.data.stats;
  const content = `
    <div class="dashboard-toolbar">
      <div>
        <span class="eyebrow">إحصائيات المنصة</span>
        <h1>ملخص دوري الطبي</h1>
      </div>
    </div>
    ${dashboardStats([
      { label: "إجمالي الأطباء", value: stats.total_doctors, tone: "blue" },
      { label: "إجمالي العيادات", value: stats.total_clinics, tone: "green" },
      { label: "حجوزات اليوم", value: stats.today_bookings, tone: "blue" },
      { label: "عيادات فعالة", value: stats.active_clinics, tone: "green" },
      { label: "عيادات بانتظار الموافقة", value: stats.pending_clinic_approvals, tone: "amber" },
      { label: "اشتراكات Pro", value: stats.pro_subscriptions || 0, tone: "green" }
    ])}
    <section class="panel">
      <h2>نظام SaaS تشغيلي</h2>
      <p>النسخة الحالية تدعم تسجيل العيادات، الموافقات، عزل بيانات كل عيادة، متابعة الدور المباشر، وإرسال رسائل واتساب يدوية جاهزة من العيادة للمريض.</p>
    </section>
    <section class="admin-placeholder-grid">
      <article class="placeholder-card">
        <h3>الموافقة على العيادات</h3>
        <p>قائمة طلبات التسجيل، مراجعة بيانات العيادة، ثم تفعيلها أو تعطيلها.</p>
        <a class="btn secondary" href="/admin/clinics" data-link>إدارة العيادات</a>
      </article>
      <article class="placeholder-card">
        <h3>إدارة الأطباء</h3>
        <p>مراجعة الأطباء، الاختصاصات، الأجور، وحالة الظهور للمرضى.</p>
        <a class="btn secondary" href="/admin/doctors" data-link>إدارة الأطباء</a>
      </article>
      <article class="placeholder-card">
        <h3>إدارة الاختصاصات</h3>
        <p>توحيد الاختصاصات الطبية حتى تكون تجربة البحث واضحة وبسيطة.</p>
        <a class="btn secondary" href="/admin/specialties" data-link>إدارة الاختصاصات</a>
      </article>
      <article class="placeholder-card">
        <h3>المحافظات والمناطق</h3>
        <p>إدارة المحافظات والمناطق العراقية لتسهيل البحث المحلي.</p>
        <a class="btn secondary" href="/admin/areas" data-link>إدارة المناطق</a>
      </article>
    </section>
  `;
  app.innerHTML = adminShell(activePath, content);
  setTitle("لوحة مالك المنصة");
}

function adminClinicsPage() {
  const pendingCount = state.data.clinics.filter((clinic) => clinic.status === "pending").length;
  app.innerHTML = adminShell(
    "/admin/clinics",
    `
      <div class="dashboard-toolbar">
        <div>
          <span class="eyebrow">إدارة العيادات</span>
          <h1>الموافقات وحالة العيادات</h1>
          <p class="muted">طلبات بانتظار المراجعة: ${escapeHtml(pendingCount)}. كود العيادة يرسله المالك فقط عبر واتساب بعد الموافقة.</p>
        </div>
      </div>
      <section class="panel">
        <div class="table-wrap">
          <table>
            <thead><tr><th>العيادة</th><th>المسؤول</th><th>الموقع</th><th>الرابط</th><th>كود العيادة</th><th>الحالة</th><th>إجراء</th></tr></thead>
            <tbody>
              ${state.data.clinics
                .map(
                  (clinic) => `
                    <tr>
                      <td>
                        <strong>${escapeHtml(clinic.name)}</strong>
                        <small>${escapeHtml(clinic.clinic_type || "عيادة خاصة")}</small>
                      </td>
                      <td>
                        ${escapeHtml(clinic.owner_name || "-")}
                        <small dir="ltr">${escapeHtml(clinic.owner_phone || clinic.phone || "")}</small>
                      </td>
                      <td>${escapeHtml(clinic.governorate)} / ${escapeHtml(clinic.area)}</td>
                      <td><a href="/clinics/${encodeURIComponent(clinic.slug || clinic.id)}" data-link dir="ltr">/clinics/${escapeHtml(clinic.slug || clinic.id)}</a></td>
                      <td>
                        <code>${escapeHtml(clinic.access_code || "-")}</code>
                        <small>خاص بمالك المنصة فقط</small>
                      </td>
                      <td>
                        ${statusBadge(clinic.status)}
                        <small>الخطة: ${escapeHtml(clinic.plan || "free")}</small>
                        <small>نهاية التجربة: ${escapeHtml(clinic.trial_ends_at ? clinic.trial_ends_at.slice(0, 10) : "-")}</small>
                      </td>
                      <td>
                        <button class="tiny-btn" data-clinic-status="${escapeHtml(clinic.id)}" data-status="active">موافقة</button>
                        <button class="tiny-btn danger" data-clinic-status="${escapeHtml(clinic.id)}" data-status="inactive">تعطيل</button>
                        ${clinic.status === "active" && clinic.access_code ? clinicAccessCodeWhatsAppButton(clinic, window.location.origin) : ""}
                      </td>
                    </tr>
                  `
                )
                .join("")}
            </tbody>
          </table>
        </div>
      </section>
    `
  );
  setTitle("إدارة العيادات");
  document.querySelectorAll("[data-clinic-status]").forEach((button) => {
    button.addEventListener("click", async () => {
      try {
        await api.updateClinic(button.dataset.clinicStatus, { status: button.dataset.status });
        await refreshData();
        route();
      } catch (error) {
        toast(error.message, "error");
      }
    });
  });
}

function adminDoctorsPage() {
  app.innerHTML = adminShell(
    "/admin/doctors",
    `
      <div class="dashboard-toolbar"><div><span class="eyebrow">الأطباء</span><h1>كل أطباء المنصة</h1></div></div>
      <section class="doctor-list-admin">
        ${state.data.doctors
          .map(
            (doctor) => `
              <article class="admin-row">
                <div>
                  <h3>${escapeHtml(doctor.name)}</h3>
                  <p>${escapeHtml(doctor.specialty)} · ${escapeHtml(doctor.clinic?.name || "")}</p>
                </div>
                <strong>${iqd(doctor.fee)}</strong>
                ${statusBadge(doctor.status)}
              </article>
            `
          )
          .join("")}
      </section>
    `
  );
  setTitle("أطباء المنصة");
}

function adminSpecialtiesPage() {
  app.innerHTML = adminShell(
    "/admin/specialties",
    `
      <div class="dashboard-toolbar"><div><span class="eyebrow">الاختصاصات</span><h1>إدارة الاختصاصات</h1></div></div>
      <section class="panel">
        <form class="inline-create" id="specialty-form">
          <input name="name" placeholder="اختصاص جديد" />
          <button class="btn primary" type="submit">إضافة</button>
        </form>
        <div class="chip-list admin-chips">
          ${state.data.specialties
            .map(
              (specialty) => `
                <span class="chip">
                  ${escapeHtml(specialty.name)}
                  <button aria-label="حذف" data-delete-specialty="${escapeHtml(specialty.id)}">×</button>
                </span>
              `
            )
            .join("")}
        </div>
      </section>
    `
  );
  setTitle("الاختصاصات");
  document.querySelector("#specialty-form")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    try {
      await api.createSpecialty(Object.fromEntries(new FormData(event.currentTarget)));
      await refreshData();
      route();
    } catch (error) {
      toast(error.message, "error");
    }
  });
  document.querySelectorAll("[data-delete-specialty]").forEach((button) => {
    button.addEventListener("click", async () => {
      try {
        await api.deleteSpecialty(button.dataset.deleteSpecialty);
        await refreshData();
        route();
      } catch (error) {
        toast(error.message, "error");
      }
    });
  });
}

function adminAreasPage() {
  app.innerHTML = adminShell(
    "/admin/areas",
    `
      <div class="dashboard-toolbar"><div><span class="eyebrow">المحافظات والمناطق</span><h1>بيانات العراق الأساسية</h1></div></div>
      <section class="panel">
        <form class="inline-create" id="governorate-form">
          <input name="name" placeholder="محافظة جديدة" />
          <button class="btn primary" type="submit">إضافة</button>
        </form>
        <div class="settings-grid">
          ${state.data.governorates
            .map(
              (gov) => `
                <article>
                  <h3>${escapeHtml(gov.name)}</h3>
                  <p>${escapeHtml((gov.areas || []).join("، "))}</p>
                </article>
              `
            )
            .join("")}
        </div>
      </section>
    `
  );
  setTitle("المحافظات والمناطق");
  document.querySelector("#governorate-form")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    try {
      await api.createGovernorate(Object.fromEntries(new FormData(event.currentTarget)));
      await refreshData();
      route();
    } catch (error) {
      toast(error.message, "error");
    }
  });
}

function adminBookingsPage() {
  const bookings = [...state.data.bookings].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  app.innerHTML = adminShell(
    "/admin/bookings",
    `
      <div class="dashboard-toolbar"><div><span class="eyebrow">الحجوزات</span><h1>كل حجوزات المنصة</h1></div></div>
      <section class="panel">${bookingTable(bookings, false)}</section>
    `
  );
  setTitle("حجوزات المنصة");
}

async function notFoundPage() {
  render(
    `
      <section class="section page-title">
        <span class="eyebrow">404</span>
        <h1>الصفحة غير موجودة</h1>
        <p>الرابط المطلوب غير متوفر في هذه النسخة من دوري الطبي.</p>
        <a class="btn primary" href="/" data-link>العودة للرئيسية</a>
      </section>
    `,
    "غير موجود"
  );
}

function hasAccessCode() {
  return Boolean(localStorage.getItem("dawri-access-code") || localStorage.getItem("dawri-auth-token"));
}

function accessDeniedPage(kind = "staff") {
  const title = kind === "admin" ? "لوحة المالك محمية" : "لوحة العيادة محمية";
  const copy =
    kind === "admin"
      ? "تحتاج كود مالك المنصة حتى تدخل إلى الإدارة العامة."
      : "تحتاج كود العيادة حتى تدخل إلى حجوزات اليوم والتحكم بالدور.";
  render(
    `
      <section class="section page-title">
        <span class="eyebrow">دخول مطلوب</span>
        <h1>${title}</h1>
        <p>${copy}</p>
        <a class="btn primary" href="/login" data-link>تسجيل الدخول</a>
      </section>
    `,
    title
  );
}

async function route() {
  clearTimer();
  if (!state.data) await refreshData();

  const path = location.pathname;
  const parts = path.split("/").filter(Boolean).map(decodeURIComponent);

  try {
    if (path === "/") return homePage();
    if (path === "/doctors") return doctorsPage();
    if (parts[0] === "doctors" && parts[1]) return doctorProfilePage(parts[1]);
    if (parts[0] === "clinics" && parts[1]) return clinicPublicPage(parts[1]);
    if (parts[0] === "book" && parts[1]) return bookingPage(parts[1]);
    if (parts[0] === "booking-confirmation" && parts[1]) return confirmationPage(parts[1]);
    if (path === "/track") return trackPage();
    if (parts[0] === "track" && parts[1]) return trackPage(parts[1]);
    if (path === "/clinic-register") return clinicRegisterPage();
    if (path === "/login") return loginPage();
    if (path === "/register") return registerPage();
    if (path === "/dashboard" || path === "/dashboard/today" || path === "/dashboard/bookings" || path === "/dashboard/queue") {
      if (!["secretary", "clinic_admin", "super_admin"].includes(state.role) || !hasAccessCode()) return accessDeniedPage("staff");
      return dashboardTodayPage(path);
    }
    if (path === "/dashboard/schedule") {
      if (!["secretary", "clinic_admin", "super_admin"].includes(state.role) || !hasAccessCode()) return accessDeniedPage("staff");
      return dashboardSchedulePage();
    }
    if (path === "/dashboard/doctors") {
      if (!["clinic_admin", "super_admin"].includes(state.role) || !hasAccessCode()) return accessDeniedPage("staff");
      return dashboardDoctorsPage();
    }
    if (path === "/dashboard/settings") {
      if (!["clinic_admin", "super_admin"].includes(state.role) || !hasAccessCode()) return accessDeniedPage("staff");
      return dashboardSettingsPage();
    }
    if (path === "/admin") {
      if (state.role !== "super_admin" || !hasAccessCode()) return accessDeniedPage("admin");
      return adminDashboardPage();
    }
    if (path === "/admin/clinics") {
      if (state.role !== "super_admin" || !hasAccessCode()) return accessDeniedPage("admin");
      return adminClinicsPage();
    }
    if (path === "/admin/doctors") {
      if (state.role !== "super_admin" || !hasAccessCode()) return accessDeniedPage("admin");
      return adminDoctorsPage();
    }
    if (path === "/admin/specialties") {
      if (state.role !== "super_admin" || !hasAccessCode()) return accessDeniedPage("admin");
      return adminSpecialtiesPage();
    }
    if (path === "/admin/areas") {
      if (state.role !== "super_admin" || !hasAccessCode()) return accessDeniedPage("admin");
      return adminAreasPage();
    }
    if (path === "/admin/bookings") {
      if (state.role !== "super_admin" || !hasAccessCode()) return accessDeniedPage("admin");
      return adminBookingsPage();
    }
    return notFoundPage();
  } catch (error) {
    console.error(error);
    render(
      `
        <section class="section page-title">
          <span class="eyebrow">حدث خطأ</span>
          <h1>تعذر تحميل الصفحة</h1>
          <p>${escapeHtml(error.message)}</p>
          <button class="btn primary" id="retry-route">إعادة المحاولة</button>
        </section>
      `,
      "خطأ"
    );
    document.querySelector("#retry-route")?.addEventListener("click", () => {
      state.data = null;
      route();
    });
  }
}

document.addEventListener("click", (event) => {
  const link = event.target.closest("a[data-link]");
  if (!link) return;
  const url = new URL(link.href);
  if (url.origin !== location.origin) return;
  event.preventDefault();
  navigate(`${url.pathname}${url.search}`);
});

window.addEventListener("popstate", route);
route();
