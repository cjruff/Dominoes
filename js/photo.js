// Moe's Dominoes — player photos from the camera or a file
// Code: © Corey J Ruff
//
// The picture is shrunk in the browser to a 320×320 square (cropped from the
// centre, a little high to favour faces) and kept as a ~30–50 KB JPEG, so it
// never bloats saved data no matter how big the original photo was.
//
// Phone notes: the file picker is attached to the page and kept alive while the
// camera is open (iPhone Safari can drop a detached picker and never report the
// photo), and decoding tries two different methods.

const SIZE = 320;
let picker = null; // kept referenced while the camera / library is open

/** Ask for a photo (phones offer the camera or the photo library). Resolves to a data URL or null. */
export function pickPhoto() {
  return new Promise((resolve) => {
    if (picker) picker.remove();
    const inp = document.createElement('input');
    inp.type = 'file';
    inp.accept = 'image/*';
    inp.style.cssText = 'position:fixed;left:-1000px;top:0;width:1px;height:1px;opacity:0';
    document.body.appendChild(inp);
    picker = inp;
    let done = false;
    const finish = (v) => { if (done) return; done = true; inp.remove(); if (picker === inp) picker = null; resolve(v); };
    const onPicked = async () => {
      const f = inp.files && inp.files[0];
      if (!f) return finish(null);
      showBusy(true);
      try { finish(await shrink(f)); } catch (e) {
        alert('Sorry, that picture couldn’t be read. Try a JPEG or PNG, or pick it from your photo library.');
        finish(null);
      } finally { showBusy(false); }
    };
    inp.addEventListener('change', onPicked);
    inp.addEventListener('input', onPicked);
    inp.click();
  });
}

function showBusy(on) {
  let b = document.getElementById('photoBusy');
  if (on && !b) {
    b = document.createElement('div');
    b.id = 'photoBusy';
    b.textContent = 'Adding photo…';
    b.style.cssText = 'position:fixed;left:50%;top:40%;transform:translate(-50%,-50%);z-index:2000;padding:12px 20px;border-radius:24px;background:rgba(0,0,0,.8);color:#f6f0e1;font-weight:700';
    document.body.appendChild(b);
  } else if (!on && b) b.remove();
}

/** Decode with createImageBitmap (respects camera rotation) or fall back to an <img>. */
async function decode(file) {
  if (window.createImageBitmap) {
    try { return await createImageBitmap(file, { imageOrientation: 'from-image' }); } catch { /* fall back */ }
  }
  const dataUrl = await new Promise((res, rej) => {
    const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(file);
  });
  return new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = dataUrl; });
}

async function shrink(file) {
  const img = await decode(file);
  const w = img.naturalWidth || img.width, h = img.naturalHeight || img.height;
  if (!w || !h) throw new Error('empty image');
  const side = Math.min(w, h);
  const sx = (w - side) / 2;
  const sy = Math.max(0, (h - side) * 0.3); // tall photos: keep the top (faces)
  const c = document.createElement('canvas');
  c.width = c.height = SIZE;
  const g = c.getContext('2d');
  g.imageSmoothingQuality = 'high';
  g.drawImage(img, sx, sy, side, side, 0, 0, SIZE, SIZE);
  if (img.close) img.close();
  const out = c.toDataURL('image/jpeg', 0.8);
  if (!out.startsWith('data:image/jpeg')) throw new Error('encode failed');
  return out;
}
