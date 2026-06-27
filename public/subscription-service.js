import { db } from "./firebase-config.js";
import {
  doc,
  getDoc,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import {
  DEFAULT_PAYMENT_DETAILS,
  DEFAULT_PLANS,
  DEFAULT_DISTRICT_OPTIONS,
} from "./plans-config.js";

/** Firestore path: config/subscription */
export const SUBSCRIPTION_CONFIG_PATH = ["config", "subscription"];

/** Firestore path: app_settings/payment_settings */
const PAYMENT_SETTINGS_PATH = ["app_settings", "payment_settings"];

/**
 * Known placeholder strings stored in Firestore that mean "not configured".
 * If a field value matches one of these, treat it as null.
 */
const PLACEHOLDER_VALUES = new Set([
  "paypal",
  "redotpay",
  "cashondelivery",
  "cash on delivery",
  "cash",
  "n/a",
  "none",
  "-",
  "—",
]);

function isRealValue(val) {
  if (!val || typeof val !== "string") return false;
  return !PLACEHOLDER_VALUES.has(val.trim().toLowerCase());
}

/**
 * Maps raw Firestore payment_settings fields
 * (CCP, Baridimob, RedotPay, Paypal, Cashondelivery)
 * to the lowercase shape expected by renderPaymentDetails().
 */
function normalizePaymentSettings(raw = {}) {
  return {
    ccp: isRealValue(raw.CCP) ? raw.CCP : null,
    baridimob: isRealValue(raw.Baridimob) ? raw.Baridimob : null,
    redotpay: isRealValue(raw.RedotPay) ? raw.RedotPay : null,
    paypal: isRealValue(raw.Paypal) ? raw.Paypal : null,
    cashondelivery: isRealValue(raw.cashondelivery) ? raw.cashondelivery : null,
    holder: isRealValue(raw.holder) ? raw.holder : null,
  };
}

let cachedConfig = null;

function normalizePlan(plan = {}, index = 0) {
  const id = String(plan.id || "").trim();
  if (!id) return null;

  return {
    id,
    name: plan.name || id,
    subtitle: plan.subtitle || "",
    price: Number(plan.price) || 0,
    maxDistricts: Number(plan.maxDistricts) || 1,
    mostPopular: plan.mostPopular === true,
    active: plan.active !== false,
    order: Number(plan.order) || index + 1,
    features: Array.isArray(plan.features) ? plan.features.filter(Boolean) : [],
  };
}

function normalizeDistrict(district = {}) {
  const id = String(district.id || "").trim();
  if (!id || district.active === false) return null;

  return {
    id,
    name: district.name || id,
    emoji: district.emoji || "📍",
    active: true,
  };
}

function buildPlanLabels(plans) {
  return Object.fromEntries(plans.map((p) => [p.id, p.name]));
}

function buildDefaultConfig() {
  return {
    payment: { ...DEFAULT_PAYMENT_DETAILS },
    plans: [...DEFAULT_PLANS],
    districts: [...DEFAULT_DISTRICT_OPTIONS],
    planLabels: buildPlanLabels(DEFAULT_PLANS),
  };
}

export async function loadSubscriptionConfig({ force = false } = {}) {
  if (cachedConfig && !force) return cachedConfig;

  try {
    // allSettled: a permissions error on one doc won't kill the other
    const [snapResult, paySnapResult] = await Promise.allSettled([
      getDoc(doc(db, ...SUBSCRIPTION_CONFIG_PATH)),
      getDoc(doc(db, ...PAYMENT_SETTINGS_PATH)),
    ]);

    const snap = snapResult.status === "fulfilled" ? snapResult.value : null;
    const paySnap =
      paySnapResult.status === "fulfilled" ? paySnapResult.value : null;

    if (snapResult.status === "rejected")
      console.warn(
        "loadSubscriptionConfig: config/subscription failed:",
        snapResult.reason,
      );
    if (paySnapResult.status === "rejected")
      console.warn(
        "loadSubscriptionConfig: payment_settings failed:",
        paySnapResult.reason,
      );

    const livePayment = paySnap?.exists()
      ? normalizePaymentSettings(paySnap.data())
      : {};

    if (snap?.exists()) {
      const data = snap.data() || {};
      const plans = (Array.isArray(data.plans) ? data.plans : [])
        .map(normalizePlan)
        .filter(Boolean)
        .sort((a, b) => a.order - b.order);

      const districts = (Array.isArray(data.districts) ? data.districts : [])
        .map(normalizeDistrict)
        .filter(Boolean);

      cachedConfig = {
        payment: {
          ...DEFAULT_PAYMENT_DETAILS,
          ...(data.payment || {}),
          ...Object.fromEntries(
            Object.entries(livePayment).filter(([, v]) => v != null),
          ),
        },
        plans: plans.length ? plans : DEFAULT_PLANS,
        districts: districts.length ? districts : DEFAULT_DISTRICT_OPTIONS,
        subscriptionDays: Number(data.subscriptionDays) || 30,
        planLabels: buildPlanLabels(plans.length ? plans : DEFAULT_PLANS),
      };
      return cachedConfig;
    }

    // config/subscription missing or failed — still apply live payment settings
    if (paySnap?.exists()) {
      cachedConfig = {
        ...buildDefaultConfig(),
        payment: {
          ...DEFAULT_PAYMENT_DETAILS,
          ...Object.fromEntries(
            Object.entries(livePayment).filter(([, v]) => v != null),
          ),
        },
      };
      return cachedConfig;
    }
  } catch (err) {
    console.warn("loadSubscriptionConfig:", err);
  }

  cachedConfig = buildDefaultConfig();
  return cachedConfig;
}

export function getPlanById(plans, planId) {
  return plans.find((p) => p.id === planId) || null;
}
