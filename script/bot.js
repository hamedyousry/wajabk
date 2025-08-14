 // --- تهيئة Firebase ---
    const firebaseConfig = {
      apiKey: "AIzaSyCEAM6Mo5wCK4c_0w9M_xHfGQbRnhXQXNY",
      authDomain: "boot-al-abtal.firebaseapp.com",
      databaseURL: "https://boot-al-abtal-default-rtdb.firebaseio.com",
      projectId: "boot-al-abtal",
      storageBucket: "boot-al-abtal.firebasestorage.app",
      messagingSenderId: "963942129622",
      appId: "1:963942129622:web:a23e17e9dc8f30cb5fce77"
    };
    firebase.initializeApp(firebaseConfig);
    const auth = firebase.auth();
    const db = firebase.database();

    // --- دوال الشريط العلوي ---
    function toggleNav() {
      const navbarLinks = document.getElementById('navbarLinks');
      navbarLinks.classList.toggle('show');
    }

    function toggleTheme() {
      const body = document.body;
      const isDark = body.classList.toggle('dark-mode');
      localStorage.setItem('dark-mode', isDark);
      const icon = document.getElementById('theme-icon');
      const text = document.getElementById('theme-text');
      if (isDark) {
        icon.textContent = '☀️';
        text.textContent = 'الوضع النهاري';
      } else {
        icon.textContent = '🌙';
        text.textContent = 'الوضع الليلي';
      }
    }

    function logout() {
      if (confirm('هل أنت متأكد من تسجيل الخروج؟')) {
        auth.signOut().then(() => {
          window.location.href = "login.html";
        }).catch(err => alert("خطأ: " + err.message));
      }
    }

    // --- عناصر DOM ---
    const loader = document.getElementById('loader');
    const errorDiv = document.getElementById('error');
    const botCard = document.getElementById('botCard');
    const botName = document.getElementById('botName');
    const botUsername = document.getElementById('botUsername');
    const botDeveloper = document.getElementById('botDeveloper');
    const botDate = document.getElementById('botDate');
    const visitBtn = document.getElementById('visitBtn');
    const copyBtn = document.getElementById('copyBtn');
    const addBotBtn = document.getElementById('addBotBtn');
    const botFormContainer = document.getElementById('botFormContainer');
    const botForm = document.getElementById('botForm');
    const cancelBtn = document.getElementById('cancelBtn');

    // --- إظهار/إخفاء النموذج ---
    addBotBtn.addEventListener('click', () => {
      botFormContainer.style.display = 'block';
      window.scrollTo(0, document.body.scrollHeight);
    });

    cancelBtn.addEventListener('click', () => {
      botFormContainer.style.display = 'none';
    });

    // --- إرسال طلب إضافة بوت ---
    botForm.addEventListener('submit', (e) => {
      e.preventDefault();

      const name = document.getElementById('formBotName').value.trim();
      let username = document.getElementById('formBotUsername').value.trim();
      const token = document.getElementById('formBotToken').value.trim();

      if (!name || !username || !token) {
        alert('يرجى تعبئة جميع الحقول');
        return;
      }

      if (!username.startsWith('@')) username = '@' + username;

      const user = auth.currentUser;
      if (!user) {
        alert('لم يتم التعرف على المستخدم');
        return;
      }

      const tenantId = user.uid;
      const requestRef = db.ref(`pending_bot_requests/${tenantId}`);

      const submitBtn = botForm.querySelector('button[type="submit"]');
      const originalText = submitBtn.innerHTML;
      submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جاري الإرسال...';
      submitBtn.disabled = true;

      requestRef.set({
        name: name,
        username: username,
        token: token,
        developer: "المطور",
        requestedAt: firebase.database.ServerValue.TIMESTAMP,
        status: "pending",
        userId: tenantId
      })
      .then(() => {
        alert('تم إرسال طلبك بنجاح! في انتظار موافقة الإدارة.');
        botForm.reset();
        botFormContainer.style.display = 'none';
        loadBotInfo(tenantId);
      })
      .catch((err) => {
        console.error("خطأ في إرسال الطلب:", err);
        alert("فشل إرسال الطلب: " + err.message);
      })
      .finally(() => {
        submitBtn.innerHTML = originalText;
        submitBtn.disabled = false;
      });
    });

    // --- عند تغيير حالة تسجيل الدخول ---
    auth.onAuthStateChanged((user) => {
      if (user) {
        const tenantId = user.uid;
        loadBotInfo(tenantId);
      } else {
        loader.style.display = 'none';
        errorDiv.innerHTML = 'يرجى تسجيل الدخول أولاً.';
        errorDiv.style.display = 'block';
        setTimeout(() => {
          window.location.href = "login.html";
        }, 1500);
      }
    });

    // --- جلب بيانات البوت ---
    function loadBotInfo(tenantId) {
      const botRef = db.ref(`tenants/${tenantId}/bot_info`);

      botRef.once("value")
        .then((snapshot) => {
          if (snapshot.exists()) {
            const data = snapshot.val();

            botName.textContent = data.name || "غير متوفر";
            botUsername.textContent = data.username || "غير متوفر";
            botDeveloper.textContent = data.developer || "غير محدد";
            botDate.textContent = data.creationDate || "غير متوفر";

            visitBtn.disabled = false;
            copyBtn.disabled = false;

            visitBtn.onclick = () => {
              const username = data.username?.replace('@', '') || '';
              if (username) window.open(`https://t.me/${username}`, '_blank');
            };

            copyBtn.onclick = () => {
              const username = data.username || '';
              if (!username) return;
              navigator.clipboard.writeText(username)
                .then(() => {
                  const originalText = copyBtn.innerHTML;
                  copyBtn.innerHTML = '<i class="fas fa-check"></i> نُسخ!';
                  copyBtn.classList.add('copied');
                  setTimeout(() => {
                    copyBtn.innerHTML = originalText;
                    copyBtn.classList.remove('copied');
                  }, 2000);
                })
                .catch(err => alert("فشل النسخ: " + err));
            };

            loader.style.display = "none";
            errorDiv.style.display = "none";
            botCard.style.display = "block";

          } else {
            // تحقق من وجود طلب قيد المراجعة
            const pendingRef = db.ref(`pending_bot_requests/${tenantId}`);
            pendingRef.once("value")
              .then((snapshot) => {
                if (snapshot.exists() && snapshot.val().status === "pending") {
                  showError("✅ تم إرسال طلبك وقيد المراجعة. في انتظار الموافقة من الإدارة  وسوف يتم تفعيل البوت خلال 24 ســـــــــــــــــاعــــــــــــــــــــــــــة.");
                } else {
                  showError("لا يوجد بوت مضاف. يمكنك إرسال طلب لإضافة بوت جديد     وسوف يتم تفعيل البوت خلال 24 ســـــــــــــــــاعــــــــــــــــــــــــــة");
                }
              })
              .catch(() => {
                showError("لا يوجد بوت مضاف. يمكنك إرسال طلب لإضافة بوت جديد.");
              });
          }
        })
        .catch((error) => {
          console.error("خطأ في قراءة البيانات:", error);
          showError("فشل الاتصال بالخادم.");
        });
    }

    function showError(msg) {
      loader.style.display = "none";
      errorDiv.innerHTML = `<i class="fas fa-info-circle"></i> ${msg}`;
      errorDiv.style.display = "block";
    }

    // --- تفعيل الوضع المخزن ---
    document.addEventListener('DOMContentLoaded', function() {
      const isDark = localStorage.getItem('dark-mode') === 'true';
      if (isDark) document.body.classList.add('dark-mode');
      const icon = document.getElementById('theme-icon');
      const text = document.getElementById('theme-text');
      if (isDark) {
        icon.textContent = '☀️';
        text.textContent = 'الوضع النهاري';
      } else {
        icon.textContent = '🌙';
        text.textContent = 'الوضع الليلي';
      }
    });