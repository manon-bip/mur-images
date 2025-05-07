const db = firebase.database();
const input = document.getElementById('fileInput');
const canvas = document.getElementById('canvas');

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

db.ref("images").on("value", (snapshot) => {
  canvas.innerHTML = "";
  const images = snapshot.val();
  if (!images) return;

  Object.values(images).forEach(img => {
    const el = document.createElement("img");
    el.src = img.url;
    el.style.left = img.x + "px";
    el.style.top = img.y + "px";
    canvas.appendChild(el);
  });
});
