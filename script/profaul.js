 // --- إعدادات Firebase بدون أي تعديل ---
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

    const loadingEl = document.getElementById("loading");
    const contentEl = document.getElementById("profile-content");
    const renewBtn = document.getElementById("renew-btn");

    // --- دوال الشريط العلوي ---
    function toggleNav() {
      const navbarLinks = document.getElementById('navbarLinks');
      navbarLinks.classList.toggle('show');
    }

    function toggleTheme() {
      document.body.classList.toggle('dark-mode');
      const isDarkMode = document.body.classList.contains('dark-mode');
      localStorage.setItem('theme', isDarkMode ? 'dark' : 'light');
      const icon = document.getElementById('theme-icon');
      const text = document.getElementById('theme-text');
      if (isDarkMode) {
        icon.textContent = '☀️';
        text.textContent = 'الوضع النهاري';
      } else {
        icon.textContent = '🌙';
        text.textContent = 'الوضع الليلي';
      }
    }

    // --- دوال الإشعارات ---
    let notifications = [];
    let notificationListener = null;

    function toggleNotifications() {
      const box = document.getElementById('notification-box');
      box.style.display = box.style.display === 'block' ? 'none' : 'block';
      if (box.style.display === 'block') {
        markAllNotificationsAsRead();
      }
    }

    function markAllNotificationsAsRead() {
      if (!auth.currentUser) return;
      const updates = {};
      notifications.forEach(notif => {
        if (!notif.read) {
          updates[`tenants/${auth.currentUser.uid}/notifications/${notif.key}/read`] = true;
        }
      });
      if (Object.keys(updates).length > 0) {
        db.ref().update(updates).catch(error => console.error("خطأ في تمييز كمقروء:", error));
      }
    }

    function clearAllNotifications() {
      if (!auth.currentUser || !confirm("هل أنت متأكد؟")) return;
      db.ref(`tenants/${auth.currentUser.uid}/notifications`).remove()
        .then(() => {
          notifications = [];
          renderNotifications();
          updateNotificationBadge();
        })
        .catch(error => console.error("خطأ في مسح الإشعارات:", error));
    }

    function deleteNotification(notificationKey) {
      if (!auth.currentUser) return;
      db.ref(`tenants/${auth.currentUser.uid}/notifications/${notificationKey}`).remove()
        .then(() => {
          notifications = notifications.filter(n => n.key !== notificationKey);
          renderNotifications();
          updateNotificationBadge();
        })
        .catch(error => console.error("خطأ في حذف الإشعار:", error));
    }

    function renderNotifications() {
      const list = document.getElementById('notification-list');
      list.innerHTML = '';
      if (notifications.length === 0) {
        list.innerHTML = '<div class="notification-item">لا توجد إشعارات</div>';
        return;
      }
      notifications.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
      notifications.forEach(notif => {
        const notifElement = document.createElement('div');
        notifElement.className = `notification-item ${notif.read ? '' : 'unread'}`;
        const time = new Date(notif.timestamp);
        const timeString = time.toLocaleString('ar-EG');
        notifElement.innerHTML = `
          <div class="notification-message">
            ${notif.message}
            <div class="notification-time">${timeString}</div>
            ${notif.sender ? `<div class="notification-sender">مرسل: ${notif.sender}</div>` : ''}
          </div>
          <div class="notification-actions">
            <button class="notification-action-btn" onclick="deleteNotification('${notif.key}')">حذف</button>
          </div>
        `;
        list.appendChild(notifElement);
      });
    }

    function updateNotificationBadge() {
      const unreadCount = notifications.filter(n => !n.read).length;
      const badge = document.getElementById('notification-count');
      badge.textContent = unreadCount;
    }

    // --- تفعيل الرابط النشط عند التحميل ---
    document.addEventListener('DOMContentLoaded', function() {
      const isDark = localStorage.getItem('theme') === 'dark';
      if (isDark) {
        document.body.classList.add('dark-mode');
        document.getElementById('theme-icon').textContent = '☀️';
        document.getElementById('theme-text').textContent = 'الوضع النهاري';
      } else {
        document.getElementById('theme-icon').textContent = '🌙';
        document.getElementById('theme-text').textContent = 'الوضع الليلي';
      }

      // تفعيل الرابط النشط
      const currentPath = window.location.pathname.split('/').pop();
      const activeLink = document.querySelector(`.navbar-links a[href="${currentPath}"]`);
      if (activeLink) {
        activeLink.classList.add('active');
      }
    });

    // --- التحقق من تسجيل الدخول ---
    auth.onAuthStateChanged(user => {
      if (user) {
        startListeningToNotifications();
        loadProfile();
      } else {
        window.location.href = "login.html";
      }
    });

    // --- الاستماع للإشعارات ---
    function startListeningToNotifications() {
      if (!auth.currentUser) return;
      if (notificationListener) notificationListener.off();
      const notificationsRef = db.ref(`tenants/${auth.currentUser.uid}/notifications`);
      notificationListener = notificationsRef.on("value", (snapshot) => {
        const data = snapshot.val();
        notifications = [];
        if (data) {
          Object.keys(data).forEach(key => {
            notifications.push({
              key: key,
              message: data[key].message,
              timestamp: data[key].timestamp,
              read: data[key].read === true,
              sender: data[key].sender || 'admin'
            });
          });
        }
        renderNotifications();
        updateNotificationBadge();
      }, error => console.error("خطأ في الاستماع للإشعارات:", error));
    }

    function stopListeningToNotifications() {
      if (notificationListener) {
        notificationListener.off();
        notificationListener = null;
      }
    }

    window.addEventListener('beforeunload', stopListeningToNotifications);

    // --- تسجيل الخروج ---
    function logout() {
      if (confirm('هل أنت متأكد من تسجيل الخروج؟')) {
        auth.signOut().then(() => {
          window.location.href = "login.html";
        }).catch(error => {
          console.error("خطأ في تسجيل الخروج:", error);
        });
      }
    }

    // --- وظيفة تجديد الاشتراك ---
    function renewSubscription() {
      window.location.href = "login.html";
    }

    // --- وظيفة تحديث حالة الاشتراك ---
    function updateStatusUI(planType, maxStudents, startDate, endDate) {
      const statusEl = document.getElementById("sub-status");
      const today = new Date().toISOString().split('T')[0];

      const planMap = {
        'trial': 'تجربة مجانية',
        'monthly': 'شهري',
        'yearly': 'سنوي'
      };
      const planName = planMap[planType] || 'مخصص';

      document.getElementById("plan-type").textContent = planName;
      document.getElementById("max-students").textContent = `${maxStudents} طالب`;

      if (endDate < today) {
        statusEl.textContent = "منتهي";
        statusEl.className = "status expired";
        renewBtn.style.display = "block";
      } else if (planType === 'trial') {
        statusEl.textContent = "تجريبي";
        statusEl.className = "status trial";
        renewBtn.style.display = "none";
      } else {
        statusEl.textContent = "نشط";
        statusEl.className = "status active";
        renewBtn.style.display = "none";
      }

      document.getElementById("start-date").textContent = startDate;
      document.getElementById("end-date").textContent = endDate;
    }

    // --- وظيفة تحميل الملف الشخصي ---
    function loadProfile() {
      const user = auth.currentUser;
      if (!user) {
        window.location.href = "login.html";
        return;
      }

      const tenantRef = db.ref(`tenants/${user.uid}`);
      tenantRef.once("value")
        .then(snapshot => {
          if (!snapshot.exists()) {
            throw new Error("الملف غير موجود");
          }

          const data = snapshot.val();
          const info = data.info || {};
          const sub = data.subscription || {};
          const maxStudents = sub.maxStudents || 4;

          document.getElementById("user-name").textContent = info.name || "غير محدد";
          document.getElementById("user-email").textContent = info.email || "غير محدد";
          document.getElementById("user-phone").textContent = info.phone || "غير محدد";

          if (sub.plan && sub.maxStudents) {
            const startDate = info.createdAt ? info.createdAt.split('T')[0] : 'غير معروف';
            const endDate = data.subscription.endDate || 'غير معروف';
            updateStatusUI(sub.plan, maxStudents, startDate, endDate);
          } else {
            document.getElementById("sub-status").textContent = "لا يوجد اشتراك";
            document.getElementById("sub-status").className = "status expired";
            renewBtn.style.display = "block";
          }

          loadingEl.style.display = "none";
          contentEl.style.display = "block";
        })
        .catch(err => {
          console.error("خطأ في تحميل الملف الشخصي:", err);
          loadingEl.style.display = "none";
          document.getElementById("profile-content").innerHTML = `<div class="error">خطأ في تحميل البيانات. يرجى المحاولة لاحقًا.</div>`;
        });
    }