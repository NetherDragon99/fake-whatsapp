// Subtle Android Toast Notifications
class ToastManager {
  constructor() {
    this.container = null;
  }

  getContainer() {
    if (!this.container) {
      this.container = document.createElement('div');
      this.container.className = 'wa-toast-container';
      document.body.appendChild(this.container);
    }
    return this.container;
  }

  show(message, duration = 3000) {
    const container = this.getContainer();
    const toast = document.createElement('div');
    toast.className = 'wa-toast';
    toast.textContent = message;

    container.appendChild(toast);

    requestAnimationFrame(() => {
      toast.classList.add('visible');
    });

    setTimeout(() => {
      toast.classList.remove('visible');
      setTimeout(() => toast.remove(), 300);
    }, duration);
  }
}

export const Toast = new ToastManager();
