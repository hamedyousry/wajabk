// --- إعداد Firebase ---
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

    // --- المتغيرات ---
    let currentGroup = 'الفرقة الأولى';
    let currentSubgroupKey = null;
    let allUsers = {};
    let studentGroupsByLevel = {};
    let maxStudents = 0;
    let subscriptionListener = null;
    let notificationListener = null;
    let notifications = [];

    // --- تحميل الصفحة ---
    window.onload = function () {
      const container = document.getElementById('table-body');
      container.innerHTML = '<tr><td colspan="10" class="loading">جاري التحقق من الصلاحيات...</td></tr>';

      const currentPage = window.location.pathname.split('/').pop() || 'user-naw.html';
      const navLinks = document.querySelectorAll('.navbar-links a');
      navLinks.forEach(link => {
        const linkPage = link.getAttribute('href');
        if (currentPage === linkPage) {
          link.classList.add('active');
        }
      });

      if (localStorage.getItem('theme') === 'dark') {
        document.body.classList.add('dark-mode');
      }

      auth.onAuthStateChanged(user => {
        if (user) {
          listenToSubscription(user.uid);
          startListeningToNotifications();
        } else {
          // عند عدم وجود مستخدم، انتقل إلى صفحة تسجيل الدخول
          window.location.replace("login.html");
        }
      });
    };

    // --- التحكم في السمة (الوضع الليلي) ---
    function toggleTheme() {
      document.body.classList.toggle('dark-mode');
      localStorage.setItem('theme', document.body.classList.contains('dark-mode') ? 'dark' : 'light');
    }

    // --- القائمة المنسدلة (Hamburger) ---
    function toggleNav() {
      const navbarLinks = document.querySelector('.navbar-links');
      navbarLinks.classList.toggle('show');
    }

    // --- تسجيل الخروج (مُحسّن) ---
    function logout() {
      if (confirm('هل أنت متأكد من تسجيل الخروج؟')) {
        auth.signOut()
          .then(() => {
            console.log("تم تسجيل الخروج بنجاح");
            // مسح أي بيانات مؤقتة
            localStorage.removeItem('theme');
            // إعادة التوجيه الفوري
            window.location.replace("login.html");
          })
          .catch((error) => {
            console.error("خطأ في تسجيل الخروج:", error);
            alert("حدث خطأ أثناء تسجيل الخروج. حاول مرة أخرى.");
          });
      }
    }

    // --- تغيير الفرقة ---
    function changeGroup(group) {
      currentGroup = group;
      currentSubgroupKey = null;
      document.querySelectorAll('.group-btn').forEach(btn => btn.classList.remove('active'));
      event.target.classList.add('active');
      const user = auth.currentUser;
      if (user) {
        loadStudentGroups(user.uid, group);
      }
      renderTable();
    }

    // --- تحميل مجموعات الطلاب ---
    function loadStudentGroups(teacherUid, level) {
      const refPath = `tenants/${teacherUid}/student_groups_by_level/${level}`;
      return db.ref(refPath).once('value')
        .then(snapshot => {
          const groups = snapshot.val() || {};
          studentGroupsByLevel[level] = {};
          Object.keys(groups).forEach(key => {
            const name = groups[key];
            if (name && typeof name === 'string') {
              studentGroupsByLevel[level][key] = name;
            }
          });
          renderSubgroupButtons(level);
        })
        .catch(err => {
          console.error("خطأ في تحميل مجموعات الفرقة:", err);
          studentGroupsByLevel[level] = {};
          renderSubgroupButtons(level);
        });
    }

    // --- عرض أزرار المجموعات ---
    function renderSubgroupButtons(level) {
      const subgroupSelector = document.getElementById('subgroup-selector');
      subgroupSelector.innerHTML = '';
      subgroupSelector.style.display = 'none';
      const groups = studentGroupsByLevel[level] || {};
      if (Object.keys(groups).length > 0) {
        subgroupSelector.style.display = 'flex';
        Object.keys(groups).forEach(groupKey => {
          const groupName = groups[groupKey];
          const btn = document.createElement('button');
          btn.className = 'group-btn';
          btn.textContent = groupName;
          btn.onclick = () => selectSubgroup(groupKey);
          subgroupSelector.appendChild(btn);
        });
      }
    }

    // --- اختيار المجموعة الفرعية ---
    function selectSubgroup(groupKey) {
      currentSubgroupKey = groupKey;
      document.querySelectorAll('#subgroup-selector .group-btn').forEach(btn => btn.classList.remove('active'));
      event.target.classList.add('active');
      renderTable();
    }

    // --- مراقبة الاشتراك ---
    function listenToSubscription(uid) {
      const subscriptionRef = db.ref(`tenants/${uid}/subscription`);
      if (subscriptionListener) subscriptionListener.off();
      subscriptionListener = subscriptionRef.on("value", (snapshot) => {
        const modal = document.getElementById("subscription-block");
        if (!snapshot.exists()) {
          modal.style.display = "flex";
          return;
        }
        const sub = snapshot.val();
        const endDate = sub.endDate;
        maxStudents = sub.maxStudents || 0;
        document.getElementById('max-students').textContent = maxStudents || 'غير محدد';
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
          loadAllUsers(uid);
        }
        const endDateObj = new Date(endDate);
        const todayObj = new Date();
        const diffTime = endDateObj - todayObj;
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        if (diffDays <= 7) {
          showSubscriptionWarning(diffDays);
        }
      }, (error) => {
        console.error("خطأ في مراقبة الاشتراك:", error);
        document.getElementById("subscription-block").style.display = "flex";
      });
    }

    // --- عرض تحذير الاشتراك ---
    function showSubscriptionWarning(daysLeft) {
      const warning = document.getElementById('warning-message');
      const warningText = document.getElementById('warning-text');
      warningText.textContent = `تبقى ${daysLeft} أيام فقط على انتهاء اشتراكك!`;
      warning.style.display = 'flex';
      setTimeout(() => {
        warning.style.display = 'none';
      }, 10000);
    }

    // --- تحميل جميع المستخدمين ---
    function loadAllUsers(teacherUid) {
      db.ref(`tenants/${teacherUid}/users`).once('value')
        .then(snapshot => {
          const users = snapshot.val();
          allUsers = users || {};
          document.getElementById('total-students').textContent = Object.keys(allUsers).length;
          loadStudentGroups(teacherUid, currentGroup);
          renderTable();
        })
        .catch(err => {
          console.error("خطأ في تحميل الطلاب:", err);
          document.getElementById('table-body').innerHTML = '<tr><td colspan="10" class="error">فشل في التحميل</td></tr>';
        });
    }

    // --- عرض الجدول ---
    function renderTable() {
      const tableBody = document.getElementById('table-body');
      const filteredUsers = Object.keys(allUsers).filter(key => {
        const user = allUsers[key];
        if (!currentSubgroupKey) {
          return user.group === currentGroup;
        }
        return user.group === currentGroup && user.group_key === currentSubgroupKey;
      });

      if (filteredUsers.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="10" style="text-align:center;padding:20px">لا يوجد طلاب في هذه المجموعة</td></tr>';
        return;
      }

      tableBody.innerHTML = '';
      filteredUsers.forEach((userId, index) => {
        const user = allUsers[userId];
        const groupName = (studentGroupsByLevel[user.group] || {})[user.group_key] || user.group_key || "غير معروفة";
        const row = document.createElement('tr');
        row.innerHTML = `
          <td>${index + 1}</td>
          <td>${userId}</td>
          <td>${user.name || "غير معرف"}</td>
          <td>${user.username || "غير متوفر"}</td>
          <td>${user.user_phone || "غير متوفر"}</td>
          <td>${user.parent_phone || "غير متوفر"}</td>
          <td>${user.group || "غير محدد"}</td>
          <td>${groupName}</td>
          <td><span class="status status-${user.status || 'pending'}">${user.status === 'approved' ? 'مقبول' : 'قيد الانتظار'}</span></td>
          <td class="actions-cell">
            <button class="btn btn-sm btn-danger" onclick="deleteStudent('${userId}')">حذف</button>
          </td>
        `;
        tableBody.appendChild(row);
      });
    }

    // --- بحث الطلاب ---
    function searchStudents() {
      const searchTerm = document.getElementById('search-input').value.toLowerCase();
      const rows = document.querySelectorAll('#table-body tr');
      rows.forEach(row => {
        const text = row.textContent.toLowerCase();
        row.style.display = text.includes(searchTerm) ? '' : 'none';
      });
    }

    // --- فتح/إغلاق نافذة إضافة طالب ---
    function openAddModal() {
      const totalStudents = parseInt(document.getElementById('total-students').textContent);
      if (maxStudents > 0 && totalStudents >= maxStudents) {
        alert('لقد وصلت إلى الحد الأقصى لعدد الطلاب المسموح به في اشتراكك');
        return;
      }
      document.getElementById('add-modal').style.display = 'flex';
      document.getElementById('student-group').value = currentGroup;
      updateSubgroupOptions();
    }

    function closeAddModal() {
      document.getElementById('add-modal').style.display = 'none';
      document.getElementById('add-form').reset();
      document.getElementById('new-group-input').style.display = 'none';
    }

    // --- التعامل مع اختيار مجموعة جديدة ---
    function handleSubgroupChange() {
      const select = document.getElementById('student-subgroup');
      const selectedValue = select.value;
      const newGroupInput = document.getElementById('new-group-input');
      if (selectedValue === 'new_group') {
        newGroupInput.style.display = 'block';
      } else {
        newGroupInput.style.display = 'none';
      }
    }

    // --- إضافة مجموعة جديدة ---
    function addNewGroup() {
      const groupName = document.getElementById('new-group-name').value.trim();
      const currentLevel = document.getElementById('student-group').value;
      if (!groupName) {
        alert('يرجى إدخال اسم المجموعة');
        return;
      }
      if (!currentLevel) {
        alert('يرجى اختيار فرقة');
        return;
      }
      const user = auth.currentUser;
      if (!user) return;
      const newGroupRef = db.ref(`tenants/${user.uid}/student_groups_by_level/${currentLevel}`).push();
      newGroupRef.set(groupName)
        .then(() => {
          alert('تمت إضافة المجموعة بنجاح');
          document.getElementById('new-group-name').value = '';
          document.getElementById('new-group-input').style.display = 'none';
          loadStudentGroups(user.uid, currentLevel);
          updateSubgroupOptions();
        })
        .catch(err => {
          alert('خطأ في حفظ المجموعة: ' + err.message);
        });
    }

    // --- تحديث خيارات المجموعات ---
    function updateSubgroupOptions() {
      const select = document.getElementById('student-subgroup');
      const level = document.getElementById('student-group').value;
      select.innerHTML = '<option value="">اختر مجموعة...</option><option value="new_group">➕ إضافة مجموعة جديدة</option>';
      const groups = studentGroupsByLevel[level] || {};
      Object.keys(groups).forEach(groupKey => {
        const groupName = groups[groupKey];
        const option = document.createElement('option');
        option.value = groupKey;
        option.textContent = groupName;
        select.appendChild(option);
      });
    }

    // --- نافذة إضافة مجموعة منفصلة ---
    function openAddGroupModal() {
      document.getElementById('add-group-modal').style.display = 'flex';
      document.getElementById('group-level-select').value = '';
      document.getElementById('new-group-name-modal').value = '';
      document.getElementById('new-group-name-modal').disabled = true;
    }

    function closeAddGroupModal() {
      document.getElementById('add-group-modal').style.display = 'none';
    }

    function enableGroupNameInput() {
      const levelSelect = document.getElementById('group-level-select');
      const nameInput = document.getElementById('new-group-name-modal');
      if (levelSelect.value) {
        nameInput.disabled = false;
      } else {
        nameInput.disabled = true;
      }
    }

    function addNewGroupFromModal() {
      const user = auth.currentUser;
      if (!user) {
        alert('يجب تسجيل الدخول أولاً');
        return;
      }
      const level = document.getElementById('group-level-select').value;
      const groupName = document.getElementById('new-group-name-modal').value.trim();
      if (!level) {
        alert('يرجى اختيار الفرقة أولاً');
        return;
      }
      if (!groupName) {
        alert('يرجى إدخال اسم المجموعة');
        return;
      }
      db.ref(`tenants/${user.uid}/student_groups_by_level/${level}/${groupName}`).once('value')
        .then(snapshot => {
          if (snapshot.exists()) {
            alert('هذه المجموعة موجودة بالفعل في هذه الفرقة!');
            return;
          }
          const newGroupRef = db.ref(`tenants/${user.uid}/student_groups_by_level/${level}`).push();
          newGroupRef.set(groupName)
            .then(() => {
              alert('تمت إضافة المجموعة بنجاح');
              closeAddGroupModal();
              loadStudentGroups(user.uid, level);
              updateSubgroupOptions();
              document.getElementById('group-level-select').value = '';
              document.getElementById('new-group-name-modal').value = '';
              document.getElementById('new-group-name-modal').disabled = true;
            })
            .catch(err => {
              alert('خطأ في حفظ المجموعة: ' + err.message);
            });
        })
        .catch(err => {
          alert('خطأ في التحقق من التكرار: ' + err.message);
        });
    }

    // --- إضافة طالب ---
    function addStudent(event) {
      event.preventDefault();
      const user = auth.currentUser;
      if (!user) return;
      const totalStudents = parseInt(document.getElementById('total-students').textContent);
      if (maxStudents > 0 && totalStudents >= maxStudents) {
        alert('لقد وصلت إلى الحد الأقصى لعدد الطلاب المسموح به في اشتراكك');
        return;
      }
      const subgroupKey = document.getElementById('student-subgroup').value;
      if (!subgroupKey || subgroupKey === 'new_group') {
        alert('يرجى اختيار مجموعة صالحة');
        return;
      }
      const studentId = Date.now().toString();
      const studentData = {
        id: studentId,
        name: document.getElementById('student-name').value,
        username: document.getElementById('student-username').value,
        user_phone: document.getElementById('student-phone').value,
        parent_phone: document.getElementById('parent-phone').value,
        group: document.getElementById('student-group').value,
        group_key: subgroupKey,
        status: document.getElementById('student-status').value,
        registeredAt: new Date().toISOString()
      };
      db.ref(`tenants/${user.uid}/users/${studentId}`).set(studentData)
        .then(() => {
          alert('تم إضافة الطالب بنجاح');
          closeAddModal();
          loadAllUsers(user.uid);
        })
        .catch(err => {
          alert('خطأ: ' + err.message);
        });
    }

    // --- حذف طالب ---
    function deleteStudent(studentId) {
      if (!confirm('هل أنت متأكد من حذف هذا الطالب؟')) return;
      const user = auth.currentUser;
      if (!user) return;
      db.ref(`tenants/${user.uid}/users/${studentId}`).remove()
        .then(() => {
          alert('تم حذف الطالب');
          loadAllUsers(user.uid);
        })
        .catch(err => {
          alert('خطأ: ' + err.message);
        });
    }

    // --- تجديد الاشتراك ---
    function renewSubscription() {
      window.location.href = "login.html";
    }

    // --- الإشعارات ---
    function toggleNotifications() {
      const box = document.getElementById('notification-box');
      box.style.display = box.style.display === 'block' ? 'none' : 'block';
      if (box.style.display === 'block') {
        markAllNotificationsAsRead();
      }
    }

    function markAllNotificationsAsRead() {
      const updates = {};
      notifications.forEach(notif => {
        if (!notif.read) {
          updates[`tenants/${auth.currentUser.uid}/notifications/${notif.key}/read`] = true;
        }
      });
      if (Object.keys(updates).length > 0) {
        db.ref().update(updates)
          .then(() => updateNotificationBadge())
          .catch(error => console.error("Error marking notifications:", error));
      }
    }

    function clearAllNotifications() {
      if (!auth.currentUser || !confirm("هل أنت متأكد من مسح جميع الإشعارات؟")) return;
      db.ref(`tenants/${auth.currentUser.uid}/notifications`).remove()
        .then(() => {
          notifications = [];
          renderNotifications();
          updateNotificationBadge();
        })
        .catch(error => console.error("Error clearing notifications:", error));
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
        const time = new Date(notif.timestamp).toLocaleString('ar-EG');
        notifElement.innerHTML = `
          <div class="notification-message">
            ${notif.message}
            <div class="notification-time">${time}</div>
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

    function startListeningToNotifications() {
      if (!auth.currentUser) return;
      if (notificationListener) notificationListener.off();
      notificationListener = db.ref(`tenants/${auth.currentUser.uid}/notifications`)
        .on("value", (snapshot) => {
          notifications = [];
          const data = snapshot.val();
          if (data) {
            Object.keys(data).forEach(key => {
              notifications.push({
                key: key,
                message: data[key].message,
                timestamp: data[key].timestamp,
                read: data[key].read === true,
                sender: data[key].sender || 'النظام'
              });
            });
          }
          renderNotifications();
          updateNotificationBadge();
        }, error => {
          console.error("Error listening to notifications:", error);
        });
    }

    // --- تنظيف المراقبات عند الخروج ---
    window.addEventListener('beforeunload', () => {
      if (subscriptionListener) subscriptionListener.off();
      if (notificationListener) notificationListener.off();
    });