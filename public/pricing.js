import { auth } from "./firebase-config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
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

function continueToPayment() {
  if (!selectedPlan || selectedDistricts.size === 0) {
    modalError.textContent = "يرجى اختيار سوق واحد على الأقل.";
    return;
  }

  const districts = DISTRICT_OPTIONS.filter((d) =>
    selectedDistricts.has(d.id),
  ).map(({ id, name, emoji }) => ({ id, name, emoji }));

  localStorage.setItem("finalPlanId", selectedPlan.id);
  localStorage.setItem("finalPrice", String(selectedPlan.price));
  localStorage.setItem("finalPlanName", selectedPlan.name);
  localStorage.setItem("finalDistricts", JSON.stringify(districts));

  redirect("payment.html");
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

// The Auth account is created on the registration page (step 2, "choose
// your plan" button) before redirecting here. Firebase Auth persistence
// (IndexedDB/localStorage) can take a brief moment to settle after a full
// page navigation on a freshly-deployed (non-localhost) origin, so
// onAuthStateChanged may fire once with `user = null` immediately after
// arriving here even though the account was just created successfully.
//
// To avoid bouncing the user back to index.html in that case, we wait for
// a short grace period and re-check auth.currentUser before giving up.
let authCheckResolved = false;

onAuthStateChanged(auth, (user) => {
  if (authCheckResolved) return;

  if (user) {
    authCheckResolved = true;
    console.log("Active user verified on pricing:", user.uid);
    initPricingPage();
    return;
  }

  // No user on the first callback — give Firebase a brief moment to
  // restore the session before redirecting away.
  setTimeout(() => {
    if (authCheckResolved) return;
    if (auth.currentUser) {
      authCheckResolved = true;
      console.log(
        "Active user verified on pricing (after grace period):",
        auth.currentUser.uid,
      );
      initPricingPage();
    } else {
      authCheckResolved = true;
      console.warn("No user active on pricing, fallback to index");
      window.location.replace("index.html");
    }
  }, 1200);
});
