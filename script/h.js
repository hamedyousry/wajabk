 // تهيئة Firebase
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
    // المتغيرات
    let currentUser = null;
    let tenantId = null;
    let groups = {};
    let users = {};
    let selectedGroup = null;
    let selectedStudentGroup = null;
    let selectedLecture = null;
    let lectures = {};
    let currentFilter = 'all';
    window.allStudentsData = [];
    // دالة: تبديل القائمة
    function toggleNav() {
      document.getElementById('navbarLinks').classList.toggle('show');
    }
    // دالة: تبديل الوضع الليلي
    function toggleTheme() {
      const body = document.body;
      const isDark = body.classList.toggle('dark-mode');
      localStorage.setItem('dark-mode', isDark);
      const icon = document.getElementById('theme-icon');
      const text = document.getElementById('theme-text');
      icon.textContent = isDark ? '☀️' : '🌙';
      text.textContent = isDark ? 'الوضع النهاري' : 'الوضع الليلي';
    }
    // دالة: الإشعارات
    function toggleNotifications() {
      const box = document.getElementById('notification-box');
      box.style.display = box.style.display === 'block' ? 'none' : 'block';
    }
    function clearAllNotifications() {
      if (!currentUser || !confirm("هل أنت متأكد؟")) return;
      db.ref(`tenants/${currentUser.uid}/notifications`).remove().then(() => {
        document.getElementById('notification-list').innerHTML = '<div class="notification-item">لا توجد إشعارات</div>';
        document.getElementById('notification-count').textContent = '0';
      });
    }
    // إدارة الاشتراك
    function listenToSubscription(uid) {
      db.ref(`tenants/${uid}/subscription`).on("value", (snapshot) => {
        const modal = document.getElementById("subscription-block");
        if (!snapshot.exists() || !snapshot.val().endDate) {
          modal.style.display = "block";
          return;
        }
        const endDate = snapshot.val().endDate;
        const today = new Date().toISOString().split('T')[0];
        if (endDate < today) {
          modal.style.display = "block";
        } else {
          modal.style.display = "none";
          loadPageContent(uid);
        }
      });
    }
    function loadPageContent(uid) {
      tenantId = uid;
      loadGroups();
      document.getElementById('loader').style.display = 'none';
    }
    // تحميل الفرق كأزرار
    function loadGroups() {
      const groupsButtons = document.getElementById('groupsButtons');
      groupsButtons.innerHTML = '<div class="loader">جاري تحميل الفرق...</div>';
      db.ref(`tenants/${tenantId}/groups`).once('value').then(snapshot => {
        groupsButtons.innerHTML = '';
        if (!snapshot.exists()) {
          groupsButtons.innerHTML = '<span>لا توجد فرق متاحة</span>';
          return;
        }
        snapshot.forEach(child => {
          const groupName = child.key;
          groups[groupName] = child.val();
          const btn = document.createElement('button');
          btn.className = 'group-btn';
          btn.textContent = groupName;
          btn.onclick = () => {
            document.querySelectorAll('.group-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            selectedGroup = groupName;
            document.getElementById('groupsSelector').style.display = 'block';
            loadStudentGroups(groupName);
          };
          groupsButtons.appendChild(btn);
        });
      }).catch(err => {
        groupsButtons.innerHTML = '<span style="color:var(--error-color);">خطأ في التحميل</span>';
        console.error("خطأ في تحميل الفرق:", err);
      });
    }

    // تحميل المجموعات الفرعية
    function loadStudentGroups(group) {
      const subGroupsButtons = document.getElementById('subGroupsButtons');
      subGroupsButtons.innerHTML = '<div class="loader">جاري تحميل المجموعات...</div>';

      db.ref(`tenants/${tenantId}/student_groups_by_level/${group}`).once("value")
        .then(snapshot => {
          const data = snapshot.val();
          const groups = [];

          if (data && typeof data === 'object') {
            Object.keys(data).forEach(key => {
              const groupName = data[key];
              if (groupName && typeof groupName === 'string') {
                groups.push(groupName.trim());
              }
            });
          }

          const uniqueGroups = [...new Set(groups)];

          subGroupsButtons.innerHTML = '';

          let buttonsHTML = `
            <button class="group-btn active" onclick="selectStudentGroup('all', this)">
              جميع المجموعات
            </button>
          `;

          if (uniqueGroups.length === 0) {
            buttonsHTML += `
              <p class="no-data" style="width:100%; text-align:center; font-size:0.9rem;">
                لا توجد مجموعات فرعية.
              </p>
            `;
          } else {
            buttonsHTML += uniqueGroups.map(g => `
              <button class="group-btn" onclick="selectStudentGroup('${g}', this)">
                ${g}
              </button>
            `).join('');
          }

          subGroupsButtons.innerHTML = buttonsHTML;
        })
        .catch(err => {
          console.error("خطأ في جلب المجموعات:", err);
          subGroupsButtons.innerHTML = `
            <button class="group-btn active" onclick="selectStudentGroup('all', this)">
              جميع المجموعات
            </button>
          `;
        });
    }

    // اختيار المجموعة الفرعية
    function selectStudentGroup(groupName, element) {
      selectedStudentGroup = groupName;
      const buttons = document.querySelectorAll('#subGroupsButtons .group-btn');
      buttons.forEach(btn => btn.classList.remove('active'));
      element.classList.add('active');
      loadLectures();
    }

    // تحميل المحاضرات
    function loadLectures() {
      if (!selectedGroup) return;
      document.getElementById('lecturesSection').style.display = 'block';
      document.getElementById('studentsSection').style.display = 'none';
      const tbody = document.getElementById('lecturesTableBody');
      tbody.innerHTML = '<tr><td colspan="4">جاري التحميل...</td></tr>';
      const lecturesRef = db.ref(`tenants/${tenantId}/groups/${selectedGroup}/lectures`);
      lecturesRef.once('value').then(snapshot => {
        tbody.innerHTML = '';
        let index = 1;
        snapshot.forEach(child => {
          const lectureName = child.key;
          const lectureData = child.val();
          const totalQuestions = Object.keys(lectureData.essay_questions || {}).length +
                                Object.keys(lectureData.multiple_choice || {}).length +
                                Object.keys(lectureData.true_false || {}).length;
          const tr = document.createElement('tr');
          tr.innerHTML = `
            <td>${index++}</td>
            <td>${lectureName}</td>
            <td>${totalQuestions}</td>
            <td><button class="btn" onclick="showStudents('${lectureName}')">عرض الطلاب</button></td>
          `;
          tbody.appendChild(tr);
          lectures[lectureName] = lectureData;
        });
        if (index === 1) {
          tbody.innerHTML = '<tr><td colspan="4">لا توجد محاضرات في هذه الفرقة.</td></tr>';
        }
      }).catch(err => {
        console.error("خطأ في تحميل المحاضرات:", err);
        tbody.innerHTML = '<tr><td colspan="4">حدث خطأ.</td></tr>';
      });
    }

    // عرض الطلاب
    function showStudents(lectureName) {
      selectedLecture = lectureName;
      document.getElementById('studentsSection').style.display = 'block';
      document.getElementById('lectureTitle').textContent = `طلاب محاضرة: ${lectureName}`;
      const tbody = document.getElementById('studentsTableBody');
      tbody.innerHTML = '<tr><td colspan="6">جاري التحميل...</td></tr>';

      const filterButtons = document.querySelector('.filter-buttons');
      const exportBtn = document.querySelector('.export-btn');
      const messageBtn = document.getElementById('messageBtn');

      db.ref(`tenants/${tenantId}/users`).orderByChild('group').equalTo(selectedGroup).once('value', usersSnap => {
        const usersList = [];
        usersSnap.forEach(child => {
          const user = child.val();
          if (selectedStudentGroup === 'all' || user.student_group === selectedStudentGroup) {
            usersList.push({ id: child.key, ...user });
          }
        });

        // ✅ حساب عدد الطلاب
        const studentCount = usersList.length;
        console.log("عدد طلاب المجموعة:", studentCount);

        // ✅ التحكم في عرض الأزرار إذا كان العدد اكبر من 50
        if (studentCount > 50) {
          filterButtons.style.display = 'none';
          exportBtn.style.display = 'none';
          messageBtn.style.display = 'none';
        } else {
          filterButtons.style.display = 'flex';
          exportBtn.style.display = 'flex';
          messageBtn.style.display = 'flex';
        }

        db.ref(`tenants/${tenantId}/users_answers`).once('value', answersSnap => {
          const submittedUserIds = [];
          answersSnap.forEach(userAnswers => {
            const userId = userAnswers.key;
            userAnswers.forEach(submission => {
              const answersData = submission.val();
              if (answersData.answers && Array.isArray(answersData.answers)) {
                const lectureQuestions = [
                  ...Object.values(lectures[lectureName]?.essay_questions || {}),
                  ...Object.values(lectures[lectureName]?.multiple_choice || {}),
                  ...Object.values(lectures[lectureName]?.true_false || {})
                ].map(q => q.question);
                const hasAnswerForLecture = answersData.answers.some(answer =>
                  lectureQuestions.includes(answer.question)
                );
                if (hasAnswerForLecture) {
                  submittedUserIds.push(userId);
                }
              }
            });
          });

          window.allStudentsData = usersList.map(user => ({
            user,
            hasAnswered: submittedUserIds.includes(user.id)
          }));

          currentFilter = 'all';
          displayFilteredStudents();
        });
      });
    }

    // تصفية الطلاب
    function filterStudents(filterType) {
      currentFilter = filterType;
      displayFilteredStudents();
    }
    function displayFilteredStudents() {
      const tbody = document.getElementById('studentsTableBody');
      tbody.innerHTML = '';
      const data = window.allStudentsData.filter(item => {
        if (currentFilter === 'submitted') return item.hasAnswered;
        if (currentFilter === 'pending') return !item.hasAnswered;
        return true;
      });
      if (data.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6">لا توجد طلاب مطابقة للتصفية.</td></tr>';
        return;
      }
      let index = 1;
      data.forEach(({ user, hasAnswered }) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td>${index++}</td>
          <td>${user.name}</td>
          <td>${user.username || 'غير محدد'}</td>
          <td>${user.user_phone || 'غير متوفر'}</td>
          <td><span class="status ${hasAnswered ? 'status-submitted' : 'status-pending'}">
            ${hasAnswered ? 'أنهى' : 'لم يُجب بعد'}
          </span></td>
          <td>
            ${hasAnswered ? 
              `<button class="btn" onclick="showStudentAnswers('${user.id}', '${user.name}')">عرض الإجابات</button>` : 
              '<span>-</span>'
            }
          </td>
        `;
        tbody.appendChild(tr);
      });
    }

    // عرض إجابات الطالب
    function showStudentAnswers(userId, userName) {
      const modal = document.getElementById('answerModal');
      const modalName = document.getElementById('modalStudentName');
      const modalBody = document.getElementById('modalBody');
      modalName.textContent = `إجابات الطالب: ${userName}`;
      modalBody.innerHTML = '<p>جاري التحميل...</p>';
      modal.style.display = 'flex';

      const modalHeader = document.querySelector('.modal-header');
      const exportBtn = document.createElement('button');
      exportBtn.className = 'btn export-btn';
      exportBtn.innerHTML = '<i class="fas fa-file-excel"></i> تصدير إلى Excel';
      exportBtn.style.marginLeft = '10px';
      exportBtn.style.padding = '0.3rem 0.6rem';
      exportBtn.style.fontSize = '0.8rem';
      exportBtn.onclick = () => exportSingleStudentToExcel(userId, userName);
      if (!document.getElementById('exportStudentBtn')) {
        exportBtn.id = 'exportStudentBtn';
        modalHeader.appendChild(exportBtn);
      }

      db.ref(`tenants/${tenantId}/users_answers/${userId}`).once('value', snapshot => {
        let foundAnswers = null;
        snapshot.forEach(submission => {
          const data = submission.val();
          if (data.answers && Array.isArray(data.answers)) {
            const lectureQuestions = [
              ...Object.values(lectures[selectedLecture]?.essay_questions || {}),
              ...Object.values(lectures[selectedLecture]?.multiple_choice || {}),
              ...Object.values(lectures[selectedLecture]?.true_false || {})
            ].map(q => q.question);
            const matches = data.answers.some(ans => lectureQuestions.includes(ans.question));
            if (matches) foundAnswers = data.answers;
          }
        });
        if (!foundAnswers || foundAnswers.length === 0) {
          modalBody.innerHTML = '<p>لم يتم العثور على إجابات لهذا الطالب.</p>';
          return;
        }
        let html = '';
        foundAnswers.forEach(answer => {
          const typeText = { 'essay': 'سؤال مقال', 'mcq': 'اختيار من متعدد', 'tf': 'صح / خطأ' }[answer.type] || 'نوع غير معروف';
          let displayAnswer = answer.answer || 'الطالب لم يكتب إجابة';
          if (answer.type === 'mcq') {
            const mcqData = Object.values(lectures[selectedLecture]?.multiple_choice || {})
              .find(q => q.question === answer.question);
            if (mcqData) {
              if (answer.answer === 'correct') displayAnswer = mcqData.correct_answer;
              else if (answer.answer === 'incorrect') displayAnswer = '<span style="color:#999">لم يُختر خيار صالح</span>';
              else if (!mcqData.options.includes(answer.answer)) displayAnswer = `<em>"${answer.answer}" ليس من الخيارات</em>`;
            }
          }
          if (answer.type === 'tf') {
            displayAnswer = answer.answer === 'صح' || answer.answer === 'خطأ' ? answer.answer : (answer.correct ? 'صح' : 'خطأ');
          }
          html += `
            <div class="question-item">
              <h3>[${typeText}]</h3>
              <div class="question-text">${answer.question}</div>
              <strong>إجابة الطالب:</strong>
              <div class="answer-text">${displayAnswer}</div>
              ${answer.type !== 'essay' ? `
                <strong>الإجابة الصحيحة:</strong>
                <div class="correct-answer">
                  ${answer.type === 'mcq' ? 
                    (Object.values(lectures[selectedLecture]?.multiple_choice || {})
                      .find(q => q.question === answer.question)?.correct_answer || 'غير متوفر') : 
                    (answer.correct ? 'صح' : 'خطأ')}
                </div>
              ` : ''}
            </div>
          `;
        });
        modalBody.innerHTML = html;
      }).catch(err => {
        modalBody.innerHTML = `<p>خطأ في تحميل الإجابات: ${err.message}</p>`;
      });
    }

    function closeModal() {
      document.getElementById('answerModal').style.display = 'none';
      const exportBtn = document.getElementById('exportStudentBtn');
      if (exportBtn) exportBtn.remove();
    }

    // تصدير إلى Excel
    function exportAnswersToExcel() {
      const data = [];
      const rows = document.querySelectorAll('#studentsTableBody tr');
      rows.forEach(row => {
        const cells = row.querySelectorAll('td');
        data.push({
          'الاسم': cells[1].textContent,
          'اسم المستخدم': cells[2].textContent,
          'رقم الهاتف': cells[3].textContent,
          'الحالة': cells[4].querySelector('.status')?.textContent || '-'
        });
      });
      const ws = XLSX.utils.json_to_sheet(data);
      XLSX.utils.sheet_add_aoa(ws, [[`تقرير - ${document.getElementById('lectureTitle').textContent}`]], { origin: "A1" });
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "الطلاب");
      XLSX.writeFile(wb, `تقرير_الإجابات_${selectedLecture}.xlsx`);
    }

    function exportSingleStudentToExcel(userId, userName) {
      db.ref(`tenants/${tenantId}/users_answers/${userId}`).once('value', snapshot => {
        let foundAnswers = null;
        snapshot.forEach(submission => {
          const data = submission.val();
          if (data.answers && Array.isArray(data.answers)) {
            const lectureQuestions = [
              ...Object.values(lectures[selectedLecture]?.essay_questions || {}),
              ...Object.values(lectures[selectedLecture]?.multiple_choice || {}),
              ...Object.values(lectures[selectedLecture]?.true_false || {})
            ].map(q => q.question);
            const matches = data.answers.some(ans => lectureQuestions.includes(ans.question));
            if (matches) foundAnswers = data.answers;
          }
        });
        if (!foundAnswers || foundAnswers.length === 0) {
          alert("لا توجد إجابات لهذا الطالب.");
          return;
        }
        const data = foundAnswers.map(answer => {
          let displayAnswer = answer.answer || 'الطالب لم يكتب إجابة';
          let correctAnswer = '';
          if (answer.type === 'mcq') {
            const mcqData = Object.values(lectures[selectedLecture]?.multiple_choice || {})
              .find(q => q.question === answer.question);
            if (mcqData) {
              if (answer.answer === 'correct') displayAnswer = mcqData.correct_answer;
              else if (answer.answer === 'incorrect') displayAnswer = '<span style="color:#999">لم يُختر خيار صالح</span>';
              else if (!mcqData.options.includes(answer.answer)) displayAnswer = `<em>"${answer.answer}" ليس من الخيارات</em>`;
              correctAnswer = mcqData.correct_answer;
            }
          }
          if (answer.type === 'tf') {
            displayAnswer = answer.answer === 'صح' || answer.answer === 'خطأ' ? answer.answer : (answer.correct ? 'صح' : 'خطأ');
            correctAnswer = answer.correct ? 'صح' : 'خطأ';
          }
          return {
            'السؤال': answer.question,
            'نوع السؤال': answer.type === 'essay' ? 'سؤال مقال' : 
                          answer.type === 'mcq' ? 'اختيار من متعدد' : 
                          answer.type === 'tf' ? 'صح / خطأ' : 'نوع غير معروف',
            'إجابة الطالب': displayAnswer,
            'الإجابة الصحيحة': answer.type === 'essay' ? '-' : correctAnswer
          };
        });
        const ws = XLSX.utils.json_to_sheet(data);
        XLSX.utils.sheet_add_aoa(ws, [[`إجابات الطالب ${userName} - محاضرة ${selectedLecture}`]], { origin: "A1" });
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "الإجابات");
        XLSX.writeFile(wb, `إجابات_${userName}_${selectedLecture}.xlsx`);
      }).catch(err => {
        console.error("خطأ في تصدير الإجابات:", err);
        alert("حدث خطأ أثناء تصدير الإجابات.");
      });
    }

    function sendReminders() {
      if (!selectedLecture) {
        alert("يرجى اختيار محاضرة أولاً.");
        return;
      }
      const confirmSend = confirm("هل أنت متأكد من إرسال تذكير للطلاب الذين لم يجيبوا بعد؟");
      if (!confirmSend) return;

      db.ref(`tenants/${tenantId}/users`).orderByChild('group').equalTo(selectedGroup).once('value')
        .then(usersSnap => {
          const pendingUsers = [];
          usersSnap.forEach(child => {
            const user = child.val();
            if (selectedStudentGroup === 'all' || user.student_group === selectedStudentGroup) {
              pendingUsers.push({ id: child.key, name: user.name });
            }
          });
          return db.ref(`tenants/${tenantId}/users_answers`).once('value').then(answersSnap => {
            const submittedUserIds = [];
            answersSnap.forEach(userAnswers => {
              const userId = userAnswers.key;
              userAnswers.forEach(submission => {
                const answersData = submission.val();
                if (answersData.answers && Array.isArray(answersData.answers)) {
                  const lectureQuestions = [
                    ...Object.values(lectures[selectedLecture]?.essay_questions || {}),
                    ...Object.values(lectures[selectedLecture]?.multiple_choice || {}),
                    ...Object.values(lectures[selectedLecture]?.true_false || {})
                  ].map(q => q.question);
                  const hasAnswerForLecture = answersData.answers.some(answer =>
                    lectureQuestions.includes(answer.question)
                  );
                  if (hasAnswerForLecture) {
                    submittedUserIds.push(userId);
                  }
                }
              });
            });
            const notAnsweredUsers = pendingUsers.filter(user => !submittedUserIds.includes(user.id));
            if (notAnsweredUsers.length === 0) {
              alert("جميع الطلاب قد أجابوا بالفعل.");
              return;
            }
            const messageData = {
              sender: currentUser.uid,
              senderName: "الإدارة",
              message: `تنبيه: لم تجب بعد على واجب محاضرة "${selectedLecture}". يُرجى الإجابة في أقرب وقت.`,
              timestamp: new Date().toISOString(),
              status: "pending",
              read: false
            };
            const promises = notAnsweredUsers.map(user => {
              return db.ref(`tenants/${tenantId}/broadcast_messages/users/${user.id}`).push(messageData);
            });
            Promise.all(promises)
              .then(() => {
                alert(`تم إرسال تذكير لـ ${notAnsweredUsers.length} طالبًا.`);
              })
              .catch(err => {
                console.error("خطأ في إرسال التذكيرات:", err);
                alert("فشل إرسال التذكيرات.");
              });
          });
        })
        .catch(err => {
          console.error("خطأ في جلب البيانات:", err);
          alert("حدث خطأ أثناء جلب البيانات.");
        });
    }

    function logout() {
      if (confirm('هل أنت متأكد من تسجيل الخروج؟')) {
        auth.signOut().then(() => {
          window.location.href = "login.html";
        }).catch(err => alert("خطأ: " + err.message));
      }
    }

    function renewSubscription() {
      alert("يرجى التواصل مع الدعم لتجديد الاشتراك.");
    }

    document.addEventListener('DOMContentLoaded', function () {
      const isDark = localStorage.getItem('dark-mode') === 'true';
      if (isDark) document.body.classList.add('dark-mode');
      const icon = document.getElementById('theme-icon');
      const text = document.getElementById('theme-text');
      icon.textContent = isDark ? '☀️' : '🌙';
      text.textContent = isDark ? 'الوضع النهاري' : 'الوضع الليلي';
    });

    window.onload = function () {
      auth.onAuthStateChanged(user => {
        if (user) {
          currentUser = user;
          listenToSubscription(user.uid);
        } else {
          window.location.href = "login.html";
        }
      });
    };

    window.onclick = function (event) {
      const modal = document.getElementById('answerModal');
      if (event.target === modal) closeModal();
    };

    // نظام المراسلة
    function openMessageModal() {
      document.getElementById('messageModal').style.display = 'flex';
      if (selectedGroup) loadUsersForMessage();
    }
    function closeMessageModal() {
      document.getElementById('messageModal').style.display = 'none';
    }
    function loadUsersForMessage() {
      const select = document.getElementById('specificUserSelect');
      select.innerHTML = '';
      db.ref(`tenants/${tenantId}/users`).orderByChild('group').equalTo(selectedGroup).once('value')
        .then(snapshot => {
          snapshot.forEach(child => {
            const user = child.val();
            if (selectedStudentGroup === 'all' || user.student_group === selectedStudentGroup) {
              const option = document.createElement('option');
              option.value = child.key;
              option.textContent = user.name || user.username;
              select.appendChild(option);
            }
          });
        });
    }
    document.getElementById('recipientType')?.addEventListener('change', function () {
      document.getElementById('specificUserField').style.display = this.value === 'specific' ? 'block' : 'none';
    });
    document.getElementById('messageForm')?.addEventListener('submit', function (e) {
      e.preventDefault();
      const recipientType = document.getElementById('recipientType').value;
      const messageText = document.getElementById('messageText').value.trim();
      const specificUserId = document.getElementById('specificUserSelect').value;
      if (!messageText) return alert("الرجاء كتابة رسالة.");
      const messageData = {
        sender: currentUser.uid,
        senderName: users[currentUser.uid]?.name || "معلم",
        message: messageText,
        timestamp: new Date().toISOString(),
        status: "pending",
        read: false
      };
      let refPath = `tenants/${tenantId}/broadcast_messages/`;
      if (recipientType === 'specific') refPath += `users/${specificUserId}`;
      else if (recipientType === 'group') refPath += `groups/${selectedGroup}`;
      else refPath += `all`;
      document.getElementById('sendSpinner').style.display = 'inline';
      document.getElementById('sendText').style.display = 'none';
      db.ref(refPath).push(messageData)
        .then(() => {
          alert("✅ تم إرسال الرسالة بنجاح!");
          closeMessageModal();
        })
        .catch(err => {
          console.error("خطأ في إرسال الرسالة:", err);
          alert("❌ فشل إرسال الرسالة.");
        })
        .finally(() => {
          document.getElementById('sendSpinner').style.display = 'none';
          document.getElementById('sendText').style.display = 'inline';
        });

    });
