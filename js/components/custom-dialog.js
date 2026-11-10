// Reusable Material 3 In-App Dialog Component replacing window.alert and window.confirm

/**
 * Shows an in-app confirmation modal.
 * @param {Object} options
 * @param {string} options.title - Dialog heading
 * @param {string} options.message - Body text / explanation
 * @param {string} [options.confirmText='OK'] - Positive action label
 * @param {string} [options.cancelText='Cancel'] - Dismiss action label
 * @param {boolean} [options.isDanger=false] - Whether the action is destructive (renders in red)
 * @returns {Promise<boolean>}
 */
export function showConfirm({ title, message, confirmText = 'OK', cancelText = 'Cancel', isDanger = false }) {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay custom-dialog-overlay active';

    overlay.innerHTML = `
      <div class="custom-dialog-card ${isDanger ? 'is-danger' : ''}" role="dialog" aria-modal="true" aria-labelledby="dialog-title">
        ${title ? `<h3 class="custom-dialog-title" id="dialog-title">${escapeHtml(title)}</h3>` : ''}
        <div class="custom-dialog-body">${escapeHtml(message)}</div>
        <div class="custom-dialog-actions">
          <button type="button" class="dialog-btn dialog-btn-cancel">${escapeHtml(cancelText)}</button>
          <button type="button" class="dialog-btn dialog-btn-confirm ${isDanger ? 'btn-danger' : ''}">${escapeHtml(confirmText)}</button>
        </div>
      </div>
    `;

    function cleanup(result) {
      document.removeEventListener('keydown', onKeyDown);
      overlay.classList.remove('active');
      overlay.style.opacity = '0';
      setTimeout(() => {
        if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
      }, 200);
      resolve(result);
    }

    function onKeyDown(e) {
      if (e.key === 'Escape') {
        cleanup(false);
      } else if (e.key === 'Enter') {
        cleanup(true);
      }
    }

    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        cleanup(false);
      }
    });

    const cancelBtn = overlay.querySelector('.dialog-btn-cancel');
    const confirmBtn = overlay.querySelector('.dialog-btn-confirm');

    cancelBtn.addEventListener('click', () => cleanup(false));
    confirmBtn.addEventListener('click', () => cleanup(true));

    document.addEventListener('keydown', onKeyDown);
    document.body.appendChild(overlay);

    // Focus confirm or cancel button
    confirmBtn.focus();
  });
}

/**
 * Shows an in-app alert modal.
 * @param {Object} options
 * @param {string} options.title - Alert title
 * @param {string} options.message - Alert body text
 * @param {string} [options.okText='OK'] - Dismiss button text
 * @returns {Promise<void>}
 */
export function showAlert({ title, message, okText = 'OK' }) {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay custom-dialog-overlay active';

    overlay.innerHTML = `
      <div class="custom-dialog-card" role="alertdialog" aria-modal="true" aria-labelledby="alert-title">
        ${title ? `<h3 class="custom-dialog-title" id="alert-title">${escapeHtml(title)}</h3>` : ''}
        <div class="custom-dialog-body">${escapeHtml(message)}</div>
        <div class="custom-dialog-actions">
          <button type="button" class="dialog-btn dialog-btn-confirm">${escapeHtml(okText)}</button>
        </div>
      </div>
    `;

    function cleanup() {
      document.removeEventListener('keydown', onKeyDown);
      overlay.classList.remove('active');
      overlay.style.opacity = '0';
      setTimeout(() => {
        if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
      }, 200);
      resolve();
    }

    function onKeyDown(e) {
      if (e.key === 'Escape' || e.key === 'Enter') {
        cleanup();
      }
    }

    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) cleanup();
    });

    const confirmBtn = overlay.querySelector('.dialog-btn-confirm');
    confirmBtn.addEventListener('click', () => cleanup());

    document.addEventListener('keydown', onKeyDown);
    document.body.appendChild(overlay);
    confirmBtn.focus();
  });
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
