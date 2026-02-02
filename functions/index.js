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

// Initialize Firebase Admin
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
        console.log('📤 Sending notification to:', playerIds);

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
        console.error('❌ Error sending notification:', error);
        throw error;
    }
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
    .schedule('every 60 minutes')
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
                
                if (!userData.oneSignalPlayerId) {
                    console.log(`⚠️ No OneSignal Player ID for user ${userId}`);
                    continue;
                }

                const playerId = userData.oneSignalPlayerId;
                console.log(`👤 User Player ID: ${playerId}`);

                // Check if we should send 24-hour reminder (between 23-25 hours)
                if (hoursDiff >= 23 && hoursDiff <= 25) {
                    const reminderSent = await wasReminderSent(appointmentId, '24h');
                    if (!reminderSent) {
                        console.log(`📤 Sending 24h reminder...`);
                        
                        const title = '📅 תזכורת: פגישה מחר';
                        const message = `היי! יש לך פגישה מחר בשעה ${appointment.time}\n` +
                                      `רכב: ${appointment.plateNumber || 'לא צוין'}\n` +
                                      `לקוח: ${appointment.ownerName || 'לא צוין'}`;
                        
                        await sendPushNotification([playerId], title, message, {
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
                        
                        await sendPushNotification([playerId], title, message, {
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
 * Manual Test Function - Send test notification
 */
exports.sendTestReminder = functions.https.onCall(async (data, context) => {
    // Require authentication
    if (!context.auth) {
        throw new functions.https.HttpsError(
            'unauthenticated',
            'User must be authenticated'
        );
    }

    const userId = context.auth.uid;
    
    try {
        // Get user's OneSignal Player ID
        const userDoc = await db.collection('users').doc(userId).get();
        const userData = userDoc.data();
        
        if (!userData || !userData.oneSignalPlayerId) {
            throw new functions.https.HttpsError(
                'not-found',
                'OneSignal Player ID not found for user'
            );
        }

        const playerId = userData.oneSignalPlayerId;
        
        // Send test notification
        const title = '🧪 בדיקה!';
        const message = 'התראות אוטומטיות עובדות מצוין! ✅';
        
        await sendPushNotification([playerId], title, message, {
            type: 'test'
        });

        return { success: true, message: 'Test notification sent!' };
    } catch (error) {
        console.error('Error in sendTestReminder:', error);
        throw new functions.https.HttpsError('internal', error.message);
    }
});