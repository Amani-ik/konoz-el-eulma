import { auth, db } from "./firebase-config.js";
import {
  onAuthStateChanged,
  signOut,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  writeBatch,
  serverTimestamp,
  Timestamp,
  deleteField,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const SUBSCRIPTION_DAYS = 30;
const SUBSCRIPTION_AMOUNT = 2000;

const gateLoader = document.getElementById("gateLoader");
const adminApp = document.getElementById("adminApp");
const adminEmailEl = document.getElementById("adminEmail");
const metricPending = document.getElementById("metricPending");
const metricPaid = document.getElementById("metricPaid");
const metricSessions = document.getElementById("metricSessions");
const pendingTableBody = document.getElementById("pendingTableBody");
const usersTableBody = document.getElementById("usersTableBody");
const userSearchInput = document.getElementById("userSearchInput");
const userSearchBtn = document.getElementById("userSearchBtn");
const userSearchClear = document.getElementById("userSearchClear");
const logoutBtn = document.getElementById("logoutBtn");
const receiptLightbox = document.getElementById("receiptLightbox");
const lightboxImage = document.getElementById("lightboxImage");
const lightboxClose = document.getElementById("lightboxClose");

let unsubscribers = [];
let allUsersCache = [];
let searchFilter = "";

function hideGate() {
  if (gateLoader) gateLoader.style.display = "none";
}

function showAdmin() {
  if (adminApp) adminApp.classList.remove("hidden");
}

function redirect(url) {
  window.location.replace(url);
}

function isStrictAdmin(userDoc = {}) {
  return String(userDoc.role || "").trim().toLowerCase() === "admin";
}

function escapeHtml(value = "") {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function merchantName(data = {}) {
  return (
    data.fullName ||
    data["full name"] ||
    data.username ||
    data.companyName ||
    "—"
  );
}

function paymentBadge(method = "") {
  const normalized = String(method).trim().toLowerCase();
  if (normalized.includes("barid") || normalized === "baridimob") {
    return `<span class="badge badge-baridimob">Baridimob</span>`;
  }
  if (normalized.includes("ccp")) {
    return `<span class="badge badge-ccp">CCP</span>`;
  }
  return `<span class="badge">${method || "—"}</span>`;
}

function accountStatus(data = {}) {
  const s = String(data.status || "paid").trim().toLowerCase();
  if (s === "pending" || s === "paid" || s === "disabled") return s;
  return "paid";
}

function statusPill(status = "") {
  const s = String(status || "paid").toLowerCase();
  if (s === "pending") return `<span class="status-pill status-pending">معلق</span>`;
  if (s === "disabled") return `<span class="status-pill status-disabled">محظور</span>`;
  return `<span class="status-pill status-paid">مدفوع</span>`;
}

function showDataError(message) {
  const text = escapeHtml(message || "تعذر تحميل البيانات");
  if (pendingTableBody) {
    pendingTableBody.innerHTML = `<tr class="empty-row"><td colspan="5">${text}</td></tr>`;
  }
  if (usersTableBody) {
    usersTableBody.innerHTML = `<tr class="empty-row"><td colspan="6">${text}</td></tr>`;
  }
}

function subscriptionExpiryTimestamp() {
  return Timestamp.fromMillis(
    Date.now() + SUBSCRIPTION_DAYS * 24 * 60 * 60 * 1000,
  );
}

function openLightbox(url) {
  if (!url || !receiptLightbox || !lightboxImage) return;
  lightboxImage.src = url;
  receiptLightbox.classList.add("open");
  receiptLightbox.setAttribute("aria-hidden", "false");
}

function closeLightbox() {
  if (!receiptLightbox || !lightboxImage) return;
  receiptLightbox.classList.remove("open");
  receiptLightbox.setAttribute("aria-hidden", "true");
  lightboxImage.src = "";
}

function renderPendingRow(id, data) {
  const receiptUrl = data.receiptUrl || data.receipt || "";
  const safeReceipt = escapeHtml(receiptUrl);
  const thumb = receiptUrl
    ? `<img class="receipt-thumb" src="${safeReceipt}" alt="إيصال" data-receipt="${safeReceipt}" />`
    : `<span style="color:var(--muted)">لا يوجد</span>`;

  return `
    <tr data-uid="${escapeHtml(id)}">
      <td>${escapeHtml(merchantName(data))}</td>
      <td dir="ltr">${escapeHtml(data.phone || "—")}</td>
      <td>${paymentBadge(data.paymentMethod)}</td>
      <td>${thumb}</td>
      <td>
        <button type="button" class="btn btn-primary btn-approve" data-uid="${escapeHtml(id)}">
          <i class="fa-solid fa-check"></i> موافقة
        </button>
      </td>
    </tr>
  `;
}

function renderPendingTable(docs) {
  if (!pendingTableBody) return;

  if (!docs.length) {
    pendingTableBody.innerHTML = `
      <tr class="empty-row"><td colspan="5">لا توجد طلبات معلقة</td></tr>
    `;
    return;
  }

  pendingTableBody.innerHTML = docs
    .map(({ id, data }) => renderPendingRow(id, data))
    .join("");
}

function matchesSearch(data, term) {
  if (!term) return true;
  const haystack = `${data.email || ""} ${data.phone || ""}`.toLowerCase();
  return haystack.includes(term.toLowerCase());
}

function renderUsersTable(users) {
  if (!usersTableBody) return;

  const filtered = users.filter(({ data }) => matchesSearch(data, searchFilter));

  if (!filtered.length) {
    usersTableBody.innerHTML = `
      <tr class="empty-row"><td colspan="6">لا توجد نتائج</td></tr>
    `;
    return;
  }

  usersTableBody.innerHTML = filtered
    .map(({ id, data }) => {
      const sessionActive = data.isSessionActive === true;
      return `
        <tr data-uid="${escapeHtml(id)}">
          <td>${escapeHtml(merchantName(data))}</td>
          <td dir="ltr">${escapeHtml(data.email || "—")}</td>
          <td dir="ltr">${escapeHtml(data.phone || "—")}</td>
          <td>${statusPill(accountStatus(data))}</td>
          <td>${sessionActive ? '<i class="fa-solid fa-circle" style="color:var(--accent);font-size:10px"></i> نشطة' : "—"}</td>
          <td>
            <div class="row-actions">
              <button type="button" class="btn btn-warn btn-reset-session" data-uid="${escapeHtml(id)}" ${sessionActive ? "" : "disabled"}>
                إعادة الجلسة
              </button>
              <button type="button" class="btn btn-danger btn-block-account" data-uid="${escapeHtml(id)}" ${accountStatus(data) === "disabled" ? "disabled" : ""}>
                حظر الحساب
              </button>
            </div>
          </td>
        </tr>
      `;
    })
    .join("");
}

async function approveUser(userId, userData) {
  const receiptUrl = userData.receiptUrl || userData.receipt || "";
  const paymentMethod = userData.paymentMethod || "";

  const batch = writeBatch(db);
  const userRef = doc(db, "users", userId);
  const paymentRef = doc(collection(db, "users", userId, "payments"));

  batch.update(userRef, {
    status: "paid",
    activatedAt: serverTimestamp(),
    subscriptionExpiryDate: subscriptionExpiryTimestamp(),
    receiptUrl: deleteField(),
    paymentMethod: deleteField(),
    updated_at: serverTimestamp(),
  });

  batch.set(paymentRef, {
    receiptUrl,
    paymentMethod,
    approvedAt: serverTimestamp(),
    amount: SUBSCRIPTION_AMOUNT,
    status: "approved",
  });

  await batch.commit();
}

async function resetSession(userId) {
  const userRef = doc(db, "users", userId);
  const batch = writeBatch(db);
  batch.update(userRef, {
    isSessionActive: false,
    currentSessionId: "",
    updated_at: serverTimestamp(),
  });
  await batch.commit();
}

async function blockAccount(userId) {
  const userRef = doc(db, "users", userId);
  const batch = writeBatch(db);
  batch.update(userRef, {
    status: "disabled",
    isSessionActive: false,
    currentSessionId: "",
    updated_at: serverTimestamp(),
  });
  await batch.commit();
}

function bindTableActions() {
  document.addEventListener("click", async (e) => {
    const approveBtn = e.target.closest(".btn-approve");
    if (approveBtn) {
      const uid = approveBtn.dataset.uid;
      if (!uid || approveBtn.disabled) return;

      const confirmed = confirm("تأكيد الموافقة على هذا الاشتراك؟");
      if (!confirmed) return;

      approveBtn.disabled = true;
      try {
        const snap = await getDoc(doc(db, "users", uid));
        if (!snap.exists() || snap.data().status !== "pending") {
          alert("هذا الطلب لم يعد معلقاً.");
          return;
        }
        await approveUser(uid, snap.data());
      } catch (err) {
        console.error("approveUser:", err);
        alert("فشلت الموافقة. حاول مرة أخرى.");
        approveBtn.disabled = false;
      }
      return;
    }

    const resetBtn = e.target.closest(".btn-reset-session");
    if (resetBtn) {
      const uid = resetBtn.dataset.uid;
      if (!uid || resetBtn.disabled) return;
      resetBtn.disabled = true;
      try {
        await resetSession(uid);
      } catch (err) {
        console.error("resetSession:", err);
        alert("تعذر إعادة تعيين الجلسة.");
        resetBtn.disabled = false;
      }
      return;
    }

    const blockBtn = e.target.closest(".btn-block-account");
    if (blockBtn) {
      const uid = blockBtn.dataset.uid;
      if (!uid || blockBtn.disabled) return;
      if (!confirm("حظر هذا الحساب؟")) return;
      blockBtn.disabled = true;
      try {
        await blockAccount(uid);
      } catch (err) {
        console.error("blockAccount:", err);
        alert("تعذر حظر الحساب.");
        blockBtn.disabled = false;
      }
      return;
    }

    const thumb = e.target.closest(".receipt-thumb");
    if (thumb?.dataset.receipt) {
      openLightbox(thumb.dataset.receipt);
    }
  });
}

function applyUsersSnapshot(users) {
  allUsersCache = users;

  const pending = users.filter(({ data }) => accountStatus(data) === "pending");
  const paid = users.filter(({ data }) => accountStatus(data) === "paid");
  const sessions = users.filter(({ data }) => data.isSessionActive === true);

  if (metricPending) metricPending.textContent = String(pending.length);
  if (metricPaid) metricPaid.textContent = String(paid.length);
  if (metricSessions) metricSessions.textContent = String(sessions.length);

  renderPendingTable(pending);
  renderUsersTable(users);
}

function startListeners() {
  unsubscribers.push(
    onSnapshot(
      collection(db, "users"),
      (snap) => {
        const users = snap.docs.map((d) => ({ id: d.id, data: d.data() }));
        applyUsersSnapshot(users);
      },
      (err) => {
        console.error("users onSnapshot:", err);
        const hint =
          err?.code === "permission-denied"
            ? "صلاحيات Firestore تمنع قراءة المستخدمين — انشر قواعد الأمان المحدّثة."
            : err?.message || "خطأ غير معروف";
        showDataError(hint);
      },
    ),
  );
}

function bindSearch() {
  const applySearch = () => {
    searchFilter = userSearchInput?.value.trim() || "";
    renderUsersTable(allUsersCache);
  };

  userSearchBtn?.addEventListener("click", applySearch);
  userSearchInput?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") applySearch();
  });
  userSearchClear?.addEventListener("click", () => {
    if (userSearchInput) userSearchInput.value = "";
    searchFilter = "";
    renderUsersTable(allUsersCache);
  });
}

function bindLightbox() {
  lightboxClose?.addEventListener("click", closeLightbox);
  receiptLightbox?.addEventListener("click", (e) => {
    if (e.target === receiptLightbox) closeLightbox();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeLightbox();
  });
}

function bindLogout() {
  logoutBtn?.addEventListener("click", async () => {
    try {
      await signOut(auth);
    } catch (err) {
      console.error("logout:", err);
    }
    redirect("login.html");
  });
}

async function enforceAdminGate(user) {
  if (!user) {
    redirect("login.html");
    return false;
  }

  const snap = await getDoc(doc(db, "users", user.uid));
  const userDoc = snap.exists() ? snap.data() : {};

  if (!isStrictAdmin(userDoc)) {
    alert("Unauthorized access");
    try {
      await signOut(auth);
    } catch (err) {
      console.error("signOut:", err);
    }
    redirect("index.html");
    return false;
  }

  if (adminEmailEl) adminEmailEl.textContent = user.email || userDoc.email || "—";
  hideGate();
  showAdmin();
  return true;
}

function cleanup() {
  unsubscribers.forEach((unsub) => {
    try {
      unsub();
    } catch (err) {
      console.warn("unsub:", err);
    }
  });
  unsubscribers = [];
}

bindTableActions();
bindSearch();
bindLightbox();
bindLogout();

onAuthStateChanged(auth, async (user) => {
  cleanup();
  const allowed = await enforceAdminGate(user);
  if (allowed) startListeners();
});

window.addEventListener("beforeunload", cleanup);
