const db = firebase.database();
const input = document.getElementById('fileInput');
const canvas = document.getElementById('canvas');
const adminUID = "qxRlYIZQKhZBhjmxsMs34FWTfPK2";
let currentUserIsAdmin = false;

// --- DRAG & DROP LOGIC ---
const handleDrag = (element, key, onMoveCallback) => {
  let offsetX, offsetY;

  const onMove = (e) => {
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    onMoveCallback(clientX - offsetX, clientY - offsetY);
  };

  const onEnd = () => {
    db.ref("images/" + key).update({
      x: parseInt(element.style.left),
      y: parseInt(element.style.top)
    });
    ["mousemove", "mouseup", "touchmove", "touchend"].forEach(event =>
      window.removeEventListener(event, onMove)
    );
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

// --- IMAGE UPLOAD + COMPRESSION + ANTI-DOUBLON ---
async function getImageHash(blob) {
  const buffer = await blob.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  return Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, '0')).join('');
}

async function compressImage(file) {
  const imageBitmap = await createImageBitmap(file);
  const maxSize = 800;
  const ratio = Math.min(maxSize / imageBitmap.width, maxSize / imageBitmap.height, 1);

  const canvasTmp = document.createElement('canvas');
  canvasTmp.width = imageBitmap.width * ratio;
  canvasTmp.height = imageBitmap.height * ratio;
  canvasTmp.getContext('2d').drawImage(imageBitmap, 0, 0, canvasTmp.width, canvasTmp.height);

  return new Promise(resolve => canvasTmp.toBlob(resolve, 'image/jpeg', 0.7));
}

async function isDuplicate(hash) {
  const snapshot = await db.ref("images").once("value");
  const images = snapshot.val();
  return images && Object.values(images).some(img => img.hash === hash);
}

input.addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;

  const blob = await compressImage(file);
  const hash = await getImageHash(blob);
  if (await isDuplicate(hash)) {
    alert("Cette image a déjà été envoyée.");
    return;
  }

  const formData = new FormData();
  formData.append("file", blob);
  formData.append("upload_preset", "public-upload");

  const res = await fetch("https://api.cloudinary.com/v1_1/danbblbte/image/upload", {
    method: "POST",
    body: formData
  });
  const data = await res.json();
  const optimizedUrl = data.secure_url.replace('/upload/', '/upload/w_200,h_200,c_fill,q_85,f_auto/');

  const x = Math.floor(Math.random() * (window.innerWidth - 150));
  const y = Math.floor(Math.random() * (window.innerHeight - 150));

  db.ref("images").push({ url: optimizedUrl, x, y, hash });
});

// --- AUTHENTIFICATION ---
firebase.auth().onAuthStateChanged(user => {
  currentUserIsAdmin = user && user.uid === adminUID;
  document.getElementById("admin-options").style.display = currentUserIsAdmin ? "block" : "none";
  document.getElementById("logout-btn").style.display = currentUserIsAdmin ? "inline-block" : "none";
});

function handleLogin(event) {
  if (event.key === "Enter") {
    const email = document.getElementById("email").value;
    const pass = document.getElementById("password").value;
    firebase.auth().signInWithEmailAndPassword(email, pass)
      .catch(err => alert("Erreur : " + err.message));
  }
}

document.getElementById("email").addEventListener("keydown", handleLogin);
document.getElementById("password").addEventListener("keydown", handleLogin);
document.getElementById("logout-btn").addEventListener("click", () => firebase.auth().signOut());

document.getElementById("reset-btn").addEventListener("click", () => {
  if (currentUserIsAdmin) db.ref("images").remove();
  else alert("Accès refusé.");
});

// --- RENDER DU MUR D'IMAGES ---
db.ref("images").on("value", (snapshot) => {
  canvas.innerHTML = "";
  const images = snapshot.val();
  if (!images) return;

  const fragment = document.createDocumentFragment();

  Object.entries(images).forEach(([key, img]) => {
    const wrapper = document.createElement("div");
    wrapper.style.position = "absolute";
    wrapper.style.left = img.x + "px";
    wrapper.style.top = img.y + "px";
    wrapper.style.touchAction = "none";

    const el = document.createElement("img");
    el.src = img.url;
    el.loading = "lazy";
    wrapper.appendChild(el);

    if (currentUserIsAdmin) {
      const delBtn = document.createElement("button");
      delBtn.textContent = "Suppr";
      delBtn.style.position = "absolute";
      delBtn.style.top = "0";
      delBtn.style.left = "0";
      delBtn.onclick = () => db.ref("images/" + key).remove();
      wrapper.appendChild(delBtn);

      handleDrag(wrapper, key, (x, y) => {
        wrapper.style.left = `${x}px`;
        wrapper.style.top = `${y}px`;
      });
    }

    fragment.appendChild(wrapper);
  });

  canvas.appendChild(fragment);
});
