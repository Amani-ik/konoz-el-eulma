import { auth, db, storage } from "./firebase-config.js";
import {
  onAuthStateChanged,
  signOut,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import {
  doc,
  collection,
  writeBatch,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import {
  ref,
  uploadBytesResumable,
  getDownloadURL,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";
import { loadSubscriptionConfig } from "./subscription-service.js";

const SESSION_KEYS = [
  "finalPlanId",
  "finalPrice",
  "finalPlanName",
  "finalDistricts",
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
    sessionStorage.getItem("finalPlanName") ||
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
  SESSION_KEYS.forEach((k) => sessionStorage.removeItem(k));
}

function readCheckoutSession() {
  const finalPlanId = sessionStorage.getItem("finalPlanId");
  if (!finalPlanId) return null;
  return {
    finalPlanId,
    finalPlanName: sessionStorage.getItem("finalPlanName") || "",
    finalPrice: sessionStorage.getItem("finalPrice") || "0",
    finalDistricts: parseDistricts(sessionStorage.getItem("finalDistricts")),
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

function uploadReceipt(userId, file) {
  const timestamp = Date.now();
  const storagePath = `receipts/${userId}/${timestamp}_receipt.jpg`;
  const storageRef = ref(storage, storagePath);

  return new Promise((resolve, reject) => {
    const task = uploadBytesResumable(storageRef, file, {
      contentType: file.type || "image/jpeg",
    });

    task.on(
      "state_changed",
      (snap) => {
        const pct = Math.round((snap.bytesTransferred / snap.totalBytes) * 100);
        setUploadProgress(pct, file.name);
      },
      reject,
      async () => {
        try {
          const url = await getDownloadURL(task.snapshot.ref);
          resolve(url);
        } catch (err) {
          reject(err);
        }
      },
    );
  });
}

async function submitForApproval(user) {
  if (!selectedFile || !checkoutData) return;

  submitBtn.disabled = true;
  submitBtn.classList.add("loading");
  submitLabel.textContent = "جاري الإرسال…";
  errorMsg.textContent = "";

  try {
    const receiptUrl = await uploadReceipt(user.uid, selectedFile);
    setUploadProgress(100, selectedFile.name);

    const userRef = doc(db, "users", user.uid);
    const paymentRef = doc(collection(db, "users", user.uid, "payments"));
    const planName =
      checkoutData.finalPlanName || planLabel(checkoutData.finalPlanId);

    const batch = writeBatch(db);

    batch.set(
      userRef,
      {
        status: "pending",
        requestedPlan: checkoutData.finalPlanId,
        requestedPrice: Number(checkoutData.finalPrice),
        requestedDistricts: checkoutData.finalDistricts,
        submittedReceiptUrl: receiptUrl,
        receiptSubmittedAt: serverTimestamp(),
        pendingPaymentId: paymentRef.id,
        subscriptionType: "monthly_one_time",
        updated_at: serverTimestamp(),
      },
      { merge: true },
    );

    batch.set(paymentRef, {
      receiptUrl,
      planId: checkoutData.finalPlanId,
      planName,
      amount: Number(checkoutData.finalPrice),
      districts: checkoutData.finalDistricts,
      status: "pending",
      subscriptionType: "monthly_one_time",
      submittedAt: serverTimestamp(),
    });

    await batch.commit();

    clearCheckoutSession();

    try {
      await signOut(auth);
    } catch (_) {}

    showScreen("awaiting");
  } catch (err) {
    console.error("Payment submission failed:", err);
    errorMsg.textContent = "فشل رفع الإيصال. يرجى المحاولة مرة أخرى.";
    submitBtn.disabled = false;
    submitBtn.classList.remove("loading");
    submitLabel.textContent = "Submit for Approval";
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
  bindUploadUI();
  submitBtn.addEventListener("click", () => submitForApproval(user));
  showScreen("payment");
}

onAuthStateChanged(auth, (user) => {
  if (!user) {
    redirect("index.html");
    return;
  }
  initPaymentPage(user);
});
