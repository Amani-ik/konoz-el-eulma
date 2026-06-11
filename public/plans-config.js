/** Fallback defaults when Firestore config/subscription is missing */
export const DEFAULT_PAYMENT_DETAILS = {
  ccp: "37233694525777",
  baridimob: "S483823002W00000",
  holder: "كنوز العلمة",
};

export const DEFAULT_PLANS = [
  {
    id: "single",
    name: "نشاط واحد",
    subtitle: "Single Niche",
    price: 3500,
    maxDistricts: 1,
    active: true,
    order: 1,
    features: [
      "وصول كامل إلى نشاط واحد من اختيارك",
      " +50 خريطة تفاعلية لجميع الموردين",
      "دفعة واحدة — اشتراك دائم",
    ],
  },
  {
    id: "dual",
    name: "نشاطين",
    subtitle: "Dual Niche",
    price: 5000,
    maxDistricts: 2,
    active: true,
    order: 2,
    features: [
      "وصول إلى نشاطين من اختيارك",
      " +50 خريطة تفاعلية لجميع الموردين",
      "دفعة واحدة — اشتراك دائم",
    ],
  },
  {
    id: "all",
    name: "جميع النشاطات",
    subtitle: "All Niches",
    price: 7500,
    maxDistricts: 7,
    mostPopular: true,
    active: true,
    order: 3,
    features: [
      "وصول شامل لجميع النشاطات السبعة",
      "جميع المميزات Premium",
      "دفعة واحدة — اشتراك دائم",
    ],
  },
];

export const DEFAULT_DISTRICT_OPTIONS = [
  {
    id: "Kankari",
    name: "سوق الجملة للخردوات ومواد البناء",
    emoji: "🔧",
    active: true,
  },
  {
    id: "kitchen",
    name: "سوق الجملة للأدوات والأواني المنزلية",
    emoji: "🍶",
    active: true,
  },
  {
    id: "sports",
    name: "سوق الجملة لمستلزمات الرياضة",
    emoji: "⚽",
    active: true,
  },
  {
    id: "Decoration",
    name: "سوق الجملة لمستلزمات الديكور والزينة",
    emoji: "🎍",
    active: true,
  },
  {
    id: "electronics",
    name: "سوق الجملة للأجهزة الإلكترونية",
    emoji: "💻",
    active: true,
  },
  {
    id: "Electricity",
    name: "سوق الجملة للكهربائيات",
    emoji: "⚡",
    active: true,
  },
  { id: "Toys", name: "سوق الجملة للألعاب", emoji: "🧸", active: true },
];
