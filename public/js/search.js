// DRVN Garage - Search, Filter & Export

        // Search Cars
        // ==========================================
        // ADVANCED SEARCH SYSTEM
        // ==========================================
        // maintenanceCache is declared in config.js

        function toggleAdvancedSearch() {
            const panel = document.getElementById('advancedSearchPanel');
            panel.classList.toggle('hidden');

            // Populate filter options when opening
            if (!panel.classList.contains('hidden')) {
                populateFilterOptions();
            }
        }

        function populateFilterOptions() {
            // Populate car types
            const carTypes = [...new Set(cars.map(c => c.carType).filter(Boolean))].sort();
            const carTypeSelect = document.getElementById('filterCarType');
            carTypeSelect.innerHTML = '<option value="">הכל</option>' +
                carTypes.map(type => `<option value="${type}">${type}</option>`).join('');

            // Populate years
            const years = [...new Set(cars.map(c => c.year).filter(Boolean))].sort((a, b) => b - a);
            const yearSelect = document.getElementById('filterYear');
            yearSelect.innerHTML = '<option value="">הכל</option>' +
                years.map(year => `<option value="${year}">${year}</option>`).join('');
        }

        function searchCars() {
            applyFilters();
        }

        async function applyFilters() {
            const searchTerm = document.getElementById('searchBox').value.toLowerCase().trim();
            const filterCarType = document.getElementById('filterCarType')?.value || '';
            const filterYear = document.getElementById('filterYear')?.value || '';
            const filterMaintenanceStatus = document.getElementById('filterMaintenanceStatus')?.value || '';
            const sortBy = document.getElementById('sortBy')?.value || 'recent';

            // Load maintenance data if needed for filtering
            if (filterMaintenanceStatus && Object.keys(maintenanceCache).length === 0) {
                await loadMaintenanceCache();
            }

            let filteredCars = [...cars];

            // Text search
            if (searchTerm) {
                filteredCars = filteredCars.filter(car => {
                    const searchFields = [
                        car.plateNumber,
                        car.ownerName,
                        car.phone,
                        car.carType,
                        car.model,
                        car.year?.toString()
                    ].filter(Boolean).join(' ').toLowerCase();
                    return searchFields.includes(searchTerm);
                });
            }

            // Filter by car type
            if (filterCarType) {
                filteredCars = filteredCars.filter(car => car.carType === filterCarType);
            }

            // Filter by year
            if (filterYear) {
                filteredCars = filteredCars.filter(car => car.year?.toString() === filterYear);
            }

            // Filter by maintenance status
            if (filterMaintenanceStatus) {
                const now = new Date();
                filteredCars = filteredCars.filter(car => {
                    const lastMaintenance = maintenanceCache[car.id];
                    if (!lastMaintenance) {
                        return filterMaintenanceStatus === 'never';
                    }

                    const daysSince = Math.floor((now - lastMaintenance) / (1000 * 60 * 60 * 24));

                    switch (filterMaintenanceStatus) {
                        case 'recent': return daysSince <= 30;
                        case 'due': return daysSince > 60 && daysSince <= 90;
                        case 'overdue': return daysSince > 90;
                        case 'never': return false;
                        default: return true;
                    }
                });
            }

            // Sort
            filteredCars.sort((a, b) => {
                switch (sortBy) {
                    case 'name':
                        return (a.ownerName || '').localeCompare(b.ownerName || '', 'he');
                    case 'plate':
                        return (a.plateNumber || '').localeCompare(b.plateNumber || '');
                    case 'year-new':
                        return (parseInt(b.year) || 0) - (parseInt(a.year) || 0);
                    case 'year-old':
                        return (parseInt(a.year) || 0) - (parseInt(b.year) || 0);
                    case 'maintenance':
                        const aDate = maintenanceCache[a.id] || new Date(0);
                        const bDate = maintenanceCache[b.id] || new Date(0);
                        return bDate - aDate;
                    case 'recent':
                    default:
                        const aCreated = a.createdAt?.toDate?.() || new Date(0);
                        const bCreated = b.createdAt?.toDate?.() || new Date(0);
                        return bCreated - aCreated;
                }
            });

            // Update display
            const allCards = document.querySelectorAll('#carsGrid > .card');
            const filteredIds = new Set(filteredCars.map(c => c.id));

            allCards.forEach(card => {
                const carId = card.getAttribute('data-car-id');
                card.style.display = filteredIds.has(carId) ? 'block' : 'none';
            });

            // Reorder cards based on sort
            const grid = document.getElementById('carsGrid');
            filteredCars.forEach(car => {
                const card = document.querySelector(`[data-car-id="${car.id}"]`);
                if (card) {
                    grid.appendChild(card);
                }
            });

            // Update results count
            updateSearchResultsCount(filteredCars.length, cars.length);
            updateActiveFilterTags();

            // Show empty state if no results
            const emptyState = document.getElementById('emptyState');
            if (filteredCars.length === 0 && cars.length > 0) {
                emptyState.innerHTML = '<p class="text-gray-500 text-xl">❌ לא נמצאו תוצאות</p><button onclick="clearAllFilters()" class="mt-4 bg-amber-500 text-white px-6 py-2 rounded-lg hover:bg-amber-600">נקה סינון</button>';
                emptyState.classList.remove('hidden');
            } else if (cars.length === 0) {
                emptyState.innerHTML = '<p class="text-gray-500 text-xl">אין רכבים במערכת</p><button onclick="openCarModal()" class="mt-4 bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700">הוסף רכב ראשון</button>';
                emptyState.classList.remove('hidden');
            } else {
                emptyState.classList.add('hidden');
            }
        }

        async function loadMaintenanceCache() {
            try {
                const snapshot = await db.collection('maintenance')
                    .where('userId', '==', currentUser.uid)
                    .orderBy('date', 'desc')
                    .get();

                maintenanceCache = {};
                snapshot.forEach(doc => {
                    const data = doc.data();
                    const carId = data.carId;
                    if (!maintenanceCache[carId]) {
                        maintenanceCache[carId] = new Date(data.date);
                    }
                });
            } catch (error) {
                console.error('Error loading maintenance cache:', error);
            }
        }

        function updateSearchResultsCount(shown, total) {
            const countEl = document.getElementById('searchResultsCount');
            if (countEl) {
                if (shown === total) {
                    countEl.textContent = `מציג ${total} רכבים`;
                } else {
                    countEl.textContent = `מציג ${shown} מתוך ${total} רכבים`;
                }
            }
        }

        function updateActiveFilterTags() {
            const container = document.getElementById('activeFilterTags');
            const wrapper = document.getElementById('activeFilters');
            if (!container || !wrapper) return;

            const tags = [];
            const searchTerm = document.getElementById('searchBox').value.trim();
            const filterCarType = document.getElementById('filterCarType')?.value;
            const filterYear = document.getElementById('filterYear')?.value;
            const filterMaintenanceStatus = document.getElementById('filterMaintenanceStatus')?.value;

            if (searchTerm) {
                tags.push({ label: `חיפוש: "${searchTerm}"`, clear: () => { document.getElementById('searchBox').value = ''; applyFilters(); } });
            }
            if (filterCarType) {
                tags.push({ label: `סוג: ${filterCarType}`, clear: () => { document.getElementById('filterCarType').value = ''; applyFilters(); } });
            }
            if (filterYear) {
                tags.push({ label: `שנה: ${filterYear}`, clear: () => { document.getElementById('filterYear').value = ''; applyFilters(); } });
            }
            if (filterMaintenanceStatus) {
                const statusLabels = { recent: 'טיפול אחרון', due: 'צריך טיפול', overdue: 'דחוף', never: 'ללא טיפולים' };
                tags.push({ label: `סטטוס: ${statusLabels[filterMaintenanceStatus]}`, clear: () => { document.getElementById('filterMaintenanceStatus').value = ''; applyFilters(); } });
            }

            if (tags.length === 0) {
                wrapper.classList.add('hidden');
                return;
            }

            wrapper.classList.remove('hidden');
            container.innerHTML = tags.map((tag, i) =>
                `<span class="inline-flex items-center gap-1 px-2 py-1 bg-amber-100 text-amber-800 rounded-full text-xs">
                    ${tag.label}
                    <button onclick="clearFilter(${i})" class="hover:text-red-600 font-bold">×</button>
                </span>`
            ).join('');

            // Store clear functions globally
            window._filterClearFunctions = tags.map(t => t.clear);
        }

        function clearFilter(index) {
            if (window._filterClearFunctions && window._filterClearFunctions[index]) {
                window._filterClearFunctions[index]();
            }
        }

        function clearAllFilters() {
            document.getElementById('searchBox').value = '';
            if (document.getElementById('filterCarType')) document.getElementById('filterCarType').value = '';
            if (document.getElementById('filterYear')) document.getElementById('filterYear').value = '';
            if (document.getElementById('filterMaintenanceStatus')) document.getElementById('filterMaintenanceStatus').value = '';
            if (document.getElementById('sortBy')) document.getElementById('sortBy').value = 'recent';
            applyFilters();
        }

        // Export CSV
        function exportCSV() {
            // Check if user has premium (paid subscription) - export restricted to paid users only
            if (!isPremiumUser && !isAdmin) {
                showPremiumModal('ייצוא נתונים');
                return;
            }

            // Rate limiting check for exports
            if (!RateLimiter.canPerform('exportData')) {
                const waitTime = RateLimiter.getTimeUntilReset('exportData');
                alert(`יותר מדי ייצואים. נסה שוב בעוד ${Math.ceil(waitTime / 60)} דקות`);
                return;
            }
            RateLimiter.recordAction('exportData');

            if (cars.length === 0) {
                alert('אין נתונים לייצוא');
                return;
            }

            let csv = 'מספר רישוי,שם בעלים,טלפון,סוג,דגם,שנה\n';
            cars.forEach(car => {
                csv += `${car.plateNumber},${car.ownerName || ''},${car.phone || ''},${car.carType || ''},${car.model || ''},${car.year || ''}\n`;
            });

            const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = `cars_${new Date().toISOString().split('T')[0]}.csv`;
            link.click();
        }

        // Sign Out
        async function signOut() {
            if (confirm('האם לצאת מהמערכת?')) {
                try {
                    await auth.signOut();
                    // التوجيه إلى صفحة تسجيل الدخول
                    window.location.href = 'login.html';
                } catch (error) {
                    console.error('Error signing out:', error);
                    alert('حدث خطأ أثناء تسجيل الخروج');
                }
            }
        }

        // Show Message
        function showMessage(message, type) {
            const errorDiv = document.getElementById('errorMsg');
            const successDiv = document.getElementById('successMsg');

            if (type === 'error') {
                errorDiv.textContent = message;
                errorDiv.classList.remove('hidden');
                successDiv.classList.add('hidden');
            } else {
                successDiv.textContent = message;
                successDiv.classList.remove('hidden');
                errorDiv.classList.add('hidden');
            }

            setTimeout(() => {
                errorDiv.classList.add('hidden');
                successDiv.classList.add('hidden');
            }, 5000);
        }
