// DRVN Garage - Authentication, Firebase Init & Subscription System

// ==========================================
// THEME FUNCTIONS
// ==========================================

function initTheme() {
    const savedTheme = localStorage.getItem('theme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);
    updateThemeIcon(savedTheme);
}

// Toggle theme
function toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';

    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
    updateThemeIcon(newTheme);

    // Show notification
    const message = newTheme === 'dark' ? 'הופעל מצב לילה 🌙' : 'הופעל מצב יום ☀️';
    showNotification(message);
}

// Update theme icon
function updateThemeIcon(theme) {
    const icon = document.getElementById('themeIcon');
    if (icon) {
        icon.textContent = theme === 'dark' ? '🌙' : '☀️';
    }
    // Update sidebar theme icon
    if (typeof updateSidebarTheme === 'function') updateSidebarTheme();
}

// Initialize theme on page load
initTheme();

// ==========================================
// Initialize Firebase
// ==========================================

// Variables are declared in config.js (app, db, auth, messaging, currentUser, etc.)

try {
    app = firebase.initializeApp(firebaseConfig);
    db = firebase.firestore();
    auth = firebase.auth();
    console.log('Firebase initialized with maintenance system!');

    // Initialize Firebase Messaging
    try {
        messaging = firebase.messaging(); // ⭐ بدون let
        console.log('Firebase Messaging initialized!');
    } catch (msgError) {
        console.log('Firebase Messaging not supported:', msgError);
        messaging = null;
    }
} catch (error) {
    console.error('Firebase initialization error:', error);
    document.getElementById('loadingScreen').innerHTML =
        '<div class="text-center"><p class="text-red-600">שגיאה בטעינת המערכת</p></div>';
}

// ==========================================
// LOGIN HELPER FUNCTIONS
// ==========================================

// Toggle Password Visibility
function togglePasswordVisibility() {
    const passwordInput = document.getElementById('password');
    const toggleIcon = document.getElementById('togglePasswordIcon');

    if (passwordInput.type === 'password') {
        passwordInput.type = 'text';
        toggleIcon.textContent = '🙈';
    } else {
        passwordInput.type = 'password';
        toggleIcon.textContent = '👁️';
    }
}

// Show Forgot Password Dialog
function showForgotPassword() {
    const email = prompt('הכנס את כתובת האימייל שלך לאיפוס סיסמה:');

    if (email && email.trim()) {
        auth.sendPasswordResetEmail(email.trim())
            .then(() => {
                alert('נשלח אליך מייל לאיפוס הסיסמה. בדוק את תיבת הדואר שלך.');
            })
            .catch((error) => {
                console.error('Password reset error:', error);
                if (error.code === 'auth/user-not-found') {
                    alert('לא נמצא משתמש עם אימייל זה');
                } else if (error.code === 'auth/invalid-email') {
                    alert('כתובת אימייל לא תקינה');
                } else {
                    alert('שגיאה בשליחת המייל: ' + error.message);
                }
            });
    }
}

// ==========================================
// AUTH GUARD - حماية الصفحة - التوجيه التلقائي لصفحة التسجيل
// ==========================================

auth.onAuthStateChanged(async (user) => {
    if (isAuthChecked) return; // منع التنفيذ المتكرر
    isAuthChecked = true;

    if (!user) {
        // المستخدم غير مسجل دخول
        if (localStorage.getItem('hasVisitedBefore')) {
            // زائر سابق → صفحة الدخول مباشرة
            console.log('Returning visitor, redirecting to login.html');
            window.location.href = 'login.html';
        } else {
            // زائر جديد → صفحة تسويقية
            console.log('First time visitor, redirecting to landing.html');
            window.location.href = 'landing.html';
        }
        return;
    }

    // تحديث معلومات المستخدم
    await user.reload();

    // Check BOTH Firebase Auth AND Firestore for verification status
    console.log('🔍 Checking verification status in index.html...');
    console.log('Firebase Auth emailVerified:', user.emailVerified);

    // Check Firestore for manual verification by admin
    const userDocRef = db.collection('users').doc(user.uid);
    const userDocSnap = await userDocRef.get();
    const userData = userDocSnap.data();

    console.log('Firestore emailVerified:', userData?.emailVerified);
    console.log('Firestore verifiedManually:', userData?.verifiedManually);

    // Allow access if EITHER Firebase Auth verified OR Firestore verified (manual)
    const isVerified = user.emailVerified || userData?.emailVerified === true;

    if (!isVerified) {
        console.log('❌ User not verified in either system');
        // الإيميل غير مؤكد → توجيه إلى صفحة التسجيل
        alert('⚠️ يرجى تأكيد الإيميل أولاً\n\nאנא אמת את האימייל תחילה');
        await auth.signOut();
        window.location.href = 'login.html';
        return;
    }

    console.log('✅ User verified - allowing access to system');
    if (userData?.verifiedManually) {
        console.log('ℹ️ User was verified manually by admin');
    }

    // المستخدم مسجل دخول ومؤكد
    console.log('User authenticated:', user.email);
    currentUser = user;

    // تهيئة OneSignal للمستخدم
    if (typeof initOneSignalUser === 'function') {
        initOneSignalUser();
    }

    // إخفاء شاشة التحميل وعرض النظام
    setTimeout(() => {
        const loadingScreen = document.getElementById('loadingScreen');
        if (loadingScreen) {
            loadingScreen.style.display = 'none';
        }
    }, 500);

    // تحميل بيانات المستخدم
    await checkUserSubscription();
});

// ==========================================
// CHECK USER SUBSCRIPTION
// ==========================================

// دالة للتحقق من حالة اشتراك المستخدم
async function checkUserSubscription() {
    try {
        const userDoc = await db.collection('users').doc(currentUser.uid).get();

        if (!userDoc.exists) {
            // إنشاء مستند المستخدم إذا لم يكن موجود (للمستخدمين القدامى)
            const trialEndDate = new Date();
            trialEndDate.setDate(trialEndDate.getDate() + 30); // 30 يوم تجريبي

            await db.collection('users').doc(currentUser.uid).set({
                userId: currentUser.uid,
                email: currentUser.email,
                subscriptionStatus: 'trial',
                subscriptionEndDate: firebase.firestore.Timestamp.fromDate(trialEndDate),
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                emailVerified: true
            });

            console.log('Created new user document with trial subscription');
        }
    } catch (error) {
        console.error('Error checking user subscription:', error);
    }
}

// ==========================================
// CAR LOOKUP FROM API
// ==========================================

async function lookupCarInfoFromAPI() {
    const plateInput = document.getElementById('plateNumber');
    const plateNumber = plateInput.value.replace(/[-\s]/g, '').trim();
    const statusDiv = document.getElementById('apiStatus');

    if (!plateNumber) {
        statusDiv.innerHTML = '<p class="text-sm text-red-600 font-semibold">❌ אנא הזן מספר רישוי</p>';
        return;
    }

    // Check if API key is configured
    if (!CAR_API_CONFIG.apiKey) {
        statusDiv.innerHTML = `
            <div class="bg-yellow-50 border border-yellow-300 rounded-lg p-3 text-sm">
                <p class="text-yellow-800 font-bold mb-2">⚠️ API Key לא הוגדר</p>
                <p class="text-yellow-700 mb-2">כדי להשתמש בחיפוש אוטומטי, יש לקבל API Key מ:</p>
                <a href="https://data.gov.il" target="_blank" class="text-blue-600 underline font-semibold hover:text-blue-800">
                    https://data.gov.il
                </a>
                <p class="text-yellow-700 mt-2 text-xs">
                    ההרשמה חינמית לחלוטין! לאחר קבלת ה-API Key, הוסף אותו בקוד.
                </p>
            </div>
        `;
        return;
    }

    // Show loading
    const button = event.target;
    const originalHTML = button.innerHTML;
    button.disabled = true;
    button.innerHTML = '⏳ מחפש...';

    statusDiv.innerHTML = `
        <div class="flex items-center gap-2 text-blue-600 text-sm font-semibold">
            <div class="animate-spin rounded-full h-4 w-4 border-2 border-blue-600 border-t-transparent"></div>
            מחפש במאגר רשות הרישוי...
        </div>
    `;

    try {
        // Build API URL with filters
        const url = `${CAR_API_CONFIG.baseUrl}?resource_id=${CAR_API_CONFIG.resourceId}&filters={"mispar_rechev":"${plateNumber}"}`;

        // Make API request
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Authorization': CAR_API_CONFIG.apiKey
            }
        });

        if (!response.ok) {
            throw new Error('שגיאה בחיבור ל-API');
        }

        const data = await response.json();

        if (data.success && data.result && data.result.records && data.result.records.length > 0) {
            const carInfo = data.result.records[0];

            // Fill form with API data
            if (carInfo.tozeret_nm) {
                document.getElementById('carType').value = carInfo.tozeret_nm;
            }
            if (carInfo.kinuy_mishari) {
                document.getElementById('model').value = carInfo.kinuy_mishari;
            }
            if (carInfo.shnat_yitzur) {
                document.getElementById('year').value = carInfo.shnat_yitzur;
            }
            if (carInfo.degem_nm) {
                document.getElementById('engineType').value = carInfo.degem_nm;
            }

            // Show success message
            statusDiv.innerHTML = `
                <div class="bg-green-50 border border-green-300 rounded-lg p-3 text-sm">
                    <p class="text-green-800 font-bold mb-1">✓ נמצא מידע עבור הרכב!</p>
                    <div class="text-green-700 text-xs space-y-1">
                        <p>🚗 <strong>יצרן:</strong> ${carInfo.tozeret_nm || 'לא זמין'}</p>
                        <p>📋 <strong>דגם:</strong> ${carInfo.kinuy_mishari || 'לא זמין'}</p>
                        <p>📅 <strong>שנה:</strong> ${carInfo.shnat_yitzur || 'לא זמין'}</p>
                        ${carInfo.tzeva_rechev ? `<p>🎨 <strong>צבע:</strong> ${carInfo.tzeva_rechev}</p>` : ''}
                    </div>
                </div>
            `;

            showNotification('✓ פרטי הרכב מולאו בהצלחה!');

        } else {
            // No results found
            statusDiv.innerHTML = `
                <div class="bg-orange-50 border border-orange-300 rounded-lg p-3 text-sm">
                    <p class="text-orange-800 font-bold">❌ לא נמצא מידע עבור מספר רישוי זה</p>
                    <p class="text-orange-700 text-xs mt-1">אנא מלא את הפרטים ידנית</p>
                </div>
            `;
        }

    } catch (error) {
        console.error('API Error:', error);
        statusDiv.innerHTML = `
            <div class="bg-red-50 border border-red-300 rounded-lg p-3 text-sm">
                <p class="text-red-800 font-bold">❌ שגיאה בחיפוש</p>
                <p class="text-red-700 text-xs mt-1">${error.message || 'אנא נסה שוב מאוחר יותר'}</p>
            </div>
        `;
    } finally {
        button.disabled = false;
        button.innerHTML = originalHTML;
    }
}

// ==========================================
// SUBSCRIPTION / PREMIUM SYSTEM
// ==========================================

// Check if user has feature access (all features available during trial or paid subscription)
// Only data export requires paid subscription (isPremiumUser)
function hasPremiumAccess() {
    // Allow access if subscription is active (trial OR paid) OR admin
    var hasAccess = isSubscriptionActive || isAdmin;
    console.log('🔐 hasPremiumAccess check:', { isSubscriptionActive, isAdmin, hasAccess });
    return hasAccess;
}

// Show premium required modal
function showPremiumModal(featureName = '') {
    const featureText = {
        'calendar': '📅 יומן פגישות',
        'whatsapp': '📱 שליחת הודעות WhatsApp',
        'call': '📞 התקשרות ללקוחות'
    };

    const modal = document.getElementById('premiumModal');
    const featureTitle = document.getElementById('premiumFeatureTitle');

    if (featureTitle && featureName) {
        featureTitle.textContent = featureText[featureName] || featureName;
    }

    modal.classList.remove('hidden');
    document.body.classList.add('modal-open');

    // Hide bottom nav on mobile
    const bottomNav = document.querySelector('.mobile-bottom-nav');
    const fabButton = document.querySelector('.fab-button');
    if (bottomNav) {
        bottomNav.classList.add('nav-hidden');
    }
    if (fabButton) {
        fabButton.classList.add('fab-hidden');
    }
}

// Close premium modal
function closePremiumModal() {
    document.getElementById('premiumModal').classList.add('hidden');
    document.body.classList.remove('modal-open');

    // Show bottom nav
    const bottomNav = document.querySelector('.mobile-bottom-nav');
    const fabButton = document.querySelector('.fab-button');
    if (bottomNav) {
        bottomNav.classList.remove('nav-hidden');
    }
    if (fabButton) {
        fabButton.classList.remove('fab-hidden');
    }
}

// Check premium before action
function requirePremium(featureName, callback) {
    if (hasPremiumAccess()) {
        callback();
    } else {
        showPremiumModal(featureName);
    }
}

// Open payment page
function openPaymentLink() {
    closePremiumModal();
    window.location.href = 'account.html';
}

// Main app init auth listener
auth.onAuthStateChanged(async (user) => {
    if (user) {
        currentUser = user;
        document.getElementById('loginScreen').classList.add('hidden');
        document.getElementById('mainApp').classList.remove('hidden');

        // Check subscription status
        await checkSubscriptionStatus();

        // Setup realtime listener for subscription changes
        setupSubscriptionListener();

        await loadUserName();

        // Check if new user needs onboarding
        if (!hasCompletedOnboarding && typeof startOnboarding === 'function') {
            // New user - show onboarding (data loads after onboarding finishes)
            if (typeof initOnboardingDefaults === 'function') {
                initOnboardingDefaults();
            }
            startOnboarding();
        } else {
            // Existing user - load data normally
            loadCars();
            loadAppointments();
        }

        // Show subscription banner if expired
        showSubscriptionBanner();
    } else {
        currentUser = null;
        isAdmin = false;
        document.getElementById('loginScreen').classList.remove('hidden');
        document.getElementById('mainApp').classList.add('hidden');
    }

    document.getElementById('loadingScreen').classList.add('hidden');
});

// ==========================================
// SUBSCRIPTION SYSTEM
// ==========================================

// Check Subscription Status
async function checkSubscriptionStatus() {
    try {
        const userDoc = await db.collection('users').doc(currentUser.uid).get();

        if (!userDoc.exists) {
            // New user - create with trial
            const trialEnd = new Date();
            trialEnd.setDate(trialEnd.getDate() + 30); // 30 days trial

            userSubscription = {
                trialEndDate: trialEnd.toISOString(),
                isPaid: false,
                subscriptionExpiry: null,
                subscriptionStatus: 'trial',
                createdAt: new Date().toISOString()
            };

            await db.collection('users').doc(currentUser.uid).set({
                email: currentUser.email,
                ...userSubscription,
                onboardingCompleted: false,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            }, { merge: true });

            isSubscriptionActive = true;
            isPremiumUser = false; // Trial users are NOT premium
            hasCompletedOnboarding = false; // New user needs onboarding
            console.log('🆓 New user - Trial mode (NOT Premium)');
        } else {
            userSubscription = userDoc.data();
            // Load admin status from Firestore
            isAdmin = userDoc.data().isAdmin === true;
            // Load onboarding status
            // If field doesn't exist (old users) → skip onboarding (true)
            // If field exists and is false → show onboarding
            // If field exists and is true → skip onboarding
            var onboardingField = userDoc.data().onboardingCompleted;
            hasCompletedOnboarding = (onboardingField === undefined || onboardingField === null) ? true : (onboardingField === true);
            updateSubscriptionStatus();
        }

        // Log premium status
        console.log('👤 User:', currentUser.email);
        console.log('🔑 isAdmin:', isAdmin);
        console.log('👑 isPremiumUser:', isPremiumUser);
        console.log('📋 subscriptionStatus:', userSubscription?.subscriptionStatus);
    } catch (error) {
        console.error('Error checking subscription:', error);
        isSubscriptionActive = false;
    }
}

// Update subscription status from userSubscription data
function updateSubscriptionStatus() {
    const now = new Date();
    isSubscriptionActive = false;
    isPremiumUser = false; // Reset premium status
    let endDate = null;

    // Check if trial period (NOT premium - just active)
    if (userSubscription.trialEndDate) {
        const trialEnd = new Date(userSubscription.trialEndDate);
        if (now < trialEnd) {
            isSubscriptionActive = true;
            endDate = trialEnd;
            // Trial users are NOT premium
        }
    }

    // Check if paid subscription (THIS IS PREMIUM)
    if (userSubscription.isPaid && userSubscription.subscriptionExpiry) {
        const expiry = new Date(userSubscription.subscriptionExpiry);
        if (now < expiry) {
            isSubscriptionActive = true;
            isPremiumUser = true; // Paid = Premium
            endDate = expiry;
        }
    }

    // Check subscriptionEndDate (could be trial or premium)
    if (userSubscription.subscriptionEndDate) {
        let subEndDate;
        if (userSubscription.subscriptionEndDate.toDate) {
            subEndDate = userSubscription.subscriptionEndDate.toDate();
        } else {
            subEndDate = new Date(userSubscription.subscriptionEndDate);
        }

        if (now < subEndDate) {
            isSubscriptionActive = true;
            endDate = subEndDate;
            // isPremiumUser is ONLY set if user has PAID (isPaid = true)
            // NOT based on subscriptionStatus alone
        }
    }

    // IMPORTANT: isPremiumUser = true ONLY if user has actually PAID
    // Check isPaid field - this is the ONLY way to be premium
    if (userSubscription.isPaid === true) {
        // Also verify subscription hasn't expired
        if (userSubscription.subscriptionExpiry) {
            const expiry = new Date(userSubscription.subscriptionExpiry);
            if (now < expiry) {
                isPremiumUser = true;
            }
        }
    }

    // subscriptionStatus 'active' alone does NOT make user premium
    // Only 'premium' or 'paid' status WITH isPaid=true makes user premium
    if ((userSubscription.subscriptionStatus === 'premium' || userSubscription.subscriptionStatus === 'paid') && userSubscription.isPaid === true) {
        isPremiumUser = true;
    }

    // Trial users are NEVER premium (no export allowed)
    if (userSubscription.subscriptionStatus === 'trial' || !userSubscription.isPaid) {
        isPremiumUser = false;
    }

    // Update days counter in header
    updateDaysCounter(endDate);
}

// Update days counter display
function updateDaysCounter(endDate) {
    const counter = document.getElementById('daysCounter');
    const daysLeftSpan = document.getElementById('daysLeft');

    if (!counter || !daysLeftSpan) return;

    if (endDate) {
        const now = new Date();
        const daysLeft = Math.ceil((endDate - now) / (1000 * 60 * 60 * 24));

        if (daysLeft > 0) {
            daysLeftSpan.textContent = daysLeft;
            counter.classList.remove('hidden');

            // Change color based on days left
            counter.classList.remove('bg-green-500', 'bg-yellow-500', 'bg-red-500');
            if (daysLeft > 7) {
                counter.classList.add('bg-green-500');
            } else if (daysLeft > 3) {
                counter.classList.add('bg-yellow-500');
            } else {
                counter.classList.add('bg-red-500');
            }
        } else {
            counter.classList.add('hidden');
        }
    } else {
        counter.classList.add('hidden');
    }
}

// Setup realtime subscription listener
function setupSubscriptionListener() {
    if (!currentUser) return;

    db.collection('users').doc(currentUser.uid).onSnapshot((doc) => {
        if (doc.exists) {
            userSubscription = doc.data();
            updateSubscriptionStatus();
            showSubscriptionBanner();
        }
    }, (error) => {
        console.error('Subscription listener error:', error);
    });
}

// Show Subscription Banner
function showSubscriptionBanner() {
    // Remove existing banner
    const existingBanner = document.getElementById('subscriptionBanner');
    if (existingBanner) existingBanner.remove();

    if (isSubscriptionActive) return;
    if (isAdmin) return; // Admin bypass

    const banner = document.createElement('div');
    banner.id = 'subscriptionBanner';
    banner.className = 'fixed bottom-16 left-0 right-0 bg-red-600 text-white p-2 text-center z-30 shadow-lg';
    banner.innerHTML = `
        <div class="container mx-auto flex items-center justify-center gap-2">
            <span class="text-sm">⚠️ המנוי פג תוקף</span>
            <button onclick="window.location.href='account.html'" class="bg-white text-red-600 px-3 py-1 rounded-lg font-bold text-xs hover:bg-gray-100 transition">
                חדש מנוי
            </button>
        </div>
    `;
    document.body.appendChild(banner);
}

// Check if user can modify data
function canModifyData() {
    if (isAdmin) return true;
    return isSubscriptionActive;
}

// Show upgrade message
function showUpgradeMessage() {
    alert('המנוי שלך פג תוקף.\n\nאתה יכול לצפות בנתונים אבל לא להוסיף או לערוך.\n\nחדש את המנוי כדי להמשיך להשתמש בכל התכונות.');
}

// ==========================================
// USER PROFILE FUNCTIONS
// ==========================================

// Load User Name
async function loadUserName() {
    try {
        const userDoc = await db.collection('users').doc(currentUser.uid).get();
        if (userDoc.exists && userDoc.data().displayName) {
            document.getElementById('userName').textContent = userDoc.data().displayName;
        } else {
            document.getElementById('userName').textContent = currentUser.email.split('@')[0];
        }
    } catch (error) {
        console.error('Error loading user name:', error);
        document.getElementById('userName').textContent = currentUser.email.split('@')[0];
    }
}

// Edit User Name
function editUserName() {
    const currentName = document.getElementById('userName').textContent;
    const newName = prompt('הכנס שם חדש:', currentName);

    if (newName && newName.trim() !== '' && newName !== currentName) {
        saveUserName(newName.trim());
    }
}

// Save User Name
async function saveUserName(name) {
    try {
        await db.collection('users').doc(currentUser.uid).set({
            displayName: name,
            email: currentUser.email,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });

        document.getElementById('userName').textContent = name;
        updateSidebarUserInfo(); // Update sidebar
        alert('השם עודכן בהצלחה!');
    } catch (error) {
        console.error('Error saving user name:', error);
        alert('שגיאה בשמירת השם');
    }
}
