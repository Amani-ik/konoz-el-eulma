/*
  Seed Firestore script

  Usage:
    1. Install dependencies:
       npm init -y
       npm install firebase-admin

    2. Download a Firebase service account key JSON from the Firebase Console
       (Project settings -> Service accounts -> Generate new private key)
       and save it as `serviceAccountKey.json` in the project root.

    3. Run the script:
       node scripts/seedFirestore.js

  This will create sample documents in the `news` and `system` collections.
*/

const admin = require("firebase-admin");
const path = require("path");

const keyPath = path.resolve(__dirname, "../serviceAccountKey.json");

try {
  const serviceAccount = require(keyPath);
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
} catch (err) {
  console.error("Failed to load service account key. Place serviceAccountKey.json in project root.");
  console.error(err.message);
  process.exit(1);
}

const db = admin.firestore();

const newsDocs = [
  {
    id: "n-example-1",
    title: "تخفيضات نهاية الموسم",
    sub: "عروض",
    published: "2026-05-30 10:00",
    content: "متاجر مختارة تقدم خصومات حتى 40% على منتجات مختارة.",
    districtId: "kitchen",
    marketIdx: 2,
    link: "",
  },
  {
    id: "n-example-2",
    title: "افتتاح متجر جديد",
    sub: "افتتاح",
    published: "2026-05-28 09:00",
    content: "تم افتتاح متجر GREEN HILL SPORT في سوق الرياضة.",
    districtId: "sports",
    marketIdx: 8,
  },
];

const systemDocs = [
  {
    id: "s-example-1",
    title: "تحديث التطبيق — الإصدار 2.3",
    sub: "تحديث",
    type: "update",
    published: "2026-05-15 09:00",
    content: "تم إطلاق الإصدار 2.3 من كنوز العلمة ويتضمن إصلاحات وتحسينات.",
  },
  {
    id: "s-example-2",
    title: "مشكلة مؤقتة في البحث",
    sub: "عطل",
    type: "alert",
    published: "2026-05-20 14:30",
    content: "نقوم حالياً بإصلاح خلل يؤثر على نتائج البحث في بعض الأجهزة. نعتذر عن الإزعاج.",
  },
];

async function seedCollection(collName, docs) {
  for (const d of docs) {
    const { id, ...data } = d;
    try {
      await db.collection(collName).doc(id).set(data, { merge: true });
      console.log(`Seeded ${collName}/${id}`);
    } catch (err) {
      console.error(`Failed seeding ${collName}/${id}:`, err.message);
    }
  }
}

(async function main() {
  console.log("Starting Firestore seeding...");
  await seedCollection("news", newsDocs);
  await seedCollection("system", systemDocs);
  console.log("Seeding complete.");
  process.exit(0);
})();
