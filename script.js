// ------------------------------------------
// Initialisation Firebase & DOM
// ------------------------------------------
const db = firebase.database();
const input = document.getElementById('fileInput');
const canvas = document.getElementById('canvas');
const adminUID = "ueB79EZRrzedLgZZpVOSsj453hs1";
let currentUserIsAdmin = false;

// ------------------------------------------
// Scroll Lock selon statut admin
// ------------------------------------------
const setScrollLock = (isAdmin) => {
  const html = document.documentElement;
  const body = document.body;

  html.style.overflow = 'auto';
  body.style.overflow = 'auto';
  body.style.position = 'static';
  body.style.touchAction = 'auto';
};


// ------------------------------------------
// Gestion Drag & Drop (admin uniquement)
// ------------------------------------------
const handleDrag = (element, key, onMoveCallback) => {
  let offsetX, offsetY;

  const onMove = (e) => {
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    const x = clientX - offsetX;
    const y = clientY - offsetY;
    element.style.left = `${x}px`;
    element.style.top = `${y}px`;
  };

  const onEnd = () => {
    const x = parseInt(element.style.left);
    const y = parseInt(element.style.top);
    db.ref("images/" + key).update({ x, y });

    window.removeEventListener("mousemove", onMove);
    window.removeEventListener("mouseup", onEnd);
    window.removeEventListener("touchmove", onMove);
    window.removeEventListener("touchend", onEnd);
  };

  const startDrag = (e) => {
    e.preventDefault();
    const startX = e.touches ? e.touches[0].clientX : e.clientX;
    const startY = e.touches ? e.touches[0].clientY : e.clientY;
    const rect = element.getBoundingClientRect();
    offsetX = startX - rect.left;
    offsetY = startY - rect.top;

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onEnd);
    window.addEventListener("touchmove", onMove);
    window.addEventListener("touchend", onEnd);
  };

  element.addEventListener("mousedown", startDrag);
  element.addEventListener("touchstart", startDrag);
};

// ------------------------------------------
// Utilitaires : hash, compression, doublons
// ------------------------------------------
const getImageHash = async (blob) => {
  const buffer = await blob.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
};

const compressImage = async (file) => {
  const imageBitmap = await createImageBitmap(file);
  const ratio = Math.min(800 / imageBitmap.width, 800 / imageBitmap.height, 1);

  const canvasTmp = document.createElement('canvas');
  canvasTmp.width = imageBitmap.width * ratio;
  canvasTmp.height = imageBitmap.height * ratio;
  canvasTmp.getContext('2d').drawImage(imageBitmap, 0, 0, canvasTmp.width, canvasTmp.height);

  return new Promise(resolve => canvasTmp.toBlob(resolve, 'image/jpeg', 0.7));
};

const isDuplicate = async (hash) => {
  const snapshot = await db.ref("images").once("value");
  const images = snapshot.val();
  if (!images) return false;

  for (const [key, img] of Object.entries(images)) {
    if (img.hash === hash) {
      try {
        const response = await fetch(img.url + "?t=" + Date.now(), { method: "HEAD" });
        if (response.ok) return true;
        await db.ref("images/" + key).remove();
      } catch {
        await db.ref("images/" + key).remove();
      }
    }
  }
  return false;
};

// ------------------------------------------
// Upload image + anti-doublon
// ------------------------------------------
input.addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;

  const blob = await compressImage(file);
  const hash = await getImageHash(blob);
  if (await isDuplicate(hash)) return;

  const formData = new FormData();
  formData.append("file", blob);
  formData.append("upload_preset", "public-upload");

  const res = await fetch("https://api.cloudinary.com/v1_1/dwmbnxn5q/image/upload", { method: "POST", body: formData });
  const data = await res.json();
  const optimizedUrl = data.secure_url.replace('/upload/', '/upload/w_200,q_85,f_auto/');

  const x = Math.floor(Math.random() * (window.innerWidth - 150));
  const y = Math.floor(Math.random() * (window.innerHeight - 150));
  db.ref("images").push({ url: optimizedUrl, x, y, hash, timestamp: Date.now() });
});

// ------------------------------------------
// Authentification & gestion interface admin
// ------------------------------------------
firebase.auth().onAuthStateChanged(user => {
  currentUserIsAdmin = user && user.uid === adminUID;
  setScrollLock(currentUserIsAdmin);
  document.getElementById("admin-options").style.display = currentUserIsAdmin ? "block" : "none";
  document.getElementById("logout-btn").style.display = currentUserIsAdmin ? "inline-block" : "none";
});

document.getElementById("email").addEventListener("keydown", (e) => {
  if (e.key === "Enter") firebase.auth().signInWithEmailAndPassword(
    document.getElementById("email").value,
    document.getElementById("password").value
  ).catch(err => alert("Erreur : " + err.message));
});

document.getElementById("password").addEventListener("keydown", (e) => {
  if (e.key === "Enter") document.getElementById("email").dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
});

document.getElementById("logout-btn").addEventListener("click", () => firebase.auth().signOut());
document.getElementById("reset-btn").addEventListener("click", () => {
  if (currentUserIsAdmin) db.ref("images").remove();
  else alert("Accès refusé.");
});

// ------------------------------------------
// Rendu dynamique du mur avec auto-contrôle
// ------------------------------------------
db.ref("images").on("value", (snapshot) => {
  canvas.innerHTML = "";
  const images = snapshot.val();
  if (!images) return;

  const fragment = document.createDocumentFragment();

  Object.entries(images).forEach(([key, img]) => {
    const wrapper = document.createElement("div");
    wrapper.style.position = "absolute";
    wrapper.style.left = `${img.x}px`;
    wrapper.style.top = `${img.y}px`;
    wrapper.style.touchAction = "none";

    const el = document.createElement("img");
    el.src = img.url + "?t=" + Date.now();
    el.loading = "lazy";
    el.onerror = () => {
      console.log("Image supprimée de Cloudinary, suppression :", img.url);
      wrapper.remove();
      db.ref("images/" + key).remove();
    };
    wrapper.appendChild(el);

    if (currentUserIsAdmin) {
      const delBtn = document.createElement("button");
      delBtn.textContent = "X";
      delBtn.classList.add("delete-btn");

      delBtn.addEventListener('click', () => db.ref("images/" + key).remove());
      delBtn.addEventListener('touchstart', (e) => {
        e.preventDefault();
        db.ref("images/" + key).remove();
      }, { passive: false });

      wrapper.appendChild(delBtn);

      handleDrag(wrapper, key);
    }

    fragment.appendChild(wrapper);
  });

  canvas.appendChild(fragment);
});