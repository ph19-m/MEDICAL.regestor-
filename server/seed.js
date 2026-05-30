const WEEK_DAYS_AR = [
  "الأحد",
  "الإثنين",
  "الثلاثاء",
  "الأربعاء",
  "الخميس",
  "الجمعة",
  "السبت"
];

const APP_TIME_ZONE = "Asia/Baghdad";

function toDateString(date) {
  const parts = new Intl.DateTimeFormat("en", {
    timeZone: APP_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function addDays(date, amount) {
  const next = new Date(date);
  next.setDate(next.getDate() + amount);
  return next;
}

function createSeedData() {
  const now = new Date();
  const today = toDateString(now);
  const tomorrow = toDateString(addDays(now, 1));

  const governorates = [
    {
      id: "gov-baghdad",
      name: "بغداد",
      areas: ["الكرادة", "المنصور", "زيونة", "الأعظمية", "الحارثية"]
    },
    { id: "gov-basra", name: "البصرة", areas: ["العشار", "الجزائر", "البراضعية"] },
    { id: "gov-nineveh", name: "نينوى", areas: ["الموصل الجديدة", "الزهور", "الدواسة"] },
    { id: "gov-erbil", name: "أربيل", areas: ["عينكاوة", "شارع 60", "الإسكان"] },
    { id: "gov-najaf", name: "النجف", areas: ["حي الأمير", "شارع المدينة", "الحنانة"] },
    { id: "gov-karbala", name: "كربلاء", areas: ["حي الحسين", "العباسية", "سيف سعد"] },
    { id: "gov-dhiqar", name: "ذي قار", areas: ["الناصرية", "الشطرة", "سوق الشيوخ"] },
    { id: "gov-babil", name: "بابل", areas: ["الحلة", "الإمام", "جبلة"] },
    { id: "gov-anbar", name: "الأنبار", areas: ["الرمادي", "الفلوجة", "هيت"] },
    { id: "gov-diyala", name: "ديالى", areas: ["بعقوبة", "المقدادية", "الخالص"] }
  ];

  const specialties = [
    { id: "spec-dental", name: "طب الأسنان", status: "active" },
    { id: "spec-derma", name: "الجلدية", status: "active" },
    { id: "spec-obgyn", name: "النسائية والتوليد", status: "active" },
    { id: "spec-pediatrics", name: "الأطفال", status: "active" },
    { id: "spec-internal", name: "الباطنية", status: "active" },
    { id: "spec-eye", name: "العيون", status: "active" },
    { id: "spec-ent", name: "الأنف والأذن والحنجرة", status: "active" },
    { id: "spec-ortho", name: "العظام", status: "active" },
    { id: "spec-heart", name: "القلب", status: "active" },
    { id: "spec-urology", name: "المسالك البولية", status: "active" }
  ];

  const clinics = [
    {
      id: "clinic-karada-smile",
      name: "عيادة الكرادة التخصصية",
      governorate: "بغداد",
      area: "الكرادة",
      address: "بغداد، الكرادة داخل، قرب ساحة كهرمانة",
      phone: "07701234567",
      status: "active",
      slug: "clinic-karada-smile",
      access_code: "clinic-karada-2026",
      plan: "free",
      subscription_status: "trial",
      registration_status: "approved",
      whatsapp_booking_enabled: true,
      whatsapp_sender_phone: "07701234567",
      whatsapp_delivery_mode: "manual_handoff",
      created_at: now.toISOString()
    },
    {
      id: "clinic-mansour-care",
      name: "مركز المنصور الطبي",
      governorate: "بغداد",
      area: "المنصور",
      address: "بغداد، المنصور، شارع 14 رمضان",
      phone: "07801234567",
      status: "active",
      slug: "clinic-mansour-care",
      access_code: "clinic-mansour-2026",
      plan: "free",
      subscription_status: "trial",
      registration_status: "approved",
      whatsapp_booking_enabled: true,
      whatsapp_sender_phone: "07801234567",
      whatsapp_delivery_mode: "manual_handoff",
      created_at: now.toISOString()
    },
    {
      id: "clinic-basra-kids",
      name: "عيادة البصرة للأطفال",
      governorate: "البصرة",
      area: "العشار",
      address: "البصرة، العشار، قرب شارع الكويت",
      phone: "07711234567",
      status: "active",
      slug: "clinic-basra-kids",
      access_code: "clinic-basra-2026",
      plan: "free",
      subscription_status: "trial",
      registration_status: "approved",
      whatsapp_booking_enabled: true,
      whatsapp_sender_phone: "07711234567",
      whatsapp_delivery_mode: "manual_handoff",
      created_at: now.toISOString()
    },
    {
      id: "clinic-najaf-women",
      name: "عيادة الهدى النسائية",
      governorate: "النجف",
      area: "حي الأمير",
      address: "النجف، حي الأمير، مجمع العيادات",
      phone: "07811234567",
      status: "pending",
      slug: "clinic-najaf-women",
      access_code: "clinic-najaf-2026",
      plan: "free",
      subscription_status: "pending",
      registration_status: "pending",
      whatsapp_booking_enabled: true,
      whatsapp_sender_phone: "07811234567",
      whatsapp_delivery_mode: "manual_handoff",
      created_at: now.toISOString()
    },
    {
      id: "clinic-karbala-internal",
      name: "عيادة كربلاء الباطنية",
      governorate: "كربلاء",
      area: "حي الحسين",
      address: "كربلاء، حي الحسين، مقابل الصيدلية المركزية",
      phone: "07721234567",
      status: "active",
      slug: "clinic-karbala-internal",
      access_code: "clinic-karbala-2026",
      plan: "free",
      subscription_status: "trial",
      registration_status: "approved",
      whatsapp_booking_enabled: true,
      whatsapp_sender_phone: "07721234567",
      whatsapp_delivery_mode: "manual_handoff",
      created_at: now.toISOString()
    }
  ];

  const doctors = [
    {
      id: "doctor-ahmed-ali",
      clinic_id: "clinic-karada-smile",
      name: "د. أحمد علي",
      specialty: "طب الأسنان",
      bio: "طبيب أسنان بخبرة 12 سنة في علاج الجذور، الحشوات التجميلية، وتنظيم خطة الزيارة بدون انتظار طويل.",
      fee: 25000,
      gender: "male",
      status: "active",
      rating: 4.7,
      average_waiting_time: "25 دقيقة",
      created_at: now.toISOString()
    },
    {
      id: "doctor-zainab-hassan",
      clinic_id: "clinic-mansour-care",
      name: "د. زينب حسن",
      specialty: "الجلدية",
      bio: "اختصاص جلدية وتجميل، متابعة للحالات المزمنة وحب الشباب والحساسية مع أوقات زيارة منظمة.",
      fee: 30000,
      gender: "female",
      status: "active",
      rating: 4.8,
      average_waiting_time: "20 دقيقة",
      created_at: now.toISOString()
    },
    {
      id: "doctor-mohammed-kadhim",
      clinic_id: "clinic-basra-kids",
      name: "د. محمد كاظم",
      specialty: "الأطفال",
      bio: "اختصاص أطفال وحديثي الولادة، يستقبل الحالات اليومية والمتابعة الدورية للطفل.",
      fee: 20000,
      gender: "male",
      status: "active",
      rating: 4.6,
      average_waiting_time: "30 دقيقة",
      created_at: now.toISOString()
    },
    {
      id: "doctor-noor-alhuda",
      clinic_id: "clinic-najaf-women",
      name: "د. نور الهدى",
      specialty: "النسائية والتوليد",
      bio: "اختصاص نسائية وتوليد، متابعة الحمل والفحوصات الدورية بخصوصية وتنظيم.",
      fee: 35000,
      gender: "female",
      status: "active",
      rating: 4.9,
      average_waiting_time: "35 دقيقة",
      created_at: now.toISOString()
    },
    {
      id: "doctor-ali-hussein",
      clinic_id: "clinic-karbala-internal",
      name: "د. علي حسين",
      specialty: "الباطنية",
      bio: "اختصاص باطنية، متابعة الضغط والسكري وأمراض الجهاز الهضمي مع نظام دور مباشر.",
      fee: 25000,
      gender: "male",
      status: "active",
      rating: 4.5,
      average_waiting_time: "28 دقيقة",
      created_at: now.toISOString()
    }
  ];

  const scheduleDays = ["السبت", "الأحد", "الإثنين", "الثلاثاء", "الأربعاء"];
  const schedules = doctors.flatMap((doctor) =>
    scheduleDays.map((day) => ({
      id: `schedule-${doctor.id}-${day}`,
      doctor_id: doctor.id,
      day_of_week: day,
      start_time: "16:00",
      end_time: "21:00",
      max_patients: 25,
      average_consultation_minutes: 10,
      is_active: true
    }))
  );

  const users = [
    {
      id: "user-patient-demo",
      clinic_id: "clinic-karada-smile",
      name: "مريض تجريبي",
      phone: "07700000001",
      email: "patient@dawri.local",
      password_hash: "demo-auth-placeholder",
      role: "patient",
      created_at: now.toISOString()
    },
    {
      id: "user-secretary-demo",
      clinic_id: "clinic-karada-smile",
      name: "سكرتيرة العيادة",
      phone: "07700000002",
      email: "secretary@dawri.local",
      password_hash: "demo-auth-placeholder",
      role: "secretary",
      created_at: now.toISOString()
    },
    {
      id: "user-clinic-admin-demo",
      clinic_id: "clinic-karada-smile",
      name: "مدير العيادة",
      phone: "07700000003",
      email: "clinic-admin@dawri.local",
      password_hash: "demo-auth-placeholder",
      role: "clinic_admin",
      created_at: now.toISOString()
    },
    {
      id: "user-super-admin-demo",
      clinic_id: "",
      name: "مالك المنصة",
      phone: "07700000004",
      email: "admin@dawri.local",
      password_hash: "demo-auth-placeholder",
      role: "super_admin",
      created_at: now.toISOString()
    }
  ];

  const bookings = [
    {
      id: "booking-demo-1",
      booking_code: "DW-100241",
      clinic_id: "clinic-karada-smile",
      doctor_id: "doctor-ahmed-ali",
      patient_name: "حسين جبار",
      patient_phone: "07705550123",
      patient_age: 34,
      patient_gender: "male",
      visit_reason: "ألم بالسن",
      booking_date: today,
      approximate_time: "16:00",
      time_block: "16:00 - 17:00",
      queue_number: 1,
      status: "arrived",
      current_queue_snapshot: 0,
      created_at: now.toISOString(),
      updated_at: now.toISOString()
    },
    {
      id: "booking-demo-2",
      booking_code: "DW-100242",
      clinic_id: "clinic-karada-smile",
      doctor_id: "doctor-ahmed-ali",
      patient_name: "مريم صباح",
      patient_phone: "07705550456",
      patient_age: 27,
      patient_gender: "female",
      visit_reason: "حشوة تجميلية",
      booking_date: today,
      approximate_time: "16:10",
      time_block: "16:00 - 17:00",
      queue_number: 2,
      status: "booked",
      current_queue_snapshot: 0,
      created_at: now.toISOString(),
      updated_at: now.toISOString()
    },
    {
      id: "booking-demo-3",
      booking_code: "DW-100243",
      clinic_id: "clinic-mansour-care",
      doctor_id: "doctor-zainab-hassan",
      patient_name: "سارة ناظم",
      patient_phone: "07805550123",
      patient_age: 22,
      patient_gender: "female",
      visit_reason: "حساسية جلدية",
      booking_date: tomorrow,
      approximate_time: "16:00",
      time_block: "16:00 - 17:00",
      queue_number: 1,
      status: "confirmed",
      current_queue_snapshot: 0,
      created_at: now.toISOString(),
      updated_at: now.toISOString()
    }
  ];

  const queueSessions = [
    {
      id: "queue-demo-1",
      clinic_id: "clinic-karada-smile",
      doctor_id: "doctor-ahmed-ali",
      date: today,
      current_queue_number: 0,
      status: "not_started",
      delay_message: "",
      started_at: null,
      closed_at: null
    }
  ];

  const subscriptions = clinics.map((clinic) => ({
    id: `subscription-${clinic.id}`,
    clinic_id: clinic.id,
    plan: clinic.plan || "trial",
    status: clinic.subscription_status || (clinic.status === "active" ? "trial" : "pending"),
    started_at: clinic.created_at,
    current_period_end: clinic.trial_ends_at || null,
    trial_ends_at: clinic.trial_ends_at || null,
    seats: clinic.status === "active" ? 3 : 1,
    price_iqd: 0,
    created_at: clinic.created_at,
    updated_at: now.toISOString()
  }));

  return {
    meta: {
      app_name: "Dawri Medical / دوري الطبي",
      seeded_at: now.toISOString(),
      schema_version: 2
    },
    users,
    clinics,
    doctors,
    schedules,
    bookings,
    queueSessions,
    notifications: [],
    subscriptions,
    specialties,
    governorates,
    revenue: {
      placeholder_monthly_iqd: 0
    },
    constants: {
      week_days_ar: WEEK_DAYS_AR
    }
  };
}

module.exports = {
  WEEK_DAYS_AR,
  createSeedData
};
