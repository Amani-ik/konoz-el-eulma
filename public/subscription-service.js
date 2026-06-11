import { db } from "./firebase-config.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import {
  DEFAULT_PAYMENT_DETAILS,
  DEFAULT_PLANS,
  DEFAULT_DISTRICT_OPTIONS,
} from "./plans-config.js";

/** Firestore path: config/subscription */
export const SUBSCRIPTION_CONFIG_PATH = ["config", "subscription"];

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
    subscriptionDays: 30,
    planLabels: buildPlanLabels(DEFAULT_PLANS),
  };
}

export async function loadSubscriptionConfig({ force = false } = {}) {
  if (cachedConfig && !force) return cachedConfig;

  try {
    const snap = await getDoc(doc(db, ...SUBSCRIPTION_CONFIG_PATH));
    if (snap.exists()) {
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
        },
        plans: plans.length ? plans : DEFAULT_PLANS,
        districts: districts.length ? districts : DEFAULT_DISTRICT_OPTIONS,
        subscriptionDays: Number(data.subscriptionDays) || 30,
        planLabels: buildPlanLabels(plans.length ? plans : DEFAULT_PLANS),
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
