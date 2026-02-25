// DRVN Garage - Utility Functions

// ==========================================
// XSS PROTECTION - Sanitize user inputs
// ==========================================
function sanitizeInput(input) {
    if (typeof input !== 'string') return input;
    return input
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#x27;')
        .replace(/\//g, '&#x2F;')
        .trim();
}

function sanitizeObject(obj) {
    if (!obj || typeof obj !== 'object') return obj;
    var sanitized = {};
    for (var key in obj) {
        if (obj.hasOwnProperty(key)) {
            sanitized[key] = typeof obj[key] === 'string'
                ? sanitizeInput(obj[key])
                : obj[key];
        }
    }
    return sanitized;
}

// Validate phone number (Israeli format)
function isValidPhone(phone) {
    if (!phone) return true;
    var cleaned = phone.replace(/[-\s]/g, '');
    return /^0[0-9]{8,9}$/.test(cleaned);
}

// Validate plate number (Israeli format)
function isValidPlateNumber(plate) {
    if (!plate) return false;
    var cleaned = plate.replace(/[-\s]/g, '');
    return /^[0-9]{7,8}$/.test(cleaned);
}

// ==========================================
// RATE LIMITING - Protect against abuse
// ==========================================
var RateLimiter = {
    actions: {},

    // Configuration per action type
    limits: {
        'saveCar': { maxAttempts: 10, windowMs: 60000 },      // 10 cars per minute
        'saveMaintenance': { maxAttempts: 20, windowMs: 60000 }, // 20 maintenance records per minute
        'saveAppointment': { maxAttempts: 15, windowMs: 60000 }, // 15 appointments per minute
        'deleteRecord': { maxAttempts: 10, windowMs: 60000 },    // 10 deletes per minute
        'exportData': { maxAttempts: 5, windowMs: 300000 },      // 5 exports per 5 minutes
        'uploadImage': { maxAttempts: 20, windowMs: 60000 },     // 20 images per minute
        'search': { maxAttempts: 30, windowMs: 60000 },          // 30 searches per minute
        'login': { maxAttempts: 5, windowMs: 300000 },           // 5 login attempts per 5 minutes
        'default': { maxAttempts: 30, windowMs: 60000 }          // Default: 30 actions per minute
    },

    // Check if action is allowed
    canPerform(actionType) {
        var now = Date.now();
        var limit = this.limits[actionType] || this.limits['default'];

        // Initialize if not exists
        if (!this.actions[actionType]) {
            this.actions[actionType] = [];
        }

        // Remove old attempts outside the window
        this.actions[actionType] = this.actions[actionType].filter(
            timestamp => now - timestamp < limit.windowMs
        );

        // Check if under limit
        return this.actions[actionType].length < limit.maxAttempts;
    },

    // Record an action
    recordAction(actionType) {
        if (!this.actions[actionType]) {
            this.actions[actionType] = [];
        }
        this.actions[actionType].push(Date.now());
    },

    // Get remaining attempts
    getRemainingAttempts(actionType) {
        var now = Date.now();
        var limit = this.limits[actionType] || this.limits['default'];

        if (!this.actions[actionType]) {
            return limit.maxAttempts;
        }

        var recentAttempts = this.actions[actionType].filter(
            timestamp => now - timestamp < limit.windowMs
        ).length;

        return Math.max(0, limit.maxAttempts - recentAttempts);
    },

    // Get time until reset (in seconds)
    getTimeUntilReset(actionType) {
        var limit = this.limits[actionType] || this.limits['default'];

        if (!this.actions[actionType] || this.actions[actionType].length === 0) {
            return 0;
        }

        var oldestAttempt = Math.min(...this.actions[actionType]);
        var resetTime = oldestAttempt + limit.windowMs;
        return Math.max(0, Math.ceil((resetTime - Date.now()) / 1000));
    },

    // Wrapper function to check and perform action
    async performAction(actionType, actionFn) {
        if (!this.canPerform(actionType)) {
            var waitTime = this.getTimeUntilReset(actionType);
            throw new Error(`יותר מדי פעולות. נסה שוב בעוד ${waitTime} שניות`);
        }

        this.recordAction(actionType);
        return await actionFn();
    }
};

// ==========================================
// Format Plate Number
// ==========================================
// Format plate number as user types (XX-XXX-XX)
function formatPlateNumber(input) {
    var value = input.value.replace(/[^0-9]/g, '');
    if (value.length > 2 && value.length <= 5) {
        value = value.slice(0, 2) + '-' + value.slice(2);
    } else if (value.length > 5) {
        value = value.slice(0, 2) + '-' + value.slice(2, 5) + '-' + value.slice(5, 7);
    }
    input.value = value;
}

// ==========================================
// Helper function to safely convert timestamp to millis
// ==========================================
function safeToMillis(timestamp) {
    if (!timestamp) return null;
    // If it's a Firestore Timestamp with toMillis method
    if (timestamp && typeof timestamp.toMillis === 'function') {
        return timestamp.toMillis();
    }
    // If it's already a number (milliseconds)
    if (typeof timestamp === 'number') {
        return timestamp;
    }
    // If it's a string date
    if (typeof timestamp === 'string') {
        var date = new Date(timestamp);
        return isNaN(date.getTime()) ? null : date.getTime();
    }
    // If it has seconds property (Firestore Timestamp format)
    if (timestamp && timestamp.seconds) {
        return timestamp.seconds * 1000;
    }
    return null;
}

// ==========================================
// Compress Image Function
// ==========================================
async function compressImage(file, maxSizeKB = 700) {
    return new Promise((resolve, reject) => {
        // Simple validation
        if (!file || !file.type || !file.type.startsWith('image/')) {
            reject(new Error('קובץ לא תקין'));
            return;
        }

        var reader = new FileReader();

        reader.onerror = () => {
            reject(new Error('שגיאה בקריאת הקובץ'));
        };

        reader.onload = (event) => {
            var img = new Image();

            img.onerror = () => {
                reject(new Error('לא ניתן לטעון את התמונה'));
            };

            img.onload = () => {
                try {
                    // Create canvas
                    var canvas = document.createElement('canvas');
                    var width = img.width || 800;
                    var height = img.height || 600;

                    // Resize if too large
                    var maxDimension = 1200;
                    if (width > maxDimension || height > maxDimension) {
                        if (width > height) {
                            height = Math.round((height * maxDimension) / width);
                            width = maxDimension;
                        } else {
                            width = Math.round((width * maxDimension) / height);
                            height = maxDimension;
                        }
                    }

                    canvas.width = width;
                    canvas.height = height;

                    // Get context
                    var ctx = canvas.getContext('2d');
                    if (!ctx) {
                        reject(new Error('שגיאה ביצירת Canvas'));
                        return;
                    }

                    // White background for transparency
                    ctx.fillStyle = '#FFFFFF';
                    ctx.fillRect(0, 0, width, height);

                    // Draw image
                    ctx.drawImage(img, 0, 0, width, height);

                    // Convert to JPEG with compression
                    var quality = 0.8;
                    var result = canvas.toDataURL('image/jpeg', quality);

                    // Try to reduce size if needed (max 5 attempts)
                    for (var i = 0; i < 5 && result.length > maxSizeKB * 1024 * 1.37; i++) {
                        quality -= 0.1;
                        if (quality < 0.3) break;
                        result = canvas.toDataURL('image/jpeg', quality);
                    }

                    resolve(result);
                } catch (error) {
                    reject(new Error('שגיאה בעיבוד התמונה'));
                }
            };

            // Set image source
            try {
                img.src = event.target.result;
            } catch (error) {
                reject(new Error('שגיאה בהגדרת התמונה'));
            }
        };

        // Read file
        try {
            reader.readAsDataURL(file);
        } catch (error) {
            reject(new Error('שגיאה בקריאת הקובץ'));
        }
    });
}

// ==========================================
// Calculate Total Cost
// ==========================================
function calculateTotalCost() {
    var partsCost = parseFloat(document.getElementById('partsCost').value) || 0;
    var laborCost = parseFloat(document.getElementById('laborCost').value) || 0;
    var otherCost = parseFloat(document.getElementById('otherCost').value) || 0;
    var total = partsCost + laborCost + otherCost;
    document.getElementById('totalCostDisplay').textContent = total.toFixed(2);
    return total;
}
