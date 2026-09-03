function sanitizeFilename(value) {
  return String(value || 'railway')
    .trim()
    .replace(/[^a-z0-9]+/gi, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase() || 'railway';
}

function timestamp(date = new Date()) {
  const pad = (value) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
}

function canvasBlob(canvas) {
  return new Promise((resolve, reject) => {
    try {
      canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('canvas-blob-unavailable')), 'image/png');
    } catch (error) {
      reject(error);
    }
  });
}

export async function captureCanvasToPng(canvas, worldName) {
  if (!canvas?.width || !canvas?.height) return { ok: false, error: 'canvas-unavailable' };
  const name = `${sanitizeFilename(worldName)}-${timestamp()}.png`;
  let blob;
  try {
    blob = await canvasBlob(canvas);
  } catch (error) {
    return { ok: false, error: error?.message || 'capture-failed' };
  }

  if (window.showSaveFilePicker) {
    try {
      const handle = await window.showSaveFilePicker({
        suggestedName: name,
        types: [{ description: 'PNG image', accept: { 'image/png': ['.png'] } }],
      });
      const writable = await handle.createWritable();
      await writable.write(blob);
      await writable.close();
      return { ok: true, name: handle.name };
    } catch (error) {
      if (error?.name === 'AbortError') return { ok: false, cancelled: true };
    }
  }

  const url = URL.createObjectURL(blob);
  try {
    const link = document.createElement('a');
    link.href = url;
    link.download = name;
    document.body.appendChild(link);
    link.click();
    link.remove();
    return { ok: true, name };
  } catch (error) {
    return { ok: false, error: error?.message || 'download-failed' };
  } finally {
    window.setTimeout(() => URL.revokeObjectURL(url), 5000);
  }
}
