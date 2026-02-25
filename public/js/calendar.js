// DRVN Garage - Calendar & Appointments

        // Load Appointments from Firebase
        async function loadAppointments() {
            if (!currentUser) return;

            try {
                const snapshot = await db.collection('appointments')
                    .where('userId', '==', currentUser.uid)
                    .get();

                appointments = snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                }));

                // Sort by date locally
                appointments.sort((a, b) => {
                    const dateA = new Date(a.date + ' ' + a.time);
                    const dateB = new Date(b.date + ' ' + b.time);
                    return dateA - dateB;
                });

                console.log('Loaded appointments:', appointments.length);
            } catch (error) {
                console.error('Error loading appointments:', error);
                alert('שגיאה בטעינת פגישות: ' + error.message);
            }
        }

        // Open Calendar Modal
        async function openCalendarModal() {
            // إغلاق السايد بار إذا كان مفتوحاً
            const sidebar = document.getElementById('sidebar');
            if (sidebar && sidebar.classList.contains('open')) {
                toggleSidebar();
            }
            // إغلاق جميع الـ modals المفتوحة أولاً
            closeAllModals();
            // فتح اليومن
            document.getElementById('calendarModal').classList.remove('hidden');
            document.body.classList.add('modal-open');
            await loadAppointments(); // Reload appointments
            renderCalendar();
            // تحديث حالة النافيجيشن
            updateActiveNav(2);
            hideUIElements(); // إخفاء FAB والقائمة السفلية
        }

        // Close Calendar Modal
        function closeCalendarModal() {
            document.getElementById('calendarModal').classList.add('hidden');
            document.body.classList.remove('modal-open');
            showUIElements(); // إظهار FAB والقائمة السفلية
            // العودة إلى حالة البيت في النافيجيشن
            updateActiveNav(0);
        }

        // Open Appointment Modal
        function openAppointmentModal() {
            editingAppointmentId = null;
            document.getElementById('appointmentForm').reset();

            // Populate car dropdown
            const carSelect = document.getElementById('appointmentCar');
            carSelect.innerHTML = '<option value="">בחר רכב...</option>';

            document.getElementById('appointmentModal').classList.remove('hidden');

            cars.forEach(car => {
                const option = document.createElement('option');
                option.value = car.id;
                option.textContent = `${car.plateNumber} - ${car.ownerName}`;
                if (currentCarId && car.id === currentCarId) {
                    option.selected = true;
                }
                carSelect.appendChild(option);
            });

            // Set default date to today
            const today = new Date().toISOString().split('T')[0];
            document.getElementById('appointmentDate').value = today;
            miniSelectedDate = today;

            // Reset mini calendar to current month
            miniMonth = new Date().getMonth();
            miniYear = new Date().getFullYear();

            document.getElementById('appointmentModal').classList.remove('hidden');
            document.body.classList.add('modal-open');
            renderMiniCalendar();
            hideUIElements(); // إخفاء FAB والقائمة السفلية
        }

        // Close Appointment Modal
        function closeAppointmentModal() {
            document.getElementById('appointmentModal').classList.add('hidden');
            editingAppointmentId = null;

            // Check if car details modal is still open
            const carDetailsModal = document.getElementById('carDetailsModal');
            if (carDetailsModal && !carDetailsModal.classList.contains('hidden')) {
                // Car details is still open, keep modal-open class
                document.body.classList.add('modal-open');
            } else {
                document.body.classList.remove('modal-open');
                showUIElements(); // إظهار FAB والقائمة السفلية
            }
        }

        // Previous Month for Mini Calendar
        function previousMonthMini() {
            miniMonth--;
            if (miniMonth < 0) {
                miniMonth = 11;
                miniYear--;
            }
            renderMiniCalendar();
        }

        // Next Month for Mini Calendar
        function nextMonthMini() {
            miniMonth++;
            if (miniMonth > 11) {
                miniMonth = 0;
                miniYear++;
            }
            renderMiniCalendar();
        }

        // Render Mini Calendar
        function renderMiniCalendar() {
            const monthNames = ['ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני', 'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'];
            document.getElementById('miniMonthYear').textContent = `${monthNames[miniMonth]} ${miniYear}`;

            const firstDay = new Date(miniYear, miniMonth, 1).getDay();
            const daysInMonth = new Date(miniYear, miniMonth + 1, 0).getDate();

            const calendarGrid = document.getElementById('miniCalendarGrid');
            calendarGrid.innerHTML = '';

            // Add empty cells for days before month starts
            for (let i = 0; i < firstDay; i++) {
                const emptyCell = document.createElement('div');
                emptyCell.className = 'p-1';
                calendarGrid.appendChild(emptyCell);
            }

            // Add days of month
            const today = new Date();
            const todayStr = today.toISOString().split('T')[0];

            for (let day = 1; day <= daysInMonth; day++) {
                const dateStr = `${miniYear}-${String(miniMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                const dayAppointments = appointments.filter(apt => apt.date === dateStr);

                const dayCell = document.createElement('div');

                // Build class name
                let className = 'p-1 text-center text-sm border rounded cursor-pointer hover:bg-blue-50';

                // Today gets purple border
                if (dateStr === todayStr) {
                    className += ' border-purple-500 bg-purple-50';
                }

                // Has appointments - show red dot
                if (dayAppointments.length > 0) {
                    className += ' font-bold text-red-600';
                }

                // Selected date
                if (dateStr === miniSelectedDate) {
                    className += ' bg-blue-200';
                }

                dayCell.className = className;
                dayCell.onclick = () => selectMiniDate(dateStr);

                // Add dot indicator for days with appointments
                if (dayAppointments.length > 0) {
                    dayCell.innerHTML = `
                        <div class="relative">
                            ${day}
                            <span class="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full"></span>
                        </div>
                    `;
                } else {
                    dayCell.innerHTML = `<div>${day}</div>`;
                }

                calendarGrid.appendChild(dayCell);
            }

            // Show appointments for selected date
            showMiniDayAppointments();
        }

        // Select date in mini calendar
        function selectMiniDate(dateStr) {
            miniSelectedDate = dateStr;
            document.getElementById('appointmentDate').value = dateStr;
            renderMiniCalendar();
        }

        // Show appointments for selected day in mini calendar
        function showMiniDayAppointments() {
            const container = document.getElementById('miniDayAppointments');

            if (!miniSelectedDate) {
                container.innerHTML = '<p class="text-gray-500 text-center py-2">בחר תאריך</p>';
                return;
            }

            const date = new Date(miniSelectedDate);
            const dateFormatted = date.toLocaleDateString('he-IL', { day: 'numeric', month: 'long' });

            const dayAppointments = appointments.filter(apt => apt.date === miniSelectedDate).sort((a, b) => a.time.localeCompare(b.time));

            if (dayAppointments.length === 0) {
                container.innerHTML = `<p class="text-green-600 text-center py-2">✓ ${dateFormatted} - ללא פגישות</p>`;
                return;
            }

            container.innerHTML = `
                <div class="font-bold mb-2 text-red-600">⚠️ פגישות ב-${dateFormatted}:</div>
                ${dayAppointments.map(apt => `
                    <div class="border-r-4 border-red-500 bg-red-50 p-2 mb-2 rounded">
                        <div class="font-bold">${apt.time} - ${apt.plateNumber}</div>
                        <div class="text-xs text-gray-600">${apt.type}</div>
                    </div>
                `).join('')}
            `;
        }

        // Listen to date changes in appointment form
        document.getElementById('appointmentDate').addEventListener('change', (e) => {
            miniSelectedDate = e.target.value;
            renderMiniCalendar();
        });

        // Save Appointment
        document.getElementById('appointmentForm').addEventListener('submit', async (e) => {
            e.preventDefault();

            const carId = document.getElementById('appointmentCar').value;
            const car = cars.find(c => c.id === carId);

            // Sanitize appointment data
            const appointmentData = {
                userId: currentUser.uid,
                carId: carId,
                plateNumber: sanitizeInput(car.plateNumber),
                ownerName: sanitizeInput(car.ownerName),
                phone: sanitizeInput(car.phone || ''),
                date: document.getElementById('appointmentDate').value,
                time: document.getElementById('appointmentTime').value,
                type: sanitizeInput(document.getElementById('appointmentType').value),
                notes: sanitizeInput(document.getElementById('appointmentNotes').value),
                reminder: document.getElementById('appointmentReminder').checked,
                status: 'scheduled',
                createdAt: new Date().toISOString()
            };

            try {
                if (editingAppointmentId) {
                    await db.collection('appointments').doc(editingAppointmentId).update(appointmentData);
                    console.log('Appointment updated:', editingAppointmentId);
                } else {
                    const docRef = await db.collection('appointments').add(appointmentData);
                    console.log('Appointment created:', docRef.id);
                }

                await loadAppointments();
                console.log('Appointments reloaded. Total:', appointments.length);
                closeAppointmentModal();

                // Refresh calendar if it's open
                const calendarModal = document.getElementById('calendarModal');
                if (calendarModal && !calendarModal.classList.contains('hidden')) {
                    renderCalendar();
                }

                // Send WhatsApp reminder if checked
                if (appointmentData.reminder && appointmentData.phone) {
                    sendAppointmentReminder(appointmentData);
                }

                alert('הפגישה נשמרה בהצלחה!');
            } catch (error) {
                console.error('Error saving appointment:', error);
                alert('שגיאה בשמירת הפגישה: ' + error.message);
            }
        });

        // Send WhatsApp Reminder
        function sendAppointmentReminder(appointment) {
            // Check premium first
            if (!hasPremiumAccess()) {
                showPremiumModal('whatsapp');
                return;
            }

            const phone = appointment.phone.replace(/^0/, '972');
            const date = new Date(appointment.date).toLocaleDateString('he-IL');
            const message = `שלום ${appointment.ownerName},\n\nמזכירים לך על פגישה במוסך:\n📅 תאריך: ${date}\n⏰ שעה: ${appointment.time}\n🚗 רכב: ${appointment.plateNumber}\n📋 סוג: ${appointment.type}\n\nנתראה!`;
            const whatsappUrl = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
            window.open(whatsappUrl, '_blank');
        }

        // Previous Month
        function previousMonth() {
            currentMonth--;
            if (currentMonth < 0) {
                currentMonth = 11;
                currentYear--;
            }
            renderCalendar();
        }

        // Next Month
        function nextMonth() {
            currentMonth++;
            if (currentMonth > 11) {
                currentMonth = 0;
                currentYear++;
            }
            renderCalendar();
        }

        // Render Calendar
        function renderCalendar() {
            const monthNames = ['ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני', 'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'];
            const dayNames = ['א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳', 'ו׳', 'ש׳'];
            document.getElementById('currentMonthYear').textContent = `${monthNames[currentMonth]} ${currentYear}`;

            const firstDay = new Date(currentYear, currentMonth, 1).getDay();
            const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();

            const calendarGrid = document.getElementById('calendarGrid');
            calendarGrid.innerHTML = '';

            // Add empty cells for days before month starts
            for (let i = 0; i < firstDay; i++) {
                const emptyCell = document.createElement('div');
                emptyCell.style.visibility = 'hidden';
                calendarGrid.appendChild(emptyCell);
            }

            // Add days of month
            const today = new Date();
            const todayStr = today.toISOString().split('T')[0];

            for (let day = 1; day <= daysInMonth; day++) {
                const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                const dayDate = new Date(currentYear, currentMonth, day);
                const dayOfWeek = dayNames[dayDate.getDay()];
                const dayAppointments = appointments.filter(apt => apt.date === dateStr);

                const dayCell = document.createElement('div');

                // إضافة classes بناءً على الحالة
                let classes = [];

                if (dateStr === todayStr) {
                    classes.push('today');
                }

                if (dateStr === selectedDate) {
                    classes.push('selected');
                }

                if (dayAppointments.length > 0) {
                    classes.push('has-appointments');
                }

                dayCell.className = classes.join(' ');
                dayCell.onclick = () => selectDate(dateStr);

                dayCell.textContent = day;

                calendarGrid.appendChild(dayCell);
            }

            // Show selected date or today's appointments by default
            if (!selectedDate) {
                selectDate(todayStr);
            } else {
                // Just update the display without changing selectedDate
                const date = new Date(selectedDate);
                const dateFormatted = date.toLocaleDateString('he-IL', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
                document.getElementById('selectedDayTitle').innerHTML = `📌 פגישות ליום ${dateFormatted}`;

                const dayAppointments = appointments.filter(apt => apt.date === selectedDate).sort((a, b) => a.time.localeCompare(b.time));
                const container = document.getElementById('dayAppointments');

                if (dayAppointments.length === 0) {
                    container.innerHTML = `
                        <div class="no-appointments">
                            <div class="no-appointments-icon">📭</div>
                            <p>אין פגישות מתוכננות ליום זה</p>
                        </div>
                    `;
                } else {
                    container.innerHTML = `
                        <div style="display: flex; justify-content: flex-end; margin-bottom: 12px;">
                            <button onclick="deleteAllAppointmentsForDay('${selectedDate}')" class="appointment-action-btn delete" style="padding: 8px 16px;">
                                🗑️ מחק הכל (${dayAppointments.length})
                            </button>
                        </div>
                    ` + dayAppointments.map(apt => `
                        <div class="appointment-card">
                            <div class="appointment-time">${apt.time}</div>
                            <div class="appointment-info">
                                <strong>${apt.ownerName}</strong> - ${apt.carType || 'רכב'}
                            </div>
                            <div class="appointment-details">
                                🚗 ${apt.plateNumber} • ${apt.type}
                                ${apt.notes ? `<br>📝 ${apt.notes}` : ''}
                            </div>
                            <div class="appointment-actions">
                                <button onclick="editAppointment('${apt.id}')" class="appointment-action-btn edit">✏️ ערוך</button>
                                <button onclick="deleteAppointment('${apt.id}')" class="appointment-action-btn delete">🗑️ מחק</button>
                                ${apt.phone ? `<button onclick="sendAppointmentReminder(${JSON.stringify(apt).replace(/"/g, '&quot;')})" class="appointment-action-btn whatsapp">📱 תזכורת</button>` : ''}
                            </div>
                        </div>
                    `).join('');
                }
            }
        }

        // Select Date
        function selectDate(dateStr) {
            selectedDate = dateStr;
            renderCalendar(); // Re-render to update the purple highlight
        }

        // Edit Appointment
        async function editAppointment(appointmentId) {
            const appointment = appointments.find(apt => apt.id === appointmentId);
            if (!appointment) return;

            editingAppointmentId = appointmentId;

            document.getElementById('appointmentCar').value = appointment.carId;
            document.getElementById('appointmentDate').value = appointment.date;
            document.getElementById('appointmentTime').value = appointment.time;
            document.getElementById('appointmentType').value = appointment.type;
            document.getElementById('appointmentNotes').value = appointment.notes || '';
            document.getElementById('appointmentReminder').checked = appointment.reminder || false;

            document.getElementById('appointmentModal').classList.remove('hidden');
        }

        // Delete Appointment
        async function deleteAppointment(appointmentId) {
            if (!confirm('האם אתה בטוח שברצונך למחוק פגישה זו?')) return;

            try {
                await db.collection('appointments').doc(appointmentId).delete();
                await loadAppointments();
                renderCalendar();
                alert('הפגישה נמחקה בהצלחה');
            } catch (error) {
                console.error('Error deleting appointment:', error);
                alert('שגיאה במחיקת הפגישה');
            }
        }

        // Delete All Appointments for a specific day
        async function deleteAllAppointmentsForDay(dateStr) {
            const dayAppointments = appointments.filter(apt => apt.date === dateStr);

            if (dayAppointments.length === 0) {
                alert('אין פגישות למחיקה ביום זה');
                return;
            }

            const date = new Date(dateStr);
            const dateFormatted = date.toLocaleDateString('he-IL', { weekday: 'long', day: 'numeric', month: 'long' });

            if (!confirm(`האם אתה בטוח שברצונך למחוק את כל ${dayAppointments.length} הפגישות ליום ${dateFormatted}?`)) return;

            try {
                // Delete all appointments for this day
                const deletePromises = dayAppointments.map(apt =>
                    db.collection('appointments').doc(apt.id).delete()
                );

                await Promise.all(deletePromises);
                await loadAppointments();
                renderCalendar();
                alert(`${dayAppointments.length} פגישות נמחקו בהצלחה`);
            } catch (error) {
                console.error('Error deleting appointments:', error);
                alert('שגיאה במחיקת הפגישות');
            }
        }
