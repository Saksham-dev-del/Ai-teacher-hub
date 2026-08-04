let deferredInstallPrompt=null;
function updateOnlineState(){const b=document.getElementById('pwa-network');if(!b)return;b.textContent=navigator.onLine?'Online':'Offline';b.classList.toggle('offline',!navigator.onLine)}
window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferredInstallPrompt=e;const b=document.getElementById('pwa-install');if(b)b.hidden=false});
window.addEventListener('appinstalled',()=>{deferredInstallPrompt=null;const b=document.getElementById('pwa-install');if(b)b.hidden=true;showToast('App installed successfully','success')});
window.addEventListener('online',updateOnlineState);window.addEventListener('offline',updateOnlineState);
document.addEventListener('DOMContentLoaded',()=>{updateOnlineState();const b=document.getElementById('pwa-install');if(b)b.onclick=async()=>{if(!deferredInstallPrompt){showToast('Use your browser menu → Install app if the prompt is not available.','info');return;}deferredInstallPrompt.prompt();await deferredInstallPrompt.userChoice;deferredInstallPrompt=null;b.hidden=true;};if('serviceWorker'in navigator)navigator.serviceWorker.register('/sw.js').catch(e=>console.warn('PWA registration failed',e));});
