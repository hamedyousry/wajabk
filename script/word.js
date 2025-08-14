 // --- تهيئة Firebase ---
    const firebaseConfig = {
      apiKey: "AIzaSyCEAM6Mo5wCK4c_0w9M_xHfGQbRnhXQXNY",
      authDomain: "boot-al-abtal.firebaseapp.com",
      databaseURL: "https://boot-al-abtal-default-rtdb.firebaseio.com",
      projectId: "boot-al-abtal",
      storageBucket: "boot-al-abtal.appspot.com",
      messagingSenderId: "963942129622",
      appId: "1:963942129622:web:a23e17e9dc8f30cb5fce77"
    };
    firebase.initializeApp(firebaseConfig);
    const auth = firebase.auth();
    const db = firebase.database();
    let currentUser = null;
    let selectedGroup = "";
    let isLectureExists = false;
    let notifications = [];
    let notificationListener = null;
    let subscriptionListener = null;

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
        document.getElementById("subscription-block").style.display = "flex";
      });
    }

    function renewSubscription() {
      window.location.href = "login.html";
    }

    function loadPageContent(uid) {
      document.getElementById('uploadBtn').disabled = false;
      document.getElementById('loading').style.display = 'none';
    }

    // --- دوال التحقق من المحاضرة ---
    async function checkLectureExists() {
      const lectureName = document.getElementById('lectureName').value.trim();
      if (!selectedGroup || !lectureName) return;
      if (!currentUser) return;
      try {
        const uid = currentUser.uid;
        const lectureRef = db.ref(`tenants/${uid}/groups/${selectedGroup}/lectures/${lectureName}`);
        const snapshot = await lectureRef.once("value");
        if (snapshot.exists()) {
          const { value: action } = await Swal.fire({
            title: 'المحاضرة موجودة بالفعل!',
            html: `
              <div style="text-align: right; direction: rtl;">
                <p>المحاضرة <strong>"${lectureName}"</strong> موجودة بالفعل في الفرقة <strong>"${selectedGroup}"</strong></p>
                <p>ما الإجراء الذي تريد اتخاذه؟</p>
              </div>
            `,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: 'إضافة أسئلة جديدة لها',
            cancelButtonText: 'تغيير اسم المحاضرة',
            customClass: {
              confirmButton: 'btn-confirm',
              cancelButton: 'btn-cancel'
            },
            buttonsStyling: false,
            reverseButtons: true
          });
          if (action) {
            isLectureExists = false;
            document.getElementById('lectureName').classList.remove("lecture-exists");
            Swal.fire({
              title: 'تم التأكيد!',
              text: 'سيتم إضافة الأسئلة الجديدة للمحاضرة الموجودة',
              icon: 'success',
              confirmButtonText: 'حسناً'
            });
          } else {
            isLectureExists = true;
            document.getElementById('lectureName').classList.add("lecture-exists");
            document.getElementById('lectureName').focus();
          }
        } else {
          isLectureExists = false;
          document.getElementById('lectureName').classList.remove("lecture-exists");
        }
      } catch (error) {
        console.error("خطأ في التحقق من المحاضرة:", error);
        Swal.fire({
          title: 'خطأ!',
          text: 'حدث خطأ أثناء التحقق من وجود المحاضرة',
          icon: 'error',
          confirmButtonText: 'حسناً'
        });
      }
    }

    // --- دوال الصفحة الرئيسية ---
    function selectGroup(group, element) {
      selectedGroup = group;
      document.querySelectorAll('.group-btn').forEach(btn => {
        btn.classList.remove('active');
      });
      element.classList.add('active');
      checkLectureExists();
    }

    function showError(message) {
      const errorEl = document.getElementById('error');
      const successEl = document.getElementById('successMessage');
      errorEl.textContent = message;
      errorEl.style.display = 'block';
      successEl.style.display = 'none';
    }

    function showSuccess() {
      const successEl = document.getElementById('successMessage');
      const errorEl = document.getElementById('error');
      successEl.style.display = 'block';
      errorEl.style.display = 'none';
      setTimeout(() => {
        successEl.style.display = 'none';
      }, 3000);
    }

    function showLoading(show) {
      document.getElementById('loading').style.display = show ? 'block' : 'none';
    }

    function handleFileUpload() {
      const fileInput = document.getElementById('wordFileInput');
      const file = fileInput.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = function(e) {
        const arrayBuffer = e.target.result;
        mammoth.extractRawText({ arrayBuffer: arrayBuffer })
          .then(result => {
            document.getElementById('docText').value = result.value;
            document.getElementById('uploadBtn').disabled = false;
          })
          .catch(err => {
            alert("خطأ في قراءة الملف: " + err.message);
          });
      };
      reader.readAsArrayBuffer(file);
    }

    function downloadTemplate() {
      const templateText = `[ESSAY]
[IMAGE] https://drive.google.com/uc?export=view&id=FILE_ID
1. ما هو تعريف المحركات الكهربائية؟

[MULTIPLE_CHOICE]
[IMAGE] https://drive.google.com/uc?export=view&id=FILE_ID
1. ما نوع المحول؟
=محول نازل
محول صاعد
محول ثابت

[TRUE_FALSE]
[IMAGE] https://drive.google.com/uc?export=view&id=FILE_ID
1. المحول يغير التيار =صح`;
      const blob = new Blob([templateText], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'قالب_أسئلة_الكورس.txt';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }

    async function convertAndUpload() {
      const text = document.getElementById("docText").value.trim();
      const lectureName = document.getElementById("lectureName").value.trim();
      if (!text) return showError("الرجاء لصق النص أولًا");
      if (!selectedGroup || !lectureName) return showError("الرجاء اختيار الفرقة وإدخال اسم المحاضرة");
      showLoading(true);
      if (!currentUser) {
        showLoading(false);
        return showError("يرجى تسجيل الدخول أولاً");
      }
      const uid = currentUser.uid;
      const updates = {};
      let essayCount = 0, mcCount = 0, tfCount = 0;
      let currentImageUrl = null;

      try {
        const cleanText = text.replace(/\r/g, '');
        const lines = cleanText.split('\n').map(line => line.trim());

        const lectureRef = db.ref(`tenants/${uid}/groups/${selectedGroup}/lectures/${lectureName}`);
        const snapshot = await lectureRef.once("value");
        if (snapshot.exists() && isLectureExists) {
          showLoading(false);
          return showError("اسم المحاضرة موجود بالفعل، يرجى اختيار اسم آخر");
        }

        let section = null;
        let mcBlock = null;

        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];

          if (line.startsWith('[ESSAY]')) {
            section = 'ESSAY';
            continue;
          } else if (line.startsWith('[MULTIPLE_CHOICE]')) {
            section = 'MULTIPLE_CHOICE';
            continue;
          } else if (line.startsWith('[TRUE_FALSE]')) {
            section = 'TRUE_FALSE';
            continue;
          }

          if (line.startsWith('[IMAGE]')) {
            currentImageUrl = line.substring(7).trim();
            continue;
          }

          // --- الأسئلة المقالية ---
          if (section === 'ESSAY' && line.match(/^\d+\.\s/)) {
            const question = line.replace(/^\d+\.\s*/, '').trim();
            if (!question) continue;
            const key = db.ref().push().key;
            updates[`tenants/${uid}/groups/${selectedGroup}/lectures/${lectureName}/essay_questions/${key}`] = {
              question: question,
              type: "essay",
              ...(currentImageUrl && { imageUrl: currentImageUrl })
            };
            essayCount++;
            currentImageUrl = null;
          }

          // --- أسئلة الاختيار من متعدد ---
          if (section === 'MULTIPLE_CHOICE') {
            if (line.match(/^\d+\.\s/)) {
              if (mcBlock && mcBlock.question) {
                const { question, options, correct_answer } = mcBlock;
                if (options.length >= 2 && correct_answer) {
                  const key = db.ref().push().key;
                  updates[`tenants/${uid}/groups/${selectedGroup}/lectures/${lectureName}/multiple_choice/${key}`] = {
                    question,
                    options,
                    correct_answer,
                    type: "multiple_choice",
                    ...(currentImageUrl && { imageUrl: currentImageUrl })
                  };
                  mcCount++;
                }
              }
              mcBlock = {
                question: line.replace(/^\d+\.\s*/, '').trim(),
                options: [],
                correct_answer: null
              };
              currentImageUrl = null;
            } else if (mcBlock && line) {
              if (line.startsWith('=')) {
                mcBlock.correct_answer = line.substring(1).trim();
              } else {
                const opt = line.replace(/^[-•\s]+/, '').trim();
                if (opt) mcBlock.options.push(opt);
              }
            }
          }

          // --- أسئلة صح أو خطأ ---
          if (section === 'TRUE_FALSE' && line.includes('=')) {
            const qPart = line.split('=')[0].trim();
            const ansPart = line.split('=')[1].trim();
            if (!qPart || (ansPart !== 'صح' && ansPart !== 'خطأ')) continue;
            const correct_answer = ansPart === 'صح';
            const key = db.ref().push().key;
            updates[`tenants/${uid}/groups/${selectedGroup}/lectures/${lectureName}/true_false/${key}`] = {
              question: qPart,
              correct_answer: correct_answer,
              type: "true_false",
              ...(currentImageUrl && { imageUrl: currentImageUrl })
            };
            tfCount++;
            currentImageUrl = null;
          }
        }

        // حفظ آخر سؤال اختيار من متعدد
        if (section === 'MULTIPLE_CHOICE' && mcBlock && mcBlock.question && mcBlock.correct_answer && mcBlock.options.length >= 2) {
          const key = db.ref().push().key;
          updates[`tenants/${uid}/groups/${selectedGroup}/lectures/${lectureName}/multiple_choice/${key}`] = {
            question: mcBlock.question,
            options: mcBlock.options,
            correct_answer: mcBlock.correct_answer,
            type: "multiple_choice",
            ...(currentImageUrl && { imageUrl: currentImageUrl })
          };
          mcCount++;
        }

        if (Object.keys(updates).length === 0) {
          showLoading(false);
          return showError("لم يتم العثور على أسئلة صالحة");
        }

        updates[`tenants/${uid}/groups/${selectedGroup}/lectures/${lectureName}/created`] = true;
        await db.ref().update(updates);
        showLoading(false);
        showSuccess();

        // تحديث المعاينة
        document.getElementById('preview').innerHTML = '';
        if (essayCount > 0) {
          const div = document.createElement('div');
          div.innerHTML = `<strong>مقالية:</strong> ${essayCount} سؤال`;
          document.getElementById('preview').appendChild(div);
        }
        if (mcCount > 0) {
          const div = document.createElement('div');
          div.innerHTML = `<strong>اختيار من متعدد:</strong> ${mcCount} سؤال`;
          document.getElementById('preview').appendChild(div);
        }
        if (tfCount > 0) {
          const div = document.createElement('div');
          div.innerHTML = `<strong>صح أو خطأ:</strong> ${tfCount} سؤال`;
          document.getElementById('preview').appendChild(div);
        }
        document.getElementById('previewSection').style.display = 'block';
        document.getElementById('essayCount').textContent = essayCount;
        document.getElementById('mcCount').textContent = mcCount;
        document.getElementById('tfCount').textContent = tfCount;

      } catch (err) {
        showLoading(false);
        showError("حدث خطأ: " + err.message);
        console.error(err);
      }
    }

    // --- تحميل الصفحة ---
    window.onload = function() {
      showLoading(true);
      auth.onAuthStateChanged(user => {
        if (user) {
          currentUser = user;
          listenToSubscription(user.uid);
          startListeningToNotifications();
          document.getElementById('lectureName').addEventListener('input', checkLectureExists);
        } else {
          window.location.href = "login.html";
        }
      });
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
      document.getElementById('successMessage').style.display = 'none';
      document.getElementById('error').style.display = 'none';
    };

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

    // --- تسجيل الخروج ---
    function logout() {
      if (confirm('هل أنت متأكد من تسجيل الخروج؟')) {
        auth.signOut().then(() => {
          window.location.href = "login.html";
        }).catch(err => {
          alert("حدث خطأ أثناء تسجيل الخروج: " + err.message);
        });
      }
    }

    window.addEventListener('beforeunload', stopListeningToNotifications);