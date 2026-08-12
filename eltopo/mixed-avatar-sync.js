// Visual privacy layer for Todo Mezclado.
// While everyone is still in the lobby we remember the real-name -> avatar map.
// Once identities are shuffled, every visible avatar follows the public/impersonated name,
// so the original profile photo cannot reveal who is really behind an account.

const BUILD_VERSION = '0.8.4';
const realAvatarByName = new Map();
let applying = false;

function cleanName(text='') {
  return text.replace(/\s*\(vos\)\s*$/i, '').trim();
}

function ensureVisibleVersion() {
  const badge = document.getElementById('connectionBadge');
  if (!badge) return;
  const next = badge.textContent.replace(/^v\d+\.\d+\.\d+/, `v${BUILD_VERSION}`);
  if (next !== badge.textContent) badge.textContent = next;
}

function isMixedGame() {
  return document.getElementById('groupName')?.textContent?.includes('Todo mezclado');
}

function rememberLobbyAvatars() {
  if (isMixedGame()) return;
  document.querySelectorAll('.social-participant').forEach(row => {
    const name = cleanName(row.querySelector('.participant-copy strong')?.textContent || '');
    const img = row.querySelector('.participant-avatar img');
    if (name && img?.src) realAvatarByName.set(name, img.src);
  });
}

function forceImage(container, name) {
  if (!container || !name) return;
  const src = realAvatarByName.get(cleanName(name));
  if (!src) return;
  let img = container.querySelector('img');
  if (!img) {
    container.innerHTML = '';
    img = document.createElement('img');
    img.className = 'wa-avatar-img';
    container.appendChild(img);
  }
  if (img.src !== src) img.src = src;
  img.style.display = 'block';
  const fallback = container.querySelector('.wa-avatar-fallback');
  if (fallback) fallback.style.display = 'none';
}

function applyMixedAvatars() {
  if (applying) return;
  applying = true;
  try {
    ensureVisibleVersion();
    rememberLobbyAvatars();
    if (!isMixedGame()) return;

    document.querySelectorAll('.social-participant').forEach(row => {
      const name = cleanName(row.querySelector('.participant-copy strong')?.textContent || '');
      forceImage(row.querySelector('.participant-avatar'), name);
    });

    document.querySelectorAll('.message-row:not(.mine)').forEach(row => {
      const name = cleanName(row.querySelector('.sender-name')?.textContent || '');
      forceImage(row.querySelector('.message-avatar'), name);
    });

    const myPublicName = cleanName(document.getElementById('meName')?.textContent || '');
    forceImage(document.getElementById('meAvatar'), myPublicName);
  } finally {
    applying = false;
  }
}

const observer = new MutationObserver(() => queueMicrotask(applyMixedAvatars));
observer.observe(document.documentElement, {subtree:true, childList:true, characterData:true, attributes:true, attributeFilter:['src']});
window.addEventListener('load', applyMixedAvatars);
queueMicrotask(applyMixedAvatars);
