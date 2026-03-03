document.addEventListener("DOMContentLoaded", function () {
  const authForm = document.querySelector(".auth-form");
  const emailInput = document.getElementById("auth-email");
  const passwordInput = document.getElementById("auth-password");
  const toggleButton = document.querySelector(".auth-password-toggle");
  const submitButton = document.querySelector('.auth-actions button[type="submit"]');
  const errorDiv = document.querySelector(".auth-error-message");

  const openEyeIcon = `<svg width="23" height="15" viewBox="0 0 23 15" fill="none" xmlns="http://www.w3.org/2000/svg"><path fill-rule="evenodd" clip-rule="evenodd" d="M11.5 15C7.4076 15 3.6781 12.8066 0.311488 8.41965C-0.103829 7.87845 -0.103829 7.1214 0.311488 6.5802C3.67813 2.19343 7.40762 0 11.5 0C15.5924 0 19.3219 2.19345 22.6885 6.58035C23.1038 7.12155 23.1038 7.8786 22.6885 8.4198C19.3219 12.8066 15.5924 15 11.5 15ZM11.5 11.25C9.45205 11.25 7.7918 9.57105 7.7918 7.5C7.7918 5.42895 9.45205 3.75 11.5 3.75C13.548 3.75 15.2082 5.42895 15.2082 7.5C15.2082 9.57105 13.548 11.25 11.5 11.25Z" fill="#C5C5C5"/></svg>`;
  const closedEyeIcon = `<svg width="23" height="22" viewBox="0 0 23 22" fill="none" xmlns="http://www.w3.org/2000/svg"><path fill-rule="evenodd" clip-rule="evenodd" d="M20.4122 0.280684C20.7865 -0.0935045 21.3933 -0.0936182 21.7676 0.280684C22.1418 0.654996 22.1418 1.26179 21.7676 1.63615L2.59477 20.809C2.22039 21.1829 1.61354 21.1832 1.2393 20.809C0.864942 20.4347 0.864942 19.8269 1.2393 19.4526L4.70805 15.9838C3.19424 14.9273 1.75408 13.4987 0.39067 11.7045C-0.130158 11.0188 -0.130288 10.0696 0.39067 9.3842C3.66432 5.07633 7.37889 2.87552 11.5 2.87541C13.2759 2.87541 14.9767 3.28446 16.5987 4.09416L20.4122 0.280684ZM19.6827 6.19084C20.6938 7.0778 21.6701 8.14122 22.6094 9.37736C23.1301 10.0629 23.1301 11.0113 22.6094 11.6967C19.3357 16.0047 15.6214 18.2054 11.5 18.2055C10.3595 18.2055 9.24948 18.0378 8.17192 17.7026L10.6241 15.2504C10.9077 15.3027 11.2003 15.3305 11.4991 15.3305C14.146 15.3303 16.292 13.1836 16.292 10.5365C16.292 10.238 16.2642 9.94594 16.212 9.66252L19.6827 6.19084ZM11.4991 5.75139C8.85217 5.75156 6.70628 7.89747 6.7061 10.5444C6.7061 11.5223 6.99913 12.4326 7.502 13.1908L8.90532 11.7875C8.72481 11.4115 8.62309 10.9894 8.62309 10.5444C8.62327 8.95629 9.911 7.66856 11.4991 7.66838C11.9429 7.66838 12.3639 7.76904 12.7393 7.94865C12.7214 7.96653 12.704 7.98605 12.6875 8.00529L14.1456 6.54729C13.3873 6.04443 12.477 5.75139 11.4991 5.75139Z" fill="#C5C5C5"/></svg>`;

  toggleButton.addEventListener("click", () => {
    const hidden = passwordInput.type === "password";
    passwordInput.type = hidden ? "text" : "password";
    toggleButton.innerHTML = hidden ? openEyeIcon : closedEyeIcon;
  });

  const validateEmail = (email) =>
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  [emailInput, passwordInput].forEach((input) => {
    input.addEventListener("invalid", () => {
      input.closest(".auth-input-group").classList.add("error");
    });
    input.addEventListener("input", () => {
      input.closest(".auth-input-group").classList.remove("error");
    });
  });

  authForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    errorDiv.style.display = "none";
    errorDiv.textContent = "";

    let isValid = true;

    if (!validateEmail(emailInput.value)) {
      emailInput.closest(".auth-input-group").classList.add("error");
      isValid = false;
    }
    if (passwordInput.value.length < 8) {
      passwordInput.closest(".auth-input-group").classList.add("error");
      isValid = false;
    }

    if (!isValid) return;

    submitButton.disabled = true;

    try {
      const response = await fetch("https://auth.axoshop.ru/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          email: emailInput.value.trim(),
          password: passwordInput.value
        })
      });

      let data = {};
      try {
        data = await response.json();
      } catch {}

      if (!response.ok) {
        throw new Error(data.error || "Ошибка авторизации");
      }

      document.cookie = `authToken=${data.token}; path=/; max-age=604800`;

      window.location.href = "/pages/profile.html#settings";

    } catch (err) {
      console.error(err);
      errorDiv.textContent = err.message || "Ошибка соединения с сервером";
      errorDiv.style.display = "block";
      submitButton.disabled = false;
    }
  });

  const tgBtn = document.querySelector(".auth-social-btn");
  if (tgBtn) {
    tgBtn.addEventListener("click", async () => {
      try {
        const res = await fetch("https://auth.axoshop.ru/api/social/telegram/login");
        const data = await res.json();
        if (data.link) {
          window.location.href = data.link;
        }
      } catch (err) {
        console.error("Telegram login error:", err);
      }
    });
  }
});
