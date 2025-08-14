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
    let currentUser = null;
    let usersData = [];
    let notificationListener = null;
    let notifications = [];
    let subscriptionListener = null;

    // --- دوال الشريط العلوي ---
    function toggleNav() {
      document.getElementById('navbarLinks').classList.toggle('show');
    }

    function toggleTheme() {
      const body = document.body;
      const isDark = body.classList.toggle('dark-mode');
      localStorage.setItem('dark-mode', isDark);
      const icon = document.getElementById('theme-icon');
      const text = document.getElementById('theme-text');
      icon.textContent = isDark ? '☀️' : '🌙';
      text.textContent = isDark ? 'الوضع النهاري' : 'الوضع الليلي';
    }

    // --- دوال الإشعارات ---
    function toggleNotifications() {
      const box = document.getElementById('notification-box');
      box.style.display = box.style.display === 'block' ? 'none' : 'block';
      if (box.style.display === 'block') markAllNotificationsAsRead();
    }

    function markAllNotificationsAsRead() {
      if (!currentUser) return;
      const updates = {};
      notifications.forEach(notif => {
        if (!notif.read) {
          updates[`tenants/${currentUser.uid}/notifications/${notif.key}/read`] = true;
        }
      });
      if (Object.keys(updates).length > 0) {
        db.ref().update(updates)
          .then(() => updateNotificationBadge())
          .catch(error => console.error("خطأ في تمييز كمقروء:", error));
      }
    }

    function clearAllNotifications() {
      if (!currentUser || !confirm("هل أنت متأكد؟")) return;
      db.ref(`tenants/${currentUser.uid}/notifications`).remove()
        .then(() => {
          notifications = [];
          renderNotifications();
          updateNotificationBadge();
        })
        .catch(error => console.error("خطأ في مسح الإشعارات:", error));
    }

    function deleteNotification(notificationKey) {
      if (!currentUser) return;
      db.ref(`tenants/${currentUser.uid}/notifications/${notificationKey}`).remove()
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
      document.getElementById('notification-count').textContent = unreadCount;
    }

    // --- إدارة الاشتراك ---
    function listenToSubscription(uid) {
      const subscriptionRef = db.ref(`tenants/${uid}/subscription`);
      if (subscriptionListener) subscriptionListener.off();
      subscriptionListener = subscriptionRef.on("value", (snapshot) => {
        const modal = document.getElementById("subscription-block");
        const container = document.querySelector('.container');
        const existingWarning = document.querySelector('.warning-message');
        if (existingWarning) existingWarning.remove();
        if (!snapshot.exists()) {
          modal.style.display = "flex";
          return;
        }
        const sub = snapshot.val();
        const endDate = sub.endDate;
        if (!endDate) {
          modal.style.display = "flex";
          return;
        }
        const today = new Date().toISOString().split('T')[0];
        const end = new Date(endDate).toISOString().split('T')[0];
        if (end < today) {
          modal.style.display = "flex";
        } else {
          modal.style.display = "none";
          const endDateObj = new Date(endDate);
          const todayObj = new Date();
          const diffTime = endDateObj - todayObj;
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
          if (diffDays <= 7) {
            const warning = document.createElement('div');
            warning.className = 'warning-message';
            warning.innerHTML = `
              <i class="fas fa-exclamation-triangle"></i>
              تبقى ${diffDays} أيام فقط على انتهاء اشتراكك!
            `;
            container.insertBefore(warning, container.firstChild);
          }
          loadPageContent(uid);
        }
      }, (error) => {
        console.error("خطأ في مراقبة الاشتراك:", error);
        modal.style.display = "flex";
      });
    }

    function renewSubscription() {
      window.location.href = "subscriptions.html";
    }

    function loadPageContent(uid) {
      document.querySelector('.loader').style.display = 'none';
      console.log("الاشتراك ساري للمستخدم:", uid);
    }

    // --- تحميل الصفحة ---
    window.onload = function () {
      auth.onAuthStateChanged(user => {
        if (user) {
          currentUser = user;
          listenToSubscription(user.uid);
          loadUsers();
          startListeningToNotifications();
        } else {
          window.location.href = "subscriptions.html";
        }
      });
    };

    // --- تحميل المستخدمين ---
    function loadUsers() {
      if (!currentUser) return;
      const usersRef = db.ref(`tenants/${currentUser.uid}/new_users`);
      usersRef.once("value")
        .then(snapshot => {
          const data = snapshot.val();
          usersData = [];
          if (data) {
            Object.keys(data).forEach(key => {
              usersData.push({
                id: key,
                name: data[key].name || "غير معرف",
                username: data[key].username || "غير معرف",
                user_phone: data[key].user_phone || "غير متوفر",
                parent_phone: data[key].parent_phone || "غير متوفر",
                group: data[key].group || "غير محدد",
                status: data[key].status || "pending"
              });
            });
          }
          renderUsers();
          document.querySelector('.export-btn').disabled = false;
          document.querySelector('.loader').style.display = 'none';
        })
        .catch(error => {
          console.error("خطأ في جلب المستخدمين:", error);
          document.querySelector('.loader').style.display = 'none';
        });
    }

    function renderUsers() {
      const tbody = document.getElementById('usersTableBody');
      tbody.innerHTML = '';
      let index = 1;
      usersData.forEach(user => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
          <td>${index++}</td>
          <td>${user.name}</td>
          <td>${user.username}</td>
          <td>${user.user_phone}</td>
          <td>${user.parent_phone}</td>
          <td>${user.group}</td>
          <td><span class="status status-${user.status}">
            ${user.status === 'pending' ? 'بانتظار القبول' : 
              user.status === 'rejected' ? 'مرفوض' : 
              'مقبول'}
          </span></td>
          <td class="actions-cell">
            ${user.status === 'pending' ? 
              `<button class="btn" onclick="updateUserStatus('${user.id}', 'approved')">قبول</button>
               <button class="btn" style="background:#dc3545;" onclick="updateUserStatus('${user.id}', 'rejected')">رفض</button>` : 
              '<span>-</span>'}
          </td>
        `;
        tbody.appendChild(tr);
      });
    }

    // --- تصدير إلى Excel ---
    function exportToExcel() {
      if (!usersData.length) {
        alert("لا يوجد بيانات لتصديرها.");
        return;
      }
      try {
        const cleanData = usersData.map(item => ({
          'الاسم': item.name || '-',
          'اسم المستخدم': item.username || '-',
          'رقم الطالب': item.user_phone || '-',
          'رقم ولي الأمر': item.parent_phone || '-',
          'الفرقة': item.group || '-',
          'الحالة': item.status === 'pending' ? 'بانتظار القبول' : item.status === 'rejected' ? 'مرفوض' : 'مقبول'
        }));
        const worksheet = XLSX.utils.json_to_sheet(cleanData);
        XLSX.utils.sheet_add_aoa(worksheet, [["الاسم", "اسم المستخدم", "رقم الطالب", "رقم ولي الأمر", "الفرقة", "الحالة"]], { origin: "A1" });
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "المستخدمون الجدد");
        XLSX.writeFile(workbook, "new_users.xlsx");
      } catch (err) {
        alert("خطأ: " + err.message);
      }
    }

    // --- إرسال إلى واتساب ---
    function sendToWhatsApp() {
      if (!usersData.length) {
        alert("لا يوجد مستخدمون.");
        return;
      }
      const phoneNumbers = usersData.map(u => u.user_phone).filter(p => p && p !== 'غير متوفر').join('%0A');
      if (!phoneNumbers) {
        alert("لا توجد أرقام صالحة.");
        return;
      }
      const message = `مرحباً، هذه قائمة بأرقام الطلاب الجدد:
${phoneNumbers}`;
      window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank');
    }

    // --- نسخ الأرقام ---
    function copyAllNumbers() {
      const numbers = usersData.map(u => u.user_phone).filter(p => p && p !== 'غير متوفر').join('\n');
      if (!numbers) {
        alert("لا توجد أرقام صالحة.");
        return;
      }
      navigator.clipboard.writeText(numbers)
        .then(() => alert("تم النسخ بنجاح!"))
        .catch(err => alert("فشل النسخ: " + err));
    }

    // --- تحديث حالة المستخدم ---
    function updateUserStatus(userId, newStatus) {
      if (!currentUser) return alert("يجب تسجيل الدخول.");
      const tenantId = currentUser.uid;
      const newUserRef = db.ref(`tenants/${tenantId}/new_users/${userId}`);

      if (newStatus === "approved") {
        newUserRef.once("value")
          .then(snapshot => {
            const userData = snapshot.val();
            if (!userData) throw new Error("بيانات المستخدم غير متوفرة.");

            const approvedUserData = {
              ...userData,
              status: "approved",
              joinedAt: new Date().toISOString()
            };

            return db.ref(`tenants/${tenantId}/users/${userId}`).set(approvedUserData)
              .then(() => newUserRef.remove())
              .then(() => {
                alert("تم قبول المستخدم ونقله إلى قائمة المستخدمين بنجاح.");
                loadUsers();
              })
              .catch(err => {
                alert("خطأ أثناء حفظ المستخدم: " + err.message);
                console.error(err);
              });
          })
          .catch(err => {
            alert("خطأ أثناء قبول المستخدم: " + err.message);
            console.error(err);
          });
      } else {
        newUserRef.child('status').set("rejected")
          .then(() => {
            alert("تم رفض المستخدم.");
            loadUsers();
          })
          .catch(err => alert("خطأ: " + err.message));
      }
    }

    // --- الاستماع للإشعارات ---
    function startListeningToNotifications() {
      if (!currentUser) return;
      if (notificationListener) notificationListener.off();
      const notificationsRef = db.ref(`tenants/${currentUser.uid}/notifications`);
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
        }).catch(err => alert("خطأ: " + err.message));
      }
    }

    // --- تفعيل الرابط النشط ---
    document.addEventListener('DOMContentLoaded', function() {
      const currentPath = window.location.pathname.split('/').pop();
      const activeLink = document.querySelector(`.navbar-links a[href="${currentPath}"]`);
      if (activeLink) activeLink.classList.add('active');
    });

    // --- تطبيق التفضيلات ---
    document.addEventListener('DOMContentLoaded', function() {
      const isDark = localStorage.getItem('dark-mode') === 'true';
      if (isDark) document.body.classList.add('dark-mode');
      const icon = document.getElementById('theme-icon');
      const text = document.getElementById('theme-text');
      icon.textContent = isDark ? '☀️' : '🌙';
      text.textContent = isDark ? 'الوضع النهاري' : 'الوضع الليلي';
    });