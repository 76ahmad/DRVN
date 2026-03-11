// DRVN Garage - Car & Maintenance Management

// Drive Type Toggle
function selectDriveType(type) {
    document.getElementById('driveType').value = type;
    document.querySelectorAll('.drive-type-btn').forEach(function(btn) {
        btn.classList.remove('active');
    });
    var selected = document.querySelector('.drive-type-btn[data-drive="' + type + '"]');
    if (selected) selected.classList.add('active');
}

function resetDriveType() {
    document.getElementById('driveType').value = '';
    document.querySelectorAll('.drive-type-btn').forEach(function(btn) {
        btn.classList.remove('active');
    });
}

// Skeleton Loader for Cars
function showCarLoader() {
    var grid = document.getElementById('carsGrid');
    if (!grid) return;

    var skeletonCard = '<div class="skeleton-card">' +
        '<div class="skeleton-image skeleton-pulse"></div>' +
        '<div style="padding: 1.5rem;">' +
            '<div style="display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 1rem;">' +
                '<div style="flex: 1;">' +
                    '<div class="skeleton-line-lg skeleton-pulse" style="width: 55%;"></div>' +
                    '<div class="skeleton-line skeleton-pulse" style="width: 40%;"></div>' +
                    '<div class="skeleton-badge skeleton-pulse" style="margin-top: 0.75rem;"></div>' +
                '</div>' +
                '<div class="skeleton-circle skeleton-pulse"></div>' +
            '</div>' +
            '<div style="border-top: 1px solid var(--border-color); margin-bottom: 1rem;"></div>' +
            '<div style="margin-bottom: 1.25rem;">' +
                '<div class="skeleton-line skeleton-pulse" style="width: 60%;"></div>' +
                '<div class="skeleton-line skeleton-pulse" style="width: 70%;"></div>' +
                '<div class="skeleton-line skeleton-pulse" style="width: 50%;"></div>' +
                '<div class="skeleton-line skeleton-pulse" style="width: 45%;"></div>' +
            '</div>' +
            '<div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.5rem;">' +
                '<div class="skeleton-btn skeleton-pulse"></div>' +
                '<div class="skeleton-btn skeleton-pulse"></div>' +
                '<div class="skeleton-btn skeleton-pulse"></div>' +
            '</div>' +
        '</div>' +
    '</div>';

    grid.innerHTML = skeletonCard + skeletonCard + skeletonCard;
}

function removeCarLoader() {
    var grid = document.getElementById('carsGrid');
    if (!grid) return;
    var skeletons = grid.querySelectorAll('.skeleton-card');
    if (skeletons.length === 0) return;
    skeletons.forEach(function(s) {
        s.style.opacity = '0';
        s.style.transition = 'opacity 0.3s ease';
    });
    setTimeout(function() {
        skeletons.forEach(function(s) { s.remove(); });
    }, 300);
}

// Load Cars
async function loadCars() {
    try {
        showCarLoader();

        const snapshot = await db.collection('cars')
            .where('userId', '==', currentUser.uid)
            .get();

        cars = [];
        snapshot.forEach(doc => {
            cars.push({ id: doc.id, ...doc.data() });
        });

        displayCars();

        // Load spare parts contacts
        await loadSparePartsContacts();
    } catch (error) {
        console.error('Error loading cars:', error);
        removeCarLoader();
    }
}

// Display Cars
function displayCars() {
    const grid = document.getElementById('carsGrid');
    const emptyState = document.getElementById('emptyState');

    if (cars.length === 0) {
        grid.innerHTML = '';
        emptyState.classList.remove('hidden');
        return;
    }

    emptyState.classList.add('hidden');

    grid.innerHTML = cars.map(car => `
        <div class="card border-4 border-gray-800 shadow-xl" data-car-id="${car.id}" data-search="${car.plateNumber} ${car.ownerName || ''} ${car.phone || ''} ${car.carType || ''} ${car.model || ''} ${car.year || ''}">
            ${car.imageUrl ?
                `<div class="relative overflow-hidden cursor-pointer group" onclick="viewCarDetails('${car.id}')">
                    <img src="${car.imageUrl}" class="car-image">
                    <div class="absolute inset-0 bg-gradient-to-t from-black/60 via-black/0 to-black/0 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                        <div class="absolute bottom-4 left-4 right-4">
                            <p class="text-white font-bold text-sm">לחץ לפרטים מלאים →</p>
                        </div>
                    </div>
                </div>` :
                `<div class="car-image-placeholder cursor-pointer group" onclick="viewCarDetails('${car.id}')">
                    <div class="text-center">
                        <div class="text-5xl mb-2 opacity-20 group-hover:opacity-40 transition-opacity">🚗</div>
                        <p class="text-sm text-gray-400 font-medium">אין תמונה</p>
                    </div>
                </div>`
            }
            <div class="p-6">
                <div class="flex items-start justify-between mb-4">
                    <div class="flex-1">
                        <h3 class="text-xl font-bold text-gray-900 cursor-pointer hover:text-amber-600 transition-colors mb-2" onclick="viewCarDetails('${car.id}')">${car.plateNumber}</h3>
                        ${car.ownerName ? `<p class="text-gray-700 font-semibold text-base">${car.ownerName}</p>` : ''}
                        ${car.carStatus ? `
                            <span class="inline-flex items-center gap-1 mt-3 text-xs px-3 py-1.5 rounded-lg font-semibold ${
                                car.carStatus === 'waiting' ? 'status-waiting' :
                                car.carStatus === 'in_progress' ? 'status-progress' :
                                car.carStatus === 'ready' ? 'status-ready' :
                                'status-completed'
                            }">
                                ${
                                    car.carStatus === 'waiting' ? '⏳ ממתין לטיפול' :
                                    car.carStatus === 'in_progress' ? '🔧 בטיפול' :
                                    car.carStatus === 'ready' ? '✅ מוכן לאיסוף' :
                                    '🏁 הושלם'
                                }
                            </span>
                        ` : ''}
                    </div>
                    <span class="badge badge-primary">
                        <span class="text-base">🚗</span>
                    </span>
                </div>

                <div class="divider mb-4"></div>

                <div class="space-y-2.5 mb-5">
                    ${car.phone ? `<div class="info-item"><span class="text-base">📞</span><span>${car.phone}</span></div>` : ''}
                    ${car.carType ? `<div class="info-item"><span class="text-base">🏷️</span><strong>${car.carType}</strong></div>` : ''}
                    ${car.model ? `<div class="info-item"><span class="text-base">📋</span><span>${car.model}</span></div>` : ''}
                    ${car.year ? `<div class="info-item"><span class="text-base">📅</span><span>${car.year}</span></div>` : ''}
                </div>

                <!-- Quick Actions for Mobile -->
                ${car.phone ? `
                <div class="mobile-quick-actions">
                    <button onclick="requirePremium('call', () => window.location.href='tel:${car.phone}')" class="quick-action-btn bg-green-500 hover:bg-green-600">
                        📞 <span class="hidden sm:inline">התקשר</span>
                    </button>
                    <button onclick="requirePremium('whatsapp', () => window.location.href='https://api.whatsapp.com/send?phone=972${car.phone.replace(/^0/, '')}')" class="quick-action-btn bg-emerald-500 hover:bg-emerald-600">
                        💬 <span class="hidden sm:inline">WhatsApp</span>
                    </button>
                </div>
                ` : ''}

                <div class="space-y-2.5">
                    <div class="grid grid-cols-3 gap-2">
                        <button onclick="currentCarId='${car.id}'; openMaintenanceModal()" class="btn btn-success text-xs py-2.5">
                            + טיפול
                        </button>
                        <button onclick="editCar('${car.id}')" class="btn btn-primary text-xs py-2.5">
                            ערוך
                        </button>
                        <button onclick="deleteCar('${car.id}')" class="btn btn-danger text-xs py-2.5">
                            מחק
                        </button>
                    </div>
                    ${!car.carStatus ? `
                        <button onclick="addCarToDashboard('${car.id}')" class="btn btn-secondary w-full text-xs py-2.5">
                            📊 הוסף ללוח בקרה
                        </button>
                    ` : ''}
                </div>
            </div>
        </div>
    `).join('');
}

// View Car Details
async function viewCarDetails(carId) {
    currentCarId = carId;
    const car = cars.find(c => c.id === carId);
    if (!car) return;

    // Display car details
    document.getElementById('detailsPlateNumber').textContent = car.plateNumber;

    // No phone action buttons - removed as per user request
    const phoneButtons = '';

    document.getElementById('carDetailsContent').innerHTML = `
        ${phoneButtons}

        <!-- Car Image with Change Button -->
        <div class="mb-6">
            ${car.imageUrl ? `
                <div class="relative">
                    <img src="${car.imageUrl}" class="w-full max-h-64 object-contain rounded border">
                </div>
            ` : `
            `}
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            ${car.ownerName ? `<div><span class="font-bold">שם הבעלים:</span> ${car.ownerName}</div>` : ''}
            ${car.phone ? `<div><span class="font-bold">טלפון:</span> ${car.phone}</div>` : ''}
            ${car.carType ? `<div><span class="font-bold">סוג רכב:</span> ${car.carType}</div>` : ''}
            ${car.model ? `<div><span class="font-bold">דגם:</span> ${car.model}</div>` : ''}
            ${car.year ? `<div><span class="font-bold">שנת ייצור:</span> ${car.year}</div>` : ''}
            ${car.vinCode ? `<div><span class="font-bold">קוד רכב (VIN):</span> ${car.vinCode}</div>` : ''}
            ${car.immobilizerCode ? `<div class="bg-yellow-50 border border-yellow-300 p-2 rounded"><span class="font-bold">🔑 קוד התנעה:</span> <span class="font-mono">${car.immobilizerCode}</span></div>` : ''}
            ${car.engineType ? `<div><span class="font-bold">סוג מנוע:</span> ${car.engineType}</div>` : ''}
            ${car.enginePower ? `<div><span class="font-bold">הספק מנוע:</span> ${car.enginePower}</div>` : ''}
            ${car.driveType ? `<div><span class="font-bold">סוג הנעה:</span> ${car.driveType === 'front' ? '⬆️ קדמי (FWD)' : car.driveType === 'rear' ? '⬇️ אחורי (RWD)' : '🔄 4x4 (AWD)'}</div>` : ''}
        </div>
    `;

    // Load maintenance history
    await loadMaintenanceHistory(carId);

    document.getElementById('carDetailsModal').classList.remove('hidden');
    document.body.classList.add('modal-open');
    hideUIElements(); // إخفاء FAB والقائمة السفلية
}

// Load Maintenance History
async function loadMaintenanceHistory(carId) {
    try {
        // Get car data first
        const car = cars.find(c => c.id === carId);

        const snapshot = await db.collection('maintenance')
            .where('carId', '==', carId)
            .where('userId', '==', currentUser.uid)
            .get();

        const maintenanceList = [];
        snapshot.forEach(doc => {
            maintenanceList.push({ id: doc.id, ...doc.data() });
        });

        // Sort by createdAt in JavaScript (no Firestore index needed)
        maintenanceList.sort((a, b) => {
            const dateA = safeToMillis(a.createdAt) || 0;
            const dateB = safeToMillis(b.createdAt) || 0;
            return dateB - dateA; // Newest first
        });

        const historyDiv = document.getElementById('maintenanceHistory');

        if (maintenanceList.length === 0) {
            historyDiv.innerHTML = '<p class="text-gray-500 text-center py-4">אין טיפולים עדיין</p>';
            return;
        }

        historyDiv.innerHTML = maintenanceList.map(m => {
            return `
                <div class="border rounded-lg p-4 bg-gray-50">
                    <div class="flex justify-between items-start mb-3">
                        <div class="flex-1">
                            ${m.date ? `<div class="font-bold text-lg mb-1">📅 ${new Date(m.date).toLocaleDateString('he-IL')}</div>` : ''}
                            ${m.kilometers ? `<div class="text-sm text-gray-600">🚗 ${m.kilometers} ק״מ</div>` : ''}
                        </div>
                        <div class="flex gap-2">
                            <button onclick="orderSparePartFromMaintenance('${car.id}', '${m.partName || ""}', '${m.workDescription || ""}')" class="text-green-600 hover:underline text-sm">📦 הזמן חלק</button>
                            <button onclick="printMaintenance('${m.id}')" class="text-purple-600 hover:underline text-sm">🖨️ הדפס</button>
                            <button onclick="editMaintenance('${m.id}')" class="text-blue-600 hover:underline text-sm">עריכה</button>
                            <button onclick="deleteMaintenance('${m.id}')" class="text-red-600 hover:underline text-sm">מחיקה</button>
                        </div>
                    </div>

                    ${m.partName ? `<p class="mb-2"><strong>🔧 חלק:</strong> ${m.partName}</p>` : ''}
                    ${m.workDescription ? `<p class="mb-2"><strong>תיאור:</strong> ${m.workDescription}</p>` : ''}

                    ${m.totalCost > 0 ? `
                        <div class="text-lg font-bold text-green-700 mb-2">
                            💰 ${m.totalCost.toFixed(2)} ₪
                        </div>
                    ` : ''}

                    ${m.images && m.images.length > 0 ? `
                        <div class="grid grid-cols-3 gap-2 mt-2">
                            ${m.images.map(img => `<img src="${img}" class="w-full h-24 object-cover rounded cursor-pointer" onclick="window.open('${img}')">`).join('')}
                        </div>
                    ` : ''}
                </div>
            `;
        }).join('');

    } catch (error) {
        console.error('Error loading maintenance:', error);
    }
}

// Close Car Details Modal
function closeCarDetailsModal() {
    document.getElementById('carDetailsModal').classList.add('hidden');
    document.body.classList.remove('modal-open');
    showUIElements(); // إظهار FAB والقائمة السفلية
    currentCarId = null;
}

// Open Car Modal
function openCarModal() {
    editingCarId = null;
    document.getElementById('modalTitle').textContent = 'הוסף רכב';
    document.getElementById('carForm').reset();
    document.getElementById('imagePreview').innerHTML = '';
    resetDriveType();
    document.getElementById('carModal').classList.remove('hidden');
    document.body.classList.add('modal-open');
    hideUIElements(); // إخفاء FAB والقائمة السفلية
}

// Close Car Modal
function closeCarModal() {
    document.getElementById('carModal').classList.add('hidden');
    document.body.classList.remove('modal-open');
    editingCarId = null;
    showUIElements(); // إظهار FAB والقائمة السفلية
}

// Edit Car
function editCar(carId) {
    // Check subscription
    if (!canModifyData()) {
        showUpgradeMessage();
        return;
    }

    const car = cars.find(c => c.id === carId);
    if (!car) return;

    editingCarId = carId;
    document.getElementById('modalTitle').textContent = 'ערוך רכב';
    document.getElementById('plateNumber').value = car.plateNumber || '';
    document.getElementById('ownerName').value = car.ownerName || '';
    document.getElementById('phone').value = car.phone || '';
    document.getElementById('carType').value = car.carType || '';
    document.getElementById('model').value = car.model || '';
    document.getElementById('year').value = car.year || '';
    document.getElementById('immobilizerCode').value = car.immobilizerCode || '';
    document.getElementById('engineType').value = car.engineType || '';
    document.getElementById('enginePower').value = car.enginePower || '';

    // Load drive type
    if (car.driveType) {
        selectDriveType(car.driveType);
    } else {
        resetDriveType();
    }

    // إعادة تعيين حقل الصورة بالكامل
    const imageInput = document.getElementById('carImage');
    imageInput.value = '';
    // إعادة إنشاء العنصر لإزالة أي قيود
    const newImageInput = imageInput.cloneNode(true);
    imageInput.parentNode.replaceChild(newImageInput, imageInput);

    // إعادة إضافة event listener
    newImageInput.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        const previewDiv = document.getElementById('imagePreview');

        if (!file) {
            previewDiv.innerHTML = '';
            return;
        }

        // Show loading
        previewDiv.innerHTML = `
            <div class="text-center py-4">
                <div class="inline-block animate-spin rounded-full h-8 w-8 border-4 border-gray-300 border-t-amber-500"></div>
                <p class="text-sm text-gray-600 mt-2">מעבד תמונה...</p>
            </div>
        `;

        // Small delay to show loading
        await new Promise(resolve => setTimeout(resolve, 100));

        try {
            const originalSizeMB = (file.size / (1024 * 1024)).toFixed(2);

            // Compress image
            const compressed = await compressImage(file, 700);
            const compressedSizeKB = (compressed.length / 1024 / 1.37).toFixed(0);

            // Show preview with change button
            previewDiv.innerHTML = `
                <div class="inline-block">
                    <img src="${compressed}" class="w-48 h-48 object-cover rounded-lg border-2 border-green-400 shadow-lg" alt="תצוגה מקדימה חדשה">
                    <div class="mt-3 text-center">
                        <p class="text-sm text-green-600 font-bold mb-2">✓ התמונה החדשה נדחסה בהצלחה</p>
                        <p class="text-xs text-gray-500 mb-3">${originalSizeMB}MB → ${compressedSizeKB}KB</p>
                        <button type="button" onclick="document.getElementById('carImage').value=''; document.getElementById('carImage').click();"
                                class="bg-amber-500 hover:bg-amber-600 text-white px-4 py-2 rounded-lg font-semibold transition-all">
                            🔄 שנה תמונה
                        </button>
                    </div>
                </div>
            `;
        } catch (error) {
            // Show error
            const errorMsg = error.message || 'שגיאה לא ידועה';
            previewDiv.innerHTML = `
                <div class="bg-red-50 border border-red-300 rounded-lg p-4 text-center">
                    <p class="text-red-700 text-sm font-semibold mb-2">❌ ${errorMsg}</p>
                    <p class="text-red-600 text-xs mb-2">נסה להשתמש בתמונה אחרת</p>
                    <button type="button" onclick="document.getElementById('carImage').value=''; document.getElementById('imagePreview').innerHTML=''; document.getElementById('carImage').click();"
                            class="text-xs bg-red-600 text-white px-3 py-1 rounded hover:bg-red-700">
                        נסה שוב
                    </button>
                </div>
            `;
            e.target.value = '';
        }
    });

    if (car.imageUrl) {
        document.getElementById('imagePreview').innerHTML =
            `<div class="inline-block">
                <img src="${car.imageUrl}" class="w-48 h-48 object-cover rounded-lg border-2 border-amber-400 shadow-lg" alt="תמונה נוכחית">
                <div class="mt-3 text-center">
                    <p class="text-xs text-blue-600 font-semibold mb-2">📷 תמונה נוכחית</p>
                    <button type="button" onclick="document.getElementById('carImage').click()" class="bg-amber-500 hover:bg-amber-600 text-white px-4 py-2 rounded-lg font-semibold transition-all">
                        🔄 שנה תמונה
                    </button>
                    <p class="text-xs text-gray-600 mt-2">או לחץ על איזור ההעלאה למעלה</p>
                </div>
            </div>`;
    } else {
        document.getElementById('imagePreview').innerHTML = '';
    }

    document.getElementById('carModal').classList.remove('hidden');
    document.body.classList.add('modal-open');
}

// Car Form Submit
document.getElementById('carForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    // Check subscription
    if (!canModifyData()) {
        showUpgradeMessage();
        return;
    }

    const submitBtn = e.target.querySelector('button[type="submit"]');
    const originalText = submitBtn.textContent;
    submitBtn.disabled = true;
    submitBtn.textContent = 'שומר...';

    try {
        // Rate limiting check
        if (!RateLimiter.canPerform('saveCar')) {
            const waitTime = RateLimiter.getTimeUntilReset('saveCar');
            alert(`יותר מדי פעולות. נסה שוב בעוד ${waitTime} שניות`);
            submitBtn.disabled = false;
            submitBtn.textContent = originalText;
            return;
        }
        RateLimiter.recordAction('saveCar');

        const plateNumber = document.getElementById('plateNumber').value.trim();

        // Check for duplicate plate number (only when adding new car or changing plate number)
        if (!editingCarId || (editingCarId && plateNumber !== cars.find(c => c.id === editingCarId)?.plateNumber)) {
            const duplicateCar = cars.find(c => c.plateNumber === plateNumber && c.id !== editingCarId);

            if (duplicateCar) {
                alert('⚠️ הרכב כבר קיים במערכת!\n\nמספר רישוי: ' + plateNumber + '\nבעלים: ' + duplicateCar.ownerName);
                submitBtn.disabled = false;
                submitBtn.textContent = originalText;
                return;
            }
        }

        // Validate inputs
        const phone = document.getElementById('phone').value.trim();
        if (phone && !isValidPhone(phone)) {
            alert('מספר טלפון לא תקין');
            submitBtn.disabled = false;
            submitBtn.textContent = originalText;
            return;
        }

        // Sanitize and create car data
        const carData = {
            plateNumber: sanitizeInput(plateNumber),
            ownerName: sanitizeInput(document.getElementById('ownerName').value.trim()),
            phone: sanitizeInput(phone),
            carType: sanitizeInput(document.getElementById('carType').value.trim()),
            model: sanitizeInput(document.getElementById('model').value.trim()),
            year: sanitizeInput(document.getElementById('year').value.trim()),
            immobilizerCode: sanitizeInput(document.getElementById('immobilizerCode').value.trim()),
            engineType: sanitizeInput(document.getElementById('engineType').value.trim()),
            enginePower: sanitizeInput(document.getElementById('enginePower').value.trim()),
            driveType: document.getElementById('driveType').value || '',
            userId: currentUser.uid,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        };

        // Only add carStatus if editing existing car that has status
        if (editingCarId) {
            const existingCar = cars.find(c => c.id === editingCarId);
            if (existingCar && existingCar.carStatus) {
                carData.carStatus = existingCar.carStatus;
            }
        }

        const imageFile = document.getElementById('carImage').files[0];
        if (imageFile) {
            try {
                submitBtn.textContent = 'דוחס תמונה...';
                const compressedImage = await compressImage(imageFile, 700);
                carData.imageUrl = compressedImage;
                submitBtn.textContent = 'שומר נתונים...';
            } catch (imageError) {
                console.error('Image compression error:', imageError);
                alert('שגיאה בעיבוד התמונה. אנא נסה שוב.');
                submitBtn.disabled = false;
                submitBtn.textContent = originalText;
                return;
            }
        } else if (editingCarId) {
            const existingCar = cars.find(c => c.id === editingCarId);
            if (existingCar && existingCar.imageUrl) {
                carData.imageUrl = existingCar.imageUrl;
            }
        }

        if (editingCarId) {
            await db.collection('cars').doc(editingCarId).update(carData);
            alert('הרכב עודכן בהצלחה!');
        } else {
            carData.createdAt = firebase.firestore.FieldValue.serverTimestamp();
            await db.collection('cars').add(carData);
            alert('הרכב נוסף בהצלחה!');
        }

        document.getElementById('carForm').reset();
        document.getElementById('imagePreview').innerHTML = '';
        closeCarModal();
        await loadCars();

    } catch (error) {
        console.error('Error saving car:', error);
        alert('שגיאה: ' + (error.message || 'לא ניתן לשמור את הנתונים'));
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = originalText;
    }
});

// Delete Car
async function deleteCar(carId) {
    // Check subscription
    if (!canModifyData()) {
        showUpgradeMessage();
        return;
    }

    // Rate limiting check
    if (!RateLimiter.canPerform('deleteRecord')) {
        const waitTime = RateLimiter.getTimeUntilReset('deleteRecord');
        alert(`יותר מדי פעולות מחיקה. נסה שוב בעוד ${waitTime} שניות`);
        return;
    }

    if (!confirm('האם למחוק את הרכב? גם כל הטיפולים יימחקו.')) return;

    RateLimiter.recordAction('deleteRecord');

    try {
        // Delete all maintenance records
        const maintenanceSnapshot = await db.collection('maintenance')
            .where('carId', '==', carId)
            .where('userId', '==', currentUser.uid)
            .get();

        const deletePromises = [];
        maintenanceSnapshot.forEach(doc => {
            deletePromises.push(doc.ref.delete());
        });
        await Promise.all(deletePromises);

        // Delete car
        await db.collection('cars').doc(carId).delete();
        alert('הרכב נמחק בהצלחה');
        await loadCars();
    } catch (error) {
        console.error('Error deleting car:', error);
        alert('שגיאה במחיקת הרכב');
    }
}

// Change Car Image
function changeCarImage(carId) {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.capture = 'environment'; // Enable camera on mobile
    input.onchange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        // Check if it's an image
        if (!file.type.startsWith('image/')) {
            alert('אנא בחר קובץ תמונה בלבד');
            return;
        }

        // Check file size (max 30MB)
        if (file.size > 30 * 1024 * 1024) {
            alert('הקובץ גדול מדי. גודל מקסימלי: 30MB');
            return;
        }

        try {
            // Show loading
            const loadingMsg = document.createElement('div');
            loadingMsg.id = 'imageLoadingMsg';
            loadingMsg.className = 'fixed top-4 left-1/2 transform -translate-x-1/2 bg-blue-600 text-white px-6 py-3 rounded-lg shadow-lg z-50';
            loadingMsg.textContent = '📷 מעלה תמונה...';
            document.body.appendChild(loadingMsg);

            // Convert to base64
            const reader = new FileReader();
            reader.onload = async (event) => {
                try {
                    const imageUrl = event.target.result;

                    // Update car in database
                    await db.collection('cars').doc(carId).update({
                        imageUrl: imageUrl,
                        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                    });

                    // Remove loading message
                    const msg = document.getElementById('imageLoadingMsg');
                    if (msg) document.body.removeChild(msg);

                    // Show success
                    alert('✅ התמונה עודכנה בהצלחה!');

                    // Reload car details
                    await loadCars();
                    viewCarDetails(carId);

                } catch (error) {
                    const msg = document.getElementById('imageLoadingMsg');
                    if (msg) document.body.removeChild(msg);
                    console.error('Error updating image:', error);
                    alert('שגיאה בעדכון התמונה');
                }
            };

            reader.onerror = () => {
                const msg = document.getElementById('imageLoadingMsg');
                if (msg) document.body.removeChild(msg);
                alert('שגיאה בקריאת הקובץ');
            };

            reader.readAsDataURL(file);

        } catch (error) {
            console.error('Error processing image:', error);
            alert('שגיאה בעיבוד התמונה');
        }
    };
    input.click();
}

// Delete Car Image
async function deleteCarImage(carId) {
    if (!confirm('האם למחוק את התמונה?')) return;

    try {
        await db.collection('cars').doc(carId).update({
            imageUrl: firebase.firestore.FieldValue.delete(),
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        alert('✅ התמונה נמחקה בהצלחה!');
        await loadCars();
        viewCarDetails(carId);

    } catch (error) {
        console.error('Error deleting image:', error);
        alert('שגיאה במחיקת התמונה');
    }
}

// Open Maintenance Modal
function openMaintenanceModal() {
    // Check subscription
    if (!canModifyData()) {
        showUpgradeMessage();
        return;
    }

    if (!currentCarId) {
        alert('אנא בחר רכב תחילה');
        return;
    }

    editingMaintenanceId = null;
    maintenanceImages = [];
    document.getElementById('maintenanceForm').reset();
    document.getElementById('maintenanceImagesPreview').innerHTML = '';

    // Set today's date as default
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('maintenanceDate').value = today;

    document.getElementById('maintenanceModal').classList.remove('hidden');
    document.body.classList.add('modal-open');
}

// Close Maintenance Modal
function closeMaintenanceModal() {
    document.getElementById('maintenanceModal').classList.add('hidden');
    document.body.classList.remove('modal-open');
    editingMaintenanceId = null;
    maintenanceImages = [];
}

// Edit Maintenance
async function editMaintenance(maintenanceId) {
    // Check subscription
    if (!canModifyData()) {
        showUpgradeMessage();
        return;
    }

    try {
        const doc = await db.collection('maintenance').doc(maintenanceId).get();
        if (!doc.exists) return;

        const m = doc.data();
        editingMaintenanceId = maintenanceId;

        document.getElementById('maintenanceDate').value = m.date || '';
        document.getElementById('kilometers').value = m.kilometers || '';
        document.getElementById('partName').value = m.partName || '';
        document.getElementById('workDescription').value = m.workDescription || '';
        document.getElementById('totalCost').value = m.totalCost || '';

        maintenanceImages = m.images || [];

        if (maintenanceImages.length > 0) {
            document.getElementById('maintenanceImagesPreview').innerHTML =
                maintenanceImages.map((img, i) => `
                    <div class="relative">
                        <img src="${img}" class="w-full h-24 object-cover rounded">
                        <button type="button" onclick="removeMaintenanceImage(${i})" class="absolute top-0 right-0 bg-red-500 text-white rounded-full w-6 h-6 text-xs">×</button>
                    </div>
                `).join('');
        }

        document.getElementById('maintenanceModal').classList.remove('hidden');

    } catch (error) {
        console.error('Error loading maintenance:', error);
    }
}

// Delete Maintenance
async function deleteMaintenance(maintenanceId) {
    // Rate limiting check
    if (!RateLimiter.canPerform('deleteRecord')) {
        const waitTime = RateLimiter.getTimeUntilReset('deleteRecord');
        alert(`יותר מדי פעולות מחיקה. נסה שוב בעוד ${waitTime} שניות`);
        return;
    }

    if (!confirm('האם למחוק את הטיפול?')) return;

    RateLimiter.recordAction('deleteRecord');

    try {
        await db.collection('maintenance').doc(maintenanceId).delete();
        alert('הטיפול נמחק בהצלחה');
        await loadMaintenanceHistory(currentCarId);
    } catch (error) {
        console.error('Error deleting maintenance:', error);
        alert('שגיאה במחיקת הטיפול');
    }
}

// Print Maintenance
async function printMaintenance(maintenanceId) {
    try {
        const doc = await db.collection('maintenance').doc(maintenanceId).get();
        if (!doc.exists) return;

        const m = doc.data();
        const car = cars.find(c => c.id === currentCarId);

        const printWindow = window.open('', '_blank');
        printWindow.document.write(`
            <!DOCTYPE html>
            <html lang="he" dir="rtl">
            <head>
                <meta charset="UTF-8">
                <title>דוח טיפול - ${car.plateNumber}</title>
                <style>
                    body {
                        font-family: Arial, sans-serif;
                        direction: rtl;
                        padding: 20px;
                        max-width: 800px;
                        margin: 0 auto;
                    }
                    .header {
                        text-align: center;
                        border-bottom: 3px solid #333;
                        padding-bottom: 20px;
                        margin-bottom: 30px;
                    }
                    .header h1 {
                        margin: 0;
                        font-size: 32px;
                    }
                    .header p {
                        margin: 5px 0;
                        color: #666;
                    }
                    .section {
                        margin-bottom: 20px;
                    }
                    .section-title {
                        font-weight: bold;
                        font-size: 18px;
                        border-bottom: 2px solid #eee;
                        padding-bottom: 5px;
                        margin-bottom: 10px;
                    }
                    .info-row {
                        margin: 10px 0;
                        font-size: 16px;
                    }
                    .info-label {
                        font-weight: bold;
                        display: inline-block;
                        width: 150px;
                    }
                    .cost {
                        font-size: 28px;
                        font-weight: bold;
                        color: #22c55e;
                        text-align: center;
                        padding: 20px;
                        border: 2px solid #22c55e;
                        border-radius: 10px;
                        margin: 20px 0;
                    }
                    .footer {
                        margin-top: 50px;
                        text-align: center;
                        color: #666;
                        font-size: 14px;
                        border-top: 1px solid #eee;
                        padding-top: 20px;
                    }
                    @media print {
                        body {
                            padding: 0;
                        }
                        .no-print {
                            display: none;
                        }
                    }
                </style>
            </head>
            <body>
                <div class="header">
                    <h1>דוח טיפול</h1>
                    <p>${new Date().toLocaleDateString('he-IL', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
                </div>

                <div class="section">
                    <div class="section-title">פרטי רכב</div>
                    <div class="info-row">
                        <span class="info-label">מספר רישוי:</span>
                        <span>${car.plateNumber}</span>
                    </div>
                    ${car.ownerName ? `
                        <div class="info-row">
                            <span class="info-label">שם הבעלים:</span>
                            <span>${car.ownerName}</span>
                        </div>
                    ` : ''}
                    ${car.phone ? `
                        <div class="info-row">
                            <span class="info-label">טלפון:</span>
                            <span>${car.phone}</span>
                        </div>
                    ` : ''}
                    ${car.carType ? `
                        <div class="info-row">
                            <span class="info-label">סוג רכב:</span>
                            <span>${car.carType}</span>
                        </div>
                    ` : ''}
                    ${car.model ? `
                        <div class="info-row">
                            <span class="info-label">דגם:</span>
                            <span>${car.model}</span>
                        </div>
                    ` : ''}
                </div>

                ${m.workDescription ? `
                    <div class="section">
                        <div class="section-title">תיאור העבודה</div>
                        <div class="info-row">${m.workDescription}</div>
                    </div>
                ` : ''}

                ${m.parts ? `
                    <div class="section">
                        <div class="section-title">חלקי חילוף</div>
                        <div class="info-row">${m.parts}</div>
                    </div>
                ` : ''}

                ${m.notes ? `
                    <div class="section">
                        <div class="section-title">הערות</div>
                        <div class="info-row">${m.notes}</div>
                    </div>
                ` : ''}

                ${m.totalCost > 0 ? `
                    <div class="cost">
                        סה"כ לתשלום: ${m.totalCost.toFixed(2)} ₪
                    </div>
                ` : ''}

                <div class="footer">
                    <p>תודה שבחרת בשירותינו!</p>
                    <p>דוח זה הופק בתאריך ${new Date().toLocaleDateString('he-IL')}</p>
                </div>

                <div class="no-print" style="text-align: center; margin-top: 30px;">
                    <button onclick="window.print()" style="padding: 10px 30px; font-size: 16px; background: #3b82f6; color: white; border: none; border-radius: 5px; cursor: pointer;">
                        🖨️ הדפס
                    </button>
                    <button onclick="window.close()" style="padding: 10px 30px; font-size: 16px; background: #6b7280; color: white; border: none; border-radius: 5px; cursor: pointer; margin-right: 10px;">
                        סגור
                    </button>
                </div>
            </body>
            </html>
        `);
        printWindow.document.close();

    } catch (error) {
        console.error('Error printing maintenance:', error);
        alert('שגיאה בהדפסת הטיפול');
    }
}

// Remove Maintenance Image
function removeMaintenanceImage(index) {
    maintenanceImages.splice(index, 1);
    document.getElementById('maintenanceImagesPreview').innerHTML =
        maintenanceImages.map((img, i) => `
            <div class="relative">
                <img src="${img}" class="w-full h-24 object-cover rounded">
                <button type="button" onclick="removeMaintenanceImage(${i})" class="absolute top-0 right-0 bg-red-500 text-white rounded-full w-6 h-6 text-xs">×</button>
            </div>
        `).join('');
}

// Maintenance Form Submit
document.getElementById('maintenanceForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    const submitBtn = e.target.querySelector('button[type="submit"]');
    const originalText = submitBtn.textContent;
    submitBtn.disabled = true;
    submitBtn.textContent = 'שומר...';

    try {
        // Rate limiting check
        if (!RateLimiter.canPerform('saveMaintenance')) {
            const waitTime = RateLimiter.getTimeUntilReset('saveMaintenance');
            alert(`יותר מדי פעולות. נסה שוב בעוד ${waitTime} שניות`);
            submitBtn.disabled = false;
            submitBtn.textContent = originalText;
            return;
        }
        RateLimiter.recordAction('saveMaintenance');

        // Sanitize maintenance data
        const maintenanceData = {
            carId: currentCarId,
            userId: currentUser.uid,
            date: document.getElementById('maintenanceDate').value,
            kilometers: sanitizeInput(document.getElementById('kilometers').value),
            partName: sanitizeInput(document.getElementById('partName').value),
            workDescription: sanitizeInput(document.getElementById('workDescription').value),
            totalCost: parseFloat(document.getElementById('totalCost').value) || 0,
            images: maintenanceImages,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        };

        // Handle new images
        const imageFiles = document.getElementById('maintenanceImages').files;
        if (imageFiles.length > 0) {
            submitBtn.textContent = 'דוחס תמונות...';

            for (let i = 0; i < Math.min(imageFiles.length, 5); i++) {
                try {
                    const compressed = await compressImage(imageFiles[i], 500);
                    maintenanceImages.push(compressed);
                } catch (err) {
                    console.error('Image compression error:', err);
                }
            }

            maintenanceData.images = maintenanceImages;
        }

        submitBtn.textContent = 'שומר נתונים...';

        if (editingMaintenanceId) {
            await db.collection('maintenance').doc(editingMaintenanceId).update(maintenanceData);
            alert('הטיפול עודכן בהצלחה!');
        } else {
            maintenanceData.createdAt = firebase.firestore.FieldValue.serverTimestamp();
            await db.collection('maintenance').add(maintenanceData);
            alert('הטיפול נוסף בהצלחה!');
        }

        closeMaintenanceModal();
        await loadMaintenanceHistory(currentCarId);

    } catch (error) {
        console.error('Error saving maintenance:', error);
        alert('שגיאה: ' + (error.message || 'לא ניתן לשמור את הנתונים'));
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = originalText;
    }
});

// Handle car image selection from Camera or Gallery
async function handleCarImageSelect(input) {
    const file = input.files[0];
    if (file) {
        // Copy file to main carImage input for form submission
        const dataTransfer = new DataTransfer();
        dataTransfer.items.add(file);
        document.getElementById('carImage').files = dataTransfer.files;
        // Trigger the change event on main input
        document.getElementById('carImage').dispatchEvent(new Event('change'));
    }
}

// Image Preview - Simplified for mobile
document.getElementById('carImage').addEventListener('change', async (e) => {
    console.log('File input changed!');
    const file = e.target.files[0];
    console.log('Selected file:', file);
    const previewDiv = document.getElementById('imagePreview');

    if (!file) {
        console.log('No file selected');
        previewDiv.innerHTML = '';
        return;
    }

    console.log('File details:', {
        name: file.name,
        size: file.size,
        type: file.type
    });

    // Show loading
    previewDiv.innerHTML = `
        <div class="text-center py-4">
            <div class="inline-block animate-spin rounded-full h-8 w-8 border-4 border-gray-300 border-t-amber-500"></div>
            <p class="text-sm text-gray-600 mt-2">מעבד תמונה...</p>
        </div>
    `;

    // Small delay to show loading
    await new Promise(resolve => setTimeout(resolve, 100));

    try {
        console.log('Starting compression...');
        const originalSizeMB = (file.size / (1024 * 1024)).toFixed(2);

        // Compress image
        const compressed = await compressImage(file, 700);
        console.log('Compression successful!');
        const compressedSizeKB = (compressed.length / 1024 / 1.37).toFixed(0);

        // Show preview with change button
        previewDiv.innerHTML = `
            <div class="inline-block">
                <img src="${compressed}" class="w-48 h-48 object-cover rounded-lg border-2 border-green-400 shadow-lg" alt="תצוגה מקדימה">
                <div class="mt-3 text-center">
                    <p class="text-sm text-green-600 font-bold mb-2">✓ התמונה נדחסה בהצלחה</p>
                    <p class="text-xs text-gray-500 mb-3">${originalSizeMB}MB → ${compressedSizeKB}KB</p>
                    <button type="button" onclick="document.getElementById('carImage').value=''; document.getElementById('carImage').click();"
                            class="bg-amber-500 hover:bg-amber-600 text-white px-4 py-2 rounded-lg font-semibold transition-all">
                        🔄 שנה תמונה
                    </button>
                </div>
            </div>
        `;
    } catch (error) {
        console.error('Compression error:', error);
        // Show error
        const errorMsg = error.message || 'שגיאה לא ידועה';
        previewDiv.innerHTML = `
            <div class="bg-red-50 border border-red-300 rounded-lg p-4 text-center">
                <p class="text-red-700 text-sm font-semibold mb-2">❌ ${errorMsg}</p>
                <p class="text-red-600 text-xs mb-2">נסה להשתמש בתמונה אחרת</p>
                <button type="button" onclick="document.getElementById('carImage').value=''; document.getElementById('imagePreview').innerHTML=''; document.getElementById('carImage').click();"
                        class="text-xs bg-red-600 text-white px-3 py-1 rounded hover:bg-red-700">
                    נסה שוב
                </button>
            </div>
        `;
        e.target.value = '';
    }
});

// Handle maintenance image selection from Camera or Gallery
function handleMaintenanceImageSelect(input) {
    const files = input.files;
    if (files.length > 0) {
        // Get existing files from main input
        const mainInput = document.getElementById('maintenanceImages');
        const dataTransfer = new DataTransfer();

        // Add existing files
        if (mainInput.files) {
            for (let i = 0; i < mainInput.files.length; i++) {
                dataTransfer.items.add(mainInput.files[i]);
            }
        }

        // Add new files (max 5 total)
        for (let i = 0; i < files.length && dataTransfer.files.length < 5; i++) {
            dataTransfer.items.add(files[i]);
        }

        mainInput.files = dataTransfer.files;
        mainInput.dispatchEvent(new Event('change'));
    }
}

// Maintenance Images Preview
document.getElementById('maintenanceImages').addEventListener('change', async (e) => {
    const files = e.target.files;
    const previewDiv = document.getElementById('maintenanceImagesPreview');

    if (files.length > 0) {
        const previews = [];
        for (let i = 0; i < Math.min(files.length, 5); i++) {
            const file = files[i];
            if (file.type.match(/image\/(jpeg|jpg|png|gif)/)) {
                const reader = new FileReader();
                const preview = await new Promise((resolve) => {
                    reader.onload = (e) => resolve(e.target.result);
                    reader.readAsDataURL(file);
                });
                previews.push(preview);
            }
        }

        previewDiv.innerHTML = previews.map((img, i) => `
            <img src="${img}" class="w-full h-24 object-cover rounded">
        `).join('');
    }
});
