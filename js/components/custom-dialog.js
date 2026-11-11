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
export function showConfirm({ title, message, confirmText = 'OK', cancelText = 'Cancel', isDanger = false, extraCheckbox = null }) {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay custom-dialog-overlay active';

    overlay.innerHTML = `
      <div class="custom-dialog-card ${isDanger ? 'is-danger' : ''}" role="dialog" aria-modal="true" aria-labelledby="dialog-title">
        ${title ? `<h3 class="custom-dialog-title" id="dialog-title">${escapeHtml(title)}</h3>` : ''}
        <div class="custom-dialog-body">
          ${escapeHtml(message)}
          ${extraCheckbox ? `
            <div class="custom-dialog-checkbox-row" style="margin-top: 14px; display: flex; align-items: center; gap: 10px;">
              <input type="checkbox" id="${extraCheckbox.id}" class="wa-checkbox" ${extraCheckbox.checked ? 'checked' : ''} style="width: 18px; height: 18px; cursor: pointer;" />
              <label for="${extraCheckbox.id}" style="font-size: 13.5px; color: var(--wa-text-primary, #e9edef); cursor: pointer; user-select: none;">${escapeHtml(extraCheckbox.label)}</label>
            </div>
          ` : ''}
        </div>
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

/**
 * Shows an in-app prompt modal with a text input.
 * @param {Object} options
 * @param {string} options.title - Dialog heading
 * @param {string} [options.message] - Optional explanation
 * @param {string} [options.defaultValue=''] - Initial input value
 * @param {string} [options.placeholder=''] - Input placeholder
 * @param {string} [options.confirmText='Save'] - Positive button text
 * @param {string} [options.cancelText='Cancel'] - Cancel button text
 * @returns {Promise<string|null>} Resolves with string if confirmed, null if dismissed
 */
export function showPrompt({ title, message = '', defaultValue = '', placeholder = '', confirmText = 'Save', cancelText = 'Cancel' }) {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay custom-dialog-overlay active';

    overlay.innerHTML = `
      <div class="custom-dialog-card" role="dialog" aria-modal="true" aria-labelledby="prompt-title">
        ${title ? `<h3 class="custom-dialog-title" id="prompt-title">${escapeHtml(title)}</h3>` : ''}
        ${message ? `<div class="custom-dialog-body">${escapeHtml(message)}</div>` : ''}
        <div class="custom-dialog-input-wrap" style="margin: 16px 0 10px 0;">
          <input type="text" class="custom-dialog-input" id="custom-dialog-input-field" value="${escapeHtml(defaultValue)}" placeholder="${escapeHtml(placeholder)}" style="width: 100%; box-sizing: border-box; background: var(--wa-input-bg, #202c33); color: var(--wa-text-primary, #e9edef); border: 1px solid var(--wa-border, #2a3942); border-radius: 8px; padding: 10px 14px; font-size: 15px; outline: none; font-family: inherit;" />
        </div>
        <div class="custom-dialog-actions">
          <button type="button" class="dialog-btn dialog-btn-cancel">${escapeHtml(cancelText)}</button>
          <button type="button" class="dialog-btn dialog-btn-confirm">${escapeHtml(confirmText)}</button>
        </div>
      </div>
    `;

    const inputField = overlay.querySelector('#custom-dialog-input-field');

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
        cleanup(null);
      } else if (e.key === 'Enter') {
        cleanup(inputField.value);
      }
    }

    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        cleanup(null);
      }
    });

    const cancelBtn = overlay.querySelector('.dialog-btn-cancel');
    const confirmBtn = overlay.querySelector('.dialog-btn-confirm');

    cancelBtn.addEventListener('click', () => cleanup(null));
    confirmBtn.addEventListener('click', () => cleanup(inputField.value));

    document.addEventListener('keydown', onKeyDown);
    document.body.appendChild(overlay);

    inputField.focus();
    inputField.select();
  });
}

/**
 * Shows a centered loading dialog with spinner, status text, and optional cancel button.
 * @param {Object} options
 * @param {string} options.title - Dialog heading (e.g. 'Swapping sender / receiver...')
 * @param {string} [options.message='Please wait'] - Subtitle
 * @param {string} [options.cancelText='Cancel'] - Cancel button label
 * @param {Function} [options.onCancel] - Callback invoked when cancel is clicked
 * @returns {{ close: Function, isCancelled: () => boolean, update: (title: string, sub?: string) => void }}
 */
export function showLoadingDialog({
  title = 'Loading...',
  message = 'Please wait',
  cancelText = 'Cancel',
  onCancel = null
} = {}) {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay custom-dialog-overlay active';

  let isCancelled = false;

  overlay.innerHTML = `
    <div class="custom-dialog-card swap-loading-card" role="dialog" aria-modal="true" style="padding: 24px; max-width: 320px;">
      <div style="display: flex; align-items: center; gap: 18px;">
        <div class="progress-spinner" style="width: 38px; height: 38px; min-width: 38px; border-width: 3.5px; border-color: rgba(255, 255, 255, 0.12); border-top-color: var(--wa-green, #00a884);"></div>
        <div style="display: flex; flex-direction: column; gap: 4px; overflow: hidden;">
          <h3 class="custom-dialog-title" id="loading-dialog-title" style="font-size: 16px; font-weight: 500; margin: 0; color: var(--wa-text-primary, #e9edef);">${escapeHtml(title)}</h3>
          <div class="custom-dialog-body" id="loading-dialog-sub" style="font-size: 13.5px; margin: 0; color: var(--wa-text-secondary, #8696a0);">${escapeHtml(message)}</div>
        </div>
      </div>
      ${cancelText ? `
        <div class="custom-dialog-actions" style="margin-top: 14px; margin-bottom: -4px;">
          <button type="button" class="dialog-btn dialog-btn-cancel" id="btn-dialog-cancel" style="color: var(--wa-green, #00a884); font-size: 14px; font-weight: 600; background: none; border: none; padding: 6px 14px; cursor: pointer;">${escapeHtml(cancelText)}</button>
        </div>
      ` : ''}
    </div>
  `;

  const cancelBtn = overlay.querySelector('#btn-dialog-cancel');
  if (cancelBtn) {
    cancelBtn.addEventListener('click', () => {
      if (isCancelled) return;
      isCancelled = true;
      cancelBtn.disabled = true;
      cancelBtn.style.opacity = '0.5';
      const sub = overlay.querySelector('#loading-dialog-sub');
      if (sub) sub.textContent = 'Cancelling...';
      if (typeof onCancel === 'function') {
        onCancel();
      }
    });
  }

  document.body.appendChild(overlay);

  return {
    isCancelled: () => isCancelled,
    update: (newTitle, newSub) => {
      const titleEl = overlay.querySelector('#loading-dialog-title');
      const subEl = overlay.querySelector('#loading-dialog-sub');
      if (titleEl && newTitle) titleEl.textContent = newTitle;
      if (subEl && newSub !== undefined) subEl.textContent = newSub;
    },
    close: () => {
      overlay.classList.remove('active');
      overlay.style.opacity = '0';
      setTimeout(() => {
        if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
      }, 200);
    }
  };
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
