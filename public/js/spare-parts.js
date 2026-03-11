// DRVN Garage - Spare Parts & Settings

        var sparePartsContacts = [];

        // Load Spare Parts Contacts
        async function loadSparePartsContacts() {
            try {
                const snapshot = await db.collection('sparePartsContacts')
                    .where('userId', '==', currentUser.uid)
                    .orderBy('createdAt', 'desc')
                    .get();

                sparePartsContacts = [];
                snapshot.forEach(doc => {
                    sparePartsContacts.push({
                        id: doc.id,
                        ...doc.data()
                    });
                });
            } catch (error) {
                console.error('Error loading spare parts contacts:', error);
                alert('שגיאה בטעינת רשימת הספקים: ' + error.message);
                sparePartsContacts = [];
            }
        }

        // Display Spare Parts Contacts List
        function displaySparePartsContacts() {
            const list = document.getElementById('sparePartsContactsList');

            if (sparePartsContacts.length === 0) {
                list.innerHTML = '<p class="text-gray-500 text-center py-4">אין ספקים במערכת. הוסף ספק חדש מטה.</p>';
                return;
            }

            list.innerHTML = sparePartsContacts.map((contact, index) => `
                <div class="bg-gray-50 p-4 rounded-lg border border-gray-200 flex justify-between items-center">
                    <div>
                        <p class="font-bold text-gray-800">${contact.name}</p>
                        <p class="text-gray-600 text-sm">${contact.phone}</p>
                    </div>
                    <button onclick="removeSparePartsContact(${index})"
                            class="bg-red-500 text-white px-3 py-2 rounded hover:bg-red-600">
                        🗑️ מחק
                    </button>
                </div>
            `).join('');
        }

        // Add New Spare Parts Contact
        async function addSparePartsContact() {
            const name = document.getElementById('newSupplierName').value.trim();
            const phone = document.getElementById('newSupplierPhone').value.trim();

            if (!name || !phone) {
                alert('נא למלא את כל השדות');
                return;
            }

            try {
                await db.collection('sparePartsContacts').add({
                    userId: currentUser.uid,
                    name: name,
                    phone: phone,
                    createdAt: new Date().toISOString()
                });

                document.getElementById('newSupplierName').value = '';
                document.getElementById('newSupplierPhone').value = '';

                await loadSparePartsContacts();
                displaySparePartsContacts();
                showNotification('הספק נוסף בהצלחה!');
            } catch (error) {
                console.error('Error saving contact:', error);
                alert('שגיאה בשמירת הספק: ' + error.message);
            }
        }

        // Remove Spare Parts Contact
        async function removeSparePartsContact(index) {
            if (!confirm('האם אתה בטוח שברצונך למחוק ספק זה?')) {
                return;
            }

            const contact = sparePartsContacts[index];

            try {
                await db.collection('sparePartsContacts').doc(contact.id).delete();

                await loadSparePartsContacts();
                displaySparePartsContacts();
                showNotification('הספק נמחק בהצלחה!');
            } catch (error) {
                console.error('Error removing contact:', error);
                alert('שגיאה במחיקת הספק: ' + error.message);
            }
        }

        // Open Settings (Spare Parts Contacts)
        async function openSettings() {
            await loadSparePartsContacts();
            displaySparePartsContacts();
            document.getElementById('settingsModal').classList.remove('hidden');
            document.body.classList.add('modal-open');
            hideUIElements();
        }

        // Close Settings
        function closeSettings() {
            document.getElementById('settingsModal').classList.add('hidden');
            document.body.classList.remove('modal-open');
            showUIElements();
        }

        // Order Spare Part with Supplier Selection and Engine Size
        async function orderSparePart(carId) {
            await loadSparePartsContacts();

            if (sparePartsContacts.length === 0) {
                alert('אנא הוסף ספק חלפים במספרי חלקי חילוף');
                openSettings();
                return;
            }

            const car = cars.find(c => c.id === carId);
            if (!car) return;

            // Create supplier selection HTML
            const supplierOptions = sparePartsContacts.map((contact, index) =>
                `<option value="${index}">${contact.name} - ${contact.phone}</option>`
            ).join('');

            // Show modal to select supplier and enter part details
            const modalHTML = `
                <div id="orderPartModal" class="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
                    <div class="bg-white rounded-lg shadow-2xl max-w-md w-full">
                        <div class="bg-green-600 text-white p-6 rounded-t-lg">
                            <h2 class="text-2xl font-bold">🛒 הזמנת חלק חילוף</h2>
                        </div>

                        <div class="p-6 space-y-4">
                            <div>
                                <p class="font-bold">רכב: ${car.plateNumber}</p>
                                <p class="text-sm text-gray-600">${car.carType || ''} ${car.model || ''} ${car.year || ''}</p>
                                ${car.enginePower ? `<p class="text-sm text-gray-600">מנוע: ${car.enginePower}</p>` : ''}
                            </div>

                            <div>
                                <label class="block text-gray-700 font-bold mb-2">בחר ספק</label>
                                <select id="supplierSelect" class="w-full px-4 py-2 border rounded-lg">
                                    ${supplierOptions}
                                </select>
                            </div>

                            <div>
                                <label class="block text-gray-700 font-bold mb-2">שם החלק</label>
                                <input type="text" id="partName"
                                       class="w-full px-4 py-2 border rounded-lg"
                                       placeholder="לדוגמה: מסנן שמן, בלמים">
                            </div>

                            <div>
                                <label class="block text-gray-700 font-bold mb-2">פרטים נוספים (אופציונלי)</label>
                                <textarea id="partDetails" rows="3"
                                          class="w-full px-4 py-2 border rounded-lg"
                                          placeholder="מספר קטלוגי, כמות, הערות..."></textarea>
                            </div>

                            <div class="flex gap-3">
                                <button onclick="sendSparePartOrder('${carId}')"
                                        class="flex-1 bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 font-bold">
                                    📤 שלח הזמנה
                                </button>
                                <button onclick="closeOrderPartModal()"
                                        class="flex-1 bg-gray-300 text-gray-700 px-6 py-3 rounded-lg hover:bg-gray-400 font-bold">
                                    ביטול
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            `;

            document.body.insertAdjacentHTML('beforeend', modalHTML);
        }

        // Send Spare Part Order via WhatsApp
        function sendSparePartOrder(carId) {
            // Check premium first
            if (!hasPremiumAccess()) {
                showPremiumModal('whatsapp');
                return;
            }

            const supplierIndex = document.getElementById('supplierSelect').value;
            const partName = document.getElementById('partName').value.trim();
            const partDetails = document.getElementById('partDetails').value.trim();

            if (!partName) {
                alert('נא להזין שם חלק');
                return;
            }

            const supplier = sparePartsContacts[supplierIndex];
            const car = cars.find(c => c.id === carId);

            if (!supplier || !car) return;

            // Build WhatsApp message from custom template
            var message = buildSparePartsMessage(supplier, car, partName, partDetails);

            const cleanPhone = supplier.phone.replace(/\D/g, '');
            const phoneWithCode = cleanPhone.startsWith('972') ? cleanPhone : '972' + cleanPhone.replace(/^0/, '');

            const whatsappUrl = `https://api.whatsapp.com/send?phone=${phoneWithCode}&text=${encodeURIComponent(message)}`;
            window.location.href = whatsappUrl;

            closeOrderPartModal();
        }

        // Order Spare Part From Maintenance Record (with pre-filled part name)
        async function orderSparePartFromMaintenance(carId, partName, workDescription) {
            await loadSparePartsContacts();

            if (sparePartsContacts.length === 0) {
                alert('אנא הוסף ספק חלפים במספרי חלקי חילוף');
                openSettings();
                return;
            }

            const car = cars.find(c => c.id === carId);
            if (!car) return;

            // Create supplier selection HTML
            const supplierOptions = sparePartsContacts.map((contact, index) =>
                `<option value="${index}">${contact.name} - ${contact.phone}</option>`
            ).join('');

            // Show simplified modal - only supplier selection
            const modalHTML = `
                <div id="orderPartModal" class="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
                    <div class="bg-white rounded-lg shadow-2xl max-w-md w-full">
                        <div class="bg-green-600 text-white p-6 rounded-t-lg">
                            <h2 class="text-2xl font-bold">🛒 הזמנת חלק חילוף</h2>
                        </div>

                        <div class="p-6 space-y-4">
                            <div class="bg-blue-50 border-2 border-blue-200 rounded-lg p-4">
                                <p class="font-bold text-lg mb-2">רכב: ${car.plateNumber}</p>
                                <p class="text-sm text-gray-600">${car.carType || ''} ${car.model || ''} ${car.year || ''}</p>
                                ${car.enginePower ? `<p class="text-sm text-gray-600">מנוע: ${car.enginePower}</p>` : ''}
                                ${partName ? `
                                    <div class="mt-3 pt-3 border-t border-blue-300">
                                        <p class="font-bold text-green-700">🛠️ החלק: ${partName}</p>
                                        ${workDescription ? `<p class="text-sm text-gray-600 mt-1">${workDescription}</p>` : ''}
                                    </div>
                                ` : ''}
                            </div>

                            <div>
                                <label class="block text-gray-700 font-bold mb-2 text-lg">מאיזה ספק תרצה להזמין?</label>
                                <select id="supplierSelect" class="w-full px-4 py-3 border-2 border-gray-300 rounded-lg text-lg font-semibold">
                                    ${supplierOptions}
                                </select>
                            </div>

                            <div>
                                <label class="block text-gray-700 font-bold mb-2">פרטים נוספים (אופציונלי)</label>
                                <textarea id="partDetails" rows="3"
                                          class="w-full px-4 py-2 border rounded-lg"
                                          placeholder="מספר קטלוגי, כמות, הערות..."></textarea>
                            </div>

                            <div class="flex gap-3">
                                <button onclick="sendSparePartOrderSimple('${carId}', '${partName.replace(/'/g, "\\'")}', '${workDescription.replace(/'/g, "\\'")}')"
                                        class="flex-1 bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 font-bold text-lg">
                                    📤 שלח הזמנה
                                </button>
                                <button onclick="closeOrderPartModal()"
                                        class="flex-1 bg-gray-300 text-gray-700 px-6 py-3 rounded-lg hover:bg-gray-400 font-bold">
                                    ביטול
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            `;

            document.body.insertAdjacentHTML('beforeend', modalHTML);
        }

        // Send Order with Pre-filled Part Info
        function sendSparePartOrderSimple(carId, partName, workDescription) {
            // Check premium first
            if (!hasPremiumAccess()) {
                showPremiumModal('whatsapp');
                return;
            }

            const supplierIndex = document.getElementById('supplierSelect').value;
            const partDetails = document.getElementById('partDetails').value.trim();

            const supplier = sparePartsContacts[supplierIndex];
            const car = cars.find(c => c.id === carId);

            if (!supplier || !car) return;

            // Build WhatsApp message from custom template
            var fullDetails = '';
            if (workDescription) fullDetails += 'תיאור: ' + workDescription;
            if (partDetails) fullDetails += (fullDetails ? '\n' : '') + partDetails;

            var message = buildSparePartsMessage(supplier, car, partName, fullDetails);

            const cleanPhone = supplier.phone.replace(/\D/g, '');
            const phoneWithCode = cleanPhone.startsWith('972') ? cleanPhone : '972' + cleanPhone.replace(/^0/, '');

            const whatsappUrl = `https://api.whatsapp.com/send?phone=${phoneWithCode}&text=${encodeURIComponent(message)}`;
            window.location.href = whatsappUrl;

            closeOrderPartModal();
        }

        function closeOrderPartModal() {
            const modal = document.getElementById('orderPartModal');
            if (modal) {
                modal.remove();
            }
        }

        // Show Notification
        function showNotification(message) {
            const notification = document.createElement('div');
            notification.className = 'fixed top-4 right-4 bg-green-600 text-white px-6 py-3 rounded-lg shadow-lg z-50';
            notification.textContent = message;
            document.body.appendChild(notification);

            setTimeout(() => {
                notification.remove();
            }, 3000);
        }
