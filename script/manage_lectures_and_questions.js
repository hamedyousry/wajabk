 // --- تحويل روابط Google Drive ---
    function convertDriveLink(url) {
      if (!url) return '';
      const match = url.match(/\/d\/([-\w]+)/);
      if (match && match[1]) {
        return `https://drive.google.com/uc?export=download&id=${match[1]}`;
      }
      return url;
    }

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
    let selectedGroup = null;
    let currentUser = null;
    let currentLecture = null;
    let currentEditData = null;

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
      const badge = document.getElementById('notification-count');
      badge.textContent = unreadCount;
    }

    // --- تفعيل الرابط النشط عند التحميل ---
    document.addEventListener('DOMContentLoaded', function() {
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
        activeLink.classList.add('active');
      }
    });

    // --- التحقق من تسجيل الدخول ---
    auth.onAuthStateChanged(user => {
      if (user) {
        currentUser = user;
        startListeningToNotifications();
      } else {
        window.location.href = "login.html";
      }
    });

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
        window.location.href = "login.html";
      }
    }

    // --- وظائف المحاضرات والأسئلة ---
    function loadLectures(group, button) {
      selectedGroup = group;
      document.querySelectorAll('.group-btn').forEach(btn => {
        btn.classList.remove('active');
      });
      button.classList.add('active');
      const lecturesSection = document.getElementById('lecturesSection');
      lecturesSection.innerHTML = '<div class="loading">جاري التحميل...</div>';
      const lecturesRef = db.ref(`tenants/${currentUser.uid}/groups/${group}/lectures`);
      lecturesRef.once("value")
        .then(snapshot => {
          const data = snapshot.val();
          lecturesSection.innerHTML = '';
          if (data) {
            for (let name in data) {
              const div = document.createElement("div");
              div.className = "lecture-item";
              div.innerHTML = `
                ${name}
                <div class="lecture-actions">
                  <button class="edit-btn" onclick="openEditLectureModal('${group}', '${name}')">تعديل المحاضرة</button>
                  <button class="delete-btn" onclick="deleteLecture('${group}', '${name}')">حذف المحاضرة</button>
                </div>
              `;
              lecturesSection.appendChild(div);
            }
          } else {
            lecturesSection.innerHTML = "<p class='no-data'>لا توجد محاضرات في هذه الفرقة.</p>";
          }
        })
        .catch(err => {
          lecturesSection.innerHTML = `<p class="no-data">خطأ في التحميل: ${err.message}</p>`;
        });
    }

    function searchLectures() {
      const query = document.getElementById('searchInput').value.trim().toLowerCase();
      if (!query) return loadLectures(selectedGroup, document.querySelector('.group-btn.active'));
      const items = document.querySelectorAll('.lecture-item');
      items.forEach(item => {
        const title = item.textContent.split('تعديل')[0].trim().toLowerCase();
        item.style.display = title.includes(query) ? 'flex' : 'none';
      });
    }

    function openEditLectureModal(group, lectureName) {
      currentLecture = { group, name: lectureName };
      document.getElementById('editLectureName').value = lectureName;
      document.getElementById('lectureModal').style.display = 'block';
    }

    function closeLectureModal() {
      document.getElementById('lectureModal').style.display = 'none';
      currentLecture = null;
    }

    function saveLectureChanges() {
      const newName = document.getElementById('editLectureName').value.trim();
      if (!newName) return alert("الرجاء إدخال اسم جديد");
      if (newName === currentLecture.name) {
        closeLectureModal();
        return;
      }
      const oldPath = `tenants/${currentUser.uid}/groups/${currentLecture.group}/lectures/${currentLecture.name}`;
      const newPath = `tenants/${currentUser.uid}/groups/${currentLecture.group}/lectures/${newName}`;
      db.ref(oldPath).once("value")
        .then(snapshot => {
          const data = snapshot.val();
          if (!data) return alert("المحاضرة غير موجودة");
          const updates = {};
          updates[newPath] = data;
          updates[oldPath] = null;
          return db.ref().update(updates);
        })
        .then(() => {
          alert("تم تعديل اسم المحاضرة بنجاح");
          closeLectureModal();
          loadLectures(currentLecture.group, document.querySelector('.group-btn.active'));
        })
        .catch(err => {
          alert("خطأ: " + err.message);
        });
    }

    // --- دالة حذف المحاضرة ---
    function deleteLecture(group, lectureName) {
      if (!confirm(`هل أنت متأكد من حذف المحاضرة "${lectureName}"؟\nلن يمكن استعادة البيانات.`)) {
        return;
      }
      const lectureRef = db.ref(`tenants/${currentUser.uid}/groups/${group}/lectures/${lectureName}`);
      lectureRef.remove()
        .then(() => {
          alert("تم حذف المحاضرة بنجاح");
          // إعادة تحميل قائمة المحاضرات
          loadLectures(group, document.querySelector('.group-btn.active'));
        })
        .catch(err => {
          alert("خطأ في حذف المحاضرة: " + err.message);
        });
    }

    // --- مودال تعديل جميع الأسئلة دفعة واحدة ---
    function loadQuestions(lectureName) {
      const modalBody = document.getElementById('bulkEditModalBody');
      modalBody.innerHTML = '<div class="loading">جاري تحميل الأسئلة...</div>';
      document.getElementById('bulkEditModal').style.display = 'block';
      if (!selectedGroup) {
        modalBody.innerHTML = "<p class='no-data'>يجب اختيار فرقة أولًا.</p>";
        return;
      }
      const ref = db.ref(`tenants/${currentUser.uid}/groups/${selectedGroup}/lectures/${lectureName}`);
      ref.once("value")
        .then(snapshot => {
          const data = snapshot.val();
          modalBody.innerHTML = '';
          if (!data) {
            modalBody.innerHTML = "<p class='no-data'>لا توجد بيانات لهذه المحاضرة.</p>";
            return;
          }
          let hasQuestions = false;
          currentEditData = { group: selectedGroup, lecture: lectureName };
          // الأسئلة المقالية
          if (data.essay_questions) {
            modalBody.innerHTML += '<h3 style="margin: 1.5rem 0 1rem; color: var(--text-color);">الأسئلة المقالية</h3>';
            for (let key in data.essay_questions) {
              hasQuestions = true;
              const q = data.essay_questions[key];
              const imageUrl = q.imageUrl || '';
              const card = document.createElement('div');
              card.className = 'question-card essay_questions';
              card.innerHTML = `
                <input type="hidden" name="essay_key" value="${key}">
                <label><strong>نص السؤال:</strong></label>
                <input type="text" name="essay_question" value="${q.question}" class="modal-input" style="width:100%; margin-bottom: 0.5rem;">
                <label><strong>رابط الصورة (اختياري):</strong></label>
                <input type="url" name="essay_imageUrl" value="${imageUrl}" class="modal-input" style="width:100%; margin-bottom: 0.5rem;" placeholder="https://drive.google.com/uc?export=download&id=...">
                ${imageUrl ? 
                  `<div style="margin: 0.5rem 0;">
                    <img src="${convertDriveLink(imageUrl)}" alt="صورة السؤال" 
                         style="max-width: 200px; max-height: 200px; border-radius: 0.5rem; border: 1px solid var(--border-color);">
                  </div>` 
                  : ''}
                <button type="button" class="delete-btn" onclick="removeElement(this)">حذف السؤال</button>
                <hr style="margin: 1rem 0; border-color: var(--border-color);">
              `;
              modalBody.appendChild(card);
            }
          }
          // أسئلة الاختيار من متعدد
          if (data.multiple_choice) {
            modalBody.innerHTML += '<h3 style="margin: 1.5rem 0 1rem; color: var(--text-color);">أسئلة الاختيار من متعدد</h3>';
            for (let key in data.multiple_choice) {
              hasQuestions = true;
              const q = data.multiple_choice[key];
              const imageUrl = q.imageUrl || '';
              const options = q.options || [];
              const card = document.createElement('div');
              card.className = 'question-card multiple_choice';
              card.innerHTML = `
                <input type="hidden" name="mc_key" value="${key}">
                <label><strong>نص السؤال:</strong></label>
                <input type="text" name="mc_question" value="${q.question}" class="modal-input" style="width:100%; margin-bottom: 0.5rem;">
                <label><strong>رابط الصورة (اختياري):</strong></label>
                <input type="url" name="mc_imageUrl" value="${imageUrl}" class="modal-input" style="width:100%; margin-bottom: 0.5rem;" placeholder="https://drive.google.com/uc?export=download&id=...">
                ${imageUrl ? 
                  `<div style="margin: 0.5rem 0;">
                    <img src="${convertDriveLink(imageUrl)}" alt="صورة السؤال" 
                         style="max-width: 200px; max-height: 200px; border-radius: 0.5rem; border: 1px solid var(--border-color);">
                  </div>` 
                  : ''}
                <label><strong>الخيارات:</strong></label>
                <input type="text" name="mc_option" value="${options[0] || ''}" class="modal-input" style="width:90%; display:inline-block; margin-bottom: 0.3rem;">
                <input type="radio" name="mc_correct_${key}" value="0" ${options.indexOf(q.correct_answer) === 0 ? 'checked' : ''} style="margin-right: 0.5rem;">
                <small>صحيحة</small><br>
                <input type="text" name="mc_option" value="${options[1] || ''}" class="modal-input" style="width:90%; display:inline-block; margin-bottom: 0.3rem;">
                <input type="radio" name="mc_correct_${key}" value="1" ${options.indexOf(q.correct_answer) === 1 ? 'checked' : ''} style="margin-right: 0.5rem;">
                <small>صحيحة</small><br>
                <input type="text" name="mc_option" value="${options[2] || ''}" class="modal-input" style="width:90%; display:inline-block; margin-bottom: 0.3rem;">
                <input type="radio" name="mc_correct_${key}" value="2" ${options.indexOf(q.correct_answer) === 2 ? 'checked' : ''} style="margin-right: 0.5rem;">
                <small>صحيحة</small><br>
                <input type="text" name="mc_option" value="${options[3] || ''}" class="modal-input" style="width:90%; display:inline-block; margin-bottom: 0.3rem;">
                <input type="radio" name="mc_correct_${key}" value="3" ${options.indexOf(q.correct_answer) === 3 ? 'checked' : ''} style="margin-right: 0.5rem;">
                <small>صحيحة</small><br>
                <button type="button" class="delete-btn" onclick="removeElement(this)">حذف السؤال</button>
                <hr style="margin: 1rem 0; border-color: var(--border-color);">
              `;
              modalBody.appendChild(card);
            }
          }
          // أسئلة صح أو خطأ
          if (data.true_false) {
            modalBody.innerHTML += '<h3 style="margin: 1.5rem 0 1rem; color: var(--text-color);">أسئلة صح أو خطأ</h3>';
            for (let key in data.true_false) {
              hasQuestions = true;
              const q = data.true_false[key];
              const imageUrl = q.imageUrl || '';
              const card = document.createElement('div');
              card.className = 'question-card true_false';
              card.innerHTML = `
                <input type="hidden" name="tf_key" value="${key}">
                <label><strong>نص السؤال:</strong></label>
                <input type="text" name="tf_question" value="${q.question}" class="modal-input" style="width:100%; margin-bottom: 0.5rem;">
                <label><strong>رابط الصورة (اختياري):</strong></label>
                <input type="url" name="tf_imageUrl" value="${imageUrl}" class="modal-input" style="width:100%; margin-bottom: 0.5rem;" placeholder="https://drive.google.com/uc?export=download&id=...">
                ${imageUrl ? 
                  `<div style="margin: 0.5rem 0;">
                    <img src="${convertDriveLink(imageUrl)}" alt="صورة السؤال" 
                         style="max-width: 200px; max-height: 200px; border-radius: 0.5rem; border: 1px solid var(--border-color);">
                  </div>` 
                  : ''}
                <label><strong>الإجابة:</strong></label>
                <select name="tf_answer" class="modal-input" style="width:auto; margin-right: 1rem;">
                  <option value="true" ${q.correct_answer === true ? 'selected' : ''}>صح</option>
                  <option value="false" ${q.correct_answer === false ? 'selected' : ''}>خطأ</option>
                </select>
                <button type="button" class="delete-btn" onclick="removeElement(this)">حذف السؤال</button>
                <hr style="margin: 1rem 0; border-color: var(--border-color);">
              `;
              modalBody.appendChild(card);
            }
          }
          if (!hasQuestions) {
            modalBody.innerHTML = "<p class='no-data'>لا توجد أسئلة في هذه المحاضرة.</p>";
          }
        })
        .catch(err => {
          modalBody.innerHTML = `<p class="no-data">خطأ في التحميل: ${err.message}</p>`;
        });
    }

    function saveAllQuestions() {
      if (!currentEditData) return;
      const { group, lecture } = currentEditData;
      const modalBody = document.getElementById('bulkEditModalBody');
      const updates = {};
      // الأسئلة المقالية
      const essayCards = modalBody.querySelectorAll('.essay_questions');
      essayCards.forEach(card => {
        const key = card.querySelector('[name="essay_key"]').value;
        const question = card.querySelector('[name="essay_question"]').value.trim();
        const imageUrl = card.querySelector('[name="essay_imageUrl"]').value.trim();
        if (question) {
          updates[`tenants/${currentUser.uid}/groups/${group}/lectures/${lecture}/essay_questions/${key}`] = {
            question: question,
            imageUrl: imageUrl || null,
            type: "essay"
          };
        } else {
          updates[`tenants/${currentUser.uid}/groups/${group}/lectures/${lecture}/essay_questions/${key}`] = null;
        }
      });
      // أسئلة الاختيار من متعدد
      const mcCards = modalBody.querySelectorAll('.multiple_choice');
      mcCards.forEach(card => {
        const key = card.querySelector('[name="mc_key"]').value;
        const question = card.querySelector('[name="mc_question"]').value.trim();
        const options = Array.from(card.querySelectorAll('[name="mc_option"]')).map(input => input.value.trim()).filter(val => val);
        const correctIndex = card.querySelector(`[name="mc_correct_${key}"]:checked`)?.value;
        const correctAnswer = options[correctIndex] || options[0];
        const imageUrl = card.querySelector('[name="mc_imageUrl"]').value.trim();
        if (question && options.length >= 2) {
          updates[`tenants/${currentUser.uid}/groups/${group}/lectures/${lecture}/multiple_choice/${key}`] = {
            question: question,
            options: options,
            correct_answer: correctAnswer,
            imageUrl: imageUrl || null,
            type: "multiple_choice"
          };
        } else {
          updates[`tenants/${currentUser.uid}/groups/${group}/lectures/${lecture}/multiple_choice/${key}`] = null;
        }
      });
      // أسئلة صح أو خطأ
      const tfCards = modalBody.querySelectorAll('.true_false');
      tfCards.forEach(card => {
        const key = card.querySelector('[name="tf_key"]').value;
        const question = card.querySelector('[name="tf_question"]').value.trim();
        const correctAnswer = card.querySelector('[name="tf_answer"]').value === 'true';
        const imageUrl = card.querySelector('[name="tf_imageUrl"]').value.trim();
        if (question) {
          updates[`tenants/${currentUser.uid}/groups/${group}/lectures/${lecture}/true_false/${key}`] = {
            question: question,
            correct_answer: correctAnswer,
            imageUrl: imageUrl || null,
            type: "true_false"
          };
        } else {
          updates[`tenants/${currentUser.uid}/groups/${group}/lectures/${lecture}/true_false/${key}`] = null;
        }
      });
      // حفظ التحديثات
      db.ref().update(updates)
        .then(() => {
          alert("تم حفظ جميع التعديلات بنجاح");
          closeBulkEditModal();
        })
        .catch(err => {
          alert("خطأ في الحفظ: " + err.message);
        });
    }

    function closeBulkEditModal() {
      document.getElementById('bulkEditModal').style.display = 'none';
      currentEditData = null;
    }

    function removeElement(button) {
      if (confirm("هل أنت متأكد من حذف هذا السؤال؟")) {
        button.parentElement.remove();
      }
    }