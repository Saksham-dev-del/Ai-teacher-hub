const authScreen = document.getElementById('auth-screen');
const appRoot = document.getElementById('app-root');

function showAuthScreen() {
  authScreen.classList.add('visible');
  appRoot.classList.remove('visible');
}
function showAppScreen() {
  authScreen.classList.remove('visible');
  appRoot.classList.add('visible');
}

document.querySelectorAll('.auth-tab').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.auth-tab').forEach((b) => b.classList.toggle('active', b === btn));
    document.querySelectorAll('.auth-form').forEach((f) => f.classList.remove('active'));
    document.getElementById(`${btn.dataset.authtab}-form`).classList.add('active');
  });
});

document.getElementById('login-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;
  const errorEl = document.getElementById('login-error');
  const submitBtn = document.getElementById('login-submit');
  errorEl.textContent = '';
  submitBtn.disabled = true;
  submitBtn.textContent = 'Logging in...';
  try {
    const data = await apiLogin(email, password);
    setSession(data.token, data.user);
    await bootApp();
  } catch (err) {
    errorEl.textContent = err.message || 'Could not log in.';
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Log in';
  }
});

document.getElementById('register-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const name = document.getElementById('register-name').value.trim();
  const email = document.getElementById('register-email').value.trim();
  const password = document.getElementById('register-password').value;
  const role = document.getElementById('register-role').value;
  const errorEl = document.getElementById('register-error');
  const submitBtn = document.getElementById('register-submit');
  errorEl.textContent = '';
  submitBtn.disabled = true;
  submitBtn.textContent = 'Creating account...';
  try {
    const data = await apiRegister(name, email, password, role);
    setSession(data.token, data.user);
    await bootApp();
  } catch (err) {
    errorEl.textContent = err.message || 'Could not create account.';
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Create account';
  }
});

document.getElementById('btn-logout').addEventListener('click', logout);
