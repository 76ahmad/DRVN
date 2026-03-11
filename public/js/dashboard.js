// DRVN Garage - Dashboard & Kanban Board

        // WhatsApp notification toggle
        var whatsappNotifyEnabled = localStorage.getItem('whatsappNotify') !== 'false'; // default ON

        // Default WhatsApp messages
        var defaultWhatsAppMessages = {
            in_progress: 'שלום {name}, רכבך {plate} נכנס לטיפול במוסך שלנו 🔧\nנעדכן אותך כשיהיה מוכן לאיסוף.',
            ready: 'שלום {name}, רכבך {plate} מוכן ומחכה לאיסוף ✅\nניתן לבוא לקחת את הרכב.',
            completed: 'שלום {name}, רכבך {plate} נמסר בהצלחה 🎉\nתודה שבחרת בשירותינו!',
            spareParts: 'שלום {supplier},\n\nאני מעוניין להזמין חלק חילוף:\n\n📋 *פרטי הרכב:*\nסוג רכב: {carType}\nדגם: {model}\nשנה: {year}\n🔧 מנוע: {engine}\n\n🛠️ *החלק המבוקש:*\n{part}\n\n{details}\n\nתודה!'
        };

        // Load custom messages from localStorage or use defaults
        var customWhatsAppMessages = JSON.parse(localStorage.getItem('whatsappMessages') || 'null') || {};
        // Merge with defaults (in case new fields were added)
        if (!customWhatsAppMessages.in_progress) customWhatsAppMessages.in_progress = defaultWhatsAppMessages.in_progress;
        if (!customWhatsAppMessages.ready) customWhatsAppMessages.ready = defaultWhatsAppMessages.ready;
        if (!customWhatsAppMessages.completed) customWhatsAppMessages.completed = defaultWhatsAppMessages.completed;
        if (!customWhatsAppMessages.spareParts) customWhatsAppMessages.spareParts = defaultWhatsAppMessages.spareParts;

        function toggleWhatsAppNotify() {
            var toggle = document.getElementById('whatsappToggle');
            whatsappNotifyEnabled = toggle.checked;
            localStorage.setItem('whatsappNotify', whatsappNotifyEnabled ? 'true' : 'false');
        }

        // Variable buttons config
        var statusVariables = [
            { tag: '{name}', label: '📛 שם' },
            { tag: '{plate}', label: '🔢 לוחית' },
            { tag: '{phone}', label: '📞 טלפון' },
            { tag: '{carType}', label: '🚗 סוג רכב' },
            { tag: '{model}', label: '📋 דגם' },
            { tag: '{year}', label: '📅 שנה' },
            { tag: '{engine}', label: '⚙️ מנוע' },
            { tag: '{drive}', label: '🛞 הנעה' }
        ];

        var sparePartsVariables = [
            { tag: '{supplier}', label: '🏪 ספק' },
            { tag: '{carType}', label: '🚗 סוג רכב' },
            { tag: '{model}', label: '📋 דגם' },
            { tag: '{year}', label: '📅 שנה' },
            { tag: '{engine}', label: '⚙️ מנוע' },
            { tag: '{drive}', label: '🛞 הנעה' },
            { tag: '{part}', label: '🔧 חלק' },
            { tag: '{details}', label: '📝 פרטים' }
        ];

        function insertVariable(textareaId, variable) {
            var textarea = document.getElementById(textareaId);
            if (!textarea) return;
            var start = textarea.selectionStart;
            var end = textarea.selectionEnd;
            var text = textarea.value;
            textarea.value = text.substring(0, start) + variable + text.substring(end);
            textarea.focus();
            var newPos = start + variable.length;
            textarea.setSelectionRange(newPos, newPos);
        }

        function renderVariableButtons() {
            var containers = document.querySelectorAll('#whatsappMessagesModal [data-target]');
            containers.forEach(function(container) {
                var targetId = container.getAttribute('data-target');
                var vars = targetId === 'msgSpareParts' ? sparePartsVariables : statusVariables;
                container.innerHTML = vars.map(function(v) {
                    return '<button type="button" onclick="insertVariable(\'' + targetId + '\',\'' + v.tag + '\')" class="text-xs bg-green-50 border border-green-200 text-green-700 px-2.5 py-1 rounded-lg hover:bg-green-100 transition font-bold">' + v.label + '</button>';
                }).join('');
            });
        }

        // Open WhatsApp Messages Modal
        function openWhatsAppMessagesModal() {
            document.getElementById('whatsappMessagesModal').classList.remove('hidden');
            document.body.classList.add('modal-open');
            hideUIElements();
            // Load current messages into textareas
            document.getElementById('msgInProgress').value = customWhatsAppMessages.in_progress;
            document.getElementById('msgReady').value = customWhatsAppMessages.ready;
            document.getElementById('msgCompleted').value = customWhatsAppMessages.completed;
            document.getElementById('msgSpareParts').value = customWhatsAppMessages.spareParts;
            // Render variable buttons
            renderVariableButtons();
        }

        // Close WhatsApp Messages Modal
        function closeWhatsAppMessagesModal() {
            document.getElementById('whatsappMessagesModal').classList.add('hidden');
            document.body.classList.remove('modal-open');
            showUIElements();
        }

        // Save custom WhatsApp messages
        function saveWhatsAppMessages() {
            customWhatsAppMessages.in_progress = document.getElementById('msgInProgress').value.trim() || defaultWhatsAppMessages.in_progress;
            customWhatsAppMessages.ready = document.getElementById('msgReady').value.trim() || defaultWhatsAppMessages.ready;
            customWhatsAppMessages.completed = document.getElementById('msgCompleted').value.trim() || defaultWhatsAppMessages.completed;
            customWhatsAppMessages.spareParts = document.getElementById('msgSpareParts').value.trim() || defaultWhatsAppMessages.spareParts;

            localStorage.setItem('whatsappMessages', JSON.stringify(customWhatsAppMessages));
            showNotification('ההודעות נשמרו בהצלחה ✅');
            closeWhatsAppMessagesModal();
        }

        // Reset WhatsApp messages to defaults
        function resetWhatsAppMessages() {
            customWhatsAppMessages = JSON.parse(JSON.stringify(defaultWhatsAppMessages));
            localStorage.removeItem('whatsappMessages');

            // Update textareas
            document.getElementById('msgInProgress').value = defaultWhatsAppMessages.in_progress;
            document.getElementById('msgReady').value = defaultWhatsAppMessages.ready;
            document.getElementById('msgCompleted').value = defaultWhatsAppMessages.completed;
            document.getElementById('msgSpareParts').value = defaultWhatsAppMessages.spareParts;

            showNotification('ההודעות אופסו לברירת מחדל');
        }

        // Open Dashboard
        function openDashboard() {
            // إغلاق السايد بار إذا كان مفتوحاً
            const sidebar = document.getElementById('sidebar');
            if (sidebar && sidebar.classList.contains('open')) {
                toggleSidebar();
            }
            // إغلاق جميع الـ modals المفتوحة أولاً
            closeAllModals();
            // فتح لوح البكرة
            document.getElementById('dashboardModal').classList.remove('hidden');
            document.body.classList.add('modal-open');
            // Sync WhatsApp toggle with saved state
            var toggle = document.getElementById('whatsappToggle');
            if (toggle) toggle.checked = whatsappNotifyEnabled;
            renderDashboard();
            // تحديث حالة النافيجيشن
            updateActiveNav(1);
            hideUIElements(); // إخفاء FAB والقائمة السفلية
        }

        // Close Dashboard
        function closeDashboard() {
            document.getElementById('dashboardModal').classList.add('hidden');
            document.body.classList.remove('modal-open');
            showUIElements(); // إظهار FAB والقائمة السفلية
            // العودة إلى حالة البيت في النافيجيشن
            updateActiveNav(0);
        }

        // Render Dashboard
        function renderDashboard() {
            // Count cars by status - ONLY cars with explicit status
            const waiting = cars.filter(c => c.carStatus === 'waiting');
            const inProgress = cars.filter(c => c.carStatus === 'in_progress');
            const ready = cars.filter(c => c.carStatus === 'ready');
            const completed = cars.filter(c => c.carStatus === 'completed');

            // Update counters
            document.getElementById('waitingCount').textContent = waiting.length;
            document.getElementById('inProgressCount').textContent = inProgress.length;
            document.getElementById('readyCount').textContent = ready.length;
            document.getElementById('completedCount').textContent = completed.length;

            // Render columns
            renderDashboardColumn('waitingColumn', waiting, 'waiting');
            renderDashboardColumn('inProgressColumn', inProgress, 'in_progress');
            renderDashboardColumn('readyColumn', ready, 'ready');
            renderDashboardColumn('completedColumn', completed, 'completed');
        }

        // Render Dashboard Column
        function renderDashboardColumn(columnId, carsList, status) {
            const column = document.getElementById(columnId);

            if (carsList.length === 0) {
                column.innerHTML = '<p class="text-gray-400 text-center py-4 text-sm">אין רכבים</p>';
                return;
            }

            column.innerHTML = carsList.map(car => `
                <div class="bg-white rounded-lg p-3 shadow hover:shadow-md transition cursor-pointer border-r-4 ${getStatusColor(status)}"
                     onclick="openCarDetailsModal('${car.id}')">
                    <div class="font-bold text-sm mb-1">${car.plateNumber}</div>
                    <div class="text-xs text-gray-600 mb-2">${car.ownerName || ''}</div>
                    ${car.carType || car.model ? `<div class="text-xs text-gray-500">${car.carType || ''} ${car.model || ''}</div>` : ''}

                    <!-- Status Buttons -->
                    <div class="mt-2 flex gap-1 flex-wrap" onclick="event.stopPropagation()">
                        ${status !== 'waiting' ? `<button onclick="changeCarStatus('${car.id}', 'waiting')" class="text-xs bg-yellow-100 text-yellow-700 px-2 py-1 rounded hover:bg-yellow-200" title="העבר לממתין">⏳</button>` : ''}
                        ${status !== 'in_progress' ? `<button onclick="changeCarStatus('${car.id}', 'in_progress')" class="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded hover:bg-blue-200" title="העבר לטיפול">🔧</button>` : ''}
                        ${status !== 'ready' ? `<button onclick="changeCarStatus('${car.id}', 'ready')" class="text-xs bg-green-100 text-green-700 px-2 py-1 rounded hover:bg-green-200" title="סמן כמוכן">✅</button>` : ''}
                        ${status !== 'completed' ? `<button onclick="changeCarStatus('${car.id}', 'completed')" class="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded hover:bg-gray-200" title="סמן כהושלם">🏁</button>` : ''}
                        <button onclick="removeCarFromDashboard('${car.id}')" class="text-xs bg-red-100 text-red-700 px-2 py-1 rounded hover:bg-red-200" title="הסר מלוח הבקרה">❌</button>
                    </div>
                </div>
            `).join('');
        }

        // Get Status Color
        function getStatusColor(status) {
            const colors = {
                'waiting': 'border-yellow-500',
                'in_progress': 'border-blue-500',
                'ready': 'border-green-500',
                'completed': 'border-gray-500'
            };
            return colors[status] || 'border-gray-300';
        }

        // Change Car Status
        async function changeCarStatus(carId, newStatus) {
            try {
                // Get car data first
                const car = cars.find(c => c.id === carId);
                if (!car) {
                    alert('שגיאה: רכב לא נמצא');
                    return;
                }

                // Update status in database
                await db.collection('cars').doc(carId).update({
                    carStatus: newStatus,
                    statusUpdatedAt: firebase.firestore.FieldValue.serverTimestamp()
                });

                // Update local cars array
                const carIndex = cars.findIndex(c => c.id === carId);
                if (carIndex !== -1) {
                    cars[carIndex].carStatus = newStatus;
                }

                // Update both dashboard and main grid
                renderDashboard();
                displayCars();

                // Show notification
                const statusNames = {
                    'waiting': 'ממתין לטיפול',
                    'in_progress': 'בטיפול',
                    'ready': 'מוכן לאיסוף',
                    'completed': 'הושלם'
                };

                showNotification(`${car.plateNumber} הועבר ל: ${statusNames[newStatus]}`);

                // Send WhatsApp message based on status change (if enabled)
                if (whatsappNotifyEnabled && car.phone) {
                    sendWhatsAppForStatus(car, newStatus);
                }

            } catch (error) {
                console.error('Error changing car status:', error);
                alert('שגיאה בעדכון הסטטוס');
            }
        }

        // Send WhatsApp message based on status
        function sendWhatsAppForStatus(car, status) {
            // Check premium first
            if (!hasPremiumAccess()) {
                showPremiumModal('whatsapp');
                return;
            }

            var messageTemplate = '';
            var ownerName = car.ownerName || 'לקוח יקר';
            var plateNumber = car.plateNumber;

            switch(status) {
                case 'in_progress':
                    messageTemplate = customWhatsAppMessages.in_progress;
                    break;
                case 'ready':
                    messageTemplate = customWhatsAppMessages.ready;
                    break;
                case 'completed':
                    messageTemplate = customWhatsAppMessages.completed;
                    break;
                default:
                    // No message for 'waiting' status
                    return;
            }

            // Replace placeholders with actual values
            var message = messageTemplate
                .replace(/\{name\}/g, ownerName)
                .replace(/\{plate\}/g, plateNumber)
                .replace(/\{phone\}/g, car.phone || '')
                .replace(/\{carType\}/g, car.carType || '')
                .replace(/\{model\}/g, car.model || '')
                .replace(/\{year\}/g, car.year || '')
                .replace(/\{engine\}/g, car.enginePower || '')
                .replace(/\{drive\}/g, car.driveType || '');

            // Open WhatsApp with pre-filled message
            var phoneNumber = car.phone.replace(/^0/, '972');
            var whatsappUrl = 'https://api.whatsapp.com/send?phone=' + phoneNumber + '&text=' + encodeURIComponent(message);
            window.location.href = whatsappUrl;
        }

        // Build Spare Parts WhatsApp message from custom template
        function buildSparePartsMessage(supplier, car, partName, partDetails) {
            var template = customWhatsAppMessages.spareParts;
            var message = template
                .replace(/\{supplier\}/g, supplier.name || '')
                .replace(/\{carType\}/g, car.carType || '')
                .replace(/\{model\}/g, car.model || '')
                .replace(/\{year\}/g, car.year || '')
                .replace(/\{engine\}/g, car.enginePower || '')
                .replace(/\{drive\}/g, car.driveType || '')
                .replace(/\{part\}/g, partName || '')
                .replace(/\{details\}/g, partDetails || '');
            return message;
        }

        // Show Notification
        function showNotification(message) {
            const notification = document.createElement('div');
            notification.className = 'notification fixed top-4 left-1/2 transform -translate-x-1/2 bg-gradient-to-r from-green-500 to-emerald-600 text-white px-6 py-4 rounded-xl shadow-xl z-[100] font-semibold flex items-center gap-3';
            notification.innerHTML = `
                <span class="text-xl">✓</span>
                <span>${message}</span>
            `;
            document.body.appendChild(notification);

            setTimeout(() => {
                notification.style.opacity = '0';
                notification.style.transform = 'translate(-50%, -100%)';
                setTimeout(() => notification.remove(), 300);
            }, 2000);
        }

        // Delete Car from Dashboard
        // Remove Car From Dashboard (only remove status, not delete car)
        async function removeCarFromDashboard(carId) {
            const car = cars.find(c => c.id === carId);
            if (!car) return;

            if (!confirm(`האם להסיר את ${car.plateNumber} מלוח הבקרה?`)) return;

            try {
                // Remove status from car in Firebase
                await db.collection('cars').doc(carId).update({
                    carStatus: firebase.firestore.FieldValue.delete(),
                    statusUpdatedAt: firebase.firestore.FieldValue.serverTimestamp()
                });

                // Update local cars array - set to undefined
                const carIndex = cars.findIndex(c => c.id === carId);
                if (carIndex !== -1) {
                    cars[carIndex].carStatus = undefined;
                }

                // Update both dashboard and main grid
                renderDashboard();
                displayCars();

                showNotification('הרכב הוסר מלוח הבקרה');

            } catch (error) {
                console.error('Error removing car from dashboard:', error);
                alert('שגיאה בהסרת הרכב מלוח הבקרה');
            }
        }

        // Add Car To Dashboard
        async function addCarToDashboard(carId) {
            try {
                // Add car to dashboard with 'waiting' status
                await db.collection('cars').doc(carId).update({
                    carStatus: 'waiting',
                    statusUpdatedAt: firebase.firestore.FieldValue.serverTimestamp()
                });

                // Update local cars array
                const carIndex = cars.findIndex(c => c.id === carId);
                if (carIndex !== -1) {
                    cars[carIndex].carStatus = 'waiting';
                }

                // Reload the main grid to show updated status
                displayCars();

                showNotification('הרכב נוסף ללוח הבקרה');

            } catch (error) {
                console.error('Error adding car to dashboard:', error);
                alert('שגיאה בהוספת הרכב ללוח הבקרה');
            }
        }
