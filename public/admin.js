import { auth, db } from "./firebase-config.js";
import {
  onAuthStateChanged,
  signOut,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import {
  collection,
  collectionGroup,
  doc,
  getDoc,
  onSnapshot,
  writeBatch,
  arrayUnion,
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
const metricTotal = document.getElementById("metricTotal");
// Two instances of the pending table: one on overview, one on its own tab
const pendingTableBody = document.getElementById("pendingTableBody");
const pendingTableBody2 = document.getElementById("pendingTableBody2");
const overviewPendingCount = document.getElementById("overviewPendingCount");
const pendingTabCount = document.getElementById("pendingTabCount");
const usersTabCount = document.getElementById("usersTabCount");
const sidebarPendingCount = document.getElementById("sidebarPendingCount");
const usersTableBody = document.getElementById("usersTableBody");
const userSearchInput = document.getElementById("userSearchInput");
const userSearchBtn = document.getElementById("userSearchBtn");
const userSearchClear = document.getElementById("userSearchClear");
const logoutBtn = document.getElementById("logoutBtn");
const receiptLightbox = document.getElementById("receiptLightbox");
const lightboxImage = document.getElementById("lightboxImage");
const lightboxClose = document.getElementById("lightboxClose");

// Additional payments tab elements
const additionalTableBody = document.getElementById("additionalTableBody");
const additionalTabCount = document.getElementById("additionalTabCount");
const sidebarAdditionalCount = document.getElementById("sidebarAdditionalCount");
const overviewAdditionalCount = document.getElementById("overviewAdditionalCount");

let unsubscribers = [];
let allUsersCache = [];
let searchFilter = "";
let statusFilter = "";

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
  return (
    String(userDoc.role || "")
      .trim()
      .toLowerCase() === "admin"
  );
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

function fullNameOf(data = {}) {
  return data.fullName || data["full name"] || data.companyName || "—";
}

function usernameOf(data = {}) {
  return data.username || "—";
}

function dateOfBirthOf(data = {}) {
  const dob =
    data.dob || data.dateOfBirth || data.birthDate || data.birthday || "";
  if (!dob) return "—";
  // Firestore Timestamp instances expose toDate()
  if (typeof dob === "object" && typeof dob.toDate === "function") {
    try {
      return dob.toDate().toLocaleDateString("ar-DZ");
    } catch {
      return "—";
    }
  }
  return String(dob);
}

function requestedPlanLabel(data = {}) {
  return data.requestedPlanName || data.requestedPlan || "—";
}

function requestedDistrictEntries(data = {}) {
  const districts = data.requestedDistricts;
  const list = Array.isArray(districts) ? districts : districts ? [districts] : [];

  return list.filter(Boolean).map((d) => {
    if (typeof d === "object") {
      return {
        id: d.id || "",
        name: d.name || d.id || "",
        emoji: d.emoji || "",
      };
    }
    // Fallback for legacy data stored as plain district id strings
    return { id: String(d), name: String(d), emoji: "" };
  });
}

function accountStatus(data = {}) {
  const s = String(data.status || "paid")
    .trim()
    .toLowerCase();
  if (s === "pending" || s === "paid" || s === "disabled") return s;
  return "paid";
}

function isSessionActive(data = {}) {
  const value = data.isSessionActive;
  return value === true || value === "true" || value === 1;
}

function statusPill(status = "") {
  const s = String(status || "paid").toLowerCase();
  if (s === "pending")
    return `<span class="status-pill status-pending">معلق</span>`;
  if (s === "disabled")
    return `<span class="status-pill status-disabled">محظور</span>`;
  return `<span class="status-pill status-paid">مدفوع</span>`;
}

function showDataError(message) {
  const text = escapeHtml(message || "تعذر تحميل البيانات");
  const pendingHtml = `<tr class="empty-row"><td colspan="9">${text}</td></tr>`;
  const usersHtml = `<tr class="empty-row"><td colspan="6">${text}</td></tr>`;
  if (pendingTableBody) pendingTableBody.innerHTML = pendingHtml;
  if (pendingTableBody2) pendingTableBody2.innerHTML = pendingHtml;
  if (usersTableBody) usersTableBody.innerHTML = usersHtml;
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
  const receiptUrl =
    data.submittedReceiptUrl || data.receiptUrl || data.receipt || "";
  const safeReceipt = escapeHtml(receiptUrl);
  const thumb = receiptUrl
    ? `<img class="receipt-thumb" src="${safeReceipt}" alt="إيصال" data-receipt="${safeReceipt}" />`
    : `<span style="color:var(--text-3)">لا يوجد</span>`;

  const planLabel = requestedPlanLabel(data);
  const planCell =
    planLabel && planLabel !== "—"
      ? `<span class="badge badge-plan">${escapeHtml(planLabel)}</span>`
      : `<span style="color:var(--text-3)">—</span>`;

  const districtEntries = requestedDistrictEntries(data);
  const districtsCell = districtEntries.length
    ? `<div class="district-tags">${districtEntries
        .map(
          (d) =>
            `<span class="district-tag" title="${escapeHtml(d.id)}">${d.emoji ? escapeHtml(d.emoji) + " " : ""}${escapeHtml(d.name)}</span>`,
        )
        .join("")}</div>`
    : `<span style="color:var(--text-3)">—</span>`;

  return `
    <tr data-uid="${escapeHtml(id)}">
      <td class="name-cell">${escapeHtml(fullNameOf(data))}</td>
      <td class="mono">${escapeHtml(usernameOf(data))}</td>
      <td class="mono">${escapeHtml(data.email || "—")}</td>
      <td class="mono">${escapeHtml(data.phone || "—")}</td>
      <td class="mono">${escapeHtml(dateOfBirthOf(data))}</td>
      <td>${planCell}</td>
      <td>${districtsCell}</td>
      <td>${thumb}</td>
      <td>
        <div class="row-actions">
          <button type="button" class="btn btn-primary btn-sm btn-approve" data-uid="${escapeHtml(id)}">
            <i class="fa-solid fa-check"></i> موافقة
          </button>
          <button type="button" class="btn btn-danger btn-sm btn-reject" data-uid="${escapeHtml(id)}">
            <i class="fa-solid fa-xmark"></i> رفض
          </button>
        </div>
      </td>
    </tr>
  `;
}

function renderPendingTable(docs) {
  const html = docs.length
    ? docs.map(({ id, data }) => renderPendingRow(id, data)).join("")
    : `<tr class="empty-row"><td colspan="9">لا توجد طلبات معلقة</td></tr>`;

  if (pendingTableBody) pendingTableBody.innerHTML = html;
  if (pendingTableBody2) pendingTableBody2.innerHTML = html;

  const countStr = String(docs.length);
  if (overviewPendingCount) overviewPendingCount.textContent = countStr;
  if (pendingTabCount) pendingTabCount.textContent = countStr;
  if (sidebarPendingCount) {
    sidebarPendingCount.textContent = countStr;
    sidebarPendingCount.style.display = docs.length ? "" : "none";
  }
}

function matchesSearch(data, term) {
  if (!term) return true;
  const haystack = `${data.email || ""} ${data.phone || ""}`.toLowerCase();
  return haystack.includes(term.toLowerCase());
}

function matchesStatusFilter(data) {
  if (!statusFilter) return true;
  return accountStatus(data) === statusFilter;
}

function filterUsers(users) {
  return users.filter(
    ({ data }) =>
      matchesSearch(data, searchFilter) && matchesStatusFilter(data),
  );
}

function renderUsersTable(users) {
  if (!usersTableBody) return;

  const filtered = filterUsers(users);

  if (!filtered.length) {
    usersTableBody.innerHTML = `
      <tr class="empty-row"><td colspan="6">لا توجد نتائج</td></tr>
    `;
    return;
  }

  usersTableBody.innerHTML = filtered
    .map(({ id, data }) => {
      const sessionActive = isSessionActive(data);
      const isDisabled = accountStatus(data) === "disabled";
      const isTargetAdmin =
        String(data.role || "")
          .trim()
          .toLowerCase() === "admin";
      const accountToggleBtn = isTargetAdmin
        ? ""
        : isDisabled
          ? `<button type="button" class="btn btn-primary btn-sm btn-enable-account" data-uid="${escapeHtml(id)}"><i class="fa-solid fa-circle-check"></i> تفعيل</button>`
          : `<button type="button" class="btn btn-danger btn-sm btn-block-account" data-uid="${escapeHtml(id)}"><i class="fa-solid fa-ban"></i> حظر</button>`;

      const sessionEl = sessionActive
        ? `<span class="session-active"><span class="session-dot"></span> نشطة</span>`
        : `<span style="color:var(--text-3)">—</span>`;

      return `
        <tr data-uid="${escapeHtml(id)}">
          <td class="name-cell">${escapeHtml(merchantName(data))}</td>
          <td class="mono">${escapeHtml(data.email || "—")}</td>
          <td class="mono">${escapeHtml(data.phone || "—")}</td>
          <td>${statusPill(accountStatus(data))}</td>
          <td>${sessionEl}</td>
          <td>
            <div class="row-actions">
              <button type="button" class="btn btn-warn btn-sm btn-reset-session" data-uid="${escapeHtml(id)}" ${sessionActive ? "" : "disabled"}>
                <i class="fa-solid fa-rotate"></i> إعادة الجلسة
              </button>
              ${accountToggleBtn}
            </div>
          </td>
        </tr>
      `;
    })
    .join("");
}

async function approveUser(userId, userData) {
  const receiptUrl =
    userData.submittedReceiptUrl ||
    userData.receiptUrl ||
    userData.receipt ||
    "";
  const paymentMethod = userData.paymentMethod || "";
  const amount = Number(userData.requestedPrice) || SUBSCRIPTION_AMOUNT;
  const planId = userData.requestedPlan || "";
  const planName = userData.requestedPlanName || planId;
  const districts = userData.requestedDistricts || [];
  const pendingPaymentId = userData.pendingPaymentId || "";

  const batch = writeBatch(db);
  const userRef = doc(db, "users", userId);
  const paymentRef = pendingPaymentId
    ? doc(db, "users", userId, "payments", pendingPaymentId)
    : doc(collection(db, "users", userId, "payments"));

  batch.update(userRef, {
    status: "paid",
    districts: Array.isArray(districts) ? districts : [],
    activatedAt: serverTimestamp(),
    subscriptionExpiryDate: subscriptionExpiryTimestamp(),
    submittedReceiptUrl: deleteField(),
    requestedPlan: deleteField(),
    requestedPlanName: deleteField(),
    requestedPrice: deleteField(),
    requestedDistricts: deleteField(),
    receiptSubmittedAt: deleteField(),
    pendingPaymentId: deleteField(),
    receiptUrl: deleteField(),
    paymentMethod: deleteField(),
    updated_at: serverTimestamp(),
  });

  batch.set(
    paymentRef,
    {
      receiptUrl,
      paymentMethod,
      planId,
      planName,
      districts,
      approvedAt: serverTimestamp(),
      amount,
      status: "approved",
      subscriptionType: userData.subscriptionType || "monthly_one_time",
    },
    { merge: true },
  );

  await batch.commit();
}

async function rejectUser(userId, userData) {
  const batch = writeBatch(db);
  const userRef = doc(db, "users", userId);
  const rejectedRef = doc(db, "rejectedUsers", userId);

  batch.set(rejectedRef, {
    ...userData,
    rejectedAt: serverTimestamp(),
    originalUid: userId,
  });
  batch.delete(userRef);

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

async function setAccountDisabled(userId, disabled) {
  const userRef = doc(db, "users", userId);
  const snap = await getDoc(userRef);
  if (!snap.exists()) throw new Error("User not found.");

  const userData = snap.data() || {};
  if (
    String(userData.role || "")
      .trim()
      .toLowerCase() === "admin"
  ) {
    throw new Error("Cannot modify admin accounts.");
  }

  const batch = writeBatch(db);
  const update = {
    isSessionActive: false,
    currentSessionId: "",
    updated_at: serverTimestamp(),
  };

  if (disabled) {
    update.status = "disabled";
    update.statusBeforeDisable = accountStatus(userData);
  } else {
    update.status = userData.statusBeforeDisable || "paid";
    update.statusBeforeDisable = deleteField();
  }

  batch.update(userRef, update);
  await batch.commit();
}

// ════════════════════════════════════════════════════════════════
// ═══ Additional Districts Payment Requests ═══
// ════════════════════════════════════════════════════════════════

function renderAdditionalRow(requestId, userId, data) {
  const receiptUrl = data.submittedReceiptUrl || "";
  const safeReceipt = escapeHtml(receiptUrl);
  const thumb = receiptUrl
    ? `<img class="receipt-thumb" src="${safeReceipt}" alt="إيصال" data-receipt="${safeReceipt}" />`
    : `<span style="color:var(--text-3)">لا يوجد</span>`;

  const districts = Array.isArray(data.requestedDistricts)
    ? data.requestedDistricts
    : [];
  const districtsCell = districts.length
    ? `<div class="district-tags">${districts
        .map((d) => {
          const name = typeof d === "object" ? d.name || d.id : String(d);
          const emoji = typeof d === "object" ? d.emoji || "" : "";
          return `<span class="district-tag">${emoji ? escapeHtml(emoji) + " " : ""}${escapeHtml(name)}</span>`;
        })
        .join("")}</div>`
    : `<span style="color:var(--text-3)">—</span>`;

  // Format submitted date
  let submittedDate = "—";
  if (data.submittedAt) {
    try {
      const d =
        typeof data.submittedAt.toDate === "function"
          ? data.submittedAt.toDate()
          : new Date(data.submittedAt);
      submittedDate = d.toLocaleDateString("ar-DZ");
    } catch {
      submittedDate = "—";
    }
  }

  return `
    <tr data-uid="${escapeHtml(userId)}" data-req-id="${escapeHtml(requestId)}">
      <td class="mono">${escapeHtml(userId)}</td>
      <td>${districtsCell}</td>
      <td class="mono">${escapeHtml(submittedDate)}</td>
      <td>${thumb}</td>
      <td>
        <div class="row-actions">
          <button type="button" class="btn btn-primary btn-sm btn-approve-additional"
            data-uid="${escapeHtml(userId)}" data-req-id="${escapeHtml(requestId)}">
            <i class="fa-solid fa-plus"></i> تأكيد الإضافة
          </button>
          <button type="button" class="btn btn-danger btn-sm btn-reject-additional"
            data-uid="${escapeHtml(userId)}" data-req-id="${escapeHtml(requestId)}">
            <i class="fa-solid fa-xmark"></i> رفض
          </button>
        </div>
      </td>
    </tr>
  `;
}

function renderAdditionalTable(requests) {
  const html = requests.length
    ? requests
        .map(({ requestId, userId, data }) =>
          renderAdditionalRow(requestId, userId, data)
        )
        .join("")
    : `<tr class="empty-row"><td colspan="5">لا توجد طلبات إضافة أسواق</td></tr>`;

  if (additionalTableBody) additionalTableBody.innerHTML = html;

  const countStr = String(requests.length);
  if (additionalTabCount) additionalTabCount.textContent = countStr;
  if (overviewAdditionalCount) overviewAdditionalCount.textContent = countStr;
  if (sidebarAdditionalCount) {
    sidebarAdditionalCount.textContent = countStr;
    sidebarAdditionalCount.style.display = requests.length ? "" : "none";
  }
}

/**
 * Approve an additional district request:
 * - arrayUnion the requested districts into users/{uid}.districts
 * - Mark the subcollection doc status = "approved"
 */
async function approveAdditionalRequest(userId, requestId, requestData) {
  const districts = Array.isArray(requestData.requestedDistricts)
    ? requestData.requestedDistricts
    : [];
  if (!districts.length) throw new Error("No districts in request.");

  const batch = writeBatch(db);

  const userRef = doc(db, "users", userId);
  // Merge new districts into the existing array, avoiding duplicates
  batch.update(userRef, {
    districts: arrayUnion(...districts),
    updated_at: serverTimestamp(),
  });

  const reqRef = doc(
    db,
    "users",
    userId,
    "additionalPaymentRequests",
    requestId
  );
  batch.update(reqRef, {
    status: "approved",
    approvedAt: serverTimestamp(),
  });

  await batch.commit();
}

/**
 * Reject an additional district request:
 * - Mark the subcollection doc status = "rejected"
 */
async function rejectAdditionalRequest(userId, requestId) {
  const batch = writeBatch(db);
  const reqRef = doc(
    db,
    "users",
    userId,
    "additionalPaymentRequests",
    requestId
  );
  batch.update(reqRef, {
    status: "rejected",
    rejectedAt: serverTimestamp(),
  });
  await batch.commit();
}

function startAdditionalPaymentsListener() {
  // Listen to all additionalPaymentRequests subcollections using collectionGroup
  const q = collectionGroup(db, "additionalPaymentRequests");
  unsubscribers.push(
    onSnapshot(
      q,
      (snap) => {
        const pending = [];
        snap.forEach((docSnap) => {
          const data = docSnap.data();
          // Only show pending ones
          if (data.status === "pending_additional") {
            // Extract userId from path: users/{uid}/additionalPaymentRequests/{reqId}
            const userId = docSnap.ref.parent.parent?.id || data.userId || "";
            pending.push({
              requestId: docSnap.id,
              userId,
              data,
            });
          }
        });
        renderAdditionalTable(pending);
      },
      (err) => {
        console.error("additionalPaymentRequests onSnapshot:", err);
        if (additionalTableBody) {
          additionalTableBody.innerHTML = `<tr class="empty-row"><td colspan="5">تعذر تحميل طلبات الإضافة — تحقق من قواعد الأمان.</td></tr>`;
        }
      }
    )
  );
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

    const rejectBtn = e.target.closest(".btn-reject");
    if (rejectBtn) {
      const uid = rejectBtn.dataset.uid;
      if (!uid || rejectBtn.disabled) return;

      const confirmed = confirm(
        "تأكيد رفض هذا الطلب؟ سيتم نقل المستخدم إلى قائمة المرفوضين.",
      );
      if (!confirmed) return;

      rejectBtn.disabled = true;
      try {
        const snap = await getDoc(doc(db, "users", uid));
        if (!snap.exists() || snap.data().status !== "pending") {
          alert("هذا الطلب لم يعد معلقاً.");
          return;
        }
        await rejectUser(uid, snap.data());
      } catch (err) {
        console.error("rejectUser:", err);
        alert("فشل رفض الطلب. حاول مرة أخرى.");
        rejectBtn.disabled = false;
      }
      return;
    }

    const resetBtn = e.target.closest(".btn-reset-session");
    if (resetBtn) {
      const uid = resetBtn.dataset.uid;
      if (!uid || resetBtn.disabled) return;
      if (!confirm("إنهاء الجلسة النشطة لهذا المستخدم؟")) return;
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
        await setAccountDisabled(uid, true);
      } catch (err) {
        console.error("setAccountDisabled (block):", err);
        alert("تعذر حظر الحساب.");
        blockBtn.disabled = false;
      }
      return;
    }

    const enableBtn = e.target.closest(".btn-enable-account");
    if (enableBtn) {
      const uid = enableBtn.dataset.uid;
      if (!uid || enableBtn.disabled) return;
      if (!confirm("تفعيل هذا الحساب؟")) return;
      enableBtn.disabled = true;
      try {
        await setAccountDisabled(uid, false);
      } catch (err) {
        console.error("setAccountDisabled (enable):", err);
        alert("تعذر تفعيل الحساب.");
        enableBtn.disabled = false;
      }
      return;
    }

    // ── Additional payment: approve ──
    const approveAdditional = e.target.closest(".btn-approve-additional");
    if (approveAdditional) {
      const uid = approveAdditional.dataset.uid;
      const reqId = approveAdditional.dataset.reqId;
      if (!uid || !reqId || approveAdditional.disabled) return;

      const confirmed = confirm(
        "تأكيد إضافة الأسواق الجديدة لهذا المستخدم؟"
      );
      if (!confirmed) return;

      approveAdditional.disabled = true;
      try {
        const reqRef = doc(
          db,
          "users",
          uid,
          "additionalPaymentRequests",
          reqId
        );
        const snap = await getDoc(reqRef);
        if (!snap.exists() || snap.data().status !== "pending_additional") {
          alert("هذا الطلب لم يعد معلقاً.");
          approveAdditional.disabled = false;
          return;
        }
        await approveAdditionalRequest(uid, reqId, snap.data());
      } catch (err) {
        console.error("approveAdditionalRequest:", err);
        alert("فشلت الموافقة: " + err.message);
        approveAdditional.disabled = false;
      }
      return;
    }

    // ── Additional payment: reject ──
    const rejectAdditional = e.target.closest(".btn-reject-additional");
    if (rejectAdditional) {
      const uid = rejectAdditional.dataset.uid;
      const reqId = rejectAdditional.dataset.reqId;
      if (!uid || !reqId || rejectAdditional.disabled) return;

      const confirmed = confirm("رفض طلب إضافة الأسواق هذا؟");
      if (!confirmed) return;

      rejectAdditional.disabled = true;
      try {
        await rejectAdditionalRequest(uid, reqId);
      } catch (err) {
        console.error("rejectAdditionalRequest:", err);
        alert("فشل الرفض: " + err.message);
        rejectAdditional.disabled = false;
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
  const sessions = users.filter(({ data }) => isSessionActive(data));

  if (metricPending) metricPending.textContent = String(pending.length);
  if (metricPaid) metricPaid.textContent = String(paid.length);
  if (metricSessions) metricSessions.textContent = String(sessions.length);
  if (metricTotal) metricTotal.textContent = String(users.length);
  if (usersTabCount) usersTabCount.textContent = String(users.length);

  renderPendingTable(pending);
  renderUsersTable(users);
}

function startListeners() {
  startAdditionalPaymentsListener();
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

function setStatusFilter(value) {
  statusFilter = value || "";
  document.querySelectorAll(".status-filter-btn").forEach((btn) => {
    btn.classList.toggle("active", (btn.dataset.status || "") === statusFilter);
  });
  renderUsersTable(allUsersCache);
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
    setStatusFilter("");
  });

  document.querySelectorAll(".status-filter-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      setStatusFilter(btn.dataset.status || "");
    });
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
    redirect("index.html");
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

  if (adminEmailEl)
    adminEmailEl.textContent = user.email || userDoc.email || "—";
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
