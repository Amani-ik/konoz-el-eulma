import { auth, db } from "./firebase-config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import {
  doc,
  setDoc,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { loadSubscriptionConfig } from "./subscription-service.js";

const IMGBB_API_KEY = "29196fd8a8c93bfe9a10588fdf414372";
const IMGBB_UPLOAD_URL = "https://api.imgbb.com/1/upload";

const SESSION_KEYS = [
  "finalPlanId",
  "finalPrice",
  "finalPlanName",
  "finalDistricts",
  "pendingEmail",
  "pendingPassword",
  "pendingUsername",
  "pendingFullName",
  "pendingPhone",
  "pendingDob",
];

const loader = document.getElementById("loader");
const paymentScreen = document.getElementById("paymentScreen");
const awaitingScreen = document.getElementById("awaitingScreen");
const summaryPlan = document.getElementById("summaryPlan");
const summaryPrice = document.getElementById("summaryPrice");
const summaryDistricts = document.getElementById("summaryDistricts");
const dropzone = document.getElementById("dropzone");
const receiptInput = document.getElementById("receiptInput");
const previewImg = document.getElementById("previewImg");
const submitBtn = document.getElementById("submitBtn");
const submitLabel = document.getElementById("submitLabel");
const errorMsg = document.getElementById("errorMsg");
const progressWrap = document.getElementById("progressWrap");
const progressFill = document.getElementById("progressFill");
const progressFile = document.getElementById("progressFile");
const progressPct = document.getElementById("progressPct");
const otherMethodsToggle = document.getElementById("otherMethodsToggle");
const otherMethodsPanel = document.getElementById("otherMethodsPanel");

let planLabels = {};
let selectedFile = null;
let checkoutData = null;

function redirect(path) {
  window.location.replace(path);
}

function parseDistricts(raw) {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function districtLabel(item) {
  if (item == null) return "";
  if (typeof item === "string") return item;
  return item.name || item.label || item.id || String(item);
}

function planLabel(planId) {
  return (
    planLabels[planId] ||
    localStorage.getItem("finalPlanName") ||
    planId ||
    "—"
  );
}

function formatPrice(price) {
  const n = Number(price);
  if (!Number.isFinite(n)) return "—";
  return `${n.toLocaleString("fr-DZ")} DA`;
}

function clearCheckoutSession() {
  SESSION_KEYS.forEach((k) => localStorage.removeItem(k));
}

function readCheckoutSession() {
  const finalPlanId = localStorage.getItem("finalPlanId");
  if (!finalPlanId) return null;
  return {
    finalPlanId,
    finalPlanName: localStorage.getItem("finalPlanName") || "",
    finalPrice: localStorage.getItem("finalPrice") || "0",
    finalDistricts: parseDistricts(localStorage.getItem("finalDistricts")),
  };
}

function showScreen(screen) {
  loader.classList.add("hidden");
  paymentScreen.classList.toggle("hidden", screen !== "payment");
  awaitingScreen.classList.toggle("hidden", screen !== "awaiting");
}

function renderPaymentDetails(payment) {
  document.getElementById("ccpNumber").textContent = payment.ccp || "—";
  document.getElementById("baridiRip").textContent = payment.baridimob || "—";
  document.getElementById("accountHolder").textContent = payment.holder || "—";

  const redotpayEl = document.getElementById("redotpayId");
  if (redotpayEl) {
    redotpayEl.textContent = payment.redotpay || "—";
  }
}

function renderSummary(data) {
  summaryPlan.textContent = data.finalPlanName || planLabel(data.finalPlanId);
  summaryPrice.textContent = formatPrice(data.finalPrice);

  const districts = data.finalDistricts.map(districtLabel).filter(Boolean);
  summaryDistricts.innerHTML = districts.length
    ? districts
        .map((d) => `<span class="chip">${escapeHtml(d)}</span>`)
        .join("")
    : `<span class="chip">—</span>`;
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function bindCopyButtons() {
  document.querySelectorAll(".copy-btn").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const target = document.getElementById(btn.dataset.copy);
      if (!target) return;
      try {
        await navigator.clipboard.writeText(target.textContent.trim());
        btn.classList.add("copied");
        btn.textContent = "✓";
        setTimeout(() => {
          btn.classList.remove("copied");
          btn.textContent = "⧉";
        }, 1500);
      } catch {
        errorMsg.textContent = "تعذر نسخ النص.";
      }
    });
  });
}

function bindOtherMethodsToggle() {
  if (!otherMethodsToggle || !otherMethodsPanel) return;

  otherMethodsToggle.addEventListener("click", () => {
    const isHidden = otherMethodsPanel.classList.contains("hidden");
    otherMethodsPanel.classList.toggle("hidden");
    otherMethodsToggle.textContent = isHidden
      ? "إخفاء طرق الدفع الأخرى ▴"
      : "عرض طرق الدفع الأخرى ▾";
  });
}

function isImageFile(file) {
  return file && file.type.startsWith("image/");
}

function setUploadProgress(pct, fileName) {
  progressWrap.classList.add("visible");
  progressFill.style.width = `${pct}%`;
  progressPct.textContent = `${pct}%`;
  progressFile.textContent = fileName || "—";
}

function setSelectedFile(file) {
  if (!isImageFile(file)) {
    errorMsg.textContent = "يرجى اختيار صورة فقط (JPG, PNG, WEBP, GIF).";
    return;
  }
  selectedFile = file;
  errorMsg.textContent = "";
  submitBtn.disabled = false;
  dropzone.classList.add("has-file");
  setUploadProgress(0, file.name);

  const url = URL.createObjectURL(file);
  previewImg.src = url;
  previewImg.classList.remove("hidden");
  previewImg.onload = () => URL.revokeObjectURL(url);
}

function bindUploadUI() {
  receiptInput.addEventListener("change", () => {
    const file = receiptInput.files?.[0];
    if (file) setSelectedFile(file);
  });

  ["dragenter", "dragover"].forEach((evt) => {
    dropzone.addEventListener(evt, (e) => {
      e.preventDefault();
      dropzone.classList.add("dragover");
    });
  });

  ["dragleave", "drop"].forEach((evt) => {
    dropzone.addEventListener(evt, (e) => {
      e.preventDefault();
      dropzone.classList.remove("dragover");
    });
  });

  dropzone.addEventListener("drop", (e) => {
    const file = e.dataTransfer?.files?.[0];
    if (file) setSelectedFile(file);
  });
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      const base64 = result.split(",")[1] || result;
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function uploadReceipt(userId, file) {
  return new Promise(async (resolve, reject) => {
    let base64;
    try {
      base64 = await fileToBase64(file);
    } catch (err) {
      reject(err);
      return;
    }

    const formData = new FormData();
    formData.append("key", IMGBB_API_KEY);
    formData.append("image", base64);
    formData.append("name", `receipt_${userId}_${Date.now()}`);

    const xhr = new XMLHttpRequest();
    xhr.open("POST", IMGBB_UPLOAD_URL);

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) {
        const pct = Math.round((e.loaded / e.total) * 100);
        setUploadProgress(pct, file.name);
      }
    };

    xhr.onload = () => {
      try {
        const res = JSON.parse(xhr.responseText);
        if (xhr.status >= 200 && xhr.status < 300 && res.success) {
          resolve({
            url: res.data.url,
            displayUrl: res.data.display_url || res.data.url,
            deleteUrl: res.data.delete_url || null,
            thumbUrl: res.data.thumb?.url || null,
          });
        } else {
          reject(new Error(res.error?.message || "ImgBB upload failed"));
        }
      } catch (err) {
        reject(err);
      }
    };

    xhr.onerror = () => reject(new Error("Network error during upload"));

    xhr.send(formData);
  });
}

async function submitForApproval(user) {
  if (!selectedFile || !checkoutData) return;

  submitBtn.disabled = true;
  submitBtn.classList.add("loading");
  submitLabel.textContent = "جاري الإرسال…";
  errorMsg.textContent = "";

  try {
    const upload = await uploadReceipt(user.uid, selectedFile);
    const receiptUrl = upload.url;
    setUploadProgress(100, selectedFile.name);

    const userRef = doc(db, "users", user.uid);
    const planName =
      checkoutData.finalPlanName || planLabel(checkoutData.finalPlanId);

    await setDoc(
      userRef,
      {
        status: "pending",
        requestedPlan: checkoutData.finalPlanId,
        requestedPlanName: planName,
        requestedPrice: Number(checkoutData.finalPrice),
        requestedDistricts: checkoutData.finalDistricts,
        submittedReceiptUrl: receiptUrl,
        receiptThumbUrl: upload.thumbUrl || null,
        receiptSubmittedAt: serverTimestamp(),
        updated_at: serverTimestamp(),
      },
      { merge: true },
    );

    clearCheckoutSession();
    window.location.replace("pending.html");
  } catch (err) {
    console.error("Payment submission failed:", err);
    errorMsg.textContent = "فشل رفع الإيصال في السيرفر: " + err.message;
    submitBtn.disabled = false;
    submitBtn.classList.remove("loading");
    submitLabel.textContent = "ارفع الإيصال للمراجعة";
  }
}

async function initPaymentPage(user) {
  checkoutData = readCheckoutSession();
  if (!checkoutData) {
    redirect("pricing.html");
    return;
  }

  try {
    const config = await loadSubscriptionConfig();
    planLabels = config.planLabels;
    renderPaymentDetails(config.payment);
  } catch (err) {
    console.error("Payment config load error:", err);
    errorMsg.textContent = "تعذر تحميل بيانات الدفع.";
  }

  renderSummary(checkoutData);
  bindCopyButtons();
  bindOtherMethodsToggle();
  bindUploadUI();
  submitBtn.addEventListener("click", () => submitForApproval(user));
  showScreen("payment");
}

// Same grace-period guard as pricing.js: avoid bouncing to index.html on a
// transient `user = null` callback right after a fresh navigation on a
// deployed (non-localhost) origin, where Firebase Auth persistence may not
// have fully settled yet.
let authCheckResolved = false;

onAuthStateChanged(auth, (user) => {
  if (authCheckResolved) return;

  if (user) {
    authCheckResolved = true;
    initPaymentPage(user);
    return;
  }

  setTimeout(() => {
    if (authCheckResolved) return;
    if (auth.currentUser) {
      authCheckResolved = true;
      initPaymentPage(auth.currentUser);
    } else {
      authCheckResolved = true;
      redirect("index.html");
    }
  }, 1200);
});
