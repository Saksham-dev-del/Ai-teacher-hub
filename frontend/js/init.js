async function bootApp() {
  let token = getToken();
  if (!token) {
    try { token = (await refreshAccessToken()).token; } catch (_) {}
  }
  if (!token) {
    showAuthScreen();
    return;
  }

  const user = await apiMe();
  if (!user) {
    clearSession();
    showAuthScreen();
    return;
  }

  setSession(getToken(), user);
  document.getElementById('user-name-label').textContent = user.name;
  document.getElementById('user-role-chip').textContent = user.role;
  document.body.dataset.userRole = user.role;
  document.querySelectorAll('.phase3-teacher-only').forEach((el) => { el.style.display = user.role === 'student' ? 'none' : ''; });

  const defaultTab = applyRoleVisibility(user.role);
  const work = [loadResources(), loadSharedResources()];
  if (user.role === 'teacher' || user.role === 'admin') { work.push(loadSyllabi()); work.push(loadPhase4MediaAssets()); }
  await Promise.all(work);

  showAppScreen();
  showTab(defaultTab);
}

bootApp();
