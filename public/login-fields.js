/** Clear login inputs and discourage browser autofill (index + admin login). */

function armPasswordField() {
  const pass = document.getElementById("passIn");
  if (!pass) return;

  pass.setAttribute("readonly", "readonly");
  const unlock = () => {
    pass.removeAttribute("readonly");
    pass.removeEventListener("focus", unlock);
    pass.removeEventListener("pointerdown", unlock);
  };
  pass.addEventListener("focus", unlock);
  pass.addEventListener("pointerdown", unlock);
}

export function clearLoginFields() {
  const email = document.getElementById("emailIn");
  const pass = document.getElementById("passIn");

  if (email) {
    email.value = "";
    email.defaultValue = "";
  }
  if (pass) {
    pass.value = "";
    pass.defaultValue = "";
    pass.type = "password";
  }

  armPasswordField();
}

export function initLoginFields(onValidate) {
  clearLoginFields();

  [0, 50, 250, 1000].forEach((ms) => {
    setTimeout(clearLoginFields, ms);
  });

  window.addEventListener("pageshow", (event) => {
    clearLoginFields();
    if (typeof onValidate === "function") onValidate();
  });

  const email = document.getElementById("emailIn");
  const pass = document.getElementById("passIn");
  email?.addEventListener("input", () => {
    if (typeof onValidate === "function") onValidate();
  });
  pass?.addEventListener("input", () => {
    if (typeof onValidate === "function") onValidate();
  });

  if (typeof onValidate === "function") onValidate();
}
