 // تهيئة Firebase
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

    // متغيرات عامة
    let currentUser = null;
    let notifications = [];
    let notificationListener = null;
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
        });
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
          .catch(error => console.error("Error marking notifications:", error));
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
        .catch(error => console.error("Error clearing notifications:", error));
    }

    function deleteNotification(notificationKey) {
      if (!currentUser) return;
      db.ref(`tenants/${currentUser.uid}/notifications/${notificationKey}`).remove()
        .then(() => {
          notifications = notifications.filter(n => n.key !== notificationKey);
          renderNotifications();
          updateNotificationBadge();
        })
        .catch(error => console.error("Error deleting notification:", error));
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
      }, error => console.error("Error listening to notifications:", error));
    }

    // --- إدارة الاشتراك ---
    function checkSubscription(uid) {
      db.ref(`tenants/${uid}/subscription`).once("value")
        .then(snapshot => {
          document.getElementById("loading").style.display = "none";
          
          if (!snapshot.exists()) {
            showSubscriptionModal("لا يوجد اشتراك فعال");
            return;
          }
          
          const subData = snapshot.val();
          const endDate = subData.endDate;
          const today = new Date().toISOString().split('T')[0];
          
          if (endDate < today) {
            showSubscriptionModal(`انتهت صلاحية اشتراكك في ${formatDate(endDate)}`);
          } else {
            // حساب الأيام المتبقية
            const end = new Date(endDate);
            const diffTime = end - new Date();
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            
            // عرض تنبيه إذا بقي أقل من 7 أيام
            if (diffDays <= 7) {
              showWarningMessage(`تبقى ${diffDays} أيام على انتهاء اشتراكك`);
            }
            
            loadPageContent();
          }
        })
        .catch(error => {
          console.error("Error checking subscription:", error);
          document.getElementById("loading").style.display = "none";
          showSubscriptionModal("حدث خطأ في التحقق من الاشتراك");
        });
    }

    function formatDate(dateString) {
      const options = { year: 'numeric', month: 'long', day: 'numeric' };
      return new Date(dateString).toLocaleDateString('ar-EG', options);
    }

    function showWarningMessage(message) {
      const warning = document.createElement('div');
      warning.className = 'warning-message';
      warning.innerHTML = `
        <i class="fas fa-exclamation-triangle"></i> ${message}
      `;
      document.querySelector('.container').prepend(warning);
    }

    function showSubscriptionModal(message = "انتهت صلاحية اشتراكك") {
      const modal = document.getElementById("subscription-block");
      modal.querySelector('p').textContent = message;
      modal.style.display = "flex";
      
      // منع التفاعل مع الصفحة الرئيسية
      document.querySelectorAll('.container *, .navbar *').forEach(el => {
        el.style.pointerEvents = 'none';
        el.style.opacity = '0.5';
      });
    }

    function renewSubscription() {
      window.location.href = "subscription.html";
    }

    function loadPageContent() {
      // تطبيق الوضع الليلي إذا كان محفوظًا
      if (localStorage.getItem('dark-mode') === 'true') {
        document.body.classList.add('dark-mode');
        document.getElementById('theme-icon').textContent = '☀️';
        document.getElementById('theme-text').textContent = 'الوضع النهاري';
      }
    }

    // --- وظائف إضافة الأسئلة ---
    function nextStep(step) {
      const validation = validateStep(step);
      if (validation === false) return;

      document.querySelectorAll('.step').forEach(s => s.classList.remove('active'));
      document.getElementById(`step${step + 1}`).classList.add('active');
    }

    function prevStep() {
      const current = document.querySelector('.step.active');
      const step = parseInt(current.id.replace('step', ''));
      if (step > 1) {
        current.classList.remove('active');
        document.getElementById(`step${step - 1}`).classList.add('active');
      }
    }

    function validateStep(step) {
      if (step === 1) {
        const group = document.getElementById('groupSelect').value;
        const lecture = document.getElementById('lectureName').value.trim();
        if (!group) {
          showError('يرجى اختيار الفرقة');
          return false;
        }
        if (!lecture) {
          showError('يرجى إدخال اسم المحاضرة');
          return false;
        }
        return { group, lecture };
      }
      return true;
    }

    function addEssayQuestion() {
      const container = document.getElementById('essayQuestions');
      const block = document.createElement('div');
      block.className = 'question-block';
      block.innerHTML = `
        <label>السؤال:</label>
        <textarea name="question" placeholder="أدخل السؤال المقالة" required></textarea>
        
        <label>رابط صورة السؤال (اختياري):</label>
        <input type="url" name="imageUrl" placeholder="https://example.com/image.jpg">
        
        <div class="image-preview-container">
          <img class="image-preview" alt="معاينة الصورة">
          <button class="remove-image-btn" onclick="removeImagePreview(this)">إزالة الصورة</button>
        </div>
        
        <button class="remove-btn" onclick="this.parentElement.remove()">حذف السؤال</button>
      `;
      
      // إضافة مستمع لرابط الصورة
      const imageUrlInput = block.querySelector('[name="imageUrl"]');
      imageUrlInput.addEventListener('input', function() {
        updateImagePreview(this);
      });
      
      container.appendChild(block);
    }

    function addMCQuestion() {
      const container = document.getElementById('mcQuestions');
      const block = document.createElement('div');
      block.className = 'question-block';
      block.innerHTML = `
        <label>السؤال:</label>
        <textarea name="question" placeholder="أدخل السؤال متعدد الخيارات" required></textarea>
        
        <label>رابط صورة السؤال (اختياري):</label>
        <input type="url" name="imageUrl" placeholder="https://example.com/image.jpg">
        
        <div class="image-preview-container">
          <img class="image-preview" alt="معاينة الصورة">
          <button class="remove-image-btn" onclick="removeImagePreview(this)">إزالة الصورة</button>
        </div>
        
        <label>الخيارات:</label>
        <div class="options">
          <div class="option"><input type="text" name="option0" placeholder="الخيار الأول" required> <input type="radio" name="correct" value="0" required></div>
          <div class="option"><input type="text" name="option1" placeholder="الخيار الثاني" required> <input type="radio" name="correct" value="1" required></div>
          <div class="option"><input type="text" name="option2" placeholder="الخيار الثالث" required> <input type="radio" name="correct" value="2" required></div>
          <div class="option"><input type="text" name="option3" placeholder="الخيار الرابع" required> <input type="radio" name="correct" value="3" required></div>
        </div>
        <button class="remove-btn" onclick="this.parentElement.remove()">حذف السؤال</button>
      `;
      
      // إضافة مستمع لرابط الصورة
      const imageUrlInput = block.querySelector('[name="imageUrl"]');
      imageUrlInput.addEventListener('input', function() {
        updateImagePreview(this);
      });
      
      container.appendChild(block);
    }

    function addTFQuestion() {
      const container = document.getElementById('tfQuestions');
      const block = document.createElement('div');
      block.className = 'question-block';
      block.innerHTML = `
        <label>السؤال:</label>
        <textarea name="question" placeholder="أدخل سؤال الصح أو الخطأ" required></textarea>
        
        <label>رابط صورة السؤال (اختياري):</label>
        <input type="url" name="imageUrl" placeholder="https://example.com/image.jpg">
        
        <div class="image-preview-container">
          <img class="image-preview" alt="معاينة الصورة">
          <button class="remove-image-btn" onclick="removeImagePreview(this)">إزالة الصورة</button>
        </div>
        
        <label>الإجابة الصحيحة:</label>
        <div class="options">
          <label><input type="radio" name="correct" value="true" required> صح</label>
          <label><input type="radio" name="correct" value="false" required> خطأ</label>
        </div>
        <button class="remove-btn" onclick="this.parentElement.remove()">حذف السؤال</button>
      `;
      
      // إضافة مستمع لرابط الصورة
      const imageUrlInput = block.querySelector('[name="imageUrl"]');
      imageUrlInput.addEventListener('input', function() {
        updateImagePreview(this);
      });
      
      container.appendChild(block);
    }

    // دالة لتحديث معاينة الصورة
    function updateImagePreview(inputElement) {
      const url = inputElement.value.trim();
      const previewContainer = inputElement.closest('.question-block').querySelector('.image-preview-container');
      const previewImg = previewContainer.querySelector('.image-preview');
      const removeBtn = previewContainer.querySelector('.remove-image-btn');
      
      if (url) {
        previewImg.src = url;
        previewImg.style.display = 'block';
        removeBtn.style.display = 'inline-block';
      } else {
        previewImg.style.display = 'none';
        removeBtn.style.display = 'none';
      }
    }

    // دالة لإزالة معاينة الصورة
    function removeImagePreview(button) {
      const previewContainer = button.closest('.image-preview-container');
      const input = previewContainer.closest('.question-block').querySelector('[name="imageUrl"]');
      const previewImg = previewContainer.querySelector('.image-preview');
      
      input.value = '';
      previewImg.style.display = 'none';
      button.style.display = 'none';
    }

    function showError(message) {
      const errorDiv = document.createElement('div');
      errorDiv.className = 'error-message';
      errorDiv.textContent = message;
      errorDiv.style.display = 'block';
      document.querySelector('.step.active').appendChild(errorDiv);
      setTimeout(() => { errorDiv.style.display = 'none'; }, 5000);
    }

    function sanitizeInput(text) {
      return text.replace(/<[^>]*>/g, '').trim();
    }

    function isValidUrl(string) {
      try {
        new URL(string);
        return true;
      } catch (_) {
        return false;
      }
    }

    async function submitAllQuestions() {
      const group = document.getElementById('groupSelect').value;
      const lectureName = document.getElementById('lectureName').value.trim();

      if (!group || !lectureName) {
        showError('يرجى إكمال اختيار الفرقة واسم المحاضرة');
        return;
      }

      const user = auth.currentUser;
      if (!user) {
        showError('يرجى تسجيل الدخول أولاً');
        window.location.href = "login.html";
        return;
      }
      const uid = user.uid;

      const updates = {};

      // 1. أسئلة مقالة
      document.querySelectorAll('#essayQuestions .question-block').forEach(block => {
        const question = block.querySelector('[name="question"]').value.trim();
        const imageUrl = block.querySelector('[name="imageUrl"]').value.trim();
        
        if (question) {
          const sanitizedQuestion = sanitizeInput(question);
          const newKey = db.ref().push().key;
          
          const questionData = {
            question: sanitizedQuestion,
            type: "essay"
          };
          
          if (imageUrl && isValidUrl(imageUrl)) {
            questionData.imageUrl = imageUrl;
          }
          
          updates[`tenants/${uid}/groups/${group}/lectures/${lectureName}/essay_questions/${newKey}`] = questionData;
        }
      });

      // 2. أسئلة اختيار من متعدد
      document.querySelectorAll('#mcQuestions .question-block').forEach(block => {
        const question = block.querySelector('[name="question"]').value.trim();
        const imageUrl = block.querySelector('[name="imageUrl"]').value.trim();
        const option0 = block.querySelector('[name="option0"]').value.trim();
        const option1 = block.querySelector('[name="option1"]').value.trim();
        const option2 = block.querySelector('[name="option2"]').value.trim();
        const option3 = block.querySelector('[name="option3"]').value.trim();
        const correctIndex = block.querySelector('[name="correct"]:checked')?.value;

        if (question && option0 && option1 && option2 && option3 && correctIndex !== undefined) {
          const sanitizedQuestion = sanitizeInput(question);
          const options = [
            sanitizeInput(option0), 
            sanitizeInput(option1), 
            sanitizeInput(option2),
            sanitizeInput(option3)
          ];
          const correctAnswer = options[parseInt(correctIndex)];
          const newKey = db.ref().push().key;

          const questionData = {
            question: sanitizedQuestion,
            options: options,
            correct_answer: correctAnswer,
            type: "multiple_choice"
          };
          
          if (imageUrl && isValidUrl(imageUrl)) {
            questionData.imageUrl = imageUrl;
          }
          
          updates[`tenants/${uid}/groups/${group}/lectures/${lectureName}/multiple_choice/${newKey}`] = questionData;
        }
      });

      // 3. أسئلة صح أو خطأ
      document.querySelectorAll('#tfQuestions .question-block').forEach(block => {
        const question = block.querySelector('[name="question"]').value.trim();
        const imageUrl = block.querySelector('[name="imageUrl"]').value.trim();
        const correct = block.querySelector('[name="correct"]:checked')?.value;

        if (question && correct !== undefined) {
          const sanitizedQuestion = sanitizeInput(question);
          const isCorrect = correct === "true";
          const newKey = db.ref().push().key;

          const questionData = {
            question: sanitizedQuestion,
            correct_answer: isCorrect,
            type: "true_false"
          };
          
          if (imageUrl && isValidUrl(imageUrl)) {
            questionData.imageUrl = imageUrl;
          }
          
          updates[`tenants/${uid}/groups/${group}/lectures/${lectureName}/true_false/${newKey}`] = questionData;
        }
      });

      if (Object.keys(updates).length === 0) {
        showError('لا يوجد أسئلة لإرسالها');
        return;
      }

      try {
        await db.ref().update(updates);
        document.getElementById("success-message").style.display = "block";
        setTimeout(() => {
          window.location.reload();
        }, 2000);
      } catch (error) {
        console.error("Firebase Error:", error);
        showError('فشل في الحفظ: ' + error.message);
      }
    }

    // تحميل الصفحة
    window.onload = function() {
      const loading = document.getElementById("loading");
      auth.onAuthStateChanged(user => {
        if (user) {
          currentUser = user;
          loading.textContent = "جاري التحقق من اشتراكك...";
          loading.style.display = "block";
          checkSubscription(user.uid);
          startListeningToNotifications();
        } else {
          window.location.href = "login.html";
        }
      });
      
      // تحديد الصفحة الحالية وتفعيل الرابط المناسب في القائمة
      const currentPage = window.location.pathname.split('/').pop() || 'user-naw.html';
      const navLinks = document.querySelectorAll('.navbar-links a');
      
      navLinks.forEach(link => {
        const linkPage = link.getAttribute('href');
        if (currentPage === linkPage) {
          link.classList.add('active');
        }
      });
    };

    // إيقاف المستمعين عند إغلاق الصفحة
    window.addEventListener('beforeunload', function() {
      if (notificationListener) notificationListener.off();
      if (subscriptionListener) subscriptionListener.off();
    });