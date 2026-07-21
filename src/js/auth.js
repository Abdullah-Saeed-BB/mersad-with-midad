window.signInLocal = function(attempt) {
  if (window._mSignInLocal) { window._mSignInLocal(); return; }
  attempt = (attempt | 0) + 1;
  var errEl = document.getElementById('loginError');
  if (attempt <= 20) {
    if (attempt === 1 && errEl) { errEl.textContent = 'جارٍ تحميل التطبيق...'; errEl.style.display = 'block'; }
    setTimeout(function() { window.signInLocal(attempt); }, 500);
    return;
  }
  var msg = 'تعذّر تحميل التطبيق. يرجى تحديث الصفحة والمحاولة مجدداً.';
  if (errEl) { errEl.textContent = msg; errEl.style.display = 'block'; }
  else { var t = document.createElement('div'); t.className = '_toast _toast-error'; t.textContent = msg; t.style.cssText = 'position:fixed;bottom:28px;left:50%;transform:translateX(-50%);z-index:9999;background:rgba(255,59,48,0.14);border:1px solid rgba(255,59,48,0.3);color:#ff3b30;border-radius:14px;padding:11px 20px;font-size:14px;font-weight:500;max-width:calc(100vw - 48px);text-align:center'; document.body.appendChild(t); setTimeout(() => t.remove(), 4000); }
};
window.registerLocal = function(attempt) {
  if (window._mRegisterLocal) { window._mRegisterLocal(); return; }
  attempt = (attempt | 0) + 1;
  var errEl = document.getElementById('loginError');
  if (attempt <= 20) {
    if (attempt === 1 && errEl) { errEl.textContent = 'جارٍ تحميل التطبيق...'; errEl.style.display = 'block'; }
    setTimeout(function() { window.registerLocal(attempt); }, 500);
    return;
  }
  var msg = 'تعذّر تحميل التطبيق. يرجى تحديث الصفحة والمحاولة مجدداً.';
  if (errEl) { errEl.textContent = msg; errEl.style.display = 'block'; }
  else { var t = document.createElement('div'); t.className = '_toast _toast-error'; t.textContent = msg; t.style.cssText = 'position:fixed;bottom:28px;left:50%;transform:translateX(-50%);z-index:9999;background:rgba(255,59,48,0.14);border:1px solid rgba(255,59,48,0.3);color:#ff3b30;border-radius:14px;padding:11px 20px;font-size:14px;font-weight:500;max-width:calc(100vw - 48px);text-align:center'; document.body.appendChild(t); setTimeout(() => t.remove(), 4000); }
};
window._authMode = 'login';
window.toggleAuthMode = function() {
  window._authMode = window._authMode === 'login' ? 'register' : 'login';
  var isReg = window._authMode === 'register';
  var sub   = document.getElementById('loginModeSub');
  var conf  = document.getElementById('loginPassConfirm');
  var btn   = document.getElementById('loginSubmitBtn');
  var tog   = document.querySelector('.login-migrate-btn');
  var err   = document.getElementById('loginError');
  var warn  = document.getElementById('registerWarnings');
  if (sub)  sub.textContent  = isReg ? 'أنشئ حسابك للبدء' : 'سجّل دخولك لمزامنة تصاويرك على جميع أجهزتك';
  if (conf) conf.style.display = isReg ? 'block' : 'none';
  if (warn) warn.style.display = isReg ? 'block' : 'none';
  if (btn)  { btn.textContent = isReg ? 'إنشاء الحساب' : 'تسجيل الدخول'; btn.onclick = isReg ? window.registerLocal : window.signInLocal; }
  if (tog)  tog.textContent  = isReg ? 'لديك حساب؟ سجّل الدخول' : 'إنشاء حساب جديد';
  if (err)  err.style.display = 'none';
  var userEl = document.getElementById('loginUser');
  if (userEl) userEl.value = '';
};
window.togglePassView = function() {
  var el = document.getElementById('loginPass');
  var icon = document.getElementById('eyeIcon');
  if (!el) return;
  var show = el.type === 'password';
  el.type = show ? 'text' : 'password';
  icon.innerHTML = show
    ? '<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/>'
    : '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>';
};
window.signOutUser = function() { if (window._mSignOut) window._mSignOut(); };
document.addEventListener('DOMContentLoaded', function() {
  var passEl = document.getElementById('loginPass');
  if (passEl) passEl.addEventListener('keydown', function(e) { if (e.key === 'Enter') window.signInLocal(); });
  var submitBtn = document.getElementById('loginSubmitBtn');
  if (submitBtn) {
    submitBtn.addEventListener('touchend', function(e) {
      e.preventDefault();
      if (window._authMode === 'register') window.registerLocal(); else window.signInLocal();
    }, { passive: false });
  }
});
