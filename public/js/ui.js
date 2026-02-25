// DRVN Garage - UI Helpers, Sidebar, Service Worker & Navigation

// ==========================================
// Browser Back Button Support for Mobile
// ==========================================

// Handle browser back button
window.addEventListener('popstate', function(event) {
    var carModal = document.getElementById('carModal');
    var detailsModal = document.getElementById('carDetailsModal');
    var maintenanceModal = document.getElementById('maintenanceModal');
    var calendarModal = document.getElementById('calendarModal');
    var appointmentModal = document.getElementById('appointmentModal');
    var dashboardModal = document.getElementById('dashboardModal');

    // Close any open modal when back button is pressed
    if (dashboardModal && !dashboardModal.classList.contains('hidden')) {
        closeDashboard();
    } else if (appointmentModal && !appointmentModal.classList.contains('hidden')) {
        closeAppointmentModal();
    } else if (calendarModal && !calendarModal.classList.contains('hidden')) {
        closeCalendarModal();
    } else if (carModal && !carModal.classList.contains('hidden')) {
        closeCarModal();
    } else if (maintenanceModal && !maintenanceModal.classList.contains('hidden')) {
        closeMaintenanceModal();
    } else if (detailsModal && !detailsModal.classList.contains('hidden')) {
        closeCarDetailsModal();
    }
});

// Wrap modal open functions to add history state
(function() {
    // Save original functions
    var _openCarModal = window.openCarModal;
    var _openCarDetailsModal = window.openCarDetailsModal;
    var _openMaintenanceModal = window.openMaintenanceModal;
    var _openCalendarModal = window.openCalendarModal;
    var _openAppointmentModal = window.openAppointmentModal;
    var _openDashboard = window.openDashboard;

    // Override openCarModal
    window.openCarModal = function() {
        _openCarModal();
        history.pushState({ modal: 'car' }, '', '');
    };

    // Override openCarDetailsModal
    window.openCarDetailsModal = function(carId) {
        _openCarDetailsModal(carId);
        history.pushState({ modal: 'details' }, '', '');
    };

    // Override openMaintenanceModal
    window.openMaintenanceModal = function() {
        _openMaintenanceModal();
        history.pushState({ modal: 'maintenance' }, '', '');
    };

    // Override openCalendarModal
    window.openCalendarModal = function() {
        _openCalendarModal();
        history.pushState({ modal: 'calendar' }, '', '');
    };

    // Override openAppointmentModal
    window.openAppointmentModal = function() {
        _openAppointmentModal();
        history.pushState({ modal: 'appointment' }, '', '');
    };

    // Override openDashboard
    window.openDashboard = function() {
        _openDashboard();
        history.pushState({ modal: 'dashboard' }, '', '');
    };
})();

// ==========================================
// Data.gov.il API Integration
// ==========================================

var apiTimeout = null;

async function fetchCarDataFromAPI(plateNumber) {
    var apiStatus = document.getElementById('apiStatus');

    // Show loading
    apiStatus.innerHTML = '<div class="flex items-center gap-2 text-blue-600 text-sm"><div class="animate-spin rounded-full h-4 w-4 border-2 border-blue-600 border-t-transparent"></div><span>מחפש מידע ברשויות...</span></div>';

    try {
        // Clean the plate number
        var cleanPlateNumber = plateNumber.replace(/[-\s]/g, '');

        /*
         * Available fields from data.gov.il API:
         * - mispar_rechev: رقم السيارة
         * - tozeret_nm: الشركة المصنعة (Toyota, Honda, etc.)
         * - kinuy_mishari: الموديل التجاري
         * - shnat_yitzur: سنة الصنع
         * - baal_rechev: اسم المالك
         * - delek: نوع الوقود (بنزين، דיזל، חשמלי، etc.)
         * - koach_sus: قوة المحرك بالحصان
         * - nefach_manoa: سعة المحرك (cm³)
         * - degem_manoa: موديل المحرك
         * - tzeva_rechev: لون السيارة
         */

        // Call the API
        var response = await fetch(`https://data.gov.il/api/3/action/datastore_search?resource_id=053cea08-09bc-40ec-8f7a-156f0677aff3&q=${cleanPlateNumber}`);

        if (!response.ok) {
            throw new Error('שגיאה בקבלת נתונים');
        }

        var data = await response.json();

        if (data.success && data.result.records && data.result.records.length > 0) {
            var carInfo = data.result.records[0];

            console.log('Car Info from API:', carInfo);

            // Fill basic info
            if (carInfo.tozeret_nm) document.getElementById('carType').value = carInfo.tozeret_nm;
            if (carInfo.kinuy_mishari) document.getElementById('model').value = carInfo.kinuy_mishari;
            if (carInfo.shnat_yitzur) document.getElementById('year').value = carInfo.shnat_yitzur;

            // Fill owner name if available
            if (carInfo.baal_rechev) {
                document.getElementById('ownerName').value = carInfo.baal_rechev;
            }

            // Fill engine type (delek = fuel type)
            if (carInfo.delek) {
                var fuelType = carInfo.delek.trim();
                var engineTypeSelect = document.getElementById('engineType');

                // Map fuel types to Hebrew
                var fuelMapping = {
                    'בנזין': 'בנזין',
                    'דיזל': 'דיזל',
                    'היברידי': 'היברידי',
                    'חשמל': 'חשמלי',
                    'חשמלי': 'חשמלי',
                    'היברדי': 'היברידי',
                    'BENZIN': 'בנזין',
                    'DIESEL': 'דיזל',
                    'HYBRID': 'היברידי',
                    'ELECTRIC': 'חשמלי'
                };

                // Try to find matching fuel type
                for (var [key, value] of Object.entries(fuelMapping)) {
                    if (fuelType.includes(key) || fuelType.toUpperCase().includes(key)) {
                        engineTypeSelect.value = value;
                        break;
                    }
                }
            }

            // Fill engine power/size
            var enginePowerText = '';

            // Horse power (degem_manoa can contain HP info)
            if (carInfo.koach_sus) {
                enginePowerText += carInfo.koach_sus + ' כ"ס';
            }

            // Engine capacity (cm³)
            if (carInfo.nefach_manoa) {
                if (enginePowerText) enginePowerText += ' / ';
                enginePowerText += carInfo.nefach_manoa + ' סמ"ק';
            }

            if (enginePowerText) {
                document.getElementById('enginePower').value = enginePowerText;
            }

            apiStatus.innerHTML = '<div class="text-green-600 text-sm font-semibold">✓ נמצאו פרטי הרכב מהמאגר הממשלתי</div>';
            setTimeout(() => apiStatus.innerHTML = '', 3000);
        } else {
            apiStatus.innerHTML = '<div class="text-orange-600 text-sm">לא נמצאו פרטים במאגר</div>';
            setTimeout(() => apiStatus.innerHTML = '', 3000);
        }
    } catch (error) {
        apiStatus.innerHTML = '<div class="text-gray-600 text-sm">ניתן להזין ידנית</div>';
        setTimeout(() => apiStatus.innerHTML = '', 3000);
    }
}

// Manual search function when button is clicked
function searchCarByPlateNumber() {
    var plateNumber = document.getElementById('plateNumber').value.trim();
    var apiStatus = document.getElementById('apiStatus');

    if (!plateNumber) {
        apiStatus.innerHTML = '<div class="text-red-600 text-sm">נא להזין מספר רישוי</div>';
        setTimeout(() => apiStatus.innerHTML = '', 2000);
        return;
    }

    if (plateNumber.length < 7) {
        apiStatus.innerHTML = '<div class="text-orange-600 text-sm">מספר רישוי חייב להיות לפחות 7 ספרות</div>';
        setTimeout(() => apiStatus.innerHTML = '', 2000);
        return;
    }

    fetchCarDataFromAPI(plateNumber);
}

// Clear form fields (except plate number and image)
function clearCarFormFields() {
    // Don't clear: plateNumber, carImage, imagePreview
    // Clear all other fields
    document.getElementById('ownerName').value = '';
    document.getElementById('carType').value = '';
    document.getElementById('model').value = '';
    document.getElementById('year').value = '';
    document.getElementById('phone').value = '';
    document.getElementById('engineType').value = '';
    document.getElementById('enginePower').value = '';
    document.getElementById('immobilizerCode').value = '';

    // Clear API status
    document.getElementById('apiStatus').innerHTML = '';
}

// Monitor plate number input
document.addEventListener('DOMContentLoaded', function() {
    var plateNumberInput = document.getElementById('plateNumber');

    if (plateNumberInput) {
        var previousValue = '';

        plateNumberInput.addEventListener('input', function(e) {
            // Remove non-digits
            var value = e.target.value.replace(/\D/g, '');
            e.target.value = value;

            // If user deleted the plate number (went from having value to empty)
            if (previousValue && !value) {
                clearCarFormFields();
            }

            previousValue = value;
        });

        // Also clear on backspace/delete when field becomes empty
        plateNumberInput.addEventListener('keyup', function(e) {
            if (!this.value.trim()) {
                clearCarFormFields();
            }
        });
    }
});

// ==========================================
// AUTO-UPDATE Service Worker System
// ==========================================
if ('serviceWorker' in navigator) {
    window.addEventListener('load', async () => {
        try {
            // Register Service Worker with no-cache
            var registration = await navigator.serviceWorker.register('/service-worker.js', {
                scope: '/',
                updateViaCache: 'none'
            });

            // Check for updates every 5 minutes
            setInterval(() => {
                registration.update();
            }, 5 * 60 * 1000);

            // Also check when app becomes visible again
            document.addEventListener('visibilitychange', () => {
                if (document.visibilityState === 'visible') {
                    registration.update();
                }
            });

            // When new version found - AUTO ACTIVATE
            registration.addEventListener('updatefound', () => {
                var newWorker = registration.installing;

                newWorker.addEventListener('statechange', () => {
                    if (newWorker.state === 'installed') {
                        if (navigator.serviceWorker.controller) {
                            // New version available - force activate it
                            newWorker.postMessage({ type: 'SKIP_WAITING' });
                        }
                    }
                });
            });

            // Listen for SW messages
            navigator.serviceWorker.addEventListener('message', (event) => {
                if (event.data && event.data.type === 'SW_UPDATED') {
                    // Show toast notification
                    showToast('🔄 עודכן לגרסה חדשה!', 'success');
                }
            });

            // Auto-reload when controller changes
            var refreshing = false;
            navigator.serviceWorker.addEventListener('controllerchange', () => {
                if (refreshing) return;
                refreshing = true;
                window.location.reload(true);
            });

            // OFFLINE/ONLINE Status Management
            var offlineBanner = document.getElementById('offlineBanner');
            var onlineBanner = document.getElementById('onlineBanner');
            var isOffline = !navigator.onLine;

            function updateOnlineStatus() {
                var wasOffline = isOffline;
                isOffline = !navigator.onLine;

                if (isOffline) {
                    // Show offline banner
                    offlineBanner.classList.remove('hidden');
                    onlineBanner.classList.add('hidden');
                    document.body.style.paddingTop = '70px';
                    showToast('אין חיבור לאינטרנט', 'error');
                } else {
                    // Hide offline banner
                    offlineBanner.classList.add('hidden');

                    // Show "back online" banner briefly if we were offline
                    if (wasOffline) {
                        onlineBanner.classList.remove('hidden');
                        document.body.style.paddingTop = '50px';
                        showToast('החיבור חזר!', 'success');

                        // Hide after 3 seconds
                        setTimeout(() => {
                            onlineBanner.classList.add('hidden');
                            document.body.style.paddingTop = '0';
                        }, 3000);

                        // Trigger background sync if available
                        if ('sync' in registration) {
                            registration.sync.register('sync-data').catch(() => {});
                        }
                    } else {
                        document.body.style.paddingTop = '0';
                    }
                }
            }

            // Listen for online/offline events
            window.addEventListener('online', updateOnlineStatus);
            window.addEventListener('offline', updateOnlineStatus);

            // Initial check
            updateOnlineStatus();

        } catch (error) {
            console.error('Service Worker error:', error);
        }
    });
}

// ========== SIDEBAR MENU FUNCTIONS ==========
function toggleSidebar() {
    var sidebar = document.getElementById('sidebar');
    var overlay = document.getElementById('sidebarOverlay');
    var bottomNav = document.querySelector('.mobile-bottom-nav');
    var fabButton = document.querySelector('.fab-button');

    if (sidebar && overlay) {
        sidebar.classList.toggle('open');
        overlay.classList.toggle('active');

        if (sidebar.classList.contains('open')) {
            document.body.classList.add('sidebar-open');
            document.body.style.overflow = 'hidden';
            document.body.style.position = 'fixed';
            document.body.style.width = '100%';

            if (bottomNav) {
                bottomNav.classList.add('nav-hidden');
            }
            if (fabButton) {
                fabButton.classList.add('fab-hidden');
            }
        } else {
            document.body.classList.remove('sidebar-open');
            document.body.style.overflow = '';
            document.body.style.position = '';
            document.body.style.width = '';

            if (bottomNav) {
                bottomNav.classList.remove('nav-hidden');
            }
            if (fabButton) {
                fabButton.classList.remove('fab-hidden');
            }
        }
    }
}

// Close sidebar when pressing Escape
document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
        var sidebar = document.getElementById('sidebar');
        if (sidebar && sidebar.classList.contains('open')) {
            toggleSidebar();
        }
    }
});

// Update sidebar user info when user name changes
function updateSidebarUserInfo() {
    var userName = document.getElementById('userName');
    var sidebarUserName = document.getElementById('sidebarUserName');
    if (userName && sidebarUserName) {
        sidebarUserName.textContent = userName.textContent;
    }
}

// Update subscription counter in sidebar
function updateSidebarCounter() {
    var daysLeft = document.getElementById('daysLeft');
    var sidebarDaysLeft = document.getElementById('sidebarDaysLeft');
    var sidebarDaysCounter = document.getElementById('sidebarDaysCounter');

    if (daysLeft && sidebarDaysLeft && sidebarDaysCounter) {
        sidebarDaysLeft.textContent = daysLeft.textContent;
        if (daysLeft.textContent !== '0') {
            sidebarDaysCounter.classList.remove('hidden');
        }
    }
}

// Sync theme icon in sidebar
function updateSidebarTheme() {
    var themeIcon = document.getElementById('themeIcon');
    var sidebarThemeIcon = document.getElementById('sidebarThemeIcon');
    var sidebarThemeText = document.getElementById('sidebarThemeText');

    if (themeIcon && sidebarThemeIcon && sidebarThemeText) {
        sidebarThemeIcon.textContent = themeIcon.textContent;
        sidebarThemeText.textContent = themeIcon.textContent === '🌙' ? 'מצב יום' : 'מצב לילה';
    }
}

// Call these on page load
window.addEventListener('load', function() {
    updateSidebarUserInfo();
    updateSidebarCounter();
    updateSidebarTheme();

    // Mobile performance optimizations
    if (window.innerWidth <= 768) {
        // Defer non-critical updates
        requestIdleCallback ? requestIdleCallback(optimizeMobilePerformance) : setTimeout(optimizeMobilePerformance, 100);
    }
});

// Mobile-specific performance optimizations
function optimizeMobilePerformance() {
    // Add passive touch listeners for better scroll performance
    document.addEventListener('touchstart', function() {}, { passive: true });
    document.addEventListener('touchmove', function() {}, { passive: true });

    // Preload critical elements
    var cards = document.querySelectorAll('.card');
    if (cards.length > 0) {
        // Mark first 4 cards as high priority
        cards.forEach((card, index) => {
            if (index < 4) {
                card.style.contentVisibility = 'visible';
            }
        });
    }

    // Optimize images lazy loading
    var images = document.querySelectorAll('img[src]');
    if ('loading' in HTMLImageElement.prototype) {
        images.forEach(img => {
            if (!img.loading) img.loading = 'lazy';
        });
    }

    console.log('📱 Mobile optimizations applied');
}

// ==========================================
// OPTIMIZED SCROLL HANDLER FOR MOBILE
// ==========================================
var lastScrollY = 0;
var ticking = false;
var scrollTimeout = null;
var scrollThreshold = 15; // Increased threshold for smoother feel

// Cache DOM elements
var cachedSearchContainer = null;
var cachedBottomNav = null;

function getScrollElements() {
    if (!cachedSearchContainer) cachedSearchContainer = document.getElementById('searchContainer');
    if (!cachedBottomNav) cachedBottomNav = document.querySelector('.mobile-bottom-nav');
    return { searchContainer: cachedSearchContainer, bottomNav: cachedBottomNav };
}

// Debounced scroll class for performance
function handleScrollEnd() {
    document.body.classList.remove('is-scrolling');
}

window.addEventListener('scroll', function() {
    // Add scrolling class for CSS optimization
    if (!document.body.classList.contains('is-scrolling')) {
        document.body.classList.add('is-scrolling');
    }

    // Clear previous timeout
    if (scrollTimeout) clearTimeout(scrollTimeout);
    scrollTimeout = setTimeout(handleScrollEnd, 150);

    if (!ticking) {
        window.requestAnimationFrame(function() {
            if (window.innerWidth <= 768) {
                var { searchContainer, bottomNav } = getScrollElements();
                var currentScrollY = window.scrollY;
                var scrollDiff = currentScrollY - lastScrollY;

                // Check if at top or bottom (prevent bounce glitch)
                var atTop = currentScrollY <= 10;
                var atBottom = (window.innerHeight + currentScrollY) >= (document.body.scrollHeight - 10);

                // At top - always show
                if (atTop) {
                    if (searchContainer) searchContainer.classList.remove('hidden-scroll');
                    if (bottomNav) bottomNav.classList.remove('hidden-scroll');
                    lastScrollY = currentScrollY;
                    ticking = false;
                    return;
                }

                // At bottom - keep current state, ignore small movements
                if (atBottom && Math.abs(scrollDiff) < 30) {
                    ticking = false;
                    return;
                }

                // Ignore small scroll movements
                if (Math.abs(scrollDiff) < scrollThreshold) {
                    ticking = false;
                    return;
                }

                if (scrollDiff > 0) {
                    // Scrolling down - hide both
                    if (searchContainer) searchContainer.classList.add('hidden-scroll');
                    if (bottomNav) bottomNav.classList.add('hidden-scroll');
                } else {
                    // Scrolling up - show both
                    if (searchContainer) searchContainer.classList.remove('hidden-scroll');
                    if (bottomNav) bottomNav.classList.remove('hidden-scroll');
                }
                lastScrollY = currentScrollY;
            }
            ticking = false;
        });
        ticking = true;
    }
}, { passive: true });

// Check if running inside iOS native app (WKWebView)
function isIOSNativeAppUI() {
    return window.webkit && window.webkit.messageHandlers;
}

// Show Account Modal
function showAccountModal() {
    closeAllModals();

    var modal = document.getElementById('accountModal');
    if (!modal) {
        console.error('Account modal not found');
        return;
    }

    updateActiveNav(4);

    var detailsDiv = document.getElementById('subscriptionDetails');
    var isIOS = isIOSNativeAppUI();

    // Show loading
    detailsDiv.innerHTML = `
        <div class="text-center py-8">
            <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-500 mx-auto"></div>
            <p class="mt-4 text-gray-600">טוען...</p>
        </div>
    `;

    modal.classList.remove('hidden');
    document.body.classList.add('modal-open');
    hideUIElements();

    // Delete account button HTML (shown on all platforms)
    var deleteAccountHTML = `
        <div class="mt-6 pt-4 border-t border-gray-200">
            <button onclick="deleteAccountConfirm()" class="block w-full text-center text-red-500 hover:text-red-700 text-sm py-2">
                מחיקת חשבון
            </button>
        </div>
    `;

    // Load subscription data
    db.collection('users').doc(currentUser.uid).get()
        .then(doc => {
            if (!doc.exists) {
                detailsDiv.innerHTML = `
                    <div class="text-center py-8 text-red-600">
                        <p>לא נמצאו נתוני מנוי</p>
                    </div>
                ` + deleteAccountHTML;
                return;
            }

            var userData = doc.data();
            var now = new Date();
            var statusHTML = '';

            if (userData.subscriptionEndDate) {
                var endDate;
                if (userData.subscriptionEndDate.toDate) {
                    endDate = userData.subscriptionEndDate.toDate();
                } else {
                    endDate = new Date(userData.subscriptionEndDate);
                }

                var daysLeft = Math.ceil((endDate - now) / (1000 * 60 * 60 * 24));
                var endDateText = endDate.toLocaleDateString('he-IL');

                if (daysLeft > 0) {
                    statusHTML = `
                        <div class="space-y-3">
                            <div class="p-4 bg-green-50 rounded-lg border-2 border-green-500">
                                <div class="text-sm text-gray-600">חשבון</div>
                                <div class="font-bold" style="word-break: break-all; overflow-wrap: break-word;">${currentUser.email}</div>
                            </div>
                            <div class="p-4 bg-white rounded-lg border-2">
                                <div class="text-sm text-gray-600">תוקף עד</div>
                                <div class="font-bold text-lg">${endDateText}</div>
                            </div>
                            <div class="flex items-center justify-between p-4 bg-white rounded-lg border-2">
                                <div>
                                    <div class="text-sm text-gray-600">סטטוס</div>
                                    <div class="font-bold text-lg text-green-600">✅ פעיל</div>
                                </div>
                                <div class="text-right">
                                    <div class="text-sm text-gray-600">ימים נותרו</div>
                                    <div class="font-bold text-3xl text-green-600">${daysLeft}</div>
                                </div>
                            </div>
                            ${isIOS ? '' : '<a href="account.html" class="block w-full text-center bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-lg font-bold text-lg mt-4" style="text-decoration: none;">➕ הארך מנוי</a>'}
                        </div>
                    `;
                } else {
                    statusHTML = `
                        <div class="space-y-3">
                            <div class="p-4 bg-red-50 rounded-lg border-2 border-red-500">
                                <div class="text-sm text-gray-600">חשבון</div>
                                <div class="font-bold" style="word-break: break-all; overflow-wrap: break-word;">${currentUser.email}</div>
                            </div>
                            <div class="p-6 bg-red-50 rounded-lg border-2 border-red-500 text-center">
                                <div class="text-2xl font-bold text-red-600 mb-2">⚠️ המנוי פג תוקף</div>
                                <div class="text-gray-700">אתה יכול לצפות בנתונים אבל לא להוסיף או לערוך</div>
                            </div>
                            ${isIOS ? '' : '<a href="account.html" class="block w-full text-center bg-amber-500 hover:bg-amber-600 text-white px-8 py-4 rounded-lg font-bold text-xl mt-4" style="text-decoration: none;">💳 חדש מנוי - בחר תוכנית</a>'}
                        </div>
                    `;
                }
            } else {
                statusHTML = `
                    <div class="space-y-3">
                        <div class="p-4 bg-gray-50 rounded-lg border-2">
                            <div class="text-sm text-gray-600">חשבון</div>
                            <div class="font-bold" style="word-break: break-all; overflow-wrap: break-word;">${currentUser.email}</div>
                        </div>
                        <div class="p-6 bg-gray-50 rounded-lg border-2 text-center">
                            <div class="text-xl font-bold text-gray-600 mb-2">אין מנוי פעיל</div>
                        </div>
                        ${isIOS ? '' : '<a href="account.html" class="block w-full text-center bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-lg font-bold text-lg mt-4" style="text-decoration: none;">💳 הירשם למנוי</a>'}
                    </div>
                `;
            }

            detailsDiv.innerHTML = statusHTML + deleteAccountHTML;
        })
        .catch(error => {
            console.error('Error loading subscription:', error);
            detailsDiv.innerHTML = `
                <div class="text-center py-8 text-red-600">
                    <p>שגיאה בטעינת נתונים</p>
                </div>
            ` + deleteAccountHTML;
        });
}

// Delete account confirmation and execution
function deleteAccountConfirm() {
    if (!currentUser) return;

    var confirmed = confirm('האם אתה בטוח שברצונך למחוק את החשבון?\nכל הנתונים יימחקו לצמיתות ולא ניתן לשחזר אותם.');
    if (!confirmed) return;

    var emailConfirm = prompt('לאישור סופי, הקלד את כתובת האימייל שלך:');
    if (!emailConfirm || emailConfirm.trim().toLowerCase() !== currentUser.email.toLowerCase()) {
        alert('האימייל לא תואם. המחיקה בוטלה.');
        return;
    }

    // Show loading
    var detailsDiv = document.getElementById('subscriptionDetails');
    if (detailsDiv) {
        detailsDiv.innerHTML = `
            <div class="text-center py-8">
                <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-red-500 mx-auto"></div>
                <p class="mt-4 text-red-600 font-bold">מוחק חשבון...</p>
            </div>
        `;
    }

    var userId = currentUser.uid;

    // Delete user data from Firestore then delete auth account
    db.collection('users').doc(userId).delete()
        .then(function() {
            // Delete cars collection for this user
            return db.collection('cars').where('userId', '==', userId).get();
        })
        .then(function(snapshot) {
            var batch = db.batch();
            snapshot.forEach(function(doc) {
                batch.delete(doc.ref);
            });
            return batch.commit();
        })
        .then(function() {
            // Delete the Firebase Auth account
            return currentUser.delete();
        })
        .then(function() {
            alert('החשבון נמחק בהצלחה.');
            window.location.href = '/';
        })
        .catch(function(error) {
            console.error('Error deleting account:', error);
            if (error.code === 'auth/requires-recent-login') {
                alert('יש להתחבר מחדש לפני מחיקת החשבון. אנא התנתק והתחבר שוב.');
            } else {
                alert('שגיאה במחיקת החשבון: ' + error.message);
            }
            // Reload modal
            showAccountModal();
        });
}

function closeAccountModal() {
    var modal = document.getElementById('accountModal');
    if (modal) {
        modal.classList.add('hidden');
    }
    document.body.classList.remove('modal-open');
    showUIElements();
    updateActiveNav(0);
}

// Helper functions to show/hide FAB and bottom nav
function hideUIElements() {
    var fab = document.querySelector('.fab-button');
    var bottomNav = document.querySelector('.mobile-bottom-nav');
    if (fab) fab.classList.add('hide-on-modal');
    if (bottomNav) bottomNav.classList.add('hide-on-modal');
}

function showUIElements() {
    var fab = document.querySelector('.fab-button');
    var bottomNav = document.querySelector('.mobile-bottom-nav');
    if (fab) fab.classList.remove('hide-on-modal');
    if (bottomNav) bottomNav.classList.remove('hide-on-modal');
}

function closeAllModals() {
    var modals = ['dashboardModal', 'calendarModal', 'backupModal', 'accountModal', 'carModal', 'appointmentModal', 'carSelectorModal', 'carDetailsModal'];
    modals.forEach(modalId => {
        var modal = document.getElementById(modalId);
        if (modal && !modal.classList.contains('hidden')) {
            modal.classList.add('hidden');
        }
    });
    document.body.classList.remove('modal-open');
    showUIElements();
}

// Scroll to top function
function scrollToTop() {
    closeAllModals();
    window.scrollTo({ top: 0, behavior: 'smooth' });
    updateActiveNav(0);
}

// Update active nav item
function updateActiveNav(index) {
    document.querySelectorAll('.nav-item').forEach((item, i) => {
        item.classList.toggle('active', i === index);
    });
}

// Sidebar touch handling
document.addEventListener('DOMContentLoaded', function() {
    var sidebar = document.getElementById('sidebar');
    if (sidebar) {
        var startY = 0;

        sidebar.addEventListener('touchstart', function(e) {
            startY = e.touches[0].pageY;
        }, { passive: true });

        sidebar.addEventListener('touchmove', function(e) {
            var currentY = e.touches[0].pageY;
            var scrollTop = sidebar.scrollTop;
            var scrollHeight = sidebar.scrollHeight;
            var clientHeight = sidebar.clientHeight;

            var isAtTop = scrollTop <= 0 && currentY > startY;
            var isAtBottom = scrollTop + clientHeight >= scrollHeight && currentY < startY;

            if (isAtTop || isAtBottom) {
                e.preventDefault();
            }
        }, { passive: false });
    }

    checkNotificationStatus();
});
