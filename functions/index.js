/**
 * DRVN - Automatic Appointment Reminders
 * Firebase Cloud Functions
 * 
 * Features:
 * - Check appointments every hour
 * - Send reminder 24 hours before appointment
 * - Send reminder 1 hour before appointment
 * - Use OneSignal for push notifications
 */

const functions = require('firebase-functions');
const admin = require('firebase-admin');
const fetch = require('node-fetch');

// Initialize Firebase Admin with default credentials (Cloud Functions auto-provides them)
admin.initializeApp();
const db = admin.firestore();

// OneSignal Configuration
const ONESIGNAL_APP_ID = '4e012ba3-f512-4afc-a3d2-3adf7fc9d6f1';
const ONESIGNAL_REST_API_KEY = 'os_v2_app_jyasxi7vcjfpzi6shlpx7sow6fnaayv5tg2ucwuz4yp63gkm36alwxb4mn7p54sauyvat4ghhwt4k64pvzzmjfopxkxzq23awtp5smy';

/**
 * Send Push Notification via OneSignal (New API v2)
 */
async function sendPushNotification(playerIds, title, message, data = {}) {
    try {
        console.log('📤 Sending notification via OneSignal to:', playerIds);

        const response = await fetch('https://api.onesignal.com/notifications', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Key ${ONESIGNAL_REST_API_KEY}`
            },
            body: JSON.stringify({
                app_id: ONESIGNAL_APP_ID,
                include_subscription_ids: playerIds,
                headings: { "en": title, "he": title },
                contents: { "en": message, "he": message },
                data: data,
                priority: 10,
                android_sound: "default",
                ios_sound: "default"
            })
        });

        const result = await response.json();
        console.log('✅ OneSignal response:', JSON.stringify(result));
        return result;
    } catch (error) {
        console.error('❌ Error sending OneSignal notification:', error);
        throw error;
    }
}

/**
 * Send Push Notification via Firebase FCM (fallback for iOS/Web)
 */
async function sendFCMNotification(fcmToken, title, message, data = {}) {
    try {
        console.log('📤 Sending notification via FCM to:', fcmToken.substring(0, 20) + '...');

        // Convert all data values to strings (FCM requirement)
        const stringData = {};
        for (const key of Object.keys(data)) {
            stringData[key] = String(data[key]);
        }

        const payload = {
            token: fcmToken,
            notification: {
                title: title,
                body: message
            },
            data: stringData,
            apns: {
                headers: {
                    'apns-priority': '10',
                    'apns-push-type': 'alert'
                },
                payload: {
                    aps: {
                        alert: {
                            title: title,
                            body: message
                        },
                        sound: 'default',
                        badge: 1
                    }
                }
            }
        };

        console.log('📤 Sending via admin.messaging().send()...');
        const response = await admin.messaging().send(payload);
        console.log('✅ FCM response:', response);
        return { success: true, messageId: response };
    } catch (error) {
        console.error('❌ Error sending FCM notification:', error.code, error.message);
        if (error.errorInfo) {
            console.error('❌ Error info:', JSON.stringify(error.errorInfo));
        }
        throw error;
    }
}

/**
 * Send notification to user - tries OneSignal first, then FCM as fallback
 */
async function sendNotificationToUser(userData, title, message, data = {}) {
    let sent = false;

    // مسار 1: iOS Native → دائماً FCM أولاً (OneSignal ما يشتغل على WKWebView)
    if (userData.platform === 'ios_native' && userData.fcmToken) {
        try {
            await sendFCMNotification(userData.fcmToken, title, message, data);
            sent = true;
            console.log('✅ Sent via FCM (iOS native)');
        } catch (e) {
            console.log('❌ FCM failed for iOS native:', e.message);
        }
    }

    // مسار 2: OneSignal (للويب والأندرويد)
    if (!sent && userData.oneSignalPlayerId && userData.oneSignalPlayerId !== 'pending') {
        try {
            await sendPushNotification([userData.oneSignalPlayerId], title, message, data);
            sent = true;
            console.log('✅ Sent via OneSignal');
        } catch (e) {
            console.log('⚠️ OneSignal failed, trying FCM...', e.message);
        }
    }

    // مسار 3: FCM (fallback لأي منصة)
    if (!sent && userData.fcmToken) {
        try {
            await sendFCMNotification(userData.fcmToken, title, message, data);
            sent = true;
            console.log('✅ Sent via FCM');
        } catch (e) {
            console.log('❌ FCM also failed:', e.message);
        }
    }

    if (!sent) {
        console.log('⚠️ No notification channel available for user');
    }

    return sent;
}

/**
 * Parse date and time strings to Date object
 * Handles formats like "2025-12-15" and "22:00"
 */
function parseAppointmentDateTime(dateStr, timeStr) {
    try {
        // dateStr format: "2025-12-15" or "2025-12-15T00:00:00..."
        // timeStr format: "22:00" or "22:00:00"
        
        let datePart = dateStr;
        
        // If date contains 'T', extract just the date part
        if (dateStr && dateStr.includes('T')) {
            datePart = dateStr.split('T')[0];
        }
        
        // Combine date and time
        const dateTimeStr = `${datePart}T${timeStr || '00:00'}:00`;
        const date = new Date(dateTimeStr);
        
        console.log(`📅 Parsed date: ${dateStr} ${timeStr} -> ${date.toISOString()}`);
        
        return date;
    } catch (error) {
        console.error('❌ Error parsing date:', error);
        return null;
    }
}

/**
 * Get time difference in hours
 */
function getHoursDifference(appointmentDate) {
    const now = new Date();
    const diff = appointmentDate.getTime() - now.getTime();
    return diff / (1000 * 60 * 60); // Convert to hours
}

/**
 * Check if reminder was already sent
 */
async function wasReminderSent(appointmentId, reminderType) {
    const reminderDoc = await db.collection('reminders')
        .doc(`${appointmentId}_${reminderType}`)
        .get();
    
    return reminderDoc.exists;
}

/**
 * Mark reminder as sent
 */
async function markReminderAsSent(appointmentId, reminderType) {
    await db.collection('reminders')
        .doc(`${appointmentId}_${reminderType}`)
        .set({
            appointmentId: appointmentId,
            reminderType: reminderType,
            sentAt: admin.firestore.FieldValue.serverTimestamp()
        });
}

/**
 * Main Function: Check Appointments and Send Reminders
 * Runs every hour
 */
exports.checkAppointmentReminders = functions
    .runWith({
        timeoutSeconds: 540,
        memory: '256MB'
    })
    .pubsub
    .schedule('every 15 minutes')
    .timeZone('Asia/Jerusalem')
    .onRun(async (context) => {
        console.log('🔍 Starting appointment reminders check...');
        console.log('⏰ Current time:', new Date().toISOString());
        
        try {
            const now = new Date();
            
            // Get today and tomorrow dates in YYYY-MM-DD format
            const today = now.toISOString().split('T')[0];
            const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString().split('T')[0];
            const dayAfterTomorrow = new Date(now.getTime() + 48 * 60 * 60 * 1000).toISOString().split('T')[0];
            
            console.log(`📅 Checking dates: ${today}, ${tomorrow}, ${dayAfterTomorrow}`);

            // Get appointments for today, tomorrow, and day after tomorrow
            const appointmentsSnapshot = await db.collection('appointments')
                .where('date', '>=', today)
                .where('date', '<=', dayAfterTomorrow)
                .where('status', '==', 'scheduled')
                .get();

            console.log(`📅 Found ${appointmentsSnapshot.size} scheduled appointments`);

            let remindersSent = 0;

            for (const appointmentDoc of appointmentsSnapshot.docs) {
                const appointment = appointmentDoc.data();
                const appointmentId = appointmentDoc.id;
                
                console.log(`\n📋 Processing appointment: ${appointmentId}`);
                console.log(`   Date: ${appointment.date}, Time: ${appointment.time}`);
                console.log(`   Owner: ${appointment.ownerName}, Plate: ${appointment.plateNumber}`);
                
                // Parse the appointment date and time
                const appointmentDate = parseAppointmentDateTime(appointment.date, appointment.time);
                
                if (!appointmentDate || isNaN(appointmentDate.getTime())) {
                    console.log(`⚠️ Invalid date for appointment ${appointmentId}`);
                    continue;
                }

                const hoursDiff = getHoursDifference(appointmentDate);
                console.log(`⏰ Appointment in ${hoursDiff.toFixed(1)} hours`);

                // Skip past appointments
                if (hoursDiff < 0) {
                    console.log(`⏭️ Skipping past appointment`);
                    continue;
                }

                // Get user's OneSignal Player ID
                const userId = appointment.userId;
                if (!userId) {
                    console.log(`⚠️ No userId for appointment ${appointmentId}`);
                    continue;
                }

                const userDoc = await db.collection('users').doc(userId).get();
                
                if (!userDoc.exists) {
                    console.log(`⚠️ User ${userId} not found`);
                    continue;
                }
                
                const userData = userDoc.data();
                
                if (!userData.oneSignalPlayerId && !userData.fcmToken) {
                    console.log(`⚠️ No notification channel for user ${userId}`);
                    continue;
                }

                console.log(`👤 User channels: OneSignal=${userData.oneSignalPlayerId ? 'yes' : 'no'}, FCM=${userData.fcmToken ? 'yes' : 'no'}`);

                // Check if we should send 24-hour reminder (between 23-25 hours)
                if (hoursDiff >= 23 && hoursDiff <= 25) {
                    const reminderSent = await wasReminderSent(appointmentId, '24h');
                    if (!reminderSent) {
                        console.log(`📤 Sending 24h reminder...`);

                        const title = '📅 תזכורת: פגישה מחר';
                        const message = `היי! יש לך פגישה מחר בשעה ${appointment.time}\n` +
                                      `רכב: ${appointment.plateNumber || 'לא צוין'}\n` +
                                      `לקוח: ${appointment.ownerName || 'לא צוין'}`;

                        await sendNotificationToUser(userData, title, message, {
                            type: 'appointment_reminder',
                            appointmentId: appointmentId,
                            reminderType: '24h'
                        });

                        await markReminderAsSent(appointmentId, '24h');
                        console.log(`✅ Sent 24h reminder for appointment ${appointmentId}`);
                        remindersSent++;
                    } else {
                        console.log(`⏭️ 24h reminder already sent`);
                    }
                }

                // Check if we should send 1-hour reminder (between 0.5-1.5 hours)
                if (hoursDiff >= 0.5 && hoursDiff <= 1.5) {
                    const reminderSent = await wasReminderSent(appointmentId, '1h');
                    if (!reminderSent) {
                        console.log(`📤 Sending 1h reminder...`);

                        const title = '⏰ תזכורת: פגישה בעוד שעה!';
                        const message = `הפגישה מתקרבת! בשעה ${appointment.time}\n` +
                                      `רכב: ${appointment.plateNumber || 'לא צוין'}\n` +
                                      `לקוח: ${appointment.ownerName || 'לא צוין'}`;

                        await sendNotificationToUser(userData, title, message, {
                            type: 'appointment_reminder',
                            appointmentId: appointmentId,
                            reminderType: '1h'
                        });

                        await markReminderAsSent(appointmentId, '1h');
                        console.log(`✅ Sent 1h reminder for appointment ${appointmentId}`);
                        remindersSent++;
                    } else {
                        console.log(`⏭️ 1h reminder already sent`);
                    }
                }
            }

            console.log(`\n✅ Appointment reminders check completed. Sent ${remindersSent} reminders.`);
            return null;
        } catch (error) {
            console.error('❌ Error in checkAppointmentReminders:', error);
            throw error;
        }
    });

/**
 * Cleanup old reminders (older than 30 days)
 * Runs daily at 2 AM
 */
exports.cleanupOldReminders = functions
    .runWith({
        timeoutSeconds: 540,
        memory: '256MB'
    })
    .pubsub
    .schedule('0 2 * * *')
    .timeZone('Asia/Jerusalem')
    .onRun(async (context) => {
        console.log('🧹 Starting cleanup of old reminders...');
        
        try {
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

            const oldReminders = await db.collection('reminders')
                .where('sentAt', '<', admin.firestore.Timestamp.fromDate(thirtyDaysAgo))
                .get();

            console.log(`Found ${oldReminders.size} old reminders to delete`);

            const batch = db.batch();
            oldReminders.docs.forEach(doc => {
                batch.delete(doc.ref);
            });

            await batch.commit();
            console.log('✅ Old reminders cleanup completed');
            return null;
        } catch (error) {
            console.error('❌ Error in cleanupOldReminders:', error);
            throw error;
        }
    });

/**
 * Automatic Backup Function
 * Runs every Friday at 23:00 Israel time
 * Backs up all users' data to a separate backups collection
 */
exports.automaticBackup = functions
    .runWith({
        timeoutSeconds: 540,
        memory: '512MB'
    })
    .pubsub
    .schedule('0 23 * * 5')  // Every Friday at 23:00
    .timeZone('Asia/Jerusalem')
    .onRun(async (context) => {
        console.log('💾 Starting automatic backup...');
        console.log('⏰ Current time:', new Date().toISOString());

        try {
            // Get all users
            const usersSnapshot = await db.collection('users').get();
            console.log(`👥 Found ${usersSnapshot.size} users`);

            let backupsCreated = 0;
            let notificationsSent = 0;

            for (const userDoc of usersSnapshot.docs) {
                const userId = userDoc.id;
                const userData = userDoc.data();

                console.log(`\n📦 Backing up user: ${userId}`);

                try {
                    // Get user's cars
                    const carsSnapshot = await db.collection('cars')
                        .where('userId', '==', userId)
                        .get();

                    // Get user's maintenance records
                    const maintenanceSnapshot = await db.collection('maintenance')
                        .where('userId', '==', userId)
                        .get();

                    // Get user's appointments
                    const appointmentsSnapshot = await db.collection('appointments')
                        .where('userId', '==', userId)
                        .get();

                    // Prepare backup data content
                    const backupDataContent = {
                        cars: carsSnapshot.docs.map(doc => ({
                            id: doc.id,
                            ...doc.data(),
                            imageUrl: null // Remove images to save space
                        })),
                        maintenance: maintenanceSnapshot.docs.map(doc => ({
                            id: doc.id,
                            ...doc.data()
                        })),
                        appointments: appointmentsSnapshot.docs.map(doc => ({
                            id: doc.id,
                            ...doc.data()
                        }))
                    };

                    // Generate hash to detect changes
                    const currentHash = generateBackupHash(backupDataContent);

                    // Check if last backup has the same hash
                    const lastBackupSnapshot = await db.collection('backups')
                        .where('userId', '==', userId)
                        .orderBy('backupDate', 'desc')
                        .limit(1)
                        .get();

                    if (!lastBackupSnapshot.empty) {
                        const lastBackup = lastBackupSnapshot.docs[0].data();
                        if (lastBackup.dataHash === currentHash) {
                            console.log(`⏭️ No changes for user ${userId}, skipping backup`);
                            continue; // Skip this user
                        }
                    }

                    // Create backup data
                    const backupData = {
                        userId: userId,
                        userEmail: userData.email || '',
                        backupDate: admin.firestore.FieldValue.serverTimestamp(),
                        backupType: 'automatic',
                        version: '2.0',
                        dataHash: currentHash,
                        data: backupDataContent,
                        stats: {
                            carsCount: carsSnapshot.size,
                            maintenanceCount: maintenanceSnapshot.size,
                            appointmentsCount: appointmentsSnapshot.size
                        }
                    };

                    // Save backup to backups collection
                    const backupRef = await db.collection('backups').add(backupData);
                    console.log(`✅ Backup created for user ${userId}: ${backupRef.id}`);
                    backupsCreated++;

                    // Clean up old backups (keep only last 4)
                    const oldBackupsSnapshot = await db.collection('backups')
                        .where('userId', '==', userId)
                        .orderBy('backupDate', 'desc')
                        .get();

                    if (oldBackupsSnapshot.size > 4) {
                        const backupsToDelete = oldBackupsSnapshot.docs.slice(4);
                        for (const backupDoc of backupsToDelete) {
                            await backupDoc.ref.delete();
                            console.log(`🗑️ Deleted old backup: ${backupDoc.id}`);
                        }
                    }

                    // Send notification to user
                    if (userData.oneSignalPlayerId || userData.fcmToken) {
                        const title = '💾 גיבוי אוטומטי הושלם';
                        const message = `הנתונים שלך גובו בהצלחה!\n` +
                            `${backupData.stats.carsCount} רכבים, ` +
                            `${backupData.stats.maintenanceCount} טיפולים, ` +
                            `${backupData.stats.appointmentsCount} פגישות`;

                        await sendNotificationToUser(userData, title, message, {
                            type: 'backup_complete',
                            backupId: backupRef.id
                        });
                        notificationsSent++;
                        console.log(`📤 Notification sent to user ${userId}`);
                    }

                } catch (userError) {
                    console.error(`❌ Error backing up user ${userId}:`, userError);
                }
            }

            console.log(`\n✅ Automatic backup completed!`);
            console.log(`📊 Backups created: ${backupsCreated}`);
            console.log(`📤 Notifications sent: ${notificationsSent}`);

            return null;
        } catch (error) {
            console.error('❌ Error in automaticBackup:', error);
            throw error;
        }
    });

/**
 * Get user's backups from cloud
 */
exports.getUserBackups = functions.https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError(
            'unauthenticated',
            'User must be authenticated'
        );
    }

    const userId = context.auth.uid;

    try {
        const backupsSnapshot = await db.collection('backups')
            .where('userId', '==', userId)
            .orderBy('backupDate', 'desc')
            .limit(10)
            .get();

        const backups = backupsSnapshot.docs.map(doc => ({
            id: doc.id,
            backupDate: doc.data().backupDate,
            backupType: doc.data().backupType,
            stats: doc.data().stats
        }));

        return { success: true, backups: backups };
    } catch (error) {
        console.error('Error getting backups:', error);
        throw new functions.https.HttpsError('internal', error.message);
    }
});

/**
 * Restore backup from cloud
 */
exports.restoreBackup = functions.https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError(
            'unauthenticated',
            'User must be authenticated'
        );
    }

    const userId = context.auth.uid;
    const backupId = data.backupId;

    if (!backupId) {
        throw new functions.https.HttpsError(
            'invalid-argument',
            'Backup ID is required'
        );
    }

    try {
        const backupDoc = await db.collection('backups').doc(backupId).get();

        if (!backupDoc.exists) {
            throw new functions.https.HttpsError('not-found', 'Backup not found');
        }

        const backupData = backupDoc.data();

        // Verify ownership
        if (backupData.userId !== userId) {
            throw new functions.https.HttpsError(
                'permission-denied',
                'This backup does not belong to you'
            );
        }

        return {
            success: true,
            data: backupData.data,
            stats: backupData.stats,
            backupDate: backupData.backupDate
        };
    } catch (error) {
        console.error('Error restoring backup:', error);
        throw new functions.https.HttpsError('internal', error.message);
    }
});

/**
 * Generate a hash/checksum for backup data to detect changes
 */
function generateBackupHash(data) {
    const str = JSON.stringify({
        carsIds: data.cars.map(c => c.id).sort(),
        carsCount: data.cars.length,
        maintenanceIds: data.maintenance.map(m => m.id).sort(),
        maintenanceCount: data.maintenance.length,
        appointmentsIds: data.appointments.map(a => a.id).sort(),
        appointmentsCount: data.appointments.length
    });
    // Simple hash function
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
    }
    return hash.toString();
}

/**
 * Manual Cloud Backup - Triggered by user
 * Creates a cloud backup for the current user (only if data changed)
 */
exports.manualCloudBackup = functions.https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError(
            'unauthenticated',
            'User must be authenticated'
        );
    }

    const userId = context.auth.uid;

    try {
        console.log(`💾 Manual cloud backup for user: ${userId}`);

        // Get user data
        const userDoc = await db.collection('users').doc(userId).get();
        const userData = userDoc.exists ? userDoc.data() : {};

        // Get user's cars
        const carsSnapshot = await db.collection('cars')
            .where('userId', '==', userId)
            .get();

        // Get user's maintenance records
        const maintenanceSnapshot = await db.collection('maintenance')
            .where('userId', '==', userId)
            .get();

        // Get user's appointments
        const appointmentsSnapshot = await db.collection('appointments')
            .where('userId', '==', userId)
            .get();

        // Prepare data for backup
        const backupDataContent = {
            cars: carsSnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
                imageUrl: null
            })),
            maintenance: maintenanceSnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            })),
            appointments: appointmentsSnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }))
        };

        // Generate hash for current data
        const currentHash = generateBackupHash(backupDataContent);
        console.log(`📊 Current data hash: ${currentHash}`);

        // Check if last backup has the same hash
        const lastBackupSnapshot = await db.collection('backups')
            .where('userId', '==', userId)
            .orderBy('backupDate', 'desc')
            .limit(1)
            .get();

        if (!lastBackupSnapshot.empty) {
            const lastBackup = lastBackupSnapshot.docs[0].data();
            if (lastBackup.dataHash === currentHash) {
                console.log(`⏭️ No changes detected, skipping backup`);
                return {
                    success: true,
                    skipped: true,
                    message: 'אין שינויים מאז הגיבוי האחרון',
                    stats: {
                        carsCount: carsSnapshot.size,
                        maintenanceCount: maintenanceSnapshot.size,
                        appointmentsCount: appointmentsSnapshot.size
                    }
                };
            }
        }

        // Create backup data
        const backupData = {
            userId: userId,
            userEmail: userData.email || '',
            backupDate: admin.firestore.FieldValue.serverTimestamp(),
            backupType: 'manual',
            version: '2.0',
            dataHash: currentHash,
            data: backupDataContent,
            stats: {
                carsCount: carsSnapshot.size,
                maintenanceCount: maintenanceSnapshot.size,
                appointmentsCount: appointmentsSnapshot.size
            }
        };

        // Save backup
        const backupRef = await db.collection('backups').add(backupData);
        console.log(`✅ Manual backup created: ${backupRef.id}`);

        // Clean up old backups (keep only last 4)
        const oldBackupsSnapshot = await db.collection('backups')
            .where('userId', '==', userId)
            .orderBy('backupDate', 'desc')
            .get();

        if (oldBackupsSnapshot.size > 4) {
            const backupsToDelete = oldBackupsSnapshot.docs.slice(4);
            for (const backupDoc of backupsToDelete) {
                await backupDoc.ref.delete();
            }
        }

        return {
            success: true,
            skipped: false,
            backupId: backupRef.id,
            stats: backupData.stats
        };
    } catch (error) {
        console.error('Error in manualCloudBackup:', error);
        throw new functions.https.HttpsError('internal', error.message);
    }
});

/**
 * Manual Test Function - Send test notification
 */
// PayPal Configuration
const PAYPAL_CLIENT_ID = 'ARdAW7Nq-GLrIHOmn42oibE9ostkd5s06n7jjR43MkgtDpR7M2pT1vTG_QM3wiWiuaXYOPpKYceF0IcO';
const PAYPAL_CLIENT_SECRET = process.env.PAYPAL_SECRET || 'YOUR_PAYPAL_SECRET'; // Set in Firebase config
const PAYPAL_API_BASE = 'https://api-m.paypal.com'; // Live API

/**
 * PayPal Webhook Handler
 * Receives payment notifications from PayPal and activates subscriptions
 */
exports.paypalWebhook = functions.https.onRequest(async (req, res) => {
    console.log('💰 PayPal Webhook received');

    // Only accept POST requests
    if (req.method !== 'POST') {
        res.status(405).send('Method Not Allowed');
        return;
    }

    try {
        const webhookEvent = req.body;
        console.log('📦 Webhook event type:', webhookEvent.event_type);
        console.log('📦 Webhook data:', JSON.stringify(webhookEvent, null, 2));

        // Handle payment completed event
        if (webhookEvent.event_type === 'PAYMENT.CAPTURE.COMPLETED' ||
            webhookEvent.event_type === 'CHECKOUT.ORDER.APPROVED') {

            const resource = webhookEvent.resource;
            const amount = resource.amount?.value || resource.purchase_units?.[0]?.amount?.value;
            const currency = resource.amount?.currency_code || resource.purchase_units?.[0]?.amount?.currency_code;
            const payerEmail = resource.payer?.email_address || webhookEvent.resource?.payer?.email_address;
            const paymentId = resource.id;
            const transactionId = resource.id || webhookEvent.id;

            console.log(`💳 Payment received: ${amount} ${currency} from ${payerEmail}`);

            // Find user by email
            let userId = null;
            let userEmail = payerEmail;

            if (payerEmail) {
                const usersSnapshot = await db.collection('users')
                    .where('email', '==', payerEmail)
                    .limit(1)
                    .get();

                if (!usersSnapshot.empty) {
                    const userDoc = usersSnapshot.docs[0];
                    userId = userDoc.id;
                    userEmail = userDoc.data().email || payerEmail;

                    // Calculate subscription expiry (1 month from now)
                    const now = new Date();
                    const expiryDate = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

                    // Update user subscription
                    await db.collection('users').doc(userId).update({
                        isPaid: true,
                        subscriptionStatus: 'active',
                        subscriptionEndDate: admin.firestore.Timestamp.fromDate(expiryDate),
                        lastPaymentDate: admin.firestore.FieldValue.serverTimestamp(),
                        lastPaymentAmount: amount,
                        lastPaymentId: paymentId,
                        paymentMethod: 'paypal'
                    });

                    console.log(`✅ Subscription activated for user ${userId} until ${expiryDate.toISOString()}`);

                    // Send notification to user
                    const updatedUserData = userDoc.data();
                    if (updatedUserData.oneSignalPlayerId || updatedUserData.fcmToken) {
                        await sendNotificationToUser(
                            updatedUserData,
                            '🎉 המנוי הופעל!',
                            `תודה על התשלום! המנוי שלך פעיל עד ${expiryDate.toLocaleDateString('he-IL')}`,
                            { type: 'subscription_activated' }
                        );
                    }
                } else {
                    console.log(`⚠️ User not found for email: ${payerEmail}`);
                }
            }

            // ⭐ Save PayPal payment to paypal_payments collection (for admin dashboard)
            await db.collection('paypal_payments').add({
                transactionId: transactionId,
                paymentId: paymentId,
                payerEmail: payerEmail,
                userEmail: userEmail,
                userId: userId,
                amount: parseFloat(amount) || 200,
                currency: currency || 'ILS',
                status: 'completed',
                eventType: webhookEvent.event_type,
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                webhookReceivedAt: new Date().toISOString()
            });

            console.log(`📝 PayPal payment recorded in paypal_payments collection`);
        }

        // Return 200 to acknowledge receipt
        res.status(200).send('OK');
    } catch (error) {
        console.error('❌ Error processing PayPal webhook:', error);
        res.status(500).send('Internal Server Error');
    }
});

/**
 * Manual Test Function - Send test notification (tries OneSignal + FCM)
 */
exports.sendTestReminder = functions.https.onCall(async (data, context) => {
    const userId = context.auth?.uid || data?.userId;

    if (!userId) {
        throw new functions.https.HttpsError('unauthenticated', 'User ID is required');
    }

    try {
        const userDoc = await db.collection('users').doc(userId).get();
        const userData = userDoc.data();

        if (!userData) {
            throw new functions.https.HttpsError('not-found', 'User not found');
        }

        const title = '🧪 בדיקה!';
        const message = 'התראות עובדות מצוין! ✅ ' + new Date().toLocaleTimeString('he-IL');

        const sent = await sendNotificationToUser(userData, title, message, { type: 'test' });

        if (!sent) {
            throw new functions.https.HttpsError('not-found',
                'No notification channel. OneSignal: ' + (userData.oneSignalPlayerId || 'none') +
                ', FCM: ' + (userData.fcmToken ? 'exists' : 'none'));
        }

        return {
            success: true,
            message: 'Test notification sent!',
            channels: {
                oneSignal: !!userData.oneSignalPlayerId,
                fcm: !!userData.fcmToken
            }
        };
    } catch (error) {
        console.error('Error in sendTestReminder:', error);
        throw new functions.https.HttpsError('internal', error.message);
    }
});

/**
 * Send Test via FCM only (for iOS testing)
 * يقبل userId من auth أو من data (للـ iOS WKWebView اللي ما عنده auth session)
 */
exports.sendTestFCM = functions.https.onCall(async (data, context) => {
    // iOS WKWebView ممكن ما يكون عنده auth session
    const userId = context.auth?.uid || data?.userId;

    if (!userId) {
        throw new functions.https.HttpsError('unauthenticated', 'User ID is required');
    }

    try {
        const userDoc = await db.collection('users').doc(userId).get();
        const userData = userDoc.data();

        if (!userData || !userData.fcmToken) {
            throw new functions.https.HttpsError('not-found',
                'FCM token not found. Please enable notifications first.');
        }

        const title = '🧪 בדיקת FCM!';
        const message = 'FCM Push עובד! ✅ ' + new Date().toLocaleTimeString('he-IL');

        await sendFCMNotification(userData.fcmToken, title, message, { type: 'test_fcm' });

        return { success: true, message: 'FCM test notification sent!' };
    } catch (error) {
        console.error('Error in sendTestFCM:', error);
        throw new functions.https.HttpsError('internal', error.message);
    }
});

/**
 * Send Test via FCM - HTTP endpoint (for iOS WKWebView that can't use httpsCallable)
 */
exports.sendTestFCMHttp = functions.https.onRequest(async (req, res) => {
    // CORS
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.status(204).send('');
        return;
    }

    if (req.method !== 'POST') {
        res.status(405).json({ success: false, error: 'Method not allowed' });
        return;
    }

    try {
        const userId = req.body.userId;
        if (!userId) {
            res.status(400).json({ success: false, error: 'userId is required' });
            return;
        }

        const userDoc = await db.collection('users').doc(userId).get();
        const userData = userDoc.data();

        if (!userData || !userData.fcmToken) {
            res.status(404).json({ success: false, error: 'FCM token not found' });
            return;
        }

        const title = '🧪 בדיקת FCM!';
        const message = 'FCM Push עובד! ✅ ' + new Date().toLocaleTimeString('he-IL');

        console.log('📱 User platform:', userData.platform);
        console.log('📱 FCM token prefix:', userData.fcmToken?.substring(0, 30));
        console.log('📱 FCM token length:', userData.fcmToken?.length);

        await sendFCMNotification(userData.fcmToken, title, message, { type: 'test_fcm' });

        console.log('✅ Test FCM sent to user:', userId);
        res.status(200).json({ success: true, message: 'FCM test notification sent!' });
    } catch (error) {
        console.error('Error in sendTestFCMHttp:', error);
        res.status(500).json({
            success: false,
            error: error.message,
            platform: (await db.collection('users').doc(req.body.userId).get()).data()?.platform,
            tokenLength: (await db.collection('users').doc(req.body.userId).get()).data()?.fcmToken?.length
        });
    }
});