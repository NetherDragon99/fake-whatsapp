// 4-Digit PIN Pad Dialog with SHA-256 Hashing & Recovery
import { Icons } from '../icons.js';
import { db } from '../db.js';

export class PinDialog {
  constructor() {
    this.overlay = null;
  }

  static async hashString(str) {
    const encoder = new TextEncoder();
    const data = encoder.encode(str);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  }

  // Prompt user to enter their 4-digit PIN to unlock
  static promptUnlock() {
    return new Promise(async (resolve) => {
      const storedHash = await db.getSetting('pinHash', null);
      if (!storedHash) {
        // No PIN set up yet, allow access or prompt setup
        resolve(true);
        return;
      }

      const dialog = new PinDialog();
      dialog.show('Enter PIN to unlock', async (enteredPin) => {
        const enteredHash = await PinDialog.hashString(enteredPin);
        if (enteredHash === storedHash) {
          dialog.close();
          resolve(true);
        } else {
          dialog.showError('Incorrect PIN');
        }
      }, () => resolve(false));
    });
  }

  // Prompt user to set a new 4-digit PIN + optional recovery question
  static promptSetup() {
    return new Promise((resolve) => {
      let firstPin = '';
      const dialog = new PinDialog();

      dialog.show('Set a 4-digit PIN', (pin1) => {
        firstPin = pin1;
        dialog.close();

        // Confirm PIN
        const confirmDialog = new PinDialog();
        confirmDialog.show('Confirm your PIN', async (pin2) => {
          if (firstPin === pin2) {
            confirmDialog.close();
            const hash = await PinDialog.hashString(pin2);
            await db.setSetting('pinHash', hash);
            resolve(true);
          } else {
            confirmDialog.showError('PINs do not match. Try again.');
            setTimeout(() => {
              confirmDialog.close();
              resolve(false);
            }, 1000);
          }
        }, () => resolve(false));
      }, () => resolve(false));
    });
  }

  show(titleText, onSubmit, onCancel) {
    this.close();
    this.enteredDigits = '';

    this.overlay = document.createElement('div');
    this.overlay.className = 'wa-pin-overlay';

    this.overlay.innerHTML = `
      <div class="pin-card">
        <div class="pin-header">
          <div class="pin-icon">${Icons.lock('', 28)}</div>
          <h3 class="pin-title">${titleText}</h3>
        </div>
        
        <div class="pin-dots">
          <span class="dot" data-i="0"></span>
          <span class="dot" data-i="1"></span>
          <span class="dot" data-i="2"></span>
          <span class="dot" data-i="3"></span>
        </div>

        <div class="pin-error-msg" id="pin-error-box"></div>

        <div class="pin-keypad">
          ${[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => `<button class="keypad-btn" data-val="${n}">${n}</button>`).join('')}
          <button class="keypad-btn action-cancel" data-action="cancel">Cancel</button>
          <button class="keypad-btn" data-val="0">0</button>
          <button class="keypad-btn action-del" data-action="del">⌫</button>
        </div>

        <div class="pin-footer-actions">
          <button class="forgot-pin-link">Forgot PIN?</button>
        </div>
      </div>
    `;

    document.body.appendChild(this.overlay);

    const dots = this.overlay.querySelectorAll('.dot');
    const updateDots = () => {
      dots.forEach((dot, idx) => {
        if (idx < this.enteredDigits.length) {
          dot.classList.add('filled');
        } else {
          dot.classList.remove('filled');
        }
      });
    };

    this.overlay.querySelectorAll('.keypad-btn').forEach((btn) => {
      btn.addEventListener('click', async (e) => {
        const val = btn.dataset.val;
        const act = btn.dataset.action;

        if (val) {
          if (this.enteredDigits.length < 4) {
            this.enteredDigits += val;
            updateDots();
            if (this.enteredDigits.length === 4) {
              setTimeout(() => onSubmit(this.enteredDigits), 50);
            }
          }
        } else if (act === 'del') {
          this.enteredDigits = this.enteredDigits.slice(0, -1);
          updateDots();
          this.clearError();
        } else if (act === 'cancel') {
          this.close();
          if (onCancel) onCancel();
        }
      });
    });

    this.overlay.querySelector('.forgot-pin-link').addEventListener('click', async () => {
      const confirmed = confirm('Forgot your PIN? Resetting your PIN will unlock all locked chats.');
      if (confirmed) {
        await db.setSetting('pinHash', null);
        const chats = await db.getChats();
        for (const c of chats) {
          if (c.isLocked) {
            await db.updateChat(c.id, { isLocked: false });
          }
        }
        this.close();
        if (onSubmit) onSubmit('RESET');
      }
    });
  }

  showError(msg) {
    const errBox = this.overlay.querySelector('#pin-error-box');
    if (errBox) {
      errBox.textContent = msg;
    }
    const dotsWrap = this.overlay.querySelector('.pin-dots');
    dotsWrap.classList.add('shake');
    setTimeout(() => {
      dotsWrap.classList.remove('shake');
      this.enteredDigits = '';
      this.overlay.querySelectorAll('.dot').forEach((d) => d.classList.remove('filled'));
    }, 600);
  }

  clearError() {
    const errBox = this.overlay.querySelector('#pin-error-box');
    if (errBox) errBox.textContent = '';
  }

  close() {
    if (this.overlay) {
      this.overlay.remove();
      this.overlay = null;
    }
  }
}
