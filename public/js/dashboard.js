// DRVN Garage - Dashboard & Kanban Board

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

                // Send WhatsApp message based on status change
                if (car.phone) {
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

            let message = '';
            const ownerName = car.ownerName || 'לקוח יקר';
            const plateNumber = car.plateNumber;

            switch(status) {
                case 'in_progress':
                    message = `שלום ${ownerName}, רכבך ${plateNumber} נכנס לטיפול במוסך שלנו 🔧\nנעדכן אותך כשיהיה מוכן לאיסוף.`;
                    break;
                case 'ready':
                    message = `שלום ${ownerName}, רכבך ${plateNumber} מוכן ומחכה לאיסוף ✅\nניתן לבוא לקחת את הרכב.`;
                    break;
                case 'completed':
                    message = `שלום ${ownerName}, רכבך ${plateNumber} נמסר בהצלחה 🎉\nתודה שבחרת בשירותינו!`;
                    break;
                default:
                    // No message for 'waiting' status
                    return;
            }

            // Open WhatsApp with pre-filled message
            const phoneNumber = car.phone.replace(/^0/, '972');
            const whatsappUrl = `https://wa.me/${phoneNumber}?text=${encodeURIComponent(message)}`;
            window.open(whatsappUrl, '_blank');
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
