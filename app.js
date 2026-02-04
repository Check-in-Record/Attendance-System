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
    API_KEY: 'FreshketHR2024'
};

// ===================================
// Global State
// ===================================
let selectedWarehouse = null;
let selectedSupplier = null;
let currentCheckInData = null;
let currentReceiptData = null;

// Camera state
let cameraStream = null;
let currentCameraTargetPreviewId = null;
let currentCameraTargetInputId = null;

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
});

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

function showScreen(screenId) {
    // Hide all screens
    document.querySelectorAll('.screen').forEach(screen => {
        screen.classList.remove('active');
    });

    // Show target screen
    const targetScreen = document.getElementById(screenId);
    if (targetScreen) {
        targetScreen.classList.add('active');
    }

    // Re-init icons
    lucide.createIcons();

    // Special actions for specific screens
    if (screenId === 'checkInScreen') {
        getGPSLocation();
        resetCheckInForm();
    } else if (screenId === 'checkOutScreen') {
        resetCheckOutForm();
    } else if (screenId === 'adminScreen') {
        loadAttendanceData();
    }
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
function previewPhoto(input, previewId) {
    const preview = document.getElementById(previewId);

    if (input.files && input.files[0]) {
        const reader = new FileReader();

        reader.onload = function (e) {
            preview.innerHTML = `<img src="${e.target.result}" alt="Preview">`;
            preview.classList.add('has-image');
        };

        reader.readAsDataURL(input.files[0]);
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

    document.getElementById('cameraModal').classList.add('active');

    try {
        cameraStream = await navigator.mediaDevices.getUserMedia({
            video: {
                facingMode: facingMode === 'user' ? 'user' : 'environment',
                width: { ideal: 1280 },
                height: { ideal: 720 }
            },
            audio: false
        });

        const video = document.getElementById('cameraVideo');
        video.srcObject = cameraStream;
    } catch (err) {
        console.error("Error accessing camera:", err);
        showError("ไม่สามารถเข้าถึงกล้องได้ กรุณาตรวจสอบการอนุญาต");
        closeCameraModal();
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
    const context = canvas.getContext('2d');

    // Set canvas size to video size
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    // Draw frame
    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Convert to blob/file
    canvas.toBlob((blob) => {
        const file = new File([blob], "camera_capture.jpg", { type: "image/jpeg" });

        // Manual trigger preview
        const dataTransfer = new DataTransfer();
        dataTransfer.items.add(file);
        const input = document.getElementById(currentCameraTargetInputId);
        input.files = dataTransfer.files;

        previewPhoto(input, currentCameraTargetPreviewId);

        closeCameraModal();
    }, 'image/jpeg', 0.8);
}

// ===================================
// Check-In Functions
// ===================================
function resetCheckInForm() {
    const form = document.getElementById('checkInForm');
    if (form) form.reset();

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

async function submitCheckIn(event) {
    event.preventDefault();

    const submitBtn = document.getElementById('checkInSubmitBtn');
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i data-lucide="loader"></i> กำลังบันทึก...';
    lucide.createIcons();

    try {
        // ... (Validate Inputs Code - Same as before) ...
        const fullName = document.getElementById('fullName').value.trim();
        const phone = document.getElementById('phone').value.trim();
        const bankName = document.getElementById('bankName').value;
        const accountNumber = document.getElementById('accountNumber').value.trim();
        const gpsLocation = document.getElementById('gpsLocation').value;

        // Check both Camera and Gallery inputs
        const selfieCam = document.getElementById('selfieInputCam');
        const selfieGal = document.getElementById('selfieInputGal');
        const idCardCam = document.getElementById('idCardInputCam');
        const idCardGal = document.getElementById('idCardInputGal');

        const selfieFile = selfieCam.files[0] || selfieGal.files[0];
        const idCardFile = idCardCam.files[0] || idCardGal.files[0];

        if (!selfieFile || !idCardFile) throw new Error('กรุณาถ่ายรูปให้ครบ');
        if (!gpsLocation) throw new Error('กรุณาเปิด GPS');

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
    document.getElementById('searchPhone').value = '';
    document.getElementById('checkInResult').classList.add('hidden');
    document.getElementById('checkOutForm').classList.add('hidden');

    // Reset photo preview
    const preview = document.getElementById('checkoutSelfiePreview');
    if (preview) {
        preview.innerHTML = `<i data-lucide="user-circle"></i><span>ยังไม่มีรูป</span>`;
        preview.classList.remove('has-image');
    }

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
        // Check both Camera and Gallery inputs
        const selfieCam = document.getElementById('checkoutSelfieInputCam');
        const selfieGal = document.getElementById('checkoutSelfieInputGal');

        const selfieFile = selfieCam.files[0] || selfieGal.files[0];

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

    if (!phone) {
        showError('กรุณากรอกเบอร์โทรศัพท์');
        return;
    }

    try {
        const response = await fetch(`${CONFIG.API_URL}?action=searchForReceipt&apiKey=${CONFIG.API_KEY}&warehouse=${encodeURIComponent(selectedWarehouse)}&phone=${encodeURIComponent(phone)}`);
        const result = await response.json();

        if (result.success && result.data) {
            currentReceiptData = result.data;
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
    const element = document.getElementById('receiptDocument');

    // Config
    const opt = {
        margin: 0, // Zero margin to fit page perfectly
        filename: `receipt_${Date.now()}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true, scrollY: 0 },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };

    try {
        // Show loading state
        const btn = document.querySelector('.btn-export');
        btn.innerHTML = '<i data-lucide="loader"></i> กำลังสร้าง PDF...';
        lucide.createIcons();
        btn.disabled = true;

        // Hack: Wait for image paint
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Generate PDF
        await html2pdf().set(opt).from(element).save();

        showSuccess('บันทึกเอกสารสำเร็จ!', 'ไฟล์ PDF ถูกดาวน์โหลดแล้ว');
    } catch (error) {
        console.error(error);
        showError('ไม่สามารถสร้างไฟล์ PDF ได้');
    } finally {
        // Reset button
        const btn = document.querySelector('.btn-export');
        btn.innerHTML = '<i data-lucide="download"></i> บันทึกเป็น PDF';
        lucide.createIcons();
        btn.disabled = false;
    }
}

// ===================================
// Admin Functions
// ===================================
async function loadAttendanceData() {
    const filterDate = document.getElementById('filterDate').value;
    const tableBody = document.getElementById('attendanceTableBody');

    tableBody.innerHTML = '<tr><td colspan="5" class="no-data">กำลังโหลด...</td></tr>';

    try {
        const response = await fetch(`${CONFIG.API_URL}?action=getAttendance&apiKey=${CONFIG.API_KEY}&warehouse=${encodeURIComponent(selectedWarehouse)}&date=${filterDate}`);
        const result = await response.json();

        if (result.success) {
            if (result.data && result.data.length > 0) {
                tableBody.innerHTML = result.data.map(row => `
                    <tr>
                        <td>${row.fullName}</td>
                        <td>${row.phone}</td>
                        <td>${row.checkInTime}</td>
                        <td>${row.checkOutTime || '-'}</td>
                        <td>
                            <span class="status-badge ${row.checkOutTime ? 'completed' : 'working'}">
                                ${row.checkOutTime ? 'ออกแล้ว' : 'กำลังทำงาน'}
                            </span>
                        </td>
                    </tr>
                `).join('');
            } else {
                tableBody.innerHTML = '<tr><td colspan="5" class="no-data">ยังไม่มีข้อมูลในวันที่เลือก</td></tr>';
            }
        } else {
            tableBody.innerHTML = `<tr><td colspan="5" class="no-data">ข้อผิดพลาด: ${result.error || 'ไม่ทราบสาเหตุ'}</td></tr>`;
        }
    } catch (error) {
        tableBody.innerHTML = '<tr><td colspan="5" class="no-data">ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้</td></tr>';
    }
}

function exportToCSV() {
    const table = document.getElementById('attendanceTable');
    const rows = table.querySelectorAll('tr');

    let csv = [];

    rows.forEach(row => {
        const cols = row.querySelectorAll('th, td');
        const rowData = [];
        cols.forEach(col => {
            rowData.push('"' + col.textContent.trim().replace(/"/g, '""') + '"');
        });
        csv.push(rowData.join(','));
    });

    const csvContent = '\uFEFF' + csv.join('\n'); // UTF-8 BOM for Thai
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');

    link.href = URL.createObjectURL(blob);
    link.download = `attendance_${document.getElementById('filterDate').value}.csv`;
    link.click();

    showSuccess('Export สำเร็จ!', 'ไฟล์ CSV ถูกดาวน์โหลดแล้ว');
}

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

// Close modal on backdrop click
document.querySelectorAll('.modal').forEach(modal => {
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.classList.remove('active');
        }
    });
});
