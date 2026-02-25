// DRVN Garage - Configuration & Global Variables

// ==========================================
// PRODUCTION MODE - Disable console.log
// ==========================================
(function() {
    const isProduction = window.location.hostname !== 'localhost' &&
                         !window.location.hostname.includes('127.0.0.1');
    if (isProduction) {
        console.log = function() {};
        console.info = function() {};
        console.debug = function() {};
        // Keep console.warn and console.error for debugging critical issues
    }
})();

// ==========================================
// Global Variable Declarations
// ==========================================
var app, db, auth, messaging; // ⭐ إضافة messaging هنا
var currentUser = null;
var cars = [];
var appointments = [];
var editingCarId = null;
var currentCarId = null;
var editingMaintenanceId = null;
var editingAppointmentId = null;
var maintenanceImages = [];
var currentMonth = new Date().getMonth();
var currentYear = new Date().getFullYear();
var selectedDate = null;
var miniMonth = new Date().getMonth();
var miniYear = new Date().getFullYear();
var miniSelectedDate = null;

// ==========================================
// Auth Check Variable
// ==========================================
var isAuthChecked = false;

// ==========================================
// Subscription Variables
// ==========================================
var userSubscription = null;
var isSubscriptionActive = false;
var isPremiumUser = false; // True only if paid subscription (not trial)
var isAdmin = false; // Loaded from Firestore user document
var hasCompletedOnboarding = true; // Default true (old users skip onboarding)

// Premium features list
var PREMIUM_FEATURES = ['calendar', 'whatsapp', 'call'];

// ==========================================
// Maintenance Cache
// ==========================================
var maintenanceCache = {}; // Cache maintenance data for filtering

// ==========================================
// Firebase Configuration
// ==========================================
var firebaseConfig = {
    apiKey: "AIzaSyCdSRfJCoU6xwDych3l_3K_hBZBHOi9jVg",
    authDomain: "garage-17263.firebaseapp.com",
    projectId: "garage-17263",
    storageBucket: "garage-17263.firebasestorage.app",
    messagingSenderId: "721619076271",
    appId: "1:721619076271:web:f1e29b5d5ec6b1a5d7fb3a",
    measurementId: "G-7MW5YP69LY"
};

// ==========================================
// CAR LOOKUP API - Israeli Government Data
// ==========================================

// API Configuration (يمكنك إضافة API Key هنا لاحقاً)
// API Configuration (يمكنك إضافة API Key هنا لاحقاً)
var CAR_API_CONFIG = {
    // ✅ للحصول على API Key مجاني (5 دقائق فقط):
    // 1. اذهب إلى: https://data.gov.il
    // 2. اضغط "הרשמה" (تسجيل)
    // 3. فعّل حسابك من البريد
    // 4. احصل على API Key مجاناً
    // 5. ضعه هنا في السطر التالي بين علامتي التنصيص
    apiKey: '', // ← ضع API Key هنا
    baseUrl: 'https://data.gov.il/api/3/action/datastore_search',
    resourceId: '053cea08-09bc-40ec-8f7a-156f0677aff3',
    // ملاحظة: بدون API Key سيعمل النظام لكن بدون البحث التلقائي
};
