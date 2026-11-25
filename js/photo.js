// Moe's Dominoes — player photos from the camera or a file
// Code: © Corey J Ruff
//
// The picture is shrunk in the browser to a 320×320 square (cropped from the
// centre, a little high to favour faces) and kept as a ~30–50 KB JPEG, so it
// never bloats saved data no matter how big the original photo was.

const SIZE = 320;

/** Ask for a photo (phones offer the camera or the photo library). Resolves to a data URL or null. */
export function pickPhoto() {
  return new Promise((resolve) => {
    const inp = document.createElement('input');
    inp.type = 'file';
    inp.accept = 'image/*';
    inp.onchange = async () => {
      const f = inp.files && inp.files[0];
      if (!f) return resolve(null);
      try { resolve(await shrink(f)); } catch { alert('Sorry, that picture couldn’t be read.'); resolve(null); }
    };
    inp.click();
  });
}

async function shrink(file) {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; });
    const side = Math.min(img.naturalWidth, img.naturalHeight);
    const sx = (img.naturalWidth - side) / 2;
    const sy = Math.max(0, (img.naturalHeight - side) * 0.3); // tall photos: keep the top (faces)
    const c = document.createElement('canvas');
    c.width = c.height = SIZE;
    const g = c.getContext('2d');
    g.imageSmoothingQuality = 'high';
    g.drawImage(img, sx, sy, side, side, 0, 0, SIZE, SIZE);
    return c.toDataURL('image/jpeg', 0.8);
  } finally { URL.revokeObjectURL(url); }
}
