// Khởi tạo tham chiếu Firebase Database
const database = firebase.database();
const devicesRef = database.ref('devices');

// Trạng thái các thiết bị
let deviceStates = {
    light: { isOn: false, brightness: 0 },
    fan: { power: false, speed: 1 },
    ac: { power: false, nhietdo: 25 }
};

// Các phần tử DOM
const lightToggle = document.getElementById('light-toggle');
const lightBrightness = document.getElementById('light-brightness');
const sliderValue = document.querySelector('.slider-value');
const fanToggle = document.getElementById('fan-toggle');
const speedButtons = document.querySelectorAll('.speed-btn');
const acToggle = document.getElementById('ac-toggle');
const tempUp = document.getElementById('temp-up');
const tempDown = document.getElementById('temp-down');
const tempValue = document.querySelector('.temp-value');
const allOnButton = document.getElementById('all-on');
const allOffButton = document.getElementById('all-off');
const fanIcon = document.getElementById('fan-icon');

const fanSpeeds = { 1: '3s', 2: '1.5s', 3: '0.75s' };

// Khởi tạo trạng thái từ Firebase
devicesRef.on('value', (snapshot) => {
    const data = snapshot.val();
    if (data) {
        if (data.newStates) {
            deviceStates = { ...deviceStates, ...data.newStates };
        }
        // Đồng bộ nhiệt độ từ dashboard nếu có
        if (data.currentStates && data.currentStates.temp) {
            deviceStates.ac.nhietdo = data.currentStates.temp;
        }
        updateUI();
    }
});

// Cập nhật trạng thái đèn
function updateLightState(brightness) {
    const isOn = deviceStates.light.isOn;
    // Cập nhật giá trị gradient của thanh trượt
    lightBrightness.style.setProperty('--value', `${brightness}%`);
    
    // Cập nhật các điểm đánh dấu
    const marks = document.querySelectorAll('.brightness-mark');
    marks.forEach(mark => {
        const markValue = parseInt(mark.dataset.value);
        mark.classList.toggle('active', markValue <= brightness);
    });

    // Thêm hiệu ứng cho giá trị khi thay đổi
    const valueDisplay = document.querySelector('.slider-value');
    valueDisplay.classList.add('changing');
    setTimeout(() => valueDisplay.classList.remove('changing'), 1000);

    // Cập nhật trạng thái và gửi lên Firebase
    deviceStates.light.brightness = brightness;
    updateDevice('light');
    updateLightIcon(isOn, brightness);
}

// Điều khiển đèn
lightToggle.addEventListener('click', () => {
    deviceStates.light.isOn = !deviceStates.light.isOn;
    
    // Nếu bật đèn, khôi phục độ sáng trước đó hoặc mặc định là 100%
    if (deviceStates.light.isOn && deviceStates.light.brightness === 0) {
        deviceStates.light.brightness = 100;
        lightBrightness.value = 100;
        sliderValue.textContent = '100%';
    }
    
    // Nếu tắt đèn, đặt độ sáng về 0
    if (!deviceStates.light.isOn) {
        deviceStates.light.brightness = 0;
        lightBrightness.value = 0;
        sliderValue.textContent = '0%';
    }
    
    updateDevice('light');
    updateLightIcon(deviceStates.light.isOn, deviceStates.light.brightness);
});

lightBrightness.addEventListener('input', (e) => {
    const brightness = parseInt(e.target.value);
    sliderValue.textContent = `${brightness}%`;
    
    // Chỉ cho phép điều chỉnh độ sáng khi đèn đang bật
    if (deviceStates.light.isOn) {
        updateLightState(brightness);
    } else if (brightness > 0) {
        // Nếu đèn đang tắt và người dùng kéo thanh trượt, tự động bật đèn
        deviceStates.light.isOn = true;
        updateLightState(brightness);
    }
});

// Thêm hiệu ứng hover cho thanh trượt
lightBrightness.addEventListener('mouseover', () => {
    lightBrightness.style.setProperty('--hover-opacity', '1');
});

lightBrightness.addEventListener('mouseout', () => {
    lightBrightness.style.setProperty('--hover-opacity', '0');
});

function updateLightIcon(isOn, brightness) {
    const lightIcon = document.getElementById('light-icon');
    if (!isOn || brightness === 0) {
        lightIcon.src = './img/lam_1.png';  // Đèn tắt
    } else if (brightness <= 25) {
        lightIcon.src = './img/lam_2.png';  // Sáng 25%
    } else if (brightness <= 50) {
        lightIcon.src = './img/lam_3.png';  // Sáng 50%
    } else if (brightness <= 75) {
        lightIcon.src = './img/lam_4.png';  // Sáng 75%
    } else {
        lightIcon.src = './img/lam_5.png';  // Sáng 100%
    }
}

// Điều khiển quạt
fanToggle.addEventListener('click', () => {
    deviceStates.fan.power = !deviceStates.fan.power;
    updateDevice('fan');
    updateFanAnimation();
});

speedButtons.forEach(btn => {
    btn.addEventListener('click', () => {
        deviceStates.fan.speed = parseInt(btn.dataset.speed);
        updateDevice('fan');
        updateFanAnimation();
    });
});

function updateFanAnimation() {
    fanIcon.className = deviceStates.fan.power ? `spin${deviceStates.fan.speed}` : 'spinStop';
}

// Điều khiển máy lạnh
acToggle.addEventListener('click', () => {
    deviceStates.ac.power = !deviceStates.ac.power;
    
    // Khi bật máy lạnh, cập nhật nhiệt độ hiện tại lên dashboard
    if (deviceStates.ac.power) {
        devicesRef.update({
            [`newStates/ac`]: deviceStates.ac,
            [`currentStates/temp`]: deviceStates.ac.nhietdo
        });
    } else {
        // Khi tắt máy lạnh, chỉ cập nhật trạng thái
        devicesRef.update({
            [`newStates/ac`]: deviceStates.ac
        });
    }
    
    updateACIcon(deviceStates.ac.power);
});

function updateACIcon(isOn) {
    document.getElementById('ac-icon').src = isOn ? './img/air_on.png' : './img/air_off.png';
}

// Điều khiển nhiệt độ máy lạnh
let tempInterval;
const TEMP_ADJUST_DELAY = 80; // Giảm delay xuống để mượt hơn
let isAdjusting = false; // Biến để theo dõi trạng thái đang điều chỉnh
let holdTimeout; // Timeout để xác định thời gian giữ nút

function updateTempUI(temp) {
    document.querySelector('.temp-value').textContent = temp;
    // Thêm class để tạo hiệu ứng chuyển động
    const tempDisplay = document.querySelector('.temp-display');
    tempDisplay.classList.add('updating');
    setTimeout(() => tempDisplay.classList.remove('updating'), 200);
}

function adjustTemperature(direction) {
    // Kiểm tra nếu máy lạnh đang tắt thì không cho điều chỉnh
    if (!deviceStates.ac.power) {
        return;
    }

    if (isAdjusting) return; // Tránh việc cập nhật quá nhanh
    isAdjusting = true;

    const currentTemp = deviceStates.ac.nhietdo;
    let newTemp = currentTemp;

    if (direction === 'up' && currentTemp < 30) {
        newTemp = currentTemp + 1;
    } else if (direction === 'down' && currentTemp > 16) {
        newTemp = currentTemp - 1;
    } else {
        isAdjusting = false;
        return;
    }

    // Cập nhật UI trước để phản hồi nhanh
    deviceStates.ac.nhietdo = newTemp;
    updateTempUI(newTemp);

    // Chỉ cập nhật nhiệt độ lên dashboard khi máy lạnh đang bật
    if (deviceStates.ac.power) {
        // Cập nhật cả trạng thái và nhiệt độ dashboard
        const updates = {
            'newStates/ac/nhietdo': newTemp,
            'currentStates/temp': newTemp
        };
        devicesRef.update(updates)
            .then(() => {
                isAdjusting = false;
            })
            .catch(error => {
                console.error('Lỗi cập nhật nhiệt độ:', error);
                isAdjusting = false;
            });
    }
}

// Xử lý sự kiện nhấn giữ nút
function handleTempButtonPress(direction) {
    // Đầu tiên chỉ tăng/giảm một lần
    adjustTemperature(direction);
    
    // Thiết lập timeout để bắt đầu tăng/giảm liên tục sau khi giữ 500ms
    holdTimeout = setTimeout(() => {
        tempInterval = setInterval(() => adjustTemperature(direction), TEMP_ADJUST_DELAY);
    }, 500);
}

function handleTempButtonRelease() {
    // Xóa cả timeout và interval
    clearTimeout(holdTimeout);
    clearInterval(tempInterval);
    isAdjusting = false;
}

// Cập nhật event listeners
tempUp.addEventListener('mousedown', () => handleTempButtonPress('up'));
tempDown.addEventListener('mousedown', () => handleTempButtonPress('down'));

// Dừng việc tăng/giảm khi nhả chuột hoặc rời khỏi nút
['mouseup', 'mouseleave'].forEach(event => {
    tempUp.addEventListener(event, handleTempButtonRelease);
    tempDown.addEventListener(event, handleTempButtonRelease);
});

// Thêm hiệu ứng active khi nhấn nút
['mousedown', 'touchstart'].forEach(event => {
    tempUp.addEventListener(event, () => {
        tempUp.classList.add('temp-btn-active');
    });
    
    tempDown.addEventListener(event, () => {
        tempDown.classList.add('temp-btn-active');
    });
});

['mouseup', 'mouseleave', 'touchend'].forEach(event => {
    tempUp.addEventListener(event, () => {
        tempUp.classList.remove('temp-btn-active');
    });
    
    tempDown.addEventListener(event, () => {
        tempDown.classList.remove('temp-btn-active');
    });
});

// Điều khiển nhanh
allOnButton.addEventListener('click', () => {
    const newStates = {
        light: { isOn: true, brightness: 100 },
        fan: { power: true, speed: 3 },
        ac: { power: true, nhietdo: 25 }
    };

    // Cập nhật local state trước để phản hồi nhanh
    deviceStates = { ...deviceStates, ...newStates };
    updateUI();

    // Cập nhật lên Firebase sử dụng `update()` để tránh ghi đè toàn bộ dữ liệu
    devicesRef.child("newStates").update(newStates)
    .then(() => console.log('🔥 Bật tất cả thành công!'))
    .catch(error => console.error('⚠️ Lỗi khi bật tất cả thiết bị:', error));
});

allOffButton.addEventListener('click', () => {
    const newStates = {
        light: { isOn: false, brightness: 0 },
        fan: { power: false, speed: 1 },
        ac: { power: false, nhietdo: 25 }
    };

    deviceStates = { ...deviceStates, ...newStates };
    updateUI();

    devicesRef.child("newStates").update(newStates)
    .then(() => console.log('❌ Tắt tất cả thành công!'))
    .catch(error => console.error('⚠️ Lỗi khi tắt tất cả thiết bị:', error));
});

// Cập nhật Firebase
function updateDevice(device) {
    devicesRef.update({ [`newStates/${device}`]: deviceStates[device] })
        .then(updateUI)
        .catch(error => console.error('Lỗi cập nhật thiết bị:', error));
}

// Cập nhật UI
function updateUI() {
    // Cập nhật trạng thái đèn
    lightBrightness.value = deviceStates.light.brightness;
    sliderValue.textContent = `${deviceStates.light.brightness}%`;
    lightToggle.classList.toggle('active', deviceStates.light.isOn);
    updateLightIcon(deviceStates.light.isOn, deviceStates.light.brightness);
    
    // Cập nhật trạng thái quạt
    fanToggle.classList.toggle('active', deviceStates.fan.power);
    speedButtons.forEach(btn => btn.classList.toggle('active', parseInt(btn.dataset.speed) === deviceStates.fan.speed));
    updateFanAnimation();
    
    // Cập nhật trạng thái máy lạnh
    acToggle.classList.toggle('active', deviceStates.ac.power);
    updateACIcon(deviceStates.ac.power);
    document.querySelector('.temp-value').textContent = deviceStates.ac.nhietdo;
    
    // Thêm xử lý disable/enable các nút điều chỉnh nhiệt độ
    const tempButtons = document.querySelectorAll('.temp-btn');
    tempButtons.forEach(btn => {
        btn.disabled = !deviceStates.ac.power;
        btn.style.opacity = deviceStates.ac.power ? '1' : '0.5';
        btn.style.cursor = deviceStates.ac.power ? 'pointer' : 'not-allowed';
    });
}
