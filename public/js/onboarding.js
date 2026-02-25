// DRVN Garage - Onboarding Flow for New Users

// ==========================================
// ONBOARDING STATE
// ==========================================
var onboardingCurrentStep = 1;
var onboardingCarAdded = false;
var onboardingAppointmentAdded = false;

// ==========================================
// START ONBOARDING
// ==========================================
function startOnboarding() {
    var overlay = document.getElementById('onboardingOverlay');
    if (!overlay) return;

    onboardingCurrentStep = 1;
    onboardingCarAdded = false;
    onboardingAppointmentAdded = false;

    // Show overlay
    overlay.classList.remove('hidden');
    document.body.classList.add('modal-open');

    // Hide bottom nav & FAB completely during onboarding
    var bottomNav = document.querySelector('.mobile-bottom-nav');
    var fab = document.querySelector('.fab-button');
    if (bottomNav) bottomNav.style.display = 'none';
    if (fab) fab.style.display = 'none';

    // Show step 1, hide others
    showOnboardingStep(1);
    updateOnboardingDots(1);
}

// ==========================================
// NAVIGATION
// ==========================================
function showOnboardingStep(step) {
    // Hide all steps
    for (var i = 1; i <= 4; i++) {
        var stepEl = document.getElementById('onboardingStep' + i);
        if (stepEl) {
            stepEl.classList.add('hidden');
            stepEl.classList.remove('onboarding-slide-in');
        }
    }

    // Show target step with animation
    var targetStep = document.getElementById('onboardingStep' + step);
    if (targetStep) {
        targetStep.classList.remove('hidden');
        // Trigger slide animation
        void targetStep.offsetWidth; // Force reflow
        targetStep.classList.add('onboarding-slide-in');
    }

    onboardingCurrentStep = step;
    updateOnboardingDots(step);
}

function updateOnboardingDots(activeStep) {
    for (var i = 1; i <= 4; i++) {
        var dot = document.getElementById('onboardingDot' + i);
        if (dot) {
            if (i === activeStep) {
                dot.classList.add('bg-amber-500');
                dot.classList.remove('bg-gray-300');
                dot.style.width = '24px';
            } else {
                dot.classList.remove('bg-amber-500');
                dot.classList.add('bg-gray-300');
                dot.style.width = '8px';
            }
        }
    }
}

// ==========================================
// STEP 1: WELCOME → Go to Step 2
// ==========================================
function onboardingStart() {
    showOnboardingStep(2);
}

// ==========================================
// STEP 2: ADD CAR
// ==========================================
async function onboardingSaveCar() {
    var plateInput = document.getElementById('onboardingPlateNumber');
    var ownerInput = document.getElementById('onboardingOwnerName');
    var saveBtn = document.getElementById('onboardingSaveCarBtn');

    if (!plateInput) return;

    var plateNumber = plateInput.value.trim();
    if (!plateNumber) {
        // Show validation error
        plateInput.classList.add('border-red-500', 'ring-1', 'ring-red-500');
        plateInput.focus();
        return;
    }

    // Remove error styling
    plateInput.classList.remove('border-red-500', 'ring-1', 'ring-red-500');

    // Disable button & show loading
    if (saveBtn) {
        saveBtn.disabled = true;
        saveBtn.innerHTML = '<span class="animate-spin inline-block">&#9696;</span> \u05E9\u05D5\u05DE\u05E8...';
    }

    try {
        var carData = {
            plateNumber: plateNumber,
            ownerName: ownerInput ? ownerInput.value.trim() : '',
            userId: currentUser.uid,
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            carStatus: 'waiting'
        };

        await db.collection('cars').add(carData);
        onboardingCarAdded = true;

        // Move to step 3
        showOnboardingStep(3);
    } catch (error) {
        console.error('Onboarding: Error saving car:', error);
        // Show error message
        var errorEl = document.getElementById('onboardingCarError');
        if (errorEl) {
            errorEl.textContent = '\u05E9\u05D2\u05D9\u05D0\u05D4 \u05D1\u05E9\u05DE\u05D9\u05E8\u05EA \u05D4\u05E8\u05DB\u05D1. \u05E0\u05E1\u05D4 \u05E9\u05D5\u05D1.';
            errorEl.classList.remove('hidden');
        }
    } finally {
        if (saveBtn) {
            saveBtn.disabled = false;
            saveBtn.innerHTML = '\u05D4\u05D1\u05D0 \u2192';
        }
    }
}

function onboardingSkipCar() {
    showOnboardingStep(3);
}

// ==========================================
// STEP 3: ADD APPOINTMENT
// ==========================================
async function onboardingSaveAppointment() {
    var dateInput = document.getElementById('onboardingAppDate');
    var timeInput = document.getElementById('onboardingAppTime');
    var reminderToggle = document.getElementById('onboardingReminder');
    var saveBtn = document.getElementById('onboardingSaveAppBtn');

    if (!dateInput || !dateInput.value) {
        dateInput.classList.add('border-red-500', 'ring-1', 'ring-red-500');
        dateInput.focus();
        return;
    }

    dateInput.classList.remove('border-red-500', 'ring-1', 'ring-red-500');

    // Disable button & show loading
    if (saveBtn) {
        saveBtn.disabled = true;
        saveBtn.innerHTML = '<span class="animate-spin inline-block">&#9696;</span> \u05E9\u05D5\u05DE\u05E8...';
    }

    try {
        var appointmentData = {
            userId: currentUser.uid,
            date: dateInput.value,
            time: timeInput ? timeInput.value : '',
            reminder: reminderToggle ? reminderToggle.checked : true,
            title: '\u05EA\u05D5\u05E8 \u05D7\u05D3\u05E9',
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        };

        await db.collection('appointments').add(appointmentData);
        onboardingAppointmentAdded = true;

        // Move to step 4 (success)
        updateOnboardingSummary();
        showOnboardingStep(4);
    } catch (error) {
        console.error('Onboarding: Error saving appointment:', error);
        var errorEl = document.getElementById('onboardingAppError');
        if (errorEl) {
            errorEl.textContent = '\u05E9\u05D2\u05D9\u05D0\u05D4 \u05D1\u05E9\u05DE\u05D9\u05E8\u05EA \u05D4\u05EA\u05D5\u05E8. \u05E0\u05E1\u05D4 \u05E9\u05D5\u05D1.';
            errorEl.classList.remove('hidden');
        }
    } finally {
        if (saveBtn) {
            saveBtn.disabled = false;
            saveBtn.innerHTML = '\u05D4\u05D1\u05D0 \u2192';
        }
    }
}

function onboardingSkipAppointment() {
    updateOnboardingSummary();
    showOnboardingStep(4);
}

// ==========================================
// STEP 4: SUCCESS SUMMARY
// ==========================================
function updateOnboardingSummary() {
    var summaryEl = document.getElementById('onboardingSummary');
    if (!summaryEl) return;

    var parts = [];
    if (onboardingCarAdded) {
        parts.push('\u2705 \u05E8\u05DB\u05D1 1 \u05E0\u05D5\u05E1\u05E3');
    }
    if (onboardingAppointmentAdded) {
        parts.push('\u2705 \u05EA\u05D5\u05E8 1 \u05E0\u05D5\u05E1\u05E3');
    }

    if (parts.length === 0) {
        summaryEl.innerHTML = '<p class="text-gray-500">\u05D0\u05E4\u05E9\u05E8 \u05DC\u05D4\u05D5\u05E1\u05D9\u05E3 \u05E8\u05DB\u05D1\u05D9\u05DD \u05D5\u05EA\u05D5\u05E8\u05D9\u05DD \u05DE\u05D4\u05DE\u05E2\u05E8\u05DB\u05EA</p>';
    } else {
        summaryEl.innerHTML = parts.map(function(p) {
            return '<p class="text-lg font-medium text-gray-700 mb-1">' + p + '</p>';
        }).join('');
    }
}

// ==========================================
// FINISH ONBOARDING
// ==========================================
async function finishOnboarding() {
    var overlay = document.getElementById('onboardingOverlay');

    try {
        // Mark onboarding as completed in Firestore
        await db.collection('users').doc(currentUser.uid).update({
            onboardingCompleted: true
        });
    } catch (error) {
        console.error('Error updating onboarding status:', error);
    }

    // Update global variable
    hasCompletedOnboarding = true;

    // Show bottom nav & FAB back
    var bottomNav = document.querySelector('.mobile-bottom-nav');
    var fab = document.querySelector('.fab-button');
    if (bottomNav) bottomNav.style.display = '';
    if (fab) fab.style.display = '';

    // Hide overlay with fade
    if (overlay) {
        overlay.style.transition = 'opacity 0.3s ease';
        overlay.style.opacity = '0';
        setTimeout(function() {
            overlay.classList.add('hidden');
            overlay.style.opacity = '';
            overlay.style.transition = '';
            document.body.classList.remove('modal-open');
        }, 300);
    }

    // Load app data
    if (typeof loadCars === 'function') {
        loadCars();
    }
    if (typeof loadAppointments === 'function') {
        loadAppointments();
    }
}

// ==========================================
// SET DEFAULT DATE FOR APPOINTMENT
// ==========================================
function initOnboardingDefaults() {
    var dateInput = document.getElementById('onboardingAppDate');
    if (dateInput) {
        // Set default date to tomorrow
        var tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        dateInput.value = tomorrow.toISOString().split('T')[0];
        dateInput.min = new Date().toISOString().split('T')[0];
    }

    var timeInput = document.getElementById('onboardingAppTime');
    if (timeInput) {
        timeInput.value = '09:00';
    }

    // Reminder toggle defaults to ON (set in HTML)
}
