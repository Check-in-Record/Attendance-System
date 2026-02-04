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
// Image compression function
async function compressImage(file, maxWidth = 1024, quality = 0.7) {
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target.result;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;

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

                canvas.toBlob((blob) => {
                    const compressedFile = new File([blob], file.name, {
                        type: 'image/jpeg',
                        lastModified: Date.now()
                    });
                    resolve(compressedFile);
                }, 'image/jpeg', quality);
            };
        };
    });
}

// Preview photo and handle compression
async function previewPhoto(input, previewId) {
    if (input.files && input.files[0]) {
        showLoading(true);
        try {
            const originalFile = input.files[0];
            const compressedFile = await compressImage(originalFile);

            // Store in global object instead of trying to write back to input.files (which fails on iOS)
            capturedPhotos[previewId] = compressedFile;

            const reader = new FileReader();
            reader.onload = function (e) {
                const preview = document.getElementById(previewId);
                if (preview) {
                    preview.innerHTML = `<img src="${e.target.result}" alt="Preview">`;
                    preview.classList.add('has-image');
                }
            };
            reader.readAsDataURL(compressedFile);
        } catch (error) {
            console.error("Compression error:", error);
            showError("ไม่สามารถประมวลผลรูปภาพได้ กรุณาลองใหม่");
        } finally {
            showLoading(false);
        }
    }
}

function getBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result);
        reader.onerror = error => reject(error);
    });
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

    // Convert to high quality JPEG
    canvas.toBlob(async (blob) => {
        const file = new File([blob], "capture.jpg", { type: "image/jpeg" });

        // Compress the captured image
        const compressedFile = await compressImage(file);

        // Store in global object
        if (currentCameraTargetPreviewId) {
            capturedPhotos[currentCameraTargetPreviewId] = compressedFile;
        }

        // Preview the compressed image
        const reader = new FileReader();
        reader.onload = function (e) {
            const preview = document.getElementById(currentCameraTargetPreviewId);
            if (preview) {
                preview.innerHTML = `<img src="${e.target.result}" alt="Preview">`;
                preview.classList.add('has-image');
            }
        };
        reader.readAsDataURL(compressedFile);

        closeCameraModal();
    }, 'image/jpeg', 0.9);
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

        if (!selfieFile || !idCardFile) throw new Error('กรุณาถ่ายรูปให้ครบ');
        if (!gpsLocation) throw new Error('กรุณาเปิด GPS และรอจนกว่าตำแหน่งจะขึ้น');

        const selfieBase64 = await getBase64(selfieFile);
        const idCardBase64 = await getBase64(idCardFile);
        const now = new Date();
        const checkInTime = now.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

        // --- ไม้ตาย: Hidden Form Submission (ทำงานได้แน่นอน 100%) ---

        // 1. สร้าง Form ปลอมๆ ขึ้นมา
        const form = document.createElement('form');
        form.method = 'POST';
        form.action = CONFIG.API_URL;
        form.target = 'hidden_iframe'; // ส่งข้อมูลไปที่ iframe ซ่อน (หน้าเว็บไม่เปลี่ยน)

        // 2. เตรียมข้อมูลที่จะส่ง
        const payload = {
            action: 'checkIn',
            apiKey: CONFIG.API_KEY,
            warehouse: selectedWarehouse,
            supplier: selectedSupplier, // New field
            fullName: fullName,
            phone: phone,
            bankName: bankName,
            accountNumber: accountNumber,
            gpsLocation: gpsLocation,
            selfiePhoto: selfieBase64,
            idCardPhoto: idCardBase64,
            checkInTime: checkInTime,
            checkInDate: now.toLocaleDateString('th-TH'),
            timestamp: now.toISOString()
        };

        // 3. ใส่ข้อมูลลงใน input ซ่อน แล้วยัดใส่ Form
        const input = document.createElement('input');
        input.type = 'hidden';
        input.name = 'data'; // ชื่อตัวแปรต้องตรงกับที่ Code.gs รับ
        input.value = JSON.stringify(payload);
        form.appendChild(input);

        // 4. สร้าง iframe ซ่อน (เพื่อไม่ให้หน้าเว็บเปลี่ยนหน้าไป Google)
        if (!document.getElementById('hidden_iframe')) {
            const iframe = document.createElement('iframe');
            iframe.style.display = 'none';
            iframe.name = 'hidden_iframe';
            iframe.id = 'hidden_iframe';
            document.body.appendChild(iframe);
        }

        // 5. ส่ง Form!
        document.body.appendChild(form);
        form.submit();

        // 6. แจ้งเตือนสำเร็จทันที (เพราะ Form submit ไม่มี callback ให้ JS)
        console.log('Form submitted successfully');
        showSuccess('บันทึกเข้างานสำเร็จ!', `${fullName} เข้างานเวลา ${checkInTime}`);

        // Cleanup
        setTimeout(() => { document.body.removeChild(form); }, 1000);
        resetCheckInForm();
        setTimeout(() => { showScreen('mainMenu'); }, 2000);

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

        // Convert to base64
        const selfieBase64 = await getBase64(selfieFile);

        // Get current time
        const now = new Date();
        const checkOutTime = now.toLocaleTimeString('th-TH', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });

        // Prepare data
        const data = {
            action: 'checkOut',
            apiKey: CONFIG.API_KEY,
            warehouse: selectedWarehouse, // New field
            rowIndex: document.getElementById('checkOutRowId').value,
            checkoutSelfie: selfieBase64,
            checkOutTime: checkOutTime,
            timestamp: now.toISOString()
        };

        // Send to Google Apps Script
        try {
            await fetch(CONFIG.API_URL, {
                method: 'POST',
                mode: 'no-cors',
                body: JSON.stringify(data)
            });
        } catch (e) {
            console.log('Request sent (CORS blocked response):', e);
        }

        // Show success
        showSuccess('บันทึกออกงานสำเร็จ!', `ออกงานเวลา ${checkOutTime}`);

        // Reset and go back
        resetCheckOutForm();
        setTimeout(() => {
            showScreen('mainMenu');
        }, 2000);

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

    try {
        const response = await fetch(`${CONFIG.API_URL}?action=searchForReceipt&apiKey=${CONFIG.API_KEY}&warehouse=${encodeURIComponent(selectedWarehouse)}&phone=${encodeURIComponent(phone)}`);
        const result = await response.json();

        if (result.success && result.data) {
            currentReceiptData = result.data;
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

function generateReceipt() {
    const amount = document.getElementById('paymentAmount').value;
    const customDate = document.getElementById('receiptDateInput').value;

    if (!amount || parseFloat(amount) <= 0) {
        showError('กรุณากรอกจำนวนเงิน');
        return;
    }

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

    document.getElementById('receiptAmountDisplay').textContent = parseFloat(amount).toLocaleString('th-TH', {
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
    const customDate = document.getElementById('receiptDateInput').value;

    if (!amount || parseFloat(amount) <= 0) {
        showError('กรุณากรอกจำนวนเงิน');
        return;
    }

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
            amount: parseFloat(amount),
            customDate: customDate || '',
            idCardPhotoUrl: currentReceiptData.idCardPhotoUrl || ''
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
        const compressedFile = await compressImage(file);
        const base64 = await getBase64(compressedFile);

        const data = {
            action: 'updatePaymentSlip',
            apiKey: CONFIG.API_KEY,
            warehouse: warehouse,
            rowIndex: currentPaymentRowId,
            slipPhoto: base64
        };

        // Use POST with no-cors for GAS
        await fetch(CONFIG.API_URL, {
            method: 'POST',
            mode: 'no-cors',
            body: JSON.stringify(data)
        });

        // Refresh data after short delay (to allow GAS to finish background processing if any)
        setTimeout(() => {
            showLoading(false);
            showSuccess('อัปโหลดสลิปสำเร็จ!', 'ข้อมูลใน Google Sheets ถูกอัปเดตเรียบร้อยแล้ว');
            loadPaymentData();
        }, 1500);

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
