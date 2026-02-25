// DRVN Garage - Backup, Restore & Cloud Backup System

// Open Backup Modal
        function openBackupModal() {
            // إغلاق السايد بار إذا كان مفتوحاً
            const sidebar = document.getElementById('sidebar');
            if (sidebar && sidebar.classList.contains('open')) {
                toggleSidebar();
            }
            // إغلاق جميع الـ modals المفتوحة أولاً
            closeAllModals();

            // منع سكرول الـ body على الموبايل
            document.body.classList.add('modal-open');

            // فتح نافذة النسخ الاحتياطي
            document.getElementById('backupModal').classList.remove('hidden');

            // تحديث المعلومات بشكل غير متزامن لتجنب التعليق
            setTimeout(() => {
                try {
                    updateBackupInfo();
                } catch (e) {
                    console.error('Error updating backup info:', e);
                }
            }, 100);

            setTimeout(() => {
                try {
                    updateAutoBackupInfo();
                } catch (e) {
                    console.error('Error updating auto backup info:', e);
                }
            }, 200);

            // تحديث حالة النافيجيشن
            updateActiveNav(3);
            hideUIElements(); // إخفاء FAB والقائمة السفلية
        }

        // Close Backup Modal
        function closeBackupModal() {
            const modal = document.getElementById('backupModal');
            const contentDiv = document.getElementById('backupModalContent');

            // Restore original content if it was changed
            if (window.backupModalOriginalContent && contentDiv) {
                contentDiv.innerHTML = window.backupModalOriginalContent;
                console.log('✅ Content restored to original');
            }

            modal.classList.add('hidden');
            // السماح بسكرول الـ body مرة أخرى
            document.body.classList.remove('modal-open');
            showUIElements(); // إظهار FAB والقائمة السفلية
            // العودة إلى حالة البيت في النافيجيشن
            updateActiveNav(0);
        }

        // Update Backup Info
        async function updateBackupInfo() {
            try {
                // Check if elements exist (modal might be closed)
                const totalDataElement = document.getElementById('totalDataCount');
                const lastBackupElement = document.getElementById('lastBackupDate');

                if (!totalDataElement || !lastBackupElement) {
                    console.log('Backup info elements not found - modal might be closed');
                    return;
                }

                const totalCars = cars.length;

                const maintenanceSnapshot = await db.collection('maintenance')
                    .where('userId', '==', currentUser.uid)
                    .get();
                const totalMaintenance = maintenanceSnapshot.size;

                const appointmentsSnapshot = await db.collection('appointments')
                    .where('userId', '==', currentUser.uid)
                    .get();
                const totalAppointments = appointmentsSnapshot.size;

                totalDataElement.textContent =
                    `${totalCars} רכבים, ${totalMaintenance} טיפולים, ${totalAppointments} פגישות`;

                // Get last backup date from localStorage
                const lastBackup = localStorage.getItem('lastBackupDate');
                if (lastBackup) {
                    lastBackupElement.textContent =
                        new Date(lastBackup).toLocaleString('he-IL');
                } else {
                    lastBackupElement.textContent = '-';
                }

            } catch (error) {
                console.error('Error updating backup info:', error);
            }
        }

        // Create Backup (without images)
        async function createBackup() {
            // Check if user has premium (paid subscription) - export restricted to paid users only
            if (!isPremiumUser && !isAdmin) {
                showPremiumModal('גיבוי נתונים');
                return;
            }

            // Rate limiting check for exports
            if (!RateLimiter.canPerform('exportData')) {
                const waitTime = RateLimiter.getTimeUntilReset('exportData');
                alert(`יותר מדי ייצואים. נסה שוב בעוד ${Math.ceil(waitTime / 60)} דקות`);
                return;
            }
            RateLimiter.recordAction('exportData');

            try {
                showBackupProgress(true);
                updateBackupProgress(10, 'אוסף נתונים...');

                // Collect all data
                const backupData = {
                    version: '1.0',
                    exportDate: new Date().toISOString(),
                    userId: currentUser.uid,
                    userEmail: currentUser.email,
                    cars: [],
                    maintenance: [],
                    appointments: [],
                    settings: {}
                };

                updateBackupProgress(30, 'מייצא רכבים...');
                // Get cars (without images)
                backupData.cars = cars.map(car => ({
                    ...car,
                    imageUrl: null // Remove images to keep backup small
                }));

                updateBackupProgress(50, 'מייצא טיפולים...');
                // Get maintenance (without images)
                const maintenanceSnapshot = await db.collection('maintenance')
                    .where('userId', '==', currentUser.uid)
                    .get();

                maintenanceSnapshot.forEach(doc => {
                    const data = doc.data();
                    backupData.maintenance.push({
                        id: doc.id,
                        ...data,
                        images: [], // Remove images
                        createdAt: safeToMillis(data.createdAt),
                        updatedAt: safeToMillis(data.updatedAt)
                    });
                });

                updateBackupProgress(70, 'מייצא פגישות...');
                // Get appointments
                const appointmentsSnapshot = await db.collection('appointments')
                    .where('userId', '==', currentUser.uid)
                    .get();

                appointmentsSnapshot.forEach(doc => {
                    const data = doc.data();
                    backupData.appointments.push({
                        id: doc.id,
                        ...data,
                        createdAt: safeToMillis(data.createdAt)
                    });
                });

                updateBackupProgress(90, 'שומר קובץ...');
                // Get settings
                const settingsDoc = await db.collection('settings').doc(currentUser.uid).get();
                if (settingsDoc.exists) {
                    backupData.settings = settingsDoc.data();
                }

                // Create and download file
                const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `garage-backup-${new Date().toISOString().split('T')[0]}.json`;
                a.click();
                URL.revokeObjectURL(url);

                // Save last backup date
                localStorage.setItem('lastBackupDate', new Date().toISOString());

                updateBackupProgress(100, 'הגיבוי הושלם!');
                setTimeout(() => {
                    showBackupProgress(false);
                    showNotification('הגיבוי נוצר בהצלחה!');
                    updateBackupInfo();
                }, 1000);

            } catch (error) {
                console.error('Error creating backup:', error);
                alert('שגיאה ביצירת גיבוי: ' + error.message);
                showBackupProgress(false);
            }
        }

        // Create Backup with Images
        async function createBackupWithImages() {
            // Check if user has premium (paid subscription) - export restricted to paid users only
            if (!isPremiumUser && !isAdmin) {
                showPremiumModal('גיבוי נתונים עם תמונות');
                return;
            }

            // Rate limiting check for exports
            if (!RateLimiter.canPerform('exportData')) {
                const waitTime = RateLimiter.getTimeUntilReset('exportData');
                alert(`יותר מדי ייצואים. נסה שוב בעוד ${Math.ceil(waitTime / 60)} דקות`);
                return;
            }
            RateLimiter.recordAction('exportData');

            if (!confirm('גיבוי עם תמונות עשוי להיות קובץ גדול מאוד. להמשיך?')) return;

            try {
                showBackupProgress(true);
                updateBackupProgress(10, 'אוסף נתונים...');

                // Same as createBackup but include images
                const backupData = {
                    version: '1.0',
                    exportDate: new Date().toISOString(),
                    userId: currentUser.uid,
                    userEmail: currentUser.email,
                    cars: [],
                    maintenance: [],
                    appointments: [],
                    settings: {}
                };

                updateBackupProgress(30, 'מייצא רכבים עם תמונות...');
                backupData.cars = [...cars]; // Include images

                updateBackupProgress(50, 'מייצא טיפולים עם תמונות...');
                const maintenanceSnapshot = await db.collection('maintenance')
                    .where('userId', '==', currentUser.uid)
                    .get();

                maintenanceSnapshot.forEach(doc => {
                    const data = doc.data();
                    backupData.maintenance.push({
                        id: doc.id,
                        ...data,
                        createdAt: safeToMillis(data.createdAt),
                        updatedAt: safeToMillis(data.updatedAt)
                    });
                });

                updateBackupProgress(70, 'מייצא פגישות...');
                const appointmentsSnapshot = await db.collection('appointments')
                    .where('userId', '==', currentUser.uid)
                    .get();

                appointmentsSnapshot.forEach(doc => {
                    const data = doc.data();
                    backupData.appointments.push({
                        id: doc.id,
                        ...data,
                        createdAt: safeToMillis(data.createdAt)
                    });
                });

                updateBackupProgress(90, 'שומר קובץ...');
                const settingsDoc = await db.collection('settings').doc(currentUser.uid).get();
                if (settingsDoc.exists) {
                    backupData.settings = settingsDoc.data();
                }

                const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `garage-backup-full-${new Date().toISOString().split('T')[0]}.json`;
                a.click();
                URL.revokeObjectURL(url);

                localStorage.setItem('lastBackupDate', new Date().toISOString());

                updateBackupProgress(100, 'הגיבוי הושלם!');
                setTimeout(() => {
                    showBackupProgress(false);
                    showNotification('הגיבוי נוצר בהצלחה!');
                    updateBackupInfo();
                }, 1000);

            } catch (error) {
                console.error('Error creating backup with images:', error);
                alert('שגיאה ביצירת גיבוי: ' + error.message);
                showBackupProgress(false);
            }
        }

        // Show/Hide Backup Progress
        function showBackupProgress(show) {
            const progress = document.getElementById('backupProgress');
            if (!progress) {
                console.warn('Backup progress element not found');
                return;
            }
            if (show) {
                progress.classList.remove('hidden');
            } else {
                progress.classList.add('hidden');
                updateBackupProgress(0, '');
            }
        }

        // Update Backup Progress
        function updateBackupProgress(percent, text) {
            const progressBar = document.getElementById('backupProgressBar');
            const progressText = document.getElementById('backupProgressText');

            if (!progressBar || !progressText) {
                console.warn('Progress elements not found');
                return;
            }

            progressBar.style.width = percent + '%';
            progressText.textContent = text;
        }

        // Handle Restore File
        async function handleRestoreFile(event) {
            const file = event.target.files[0];
            if (!file) return;

            // Check if user is authenticated
            if (!currentUser) {
                alert('❌ שגיאה: נא להתחבר תחילה');
                event.target.value = '';
                return;
            }

            if (!confirm('⚠️ האם אתה בטוח? זה ימחק את כל הנתונים הנוכחיים וישחזר את הגיבוי!')) {
                event.target.value = '';
                return;
            }

            // Ensure backup modal is open
            const backupModal = document.getElementById('backupModal');
            if (backupModal && backupModal.classList.contains('hidden')) {
                openBackupModal();
                // Wait for modal to render
                await new Promise(resolve => setTimeout(resolve, 100));
            }

            try {
                showBackupProgress(true);
                updateBackupProgress(5, 'קורא קובץ...');

                const text = await file.text();
                const backupData = JSON.parse(text);

                // Validate backup
                if (!backupData.version || !backupData.cars) {
                    throw new Error('קובץ גיבוי לא תקין - חסר מידע חיוני');
                }

                // Validate userId matches
                if (backupData.cars.length > 0 && backupData.cars[0].userId !== currentUser.uid) {
                    if (!confirm('⚠️ הגיבוי לא שייך למשתמש הנוכחי. להמשיך בכל זאת?')) {
                        throw new Error('הגיבוי בוטל');
                    }
                }

                updateBackupProgress(10, 'מוחק נתונים ישנים...');

                try {
                    // Delete existing data with better error handling
                    await deleteAllUserData();
                } catch (deleteError) {
                    console.warn('Warning during delete:', deleteError);
                    // Continue even if delete partially fails
                }

                updateBackupProgress(30, 'משחזר רכבים...');
                // Restore cars with userId fix and create mapping
                let carsRestored = 0;
                const plateToCarIdMap = {}; // Map old plate numbers to new car IDs

                for (const car of backupData.cars) {
                    try {
                        const carData = { ...car };
                        const oldPlate = carData.plateNumber;
                        delete carData.id;
                        // Ensure userId is set correctly
                        carData.userId = currentUser.uid;
                        carData.updatedAt = firebase.firestore.FieldValue.serverTimestamp();

                        const docRef = await db.collection('cars').add(carData);
                        plateToCarIdMap[oldPlate] = docRef.id; // Store mapping
                        console.log(`🚗 Car added: ${oldPlate} -> ${docRef.id}`);
                        carsRestored++;
                    } catch (carError) {
                        console.error('Error restoring car:', carError);
                    }
                }

                updateBackupProgress(50, `משחזר טיפולים... (${carsRestored} רכבים)` );
                // Restore maintenance with correct carId
                let maintenanceRestored = 0;
                console.log('📋 Plate to CarId Map:', plateToCarIdMap);

                for (const maintenance of backupData.maintenance) {
                    try {
                        const maintenanceData = { ...maintenance };
                        delete maintenanceData.id;

                        // Map to new carId using plate number
                        const newCarId = plateToCarIdMap[maintenanceData.plateNumber];
                        console.log(`🔧 Maintenance: ${maintenanceData.plateNumber} -> ${newCarId}`);

                        if (newCarId) {
                            maintenanceData.carId = newCarId;
                        } else {
                            console.warn(`⚠️ No carId found for plate: ${maintenanceData.plateNumber}`);
                        }

                        // Ensure userId is set correctly
                        maintenanceData.userId = currentUser.uid;

                        // Convert timestamps back
                        if (maintenanceData.createdAt) {
                            if (typeof maintenanceData.createdAt === 'number') {
                                maintenanceData.createdAt = firebase.firestore.Timestamp.fromMillis(maintenanceData.createdAt);
                            }
                        } else {
                            maintenanceData.createdAt = firebase.firestore.FieldValue.serverTimestamp();
                        }

                        if (maintenanceData.updatedAt) {
                            if (typeof maintenanceData.updatedAt === 'number') {
                                maintenanceData.updatedAt = firebase.firestore.Timestamp.fromMillis(maintenanceData.updatedAt);
                            }
                        } else {
                            maintenanceData.updatedAt = firebase.firestore.FieldValue.serverTimestamp();
                        }

                        await db.collection('maintenance').add(maintenanceData);
                        maintenanceRestored++;
                    } catch (maintenanceError) {
                        console.error('Error restoring maintenance:', maintenanceError);
                    }
                }

                updateBackupProgress(70, `משחזר פגישות... (${maintenanceRestored} טיפולים)`);
                // Restore appointments with correct carId
                let appointmentsRestored = 0;
                for (const appointment of backupData.appointments) {
                    try {
                        const appointmentData = { ...appointment };
                        delete appointmentData.id;

                        // Map to new carId using plate number
                        const newCarId = plateToCarIdMap[appointmentData.plateNumber];
                        console.log(`📅 Appointment: ${appointmentData.plateNumber} -> ${newCarId}`);

                        if (newCarId) {
                            appointmentData.carId = newCarId;
                        } else {
                            console.warn(`⚠️ No carId found for plate: ${appointmentData.plateNumber}`);
                        }

                        // Ensure userId is set correctly
                        appointmentData.userId = currentUser.uid;

                        if (appointmentData.createdAt) {
                            if (typeof appointmentData.createdAt === 'number') {
                                appointmentData.createdAt = firebase.firestore.Timestamp.fromMillis(appointmentData.createdAt);
                            }
                        } else {
                            appointmentData.createdAt = firebase.firestore.FieldValue.serverTimestamp();
                        }

                        await db.collection('appointments').add(appointmentData);
                        appointmentsRestored++;
                    } catch (appointmentError) {
                        console.error('Error restoring appointment:', appointmentError);
                    }
                }

                updateBackupProgress(90, `משחזר הגדרות... (${appointmentsRestored} פגישות)`);
                // Restore settings
                if (backupData.settings) {
                    try {
                        await db.collection('settings').doc(currentUser.uid).set(backupData.settings, { merge: true });
                    } catch (settingsError) {
                        console.error('Error restoring settings:', settingsError);
                    }
                }

                updateBackupProgress(100, '✅ השחזור הושלם!');
                setTimeout(() => {
                    showBackupProgress(false);
                    alert(`✅ השחזור הושלם בהצלחה!

📊 סיכום:
• ${carsRestored} רכבים
• ${maintenanceRestored} טיפולים
• ${appointmentsRestored} פגישות

הדף יתרענן כעת.`);
                    window.location.reload();
                }, 1500);

            } catch (error) {
                console.error('Error restoring backup:', error);
                showBackupProgress(false);

                let errorMsg = 'שגיאה בשחזור גיבוי';
                if (error.code === 'permission-denied') {
                    errorMsg = '❌ שגיאת הרשאות: אין לך הרשאה לגשת לנתונים אלה.\n\nייתכן שהבעיה היא:\n• לא מחובר כמשתמש הנכון\n• הגיבוי שייך למשתמש אחר\n• בעיית הרשאות ב-Firebase';
                } else if (error.message) {
                    errorMsg = error.message;
                }

                alert(errorMsg);
            }

            event.target.value = '';
        }

        // Delete All User Data
        async function deleteAllUserData() {
            if (!currentUser) {
                throw new Error('No user authenticated');
            }

            const deletePromises = [];

            try {
                // Delete cars
                const carsSnapshot = await db.collection('cars')
                    .where('userId', '==', currentUser.uid)
                    .get();

                carsSnapshot.forEach(doc => {
                    deletePromises.push(
                        db.collection('cars').doc(doc.id).delete()
                            .catch(err => console.warn('Failed to delete car:', doc.id, err))
                    );
                });
            } catch (error) {
                console.error('Error querying cars:', error);
            }

            try {
                // Delete maintenance
                const maintenanceSnapshot = await db.collection('maintenance')
                    .where('userId', '==', currentUser.uid)
                    .get();

                maintenanceSnapshot.forEach(doc => {
                    deletePromises.push(
                        db.collection('maintenance').doc(doc.id).delete()
                            .catch(err => console.warn('Failed to delete maintenance:', doc.id, err))
                    );
                });
            } catch (error) {
                console.error('Error querying maintenance:', error);
            }

            try {
                // Delete appointments
                const appointmentsSnapshot = await db.collection('appointments')
                    .where('userId', '==', currentUser.uid)
                    .get();

                appointmentsSnapshot.forEach(doc => {
                    deletePromises.push(
                        db.collection('appointments').doc(doc.id).delete()
                            .catch(err => console.warn('Failed to delete appointment:', doc.id, err))
                    );
                });
            } catch (error) {
                console.error('Error querying appointments:', error);
            }

            // Wait for all deletions to complete (or fail)
            await Promise.allSettled(deletePromises);
        }

        // ==========================================
        // AUTOMATIC BACKUP SYSTEM - PROFESSIONAL
        // ==========================================

        // Simple encryption/decryption (for backup security) - UTF-8 Compatible
        function encryptData(data, password) {
            const jsonStr = JSON.stringify(data);
            // Convert to UTF-8 bytes first
            const utf8Bytes = new TextEncoder().encode(jsonStr);
            let encrypted = '';
            for (let i = 0; i < utf8Bytes.length; i++) {
                encrypted += String.fromCharCode(utf8Bytes[i] ^ password.charCodeAt(i % password.length));
            }
            // Use base64 encoding that works with all characters
            return btoa(unescape(encodeURIComponent(encrypted)));
        }

        function decryptData(encrypted, password) {
            // Decode from base64
            const decoded = decodeURIComponent(escape(atob(encrypted)));
            let decryptedBytes = [];
            for (let i = 0; i < decoded.length; i++) {
                decryptedBytes.push(decoded.charCodeAt(i) ^ password.charCodeAt(i % password.length));
            }
            // Convert bytes back to UTF-8 string
            const decrypted = new TextDecoder().decode(new Uint8Array(decryptedBytes));
            return JSON.parse(decrypted);
        }

        // Compress data (simple compression)
        function compressBackup(data) {
            const jsonStr = JSON.stringify(data);
            // Remove unnecessary whitespace
            return jsonStr.replace(/\s+/g, ' ');
        }

        // Auto backup configuration
        const AUTO_BACKUP_CONFIG = {
            enabled: true,
            dayOfWeek: 5, // Friday (0=Sunday, 5=Friday)
            hour: 23, // 11 PM
            minute: 0,
            encryptionEnabled: true
        };

        // Get user's encryption password
        function getBackupPassword() {
            const saved = localStorage.getItem('backupPassword');
            if (saved) return saved;

            const password = prompt('🔒 הגדר סיסמת הצפנה לגיבוי (זכור אותה!)');
            if (password && password.length >= 4) {
                localStorage.setItem('backupPassword', password);
                return password;
            }
            return null;
        }

        // Save backup to IndexedDB with proper version handling
        async function saveBackupLocally(backupData) {
            if (!currentUser) {
                console.error('No user logged in');
                return;
            }

            const dbName = `DRVN_Backups_${currentUser.uid}`;

            return new Promise((resolve, reject) => {
                const request = indexedDB.open(dbName, 1);

                request.onerror = () => {
                    console.error('IndexedDB error:', request.error);
                    reject(request.error);
                };

                request.onupgradeneeded = (event) => {
                    const db = event.target.result;
                    if (!db.objectStoreNames.contains('backups')) {
                        const objectStore = db.createObjectStore('backups', { keyPath: 'id' });
                        objectStore.createIndex('date', 'date', { unique: false });
                    }
                };

                request.onsuccess = async (event) => {
                    const db = event.target.result;

                    try {
                        // First, get all existing backups
                        const getAllTransaction = db.transaction(['backups'], 'readonly');
                        const getAllStore = getAllTransaction.objectStore('backups');
                        const getAllRequest = getAllStore.getAll();

                        getAllRequest.onsuccess = () => {
                            const allBackups = getAllRequest.result;

                            // Sort by date (newest first)
                            allBackups.sort((a, b) => new Date(b.date) - new Date(a.date));

                            // If we have 4 or more backups, delete the oldest ones
                            if (allBackups.length >= 4) {
                                const transaction = db.transaction(['backups'], 'readwrite');
                                const store = transaction.objectStore('backups');

                                // Keep only the 3 newest, delete the rest
                                for (let i = 3; i < allBackups.length; i++) {
                                    store.delete(allBackups[i].id);
                                }

                                transaction.oncomplete = () => {
                                    // Now add the new backup
                                    addNewBackup(db, backupData, resolve, reject);
                                };

                                transaction.onerror = () => {
                                    // Even if deletion fails, try to add new backup
                                    addNewBackup(db, backupData, resolve, reject);
                                };
                            } else {
                                // Less than 4 backups, just add the new one
                                addNewBackup(db, backupData, resolve, reject);
                            }
                        };

                        getAllRequest.onerror = () => {
                            // If getting fails, just add the new backup
                            addNewBackup(db, backupData, resolve, reject);
                        };

                    } catch (error) {
                        db.close();
                        reject(error);
                    }
                };

                function addNewBackup(db, backupData, resolve, reject) {
                    try {
                        const transaction = db.transaction(['backups'], 'readwrite');
                        const store = transaction.objectStore('backups');

                        const backup = {
                            id: Date.now(),
                            date: new Date().toISOString(),
                            data: backupData,
                            size: JSON.stringify(backupData).length,
                            carsCount: backupData.cars ? backupData.cars.length : 0,
                            maintenanceCount: backupData.maintenance ? backupData.maintenance.length : 0,
                            userId: currentUser.uid // Add userId
                        };

                        const addRequest = store.add(backup);

                        addRequest.onsuccess = () => {
                            db.close();
                            console.log(`✅ Backup saved for user ${currentUser.uid}. Total backups: up to 4`);
                            resolve(backup);
                        };

                        addRequest.onerror = () => {
                            db.close();
                            reject(addRequest.error);
                        };

                        transaction.onerror = () => {
                            db.close();
                            reject(transaction.error);
                        };
                    } catch (error) {
                        db.close();
                        reject(error);
                    }
                }
            });
        }

        // Clean old backups (keep only last 4)
        // Get all saved backups with proper error handling
        async function getSavedBackups() {
            if (!currentUser) {
                console.warn('No user logged in');
                return [];
            }

            const dbName = `DRVN_Backups_${currentUser.uid}`;

            return new Promise((resolve, reject) => {
                const request = indexedDB.open(dbName, 1);

                request.onerror = () => {
                    console.error('Error opening database:', request.error);
                    resolve([]); // Return empty array on error
                };

                request.onupgradeneeded = (event) => {
                    const db = event.target.result;
                    if (!db.objectStoreNames.contains('backups')) {
                        const objectStore = db.createObjectStore('backups', { keyPath: 'id' });
                        objectStore.createIndex('date', 'date', { unique: false });
                    }
                };

                request.onsuccess = (event) => {
                    const db = event.target.result;

                    if (!db.objectStoreNames.contains('backups')) {
                        db.close();
                        resolve([]);
                        return;
                    }

                    try {
                        const transaction = db.transaction(['backups'], 'readonly');
                        const store = transaction.objectStore('backups');
                        const getAllRequest = store.getAll();

                        getAllRequest.onsuccess = () => {
                            const backups = getAllRequest.result || [];
                            backups.sort((a, b) => new Date(b.date) - new Date(a.date));
                            db.close();
                            resolve(backups);
                        };

                        getAllRequest.onerror = () => {
                            db.close();
                            resolve([]);
                        };
                    } catch (error) {
                        db.close();
                        resolve([]);
                    }
                };
            });
        }

        // Create cloud backup
        async function createCloudBackup() {
            // Check if user has premium (paid subscription) - export restricted to paid users only
            if (!isPremiumUser && !isAdmin) {
                showPremiumModal('גיבוי לענן');
                return;
            }

            // Rate limiting check for exports
            if (!RateLimiter.canPerform('exportData')) {
                const waitTime = RateLimiter.getTimeUntilReset('exportData');
                alert(`יותר מדי ייצואים. נסה שוב בעוד ${Math.ceil(waitTime / 60)} דקות`);
                return;
            }
            RateLimiter.recordAction('exportData');

            try {
                showBackupProgress(true);
                updateBackupProgress(20, 'מתחבר לענן...');

                const functions = firebase.functions();
                const manualCloudBackup = functions.httpsCallable('manualCloudBackup');

                updateBackupProgress(50, 'בודק שינויים...');
                const result = await manualCloudBackup();

                if (result.data && result.data.success) {
                    updateBackupProgress(100, 'הושלם!');

                    setTimeout(() => {
                        showBackupProgress(false);
                        const stats = result.data.stats;

                        if (result.data.skipped) {
                            // No changes - backup skipped
                            showNotification('ℹ️ אין שינויים מאז הגיבוי האחרון');
                            alert(`ℹ️ אין צורך בגיבוי חדש\n\nלא בוצעו שינויים מאז הגיבוי האחרון.\n\n📊 נתונים נוכחיים:\n🚗 ${stats.carsCount} רכבים\n🔧 ${stats.maintenanceCount} טיפולים\n📅 ${stats.appointmentsCount} פגישות`);
                        } else {
                            // Backup created
                            showNotification('✅ הגיבוי לענן הושלם בהצלחה!');
                            alert(`☁️ גיבוי לענן הושלם!\n\n📊 סיכום:\n🚗 ${stats.carsCount} רכבים\n🔧 ${stats.maintenanceCount} טיפולים\n📅 ${stats.appointmentsCount} פגישות`);
                        }
                    }, 500);
                } else {
                    throw new Error('Backup failed');
                }
            } catch (error) {
                console.error('Error creating cloud backup:', error);
                showBackupProgress(false);
                alert('שגיאה ביצירת גיבוי בענן: ' + error.message);
            }
        }
        window.createCloudBackup = createCloudBackup;

        // Create automatic backup (simplified with localStorage fallback)
        async function createAutoBackup(isManual = false) {
            try {
                if (!isManual) {
                    console.log('🔄 Starting automatic backup...');
                }

                // Collect all data
                const backupData = {
                    version: '2.0',
                    type: isManual ? 'manual' : 'automatic',
                    exportDate: new Date().toISOString(),
                    userId: currentUser.uid,
                    userEmail: currentUser.email,
                    cars: [],
                    maintenance: [],
                    appointments: [],
                    settings: {}
                };

                // Get cars (without images to keep size small)
                backupData.cars = cars.map(car => ({
                    ...car,
                    imageUrl: null
                }));

                // Get maintenance
                const maintenanceSnapshot = await db.collection('maintenance')
                    .where('userId', '==', currentUser.uid)
                    .get();

                maintenanceSnapshot.forEach(doc => {
                    const data = doc.data();
                    backupData.maintenance.push({
                        id: doc.id,
                        ...data,
                        images: [],
                        createdAt: safeToMillis(data.createdAt),
                        updatedAt: safeToMillis(data.updatedAt)
                    });
                });

                // Get appointments
                const appointmentsSnapshot = await db.collection('appointments')
                    .where('userId', '==', currentUser.uid)
                    .get();

                appointmentsSnapshot.forEach(doc => {
                    const data = doc.data();
                    backupData.appointments.push({
                        id: doc.id,
                        ...data,
                        createdAt: safeToMillis(data.createdAt)
                    });
                });

                // Get settings
                const settingsDoc = await db.collection('settings').doc(currentUser.uid).get();
                if (settingsDoc.exists) {
                    backupData.settings = settingsDoc.data();
                }

                // Try IndexedDB first, fallback to localStorage
                try {
                    await saveBackupLocally(backupData);
                } catch (indexedDBError) {
                    console.warn('IndexedDB failed, using localStorage:', indexedDBError);
                    // Fallback to localStorage (simpler but limited to ~5-10MB)
                    saveBackupToLocalStorage(backupData);
                }

                // Update last backup date
                localStorage.setItem('lastAutoBackupDate', new Date().toISOString());

                // Log backup history (per user)
                const historyKey = `backupHistory_${currentUser.uid}`;
                const history = JSON.parse(localStorage.getItem(historyKey) || '[]');
                history.unshift({
                    date: new Date().toISOString(),
                    type: isManual ? 'manual' : 'automatic',
                    carsCount: backupData.cars.length,
                    size: JSON.stringify(backupData).length
                });
                // Keep only last 10 records
                if (history.length > 10) history.length = 10;
                localStorage.setItem(historyKey, JSON.stringify(history));

                if (isManual) {
                    showNotification('✅ הגיבוי נוצר בהצלחה!');
                } else {
                    console.log('✅ Automatic backup completed successfully');
                }

                updateBackupInfo();

                return true;
            } catch (error) {
                console.error('Error creating auto backup:', error);
                if (isManual) {
                    alert('שגיאה ביצירת גיבוי: ' + error.message);
                }
                return false;
            }
        }

        // LocalStorage backup fallback (simpler and more reliable)
        function saveBackupToLocalStorage(backupData) {
            if (!currentUser) {
                console.error('No user logged in');
                return;
            }

            const storageKey = `localBackups_${currentUser.uid}`;

            try {
                const backups = JSON.parse(localStorage.getItem(storageKey) || '[]');

                const backup = {
                    id: Date.now(),
                    date: new Date().toISOString(),
                    data: backupData,
                    size: JSON.stringify(backupData).length,
                    carsCount: backupData.cars ? backupData.cars.length : 0,
                    maintenanceCount: backupData.maintenance ? backupData.maintenance.length : 0,
                    userId: currentUser.uid
                };

                backups.unshift(backup);

                // Keep only last 4 backups
                if (backups.length > 4) {
                    backups.length = 4;
                }

                const compressed = JSON.stringify(backups);
                localStorage.setItem(storageKey, compressed);

                console.log(`✅ Backup saved to localStorage for user ${currentUser.uid}. Total: ${backups.length}/4`);
            } catch (error) {
                console.error('LocalStorage backup failed:', error);
                // If localStorage is full, remove old backups and retry
                if (error.name === 'QuotaExceededError') {
                    const backups = JSON.parse(localStorage.getItem(storageKey) || '[]');
                    // Keep only last 2 to free space
                    if (backups.length > 2) {
                        backups.length = 2;
                        localStorage.setItem(storageKey, JSON.stringify(backups));
                    }
                    saveBackupToLocalStorage(backupData);
                }
            }
        }

        // Get backups from localStorage
        function getLocalStorageBackups() {
            if (!currentUser) {
                return [];
            }

            const storageKey = `localBackups_${currentUser.uid}`;

            try {
                return JSON.parse(localStorage.getItem(storageKey) || '[]');
            } catch (error) {
                console.error('Error reading localStorage backups:', error);
                return [];
            }
        }

        // Check if backup is needed today
        function shouldRunBackup() {
            const now = new Date();
            const dayOfWeek = now.getDay();
            const hour = now.getHours();
            const minute = now.getMinutes();

            // Check if it's the right day and time
            if (dayOfWeek !== AUTO_BACKUP_CONFIG.dayOfWeek) return false;
            if (hour !== AUTO_BACKUP_CONFIG.hour) return false;
            if (minute !== AUTO_BACKUP_CONFIG.minute) return false;

            // Check if already backed up today
            const lastBackup = localStorage.getItem('lastAutoBackupDate');
            if (lastBackup) {
                const lastDate = new Date(lastBackup);
                const today = new Date();
                if (lastDate.toDateString() === today.toDateString()) {
                    return false; // Already backed up today
                }
            }

            return true;
        }

        // Start automatic backup scheduler
        function startAutoBackupScheduler() {
            if (!AUTO_BACKUP_CONFIG.enabled) return;

            // Update backup info immediately
            updateAutoBackupInfo();

            // Update info every minute
            setInterval(() => {
                updateAutoBackupInfo();
            }, 60000);

            // Check for backup every minute
            setInterval(() => {
                if (shouldRunBackup()) {
                    createAutoBackup(false);
                }
            }, 60000);

            console.log('🕐 Auto backup scheduler started');
            console.log(`📅 Next backup: Friday at ${AUTO_BACKUP_CONFIG.hour}:${AUTO_BACKUP_CONFIG.minute.toString().padStart(2, '0')}`);
        }

        // Update auto backup information display
        function updateAutoBackupInfo() {
            try {
                // Last backup time - simplified
                const lastBackup = localStorage.getItem('lastAutoBackupDate');
                const lastBackupEl = document.getElementById('lastAutoBackupTime');
                if (lastBackupEl) {
                    if (lastBackup) {
                        const date = new Date(lastBackup);
                        const now = new Date();
                        const days = Math.floor((now - date) / (1000 * 60 * 60 * 24));

                        if (days > 0) {
                            lastBackupEl.textContent = `לפני ${days} ימים`;
                        } else {
                            lastBackupEl.textContent = 'היום';
                        }
                    } else {
                        lastBackupEl.textContent = 'טרם בוצע';
                    }
                }

                // Time until backup - simplified
                const timeUntilEl = document.getElementById('timeUntilBackup');
                if (timeUntilEl) {
                    const now = new Date();
                    const dayOfWeek = now.getDay();
                    const daysUntilFriday = (5 - dayOfWeek + 7) % 7 || 7;

                    if (daysUntilFriday > 1) {
                        timeUntilEl.textContent = `${daysUntilFriday} ימים`;
                    } else if (daysUntilFriday === 1) {
                        timeUntilEl.textContent = 'מחר';
                    } else {
                        timeUntilEl.textContent = 'היום';
                    }
                }
            } catch (error) {
                console.error('Error updating auto backup info:', error);
            }
        }

        // Get next backup date
        function getNextBackupDate() {
            const now = new Date();
            let next = new Date();

            // Set to next Friday at 23:00
            const daysUntilFriday = (5 - now.getDay() + 7) % 7;
            next.setDate(now.getDate() + daysUntilFriday);
            next.setHours(AUTO_BACKUP_CONFIG.hour, AUTO_BACKUP_CONFIG.minute, 0, 0);

            // If Friday 23:00 already passed this week, go to next week
            if (next <= now) {
                next.setDate(next.getDate() + 7);
            }

            return next;
        }

        // Test auto backup now (forces backup)

        // Show backup list modal
        async function showBackupList() {
            try {
                // Try to get LOCAL backups from both sources
                let indexedBackups = [];
                let localBackups = [];

                try {
                    indexedBackups = await getSavedBackups();
                } catch (e) {
                    console.warn('IndexedDB not available:', e);
                }

                try {
                    localBackups = getLocalStorageBackups();
                } catch (e) {
                    console.warn('LocalStorage not available:', e);
                }

                // Combine and deduplicate local backups
                const allLocalBackups = [...indexedBackups, ...localBackups];
                const uniqueLocalBackups = allLocalBackups.filter((backup, index, self) =>
                    index === self.findIndex((b) => b.id === backup.id)
                );
                uniqueLocalBackups.sort((a, b) => new Date(b.date) - new Date(a.date));

                const localBackupsList = uniqueLocalBackups;

                // Try to get CLOUD backups
                let cloudBackups = [];
                try {
                    const functions = firebase.functions();
                    const getUserBackups = functions.httpsCallable('getUserBackups');
                    const result = await getUserBackups();
                    if (result.data && result.data.backups) {
                        cloudBackups = result.data.backups;
                    }
                    console.log('☁️ Cloud backups loaded:', cloudBackups.length);
                } catch (e) {
                    console.warn('Could not load cloud backups:', e);
                }

                // Get history for current user only
                const historyKey = currentUser ? `backupHistory_${currentUser.uid}` : 'backupHistory';
                const history = JSON.parse(localStorage.getItem(historyKey) || '[]');

                const totalBackups = localBackupsList.length + cloudBackups.length;

                let html = `
                    <div class="space-y-4">
                        <div class="bg-gradient-to-r from-amber-50 to-orange-50 p-4 rounded-lg border-2 border-amber-200">
                            <div class="flex items-center justify-between mb-2">
                                <h3 class="text-lg font-bold text-amber-900">📊 סטטיסטיקות גיבוי</h3>
                            </div>
                            <div class="grid grid-cols-3 gap-2 text-sm">
                                <div class="bg-white p-2 rounded-lg text-center">
                                    <div class="text-gray-600 text-xs">מקומי</div>
                                    <div class="text-xl font-bold text-amber-600">${localBackupsList.length}</div>
                                </div>
                                <div class="bg-white p-2 rounded-lg text-center">
                                    <div class="text-gray-600 text-xs">ענן ☁️</div>
                                    <div class="text-xl font-bold text-blue-600">${cloudBackups.length}</div>
                                </div>
                                <div class="bg-white p-2 rounded-lg text-center">
                                    <div class="text-gray-600 text-xs">גיבוי הבא</div>
                                    <div class="text-sm font-bold text-green-600">יום ו׳</div>
                                </div>
                            </div>
                        </div>
                `;

                // Cloud Backups Section
                if (cloudBackups.length > 0) {
                    html += `
                        <div class="bg-gradient-to-r from-blue-50 to-indigo-50 p-4 rounded-lg border-2 border-blue-200">
                            <h3 class="text-lg font-bold mb-3 text-blue-900">☁️ גיבויים בענן (אוטומטיים)</h3>
                            <div class="space-y-2">
                    `;

                    cloudBackups.forEach((backup, index) => {
                        const date = backup.backupDate ? new Date(backup.backupDate._seconds * 1000) : new Date();
                        const stats = backup.stats || {};
                        html += `
                            <div class="flex items-center justify-between p-3 bg-white rounded-lg border hover:border-blue-500 transition">
                                <div class="flex-1">
                                    <div class="font-bold text-blue-800">${index === 0 ? '🌟 ' : '☁️ '}גיבוי ענן ${index + 1}</div>
                                    <div class="text-sm text-gray-600">${date.toLocaleString('he-IL')}</div>
                                    <div class="text-xs text-gray-500">${stats.carsCount || 0} רכבים • ${stats.maintenanceCount || 0} טיפולים • ${stats.appointmentsCount || 0} פגישות</div>
                                </div>
                                <button onclick="restoreCloudBackup('${backup.id}')" class="bg-blue-500 hover:bg-blue-600 text-white px-3 py-2 rounded-lg text-sm font-bold">
                                    שחזר
                                </button>
                            </div>
                        `;
                    });

                    html += `
                            </div>
                        </div>
                    `;
                } else {
                    html += `
                        <div class="bg-blue-50 p-4 rounded-lg border border-blue-200 text-center">
                            <p class="text-blue-700">☁️ אין גיבויים בענן עדיין</p>
                            <p class="text-sm text-blue-600">הגיבוי האוטומטי יתבצע ביום שישי הקרוב בשעה 23:00</p>
                        </div>
                    `;
                }

                // Local Backups Section
                if (localBackupsList.length > 0) {
                    html += `
                        <div class="bg-white p-4 rounded-lg border-2">
                            <h3 class="text-lg font-bold mb-3">📱 גיבויים מקומיים</h3>
                            <div class="space-y-2">
                    `;

                    localBackupsList.forEach((backup, index) => {
                        const date = new Date(backup.date);
                        const size = (backup.size / 1024).toFixed(2);
                        html += `
                            <div class="flex items-center justify-between p-3 bg-gray-50 rounded-lg border hover:border-amber-500 transition">
                                <div class="flex-1">
                                    <div class="font-bold">${index === 0 ? '🌟 ' : '📱 '}גיבוי ${index + 1}</div>
                                    <div class="text-sm text-gray-600">${date.toLocaleString('he-IL')}</div>
                                    <div class="text-xs text-gray-500">${backup.carsCount} רכבים • ${size} KB</div>
                                </div>
                                <button onclick="restoreBackup(${backup.id})" class="bg-green-500 hover:bg-green-600 text-white px-3 py-2 rounded-lg text-sm font-bold">
                                    שחזר
                                </button>
                            </div>
                        `;
                    });

                    html += `
                            </div>
                        </div>
                    `;
                }

                if (history.length > 0) {
                    html += `
                        <div class="bg-white p-4 rounded-lg border-2">
                            <h3 class="text-lg font-bold mb-3">📜 היסטוריית גיבויים</h3>
                            <div class="space-y-1 max-h-48 overflow-y-auto">
                    `;

                    history.slice(0, 10).forEach(record => {
                        const date = new Date(record.date);
                        const typeIcon = record.type === 'manual' ? '👤' : '🤖';
                        const typeName = record.type === 'manual' ? 'ידני' : 'אוטומטי';
                        html += `
                            <div class="flex items-center justify-between text-sm p-2 hover:bg-gray-50 rounded">
                                <div class="flex items-center gap-2">
                                    <span>${typeIcon}</span>
                                    <span>${date.toLocaleDateString('he-IL')} ${date.toLocaleTimeString('he-IL', {hour: '2-digit', minute: '2-digit'})}</span>
                                </div>
                                <div class="text-gray-600">${typeName} • ${record.carsCount} רכבים</div>
                            </div>
                        `;
                    });

                    html += `
                            </div>
                        </div>
                    `;
                }

                html += `
                    </div>
                `;

                // Show in a modal (reuse backup modal)
                const modal = document.getElementById('backupModal');
                if (!modal) {
                    console.error('Modal not found');
                    return;
                }

                // Get content div by ID
                let contentDiv = document.getElementById('backupModalContent');

                if (!contentDiv) {
                    console.error('Content div not found');
                    alert('שגיאה: לא ניתן להציג את רשימת הגיבויים');
                    return;
                }

                // Save original content globally (only once)
                if (!window.backupModalOriginalContent) {
                    window.backupModalOriginalContent = contentDiv.innerHTML;
                    console.log('✅ Original content saved');
                }
                const originalContent = window.backupModalOriginalContent;

                contentDiv.innerHTML = html;

                // Add modal-open class
                document.body.classList.add('modal-open');
                modal.classList.remove('hidden');

                // Add buttons container
                const buttonsDiv = document.createElement('div');
                buttonsDiv.className = 'mt-4 flex gap-3';

                // Back button
                const backBtn = document.createElement('button');
                backBtn.className = 'flex-1 bg-gray-500 hover:bg-gray-600 active:bg-gray-700 text-white py-3 rounded-lg font-bold transition';
                backBtn.textContent = '← חזור';
                backBtn.onclick = () => {
                    const contentDiv = document.getElementById('backupModalContent');
                    if (contentDiv && originalContent) {
                        contentDiv.innerHTML = originalContent;
                        console.log('✅ Returned to main backup screen');
                    }
                    // Re-initialize any event listeners if needed
                    setTimeout(() => {
                        try {
                            updateAutoBackupInfo();
                        } catch (e) {
                            console.error('Error updating info:', e);
                        }
                    }, 100);
                };

                // Close button
                const closeBtn = document.createElement('button');
                closeBtn.className = 'flex-1 bg-red-500 hover:bg-red-600 active:bg-red-700 text-white py-3 rounded-lg font-bold transition';
                closeBtn.textContent = '✕ סגור';
                closeBtn.onclick = () => {
                    closeBackupModal();
                };

                buttonsDiv.appendChild(backBtn);
                buttonsDiv.appendChild(closeBtn);
                contentDiv.appendChild(buttonsDiv);

            } catch (error) {
                console.error('Error showing backup list:', error);
                alert('שגיאה בטעינת רשימת גיבויים');
            }
        }

        // Restore backup from IndexedDB or localStorage
        // Restore cloud backup
        async function restoreCloudBackup(backupId) {
            if (!confirm('⚠️ האם אתה בטוח שברצונך לשחזר גיבוי זה מהענן?\n\n💡 הנתונים מהגיבוי יתווספו לנתונים הקיימים במערכת.')) {
                return;
            }

            try {
                showBackupProgress(true);
                updateBackupProgress(10, 'מוריד גיבוי מהענן...');

                const functions = firebase.functions();
                const restoreBackupFn = functions.httpsCallable('restoreBackup');
                const result = await restoreBackupFn({ backupId: backupId });

                if (!result.data || !result.data.success) {
                    throw new Error('Failed to get backup from cloud');
                }

                const backupData = result.data.data;
                const stats = result.data.stats;

                updateBackupProgress(30, 'בודק רכבים קיימים...');

                // Check for existing cars to prevent duplicates
                const existingCarsSnapshot = await db.collection('cars')
                    .where('userId', '==', currentUser.uid)
                    .get();

                const existingPlateNumbers = new Set();
                existingCarsSnapshot.forEach(doc => {
                    const car = doc.data();
                    if (car.plateNumber) {
                        existingPlateNumbers.add(car.plateNumber);
                    }
                });

                updateBackupProgress(50, 'משחזר רכבים...');
                let carsAdded = 0;
                let carsSkipped = 0;

                for (const car of backupData.cars || []) {
                    const carData = { ...car };
                    const plateNumber = carData.plateNumber;

                    if (existingPlateNumbers.has(plateNumber)) {
                        carsSkipped++;
                        continue;
                    }

                    delete carData.id;
                    carData.userId = currentUser.uid;
                    carData.updatedAt = firebase.firestore.FieldValue.serverTimestamp();

                    await db.collection('cars').add(carData);
                    carsAdded++;
                }

                updateBackupProgress(70, 'משחזר טיפולים...');
                let maintenanceAdded = 0;

                for (const maintenance of backupData.maintenance || []) {
                    const maintenanceData = { ...maintenance };
                    delete maintenanceData.id;
                    maintenanceData.userId = currentUser.uid;
                    maintenanceData.updatedAt = firebase.firestore.FieldValue.serverTimestamp();

                    await db.collection('maintenance').add(maintenanceData);
                    maintenanceAdded++;
                }

                updateBackupProgress(90, 'משחזר פגישות...');
                let appointmentsAdded = 0;

                for (const appointment of backupData.appointments || []) {
                    const appointmentData = { ...appointment };
                    delete appointmentData.id;
                    appointmentData.userId = currentUser.uid;
                    appointmentData.updatedAt = firebase.firestore.FieldValue.serverTimestamp();

                    await db.collection('appointments').add(appointmentData);
                    appointmentsAdded++;
                }

                updateBackupProgress(100, 'הושלם!');

                setTimeout(() => {
                    showBackupProgress(false);
                    showNotification('✅ הגיבוי מהענן שוחזר בהצלחה!');

                    let message = '✅ הגיבוי מהענן שוחזר בהצלחה!\n\n📊 סיכום:\n';
                    message += `🚗 רכבים: ${carsAdded} נוספו, ${carsSkipped} דולגו (כבר קיימים)\n`;
                    message += `🔧 טיפולים: ${maintenanceAdded} נוספו\n`;
                    message += `📅 פגישות: ${appointmentsAdded} נוספו`;
                    alert(message);

                    loadCars();
                    closeBackupModal();
                }, 500);

            } catch (error) {
                console.error('Error restoring cloud backup:', error);
                showBackupProgress(false);
                alert('שגיאה בשחזור גיבוי מהענן: ' + error.message);
            }
        }
        window.restoreCloudBackup = restoreCloudBackup;

        async function restoreBackup(backupId) {
            if (!confirm('⚠️ האם אתה בטוח שברצונך לשחזר גיבוי זה?\n\n💡 הנתונים מהגיבוי יתווספו לנתונים הקיימים במערכת.')) {
                return;
            }

            try {
                // Try to get the backup from both sources
                let backup = null;

                try {
                    const indexedBackups = await getSavedBackups();
                    backup = indexedBackups.find(b => b.id === backupId);
                    console.log('Found in IndexedDB:', backup ? 'yes' : 'no');
                } catch (e) {
                    console.warn('IndexedDB not available:', e);
                }

                if (!backup) {
                    try {
                        const localBackups = getLocalStorageBackups();
                        backup = localBackups.find(b => b.id === backupId);
                        console.log('Found in localStorage:', backup ? 'yes' : 'no');
                    } catch (e) {
                        console.warn('LocalStorage not available:', e);
                    }
                }

                if (!backup) {
                    alert('גיבוי לא נמצא');
                    console.error('Backup not found with ID:', backupId);
                    return;
                }

                showBackupProgress(true);
                updateBackupProgress(10, 'טוען גיבוי...');

                let backupData = backup.data;

                // Decrypt if needed
                if (typeof backupData === 'string') {
                    const password = localStorage.getItem('backupPassword');
                    if (password) {
                        try {
                            backupData = decryptData(backupData, password);
                        } catch (e) {
                            const userPassword = prompt('🔒 הזן סיסמת הצפנה:');
                            if (!userPassword) {
                                showBackupProgress(false);
                                return;
                            }
                            backupData = decryptData(backupData, userPassword);
                        }
                    }
                }

                updateBackupProgress(30, 'בודק רכבים קיימים...');
                // Check for existing cars to prevent duplicates
                const existingCarsSnapshot = await db.collection('cars')
                    .where('userId', '==', currentUser.uid)
                    .get();

                const existingPlateNumbers = new Set();
                existingCarsSnapshot.forEach(doc => {
                    const car = doc.data();
                    if (car.plateNumber) {
                        existingPlateNumbers.add(car.plateNumber);
                    }
                });

                console.log(`Found ${existingPlateNumbers.size} existing cars`);

                // Create mapping for plate numbers to new car IDs
                const plateToCarIdMap = {};

                updateBackupProgress(50, 'משחזר רכבים...');
                let carsAdded = 0;
                let carsSkipped = 0;

                for (const car of backupData.cars) {
                    const carData = { ...car };
                    const plateNumber = carData.plateNumber;

                    // Check if car already exists
                    if (existingPlateNumbers.has(plateNumber)) {
                        console.log(`⚠️ Car ${plateNumber} already exists - skipping`);
                        carsSkipped++;
                        continue;
                    }

                    delete carData.id;
                    carData.userId = currentUser.uid;
                    carData.updatedAt = firebase.firestore.FieldValue.serverTimestamp();

                    const docRef = await db.collection('cars').add(carData);
                    plateToCarIdMap[plateNumber] = docRef.id;
                    console.log(`🚗 Car added: ${plateNumber} -> ${docRef.id}`);
                    carsAdded++;
                }

                updateBackupProgress(70, 'משחזר טיפולים...');
                for (const maintenance of backupData.maintenance) {
                    const maintenanceData = { ...maintenance };
                    delete maintenanceData.id;

                    // Map to new carId
                    const newCarId = plateToCarIdMap[maintenanceData.plateNumber];
                    if (newCarId) {
                        maintenanceData.carId = newCarId;
                    }
                    maintenanceData.userId = currentUser.uid;

                    if (maintenanceData.createdAt) {
                        maintenanceData.createdAt = firebase.firestore.Timestamp.fromMillis(maintenanceData.createdAt);
                    }
                    if (maintenanceData.updatedAt) {
                        maintenanceData.updatedAt = firebase.firestore.Timestamp.fromMillis(maintenanceData.updatedAt);
                    }

                    await db.collection('maintenance').add(maintenanceData);
                }

                updateBackupProgress(90, 'משחזר פגישות...');
                for (const appointment of backupData.appointments) {
                    const appointmentData = { ...appointment };
                    delete appointmentData.id;

                    // Map to new carId
                    const newCarId = plateToCarIdMap[appointmentData.plateNumber];
                    if (newCarId) {
                        appointmentData.carId = newCarId;
                    }
                    appointmentData.userId = currentUser.uid;

                    if (appointmentData.createdAt) {
                        appointmentData.createdAt = firebase.firestore.Timestamp.fromMillis(appointmentData.createdAt);
                    } else {
                        appointmentData.createdAt = firebase.firestore.FieldValue.serverTimestamp();
                    }

                    await db.collection('appointments').add(appointmentData);
                    console.log(`📅 Appointment restored for: ${appointmentData.plateNumber}`);
                }

                updateBackupProgress(100, 'השחזור הושלם!');
                setTimeout(() => {
                    showBackupProgress(false);
                    showNotification('✅ הגיבוי שוחזר בהצלחה!');

                    let message = '✅ הגיבוי שוחזר בהצלחה!\n\n📊 סיכום:\n';
                    message += `• ${carsAdded} רכבים נוספו\n`;
                    if (carsSkipped > 0) {
                        message += `• ${carsSkipped} רכבים קיימים דולגו (למניעת כפילויות)\n`;
                    }

                    alert(message);
                    closeBackupModal();
                    loadCars();
                }, 1500);

            } catch (error) {
                console.error('Error restoring backup:', error);
                alert('שגיאה בשחזור גיבוי: ' + error.message);
                showBackupProgress(false);
            }
        }

        // Initialize auto backup system when app loads
        if (typeof auth !== 'undefined' && auth) auth.onAuthStateChanged(user => {
            if (user) {
                // Start scheduler after a short delay
                setTimeout(() => {
                    startAutoBackupScheduler();
                }, 3000);
            }
        });
