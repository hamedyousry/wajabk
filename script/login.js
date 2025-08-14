    // --- تنظيف رقم الهاتف المصري بأي شكل ---
    function cleanEgyptianPhone(phone) {
      const digits = phone.replace(/\D/g, '');
      if (digits.length >= 10) {
        const last10 = digits.slice(-10);
        if (/^1[0125]\d{8}$/.test(last10)) {
          return last10;
        }
        return last10;
      }
      return digits;
    }

    // --- تهيئة Firebase ---
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
    let tempUserData = null;
    let isNavigatingToSubscription = false;

    // --- عرض شاشة التحميل ---
    function showLoading() {
      document.getElementById("loading-overlay").style.display = "flex";
    }

    // --- إخفاء شاشة التحميل ---
    function hideLoading() {
      document.getElementById("loading-overlay").style.display = "none";
    }

    // --- تحقق من الاشتراك وتوجيه المستخدم ---
    function checkSubscriptionAndRedirect(uid) {
      db.ref(`subscriptions/${uid}`).once("value")
        .then(snapshot => {
          if (snapshot.exists()) {
            const sub = snapshot.val();
            const endDate = new Date(sub.endDate);
            const now = new Date();
            now.setHours(0, 0, 0, 0);
            endDate.setHours(0, 0, 0, 0);
            if (endDate < now) {
              showSubscription();
            } else {
              sessionStorage.removeItem("tempUserData");
              sessionStorage.removeItem("selectedPlan");
              localStorage.removeItem("tempLoginData");
              window.location.replace("user-naw.html");
            }
          } else {
            showSubscription();
          }
        })
        .catch(() => showSubscription());
    }

    // --- عرض الأقسام ---
    function showRegister() {
      document.getElementById("login-section").style.display = "none";
      document.getElementById("register-form").style.display = "block";
      document.getElementById("google-details-form").style.display = "none";
      document.getElementById("subscription-section").style.display = "none";
      document.getElementById("register-error").textContent = "";
    }

    function showLogin() {
      document.getElementById("register-form").style.display = "none";
      document.getElementById("google-details-form").style.display = "none";
      document.getElementById("login-section").style.display = "block";
      document.getElementById("subscription-section").style.display = "none";
      document.getElementById("error").textContent = "";
      document.getElementById("register-error").textContent = "";
      document.getElementById("google-error").textContent = "";
      hideLoading();
    }

    function showSubscription() {
      document.querySelector('.container').style.display = 'none';
      document.getElementById("subscription-section").style.display = "block";
      if (selectedPlan) {
        document.querySelectorAll('.plan').forEach(p => p.classList.remove('selected'));
        const plans = document.querySelectorAll('.plan');
        plans.forEach(p => {
          if (p.onclick.toString().includes(selectedPlan.type)) {
            p.classList.add('selected');
            document.getElementById("payment-details").style.display = selectedPlan.type === 'trial' ? "none" : "block";
          }
        });
      }
    }

    // --- تسجيل الدخول بجوجل ---
    function signInWithGoogle() {
      sessionStorage.removeItem("tempUserData");
      sessionStorage.removeItem("selectedPlan");
      tempUserData = null;
      const provider = new firebase.auth.GoogleAuthProvider();
      auth.signInWithPopup(provider)
        .then(userCredential => {
          const user = userCredential.user;
          Promise.all([
            db.ref(`tenants/${user.uid}`).once("value"),
            db.ref(`subscriptions/${user.uid}`).once("value")
          ])
          .then(([tenantSnap, subSnap]) => {
            if (tenantSnap.exists() || subSnap.exists()) {
              isNavigatingToSubscription = true;
              window.location.replace("user-naw.html");
              return;
            }
            document.getElementById("login-section").style.display = "none";
            document.getElementById("register-form").style.display = "none";
            document.getElementById("google-details-form").style.display = "block";
            document.getElementById("google-name").value = user.displayName || user.email.split('@')[0];
            tempUserData = {
              uid: user.uid,
              email: user.email,
              photo: user.photoURL || "",
              name: user.displayName || "",
              phone: ""
            };
          })
          .catch(() => {
            document.getElementById("login-section").style.display = "none";
            document.getElementById("register-form").style.display = "none";
            document.getElementById("google-details-form").style.display = "block";
            document.getElementById("google-name").value = user.displayName || user.email.split('@')[0];
            tempUserData = {
              uid: user.uid,
              email: user.email,
              photo: user.photoURL || "",
              name: user.displayName || "",
              phone: ""
            };
          });
        })
        .catch(error => {
          document.getElementById("error").textContent = "خطأ: " + error.message;
        });
    }

    // --- إكمال تسجيل جوجل ---
    function completeGoogleRegistration() {
      const name = document.getElementById("google-name").value.trim();
      const countryCode = document.getElementById("google-country-code").value;
      const phone = document.getElementById("google-phone").value.trim();
      const errorEl = document.getElementById("google-error");
      errorEl.textContent = "";

      if (!name || !countryCode || !phone) {
        errorEl.textContent = "الرجاء ملء جميع الحقول";
        return;
      }

      if (!/^\d{10,11}$/.test(phone)) {
        errorEl.textContent = "أدخل رقم هاتف صحيح (10-11 رقم)";
        return;
      }

      const fullPhone = countryCode + phone;
      tempUserData = { ...tempUserData, name, phone: fullPhone };
      sessionStorage.setItem("tempUserData", JSON.stringify(tempUserData));
      isNavigatingToSubscription = true;
      showSubscription();
    }

    // --- تسجيل دخول عادي ---
    function login() {
      const email = document.getElementById("email").value.trim();
      const password = document.getElementById("password").value;
      const errorEl = document.getElementById("error");
      errorEl.textContent = "";

      if (!email || !password) {
        errorEl.textContent = "املأ جميع الحقول";
        return;
      }

      showLoading();
      auth.signInWithEmailAndPassword(email, password)
        .then(userCredential => {
          localStorage.setItem("adminLoggedIn", "true");
          checkSubscriptionAndRedirect(userCredential.user.uid);
        })
        .catch(error => {
          hideLoading();
          switch (error.code) {
            case 'auth/user-not-found':
              errorEl.textContent = "الحساب غير موجود";
              break;
            case 'auth/wrong-password':
              errorEl.textContent = "كلمة المرور غير صحيحة";
              break;
            case 'auth/invalid-email':
              errorEl.textContent = "البريد غير صحيح";
              break;
            default:
              errorEl.textContent = "خطأ: " + error.message;
          }
        });
    }

    // --- إنشاء حساب جديد ---
    function register() {
      const name = document.getElementById("full-name").value.trim();
      const countryCode = document.getElementById("country-code").value;
      const phone = document.getElementById("phone").value.trim();
      const email = document.getElementById("register-email").value.trim();
      const password = document.getElementById("register-password").value;
      const agreed = document.getElementById("agree-terms").checked;
      const errorEl = document.getElementById("register-error");
      errorEl.textContent = "";

      if (!agreed) {
        errorEl.textContent = "يجب الموافقة على الشروط";
        return;
      }

      if (!name || !countryCode || !phone || !email || !password) {
        errorEl.textContent = "املأ جميع الحقول";
        return;
      }

      if (password.length < 6) {
        errorEl.textContent = "كلمة المرور يجب أن تكون 6 أحرف على الأقل";
        return;
      }

      const fullPhone = countryCode + phone;
      tempUserData = { name, phone: fullPhone, email, password, countryCode, photo: "", uid: "" };
      sessionStorage.setItem("tempUserData", JSON.stringify(tempUserData));

      showLoading();
      auth.createUserWithEmailAndPassword(email, password)
        .then((userCredential) => {
          tempUserData.uid = userCredential.user.uid;
          sessionStorage.setItem("tempUserData", JSON.stringify(tempUserData));
          isNavigatingToSubscription = true;
          showSubscription();
          hideLoading();
        })
        .catch(error => {
          hideLoading();
          switch (error.code) {
            case 'auth/email-already-in-use':
              errorEl.textContent = "البريد مستخدم بالفعل";
              break;
            case 'auth/invalid-email':
              errorEl.textContent = "البريد غير صحيح";
              break;
            default:
              errorEl.textContent = "خطأ: " + error.message;
          }
        });
    }

    // --- اختيار الخطة ---
    function selectPlan(element, type, days, maxStudents) {
      document.querySelectorAll('.plan').forEach(p => p.classList.remove('selected'));
      element.classList.add('selected');
      selectedPlan = { type, days, maxStudents };
      document.getElementById("payment-details").style.display = (type === 'trial') ? "none" : "block";
      sessionStorage.setItem("selectedPlan", JSON.stringify(selectedPlan));
    }

    // --- تأكيد الاشتراك ---
    function confirmSubscription() {
      if (!selectedPlan) {
        alert("اختر خطة أولاً");
        return;
      }

      if (!tempUserData) {
        const savedData = sessionStorage.getItem("tempUserData");
        if (savedData) tempUserData = JSON.parse(savedData);
      }

      if (!tempUserData) {
        alert("البيانات غير متوفرة. أعد التسجيل.");
        showRegister();
        return;
      }

      if (!tempUserData.phone || tempUserData.phone.length < 10) {
        alert("أدخل رقم هاتف صحيح");
        showRegister();
        return;
      }

      // ✅ تنفيذ مباشر للخطة المجانية (تحفظ البيانات في teachers)
      if (selectedPlan.type === 'trial') {
        createAccountAndSubscription(tempUserData, selectedPlan);
      } else {
        document.getElementById("payment-modal").style.display = "flex";
        document.getElementById("payment-error").style.display = "none";
      }
    }

    // --- التحقق من الدفع ---
    function verifyPayment() {
      const paymentCode = document.getElementById("payment-code-modal").value.trim();
      const errorEl = document.getElementById("payment-error");
      errorEl.style.display = "none";

      if (!paymentCode) {
        errorEl.textContent = "الرجاء إدخال رقم التحويل";
        errorEl.style.display = "block";
        return;
      }

      const expectedAmount = selectedPlan.type === 'monthly' ? 60 : 1800;

      showLoading();
      db.ref(`payment_codes/${paymentCode}`).once("value")
        .then(snapshot => {
          if (snapshot.exists() && !snapshot.val().used && snapshot.val().amount === expectedAmount) {
            const paymentData = {
              code: paymentCode,
              amount: expectedAmount,
              date: new Date().toISOString()
            };
            localStorage.setItem("paymentData", JSON.stringify(paymentData));
            createAccountAndSubscription(tempUserData, selectedPlan);
            document.getElementById("payment-modal").style.display = "none";
            window.location.replace("user-naw.html");
          } else {
            hideLoading();
            errorEl.textContent = "رقم التحويل غير صحيح أو تم استخدامه";
            errorEl.style.display = "block";
          }
        })
        .catch(() => {
          hideLoading();
          errorEl.textContent = "حدث خطأ، يرجى المحاولة مرة أخرى أو التواصل مع الدعم";
          errorEl.style.display = "block";
        });
    }

    function closePaymentModal() {
      document.getElementById("payment-modal").style.display = "none";
      document.getElementById("payment-error").style.display = "none";
    }

    function contactSupport() {
      const userDataToSave = {
        email: tempUserData?.email || document.getElementById("email")?.value || document.getElementById("register-email")?.value || "",
        name: tempUserData?.name || document.getElementById("full-name")?.value || document.getElementById("google-name")?.value || "",
        phone: tempUserData?.phone || ""
      };

      const paymentCode = document.getElementById("payment-code-modal")?.value.trim() || "لم يتم الإدخال";
      const planNames = { trial: "تجربة مجانية", monthly: "اشتراك شهري", yearly: "اشتراك سنوي" };
      const planLabel = planNames[selectedPlan?.type] || "غير محدد";

      const message = `
📞 *طلب دعم فني - كورس الأبطال*

الاسم: ${userDataToSave.name || "غير معروف"}
البريد: ${userDataToSave.email || "غير معروف"}
الهاتف: ${userDataToSave.phone || "غير معروف"}
الخطة: ${planLabel}
رقم التحويل: ${paymentCode}

يرجى التحقق من الدفع والرد في أسرع وقت.
      `.trim();

      const phone = "201091528121";
      const url = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
      window.open(url, '_blank');
    }

    // --- إنشاء الحساب والاشتراك + إضافة بيانات المُعلّم ---
    function createAccountAndSubscription(userData, plan) {
      const now = new Date();
      now.setHours(0, 0, 0, 0);
      const endDate = new Date(now);
      endDate.setDate(now.getDate() + plan.days);
      endDate.setHours(0, 0, 0, 0);

      const maxStudents = plan.maxStudents || 20;
      const endDateStr = endDate.toISOString().split('T')[0];
      const uid = userData.uid || auth.currentUser?.uid;

      if (!uid) {
        alert("فشل: تعذر الحصول على معرف المستخدم");
        return;
      }

      const tenantData = {
        info: {
          name: userData.name,
          phone: userData.phone,
          email: userData.email,
          uid: uid,
          createdAt: new Date().toISOString(),
          photo: userData.photo || ""
        },
        subscription: {
          plan: plan.type,
          maxStudents: maxStudents,
          endDate: endDateStr
        },
        users: {
          [uid]: {
            name: userData.name,
            email: userData.email,
            role: "owner",
            joinedAt: new Date().toISOString(),
            phone: userData.phone,
            photo: userData.photo || ""
          }
        },
        groups: {},
        new_users: {}
      };

      const teacherData = {
        createdAt: new Date().toISOString(),
        email: userData.email,
        name: userData.name,
        phone: userData.phone,
        photo: userData.photo || "",
        uid: uid
      };

      const updates = {};
      updates[`tenants/${uid}`] = tenantData;
      updates[`teachers/${uid}`] = teacherData;

      db.ref().update(updates)
        .then(() => {
          console.log("تم حفظ البيانات في tenants و teachers بنجاح");
          sessionStorage.removeItem("tempUserData");
          sessionStorage.removeItem("selectedPlan");
          window.location.replace("user-naw.html");
        })
        .catch(error => {
          hideLoading();
          console.error("خطأ في حفظ البيانات:", error);
          alert("فشل حفظ البيانات: " + error.message);
        });
    }

    function resetPassword() {
      const email = document.getElementById("email").value.trim();
      if (!email) {
        alert("أدخل بريدك أولًا");
        return;
      }
      auth.sendPasswordResetEmail(email)
        .then(() => alert("تم إرسال رابط إعادة التعيين"))
        .catch(error => alert("خطأ: " + error.message));
    }

    // --- مراقبة حالة المستخدم ---
    auth.onAuthStateChanged(user => {
      if (isNavigatingToSubscription) {
        isNavigatingToSubscription = false;
        return;
      }

      const savedData = sessionStorage.getItem("tempUserData");
      const savedPlan = sessionStorage.getItem("selectedPlan");

      if (savedData) tempUserData = JSON.parse(savedData);
      if (savedPlan) selectedPlan = JSON.parse(savedPlan);

      if (user) {
        const uid = user.uid;

        Promise.all([
          db.ref(`tenants/${uid}`).once("value"),
          db.ref(`subscriptions/${uid}`).once("value")
        ])
        .then(([tenantSnap, subSnap]) => {
          if (tenantSnap.exists() || subSnap.exists()) {
            sessionStorage.removeItem("tempUserData");
            sessionStorage.removeItem("selectedPlan");
            localStorage.removeItem("tempLoginData");
            window.location.replace("user-naw.html");
            return;
          }

          if (!savedData) {
            document.getElementById("login-section").style.display = "none";
            document.getElementById("google-details-form").style.display = "block";
            document.getElementById("google-name").value = user.displayName || user.email.split('@')[0];
            tempUserData = {
              uid: user.uid,
              email: user.email,
              photo: user.photoURL || "",
              name: user.displayName || "",
              phone: ""
            };
          } else if (tempUserData.phone && tempUserData.phone.length >= 10) {
            showSubscription();
          } else {
            document.getElementById("login-section").style.display = "none";
            document.getElementById("google-details-form").style.display = "block";
            document.getElementById("google-name").value = tempUserData.name || "";
          }
        })
        .catch(() => {
          if (!savedData) {
            document.getElementById("login-section").style.display = "none";
            document.getElementById("google-details-form").style.display = "block";
            document.getElementById("google-name").value = user.displayName || user.email.split('@')[0];
            tempUserData = {
              uid: user.uid,
              email: user.email,
              photo: user.photoURL || "",
              name: user.displayName || "",
              phone: ""
            };
          } else {
            showSubscription();
          }
        });

        return;
      }

      showLogin();
    });

    // عند التحميل
    window.addEventListener("load", () => {
      const savedData = sessionStorage.getItem("tempUserData");
      if (savedData) tempUserData = JSON.parse(savedData);
    });
