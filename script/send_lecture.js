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
    let currentGroup = 'الفرقة الأولى';
    let targetStudentGroup = 'all';
    const lecturesContainer = document.getElementById('lectures-container');
    const statusMessage = document.getElementById('status-message');
    let currentUser = null;
    let notifications = [];
    let notificationListener = null;

    function toggleNav() {
      const navLinks = document.getElementById('navbarLinks');
      navLinks.classList.toggle('show');
    }

    function setActiveLink(clickedLink) {
      document.querySelectorAll('.navbar-links a').forEach(link => {
        link.classList.remove('active');
      });
      clickedLink.classList.add('active');
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

    window.onload = function() {
      const isDark = localStorage.getItem('dark-mode') === 'true';
      if (isDark) {
        document.body.classList.add('dark-mode');
      }
      const icon = document.getElementById('theme-icon');
      const text = document.getElementById('theme-text');
      if (isDark) {
        icon.textContent = '☀️';
        text.textContent = 'الوضع النهاري';
      } else {
        icon.textContent = '🌙';
        text.textContent = 'الوضع الليلي';
      }
      const currentPath = window.location.pathname.split('/').pop();
      const activeLink = document.querySelector(`.navbar-links a[href="${currentPath}"]`);
      if (activeLink) {
        setActiveLink(activeLink);
      }
      auth.onAuthStateChanged(user => {
        if (user) {
          currentUser = user;
          loadLectures(currentGroup);
          startListeningToNotifications();
        } else {
          window.location.href = "login.html";
        }
      });
    };

    function logout() {
      if (confirm('هل أنت متأكد من تسجيل الخروج؟')) {
        auth.signOut().then(() => {
          window.location.href = "login.html";
        });
      }
    }

    function changeGroup(group, element) {
      currentGroup = group;
      targetStudentGroup = 'all';
      document.querySelectorAll('.group-btn').forEach(btn => {
        btn.classList.remove('active');
      });
      element.classList.add('active');
      loadLectures(group);
      loadStudentGroups(group);
    }

    // ✅ التعديل هنا: جلب المجموعات من بيانات الطلاب
    function loadStudentGroups(group) {
      const subSelector = document.getElementById('group-sub-selector');
      subSelector.innerHTML = '<div class="loading">جاري تحميل المجموعات...</div>';

      if (!currentUser) return;

      const usersRef = db.ref(`tenants/${currentUser.uid}/users`);
      usersRef.once("value")
        .then(snapshot => {
          const users = snapshot.val();
          const groupsSet = new Set();

          if (users) {
            Object.keys(users).forEach(key => {
              const user = users[key];
              if (user.group === group && user.student_group && user.status === "approved") {
                const groupName = user.student_group.trim();
                if (groupName) groupsSet.add(groupName);
              }
            });
          }

          const groups = Array.from(groupsSet);
          subSelector.innerHTML = '';

          let buttonsHTML = `
            <button class="group-btn active" onclick="changeTargetGroup('all', this)">
              جميع المجموعات
            </button>
          `;

          if (groups.length === 0) {
            buttonsHTML += `
              <p class="no-data" style="width:100%; text-align:center; font-size:0.9rem;">
                لا توجد مجموعات فرعية لهذه الفرقة.
              </p>
            `;
          } else {
            buttonsHTML += groups.map(g => `
              <button class="group-btn" onclick="changeTargetGroup('${g}', this)">
                ${g}
              </button>
            `).join('');
          }

          subSelector.innerHTML = buttonsHTML;
        })
        .catch(err => {
          console.error("خطأ في جلب المجموعات من الطلاب:", err);
          subSelector.innerHTML = `
            <button class="group-btn active" onclick="changeTargetGroup('all', this)">
              جميع الطلاب
            </button>
            <span class="error" style="font-size:0.8rem; text-align:center; display:block;">
              تعذر تحميل المجموعات
            </span>
          `;
        });
    }

    function changeTargetGroup(groupName, element) {
      targetStudentGroup = groupName;
      const buttons = document.querySelectorAll('#group-sub-selector .group-btn');
      buttons.forEach(btn => btn.classList.remove('active'));
      element.classList.add('active');
    }

    function loadLectures(group) {
      statusMessage.innerHTML = '';
      lecturesContainer.innerHTML = '<div class="loading">جاري تحميل المحاضرات...</div>';
      if (!currentUser) return;

      db.ref(`tenants/${currentUser.uid}/groups/${group}/lectures`).once("value")
        .then(snapshot => {
          const data = snapshot.val();
          lecturesContainer.innerHTML = '';
          if (!data) {
            lecturesContainer.innerHTML = '<p class="no-data">لا توجد محاضرات في هذه الفرقة.</p>';
            return;
          }
          let hasLectures = false;
          for (let lectureName in data) {
            hasLectures = true;
            const div = document.createElement("div");
            div.className = "lecture-item";
            div.innerHTML = `
              ${lectureName}
              <button class="send-btn" onclick="sendCommand('${group}', '${encodeURIComponent(lectureName)}')">
                📤 إرسال
              </button>
            `;
            lecturesContainer.appendChild(div);
          }
          if (!hasLectures) {
            lecturesContainer.innerHTML = '<p class="no-data">لا توجد محاضرات في هذه الفرقة.</p>';
          }
        })
        .catch(err => {
          console.error("خطأ في تحميل المحاضرات:", err);
          lecturesContainer.innerHTML = `<p class="error">خطأ في التحميل: ${err.message}</p>`;
        });
    }

    function sendCommand(group, lectureName) {
      const decodedName = decodeURIComponent(lectureName);
      const groupDisplay = targetStudentGroup === 'all' ? 'جميع المجموعات' : targetStudentGroup;
      const confirmMsg = `هل تريد إرسال المحاضرة "${decodedName}" إلى:
${group} - ${groupDisplay}؟`;
      if (!confirm(confirmMsg)) return;

      statusMessage.textContent = "جاري الإرسال...";
      statusMessage.className = "status-message";

      const broadcastRef = db.ref(`tenants/${currentUser.uid}/broadcast_messages`);
      broadcastRef.push({
        action: "start_lecture",
        lecture: decodedName,
        group: group,
        student_group: targetStudentGroup,
        timestamp: new Date().toISOString(),
        sender: currentUser.uid
      })
      .then(() => {
        statusMessage.textContent = `تم إرسال "${decodedName}" إلى ${group} - ${groupDisplay} بنجاح!`;
        statusMessage.className = "status-message success";
      })
      .catch(err => {
        console.error("خطأ في الإرسال:", err);
        statusMessage.textContent = "فشل في الإرسال. حاول لاحقاً.";
        statusMessage.className = "status-message error";
      });
    }

    function filterLectures() {
      const searchInput = document.getElementById('search-lecture').value.trim().toLowerCase();
      const lectureItems = document.querySelectorAll('.lecture-item');
      lectureItems.forEach(item => {
        const lectureName = item.textContent.trim().split('📤')[0].trim();
        if (lectureName.toLowerCase().includes(searchInput)) {
          item.style.display = 'flex';
        } else {
          item.style.display = 'none';
        }
      });
    }

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
      }, error => console.error("خطأ في جلب الإشعارات:", error));
    }

    function stopListeningToNotifications() {
      if (notificationListener) {
        notificationListener.off();
        notificationListener = null;
      }
    }

    window.addEventListener('beforeunload', stopListeningToNotifications);

    function toggleNotifications() {
      const box = document.getElementById('notification-box');
      box.style.display = box.style.display === 'block' ? 'none' : 'block';
      if (box.style.display === 'block') {
        markAllNotificationsAsRead();
      }
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
          .catch(error => console.error("خطأ في التحديث:", error));
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
        .catch(error => console.error("خطأ في المسح:", error));
    }

    function deleteNotification(notificationKey) {
      if (!currentUser) return;
      db.ref(`tenants/${currentUser.uid}/notifications/${notificationKey}`).remove()
        .then(() => {
          notifications = notifications.filter(n => n.key !== notificationKey);
          renderNotifications();
          updateNotificationBadge();
        })
        .catch(error => console.error("خطأ في الحذف:", error));
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