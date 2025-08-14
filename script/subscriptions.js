const firebaseConfig = {
  apiKey: "AIzaSyCEAM6Mo5wCK4c_0w9M_xHfGQbRnhXQXNY",
  authDomain: "boot-al-abtal.firebaseapp.com",
  databaseURL: "https://boot-al-abtal-default-rtdb.firebaseio.com",
  projectId: "boot-al-abtal",
  storageBucket: "boot-al-abtal.firebasestorage.app",
  messagingSenderId: "963942129622",
  appId: "1:963942129622:web:a23e17e9dc8f30cb5fce77",
  measurementId: "G-27C6R1K6HZ"
};

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.database();
let selectedPlan = null;

// تبديل الوضع
function toggleTheme() {
  const body = document.body;
  const themeToggle = document.getElementById('theme-toggle');
  if (body.classList.contains('dark-mode')) {
    body.classList.remove('dark-mode');
    body.classList.add('light-mode');
    themeToggle.innerHTML = '<i class="fa-solid fa-moon-star fa-spin"></i>';
    localStorage.setItem('theme', 'light');
  } else {
    body.classList.remove('light-mode');
    body.classList.add('dark-mode');
    themeToggle.innerHTML = '<i class="fa-regular fa-sun-bright fa-spin"></i>';
    localStorage.setItem('theme', 'dark');
  }
}

// تحميل الوضع المحفوظ
document.addEventListener('DOMContentLoaded', () => {
  const savedTheme = localStorage.getItem('theme') || 'dark';
  document.body.classList.add(`${savedTheme}-mode`);
  document.getElementById('theme-toggle').innerHTML = savedTheme === 'dark' 
    ? '<i class="fa-regular fa-sun-bright fa-spin"></i>' 
    : '<i class="fa-solid fa-moon-star fa-spin"></i>';
  calculateCustomPrice();
});

// التحقق من تسجيل الدخول
auth.onAuthStateChanged(user => {
  if (user) {
    loadCurrentSubscription(user.uid);
  } else {
    window.location.href = "login.html";
  }
});

// تحميل بيانات الباقة الحالية
function loadCurrentSubscription(userId) {
  db.ref(`tenants/${userId}/subscription`).once("value")
    .then(snapshot => {
      if (snapshot.exists()) {
        const sub = snapshot.val();
        document.getElementById('current-plan-name').textContent = getPlanName(sub.plan);
        document.getElementById('current-max-students').textContent = sub.maxStudents || 4;
        document.getElementById('current-expiry-date').textContent = sub.endDate || 'غير محدد';
      }
    })
    .catch(err => console.error("Error loading subscription:", err));
}

function getPlanName(type) {
  const names = {
    'trial': 'تجربة مجانية',
    'monthly': 'شهري',
    'yearly': 'سنوي',
    'renew-monthly': 'تجديد شهري',
    'upgrade-yearly': 'ترقية سنوية',
    'custom-20': '20 طالب',
    'custom-50': '50 طالب'
  };
  return names[type] || 'باقة مخصصة';
}

// التعامل مع تغيير المدة
function handlePeriodChange() {
  const periodSelect = document.getElementById('custom-period');
  const customDaysInput = document.getElementById('custom-days-input');
  if (periodSelect.value === 'custom') {
    customDaysInput.style.display = 'block';
  } else {
    customDaysInput.style.display = 'none';
  }
  calculateCustomPrice();
}

// حساب السعر المخصص
function calculateCustomPrice() {
  const students = parseInt(document.getElementById('custom-students').value) || 20;
  const periodSelect = document.getElementById('custom-period');
  let days = parseInt(periodSelect.value);

  if (periodSelect.value === 'custom') {
    days = parseInt(document.getElementById('custom-days').value) || 30;
  }

  const priceEl = document.getElementById('custom-price');
  const studentsErr = document.getElementById('custom-students-error');
  const daysErr = document.getElementById('custom-days-error');

  studentsErr.style.display = 'none';
  if (daysErr) daysErr.style.display = 'none';

  if (students < 5 || students > 1000) {
    priceEl.textContent = 'خطأ';
    studentsErr.style.display = 'block';
    return;
  }
  if (days < 7 || days > 365) {
    priceEl.textContent = 'خطأ';
    if (daysErr) daysErr.style.display = 'block';
    return;
  }

  const monthlyRate = 3;
  let totalPrice = students * monthlyRate * (days / 30);

  if (days === 365) {
    totalPrice *= 0.5; // خصم 50%
  }

  totalPrice = Math.ceil(totalPrice);
  if (days === 30 && totalPrice < 60) totalPrice = 60;

  priceEl.textContent = `${totalPrice} جنيه`;
}

// اختيار باقة ثابتة
function selectPlan(element, type, days, maxStudents, price) {
  document.querySelectorAll('.plan').forEach(p => p.classList.remove('selected'));
  element.classList.add('selected');
  selectedPlan = { type, days, maxStudents, price };
  updatePaymentDetails();
  confirmSubscription();
}

// اختيار باقة مخصصة
function selectCustomPlan() {
  const students = parseInt(document.getElementById('custom-students').value);
  const periodSelect = document.getElementById('custom-period');
  let days = parseInt(periodSelect.value);
  if (periodSelect.value === 'custom') {
    days = parseInt(document.getElementById('custom-days').value);
  }
  const priceText = document.getElementById('custom-price').textContent.replace(' جنيه', '');
  const price = parseInt(priceText) || 60;

  if (students < 5 || students > 1000 || days < 7 || days > 365) {
    alert('يرجى إدخال قيم صالحة');
    return;
  }

  document.querySelectorAll('.plan').forEach(p => p.classList.remove('selected'));
  document.querySelector('.plan[role="region"]').classList.add('selected');
  selectedPlan = { type: `custom-${students}`, days, maxStudents: students, price };
  updatePaymentDetails();
  confirmSubscription();
}

// تحديث تفاصيل الدفع
function updatePaymentDetails() {
  const info = document.getElementById('selected-plan-info');
  if (selectedPlan) {
    info.textContent = `الباقة المختارة: ${selectedPlan.price} جنيه`;
    document.getElementById('payment-details').classList.add('active');
  } else {
    info.textContent = 'لم يتم اختيار باقة بعد';
    document.getElementById('payment-details').classList.remove('active');
  }
}

// تأكيد الباقة
function confirmSubscription() {
  if (!selectedPlan) return showError("اختر باقة أولًا");
  document.getElementById('payment-modal').style.display = 'flex';
  document.getElementById('payment-plan-info').textContent = `الباقة المختارة: ${selectedPlan.price} جنيه`;
  document.getElementById('support-btn').style.display = 'none';
  document.getElementById('payment-error').textContent = '';
}

// تنسيق رقم التحويل
document.getElementById('payment-code').addEventListener('input', function(e) {
  let value = e.target.value.replace(/\D/g, '');
  if (value.length > 4) value = value.substring(0, 4) + ' ' + value.substring(4);
  if (value.length > 9) value = value.substring(0, 9) + ' ' + value.substring(9);
  e.target.value = value;
});

// التحقق من الدفع
function verifyPayment() {
  const code = document.getElementById('payment-code').value.replace(/\s/g, '').trim();
  const btn = document.getElementById('verify-btn');

  // التحقق من وجود الزر
  if (!btn) {
    console.error("الزر #verify-btn غير موجود في الصفحة.");
    return;
  }

  if (!code) return showError('أدخل رقم التحويل');
  if (!/^\d{8,12}$/.test(code)) return showError('رقم التحويل من 8 إلى 12 رقم');

  // تعطيل الزر وتغيير النص
  btn.disabled = true;
  btn.textContent = 'جاري التحقق...';

  // التحقق من الكود في قاعدة البيانات
  db.ref(`payment_codes/${code}`).once('value')
    .then(snapshot => {
      if (!snapshot.exists()) throw new Error('الرقم غير موجود');
      const data = snapshot.val();
      if (data.used) throw new Error('مستخدم مسبقًا');
      if (data.amount !== selectedPlan.price) throw new Error('المبلغ غير مطابق');

      // تحديث الحالة إلى مستخدم
      return db.ref().update({
        [`payment_codes/${code}/used`]: true,
        [`payment_codes/${code}/usedBy`]: auth.currentUser.uid,
        [`payment_codes/${code}/plan`]: selectedPlan.type
      }).then(() => processSubscription());
    })
    .catch(err => {
      showError(err.message);
      document.getElementById('support-btn').style.display = 'block';
    })
    .finally(() => {
      // إعادة تمكين الزر
      btn.disabled = false;
      btn.textContent = 'تأكيد';
    });
}

function showError(msg) {
  document.getElementById('payment-error').textContent = msg;
}

function closeModal() {
  document.getElementById('payment-modal').style.display = 'none';
  document.getElementById('payment-code').value = '';
  document.getElementById('payment-error').textContent = '';
  document.getElementById('support-btn').style.display = 'none';
}

function contactSupport() {
  const user = auth.currentUser;
  const code = document.getElementById('payment-code').value;
  const msg = `الاسم: ${user.displayName}\nالبريد: ${user.email}\nالرقم: ${code}\nالخطة: ${selectedPlan.type}\nالمشكلة: ${document.getElementById('payment-error').textContent}`;
  window.open(`https://wa.me/201091528121?text=${encodeURIComponent(msg)}`, '_blank');
}

function processSubscription() {
  const user = auth.currentUser;
  const now = new Date();
  const end = new Date(now);
  end.setDate(now.getDate() + selectedPlan.days);

  const subData = {
    plan: selectedPlan.type,
    startDate: now.toISOString().split('T')[0],
    endDate: end.toISOString().split('T')[0],
    status: 'active',
    maxStudents: selectedPlan.maxStudents,
    price: selectedPlan.price,
    paymentDate: now.toISOString(),
    paymentMethod: 'Vodafone Cash'
  };

  db.ref(`tenants/${user.uid}/subscription`).set(subData)
    .then(() => db.ref('payments').push().set({
      userId: user.uid,
      plan: selectedPlan.type,
      amount: selectedPlan.price,
      date: now.toISOString(),
      status: 'completed',
      paymentMethod: 'Vodafone Cash',
      paymentCode: document.getElementById('payment-code').value.replace(/\s/g, '')
    }))
    .then(() => {
      alert('تم التفعيل بنجاح!');
      window.location.href = 'user-naw.html';
    })
    .catch(err => showError('خطأ: ' + err.message));
}

// ربط زر تبديل الوضع
document.getElementById('theme-toggle').addEventListener('click', toggleTheme);