const db = firebase.database();
const input = document.getElementById('fileInput');
const canvas = document.getElementById('canvas');
const adminUID = "qxRlYIZQKhZBhjmxsMs34FWTfPK2";
let currentUserIsAdmin = false;

// Fonction pour gérer le déplacement de l'image
const handleDrag = (element, key, onMoveCallback) => {
  let offsetX, offsetY;

  const onMove = (e) => {
    const x = (e.touches ? e.touches[0].clientX : e.clientX) - offsetX;
    const y = (e.touches ? e.touches[0].clientY : e.clientY) - offsetY;
    onMoveCallback(x, y);
  };

  const onEnd = () => {
    const x = parseInt(element.style.left);
    const y = parseInt(element.style.top);
    db.ref("images/" + key).update({ x, y });
    window.removeEventListener('mousemove', onMove);
    window.removeEventListener('mouseup', onEnd);
    window.removeEventListener('touchmove', onMove);
    window.removeEventListener('touchend', onEnd);
  };

  const startDrag = (e) => {
    e.preventDefault();
    const startX = e.touches ? e.touches[0].clientX : e.clientX;
    const startY = e.touches ? e.touches[0].clientY : e.clientY;
    const rect = element.getBoundingClientRect();
    offsetX = startX - rect.left;
    offsetY = startY - rect.top;

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onEnd);
    window.addEventListener('touchmove', onMove);
    window.addEventListener('touchend', onEnd);
  };

  element.addEventListener('mousedown', startDrag);
  element.addEventListener('touchstart', startDrag);
};

input.addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;

  const formData = new FormData();
  formData.append("file", file);
  formData.append("upload_preset", "public-upload");

  const res = await fetch("https://api.cloudinary.com/v1_1/danbblbte/image/upload", {
    method: "POST",
    body: formData
  });

  const data = await res.json();
  const originalUrl = data.secure_url;
  const optimizedUrl = originalUrl.replace('/upload/', '/upload/w_200,h_200,c_fill,q_85,f_auto/');

  const x = Math.floor(Math.random() * (window.innerWidth - 150));
  const y = Math.floor(Math.random() * (window.innerHeight - 150));

  db.ref("images").push({ url: optimizedUrl, x, y });
});

firebase.auth().onAuthStateChanged((user) => {
  currentUserIsAdmin = user && user.uid === adminUID;
  document.getElementById("admin-options").style.display = currentUserIsAdmin ? "block" : "none";
  document.getElementById("logout-btn").style.display = currentUserIsAdmin ? "inline-block" : "none";
});

document.getElementById("email").addEventListener("keydown", handleLogin);
document.getElementById("password").addEventListener("keydown", handleLogin);

function handleLogin(event) {
  if (event.key === "Enter") {
    const email = document.getElementById("email").value;
    const pass = document.getElementById("password").value;
    firebase.auth().signInWithEmailAndPassword(email, pass)
      .catch(err => alert("Erreur : " + err.message));
  }
}

document.getElementById("logout-btn").addEventListener("click", () => {
  firebase.auth().signOut();
});

document.getElementById("reset-btn").addEventListener("click", () => {
  if (currentUserIsAdmin) db.ref("images").remove();
  else alert("Accès refusé.");
});

// Optimisation du rafraîchissement du mur d'images
db.ref("images").on("value", (snapshot) => {
  canvas.innerHTML = "";  // Clear the canvas

  const images = snapshot.val();
  if (!images) return;

  // Préparer les éléments à ajouter dans le DOM en une seule fois
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
      delBtn.textContent = "🗑️";
      delBtn.style.position = "absolute";
      delBtn.style.top = "0";
      delBtn.style.left = "0";
      delBtn.onclick = () => db.ref("images/" + key).remove();
      wrapper.appendChild(delBtn);

      // Ajout de la gestion du déplacement
      handleDrag(wrapper, key, (x, y) => {
        wrapper.style.left = `${x}px`;
        wrapper.style.top = `${y}px`;
      });
    }

    fragment.appendChild(wrapper);
  });

  // Ajouter toutes les images en une fois au DOM
  canvas.appendChild(fragment);
});
