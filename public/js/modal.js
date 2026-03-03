document.addEventListener("DOMContentLoaded", () => {
  const paymentOverlay = document.getElementById("paymentOverlay");
  const closeButton = document.getElementById("pmCloseBtn");
  const authReqCancel = document.getElementById("authReqCancel");

  function closeModal() {
    if (!paymentOverlay) return;

    paymentOverlay.classList.remove("active");

    const scrollY = parseInt(document.body.dataset.scrollY || '0');
    document.documentElement.classList.remove('modal-open');
    document.body.style.position = '';
    document.body.style.top = '';
    document.body.style.width = '';
    document.body.style.paddingRight = '';
    window.scrollTo(0, scrollY);

    setTimeout(() => {
      const mainModal = document.getElementById('paymentMainModal');
      const authModal = document.getElementById('authRequiredModal');
      if (mainModal) mainModal.style.display = '';
      if (authModal) authModal.style.display = 'none';
      if (mainModal) {
        mainModal.style.opacity = '';
        mainModal.style.transform = '';
      }
      if (authModal) {
        authModal.style.opacity = '';
        authModal.style.transform = '';
      }
    }, 300);
  }

  if (paymentOverlay) {
    paymentOverlay.addEventListener("click", (e) => {
      if (e.target === paymentOverlay) {
        closeModal();
      }
    });
  }

  if (closeButton) {
    closeButton.addEventListener("click", closeModal);
  }

  if (authReqCancel) {
    authReqCancel.addEventListener("click", closeModal);
  }
});
