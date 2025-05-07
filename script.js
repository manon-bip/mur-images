const db = firebase.database();
const input = document.getElementById('fileInput');
const canvas = document.getElementById('canvas');

let currentUserIsAdmin = false;
// 🔐 Remplace ceci par ton propre UID d'admin (trouvé dans Firebase Auth > utilisateur connecté)
const adminUID = "qxRlYIZQKhZBhjmxsMs34FWTfPK2";

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
  const imageUrl = data.secure_url;

  const x = Math.floor(Math.random() * (window.innerWidth - 150));
  const y = Math.floor(Math.random() * (window.innerHeight - 150));

  db.ref("images").push({ url: imageUrl, x, y });
});

firebase.auth().onAuthStateChanged((user) => {
  if (user && user.uid === adminUID) {
    currentUserIsAdmin = true;
    document.getElementById("admin-options").style.display = "block";
    document.getElementById("logout-btn").style.display = "inline-block";
    document.getElementById("login-btn").style.display = "none";
  } else {
    currentUserIsAdmin = false;
    document.getElementById("admin-options").style.display = "none";
    document.getElementById("logout-btn").style.display = "none";
    document.getElementById("login-btn").style.display = "inline-block";
  }
});

document.getElementById("login-btn").addEventListener("click", () => {
  const email = document.getElementById("email").value;
  const pass = document.getElementById("password").value;
  firebase.auth().signInWithEmailAndPassword(email, pass)
    .catch(err => alert("Erreur : " + err.message));
});

document.getElementById("logout-btn").addEventListener("click", () => {
  firebase.auth().signOut();
});

document.getElementById("reset-btn").addEventListener("click", () => {
  if (currentUserIsAdmin) {
    db.ref("images").remove();
  } else {
    alert("Accès refusé.");
  }
});

db.ref("images").on("value", (snapshot) => {
  canvas.innerHTML = "";
  const images = snapshot.val();
  if (!images) return;

  Object.entries(images).forEach(([key, img]) => {
    const wrapper = document.createElement("div");
    wrapper.style.position = "absolute";
    wrapper.style.left = img.x + "px";
    wrapper.style.top = img.y + "px";

    const el = document.createElement("img");
    el.src = img.url;
    wrapper.appendChild(el);

    if (currentUserIsAdmin) {
      const delBtn = document.createElement("button");
      delBtn.textContent = "🗑️";
      delBtn.onclick = () => db.ref("images/" + key).remove();
      wrapper.appendChild(delBtn);
    }

    canvas.appendChild(wrapper);
  });
});
