// DRVN Garage - Reminders, Debug & Global Window Exports

// ==========================================
// نظام الإشعارات المجاني (بدون Cloud Functions)
// ==========================================

// 1️⃣ فحص المواعيد القادمة (كل 10 دقائق)
async function checkUpcomingAppointments() {
    if (!currentUser) return;

    const now = new Date();
    const oneHourLater = new Date(now.getTime() + 60 * 60 * 1000);

    try {
        // ⭐ نستعلم فقط على الحقول المفهرسة (date + notificationSent)
        const appointmentsSnapshot = await db.collection('appointments')
            .where('userId', '==', currentUser.uid)
            .where('date', '>=', now)
            .where('notificationSent', '==', false)  // ⭐ استخدم == بدلاً من !=
            .get();

        // ⭐ فلترة في الكود للمواعيد خلال ساعة واحدة
        const upcomingAppointments = appointmentsSnapshot.docs.filter(doc => {
            const appointmentDate = doc.data().date.toDate();
            return appointmentDate <= oneHourLater;
        });

        for (const doc of upcomingAppointments) {
            const appointment = doc.data();

            try {
                const carDoc = await db.collection('cars').doc(appointment.carId).get();
                if (!carDoc.exists) continue;

                const car = carDoc.data();
                const carInfo = `${car.manufacturer} ${car.model} (${car.licensePlate})`;

                // ⭐ استخدام Service Worker Notification (أفضل!)
                if (getNotificationPermission() === 'granted' && 'serviceWorker' in navigator) {
                    navigator.serviceWorker.ready.then(registration => {
                        registration.showNotification('⏰ תזכורת: טיפול בעוד שעה', {
                            body: `טיפול עם ${carInfo} בשעה ${appointment.time}`,
                            icon: '/icon-192.png',
                            badge: '/icon-192.png',
                            tag: `appointment-${doc.id}`,
                            requireInteraction: true,
                            vibrate: [200, 100, 200],
                            dir: 'rtl',
                            data: {
                                type: 'appointment',
                                appointmentId: doc.id,
                                carId: appointment.carId
                            }
                        });
                    });
                }

                await doc.ref.update({
                    notificationSent: true,
                    notificationSentAt: firebase.firestore.FieldValue.serverTimestamp()
                });

                console.log('✅ Appointment notification sent for:', carInfo);
            } catch (carError) {
                console.error('Error processing appointment:', carError);
            }
        }
    } catch (error) {
        console.error('Error checking appointments:', error);
    }
}

// 2️⃣ فحص الفواتير غير المدفوعة (كل ساعة)
async function checkUnpaidInvoices() {
    if (!currentUser) return;

    const threeDaysAgo = new Date();
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

    try {
        const carsSnapshot = await db.collection('cars')
            .where('userId', '==', currentUser.uid)
            .where('paymentStatus', '==', 'unpaid')
            .where('updatedAt', '<=', firebase.firestore.Timestamp.fromDate(threeDaysAgo))
            .get();

        const today = new Date().toDateString();
        const lastCheck = localStorage.getItem('lastUnpaidCheck');

        if (lastCheck === today) return;

        if (!carsSnapshot.empty && getNotificationPermission() === 'granted' && 'serviceWorker' in navigator) {
            const count = carsSnapshot.size;

            navigator.serviceWorker.ready.then(registration => {
                registration.showNotification('💰 תזכורת: חשבוניות ממתינות', {
                    body: `יש לך ${count} חשבוניות ממתינות לתשלום`,
                    icon: '/icon-192.png',
                    badge: '/icon-192.png',
                    tag: 'unpaid-invoices',
                    requireInteraction: true,
                    vibrate: [200, 100, 200],
                    dir: 'rtl',
                    data: {
                        type: 'unpaid-invoices',
                        count: count
                    }
                });
            });

            localStorage.setItem('lastUnpaidCheck', today);
        }
    } catch (error) {
        console.error('Error checking unpaid invoices:', error);
    }
}

// 3️⃣ فحص انتهاء الاشتراك (يومياً)
async function checkSubscriptionExpiry() {
    if (!currentUser) return;

    try {
        const userDoc = await db.collection('users').doc(currentUser.uid).get();
        const userData = userDoc.data();

        if (!userData.subscriptionEndDate) return;

        const endDate = userData.subscriptionEndDate.toDate();
        const now = new Date();
        const daysLeft = Math.ceil((endDate - now) / (1000 * 60 * 60 * 24));

        const today = new Date().toDateString();
        const lastCheck = localStorage.getItem('lastSubscriptionCheck');

        if (lastCheck === today) return;

        let title, body;

        if (daysLeft <= 0) {
            title = '❌ המנוי פג תוקף';
            body = 'המנוי שלך פג תוקף. חדש אותו עכשיו';
        } else if (daysLeft <= 3) {
            title = '⚠️ המנוי מסתיים בקרוב';
            body = `המנוי שלך מסתיים בעוד ${daysLeft} ימים`;
        } else if (daysLeft <= 7) {
            title = '⏰ המנוי מסתיים בעוד שבוע';
            body = `המנוי שלך מסתיים בעוד ${daysLeft} ימים`;
        } else {
            localStorage.setItem('lastSubscriptionCheck', today);
            return;
        }

        if (getNotificationPermission() === 'granted' && 'serviceWorker' in navigator) {
            navigator.serviceWorker.ready.then(registration => {
                registration.showNotification(title, {
                    body: body,
                    icon: '/icon-192.png',
                    badge: '/icon-192.png',
                    tag: 'subscription-expiry',
                    requireInteraction: true,
                    vibrate: [300, 100, 300],
                    dir: 'rtl',
                    data: {
                        type: 'subscription',
                        daysLeft: daysLeft
                    }
                });
            });
        }

        localStorage.setItem('lastSubscriptionCheck', today);
    } catch (error) {
        console.error('Error checking subscription:', error);
    }
}

// تشغيل الفحوصات
if (typeof auth !== 'undefined' && auth) auth.onAuthStateChanged(async (user) => {
    if (user) {
        // ⭐ فحص وإصلاح Player ID تلقائياً (خاص بـ Median)
        if (isMedianApp()) {
            setTimeout(async () => {
                await autoFixPlayerIdIfNeeded(user.uid);
            }, 3000);
        }

        if (getNotificationPermission() === 'granted') {
            // فحص فوري بعد 5 ثواني من تسجيل الدخول
            setTimeout(() => {
                checkUpcomingAppointments();
                checkUnpaidInvoices();
                checkSubscriptionExpiry();
            }, 5000);

            // فحص المواعيد كل 10 دقائق
            setInterval(checkUpcomingAppointments, 10 * 60 * 1000);

            // فحص الفواتير كل ساعة
            setInterval(checkUnpaidInvoices, 60 * 60 * 1000);

            // فحص الاشتراك كل 6 ساعات
            setInterval(checkSubscriptionExpiry, 6 * 60 * 60 * 1000);
        }
    }
});

// ⭐ إصلاح Player ID تلقائياً إذا كان مفقوداً
async function autoFixPlayerIdIfNeeded(userId) {
    try {
        console.log('🔍 Checking Player ID for user:', userId);

        // التحقق من Firestore
        const userDoc = await db.collection('users').doc(userId).get();
        const userData = userDoc.data();

        // إذا Player ID موجود ويبدو صحيحاً
        if (userData?.oneSignalPlayerId && userData.oneSignalPlayerId.length > 10) {
            console.log('✅ Player ID already exists:', userData.oneSignalPlayerId.substring(0, 8) + '...');
            return;
        }

        console.log('⚠️ Player ID missing or invalid. Attempting to fix...');

        // محاولة الحصول على Player ID
        const playerId = await getMedianPlayerIdWithRetry(3, 2000);

        if (playerId) {
            await db.collection('users').doc(userId).update({
                oneSignalPlayerId: playerId,
                pushEnabled: true,
                platform: 'median_auto_fix',
                playerIdFixedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            console.log('✅ Player ID auto-fixed:', playerId.substring(0, 8) + '...');
        } else {
            console.log('⚠️ Could not auto-fix Player ID. User may need to enable notifications manually.');
        }

    } catch (error) {
        console.error('Error in autoFixPlayerIdIfNeeded:', error);
    }
}

// ========== دالة اختبار الإشعارات ==========
async function testNotifications() {
    console.log('🧪 بدء اختبار الإشعارات...');

    // 1. تحقق من الإذن
    if (getNotificationPermission() !== 'granted') {
        console.log('❌ الإذن غير ممنوح');
        alert('يرجى السماح بالإشعارات أولاً من القائمة الجانبية!');
        return;
    }

    // 2. تحقق من Service Worker
    if (!('serviceWorker' in navigator)) {
        console.log('❌ Service Worker غير مدعوم');
        alert('متصفحك لا يدعم Service Worker');
        return;
    }

    try {
        const registration = await navigator.serviceWorker.ready;
        console.log('✅ Service Worker جاهز');

        // 3. إشعار ترحيبي (فوراً)
        await registration.showNotification('👋 مرحباً بك في DRVN!', {
            body: 'سنرسل لك 3 إشعارات تجريبية',
            icon: '/icon-192.png',
            badge: '/icon-192.png',
            tag: 'test-welcome',
            dir: 'rtl',
            requireInteraction: false
        });
        console.log('✅ إشعار 1: تم إرساله');

        // 4. إشعار موعد (بعد 3 ثواني)
        setTimeout(async () => {
            await registration.showNotification('⏰ תזכורת: טיפול בעוד שעה', {
                body: 'טיפול עם טויוטה קאמרי (123-456) בעוד שעה אחת',
                icon: '/icon-192.png',
                badge: '/icon-192.png',
                tag: 'test-appointment',
                dir: 'rtl',
                requireInteraction: true,
                vibrate: [200, 100, 200]
            });
            console.log('✅ إشعار 2: تم إرساله');
        }, 3000);

        // 5. إشعار سيارة جاهزة (بعد 6 ثواني)
        setTimeout(async () => {
            await registration.showNotification('✅ הרכב מוכן לאיסוף!', {
                body: 'BMW X5 (789-012) מוכן לאיסוף',
                icon: '/icon-192.png',
                badge: '/icon-192.png',
                tag: 'test-car-ready',
                dir: 'rtl',
                vibrate: [300, 100, 300, 100, 300],
                requireInteraction: true
            });
            console.log('✅ إشعار 3: تم إرساله');
        }, 6000);

        console.log('⏳ انتظر 10 ثواني لرؤية جميع الإشعارات...');
        showToast('✅ נשלחו 3 התראות ניסיון!', 'success');

    } catch (error) {
        console.error('❌ خطأ في الاختبار:', error);
        showToast('⚠️ שגיאה: ' + error.message, 'error');
    }
}

// Make functions globally accessible for onclick handlers
window.restoreBackup = restoreBackup;
window.showBackupList = showBackupList;
window.openBackupModal = openBackupModal;
window.closeBackupModal = closeBackupModal;
window.createAutoBackup = createAutoBackup;

// ==========================================
// 🔧 Debug: فحص حالة الإشعارات
// ==========================================
async function debugNotifications() {
    console.log('========== 🔧 DEBUG NOTIFICATIONS ==========');

    // 1. معلومات البيئة
    console.log('🌐 Environment:');
    console.log('   - isMedianApp():', isMedianApp());
    console.log('   - Median available:', typeof Median !== 'undefined');
    console.log('   - median available:', typeof median !== 'undefined');
    console.log('   - gonative available:', typeof gonative !== 'undefined');
    console.log('   - OneSignal available:', typeof OneSignal !== 'undefined');
    console.log('   - User Agent:', navigator.userAgent);

    // 2. حالة الإذن
    console.log('🔔 Permission:');
    console.log('   - getNotificationPermission():', getNotificationPermission());
    console.log('   - Notification.permission:', 'Notification' in window ? Notification.permission : 'N/A');

    // 3. معلومات المستخدم من Firestore
    if (currentUser) {
        try {
            const userDoc = await db.collection('users').doc(currentUser.uid).get();
            const userData = userDoc.data();
            console.log('👤 User Data:');
            console.log('   - uid:', currentUser.uid);
            console.log('   - oneSignalPlayerId:', userData?.oneSignalPlayerId || '❌ NOT SET');
            console.log('   - pushEnabled:', userData?.pushEnabled);
            console.log('   - platform:', userData?.platform);
            console.log('   - fcmToken:', userData?.fcmToken ? '✅ SET' : '❌ NOT SET');
        } catch (e) {
            console.log('❌ Error reading user data:', e);
        }
    } else {
        console.log('❌ User not logged in');
    }

    // 4. محاولة الحصول على Player ID من Median
    console.log('📱 Trying to get Player ID from Median...');
    const playerId = await getMedianPlayerId();
    console.log('   - Player ID:', playerId || '❌ NOT AVAILABLE');

    // 5. LocalStorage
    console.log('💾 LocalStorage:');
    console.log('   - medianPushEnabled:', localStorage.getItem('medianPushEnabled'));
    console.log('   - oneSignalUserId:', localStorage.getItem('oneSignalUserId'));

    console.log('========== END DEBUG ==========');

    // عرض ملخص للمستخدم
    const summary = `
🔧 סטטוס התראות:
━━━━━━━━━━━━━━━━
📱 סביבה: ${isMedianApp() ? 'Median App' : 'Web Browser'}
🔔 הרשאה: ${getNotificationPermission()}
🆔 Player ID: ${playerId || 'לא נמצא'}
👤 UID: ${currentUser?.uid || 'לא מחובר'}
━━━━━━━━━━━━━━━━
פתח את Console (F12) לפרטים נוספים
    `;

    alert(summary);
    return { playerId, permission: getNotificationPermission() };
}

// دالة لإصلاح Player ID يدوياً
async function fixPlayerIdManually() {
    if (!currentUser) {
        showToast('⚠️ נא להתחבר תחילה', 'error');
        return;
    }

    showToast('⏳ מנסה לתקן את ההתראות...', 'info');

    // محاولة الحصول على Player ID
    const playerId = await getMedianPlayerIdWithRetry(5, 2000);

    if (playerId) {
        await savePushToken(playerId, 'manual_fix');
        showToast('✅ תוקן! Player ID: ' + playerId.substring(0, 8) + '...', 'success');
    } else {
        showToast('❌ לא הצלחנו לקבל Player ID. נסה להתקין מחדש את האפליקציה.', 'error');
    }
}

// إضافة للـ window للاستخدام من Console
window.debugNotifications = debugNotifications;
window.fixPlayerIdManually = fixPlayerIdManually;

// ==========================================
// 🔔 نظام التذكير التلقائي بالمواعيد
// ==========================================

// فحص المواعيد وإرسال تذكيرات
async function checkAndSendReminders() {
    if (!currentUser || !appointments || appointments.length === 0) {
        return;
    }

    const now = new Date();
    const today = now.toISOString().split('T')[0];
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();

    // الحصول على المواعيد اليوم والغد
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];

    for (const apt of appointments) {
        if (!apt.date || !apt.time) continue;

        const aptDateTime = new Date(`${apt.date}T${apt.time}`);
        const timeDiff = aptDateTime - now;
        const hoursDiff = timeDiff / (1000 * 60 * 60);

        // مفتاح لتتبع التذكيرات المُرسلة
        const reminderKey = `reminder_${apt.id || apt.date + apt.time}`;
        const sentReminders = JSON.parse(localStorage.getItem('sentReminders') || '{}');

        // تذكير قبل 24 ساعة
        if (hoursDiff <= 24 && hoursDiff > 23 && !sentReminders[reminderKey + '_24h']) {
            await sendAppointmentPushNotification(apt, '24h');
            sentReminders[reminderKey + '_24h'] = true;
            localStorage.setItem('sentReminders', JSON.stringify(sentReminders));
        }

        // تذكير قبل ساعة
        if (hoursDiff <= 1 && hoursDiff > 0 && !sentReminders[reminderKey + '_1h']) {
            await sendAppointmentPushNotification(apt, '1h');
            sentReminders[reminderKey + '_1h'] = true;
            localStorage.setItem('sentReminders', JSON.stringify(sentReminders));
        }
    }

    // تنظيف التذكيرات القديمة (أكثر من 7 أيام)
    cleanOldReminders();
}

// إرسال إشعار Push للموعد
async function sendAppointmentPushNotification(appointment, type) {
    try {
        const registration = await navigator.serviceWorker.ready;

        let title, body;

        if (type === '24h') {
            title = '📅 תזכורת: טיפול מחר';
            body = `${appointment.customerName || 'לקוח'} - ${appointment.time} - ${appointment.description || 'טיפול'}`;
        } else if (type === '1h') {
            title = '⏰ תזכורת: טיפול בעוד שעה!';
            body = `${appointment.customerName || 'לקוח'} - ${appointment.time} - ${appointment.description || 'טיפול'}`;
        }

        await registration.showNotification(title, {
            body: body,
            icon: '/icons/icon-192x192.png',
            badge: '/icons/badge-72x72.png',
            tag: `appointment-${type}-${appointment.id}`,
            dir: 'rtl',
            vibrate: [200, 100, 200],
            requireInteraction: true,
            actions: [
                { action: 'view', title: 'צפה' },
                { action: 'call', title: 'התקשר' }
            ],
            data: {
                appointmentId: appointment.id,
                phone: appointment.customerPhone || appointment.phone,
                type: 'appointment_reminder'
            }
        });

        console.log(`✅ Reminder sent (${type}):`, appointment.customerName);

    } catch (error) {
        console.error('❌ Error sending reminder:', error);
    }
}

// تنظيف التذكيرات القديمة
function cleanOldReminders() {
    const sentReminders = JSON.parse(localStorage.getItem('sentReminders') || '{}');
    const weekAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);

    // حذف المفاتيح القديمة
    let cleaned = false;
    for (const key in sentReminders) {
        if (sentReminders[key] === true) {
            // تحويل القيمة إلى timestamp للمقارنة
            // نحذف القديمة
        }
    }

    // إعادة تعيين كل أسبوع
    const lastClean = localStorage.getItem('lastReminderClean');
    if (!lastClean || Date.now() - parseInt(lastClean) > 7 * 24 * 60 * 60 * 1000) {
        localStorage.setItem('sentReminders', '{}');
        localStorage.setItem('lastReminderClean', Date.now().toString());
    }
}

// بدء فحص التذكيرات كل 15 دقيقة
function startReminderChecker() {
    // فحص فوري
    checkAndSendReminders();

    // فحص كل 15 دقيقة
    setInterval(checkAndSendReminders, 15 * 60 * 1000);

    console.log('✅ Reminder checker started (every 15 minutes)');
}

// إرسال تذكير يدوي عبر WhatsApp
function sendWhatsAppReminder(appointment) {
    // Check premium first
    if (!hasPremiumAccess()) {
        showPremiumModal('whatsapp');
        return;
    }

    const phone = appointment.customerPhone || appointment.phone;
    if (!phone) {
        showToast('⚠️ אין מספר טלפון', 'warning');
        return;
    }

    // تنظيف رقم الهاتف
    let cleanPhone = phone.replace(/\D/g, '');
    if (cleanPhone.startsWith('0')) {
        cleanPhone = '972' + cleanPhone.substring(1);
    }

    const message = encodeURIComponent(
        `שלום ${appointment.customerName || ''}! 👋\n\n` +
        `תזכורת לטיפול שלך במוסך:\n` +
        `📅 תאריך: ${appointment.date}\n` +
        `🕐 שעה: ${appointment.time}\n` +
        `🔧 סוג טיפול: ${appointment.description || 'טיפול'}\n\n` +
        `נשמח לראותך! 🚗`
    );

    window.location.href = `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${message}`;
}

// تشغيل فاحص التذكيرات عند تسجيل الدخول
document.addEventListener('DOMContentLoaded', () => {
    // انتظر حتى يتم تحميل المواعيد
    setTimeout(() => {
        if (currentUser) {
            startReminderChecker();
        }
    }, 5000);

    // تهيئة Median Push إذا كان التطبيق يعمل في Median
    if (isMedianApp()) {
        console.log('📱 Running in Median/GoNative app');
        initMedianPush();
    }
});

// تهيئة Median Push
function initMedianPush() {
    try {
        // OneSignal في Median
        if (typeof median !== 'undefined' && median.onesignal) {
            console.log('✅ Median OneSignal available');

            // استماع لأحداث Push
            median.onesignal.onesignalInfo({
                callback: function(info) {
                    if (info && info.oneSignalUserId) {
                        console.log('📱 OneSignal User ID:', info.oneSignalUserId);
                        localStorage.setItem('oneSignalUserId', info.oneSignalUserId);
                        localStorage.setItem('medianPushEnabled', 'true');

                        // حفظ في Firestore
                        if (currentUser) {
                            db.collection('users').doc(currentUser.uid).update({
                                oneSignalUserId: info.oneSignalUserId,
                                pushEnabled: true,
                                platform: 'median_android'
                            }).then(() => {
                                console.log('✅ OneSignal ID saved to Firestore');
                            });
                        }
                    }
                }
            });
        }

        // GoNative API
        if (typeof gonative !== 'undefined') {
            console.log('✅ GoNative available');
        }

    } catch (error) {
        console.error('Error initializing Median Push:', error);
    }
}

// إضافة للـ window object
window.sendWhatsAppReminder = sendWhatsAppReminder;
window.checkAndSendReminders = checkAndSendReminders;
window.isMedianApp = isMedianApp;
window.showLocalNotification = showLocalNotification;

// Premium system functions
window.hasPremiumAccess = hasPremiumAccess;
window.showPremiumModal = showPremiumModal;
window.closePremiumModal = closePremiumModal;
window.requirePremium = requirePremium;
window.openPaymentLink = openPaymentLink;
