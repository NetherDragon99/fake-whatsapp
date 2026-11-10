// Lightweight Zero-Dependency HTML5 Canvas Image Crop & Zoom Modal

/**
 * Opens an interactive Crop & Zoom modal for an image file.
 * @param {File|Blob} file - Selected image file
 * @returns {Promise<Blob|null>} - Resolves with cropped square JPEG Blob or null if cancelled
 */
export function openImageCropper(file) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        initModal(img, resolve);
      };
      img.onerror = () => resolve(null);
      img.src = reader.result;
    };
    reader.onerror = () => resolve(null);
    reader.readAsDataURL(file);
  });
}

function initModal(img, resolve) {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay cropper-modal-overlay active';

  overlay.innerHTML = `
    <div class="cropper-card" role="dialog" aria-modal="true" aria-label="Crop Image">
      <div class="cropper-header">
        <h3 class="cropper-title">Profile photo</h3>
        <button type="button" class="icon-btn cropper-close-btn" aria-label="Close">
          <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor">
            <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
          </svg>
        </button>
      </div>
      
      <div class="cropper-canvas-container">
        <canvas class="cropper-canvas" width="300" height="300"></canvas>
      </div>

      <div class="cropper-controls">
        <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
          <path d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14zM7 9h5v1H7z"/>
        </svg>
        <input type="range" class="cropper-zoom-slider" min="1" max="3" step="0.02" value="1" />
        <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
          <path d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14zm-1-4h2v2h1V9h2V8h-2V6h-1v2h-2z"/>
        </svg>
      </div>

      <div class="cropper-actions">
        <button type="button" class="dialog-btn cropper-btn-cancel">Cancel</button>
        <button type="button" class="dialog-btn cropper-btn-done">Done</button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  const canvas = overlay.querySelector('.cropper-canvas');
  const ctx = canvas.getContext('2d');
  const slider = overlay.querySelector('.cropper-zoom-slider');
  const closeBtn = overlay.querySelector('.cropper-close-btn');
  const cancelBtn = overlay.querySelector('.cropper-btn-cancel');
  const doneBtn = overlay.querySelector('.cropper-btn-done');

  const canvasSize = 300;
  canvas.width = canvasSize;
  canvas.height = canvasSize;

  // Initial scale to cover canvas
  const minScale = Math.max(canvasSize / img.naturalWidth, canvasSize / img.naturalHeight);
  let scaleMultiplier = 1;
  let offsetX = 0;
  let offsetY = 0;

  let isDragging = false;
  let startX = 0;
  let startY = 0;

  function render() {
    ctx.clearRect(0, 0, canvasSize, canvasSize);

    const currentScale = minScale * scaleMultiplier;
    const drawWidth = img.naturalWidth * currentScale;
    const drawHeight = img.naturalHeight * currentScale;

    // Constrain offset so image always covers the circle
    const maxOffsetX = Math.max(0, (drawWidth - canvasSize) / 2);
    const maxOffsetY = Math.max(0, (drawHeight - canvasSize) / 2);

    offsetX = Math.min(maxOffsetX, Math.max(-maxOffsetX, offsetX));
    offsetY = Math.min(maxOffsetY, Math.max(-maxOffsetY, offsetY));

    const x = (canvasSize - drawWidth) / 2 + offsetX;
    const y = (canvasSize - drawHeight) / 2 + offsetY;

    ctx.drawImage(img, x, y, drawWidth, drawHeight);

    // Draw circular mask overlay
    ctx.save();
    ctx.fillStyle = 'rgba(0, 0, 0, 0.65)';
    ctx.beginPath();
    ctx.rect(0, 0, canvasSize, canvasSize);
    ctx.arc(canvasSize / 2, canvasSize / 2, canvasSize / 2 - 2, 0, Math.PI * 2, true);
    ctx.fill();

    // Circular white border
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(canvasSize / 2, canvasSize / 2, canvasSize / 2 - 2, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  // Pointer drag listeners
  canvas.addEventListener('pointerdown', (e) => {
    isDragging = true;
    startX = e.clientX - offsetX;
    startY = e.clientY - offsetY;
    canvas.setPointerCapture(e.pointerId);
  });

  canvas.addEventListener('pointermove', (e) => {
    if (!isDragging) return;
    offsetX = e.clientX - startX;
    offsetY = e.clientY - startY;
    render();
  });

  canvas.addEventListener('pointerup', (e) => {
    isDragging = false;
    try { canvas.releasePointerCapture(e.pointerId); } catch (_) {}
  });

  canvas.addEventListener('pointercancel', (e) => {
    isDragging = false;
    try { canvas.releasePointerCapture(e.pointerId); } catch (_) {}
  });

  // Slider zoom listener
  slider.addEventListener('input', () => {
    scaleMultiplier = parseFloat(slider.value);
    render();
  });

  // Mouse wheel zoom
  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    const delta = e.deltaY < 0 ? 0.05 : -0.05;
    scaleMultiplier = Math.min(3, Math.max(1, scaleMultiplier + delta));
    slider.value = scaleMultiplier;
    render();
  }, { passive: false });

  function cleanup(resultBlob) {
    overlay.classList.remove('active');
    setTimeout(() => {
      if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
    }, 200);
    resolve(resultBlob);
  }

  closeBtn.addEventListener('click', () => cleanup(null));
  cancelBtn.addEventListener('click', () => cleanup(null));
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) cleanup(null);
  });

  doneBtn.addEventListener('click', () => {
    // Generate square cropped 512x512 JPEG Blob
    const exportSize = 512;
    const exportCanvas = document.createElement('canvas');
    exportCanvas.width = exportSize;
    exportCanvas.height = exportSize;
    const eCtx = exportCanvas.getContext('2d');

    const currentScale = minScale * scaleMultiplier;
    const factor = exportSize / canvasSize;

    const drawWidth = img.naturalWidth * currentScale * factor;
    const drawHeight = img.naturalHeight * currentScale * factor;
    const x = (exportSize - drawWidth) / 2 + offsetX * factor;
    const y = (exportSize - drawHeight) / 2 + offsetY * factor;

    eCtx.drawImage(img, x, y, drawWidth, drawHeight);

    exportCanvas.toBlob((blob) => {
      cleanup(blob);
    }, 'image/jpeg', 0.92);
  });

  render();
}
