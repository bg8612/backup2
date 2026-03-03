document.querySelector(".auth-form").addEventListener("submit", async (e) => {
  e.preventDefault();

  const name = document.getElementById("reg-name").value.trim();
  const email = document.getElementById("reg-email").value.trim();
  const password = document.getElementById("reg-password").value;
  const repeat = document.getElementById("reg-password-repeat").value;
  const error = document.querySelector(".auth-error-message");

  error.style.display = "none";

  if (name.length < 2) return show("Введите имя");
  if (password.length < 8) return show("Пароль слишком короткий");
  if (password !== repeat) return show("Пароли не совпадают");

  try {
    const res = await fetch("https://auth.axoshop.ru/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, password })
    });

    let data = {};
    try { data = await res.json(); } catch {}

    if (!res.ok) {
      return show(data.error || "Ошибка регистрации");
    }

    document.cookie = `authToken=${data.token}; path=/; max-age=604800`;
    localStorage.setItem("user", JSON.stringify(data.user));

    window.location.href = "/pages/profile.html#settings";

  } catch (err) {
    console.error(err);
    show("Ошибка соединения");
  }

  function show(msg) {
    error.textContent = msg;
    error.style.display = "block";
  }
});

const eyeSlashPath = "M20.4122 0.280684C20.7865 -0.0935045 21.3933 -0.0936182 21.7676 0.280684C22.1418 0.654996 22.1418 1.26179 21.7676 1.63615L2.59477 20.809C2.22039 21.1829 1.61354 21.1832 1.2393 20.809C0.864942 20.4347 0.864942 19.8269 1.2393 19.4526L4.70805 15.9838C3.19424 14.9273 1.75408 13.4987 0.39067 11.7045C-0.130158 11.0188 -0.130288 10.0696 0.39067 9.3842C3.66432 5.07633 7.37889 2.87552 11.5 2.87541C13.2759 2.87541 14.9767 3.28446 16.5987 4.09416L20.4122 0.280684ZM19.6827 6.19084C20.6938 7.0778 21.6701 8.14122 22.6094 9.37736C23.1301 10.0629 23.1301 11.0113 22.6094 11.6967C19.3357 16.0047 15.6214 18.2054 11.5 18.2055C10.3595 18.2055 9.24948 18.0378 8.17192 17.7026L10.6241 15.2504C10.9077 15.3027 11.2003 15.3305 11.4991 15.3305C14.146 15.3303 16.292 13.1836 16.292 10.5365C16.292 10.238 16.2642 9.94594 16.212 9.66252L19.6827 6.19084ZM11.4991 5.75139C8.85217 5.75156 6.70628 7.89747 6.7061 10.5444C6.7061 11.5223 6.99913 12.4326 7.502 13.1908L8.90532 11.7875C8.72481 11.4115 8.62309 10.9894 8.62309 10.5444C8.62327 8.95629 9.911 7.66856 11.4991 7.66838C11.9429 7.66838 12.3639 7.76904 12.7393 7.94865C12.7214 7.96653 12.704 7.98605 12.6875 8.00529L14.1456 6.54729C13.3873 6.04443 12.477 5.75139 11.4991 5.75139Z";
const eyePath = "M11.5 3C7.36 3 3.68 5.18 0.39 9.38C-0.13 10.07 -0.13 11.02 0.39 11.7C3.68 15.9 7.36 18.2 11.5 18.2C15.64 18.2 19.32 16 22.61 11.7C23.13 11.01 23.13 10.06 22.61 9.38C19.32 5.18 15.64 3 11.5 3ZM11.5 15.33C8.85 15.33 6.71 13.18 6.71 10.54C6.71 7.9 8.85 5.75 11.5 5.75C14.15 5.75 16.29 7.9 16.29 10.54C16.29 13.18 14.15 15.33 11.5 15.33ZM11.5 7.67C9.91 7.67 8.62 8.96 8.62 10.54C8.62 12.12 9.91 13.41 11.5 13.41C13.09 13.41 14.38 12.12 14.38 10.54C14.38 8.96 13.09 7.67 11.5 7.67Z";

document.querySelectorAll('.auth-password-toggle').forEach(btn => {
  btn.addEventListener('click', () => {
    const input = btn.closest('.auth-input-group').querySelector('input');
    const path = btn.querySelector('path');
    
    if (input.type === 'password') {
      input.type = 'text';
      path.setAttribute('d', eyePath);
    } else {
      input.type = 'password';
      path.setAttribute('d', eyeSlashPath);
    }
  });
});

const tgBtn = document.querySelector(".auth-social-btn");
if (tgBtn) {
  tgBtn.addEventListener("click", async () => {
    try {
      const res = await fetch("https://auth.axoshop.ru/api/social/telegram/register");
      const data = await res.json();
      if (data.link) {
        window.location.href = data.link;
      }
    } catch (err) {
      console.error("Telegram register error:", err);
    }
  });
}
