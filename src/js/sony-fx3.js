(function() {
  // ─── Sony FX3 BLE UUIDs ───
  // The FX3 uses a proprietary BLE service when in "Bluetooth Remote Control" mode.
  // Enable on camera: Menu → Network → Bluetooth Settings → Bluetooth Remote Control → ON
  const SONY_SERVICE   = '8000ff00-ff00-ffff-ffff-ffffffffffff';
  const SONY_CHAR_WRITE= '8000ff01-ff00-ffff-ffff-ffffffffffff';
  const SONY_CHAR_NOTIFY='8000ff02-ff00-ffff-ffff-ffffffffffff';

  // Record command bytes (Sony FX3 BLE remote protocol)
  const CMD_REC_START = new Uint8Array([0x08, 0x01]);
  const CMD_REC_STOP  = new Uint8Array([0x08, 0x00]);

  const bt = {
    device:    null,
    server:    null,
    charWrite: null,
    recording: false,
    connecting:false,
  };

  function _btToast(msg, color) {
    color = color || '#1c1c1e';
    const t = document.createElement('div');
    t.style.cssText = 'position:fixed;bottom:88px;left:50%;transform:translateX(-50%);'
      + 'background:' + color + ';color:#fff;font-weight:600;padding:11px 22px;'
      + 'border-radius:12px;z-index:99999;font-size:13px;'
      + 'box-shadow:0 4px 20px rgba(0,0,0,0.35);pointer-events:none;'
      + 'direction:rtl;white-space:nowrap;';
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 3000);
  }

  function _btUpdateUI() {
    const connectBtn = document.getElementById('btConnectBtn');
    const recordBtn  = document.getElementById('btRecordBtn');
    if (!connectBtn) return;

    if (bt.connecting) {
      connectBtn.innerHTML = '<span id="btStatusDot"></span>⏳ جاري الاتصال...';
      connectBtn.className = 'btn btn-glass btn-sm';
      connectBtn.disabled  = true;
      if (recordBtn) recordBtn.style.display = 'none';
      return;
    }

    connectBtn.disabled = false;

    if (!bt.charWrite) {
      // Disconnected state
      connectBtn.innerHTML = '<span id="btStatusDot"></span>📡 FX3';
      connectBtn.className = 'btn btn-glass btn-sm';
      connectBtn.title     = 'ربط كاميرا Sony FX3 عبر البلوتوث';
      connectBtn.onclick   = () => btConnect();
      if (recordBtn) recordBtn.style.display = 'none';
    } else {
      // Connected state
      connectBtn.innerHTML = '<span id="btStatusDot"></span>📡 FX3 ✓';
      connectBtn.className = 'btn btn-glass btn-sm bt-connected';
      connectBtn.title     = 'قطع الاتصال بالكاميرا';
      connectBtn.onclick   = () => btDisconnect();

      if (recordBtn) {
        recordBtn.style.display = '';
        if (bt.recording) {
          recordBtn.textContent = '⏹ إيقاف';
          recordBtn.className = 'btn btn-sm bt-recording';
        } else {
          recordBtn.textContent = '⏺ تسجيل';
          recordBtn.className = 'btn btn-glass btn-sm bt-record-ready';
        }
      }
    }
  }

  async function btConnect() {
    if (!navigator.bluetooth) {
      _btToast('المتصفح لا يدعم Web Bluetooth. استخدم Chrome على جهاز يدعم البلوتوث.', '#ff3b30');
      return;
    }

    bt.connecting = true;
    _btUpdateUI();

    try {
      bt.device = await navigator.bluetooth.requestDevice({
        filters: [
          { namePrefix: 'ILCE-FX3' },
          { namePrefix: 'FX3' },
          { services: [SONY_SERVICE] },
        ],
        optionalServices: [SONY_SERVICE],
      });

      bt.device.addEventListener('gattserverdisconnected', _btOnDisconnect);

      bt.server = await bt.device.gatt.connect();

      const service = await bt.server.getPrimaryService(SONY_SERVICE);
      bt.charWrite  = await service.getCharacteristic(SONY_CHAR_WRITE);

      // Subscribe to notifications if available
      try {
        const charNotify = await service.getCharacteristic(SONY_CHAR_NOTIFY);
        await charNotify.startNotifications();
        charNotify.addEventListener('characteristicvaluechanged', (e) => {
          const val = e.target.value;
          // Byte 1 = 0x08 → record status; byte 2 = 0x01 → recording, 0x00 → stopped
          if (val.byteLength >= 2 && val.getUint8(0) === 0x08) {
            bt.recording = val.getUint8(1) === 0x01;
            _btUpdateUI();
          }
        });
      } catch (_) { /* Notify characteristic optional */ }

      bt.connecting = false;
      bt.recording  = false;
      _btUpdateUI();
      _btToast('✅ تم الاتصال بـ ' + bt.device.name, '#30d158');

    } catch (e) {
      bt.connecting = false;
      bt.device     = null;
      bt.server     = null;
      bt.charWrite  = null;
      _btUpdateUI();
      if (e.name !== 'NotFoundError' && e.name !== 'AbortError') {
        _btToast('❌ فشل الاتصال: ' + e.message, '#ff3b30');
      }
    }
  }

  function btDisconnect() {
    if (bt.device && bt.device.gatt.connected) {
      bt.device.gatt.disconnect();
    }
    _btOnDisconnect();
  }

  function _btOnDisconnect() {
    bt.server    = null;
    bt.charWrite = null;
    bt.recording = false;
    bt.connecting= false;
    _btUpdateUI();
    _btToast('🔌 تم قطع الاتصال بالكاميرا', '#636366');
  }

  async function btToggleRecord() {
    if (!bt.charWrite) {
      _btToast('قم بالاتصال بالكاميرا أولاً', '#ff9f0a');
      return;
    }
    try {
      const cmd = bt.recording ? CMD_REC_STOP : CMD_REC_START;
      await bt.charWrite.writeValueWithoutResponse(cmd);
      bt.recording = !bt.recording;
      _btUpdateUI();
    } catch (e) {
      _btToast('❌ خطأ في إرسال الأمر: ' + e.message, '#ff3b30');
    }
  }

  // Expose functions globally
  window.btConnect      = btConnect;
  window.btDisconnect   = btDisconnect;
  window.btToggleRecord = btToggleRecord;
})();
