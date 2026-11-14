// Pin Duration Picker Dialog (WhatsApp Android Style)
import { Icons } from '../icons.js';

export class PinDurationPicker {
  /**
   * Opens the pin duration modal.
   * @returns {Promise<{ expiresAt: number | null } | null>}
   *   expiresAt: timestamp ms or null (permanent)
   *   returns null if cancelled
   */
  static open() {
    return new Promise((resolve) => {
      const overlay = document.createElement('div');
      overlay.className = 'modal-overlay custom-dialog-overlay pin-duration-modal-overlay active';

      // Default to 7 days like WhatsApp
      let selectedDuration = '7d';

      // Format current time + 1 hour as default custom datetime
      const defaultCustomDate = new Date(Date.now() + 3600000);
      const tzOffset = defaultCustomDate.getTimezoneOffset() * 60000;
      const localISOTime = new Date(defaultCustomDate.getTime() - tzOffset).toISOString().slice(0, 16);

      // Min datetime is right now
      const nowLocalISO = new Date(Date.now() - tzOffset).toISOString().slice(0, 16);

      overlay.innerHTML = `
        <div class="custom-dialog-card pin-duration-dialog" role="dialog" aria-modal="true" aria-labelledby="pin-duration-title">
          <div class="pin-duration-header">
            <span class="pin-duration-icon">${Icons.pin('', 22)}</span>
            <h3 class="custom-dialog-title" id="pin-duration-title">Choose pin duration</h3>
          </div>
          <div class="custom-dialog-body pin-duration-body">
            <p class="pin-duration-subtitle">How long should this message stay pinned in this chat?</p>
            
            <div class="pin-radio-group">
              <label class="pin-radio-row">
                <input type="radio" name="pin-duration" value="1d" class="wa-radio" />
                <span class="pin-radio-label">24 hours (1 day)</span>
              </label>

              <label class="pin-radio-row">
                <input type="radio" name="pin-duration" value="7d" class="wa-radio" checked />
                <span class="pin-radio-label">7 days</span>
              </label>

              <label class="pin-radio-row">
                <input type="radio" name="pin-duration" value="30d" class="wa-radio" />
                <span class="pin-radio-label">30 days</span>
              </label>

              <label class="pin-radio-row">
                <input type="radio" name="pin-duration" value="permanent" class="wa-radio" />
                <span class="pin-radio-label">Permanently</span>
              </label>

              <label class="pin-radio-row pin-radio-custom-row">
                <input type="radio" name="pin-duration" value="custom" class="wa-radio" />
                <span class="pin-radio-label">Custom date &amp; time</span>
              </label>
            </div>

            <div class="pin-custom-datetime-wrap" style="display: none;">
              <label for="pin-custom-dt-input" class="pin-custom-dt-label">Select end date and time:</label>
              <div class="pin-custom-input-box">
                <input type="datetime-local" id="pin-custom-dt-input" class="pin-datetime-input" min="${nowLocalISO}" value="${localISOTime}" />
              </div>
            </div>
          </div>

          <div class="custom-dialog-actions">
            <button type="button" class="dialog-btn dialog-btn-cancel" id="btn-pin-cancel">Cancel</button>
            <button type="button" class="dialog-btn dialog-btn-confirm" id="btn-pin-confirm">Pin</button>
          </div>
        </div>
      `;

      document.body.appendChild(overlay);

      const customWrap = overlay.querySelector('.pin-custom-datetime-wrap');
      const customInput = overlay.querySelector('#pin-custom-dt-input');
      const radioInputs = overlay.querySelectorAll('input[name="pin-duration"]');
      const confirmBtn = overlay.querySelector('#btn-pin-confirm');
      const cancelBtn = overlay.querySelector('#btn-pin-cancel');

      function updateCustomVisibility() {
        const checked = overlay.querySelector('input[name="pin-duration"]:checked');
        selectedDuration = checked ? checked.value : '7d';
        if (selectedDuration === 'custom') {
          customWrap.style.display = 'block';
          setTimeout(() => customInput.focus(), 50);
        } else {
          customWrap.style.display = 'none';
        }
      }

      radioInputs.forEach((r) => {
        r.addEventListener('change', updateCustomVisibility);
      });

      function cleanup(result) {
        document.removeEventListener('keydown', onKeyDown);
        overlay.classList.remove('active');
        overlay.style.opacity = '0';
        setTimeout(() => {
          if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
        }, 180);
        resolve(result);
      }

      function onKeyDown(e) {
        if (e.key === 'Escape') {
          cleanup(null);
        } else if (e.key === 'Enter') {
          handleConfirm();
        }
      }
      document.addEventListener('keydown', onKeyDown);

      function handleConfirm() {
        const now = Date.now();
        let expiresAt = null;

        if (selectedDuration === '1d') {
          expiresAt = now + 24 * 60 * 60 * 1000;
        } else if (selectedDuration === '7d') {
          expiresAt = now + 7 * 24 * 60 * 60 * 1000;
        } else if (selectedDuration === '30d') {
          expiresAt = now + 30 * 24 * 60 * 60 * 1000;
        } else if (selectedDuration === 'permanent') {
          expiresAt = null;
        } else if (selectedDuration === 'custom') {
          const val = customInput.value;
          if (!val) {
            customInput.focus();
            return;
          }
          const chosenMs = new Date(val).getTime();
          if (isNaN(chosenMs) || chosenMs <= now) {
            alert('Please select a future date and time.');
            customInput.focus();
            return;
          }
          expiresAt = chosenMs;
        }

        cleanup({ expiresAt });
      }

      confirmBtn.addEventListener('click', handleConfirm);
      cancelBtn.addEventListener('click', () => cleanup(null));

      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) cleanup(null);
      });
    });
  }
}

