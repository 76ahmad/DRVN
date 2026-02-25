// DRVN Garage - Push Notifications & OneSignal/Median Integration

// ==========================================
// نظام الإشعارات - OneSignal + Firebase
// ==========================================

// OneSignal App ID
const ONESIGNAL_APP_ID = '4e012ba3-f512-4afc-a3d2-3adf7fc9d6f1';

// التحقق إذا التطبيق يعمل في Median/GoNative
function isMedianApp() {
    // تحقق من كل الطرق الممكنة
    return typeof Median !== 'undefined' ||      // Median الجديد
           typeof median !== 'undefined' ||      // median القديم
           typeof gonative !== 'undefined' ||    // GoNative
           (window.plugins && window.plugins.OneSignal) ||  // OneSignal Plugin
           navigator.userAgent.includes('median') ||
           navigator.userAgent.includes('gonative') ||
           navigator.userAgent.includes('Median') ||
           navigator.userAgent.includes('GoNative') ||
           document.documentElement.classList.contains('median') ||
           window.isMedianApp === true;
}

// التحقق إذا التطبيق يعمل داخل WKWebView iOS (native app)
// التطبيق يسجّل handlers: push-permission-request, push-token, push-subscribe
function isIOSNativeApp() {
    return window.webkit &&
           window.webkit.messageHandlers &&
           (window.webkit.messageHandlers['push-permission-request'] ||
            window.webkit.messageHandlers['pushHandler']);
}

// فحص عام: هل نحن داخل WKWebView على iOS (حتى بدون pushHandler)
function isIOSWKWebView() {
    // طريقة 1: فحص iOS + عدم دعم Notification API
    var isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
                (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    if (isIOS && !('Notification' in window)) return true;

    // طريقة 2: فحص window.webkit (موجود في كل WKWebView) + iOS
    if (isIOS && window.webkit && !('PushManager' in window)) return true;

    // طريقة 3: standalone mode على iOS بدون Push
    if (isIOS && window.navigator.standalone === true) return true;

    return false;
}

// التحقق من دعم الإشعارات
function isNotificationSupported() {
    // iOS Native App (WKWebView bridge جاهز)
    if (isIOSNativeApp()) {
        return true;
    }
    // iOS WKWebView (bridge مو جاهز بعد - لكن نعرض الزر)
    if (isIOSWKWebView()) {
        return true;
    }
    // OneSignal متاح
    if (typeof OneSignal !== 'undefined') {
        return true;
    }
    // إذا كان تطبيق Median، نستخدم Native Push
    if (isMedianApp()) {
        return true;
    }
    return ('Notification' in window) && ('serviceWorker' in navigator) && ('PushManager' in window);
}

// الحصول على حالة الإذن بطريقة آمنة
function getNotificationPermission() {
    // iOS Native App (bridge جاهز)
    if (isIOSNativeApp()) {
        var iosPushEnabled = localStorage.getItem('iosPushEnabled');
        if (iosPushEnabled === 'true') return 'granted';
        if (iosPushEnabled === 'false') return 'denied';
        return 'default';
    }

    // iOS WKWebView (bridge مو جاهز)
    if (isIOSWKWebView()) {
        return 'default';
    }

    // OneSignal
    if (typeof OneSignal !== 'undefined') {
        try {
            const permission = OneSignal.Notifications.permission;
            return permission ? 'granted' : 'default';
        } catch (e) {
            return 'default';
        }
    }

    // إذا كان تطبيق Median
    if (isMedianApp()) {
        const medianPushEnabled = localStorage.getItem('medianPushEnabled');
        if (medianPushEnabled === 'true') return 'granted';
        if (medianPushEnabled === 'false') return 'denied';
        return 'default';
    }

    if (!('Notification' in window)) {
        return 'unsupported';
    }
    return Notification.permission;
}

// طلب إذن الإشعارات بطريقة آمنة
async function requestNotificationPermission() {
    // OneSignal
    if (typeof OneSignal !== 'undefined') {
        try {
            await OneSignal.Notifications.requestPermission();
            const permission = OneSignal.Notifications.permission;

            if (permission) {
                // حفظ OneSignal Player ID في Firestore
                const playerId = await OneSignal.User.PushSubscription.id;
                if (playerId && currentUser) {
                    await db.collection('users').doc(currentUser.uid).update({
                        oneSignalPlayerId: playerId,
                        pushEnabled: true,
                        pushEnabledAt: firebase.firestore.FieldValue.serverTimestamp()
                    });
                    console.log('✅ OneSignal Player ID saved:', playerId);
                }
                return 'granted';
            }
            return 'denied';
        } catch (error) {
            console.error('OneSignal permission error:', error);
            return 'error';
        }
    }

    // إذا كان تطبيق Median
    if (isMedianApp()) {
        return await requestMedianPushPermission();
    }

    if (!('Notification' in window)) {
        console.log('❌ Notifications not supported');
        return 'unsupported';
    }

    try {
        const permission = await Notification.requestPermission();
        return permission;
    } catch (error) {
        console.error('Error requesting permission:', error);
        return 'error';
    }
}

// طلب إذن Median Push
async function requestMedianPushPermission() {
    return new Promise((resolve) => {
        try {
            // Median/GoNative Push API
            if (typeof median !== 'undefined' && median.onesignal) {
                median.onesignal.requestPermission();
                median.onesignal.onesignalInfo({
                    callback: function(info) {
                        if (info && info.oneSignalUserId) {
                            localStorage.setItem('medianPushEnabled', 'true');
                            localStorage.setItem('oneSignalUserId', info.oneSignalUserId);
                            console.log('✅ Median Push enabled:', info.oneSignalUserId);

                            // حفظ في Firestore
                            if (currentUser) {
                                db.collection('users').doc(currentUser.uid).update({
                                    oneSignalPlayerId: info.oneSignalUserId,
                                    pushEnabled: true,
                                    platform: 'median_android'
                                });
                            }
                            resolve('granted');
                        } else {
                            resolve('default');
                        }
                    }
                });
            } else if (typeof gonative !== 'undefined' && gonative.onesignal) {
                gonative.onesignal.requestPermission();
                setTimeout(() => {
                    localStorage.setItem('medianPushEnabled', 'true');
                    resolve('granted');
                }, 1000);
            } else {
                console.log('⚠️ Median Push API not found');
                resolve('default');
            }
        } catch (error) {
            console.error('Error with Median Push:', error);
            resolve('error');
        }
    });
}

// إرسال إشعار محلي
async function showLocalNotification(title, body, data = {}) {
    // إذا كان تطبيق Median - نستخدم Toast
    if (isMedianApp()) {
        showToast(`🔔 ${title}: ${body}`, 'info');
        return;
    }

    // للمتصفح العادي
    if ('serviceWorker' in navigator && getNotificationPermission() === 'granted') {
        try {
            const registration = await navigator.serviceWorker.ready;
            await registration.showNotification(title, {
                body: body,
                icon: '/icons/icon-192x192.png',
                badge: '/icons/badge-72x72.png',
                dir: 'rtl',
                vibrate: [200, 100, 200],
                data: data
            });
        } catch (error) {
            console.error('Error showing notification:', error);
            showToast(`🔔 ${title}: ${body}`, 'info');
        }
    } else {
        showToast(`🔔 ${title}: ${body}`, 'info');
    }
}

// تفعيل Push عبر Median API - نسخة محسنة
async function enableMedianPush() {
    console.log('📱 Enabling Median Push...');
    showToast('⏳ מפעיל התראות...', 'info');

    try {
        // محاولة الحصول على Player ID مع retry
        const playerId = await getMedianPlayerIdWithRetry(5, 2000);

        if (playerId) {
            console.log('✅ Got Player ID:', playerId);
            await savePushToken(playerId, 'median');
            showToast('🔔 ההתראות הופעלו בהצלחה!', 'success');
            updateNotificationButton(true);
        } else {
            console.log('⚠️ Could not get Player ID');
            showToast('⚠️ לא הצלחנו לקבל מזהה. נסה שוב.', 'warning');
            updateNotificationButton(false);
        }

    } catch (error) {
        console.error('Error enabling Median Push:', error);
        showToast('❌ שגיאה בהפעלת התראות', 'error');
        updateNotificationButton(false);
    }
}

// محاولة الحصول على Player ID مع إعادة المحاولة
async function getMedianPlayerIdWithRetry(maxRetries, delayMs) {
    // أولاً: طلب الإذن
    await requestMedianPermission();

    // ثانياً: محاولة الحصول على Player ID
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        console.log(`📱 Attempt ${attempt}/${maxRetries} to get Player ID...`);

        const playerId = await getMedianPlayerId();

        if (playerId) {
            return playerId;
        }

        if (attempt < maxRetries) {
            console.log(`⏳ Waiting ${delayMs}ms before retry...`);
            await new Promise(resolve => setTimeout(resolve, delayMs));
        }
    }

    return null;
}

// طلب إذن من Median
async function requestMedianPermission() {
    return new Promise((resolve) => {
        try {
            // Median الجديد
            if (typeof Median !== 'undefined' && Median.onesignal) {
                console.log('📱 Requesting permission via Median (new)...');
                Median.onesignal.register();
                setTimeout(resolve, 1000);
                return;
            }

            // median القديم
            if (typeof median !== 'undefined' && median.onesignal) {
                console.log('📱 Requesting permission via median (old)...');
                median.onesignal.requestPermission();
                setTimeout(resolve, 1000);
                return;
            }

            // gonative
            if (typeof gonative !== 'undefined' && gonative.onesignal) {
                console.log('📱 Requesting permission via gonative...');
                gonative.onesignal.requestPermission();
                setTimeout(resolve, 1000);
                return;
            }

            resolve();
        } catch (e) {
            console.log('Permission request error:', e);
            resolve();
        }
    });
}

// الحصول على Player ID من Median
async function getMedianPlayerId() {
    return new Promise((resolve) => {
        try {
            // Median الجديد
            if (typeof Median !== 'undefined' && Median.onesignal) {
                Median.onesignal.info()
                    .then(info => {
                        console.log('📱 Median.onesignal.info():', info);
                        const id = info?.userId || info?.oneSignalUserId || info?.playerId;
                        resolve(id || null);
                    })
                    .catch(err => {
                        console.log('Median info error:', err);
                        resolve(null);
                    });
                return;
            }

            // median القديم
            if (typeof median !== 'undefined' && median.onesignal) {
                median.onesignal.onesignalInfo({
                    callback: function(info) {
                        console.log('📱 median.onesignal.onesignalInfo():', info);
                        const id = info?.oneSignalUserId || info?.userId || info?.playerId;
                        resolve(id || null);
                    }
                });
                // Timeout في حالة عدم استدعاء الـ callback
                setTimeout(() => resolve(null), 3000);
                return;
            }

            // gonative
            if (typeof gonative !== 'undefined' && gonative.onesignal) {
                // GoNative قد لا يدعم info() مباشرة
                resolve(null);
                return;
            }

            resolve(null);
        } catch (e) {
            console.log('Get Player ID error:', e);
            resolve(null);
        }
    });
}

// حفظ Push Token في Firestore
async function savePushToken(token, platform) {
    localStorage.setItem('medianPushEnabled', 'true');
    if (token) {
        localStorage.setItem('oneSignalUserId', token);
    }

    if (currentUser) {
        const updateData = {
            pushEnabled: true,
            platform: platform,
            pushEnabledAt: firebase.firestore.FieldValue.serverTimestamp()
        };
        if (token) {
            updateData.oneSignalPlayerId = token;
        }
        await db.collection('users').doc(currentUser.uid).update(updateData);
    }
    console.log('✅ Push token saved:', token, platform);
}

// تفعيل Push عبر OneSignal Web SDK
// ⭐ Toggle OneSignal Push - Enable/Disable
async function toggleOneSignalPush() {
    console.log('📱 Toggling OneSignal Push...');

    try {
        if (typeof OneSignal === 'undefined') {
            showToast('⚠️ OneSignal לא נטען. רענן את הדף.', 'error');
            return;
        }

        // ⭐ التحقق من حالة التفعيل - نستخدم طريقتين
        let isCurrentlyEnabled = false;

        // طريقة 1: من Firestore
        if (currentUser) {
            const userDoc = await db.collection('users').doc(currentUser.uid).get();
            const userData = userDoc.data();
            isCurrentlyEnabled = userData?.pushEnabled === true;
        }

        // طريقة 2: من OneSignal مباشرة (إذا Firestore غير موثوق)
        try {
            const oneSignalOptedIn = OneSignal.User.PushSubscription.optedIn;
            console.log('OneSignal optedIn:', oneSignalOptedIn, 'Firestore pushEnabled:', isCurrentlyEnabled);
            // نستخدم أي منهما true
            if (oneSignalOptedIn && !isCurrentlyEnabled) {
                isCurrentlyEnabled = true;
            }
        } catch (e) {
            console.log('Could not check OneSignal status:', e.message);
        }

        console.log('Final isCurrentlyEnabled:', isCurrentlyEnabled);

        // ⭐ إذا كانت مفعلة → إيقاف
        if (isCurrentlyEnabled) {
            console.log('🔕 Disabling OneSignal Push...');

            try {
                await OneSignal.User.PushSubscription.optOut();
            } catch (e) {
                console.log('OneSignal optOut error (ignored):', e.message);
            }

            if (currentUser) {
                await db.collection('users').doc(currentUser.uid).update({
                    pushEnabled: false,
                    pushDisabledAt: firebase.firestore.FieldValue.serverTimestamp()
                });
            }

            showToast('🔕 ההתראות הושבתו', 'success');
            updateNotificationButton(false);
            return;
        }

        // ⭐ إذا غير مفعلة → تفعيل
        console.log('🔔 Enabling OneSignal Push...');

        // طلب الإذن
        const permission = await OneSignal.Notifications.requestPermission();
        console.log('Permission result:', permission);

        if (!permission) {
            showToast('⚠️ בקשת ההתראות בוטלה', 'warning');
            updateNotificationButton(false);
            return;
        }

        // تفعيل الاشتراك
        try {
            await OneSignal.User.PushSubscription.optIn();
        } catch (e) {
            console.log('OptIn error (may already be subscribed):', e.message);
        }

        // انتظر قليلاً
        await new Promise(resolve => setTimeout(resolve, 1500));

        // الحصول على Player ID
        let playerId = null;
        try {
            playerId = OneSignal.User.PushSubscription.id;
        } catch (e) {
            console.log('⚠️ Could not get Player ID:', e.message);
        }

        // ربط المستخدم وحفظ في Firestore
        if (currentUser) {
            try {
                await OneSignal.login(currentUser.uid);
                await OneSignal.User.addTags({
                    user_id: currentUser.uid,
                    email: currentUser.email || '',
                    platform: 'web'
                });
            } catch (e) {
                console.log('⚠️ Could not setup user:', e.message);
            }

            await db.collection('users').doc(currentUser.uid).update({
                oneSignalPlayerId: playerId || 'pending',
                pushEnabled: true,
                platform: 'web_onesignal',
                pushEnabledAt: firebase.firestore.FieldValue.serverTimestamp()
            });
        }

        showToast('🔔 ההתראות הופעלו בהצלחה!', 'success');
        updateNotificationButton(true);
        console.log('✅ OneSignal Push enabled');

    } catch (error) {
        console.error('❌ Error toggling OneSignal Push:', error);
        showToast('⚠️ שגיאה: ' + error.message, 'error');
    }
}

// Keep old function for compatibility
async function enableOneSignalPush() {
    await toggleOneSignalPush();
}

// تهيئة OneSignal مع معلومات المستخدم
async function initOneSignalUser() {
    if (!currentUser) return;

    try {
        // انتظر حتى يتم تحميل OneSignal
        if (typeof OneSignal === 'undefined') {
            console.log('⏳ Waiting for OneSignal to load...');
            await new Promise(resolve => {
                const interval = setInterval(() => {
                    if (typeof OneSignal !== 'undefined') {
                        clearInterval(interval);
                        resolve();
                    }
                }, 100);

                // Timeout بعد 10 ثواني
                setTimeout(() => {
                    clearInterval(interval);
                    resolve();
                }, 10000);
            });
        }

        if (typeof OneSignal === 'undefined') {
            console.log('⚠️ OneSignal not available');
            return;
        }

        // ربط المستخدم بـ OneSignal
        await OneSignal.login(currentUser.uid);

        // إضافة tags للمستخدم
        await OneSignal.User.addTags({
            user_id: currentUser.uid,
            email: currentUser.email || '',
            platform: isMedianApp() ? 'android_app' : 'web'
        });

        console.log('✅ OneSignal user initialized');
    } catch (error) {
        console.error('Error initializing OneSignal user:', error);
        // لا نرمي الخطأ - نتجاهله ونستمر
    }
}

// دالة عرض رسائل Toast
function showToast(message, type = 'info') {
    // إنشاء عنصر Toast
    const toast = document.createElement('div');
    toast.className = 'fixed top-4 left-1/2 transform -translate-x-1/2 px-6 py-3 rounded-lg shadow-lg z-[99999] transition-all duration-300';

    // تحديد اللون حسب النوع
    const colors = {
        success: 'bg-green-500 text-white',
        error: 'bg-red-500 text-white',
        warning: 'bg-yellow-500 text-white',
        info: 'bg-blue-500 text-white'
    };

    toast.className += ' ' + (colors[type] || colors.info);
    toast.textContent = message;
    toast.style.opacity = '0';

    // إضافة إلى الصفحة
    document.body.appendChild(toast);

    // عرض مع Animation
    setTimeout(() => {
        toast.style.opacity = '1';
    }, 10);

    // إخفاء وحذف بعد 3 ثواني
    setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => {
            if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
        }, 300);
    }, 3000);
}

// تحقق من حالة الإشعارات
async function checkNotificationStatus() {
    // التحقق من دعم الإشعارات
    if (!isNotificationSupported()) {
        console.log('❌ Notifications not supported on this device/browser');
        updateNotificationButton(false, false, true); // not supported
        return;
    }

    // iOS Native App - bridge جاهز
    if (isIOSNativeApp()) {
        var iosPushEnabled = localStorage.getItem('iosPushEnabled') === 'true';
        updateNotificationButton(iosPushEnabled);
        return;
    }

    // iOS WKWebView - bridge مو جاهز بعد
    if (isIOSWKWebView()) {
        updateNotificationButton(false); // يعرض "הפעל התראות"
        return;
    }

    if (!messaging) {
        console.log('Messaging not available');
        return;
    }

    if (!currentUser) return;

    try {
        // ⭐ التحقق من Firestore أولاً
        const userDoc = await db.collection('users').doc(currentUser.uid).get();
        const userData = userDoc.data();

        const permission = getNotificationPermission();
        console.log('📱 Notification permission:', permission);
        console.log('📱 Firestore data:', {
            hasToken: !!userData?.fcmToken,
            disabled: userData?.notificationsDisabled
        });

        // ⭐ إذا الإذن محظور
        if (permission === 'denied') {
            updateNotificationButton(false, true); // blocked
            return;
        }

        // ⭐ إذا الإذن ممنوح
        if (permission === 'granted') {
            // تحقق من Firestore
            const isEnabled = userData?.fcmToken && !userData?.notificationsDisabled;

            if (isEnabled) {
                updateNotificationButton(true); // مفعّل
            } else {
                updateNotificationButton(false); // مطفي
            }
            return;
        }

        // ⭐ إذا لم يُطلب الإذن بعد
        updateNotificationButton(false, false);

    } catch (error) {
        console.error('Error checking notification status:', error);
        updateNotificationButton(false, false);
    }
}

// تحديث زر الإشعارات
function updateNotificationButton(enabled, blocked = false, notSupported = false) {
    const btn = document.getElementById('notificationToggleBtn');
    const text = document.getElementById('notificationBtnText');
    const icon = btn?.querySelector('.sidebar-icon');

    if (!btn || !text) return;

    if (notSupported) {
        // ❌ غير مدعوم
        btn.style.background = 'rgba(156, 163, 175, 0.2)';
        btn.style.borderLeft = '4px solid #9ca3af';
        text.textContent = 'התראות לא נתמכות';
        if (icon) icon.textContent = '📵';
        btn.style.opacity = '0.6';
    } else if (enabled) {
        // ✅ مفعّل
        btn.style.background = 'rgba(34, 197, 94, 0.2)';
        btn.style.borderLeft = '4px solid #22c55e';
        text.textContent = '✓ התראות פעילות';
        if (icon) icon.textContent = '🔔';
        btn.style.opacity = '1';
    } else if (blocked) {
        // 🚫 محظور
        btn.style.background = 'rgba(239, 68, 68, 0.1)';
        btn.style.borderLeft = '4px solid #ef4444';
        text.textContent = 'התראות חסומות';
        if (icon) icon.textContent = '🚫';
        btn.style.opacity = '1';
    } else {
        // ⚪ غير مفعّل (default)
        btn.style.background = 'transparent';
        btn.style.borderLeft = '';
        text.textContent = 'הפעל התראות';
        if (icon) icon.textContent = '🔔';
        btn.style.opacity = '1';
    }
}

// تفعيل/تعطيل الإشعارات
async function toggleNotifications() {
    if (!currentUser) {
        showToast('⚠️ נא להתחבר תחילה', 'error');
        return;
    }

    // التحقق من دعم الإشعارات
    if (!isNotificationSupported()) {
        showToast('⚠️ ההתראות אינן נתמכות במכשיר זה', 'error');
        return;
    }

    try {
        // ⭐ iOS Native App - WKWebView bridge
        if (isIOSNativeApp()) {
            console.log('🍎 Using iOS Native Push bridge...');
            await handleIOSNotifications();
            return;
        }

        // ⭐ iOS WKWebView بدون bridge (التحديث الأصلي لسا ما نزل)
        if (isIOSWKWebView()) {
            console.log('🍎 iOS WKWebView detected but bridge not ready');
            showToast('🍎 התראות יהיו זמינות בעדכון הבא של האפליקציה', 'info');
            return;
        }

        // ⭐ إذا كان تطبيق Median - استخدم Median API
        if (isMedianApp()) {
            console.log('📱 Using Median Push API...');
            await enableMedianPush();
            return;
        }

        // ⭐ إذا كان OneSignal متاح - استخدمه
        if (typeof OneSignal !== 'undefined') {
            console.log('📱 Using OneSignal API...');
            await toggleOneSignalPush();
            return;
        }

        // ⭐ للمتصفح العادي - استخدم Firebase
        if (!messaging) {
            showToast('⚠️ התראות לא נתמכות בדפדפן זה', 'error');
            return;
        }

        const currentPermission = getNotificationPermission();
        console.log('Current permission status:', currentPermission);

        // التحقق من حالة التفعيل في Firestore
        const userDoc = await db.collection('users').doc(currentUser.uid).get();
        const userData = userDoc.data();
        const isEnabled = userData?.fcmToken && !userData?.notificationsDisabled;

        // إذا كانت الإشعارات مفعلة → إيقاف
        if (currentPermission === 'granted' && isEnabled) {
            console.log('🔕 Disabling notifications...');

            try {
                await db.collection('users').doc(currentUser.uid).update({
                    fcmToken: null,
                    notificationsDisabled: true,
                    notificationsDisabledAt: firebase.firestore.FieldValue.serverTimestamp()
                });

                showToast('🔕 ההתראות הושבתו', 'success');
                updateNotificationButton(false);
                console.log('✅ Notifications disabled');
            } catch (error) {
                console.error('Error disabling notifications:', error);
                showToast('⚠️ שגיאה בהשבתת התראות', 'error');
            }
            return;
        }

        // إذا كانت محظورة نهائياً (denied)
        if (currentPermission === 'denied') {
            showToast('⚠️ ההתראות חסומות. אנא אפשר אותן בהגדרות', 'warning');
            return;
        }

        // تفعيل الإشعارات
        console.log('🔔 Enabling notifications...');

        if (currentPermission === 'granted') {
            await getNotificationToken();

            await db.collection('users').doc(currentUser.uid).update({
                notificationsDisabled: false,
                notificationsEnabledAt: firebase.firestore.FieldValue.serverTimestamp()
            });

            showToast('🔔 ההתראות הופעלו!', 'success');
            updateNotificationButton(true);
            return;
        }

        // طلب الإذن لأول مرة
        const permission = await requestNotificationPermission();

        if (permission === 'unsupported') {
            showToast('⚠️ ההתראות אינן נתמכות בדפדפן זה', 'error');
            return;
        }

        if (permission === 'granted') {
            console.log('✅ Notification permission granted!');

            // الحصول على التوكن
            await getNotificationToken();

            // تحديث Firestore
            await db.collection('users').doc(currentUser.uid).update({
                notificationsDisabled: false,
                notificationsEnabledAt: firebase.firestore.FieldValue.serverTimestamp()
            });

            showToast('🔔 ההתראות הופעלו בהצלחה!', 'success');
            updateNotificationButton(true);
        } else if (permission === 'denied') {
            console.log('❌ Notification permission denied');
            showToast('❌ ההרשאה להתראות נדחתה', 'error');
            updateNotificationButton(false, true);
        } else {
            console.log('ℹ️ Notification permission dismissed');
            showToast('ℹ️ בקשת ההתראות בוטלה', 'info');
        }
    } catch (error) {
        console.error('Error toggling notifications:', error);
        showToast('⚠️ שגיאה: ' + error.message, 'error');
    }
}

// الحصول على توكن الإشعارات
async function getNotificationToken() {
    if (!messaging || !currentUser) return;

    try {
        console.log('🔔 Starting notification token registration...');

        // خطوة 1: انتظر حتى يصبح Service Worker جاهز
        await navigator.serviceWorker.ready;
        console.log('✅ Main Service Worker is ready');

        // خطوة 2: تسجيل firebase-messaging-sw بشكل منفصل
        let messagingRegistration;
        try {
            messagingRegistration = await navigator.serviceWorker.register('/firebase-messaging-sw.js', {
                scope: '/',
                updateViaCache: 'none'
            });
            console.log('✅ Firebase Messaging SW registered:', messagingRegistration);

            // انتظر حتى يصبح نشط
            if (messagingRegistration.installing) {
                await new Promise((resolve) => {
                    messagingRegistration.installing.addEventListener('statechange', (e) => {
                        if (e.target.state === 'activated') {
                            console.log('✅ Messaging SW activated');
                            resolve();
                        }
                    });
                });
            }
        } catch (swError) {
            console.error('❌ Failed to register messaging SW:', swError);
            throw new Error('Failed to register messaging service worker');
        }

        // خطوة 3: الحصول على التوكن
        console.log('🔑 Getting FCM token...');
        let currentToken = null;

        // محاولة مع VAPID Key
        const vapidKey = 'BDJ7InAeHqovFzryLHPltWqqYokGOPBdlFaJrBiIx0BcsSCg9DbsKD2LRmsLO5fi1-H8sjEBMWvRhQuOd943aHM';

        try {
            currentToken = await messaging.getToken({
                vapidKey: vapidKey,
                serviceWorkerRegistration: messagingRegistration
            });
        } catch (tokenError) {
            console.error('❌ Error getting token with VAPID:', tokenError);
            console.log('ℹ️ Trying without VAPID key...');

            try {
                // محاولة بدون VAPID
                currentToken = await messaging.getToken({
                    serviceWorkerRegistration: messagingRegistration
                });
            } catch (fallbackError) {
                console.error('❌ Both token attempts failed:', fallbackError);
                throw new Error('Cannot get notification token. Please check Firebase configuration.');
            }
        }

        if (currentToken) {
            console.log('✅ FCM Token obtained:', currentToken.substring(0, 20) + '...');

            // حفظ التوكن في Firestore
            await db.collection('users').doc(currentUser.uid).update({
                fcmToken: currentToken,
                fcmTokenUpdated: firebase.firestore.FieldValue.serverTimestamp(),
                notificationsEnabled: true
            });

            console.log('✅ Token saved to Firestore');
            showToast('✅ ההתראות הופעלו בהצלחה!', 'success');
            updateNotificationButton(true);

            // استقبال الرسائل عندما يكون التطبيق مفتوح
            messaging.onMessage((payload) => {
                console.log('📩 Message received:', payload);
                showInAppNotification(payload);
            });

        } else {
            console.log('⚠️ No registration token available');
            showToast('⚠️ לא ניתן לקבל אסימון התראות', 'warning');
        }
    } catch (error) {
        console.error('❌ Full error getting notification token:', error);
        console.error('Error stack:', error.stack);
        showToast('⚠️ שגיאה בהפעלת ההתראות: ' + error.message, 'error');
        updateNotificationButton(false);
    }
}

// عرض الإشعار داخل التطبيق
function showInAppNotification(payload) {
    const title = payload.notification?.title || 'DRVN';
    const body = payload.notification?.body || 'יש לך עדכון חדש';

    // يمكن إضافة نافذة منبثقة مخصصة هنا
    showToast(`🔔 ${title}: ${body}`, 'info');

    // تشغيل صوت (اختياري)
    playNotificationSound();
}

// تشغيل صوت الإشعار
function playNotificationSound() {
    try {
        const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBTGH0fPTgjMGHm7A7+OZURE');
        audio.volume = 0.3;
        audio.play().catch(e => console.log('Could not play sound:', e));
    } catch (e) {
        console.log('Audio not supported');
    }
}

// ==========================================
// زر اختبار الإشعارات - يفحص كل المسارات
// ==========================================
async function testNotification() {
    if (!currentUser) {
        showToast('⚠️ נא להתחבר תחילה', 'error');
        return;
    }

    // جمع معلومات التشخيص
    var diagnostics = [];
    diagnostics.push('🔍 בדיקת מערכת התראות...');

    // 1. فحص المنصة
    var platform = 'unknown';
    var isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    var isAndroidApp = isMedianApp();
    var isIOSNative = isIOSNativeApp();
    if (isIOSNative) {
        platform = 'iOS Native (WKWebView)';
    } else if (isAndroidApp) {
        platform = 'Android (Median)';
    } else if (isIOS) {
        platform = 'iOS (Web)';
    } else {
        platform = 'Web Browser';
    }
    diagnostics.push('📱 פלטפורמה: ' + platform);

    // iOS Native diagnostics
    var isWKWebView = isIOSWKWebView();
    diagnostics.push('🍎 iOS Native App (bridge): ' + (isIOSNative ? '✅ כן' : '❌ לא'));
    diagnostics.push('🍎 iOS WKWebView: ' + (isWKWebView ? '✅ כן' : '❌ לא'));
    diagnostics.push('🍎 isNotificationSupported: ' + (isNotificationSupported() ? '✅ כן' : '❌ לא'));
    if (isIOSNative || isWKWebView) {
        diagnostics.push('🍎 iOS Push מופעל: ' + (localStorage.getItem('iosPushEnabled') === 'true' ? '✅ כן' : '❌ לא'));
    }
    diagnostics.push('🍎 window.webkit: ' + (window.webkit ? '✅ כן' : '❌ לא'));
    diagnostics.push('🍎 pushHandler: ' + (window.webkit?.messageHandlers?.pushHandler ? '✅ כן' : '❌ לא'));

    // 2. فحص OneSignal
    var oneSignalAvailable = typeof OneSignal !== 'undefined';
    diagnostics.push('🔔 OneSignal SDK: ' + (oneSignalAvailable ? '✅ נטען' : '❌ לא נטען'));

    if (oneSignalAvailable) {
        try {
            var osPermission = OneSignal.Notifications.permission;
            diagnostics.push('🔔 OneSignal הרשאה: ' + (osPermission ? '✅ מאושר' : '❌ לא מאושר'));
            var osId = OneSignal.User.PushSubscription.id;
            diagnostics.push('🔔 OneSignal ID: ' + (osId ? '✅ ' + osId.substring(0, 12) + '...' : '❌ אין'));
            var osOptedIn = OneSignal.User.PushSubscription.optedIn;
            diagnostics.push('🔔 OneSignal OptedIn: ' + (osOptedIn ? '✅' : '❌'));
        } catch (e) {
            diagnostics.push('🔔 OneSignal שגיאה: ' + e.message);
        }
    }

    // 3. فحص Median
    diagnostics.push('📲 Median SDK: ' + (isAndroidApp ? '✅ זמין' : '❌ לא זמין'));

    // 4. فحص FCM / Web Push
    var notificationAPI = 'Notification' in window;
    diagnostics.push('🌐 Notification API: ' + (notificationAPI ? '✅ נתמך' : '❌ לא נתמך'));
    if (notificationAPI) {
        diagnostics.push('🌐 Notification הרשאה: ' + Notification.permission);
    }

    var swSupported = 'serviceWorker' in navigator;
    diagnostics.push('⚙️ Service Worker: ' + (swSupported ? '✅ נתמך' : '❌ לא נתמך'));

    var pushSupported = 'PushManager' in window;
    diagnostics.push('📤 Push API: ' + (pushSupported ? '✅ נתמך' : '❌ לא נתמך'));

    // 5. فحص Firestore data
    try {
        var userDoc = await db.collection('users').doc(currentUser.uid).get();
        var userData = userDoc.data();
        diagnostics.push('');
        diagnostics.push('📋 נתוני Firestore:');
        diagnostics.push('  oneSignalPlayerId: ' + (userData?.oneSignalPlayerId || '❌ אין'));
        diagnostics.push('  fcmToken: ' + (userData?.fcmToken ? '✅ ' + userData.fcmToken.substring(0, 15) + '...' : '❌ אין'));
        diagnostics.push('  pushEnabled: ' + (userData?.pushEnabled ? '✅' : '❌'));
        diagnostics.push('  platform: ' + (userData?.platform || 'לא מוגדר'));
    } catch (e) {
        diagnostics.push('📋 Firestore שגיאה: ' + e.message);
    }

    // 6. محاولة إرسال إشعار تجريبي
    diagnostics.push('');
    diagnostics.push('📨 שולח התראת בדיקה...');

    var testResult = 'לא נשלח';
    try {
        var userDoc2 = await db.collection('users').doc(currentUser.uid).get();
        var ud = userDoc2.data();
        var uid = currentUser.uid;

        // iOS Native → استخدم fetch مباشر (httpsCallable يفشل بدون auth session)
        if ((ud?.platform === 'ios_native' || isIOSNativeApp() || isIOSWKWebView()) && ud?.fcmToken) {
            var response = await fetch('https://us-central1-garage-17263.cloudfunctions.net/sendTestFCMHttp', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: uid })
            });
            var result2 = await response.json();
            if (result2.success) {
                testResult = '✅ נשלח דרך FCM (iOS)! בדוק את ההתראות.';
            } else {
                testResult = '❌ שגיאה: ' + (result2.error || 'unknown');
            }
        } else if (ud?.oneSignalPlayerId && ud.oneSignalPlayerId !== 'pending') {
            var sendTest = firebase.functions().httpsCallable('sendTestReminder');
            var result = await sendTest({ userId: uid });
            testResult = '✅ נשלח דרך OneSignal! בדוק את ההתראות.';
        } else if (ud?.fcmToken) {
            var sendTestFCM2 = firebase.functions().httpsCallable('sendTestFCM');
            var result3 = await sendTestFCM2({ userId: uid });
            testResult = '✅ נשלח דרך FCM! בדוק את ההתראות.';
        } else {
            testResult = '⚠️ אין מזהה להתראות. הפעל התראות תחילה.';
        }
    } catch (e) {
        testResult = '❌ שגיאה: ' + e.message;
    }
    diagnostics.push('📨 תוצאה: ' + testResult);

    // عرض النتائج في alert
    alert(diagnostics.join('\n'));
}

// إرسال إشعار تجريبي عبر Cloud Function (الدالة القديمة)
async function sendTestNotification() {
    await testNotification();
}

// ==========================================
// iOS Native App - WKWebView Bridge
// ==========================================

// تفعيل/تعطيل إشعارات iOS عبر bridge
async function handleIOSNotifications() {
    var isEnabled = localStorage.getItem('iosPushEnabled') === 'true';

    if (isEnabled) {
        // ⭐ إيقاف الإشعارات
        console.log('🍎 Disabling iOS push...');
        localStorage.setItem('iosPushEnabled', 'false');

        if (currentUser) {
            await db.collection('users').doc(currentUser.uid).update({
                pushEnabled: false,
                pushDisabledAt: firebase.firestore.FieldValue.serverTimestamp()
            });
        }

        showToast('🔕 ההתראות הושבתו', 'success');
        updateNotificationButton(false);
    } else {
        // ⭐ طلب تفعيل من التطبيق الأصلي عبر WKWebView bridge
        console.log('🍎 Requesting iOS push permission via bridge...');
        showToast('⏳ מפעיל התראות...', 'info');

        try {
            // التطبيق يستخدم handler اسمه "push-permission-request"
            if (window.webkit.messageHandlers['push-permission-request']) {
                window.webkit.messageHandlers['push-permission-request'].postMessage('');
            } else if (window.webkit.messageHandlers.pushHandler) {
                window.webkit.messageHandlers.pushHandler.postMessage(JSON.stringify({
                    action: 'requestPermission',
                    userId: currentUser?.uid || ''
                }));
            }
        } catch (e) {
            console.error('🍎 Bridge error:', e);
            showToast('⚠️ שגיאה בתקשורת עם האפליקציה. נסה שוב.', 'error');
        }
    }
}

// ⭐ Callback (طريقة 1) - يستدعيه التطبيق الأصلي (Swift) بعد الحصول على FCM token
window.receiveFCMToken = async function(token) {
    console.log('🍎 Received FCM token from iOS native:', token ? token.substring(0, 20) + '...' : 'null');
    await saveIOSFCMToken(token);
};

// ⭐ Callback (طريقة 1) - يستدعيه التطبيق الأصلي إذا المستخدم رفض الإذن
window.pushPermissionDenied = function() {
    console.log('🍎 Push permission denied by user');
    localStorage.setItem('iosPushEnabled', 'false');
    showToast('❌ ההרשאה להתראות נדחתה. ניתן לאפשר בהגדרות המכשיר.', 'error');
    updateNotificationButton(false, true);
};

// ⭐ Event Listeners - التطبيق يرسل CustomEvents
// ⚠️ Swift يستخدم this.dispatchEvent() = window، لذلك نسمع على window + document
function onPushPermissionResult(e) {
    console.log('🍎 push-permission-request event:', e.detail);
    if (e.detail === 'granted') {
        localStorage.setItem('iosPushEnabled', 'true');
        showToast('✅ הרשאת התראות אושרה!', 'success');
        // الحين نطلب token
        requestIOSFCMToken();
    } else {
        localStorage.setItem('iosPushEnabled', 'false');
        showToast('❌ ההרשאה להתראות נדחתה', 'error');
        updateNotificationButton(false, true);
    }
}
window.addEventListener('push-permission-request', onPushPermissionResult);
document.addEventListener('push-permission-request', onPushPermissionResult);

function onPushToken(e) {
    console.log('🍎 push-token event:', e.detail);
    if (e.detail && e.detail !== 'ERROR GET TOKEN') {
        saveIOSFCMToken(e.detail);
    } else {
        console.error('🍎 Failed to get FCM token');
        showToast('⚠️ לא הצלחנו לקבל אסימון. נסה שוב.', 'warning');
    }
}
window.addEventListener('push-token', onPushToken);
document.addEventListener('push-token', onPushToken);

function onPushNotification(e) {
    console.log('🍎 push-notification event:', e.detail);
    if (e.detail) {
        var title = e.detail.notification?.title || e.detail.aps?.alert?.title || 'DRVN';
        var body = e.detail.notification?.body || e.detail.aps?.alert?.body || '';
        showToast('🔔 ' + title + ': ' + body, 'info');
        if (typeof playNotificationSound === 'function') playNotificationSound();
    }
}
window.addEventListener('push-notification', onPushNotification);
document.addEventListener('push-notification', onPushNotification);

function onPushNotificationClick(e) {
    console.log('🍎 push-notification-click event:', e.detail);
}
window.addEventListener('push-notification-click', onPushNotificationClick);
document.addEventListener('push-notification-click', onPushNotificationClick);

function onPushPermissionState(e) {
    console.log('🍎 push-permission-state event:', e.detail);
}
window.addEventListener('push-permission-state', onPushPermissionState);
document.addEventListener('push-permission-state', onPushPermissionState);

// طلب FCM token من التطبيق الأصلي
function requestIOSFCMToken() {
    try {
        if (window.webkit?.messageHandlers?.['push-token']) {
            window.webkit.messageHandlers['push-token'].postMessage('');
        }
    } catch (e) {
        console.error('🍎 Error requesting FCM token:', e);
    }
}

// حفظ FCM token من iOS في Firestore
async function saveIOSFCMToken(token) {
    if (!token) {
        showToast('⚠️ לא הצלחנו לקבל אסימון. נסה שוב.', 'warning');
        return;
    }

    console.log('🍎 Saving FCM token:', token.substring(0, 20) + '...');

    if (!currentUser) {
        console.log('🍎 No current user, saving token locally');
        localStorage.setItem('iosPushEnabled', 'true');
        localStorage.setItem('pendingFCMToken', token);
        return;
    }

    try {
        localStorage.setItem('iosPushEnabled', 'true');

        await db.collection('users').doc(currentUser.uid).update({
            fcmToken: token,
            pushEnabled: true,
            platform: 'ios_native',
            pushEnabledAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        console.log('🍎 ✅ FCM token saved to Firestore');
        showToast('🔔 ההתראות הופעלו בהצלחה!', 'success');
        updateNotificationButton(true);
    } catch (e) {
        console.error('🍎 Error saving FCM token:', e);
        showToast('⚠️ שגיאה בשמירת ההגדרות: ' + e.message, 'error');
    }
}
