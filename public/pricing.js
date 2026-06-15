import { auth, db } from "./firebase-config.js";
import { createUserWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import {
  doc,
  setDoc,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { loadSubscriptionConfig } from "./subscription-service.js";

const loader = document.getElementById("loader");
const pricingScreen = document.getElementById("pricingScreen");
const plansList = document.getElementById("plansList");
const districtModal = document.getElementById("districtModal");
const districtsList = document.getElementById("districtsList");
const districtHint = document.getElementById("districtHint");
const confirmBtn = document.getElementById("confirmBtn");
const errorMsg = document.getElementById("errorMsg");
const modalError = document.getElementById("modalError");

let PLANS = [];
let DISTRICT_OPTIONS = [];
let selectedPlan = null;
const selectedDistricts = new Set();

function redirect(path) {
  window.location.replace(path);
}

function formatPrice(price) {
  return `${Number(price).toLocaleString("fr-DZ")} DA`;
}

function renderPlans() {
  if (!PLANS.length) {
    plansList.innerHTML =
      '<p class="error-msg">لا توجد خطط متاحة حالياً. يرجى المحاولة لاحقاً.</p>';
    return;
  }

  plansList.innerHTML = PLANS.map((plan) => {
    const popular = plan.mostPopular
      ? `<span class="plan-popular-badge">الأكثر شعبية</span>`
      : "";
    const features = plan.features.map((f) => `<li>${f}</li>`).join("");

    return `
      <article class="plan-card${plan.mostPopular ? " popular" : ""}">
        ${popular}
        <h3>${plan.name}</h3>
        <div class="plan-subtitle">${plan.subtitle}</div>
        <div class="plan-price">
          ${formatPrice(plan.price)}
          <small>دفعة واحدة / دائم</small>
        </div>
        <ul class="plan-features">${features}</ul>
        <button type="button" class="plan-choose-btn" data-plan-id="${plan.id}">
          اختر هذه الخطة
        </button>
      </article>
    `;
  }).join("");

  plansList.querySelectorAll(".plan-choose-btn").forEach((btn) => {
    btn.addEventListener("click", () => openDistrictStep(btn.dataset.planId));
  });
}

function openDistrictStep(planId) {
  selectedPlan = PLANS.find((p) => p.id === planId) || null;
  if (!selectedPlan) return;

  selectedDistricts.clear();
  errorMsg.textContent = "";
  modalError.textContent = "";

  if (selectedPlan.maxDistricts >= DISTRICT_OPTIONS.length) {
    DISTRICT_OPTIONS.forEach((d) => selectedDistricts.add(d.id));
    continueToPayment();
    return;
  }

  districtHint.textContent = `بناءً على خطة «${selectedPlan.name}»، اختر ${selectedPlan.maxDistricts} ${selectedPlan.maxDistricts === 1 ? "سوقاً" : "أسواقاً"} أدناه.`;
  renderDistricts();
  districtModal.classList.remove("hidden");
  validateModal();
}

function renderDistricts() {
  districtsList.innerHTML = DISTRICT_OPTIONS.map(
    (d) => `
      <label class="district-item" data-district-id="${d.id}">
        <input type="checkbox" value="${d.id}" />
        <span>${d.emoji}</span>
        <span>${d.name}</span>
      </label>
    `,
  ).join("");

  districtsList.querySelectorAll(".district-item").forEach((el) => {
    el.addEventListener("click", (e) => {
      e.preventDefault();
      toggleDistrict(el.dataset.districtId);
    });
  });

  syncDistrictUI();
}

function toggleDistrict(districtId) {
  if (!selectedPlan) return;

  if (selectedDistricts.has(districtId)) {
    selectedDistricts.delete(districtId);
  } else if (selectedDistricts.size < selectedPlan.maxDistricts) {
    selectedDistricts.add(districtId);
  }

  syncDistrictUI();
  validateModal();
}

function syncDistrictUI() {
  const atMax =
    selectedPlan && selectedDistricts.size >= selectedPlan.maxDistricts;

  districtsList.querySelectorAll(".district-item").forEach((el) => {
    const id = el.dataset.districtId;
    const isSelected = selectedDistricts.has(id);
    el.classList.toggle("selected", isSelected);
    el.classList.toggle("disabled", !isSelected && atMax);
    const input = el.querySelector("input");
    if (input) input.checked = isSelected;
  });
}

function validateModal() {
  const ok =
    selectedPlan &&
    selectedDistricts.size > 0 &&
    selectedDistricts.size <= selectedPlan.maxDistricts;
  confirmBtn.disabled = !ok;
}

async function continueToPayment() {
  if (!selectedPlan || selectedDistricts.size === 0) {
    modalError.textContent = "يرجى اختيار سوق واحد على الأقل.";
    return;
  }

  const districts = DISTRICT_OPTIONS.filter((d) =>
    selectedDistricts.has(d.id),
  ).map(({ id, name, emoji }) => ({ id, name, emoji }));

  const pendingEmail = sessionStorage.getItem("pendingEmail");
  const pendingPassword = sessionStorage.getItem("pendingPassword");
  const pendingUsername = sessionStorage.getItem("pendingUsername") || "";
  const pendingFullName = sessionStorage.getItem("pendingFullName") || "";
  const pendingPhone = sessionStorage.getItem("pendingPhone") || "-";
  const pendingDob = sessionStorage.getItem("pendingDob") || "";

  if (!pendingEmail || !pendingPassword) {
    redirect("index.html");
    return;
  }

  if (confirmBtn) confirmBtn.disabled = true;
  modalError.textContent = "";

  try {
    const cred = await createUserWithEmailAndPassword(
      auth,
      pendingEmail,
      pendingPassword,
    );
    const uid = cred.user.uid;

    const normalizedPhone = /^\d+$/.test(String(pendingPhone))
      ? Number(pendingPhone)
      : pendingPhone;

    await setDoc(doc(db, "users", uid), {
      email: pendingEmail,
      username: pendingUsername,
      fullName: pendingFullName,
      phone: normalizedPhone,
      dob: pendingDob,
      role: "user",
      status: "pending",
      requestedPlan: selectedPlan.id,
      requestedPlanName: selectedPlan.name,
      requestedPrice: Number(selectedPlan.price),
      requestedDistricts: districts,
      created_at: serverTimestamp(),
      updated_at: serverTimestamp(),
    });

    [
      "pendingEmail",
      "pendingPassword",
      "pendingUsername",
      "pendingFullName",
      "pendingPhone",
      "pendingDob",
    ].forEach((k) => sessionStorage.removeItem(k));

    sessionStorage.setItem("finalPlanId", selectedPlan.id);
    sessionStorage.setItem("finalPrice", String(selectedPlan.price));
    sessionStorage.setItem("finalPlanName", selectedPlan.name);
    sessionStorage.setItem("finalDistricts", JSON.stringify(districts));

    redirect("payment.html");
  } catch (err) {
    console.error("Account creation error:", err);
    modalError.textContent = "تعذر إنشاء الحساب، يرجى المحاولة مرة أخرى.";
    if (confirmBtn) confirmBtn.disabled = false;
  }
}

async function initPricingPage() {
  try {
    const config = await loadSubscriptionConfig();
    PLANS = config.plans;
    DISTRICT_OPTIONS = config.districts;
    renderPlans();
  } catch (err) {
    console.error("Pricing init error:", err);
    errorMsg.textContent = "تعذر تحميل خطط الاشتراك.";
  }

  confirmBtn.addEventListener("click", continueToPayment);
  districtModal.addEventListener("click", (e) => {
    if (e.target === districtModal) districtModal.classList.add("hidden");
  });
  loader.classList.add("hidden");
  pricingScreen.classList.remove("hidden");
}

// No authentication gate here: the Auth account doesn't exist yet at
// this point in the flow. Instead, make sure the user actually went
// through registration steps 1 & 2 (their pending signup data must be
// present in sessionStorage) before letting them pick a plan.
const pendingEmail = sessionStorage.getItem("pendingEmail");
const pendingPassword = sessionStorage.getItem("pendingPassword");
if (!pendingEmail || !pendingPassword) {
  redirect("index.html");
} else {
  initPricingPage();
}
