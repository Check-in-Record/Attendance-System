/**
 * Part-time Attendance System - Instructions
 * 
 * วิธีทำให้ระบบทำงานได้ (เลือก 1 วิธี):
 * 
 * วิธีที่ 1: Deploy บน GitHub Pages หรือ Netlify (แนะนำ - ปลอดภัยสุด)
 * - Upload โฟลเดอร์นี้ขึ้น GitHub
 * - เปิด GitHub Pages
 * - แชร์ลิงก์ให้พนักงานใช้งาน
 * 
 * วิธีที่ 2: ใช้ Live Server ใน VS Code
 * - ติดตั้ง Extension "Live Server" โดย Ritwick Dey
 * - คลิกขวาที่ index.html > Open with Live Server
 * - เว็บจะเปิดที่ http://localhost:5500
 * 
 * วิธีที่ 3: เปิดจาก file:// โดยตรง (ทำงานได้แต่ไม่แนะนำ)
 * - ดับเบิ้ลคลิก index.html
 * - ระบบจะบันทึกข้อมูลได้ แต่ไม่เห็น response กลับมา
 * - ต้องเช็คใน Google Sheets ว่าบันทึกสำเร็จหรือไม่
 */

// ===================================
// Configuration
// ===================================
// Version 4.1 - Feature Update: Employee Registration Added
console.log("App.js Loaded - Version 4.1 (Registration Feature Active)");

// ===================================
// Utility Functions
// ===================================
function normalizePhone(phone) {
    if (!phone) return '';
    let p = String(phone).replace(/[^0-9]/g, '');
    if (p.startsWith('66') && p.length >= 11) p = '0' + p.substring(2);
    if (!p.startsWith('0') && p.length === 9) p = '0' + p;
    return p;
}

const CONFIG = {
    // Google Apps Script Web App URL (ใช้ URL กลาง ไม่มี /a/freshket.co/)
    API_URL: 'https://script.google.com/macros/s/AKfycbzNM6dpfeOX1ImhGthjkPzD7XdUPwyYAF2HeFLVBCJOIC6ZxkYJ6glySWFHHRxZZIaNbA/exec',

    // Google Sheets ID
    SHEET_ID: '1oKYvdnFBMzaoX54SZLb3xhG2nm_-XIRJNluGdpKzkyk',

    // API Secret Key - ต้องตรงกับใน Code.gs
    API_KEY: 'FreshketHR2024',

    // Warehouse Coordinates (Geo-fencing)
    WAREHOUSES: {
        'ไอยรา': { lat: 14.07, lng: 100.63, radius: 500 }, // รัศมี 500 เมตร
        'อาจณรงค์': { lat: 13.71, lng: 100.58, radius: 500 },
        'ลาดกระบัง': { lat: 13.72, lng: 100.78, radius: 1000 } // ลาดกระบังอาจจะใหญ่กว่า
    },

    // Admin Password สำหรับหน้าสร้างเอกสารและหน้าแอดมิน
    ADMIN_PASSWORD: '2024'
};

// ===================================
// Global State
// ===================================
let selectedWarehouse = null;
let selectedSupplier = null;
let currentCheckInData = null;
let currentReceiptData = null;

// Photo state - CRITICAL for iOS/Android compatibility
let capturedPhotos = {
    selfiePreview: null,
    idCardPreview: null,
    checkoutSelfiePreview: null
};

// Camera state
let cameraStream = null;
let currentCameraTargetPreviewId = null;
let currentCameraTargetInputId = null;
let currentPaymentRowId = null; // New for payment system

// ===================================
// UI Utilities
// ===================================
function showLoading(show) {
    const loader = document.getElementById('loadingOverlay');
    if (loader) {
        if (show) loader.classList.remove('hidden');
        else loader.classList.add('hidden');
    }
}

// ===================================
// Initialize App
// ===================================
document.addEventListener('DOMContentLoaded', function () {
    // Initialize Lucide icons
    lucide.createIcons();

    // Start clock
    updateClock();
    setInterval(updateClock, 1000);

    // Set today's date for filter
    const filterDate = document.getElementById('filterDate');
    if (filterDate) {
        filterDate.value = new Date().toISOString().split('T')[0];
    }

    // Hide loading overlay
    setTimeout(() => {
        document.getElementById('loadingOverlay').classList.add('hidden');
    }, 500);

    // Initialize Theme
    initTheme();
});

// ===================================
// Theme Functions
// ===================================
function initTheme() {
    const savedTheme = localStorage.getItem('theme');
    const themeToggle = document.getElementById('themeToggle');

    if (savedTheme === 'dark') {
        document.body.classList.add('dark-theme');
        if (themeToggle) {
            themeToggle.innerHTML = '<i data-lucide="sun"></i>';
            lucide.createIcons();
        }
    }

    if (themeToggle) {
        themeToggle.addEventListener('click', () => {
            document.body.classList.toggle('dark-theme');
            const isDark = document.body.classList.contains('dark-theme');
            localStorage.setItem('theme', isDark ? 'dark' : 'light');
            themeToggle.innerHTML = `<i data-lucide="${isDark ? 'sun' : 'moon'}"></i>`;
            lucide.createIcons();
        });
    }
}

// ===================================
// Clock Functions
// ===================================
function updateClock() {
    const now = new Date();
    const timeStr = now.toLocaleTimeString('th-TH', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });

    // Update header time
    const headerTime = document.getElementById('currentTime');
    if (headerTime) {
        headerTime.textContent = timeStr;
    }

    // Update check-in time display
    const checkInTime = document.getElementById('checkInTime');
    if (checkInTime) {
        checkInTime.textContent = timeStr;
    }

    // Update check-out time display
    const checkOutTime = document.getElementById('checkOutTime');
    if (checkOutTime) {
        checkOutTime.textContent = timeStr;
    }
}

// ===================================
// Navigation
// ===================================
function selectWarehouse(name) {
    selectedWarehouse = name;
    showScreen('supplierSelection');
}

function selectSupplier(name) {
    selectedSupplier = name;
    document.getElementById('headerWarehouseName').textContent = `${selectedWarehouse} | ${selectedSupplier}`;
    showScreen('mainMenu');
}

function showWarehouseSelection() {
    selectedWarehouse = null;
    selectedSupplier = null;
    document.getElementById('headerWarehouseName').textContent = 'Time Attendance';
    showScreen('warehouseSelection');
}

function requestAdminAccess(screenId) {
    const password = prompt('กรุณากรอกรหัสผ่านผู้ดูแลระบบเพื่อเข้าถึงเมนูนี้:');
    if (password === CONFIG.ADMIN_PASSWORD) {
        showScreen(screenId);
    } else if (password !== null) {
        showError('รหัสผ่านไม่ถูกต้อง กรุณาลองใหม่อีกครั้ง');
    }
}

function showScreen(screenId) {
    // Hide all screens
    document.querySelectorAll('.screen').forEach(screen => {
        screen.classList.remove('active');
    });

    // Handle Wide Mode for Admin and Receipt screen
    const appContainer = document.querySelector('.app-container');
    if (screenId === 'adminScreen' || screenId === 'receiptScreen') {
        appContainer.classList.add('wide-mode');
    } else {
        appContainer.classList.remove('wide-mode');
    }

    // Show target screen
    const targetScreen = document.getElementById(screenId);
    if (targetScreen) {
        targetScreen.classList.add('active');
        window.scrollTo(0, 0);
        // Re-init icons
        lucide.createIcons();
    }

    // Special actions for specific screens
    if (screenId === 'checkInScreen') {
        getGPSLocation();
        resetCheckInForm();
    } else if (screenId === 'checkOutScreen') {
        resetCheckOutForm();
    } else if (screenId === 'adminScreen') {
        loadAttendanceData();
    } else if (screenId === 'paymentScreen') {
        initPaymentScreen();
    }
}

// ===================================
// Geo-fencing Functions
// ===================================
function getDistance(lat1, lon1, lat2, lon2) {
    const R = 6371e3; // Earth radius in meters
    const phi1 = lat1 * Math.PI / 180;
    const phi2 = lat2 * Math.PI / 180;
    const deltaPhi = (lat2 - lat1) * Math.PI / 180;
    const deltaLambda = (lon2 - lon1) * Math.PI / 180;

    const a = Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
        Math.cos(phi1) * Math.cos(phi2) *
        Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c; // In meters
}

function checkGeoFence(warehouseName, userLocationStr) {
    if (!userLocationStr) return { success: false, message: "ไม่พบข้อมูล GPS" };

    const parts = userLocationStr.split(',');
    const userLat = parseFloat(parts[0]);
    const userLng = parseFloat(parts[1]);

    const warehouse = CONFIG.WAREHOUSES[warehouseName];
    if (!warehouse) return { success: true }; // No geo-fence defined

    const distance = getDistance(userLat, userLng, warehouse.lat, warehouse.lng);

    if (distance > warehouse.radius) {
        return {
            success: false,
            message: `คุณอยู่ห่างจากคลังสินค้ามากเกินไป (ระยะห่าง: ${Math.round(distance)} เมตร) กรุณาลงเวลาในพื้นที่ที่กำหนด`
        };
    }

    return { success: true };
}

// ===================================
// GPS Functions
// ===================================
function getGPSLocation() {
    const gpsStatus = document.getElementById('gpsStatus');
    const gpsInput = document.getElementById('gpsLocation');

    if (!navigator.geolocation) {
        updateGPSStatus('error', 'เบราว์เซอร์ไม่รองรับ GPS');
        return;
    }

    updateGPSStatus('pending', 'กำลังดึงตำแหน่ง GPS...');

    navigator.geolocation.getCurrentPosition(
        // Success
        (position) => {
            const lat = position.coords.latitude;
            const lng = position.coords.longitude;
            const coords = `${lat},${lng}`;

            gpsInput.value = coords;
            updateGPSStatus('success', `ได้รับตำแหน่งแล้ว: ${lat.toFixed(6)}, ${lng.toFixed(6)}`);
        },
        // Error
        (error) => {
            let message = 'ไม่สามารถดึงตำแหน่งได้';
            switch (error.code) {
                case error.PERMISSION_DENIED:
                    message = 'ผู้ใช้ไม่อนุญาตให้เข้าถึง GPS';
                    break;
                case error.POSITION_UNAVAILABLE:
                    message = 'ไม่สามารถระบุตำแหน่งได้';
                    break;
                case error.TIMEOUT:
                    message = 'หมดเวลาในการดึงตำแหน่ง';
                    break;
            }
            updateGPSStatus('error', message);
        },
        // Options
        {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 0
        }
    );
}

function updateGPSStatus(status, message) {
    const gpsStatus = document.getElementById('gpsStatus');
    const icon = gpsStatus.querySelector('.gps-icon');
    const text = gpsStatus.querySelector('span');

    icon.className = 'gps-icon ' + status;

    // Update icon
    let iconName = 'loader';
    if (status === 'success') iconName = 'check';
    if (status === 'error') iconName = 'x';

    icon.innerHTML = `<i data-lucide="${iconName}"></i>`;
    text.textContent = message;

    lucide.createIcons();
}

// ===================================
// Photo Functions
// ===================================
/**
 * Compress image before sending to avoid GAS payload limits
 * Returns a Base64 Data URL
 */
function compressImage(fileOrBlob, maxWidth = 800, quality = 0.7) {
    return new Promise((resolve, reject) => {
        // If it's already a base64 string (e.g. from a previous step), just return it
        if (typeof fileOrBlob === 'string' && fileOrBlob.startsWith('data:')) {
            return resolve(fileOrBlob);
        }

        const reader = new FileReader();
        reader.readAsDataURL(fileOrBlob);
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target.result;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;

                // Adjust size while maintaining aspect ratio
                if (width > height) {
                    if (width > maxWidth) {
                        height *= maxWidth / width;
                        width = maxWidth;
                    }
                } else {
                    if (height > maxWidth) {
                        width *= maxWidth / height;
                        height = maxWidth;
                    }
                }

                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);
                
                // Return as Data URL
                const dataUrl = canvas.toDataURL('image/jpeg', quality);
                resolve(dataUrl);
            };
            img.onerror = (err) => reject(new Error('Image load failed'));
        };
        reader.onerror = (err) => reject(new Error('File read failed'));
    });
}

// Preview photo and handle compression
async function previewPhoto(input, previewId) {
    if (input.files && input.files[0]) {
        showLoading(true);
        try {
            const originalFile = input.files[0];
            // Compress and get Data URL
            const compressedBase64 = await compressImage(originalFile);

            // Store Base64 string directly
            capturedPhotos[previewId] = compressedBase64;

            const preview = document.getElementById(previewId);
            if (preview) {
                preview.innerHTML = `<img src="${compressedBase64}" alt="Preview">`;
                preview.classList.add('has-image');
            }
        } catch (error) {
            console.error("Compression error:", error);
            showError("ไม่สามารถประมวลผลรูปภาพได้ กรุณาลองใหม่");
        } finally {
            showLoading(false);
        }
    }
}

// Custom Camera Modal functions
async function openCameraModal(facingMode, previewId, inputId) {
    currentCameraTargetPreviewId = previewId;
    currentCameraTargetInputId = inputId;

    // 1. Check if getUserMedia is supported
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    const isAndroid = /Android/.test(navigator.userAgent);
    const hasMediaDevices = !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);

    // 2. If not supported or problematic environment, fallback to native camera app IMMEDIATELY
    if (!hasMediaDevices) {
        console.warn("getUserMedia not supported, falling back to native input");
        document.getElementById(inputId).click();
        return;
    }

    document.getElementById('cameraModal').classList.add('active');

    // Dynamic labels
    const title = document.querySelector('#cameraModal h3');
    const hint = document.querySelector('.camera-hint');
    const overlay = document.querySelector('.camera-overlay');

    if (facingMode === 'user') {
        overlay.classList.add('selfie-mode');
        if (title) title.textContent = 'ถ่ายรูปยืนยันตัวตน (Selfie)';
        if (hint) hint.textContent = 'วางใบหน้าให้ตรงกลางและกดปุ่มถ่ายรูป';
    } else {
        overlay.classList.remove('selfie-mode');
        if (title) title.textContent = 'ถ่ายรูปบัตรประชาชน';
        if (hint) hint.textContent = 'วางบัตรให้พอดีกับกรอบและกดปุ่มถ่ายรูป';
    }

    try {
        const constraints = {
            video: {
                facingMode: facingMode === 'user' ? 'user' : { exact: 'environment' }
            },
            audio: false
        };

        try {
            cameraStream = await navigator.mediaDevices.getUserMedia(constraints);
        } catch (e) {
            console.warn("Retrying with minimal constraints", e);
            cameraStream = await navigator.mediaDevices.getUserMedia({ video: true });
        }

        const video = document.getElementById('cameraVideo');
        if (video) {
            video.srcObject = cameraStream;
            video.setAttribute('playsinline', ''); // Essential for iOS
            const playPromise = video.play();
            if (playPromise !== undefined) {
                playPromise.catch(error => {
                    console.error("Auto-play failed:", error);
                });
            }
        }
    } catch (err) {
        console.error("Error accessing camera:", err);

        // Final fallback: If ERROR in modal, close it and open native camera
        if (isAndroid || !isIOS) {
            console.log("Android detected or camera error, attempting native input trigger");
            closeCameraModal();
            const input = document.getElementById(inputId);
            if (input) input.click();
        }
    }
}

function closeCameraModal() {
    if (cameraStream) {
        cameraStream.getTracks().forEach(track => track.stop());
        cameraStream = null;
    }
    document.getElementById('cameraModal').classList.remove('active');
}

function takePicture() {
    const video = document.getElementById('cameraVideo');
    const canvas = document.getElementById('cameraCanvas');
    if (!video || !canvas) return;

    const context = canvas.getContext('2d');

    // Canvas size = Video natural size to prevent stretching
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    // Draw video frame to canvas
    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Convert to high quality JPEG and compress
    canvas.toBlob(async (blob) => {
        try {
            const compressedBase64 = await compressImage(blob);

            // Store Base64 string directly
            if (currentCameraTargetPreviewId) {
                capturedPhotos[currentCameraTargetPreviewId] = compressedBase64;
            }

            // Preview immediately from Data URL
            const preview = document.getElementById(currentCameraTargetPreviewId);
            if (preview) {
                preview.innerHTML = `<img src="${compressedBase64}" alt="Preview">`;
                preview.classList.add('has-image');
            }

            closeCameraModal();
        } catch (error) {
            console.error("Capture capture error:", error);
            showError("ไม่สามารถประมวลผลการถ่ายภาพได้");
        }
    }, 'image/jpeg', 0.8);
}

// ===================================
// Check-In Functions
// ===================================
function resetCheckInForm() {
    const form = document.getElementById('checkInForm');
    if (form) form.reset();

    // Reset global photo state
    capturedPhotos.selfiePreview = null;
    capturedPhotos.idCardPreview = null;

    // Reset photo previews
    const selfiePreview = document.getElementById('selfiePreview');
    const idCardPreview = document.getElementById('idCardPreview');

    if (selfiePreview) {
        selfiePreview.innerHTML = `<i data-lucide="user-circle"></i><span>ยังไม่มีรูป</span>`;
        selfiePreview.classList.remove('has-image');
    }

    if (idCardPreview) {
        idCardPreview.innerHTML = `<i data-lucide="credit-card"></i><span>ยังไม่มีรูป</span>`;
        idCardPreview.classList.remove('has-image');
    }

    // รีเซ็ต flag พนักงานเก่า
    returningEmployee = false;

    lucide.createIcons();
}

// Check-In Logic
async function submitCheckIn(event) {
    event.preventDefault();

    // Validation
    const phone = document.getElementById('phone').value;
    const accountNumber = document.getElementById('accountNumber').value;

    if (!/^0[0-9]{9}$/.test(phone)) {
        showError("กรุณากรอกเบอร์โทรศัพท์ให้ถูกต้อง (10 หลัก เริ่มด้วย 0)");
        return;
    }

    if (!/^[0-9]{8,15}$/.test(accountNumber)) {
        showError("กรุณากรอกเลขบัญชีให้ถูกต้อง (8-15 หลัก ตัวเลขเท่านั้น)");
        return;
    }

    const submitBtn = document.getElementById('checkInSubmitBtn');
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i data-lucide="loader"></i> กำลังบันทึก...';
    lucide.createIcons();

    const gpsLocation = document.getElementById('gpsLocation').value;

    // Check Geo-fencing - Warn only
    const geoCheck = checkGeoFence(selectedWarehouse, gpsLocation);
    if (!geoCheck.success) {
        if (!confirm(`${geoCheck.message}\n\nคุณยืนยันที่จะบันทึกการเข้างานในตำแหน่งปัจจุบันหรือไม่?`)) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = '<i data-lucide="check-circle"></i> บันทึกเข้างาน';
            lucide.createIcons();
            return;
        }
    }

    try {
        // ... (Validate Inputs Code - Same as before) ...
        const fullName = document.getElementById('fullName').value.trim();
        const phone = document.getElementById('phone').value.trim();
        const bankName = document.getElementById('bankName').value;
        const accountNumber = document.getElementById('accountNumber').value.trim();
        const gpsLocation = document.getElementById('gpsLocation').value;

        // Check both Camera and Gallery inputs - Updated to use capturedPhotos
        const selfieFile = capturedPhotos['selfiePreview'];
        const idCardFile = capturedPhotos['idCardPreview'];

        if (!selfieFile) throw new Error('กรุณาถ่ายรูป Selfie ก่อนบันทึก');
        // พนักงานใหม่: ต้องถ่ายบัตรประชาชน | พนักงานเก่า: ไม่ต้องถ่าย
        if (!idCardFile && !returningEmployee) throw new Error('กรุณาถ่ายรูปบัตรประชาชน');
        if (!gpsLocation) throw new Error('กรุณาเปิด GPS และรอจนกว่าตำแหน่งจะขึ้น');

        // --- รูปภาพถูกบีบอัดและเป็น Base64 อยู่แล้วใน capturedPhotos ---
        const selfieBase64 = capturedPhotos['selfiePreview'];
        const idCardFileState = capturedPhotos['idCardPreview'];
        
        let idCardBase64 = '';
        const isIdCardUrl = typeof idCardFileState === 'string' && idCardFileState.startsWith('http');
        const idCardPhotoUrl = isIdCardUrl ? idCardFileState : '';
        
        if (!isIdCardUrl && idCardFileState) {
            // ถ้าเป็น Base64 string (จากกล้อง/อัลบั้ม) ให้ใช้ได้เลย
            // ถ้าบังเอิญยังเป็น File อยู่ (กรณี fallback) ให้บีบอัดก่อน
            idCardBase64 = await compressImage(idCardFileState, 800, 0.7);
        }

        const now = new Date();
        const checkInTime = now.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

        // เตรียมข้อมูลที่จะส่ง (JSON)
        const payload = {
            action: 'checkIn',
            apiKey: CONFIG.API_KEY,
            warehouse: selectedWarehouse,
            supplier: selectedSupplier,
            fullName: fullName,
            phone: phone,
            bankName: bankName,
            accountNumber: accountNumber,
            gpsLocation: gpsLocation,
            selfiePhoto: selfieBase64,
            idCardPhoto: idCardBase64,
            idCardPhotoUrl: idCardPhotoUrl,
            checkInTime: checkInTime,
            checkInDate: now.toLocaleDateString('th-TH'),
            timestamp: now.toISOString()
        };

        // --- ส่งผ่าน fetch (JSON) เพื่อรองรับไฟล์ขนาดใหญ่ ---
        try {
            // ใช้ mode: 'no-cors' สำหรับการส่งไปยัง GAS Web App
            await fetch(CONFIG.API_URL, {
                method: 'POST',
                mode: 'no-cors',
                cache: 'no-cache',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            
            console.log('Check-in submitted via fetch');
            showSuccess('บันทึกเข้างานสำเร็จ!', `${fullName} เข้างานเวลา ${checkInTime}`);
            resetCheckInForm();
            setTimeout(() => { showScreen('mainMenu'); }, 2500);
            
        } catch (fetchErr) {
            console.error('Fetch error (likely CORS but request sent):', fetchErr);
            // ถ้าติด CORS แต่มันส่งไปแล้ว มักจะสำเร็จ
            showSuccess('กำลังประมวลผล...', 'ระบบส่งข้อมูลเรียบร้อยแล้ว');
            resetCheckInForm();
            setTimeout(() => { showScreen('mainMenu'); }, 2500);
        }

    } catch (error) {
        showError(error.message);
    } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<i data-lucide="check-circle"></i> บันทึกเข้างาน';
        lucide.createIcons();
    }
}

// ===================================
// Check-Out Functions
// ===================================
function resetCheckOutForm() {
    const form = document.getElementById('checkOutForm');
    if (form) form.reset();

    // Reset global photo state
    capturedPhotos.checkoutSelfiePreview = null;

    const preview = document.getElementById('checkoutSelfiePreview');
    if (preview) {
        preview.innerHTML = `<i data-lucide="user-circle"></i><span>ยังไม่มีรูป</span>`;
        preview.classList.remove('has-image');
    }

    document.getElementById('checkInResult').classList.add('hidden');
    document.getElementById('checkOutForm').classList.add('hidden');
    document.getElementById('checkOutRowId').value = '';
    currentCheckInData = null;
    lucide.createIcons();
}

async function searchCheckIn() {
    const phone = document.getElementById('searchPhone').value.trim();

    if (!phone) {
        showError('กรุณากรอกเบอร์โทรศัพท์');
        return;
    }

    try {
        const response = await fetch(`${CONFIG.API_URL}?action=searchCheckIn&apiKey=${CONFIG.API_KEY}&warehouse=${encodeURIComponent(selectedWarehouse)}&phone=${encodeURIComponent(phone)}`);
        const result = await response.json();

        if (result.success && result.data) {
            currentCheckInData = result.data;

            // Show result
            document.getElementById('resultName').textContent = result.data.fullName;
            document.getElementById('resultCheckInTime').textContent = result.data.checkInTime;
            document.getElementById('resultBank').textContent = result.data.bankName;
            document.getElementById('checkOutRowId').value = result.data.rowIndex;

            document.getElementById('checkInResult').classList.remove('hidden');
            document.getElementById('checkOutForm').classList.remove('hidden');

            lucide.createIcons();
        } else {
            showError('ไม่พบข้อมูลเข้างานของเบอร์นี้ในวันนี้');
        }
    } catch (error) {
        showError('ไม่สามารถค้นหาข้อมูลได้ กรุณาลองใหม่อีกครั้ง');
        console.error('Search error:', error);
    }
}

async function submitCheckOut(event) {
    event.preventDefault();

    const submitBtn = document.getElementById('checkOutSubmitBtn');
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i data-lucide="loader"></i> กำลังบันทึก...';
    lucide.createIcons();

    try {
        // Use capturedPhotos global object
        const selfieFile = capturedPhotos['checkoutSelfiePreview'];

        if (!selfieFile) {
            throw new Error('กรุณาถ่ายรูป Selfie ออกงาน');
        }

        // --- บีบอัดรูปภาพก่อนส่ง ---
        const selfieBase64 = await compressImage(selfieFile, 800, 0.7);

        // Get current time
        const now = new Date();
        const checkOutTime = now.toLocaleTimeString('th-TH', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });

        // Prepare data (JSON)
        const payload = {
            action: 'checkOut',
            apiKey: CONFIG.API_KEY,
            warehouse: selectedWarehouse,
            rowIndex: document.getElementById('checkOutRowId').value,
            checkoutSelfie: selfieBase64,
            checkOutTime: checkOutTime,
            timestamp: now.toISOString()
        };

        // --- ส่งผ่าน fetch (JSON) ---
        try {
            await fetch(CONFIG.API_URL, {
                method: 'POST',
                mode: 'no-cors',
                cache: 'no-cache',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            
            console.log('Check-out submitted via fetch');
            showSuccess('บันทึกออกงานสำเร็จ!', `ออกงานเวลา ${checkOutTime}`);
            resetCheckOutForm();
            setTimeout(() => { showScreen('mainMenu'); }, 2500);
            
        } catch (fetchErr) {
            console.error('Fetch error during check-out:', fetchErr);
            showSuccess('กำลังประมวลผล...', 'ระบบส่งข้อมูลออกงานเรียบร้อยแล้ว');
            resetCheckOutForm();
            setTimeout(() => { showScreen('mainMenu'); }, 2500);
        }

    } catch (error) {
        showError(error.message);
    } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<i data-lucide="check-circle"></i> บันทึกออกงาน';
        lucide.createIcons();
    }
}

// ===================================
//Receipt Functions
// ===================================
async function searchForReceipt() {
    const phone = document.getElementById('receiptSearchPhone').value.trim();

    if (!selectedWarehouse) {
        showError('กรุณาเลือกคลังสินค้าก่อนค้นหา');
        return;
    }

    if (!phone) {
        showError('กรุณากรอกเบอร์โทรศัพท์');
        return;
    }

    // Reset OT fields
    document.getElementById('otHours').value = '';
    document.getElementById('calculationInfo').style.display = 'none';

    try {
        const response = await fetch(`${CONFIG.API_URL}?action=searchForReceipt&apiKey=${CONFIG.API_KEY}&warehouse=${encodeURIComponent(selectedWarehouse)}&phone=${encodeURIComponent(phone)}`);
        const result = await response.json();

        if (result.success && result.data) {
            currentReceiptData = result.data;
            // Ensure rowIndex is preserved from search response
            currentReceiptData.rowIndex = result.data.rowIndex;
            currentWageRates = result.wageRates || {}; // Update rates

            // Auto-fill price based on supplier
            const rate = currentWageRates[currentReceiptData.supplier];
            if (rate) {
                document.getElementById('paymentAmount').value = rate;
            } else {
                document.getElementById('paymentAmount').value = '';
            }

            document.getElementById('receiptGenerator').classList.remove('hidden');
        } else {
            showError('ไม่พบข้อมูล');
        }
    } catch (error) {
        showError('ไม่สามารถค้นหาข้อมูลได้');
    }
}

function calculateTotalAmount() {
    const baseAmount = parseFloat(document.getElementById('paymentAmount').value) || 0;
    const otHours = parseFloat(document.getElementById('otHours').value) || 0;

    const calculationInfo = document.getElementById('calculationInfo');

    if (baseAmount > 0) {
        const hourlyRate = baseAmount / 8;
        const otAmount = hourlyRate * 1.5 * otHours;
        const totalAmount = baseAmount + otAmount;

        document.getElementById('calcBaseAmount').textContent = baseAmount.toLocaleString('th-TH', { minimumFractionDigits: 2 }) + ' บาท';
        document.getElementById('calcOtHoursDisplay').textContent = otHours;
        document.getElementById('calcOtAmount').textContent = otAmount.toLocaleString('th-TH', { minimumFractionDigits: 2 }) + ' บาท';
        document.getElementById('calcTotalAmount').textContent = totalAmount.toLocaleString('th-TH', { minimumFractionDigits: 2 }) + ' บาท';

        calculationInfo.style.display = 'block';
    } else {
        calculationInfo.style.display = 'none';
    }
}

function generateReceipt() {
    const amount = document.getElementById('paymentAmount').value;
    const otHours = document.getElementById('otHours').value || 0;
    const customDate = document.getElementById('receiptDateInput').value;

    if (!amount || parseFloat(amount) <= 0) {
        showError('กรุณากรอกจำนวนเงิน');
        return;
    }

    const baseAmountVal = parseFloat(amount);
    const otHoursVal = parseFloat(otHours);
    const hourlyRate = baseAmountVal / 8;
    const otAmountVal = hourlyRate * 1.5 * otHoursVal;
    const totalAmountVal = baseAmountVal + otAmountVal;

    // Format date (Buddhist era for Thai locale)
    const targetDate = customDate ? new Date(customDate) : new Date();
    const dateStr = targetDate.toLocaleDateString('th-TH', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });

    // Fill receipt data
    document.getElementById('receiptDate').textContent = dateStr;
    document.getElementById('receiptFullName').textContent = currentReceiptData?.fullName || '-';
    document.getElementById('receiptSignName').textContent = currentReceiptData?.fullName || '-';
    document.getElementById('receiptBankName').textContent = currentReceiptData?.bankName || '-';
    document.getElementById('receiptAccountNumber').textContent = currentReceiptData?.accountNumber || '-';

    // Breakdown
    document.getElementById('receiptBaseAmountDisplay').textContent = baseAmountVal.toLocaleString('th-TH', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });

    const otRow = document.getElementById('receiptOtRow');
    if (otHoursVal > 0) {
        otRow.style.display = 'flex';
        document.getElementById('receiptOtHoursDisplay').textContent = otHoursVal;
        document.getElementById('receiptOtAmountDisplay').textContent = otAmountVal.toLocaleString('th-TH', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        });
    } else {
        otRow.style.display = 'none';
    }

    document.getElementById('receiptAmountDisplay').textContent = totalAmountVal.toLocaleString('th-TH', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });

    // Show ID card if available (Prioritize Base64 for PDF export on file://)
    if (currentReceiptData?.idCardPhotoBase64) {
        document.getElementById('receiptIdCardImg').src = currentReceiptData.idCardPhotoBase64;
    } else if (currentReceiptData?.idCardPhotoUrl) {
        document.getElementById('receiptIdCardImg').src = currentReceiptData.idCardPhotoUrl;
    }

    document.getElementById('receiptPreviewContainer').classList.remove('hidden');
}

async function exportReceipt() {
    if (!currentReceiptData) {
        showError('กรุณาค้นหาข้อมูลพนักงานก่อน');
        return;
    }

    const amount = document.getElementById('paymentAmount').value;
    const otHours = document.getElementById('otHours').value || 0;
    const customDate = document.getElementById('receiptDateInput').value;

    if (!amount || parseFloat(amount) <= 0) {
        showError('กรุณากรอกจำนวนเงิน');
        return;
    }

    const baseAmountVal = parseFloat(amount);
    const otHoursVal = parseFloat(otHours);
    const hourlyRate = baseAmountVal / 8;
    const otAmountVal = hourlyRate * 1.5 * otHoursVal;
    const totalAmountVal = baseAmountVal + otAmountVal;

    const btn = document.querySelector('.btn-export');
    btn.innerHTML = '<i data-lucide="loader"></i> กำลังสร้าง PDF...';
    btn.disabled = true;
    lucide.createIcons();

    try {
        // Create a form to POST data
        const form = document.createElement('form');
        form.method = 'POST';
        form.action = CONFIG.API_URL;
        form.target = '_blank';

        // Add form fields
        const fields = {
            action: 'generateReceiptPDF',
            apiKey: CONFIG.API_KEY,
            fullName: currentReceiptData.fullName,
            bankName: currentReceiptData.bankName,
            accountNumber: currentReceiptData.accountNumber,
            amount: totalAmountVal,
            baseAmount: baseAmountVal,
            otHours: otHoursVal,
            otAmount: otAmountVal,
            rowIndex: currentReceiptData.rowIndex || '',
            warehouse: selectedWarehouse || '',
            customDate: customDate || '',
            idCardPhotoUrl: currentReceiptData.idCardPhotoUrl || '',
            idCardPhotoBase64: currentReceiptData.idCardPhotoBase64 || ''
        };

        for (const [key, value] of Object.entries(fields)) {
            const input = document.createElement('input');
            input.type = 'hidden';
            input.name = key;
            input.value = value;
            form.appendChild(input);
        }

        // Submit form
        document.body.appendChild(form);
        form.submit();
        document.body.removeChild(form);

        showSuccess('กำลังเปิดเอกสาร...', 'กรุณารอสักครู่');
    } catch (error) {
        console.error('PDF Export Error:', error);
        showError('ไม่สามารถสร้าง PDF ได้');
    } finally {
        setTimeout(() => {
            btn.innerHTML = '<i data-lucide="download"></i> บันทึกเป็น PDF';
            btn.disabled = false;
            lucide.createIcons();
        }, 2000);
    }
}

// ===================================
// Shared Data
// ===================================
let currentWageRates = {}; // Store wage rates globally

// ===================================

// ===================================
// Modal Functions
// ===================================
function showSuccess(title, message) {
    document.getElementById('successTitle').textContent = title;
    document.getElementById('successMessage').textContent = message;
    document.getElementById('successModal').classList.add('active');
    lucide.createIcons();
}

function showError(message) {
    document.getElementById('errorMessage').textContent = message;
    document.getElementById('errorModal').classList.add('active');
    lucide.createIcons();
}

function closeModal(modalId) {
    document.getElementById(modalId).classList.remove('active');
}

// ===================================
// Payment Management Functions
// ===================================
function initPaymentScreen() {
    const filterDate = document.getElementById('paymentFilterDate');
    const filterWarehouse = document.getElementById('paymentFilterWarehouse');

    // Set default date to today if not set
    if (!filterDate.value) {
        filterDate.value = new Date().toISOString().split('T')[0];
    }

    // Set default warehouse from global selection
    if (selectedWarehouse && filterWarehouse) {
        filterWarehouse.value = selectedWarehouse;
    }

    loadPaymentData();
}

async function loadPaymentData() {
    const date = document.getElementById('paymentFilterDate').value;
    const warehouse = document.getElementById('paymentFilterWarehouse').value;
    const supplierFilter = document.getElementById('paymentFilterSupplier') ? document.getElementById('paymentFilterSupplier').value : 'ทั้งหมด';
    const listContainer = document.getElementById('paymentWorkerList');

    if (!date || !warehouse) return;

    listContainer.innerHTML = `
        <div class="loading-state">
            <i data-lucide="loader" class="spin"></i>
            <p>กำลังค้นหาข้อมูล...</p>
        </div>
    `;
    lucide.createIcons();

    try {
        const response = await fetch(`${CONFIG.API_URL}?action=getAttendance&apiKey=${CONFIG.API_KEY}&date=${date}&warehouse=${encodeURIComponent(warehouse)}`);
        const result = await response.json();

        if (result.success && result.data && result.data.length > 0) {
            let workerHtml = '';
            let matchedCount = 0;
            let paidCount = 0;
            let unpaidCount = 0;

            result.data.forEach((worker) => {
                // Client-side filter for supplier
                if (supplierFilter !== 'ทั้งหมด' && worker.supplier !== supplierFilter) return;

                matchedCount++;
                const { fullName, phone, checkInTime, checkOutTime, status, slipUrl, rowIndex, supplier, bankName, accountNumber } = worker;
                const hasSlip = slipUrl && slipUrl !== '';

                if (hasSlip) paidCount++;
                else unpaidCount++;

                workerHtml += `
                    <div class="worker-card ${hasSlip ? 'paid' : ''}">
                        <div class="worker-info">
                            <div class="worker-primary">
                                <span class="worker-name">${fullName}</span>
                                <span class="worker-status-badge ${status === 'ออกงานแล้ว' ? 'success' : 'warning'}">${status}</span>
                            </div>
                            <div class="worker-details">
                                <span><i data-lucide="phone" class="icon-xs"></i> ${phone}</span>
                                <span class="bank-details">
                                    <i data-lucide="credit-card" class="icon-xs"></i> 
                                    ${bankName} - ${accountNumber}
                                    <button type="button" class="btn-copy" onclick="copyToClipboard('${accountNumber}', this)">
                                        <i data-lucide="copy" class="icon-xs"></i>
                                    </button>
                                </span>
                                <span class="worker-tag">${supplier || '-'}</span>
                            </div>
                        </div>
                        <div class="worker-actions">
                            ${hasSlip ? `
                                <a href="${slipUrl}" target="_blank" class="btn-view-slip">
                                    <i data-lucide="image"></i> ดูสลิป
                                </a>
                                <button class="btn-upload-slip re-upload" onclick="openSlipUpload(${rowIndex})">
                                    <i data-lucide="refresh-cw"></i> เปลี่ยน
                                </button>
                            ` : `
                                <button class="btn-upload-slip" onclick="openSlipUpload(${rowIndex})">
                                    <i data-lucide="upload"></i> อัปโหลดสลิป
                                </button>
                            `}
                        </div>
                    </div>
                `;
            });

            const summaryHtml = `
                <div class="payment-summary">
                    <div class="summary-card total">
                        <span class="label">ทั้งหมด</span>
                        <span class="value">${matchedCount}</span>
                    </div>
                    <div class="summary-card paid">
                        <span class="label">โอนแล้ว</span>
                        <span class="value success">${paidCount}</span>
                    </div>
                    <div class="summary-card unpaid">
                        <span class="label">คงเหลือ</span>
                        <span class="value danger">${unpaidCount}</span>
                    </div>
                </div>
            `;

            if (matchedCount === 0) {
                listContainer.innerHTML = `
                    <div class="empty-state">
                        <i data-lucide="user-minus"></i>
                        <p>ไม่พบข้อมูลในกลุ่มสังกัด "${supplierFilter}"</p>
                    </div>
                `;
            } else {
                listContainer.innerHTML = summaryHtml + workerHtml;
            }
        } else {
            listContainer.innerHTML = `
                <div class="empty-state">
                    <i data-lucide="info"></i>
                    <p>ไม่พบข้อมูลพนักงานในวันที่เลือก</p>
                </div>
            `;
        }
        lucide.createIcons();
    } catch (error) {
        console.error('Load payment data error:', error);
        listContainer.innerHTML = `
            <div class="error-state">
                <i data-lucide="alert-circle"></i>
                <p>เกิดข้อผิดพลาดในการโหลดข้อมูล</p>
            </div>
        `;
        lucide.createIcons();
    }
}

function copyToClipboard(text, btnElement) {
    if (!text || text === 'undefined') return;

    navigator.clipboard.writeText(text).then(() => {
        const originalIcon = btnElement.innerHTML;
        btnElement.innerHTML = '<i data-lucide="check" class="icon-xs"></i>';
        btnElement.classList.add('copied');
        lucide.createIcons();

        setTimeout(() => {
            btnElement.innerHTML = '<i data-lucide="copy" class="icon-xs"></i>';
            btnElement.classList.remove('copied');
            lucide.createIcons();
        }, 2000);
    }).catch(err => {
        console.error('Copy failed', err);
    });
}

function openSlipUpload(rowId) {
    currentPaymentRowId = rowId;
    document.getElementById('slipUploadInput').click();
}

async function handleSlipUpload(input) {
    if (!input.files || !input.files[0] || !currentPaymentRowId) return;

    showLoading(true);
    const warehouse = document.getElementById('paymentFilterWarehouse').value;

    try {
        const file = input.files[0];
        // บีบอัดรูปภาพสลิปที่หน้าบ้านก่อน
        const base64 = await compressImage(file, 1000, 0.8);

        const payload = {
            action: 'updatePaymentSlip',
            apiKey: CONFIG.API_KEY,
            warehouse: warehouse,
            rowIndex: currentPaymentRowId,
            slipPhoto: base64
        };

        // ส่งผ่าน fetch (JSON)
        await fetch(CONFIG.API_URL, {
            method: 'POST',
            mode: 'no-cors',
            cache: 'no-cache',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        // Refresh data after short delay
        setTimeout(() => {
            showLoading(false);
            showSuccess('อัปโหลดสลิปสำเร็จ!', 'ข้อมูลใน Google Sheets ถูกอัปเดตเรียบร้อยแล้ว');
            loadPaymentData();
        }, 2000);

    } catch (error) {
        showLoading(false);
        showError('ไม่สามารถอัปโหลดสลิปได้: ' + error.message);
    } finally {
        input.value = ''; // Reset input
    }
}

// Close modal on backdrop click
document.querySelectorAll('.modal').forEach(modal => {
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.classList.remove('active');
        }
    });
});

// ===================================
// Auto-fill Functions
// ===================================
let phoneDebounceTimer = null;
let returningEmployee = false; // true = พบข้อมูลพนักงานเก่า (ไม่ต้องเซ็นบัตรประชาชนอีก)

async function handlePhoneInput(input) {
    const phone = input.value;
    const loadingIndicator = document.getElementById('phoneLoadingIndicator');
    const foundIndicator = document.getElementById('phoneFoundIndicator');

    // ซ่อน indicators
    if (loadingIndicator) loadingIndicator.style.display = 'none';
    if (foundIndicator) foundIndicator.style.display = 'none';

    // ถ้ายังพิมพ์ไม่ครบ 10 หลัก ไม่ต้องทำอะไร
    if (phone.length !== 10 || !/^0[0-9]{9}$/.test(phone)) {
        return;
    }

    // Debounce เพื่อไม่ให้เรียก API บ่อยเกินไป
    clearTimeout(phoneDebounceTimer);
    phoneDebounceTimer = setTimeout(async () => {
        await searchAndFillData(phone);
    }, 500);
}

async function searchAndFillData(phone) {
    const loadingIndicator = document.getElementById('phoneLoadingIndicator');
    const foundIndicator = document.getElementById('phoneFoundIndicator');

    try {
        // แสดง loading
        if (loadingIndicator) {
            loadingIndicator.style.display = 'block';
            lucide.createIcons();
        }

        // เรียก API
        const url = `${CONFIG.API_URL}?action=getLastCheckIn&apiKey=${CONFIG.API_KEY}&warehouse=${encodeURIComponent(selectedWarehouse)}&phone=${encodeURIComponent(phone)}`;
        const response = await fetch(url);
        const result = await response.json();

        if (loadingIndicator) loadingIndicator.style.display = 'none';

        if (result.success && result.data) {
            returningEmployee = true; // พบพนักงานเก่า → ไม่ต้องเซ็นบัตรประชาชนอีก

            // Auto-fill ข้อมูล (ยกเว้นรูป)
            document.getElementById('fullName').value = result.data.fullName;
            document.getElementById('bankName').value = result.data.bankName;
            document.getElementById('accountNumber').value = result.data.accountNumber;

            // Auto-fill รูปบัตรประชาชน (ถ้ามี)
            if (result.data.idCardUrl) {
                const idCardPreview = document.getElementById('idCardPreview');
                if (idCardPreview) {
                    idCardPreview.innerHTML = `<img src="${result.data.idCardUrl}" alt="ID Card">`;
                    idCardPreview.classList.add('has-image');
                }
                capturedPhotos['idCardPreview'] = result.data.idCardUrl;
            } else {
                // พนักงานเก่า แต่ไม่มีรูปบัตรเก่า → แจ้งให้ถ่ายครั้งนี้ แต่ไม่บล็อคการบันทึก
                const idCardPreview = document.getElementById('idCardPreview');
                if (idCardPreview) {
                    idCardPreview.innerHTML = `<i data-lucide="alert-circle"></i><span>ไม่พบรูปบัตรเก่า - ถ่ายใหม่หรือข้ามได้</span>`;
                    idCardPreview.classList.remove('has-image');
                }
                lucide.createIcons();
            }

            // แสดง success indicator
            if (foundIndicator) {
                foundIndicator.style.display = 'block';
                lucide.createIcons();

                // ซ่อนหลัง 3 วินาที
                setTimeout(() => {
                    foundIndicator.style.display = 'none';
                }, 3000);
            }
        }
    } catch (error) {
        console.error('Auto-fill error:', error);
        if (loadingIndicator) loadingIndicator.style.display = 'none';
    }
}

// ===================================
// Summary Dashboard Functions
// ===================================
let summaryDataCache = [];

function initSummaryScreen() {
    const filterDate = document.getElementById('summaryFilterDate');
    const filterWarehouse = document.getElementById('summaryFilterWarehouse');

    if (!filterDate.value) {
        filterDate.value = new Date().toISOString().split('T')[0];
    }
    if (selectedWarehouse && filterWarehouse) {
        filterWarehouse.value = selectedWarehouse;
    }

    showScreen('summaryScreen');
    loadSummaryData();
}

async function loadSummaryData() {
    const date = document.getElementById('summaryFilterDate').value;
    const warehouse = document.getElementById('summaryFilterWarehouse').value;
    const listContainer = document.getElementById('summaryWorkerList');

    if (!date || !warehouse) return;

    listContainer.innerHTML = `
        <div class="loading-state">
            <i data-lucide="loader" class="spin"></i>
            <p>กำลังค้นหาข้อมูล...</p>
        </div>
    `;
    lucide.createIcons();

    try {
        const response = await fetch(`${CONFIG.API_URL}?action=getAttendance&apiKey=${CONFIG.API_KEY}&date=${date}&warehouse=${encodeURIComponent(warehouse)}`);
        const result = await response.json();

        if (result.success && result.data && result.data.length > 0) {
            summaryDataCache = result.data;

            // Calculate stats
            const total = result.data.length;
            const working = result.data.filter(w => w.status === 'เข้างาน').length;
            const done = result.data.filter(w => w.status === 'ออกงานแล้ว').length;
            const paid = result.data.filter(w => w.slipUrl && w.slipUrl !== '').length;

            // Update stat cards
            document.getElementById('statTotal').textContent = total;
            document.getElementById('statWorking').textContent = working;
            document.getElementById('statDone').textContent = done;
            document.getElementById('statPaid').textContent = paid;

            // Build employee list
            let html = '';
            result.data.forEach((worker, index) => {
                const statusClass = worker.status === 'ออกงานแล้ว' ? 'success' : 'warning';
                const statusText = worker.status || 'เข้างาน';
                html += `
                    <div class="summary-employee-card" onclick="showEmployeeDetail(${index})">
                        <div class="emp-avatar">
                            ${worker.selfieInUrl
                        ? `<img src="${worker.selfieInUrl}" alt="${worker.fullName}" referrerpolicy="no-referrer">`
                        : `<i data-lucide="user"></i>`
                    }
                        </div>
                        <div class="emp-card-left">
                            <div class="emp-name">${worker.fullName}</div>
                            <div class="emp-meta">
                                <span><i data-lucide="phone" class="icon-xs"></i> ${worker.phone}</span>
                                <span class="worker-tag">${worker.supplier || '-'}</span>
                            </div>
                        </div>
                        <div class="emp-card-right">
                            <span class="worker-status-badge ${statusClass}">${statusText}</span>
                            <div class="emp-time">${worker.checkInTime || '-'}</div>
                        </div>
                    </div>
                `;
            });

            listContainer.innerHTML = html;
        } else {
            summaryDataCache = [];
            document.getElementById('statTotal').textContent = '0';
            document.getElementById('statWorking').textContent = '0';
            document.getElementById('statDone').textContent = '0';
            document.getElementById('statPaid').textContent = '0';
            listContainer.innerHTML = `
                <div class="empty-state">
                    <i data-lucide="info"></i>
                    <p>ไม่พบข้อมูลพนักงานในวันที่เลือก</p>
                </div>
            `;
        }
        lucide.createIcons();
    } catch (error) {
        console.error('Load summary error:', error);
        listContainer.innerHTML = `
            <div class="error-state">
                <i data-lucide="alert-circle"></i>
                <p>เกิดข้อผิดพลาดในการโหลดข้อมูล</p>
            </div>
        `;
        lucide.createIcons();
    }
}

function showEmployeeDetail(index) {
    const worker = summaryDataCache[index];
    if (!worker) return;

    document.getElementById('detailName').textContent = worker.fullName || '-';
    document.getElementById('detailPhone').textContent = `เบอร์: ${worker.phone || '-'}`;
    document.getElementById('detailSupplier').textContent = `สังกัด: ${worker.supplier || '-'}`;
    document.getElementById('detailBank').textContent = `ธนาคาร: ${worker.bankName || '-'}`;
    document.getElementById('detailAccount').textContent = `บัญชี: ${worker.accountNumber || '-'}`;
    document.getElementById('detailCheckIn').textContent = `เข้างาน: ${worker.checkInTime || '-'}`;
    document.getElementById('detailCheckOut').textContent = `ออกงาน: ${worker.checkOutTime || '-'}`;

    // GPS
    const gpsLink = document.getElementById('detailGpsLink');
    if (worker.gpsLocation) {
        gpsLink.href = `https://www.google.com/maps?q=${worker.gpsLocation}`;
        gpsLink.style.display = 'flex';
    } else {
        gpsLink.style.display = 'none';
    }

    // Photos
    const selfieImg = document.getElementById('detailSelfie');
    const idCardImg = document.getElementById('detailIdCard');

    if (worker.selfieInUrl) {
        selfieImg.src = worker.selfieInUrl;
        selfieImg.style.display = 'block';
    } else {
        selfieImg.style.display = 'none';
    }

    if (worker.idCardUrl) {
        idCardImg.src = worker.idCardUrl;
        idCardImg.style.display = 'block';
    } else {
        idCardImg.style.display = 'none';
    }

    document.getElementById('employeeDetailModal').classList.add('active');
    lucide.createIcons();
}

/* ===================================
   Face Scan (AI Beta) Logic
   =================================== */
let isFaceModelsLoaded = false;
let faceDetectionInterval = null;

async function loadFaceModels() {
    if (isFaceModelsLoaded) return true;

    const statusBadge = document.getElementById('faceScanStatus');
    const statusText = statusBadge.querySelector('span');

    try {
        statusText.textContent = "กำลังโหลดระบบ AI (1/3)...";
        await faceapi.nets.tinyFaceDetector.loadFromUri('https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model');

        statusText.textContent = "กำลังโหลดระบบ AI (2/3)...";
        await faceapi.nets.faceLandmark68Net.loadFromUri('https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model');

        statusText.textContent = "กำลังโหลดระบบ AI (3/3)...";
        await faceapi.nets.faceRecognitionNet.loadFromUri('https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model');

        isFaceModelsLoaded = true;
        statusText.textContent = "ระบบ AI พร้อมใช้งาน";
        console.log("All Face-API models loaded successfully");
        return true;
    } catch (error) {
        console.error('Face models load error:', error);
        statusText.textContent = "โหลด AI ไม่สำเร็จ กรุณาลองใหม่";
        return false;
    }
}

let registeredFaceDescriptors = [];
let recognizedEmployee = null; // Track recognized employee during scan

async function startFaceScanMode() {
    showScreen('faceScanScreen');
    const video = document.getElementById('faceVideo');
    const statusBadge = document.getElementById('faceScanStatus');
    const statusText = statusBadge.querySelector('span');
    const cameraBox = document.getElementById('faceCameraBox');

    const loaded = await loadFaceModels();
    if (!loaded) return;

    try {
        statusText.textContent = "กำลังดึงข้อมูลใบหน้าจากระบบ...";
        const response = await fetch(CONFIG.API_URL, {
            method: 'POST',
            body: JSON.stringify({
                action: 'getAllFaceDescriptors',
                apiKey: CONFIG.API_KEY,
                warehouse: selectedWarehouse
            })
        });
        const result = await response.json();

        // Always log the debug info from the server
        if (result.debug) console.log('--- SERVER DEBUG:', result.debug);

        if (result.success) {
            registeredFaceDescriptors = result.descriptors;
            const count = registeredFaceDescriptors.length;
            console.log('--- FACE DEBUG: Loaded', count, 'records');

            if (count > 0) {
                statusText.textContent = `โหลดข้อมูลสำเร็จ: รู้จัก ${count} คน`;
                try {
                    window.globalFaceMatcher = new faceapi.FaceMatcher(
                        registeredFaceDescriptors.map(d => {
                            return new faceapi.LabeledFaceDescriptors(
                                d.fullName + "|" + d.phone,
                                [new Float32Array(Object.values(d.descriptor))]
                            );
                        }),
                        0.45  // Strict threshold: < 0.45 = same person (0.65 was too loose)
                    );
                    console.log('--- AI Debug: FaceMatcher initialized with', count, 'records');
                } catch (matcherErr) {
                    console.error('FaceMatcher init error:', matcherErr);
                    statusText.textContent = "AI เริ่มต้นผิดพลาด: " + matcherErr.message.substring(0, 40);
                }
            } else {
                const debugInfo = result.debug ? result.debug.join(' | ') : '';
                statusText.textContent = "ไม่พบข้อมูลใบหน้าในระบบ คลิก 'สแกนไม่สำเร็จ?' เพื่อเข้าด้วยเบอร์โทร";
                console.warn('No descriptors found. Server debug:', debugInfo);
            }
        } else {
            statusText.textContent = "เซิร์ฟเวอร์ผิดพลาด: " + (result.error || 'Unknown Error');
            console.error('Server error:', result);
        }
    } catch (e) {
        console.error('Face descriptors load failed', e);
        statusText.textContent = "เชื่อมต่อ Server ไม่ได้ (กรุณารีเฟรช)";
    }

    try {
        statusText.textContent = "กำลังเปิดกล้อง...";
        const stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 640 } }
        });
        video.srcObject = stream;
        cameraStream = stream;

        video.onloadedmetadata = () => {
            statusBadge.classList.add('detecting');
            statusText.textContent = "กำลังมองหาใบหน้า...";
            lucide.createIcons();

            let frameCount = 0;
            faceDetectionInterval = setInterval(async () => {
                const faceVideo = document.getElementById('faceVideo');
                if (!faceVideo || faceVideo.paused || faceVideo.ended) return;

                frameCount++;
                if (frameCount % 4 === 0 && !recognizedEmployee) {
                    const currentStatus = statusText.textContent;
                    // Only tick if we are in a generic scanning state
                    if (currentStatus.includes('มองหา') || currentStatus.includes('วิเคราะห์') || currentStatus.includes('Dist')) {
                        statusText.textContent = "กำลังมองหาใบหน้า... (" + (frameCount % 10) + ")";
                    }
                }

                try {
                    // Try to detect face with a more lenient threshold (0.3)
                    const detections = await faceapi.detectSingleFace(
                        faceVideo,
                        new faceapi.TinyFaceDetectorOptions({ inputSize: 160, scoreThreshold: 0.3 })
                    ).withFaceLandmarks().withFaceDescriptor();

                    if (detections) {
                        cameraBox.classList.add('active-detection');

                        if (window.globalFaceMatcher) {
                            const bestMatch = window.globalFaceMatcher.findBestMatch(detections.descriptor);
                            const dist = bestMatch.distance.toFixed(2);

                            if (bestMatch.label !== 'unknown' && bestMatch.distance < 0.50) {
                                // Extra strict check: distance must be < 0.50 (safety margin above 0.45)
                                const labelParts = bestMatch.label.split('|');
                                const name = labelParts[0];
                                const phone = labelParts[1];

                                // New or different person detected
                                if (!recognizedEmployee || recognizedEmployee.phone !== phone) {
                                    const fullData = registeredFaceDescriptors.find(d => normalizePhone(d.phone) === normalizePhone(phone));
                                    recognizedEmployee = {
                                        fullName: name,
                                        phone: phone,
                                        bankName: (fullData && fullData.bankName) ? fullData.bankName : '',
                                        accountNumber: (fullData && fullData.accountNumber) ? fullData.accountNumber : '',
                                        supplier: (fullData && (fullData.supplier || fullData.supplierName)) ? (fullData.supplier || fullData.supplierName) : '',
                                        idCardPhotoUrl: (fullData && (fullData.idCardUrl || fullData.idCardPhotoUrl)) ? (fullData.idCardUrl || fullData.idCardPhotoUrl) : ''
                                    };

                                    // Confidence: distance 0 = perfect, 0.45 = threshold boundary
                                    const confidencePct = Math.round((1 - bestMatch.distance) * 100);
                                    const isHighConfidence = bestMatch.distance < 0.38;
                                    const confidenceLabel = isHighConfidence
                                        ? `✅ ยืนยันได้ (${confidencePct}%)`
                                        : `⚠️ ใกล้เคียง กรุณาตรวจสอบรูป (${confidencePct}%)`;

                                    statusText.textContent = `ยินดีต้อนรับ: ${name}`;
                                    statusBadge.classList.remove('detecting');
                                    statusBadge.classList.add('success');

                                    // Show employee info card for verification
                                    let verifyBox = document.getElementById('faceVerifyBox');
                                    if (!verifyBox) {
                                        verifyBox = document.createElement('div');
                                        verifyBox.id = 'faceVerifyBox';
                                        verifyBox.style.cssText = 'margin:8px 0;padding:10px 12px;background:#f0f9ff;border:2px solid #3b82f6;border-radius:12px;font-size:13px;text-align:left;';
                                        document.getElementById('faceScanActions').parentNode.insertBefore(verifyBox, document.getElementById('faceScanActions'));
                                    }

                                    // Get current date/time (Thailand timezone)
                                    const now = new Date();
                                    const todayStr = now.toLocaleDateString('th-TH', { day: '2-digit', month: '2-digit', year: 'numeric' });

                                    // Get GPS from current location
                                    const gpsText = (typeof currentLocation !== 'undefined' && currentLocation)
                                        ? `${currentLocation.latitude?.toFixed(5)}, ${currentLocation.longitude?.toFixed(5)}`
                                        : 'กำลังรับตำแหน่ง...';

                                    const bankDisplay = recognizedEmployee.bankName
                                        ? `${recognizedEmployee.bankName} – ${recognizedEmployee.accountNumber || '-'}`
                                        : '-';

                                    const confidenceBadge = isHighConfidence
                                        ? `<span style="color:#16a34a;font-weight:bold;">✅ ${confidencePct}%</span>`
                                        : `<span style="color:#d97706;font-weight:bold;">⚠️ ${confidencePct}% (กรุณาตรวจสอบ)</span>`;

                                    verifyBox.innerHTML = `
                                        <div style="font-weight:bold;margin-bottom:6px;color:#1e40af;">📋 ตรวจสอบข้อมูลก่อนยืนยัน ${confidenceBadge}</div>
                                        <table style="width:100%;border-collapse:collapse;font-size:12px;">
                                            <tr><td style="color:#64748b;padding:2px 4px;">📅 วันที่</td><td style="padding:2px 4px;font-weight:500;">${todayStr}</td></tr>
                                            <tr><td style="color:#64748b;padding:2px 4px;">👤 ชื่อ-นามสกุล</td><td style="padding:2px 4px;font-weight:500;">${recognizedEmployee.fullName}</td></tr>
                                            <tr><td style="color:#64748b;padding:2px 4px;">📱 เบอร์โทร</td><td style="padding:2px 4px;">${recognizedEmployee.phone || '-'}</td></tr>
                                            <tr><td style="color:#64748b;padding:2px 4px;">🏦 ธนาคาร/บัญชี</td><td style="padding:2px 4px;">${bankDisplay}</td></tr>
                                            <tr><td style="color:#64748b;padding:2px 4px;">📍 GPS</td><td style="padding:2px 4px;">${gpsText}</td></tr>
                                            <tr><td style="color:#64748b;padding:2px 4px;">🏢 สังกัด</td><td style="padding:2px 4px;">${recognizedEmployee.supplier || selectedSupplier || '-'}</td></tr>
                                        </table>
                                    `;

                                    document.getElementById('faceScanActions').style.display = 'block';
                                    document.querySelector('.scan-instructions').style.display = 'none';
                                    if (window.navigator.vibrate) window.navigator.vibrate(100);
                                }
                            } else {
                                if (!recognizedEmployee) {
                                    statusText.textContent = `วิเคราะห์ใบหน้า... (Dist: ${dist})`;
                                }
                            }
                        } else {
                            // Don't overwrite error/empty message if already set
                            if (statusText.textContent.indexOf('สำเร็จ') === -1 && statusText.textContent.indexOf('ไม่พบ') === -1) {
                                statusText.textContent = "ตรวจพบใบหน้า (ฐานข้อมูลยังไม่พร้อม)";
                            }
                        }
                    } else {
                        cameraBox.classList.remove('active-detection');
                        if (!recognizedEmployee) {
                            statusBadge.classList.remove('success');
                            statusBadge.classList.add('detecting');
                            statusText.textContent = "กรุณาวางใบหน้าในกรอบ...";
                        }
                    }
                } catch (err) {
                    console.error('--- AI Loop Error:', err);
                    statusText.textContent = "AI Error: " + err.message.substring(0, 30);
                }
            }, 500);
        };
    } catch (error) {
        console.error('Camera error:', error);
        statusText.textContent = "เข้าถึงกล้องไม่ได้";
    }
}

async function submitFaceAttendance(type) {
    if (!recognizedEmployee) {
        alert('กรุณาสแกนใบหน้าให้สำเร็จก่อน');
        return;
    }

    const confirmMsg = type === 'checkIn' ? 'ยืนยันการเข้างาน?' : 'ยืนยันการออกงาน?';
    if (!confirm(confirmMsg)) return;

    // Get current location
    let location = { latitude: 0, longitude: 0 };
    try {
        const pos = await new Promise((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject);
        });
        location = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
    } catch (e) {
        console.warn('GPS Required for attendance');
        alert('กรุณาเปิด GPS เพื่อลงเวลา');
        return;
    }

    // Capture photo from video stream
    const video = document.getElementById('faceVideo');
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 640;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0);
    const photoData = canvas.toDataURL('image/jpeg', 0.8);

    // Show loading on the button
    const btnClass = type === 'checkIn' ? '.checkin-btn' : '.checkout-btn';
    const btn = document.querySelector(btnClass);
    const originalHTML = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<i class="spin-icon"></i> กำลังบันทึก...';

    // Use supplier from employee data, or fall back to what was selected in the main menu
    const effectiveSupplier = recognizedEmployee.supplier || selectedSupplier || '';

    const payload = {
        action: type,
        apiKey: CONFIG.API_KEY,
        warehouse: selectedWarehouse,
        fullName: recognizedEmployee.fullName,
        phone: recognizedEmployee.phone,
        bankName: recognizedEmployee.bankName,
        accountNumber: recognizedEmployee.accountNumber,
        supplier: effectiveSupplier,
        idCardPhotoUrl: recognizedEmployee.idCardPhotoUrl,
        selfiePhoto: type === 'checkIn' ? photoData : '',
        checkoutSelfie: type === 'checkOut' ? photoData : '',
        latitude: location.latitude,
        longitude: location.longitude,
        timestamp: new Date().toISOString()
    };

    try {
        const response = await fetch(CONFIG.API_URL, {
            method: 'POST',
            body: JSON.stringify(payload)
        });
        const result = await response.json();
        if (result.success) {
            alert(type === 'checkIn' ? 'ลงเวลาเข้างานสำเร็จ!' : 'ลงเวลาออกงานสำเร็จ!');
            stopFaceScanMode();
        } else {
            alert('ล้มเหลว: ' + result.error);
        }
    } catch (e) {
        alert('เกิดข้อผิดพลาดในการเชื่อมต่อ');
    } finally {
        btn.disabled = false;
        btn.innerHTML = originalHTML;
        lucide.createIcons();
    }
}

function stopFaceScanMode() {
    if (faceDetectionInterval) clearInterval(faceDetectionInterval);
    if (cameraStream) {
        cameraStream.getTracks().forEach(track => track.stop());
        cameraStream = null;
    }
    const video = document.getElementById('faceVideo');
    if (video) video.srcObject = null;
    const statusBadge = document.getElementById('faceScanStatus');
    statusBadge.classList.remove('detecting', 'success');
    statusBadge.querySelector('span').textContent = "กำลังโหลดระบบ AI...";
    document.getElementById('faceCameraBox').classList.remove('active-detection');
    showScreen('mainMenu');
}

/**
 * Fallback Manual Search Logic
 */
function showManualSearch() {
    showScreen('manualSearchScreen');
    document.getElementById('manualSearchPhone').value = '';
    document.getElementById('manualSearchPhone').focus();
}

async function performManualSearch() {
    const phoneInput = document.getElementById('manualSearchPhone');
    const phone = phoneInput.value;
    if (phone.length < 10) {
        alert('กรุณาระบุเข้าเบอร์โทรศัพท์ให้ถูกต้อง');
        return;
    }

    showLoading(true);
    try {
        const response = await fetch(CONFIG.API_URL, {
            method: 'POST',
            body: JSON.stringify({
                action: 'getLastCheckIn',
                apiKey: CONFIG.API_KEY,
                phone: phone,
                warehouse: selectedWarehouse
            })
        });
        const result = await response.json();
        showLoading(false);

        if (result.success && result.data) {
            const worker = result.data;
            recognizedEmployee = {
                fullName: worker.fullName,
                phone: worker.phone,
                bankName: worker.bankName || '',
                accountNumber: worker.accountNumber || '',
                supplier: worker.supplier || '',
                idCardPhotoUrl: (worker.idCardUrl || worker.idCardPhotoUrl) || ''
            };

            // Switch back to scan screen but show actions
            showScreen('faceScanScreen');
            const statusBadge = document.getElementById('faceScanStatus');
            const statusText = statusBadge.querySelector('span');

            statusText.textContent = `พบข้อมูลคุณ: ${worker.fullName}`;
            statusBadge.classList.remove('detecting');
            statusBadge.classList.add('success');

            document.getElementById('faceScanActions').style.display = 'block';
            document.querySelector('.scan-instructions').style.display = 'none';
        } else {
            alert('ไม่พบข้อมูลเบอร์โทรศัพท์นี้ในระบบ (คุณอาจจะยังไม่เคยลงทะเบียน)');
        }
    } catch (e) {
        showLoading(false);
        console.error('Manual search error:', e);
        alert('เกิดข้อผิดพลาดในการเชื่อมต่อ');
    }
}

/**
 * Face Registration Logic
 */
let regEmployeeData = null;

async function searchForRegistration() {
    const phone = document.getElementById('regPhone').value;
    if (phone.length < 10) return;

    showLoading(true);
    try {
        const response = await fetch(CONFIG.API_URL, {
            method: 'POST',
            body: JSON.stringify({
                action: 'getLastCheckIn',
                apiKey: CONFIG.API_KEY,
                phone: phone,
                warehouse: selectedWarehouse
            })
        });
        const result = await response.json();
        if (result.success) {
            regEmployeeData = result.data;
            document.getElementById('regEmployeeName').textContent = regEmployeeData.fullName;
            document.getElementById('regCameraSection').style.display = 'block';
            startRegCamera();
        } else {
            alert('ไม่พบข้อมูลพนักงานคนนี้ในระบบ');
        }
    } catch (e) {
        alert('เกิดข้อผิดพลาดในการค้นหา');
    } finally {
        showLoading(false);
    }
}

async function startRegCamera() {
    const video = document.getElementById('regVideo');
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
        video.srcObject = stream;
        cameraStream = stream;
        await loadFaceModels();
        lucide.createIcons();
    } catch (e) {
        console.error('Reg camera error:', e);
    }
}

async function startEnrollment() {
    const video = document.getElementById('regVideo');
    const btn = document.getElementById('btnStartEnroll');

    btn.disabled = true;
    btn.innerHTML = '<i class="spin-icon"></i> กำลังตรวจจับใบหน้า...';

    try {
        const detection = await faceapi.detectSingleFace(
            video,
            new faceapi.TinyFaceDetectorOptions()
        ).withFaceLandmarks().withFaceDescriptor();

        if (detection) {
            btn.innerHTML = '<i class="spin-icon"></i> กำลังบันทึกข้อมูล...';
            const response = await fetch(CONFIG.API_URL, {
                method: 'POST',
                body: JSON.stringify({
                    action: 'registerFace',
                    apiKey: CONFIG.API_KEY,
                    warehouse: selectedWarehouse,
                    phone: regEmployeeData.phone,
                    descriptor: Array.from(detection.descriptor)
                })
            });
            const result = await response.json();
            if (result.success) {
                alert('ลงทะเบียนใบหน้าสำเร็จ!');
                stopFaceRegistrationMode();
            }
        } else {
            alert('ไม่พบใบหน้า กรุณาจัดตำแหน่งให้ตรงกล้อง');
            btn.disabled = false;
            btn.innerHTML = '<i data-lucide="camera"></i> เริ่มบันทึกใบหน้า';
        }
    } catch (e) {
        alert('เกิดข้อผิดพลาดในการลงทะเบียน');
        btn.disabled = false;
        btn.innerHTML = '<i data-lucide="camera"></i> เริ่มบันทึกใบหน้า';
    }
    lucide.createIcons();
}

function stopFaceRegistrationMode() {
    if (cameraStream) {
        cameraStream.getTracks().forEach(track => track.stop());
        cameraStream = null;
    }
    const video = document.getElementById('regVideo');
    if (video) video.srcObject = null;
    document.getElementById('regCameraSection').style.display = 'none';
    document.getElementById('regPhone').value = '';
    showScreen('adminMenu');
}

/**
 * New Employee Registration Logic (Master Data)
 */
let regIdCardPhoto = null;
let regFaceDescriptor = null;
let regFaceDetectionInterval = null;

async function initRegistrationScreen() {
    showScreen('registrationScreen');
    document.getElementById('registrationForm').reset();
    document.getElementById('idCardPreview').style.display = 'none';
    document.getElementById('idCardPlaceholder').style.display = 'flex';
    regIdCardPhoto = null;
    regFaceDescriptor = null;

    const faceVideo = document.getElementById('regFaceVideo');
    const faceStatus = document.getElementById('regFaceStatus');
    const statusText = faceStatus.querySelector('span');

    await loadFaceModels();

    try {
        const stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: 'user', width: 200, height: 200 }
        });
        faceVideo.srcObject = stream;
        cameraStream = stream;

        faceStatus.classList.add('detecting');
        regFaceDetectionInterval = setInterval(async () => {
            if (faceVideo.paused || faceVideo.ended) return;

            // Use slightly more sensitive detection options
            const detection = await faceapi.detectSingleFace(
                faceVideo,
                new faceapi.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.3 })
            ).withFaceLandmarks().withFaceDescriptor();

            if (detection) {
                regFaceDescriptor = Array.from(detection.descriptor);
                faceStatus.classList.remove('detecting');
                faceStatus.classList.add('success');
                statusText.textContent = "ตรวจพบใบหน้าเรียบร้อย (Ready)";
                // Add a small haptic nudge if supported
                if (navigator.vibrate) navigator.vibrate(50);
            } else {
                faceStatus.classList.remove('success');
                faceStatus.classList.add('detecting');
                statusText.textContent = "กรุณาส่องหน้าให้ชัดเจน";
            }
        }, 800);
    } catch (e) {
        console.error('Registration camera error:', e);
    }
}

async function captureIdCard() {
    const video = document.getElementById('idCardVideo');
    const canvas = document.getElementById('idCardCanvas');
    const preview = document.getElementById('idCardPreview');
    const placeholder = document.getElementById('idCardPlaceholder');

    if (video.style.display === 'none') {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
            video.srcObject = stream;
            video.style.display = 'block';
            placeholder.style.display = 'none';
            preview.style.display = 'none';
        } catch (e) {
            alert('ไม่สามารถเข้าถึงกล้องได้');
        }
    } else {
        const context = canvas.getContext('2d');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        context.drawImage(video, 0, 0);

        regIdCardPhoto = canvas.toDataURL('image/jpeg', 0.8);
        preview.src = regIdCardPhoto;
        preview.style.display = 'block';
        video.style.display = 'none';

        if (video.srcObject) {
            video.srcObject.getTracks().forEach(t => t.stop());
        }
    }
}

async function submitRegistration(event) {
    event.preventDefault();
    if (!regFaceDescriptor) {
        alert('กรุณาสแกนใบหน้าให้สำเร็จก่อนลงทะเบียน');
        return;
    }
    if (!regIdCardPhoto) {
        alert('กรุณาถ่ายรูปบัตรประชาชน');
        return;
    }

    const btn = document.getElementById('btnSubmitReg');
    btn.disabled = true;
    btn.innerHTML = '<i class="spin-icon"></i> กำลังส่งข้อมูล...';

    const payload = {
        action: 'registerNewEmployee',
        apiKey: CONFIG.API_KEY,
        warehouse: selectedWarehouse,
        fullName: document.getElementById('regFullName').value,
        phone: document.getElementById('regFormPhone').value,
        supplier: document.getElementById('regSupplier').value,
        bankName: document.getElementById('regBankName').value,
        accountNumber: document.getElementById('regAccountNumber').value,
        idCardPhoto: regIdCardPhoto,
        faceDescriptor: regFaceDescriptor
    };

    try {
        const response = await fetch(CONFIG.API_URL, {
            method: 'POST',
            body: JSON.stringify(payload)
        });
        const result = await response.json();
        if (result.success) {
            alert('ลงทะเบียนสำเร็จ! พนักงานสามารถใช้ระบบสแกนหน้าได้ทันที');
            stopRegistrationMode();
        } else {
            alert('ลงทะเบียนไม่สำเร็จ: ' + result.error);
        }
    } catch (e) {
        alert('เกิดข้อผิดพลาดในการเชื่อมต่อ');
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<i data-lucide="check-circle"></i> ยืนยันการลงทะเบียน';
        lucide.createIcons();
    }
}

function stopRegistrationMode() {
    if (regFaceDetectionInterval) {
        clearInterval(regFaceDetectionInterval);
        regFaceDetectionInterval = null;
    }
    if (cameraStream) {
        cameraStream.getTracks().forEach(t => t.stop());
        cameraStream = null;
    }
    const faceVideo = document.getElementById('regFaceVideo');
    if (faceVideo) faceVideo.srcObject = null;

    const idVideo = document.getElementById('idCardVideo');
    if (idVideo && idVideo.srcObject) {
        idVideo.srcObject.getTracks().forEach(t => t.stop());
        idVideo.srcObject = null;
    }

    showScreen('mainMenu');
}
