# Firestore news/system examples

Use these example documents to seed your Firestore `news` and `system` collections.

## /news/n-example-1
{
  "id": "n-example-1",
  "title": "تخفيضات نهاية الموسم",
  "sub": "عروض",
  "published": "2026-05-30 10:00",
  "content": "متاجر مختارة تقدم خصومات حتى 40% على منتجات مختارة.",
  "districtId": "kitchen",
  "marketIdx": 2,
  "link": ""
}

## /news/n-example-2
{
  "id": "n-example-2",
  "title": "افتتاح متجر جديد",
  "sub": "افتتاح",
  "published": "2026-05-28 09:00",
  "content": "تم افتتاح متجر GREEN HILL SPORT في سوق الرياضة.",
  "districtId": "sports",
  "marketIdx": 8
}

## /system/s-example-1
{
  "id": "s-example-1",
  "title": "تحديث التطبيق — الإصدار 2.3",
  "sub": "تحديث",
  "type": "update",
  "published": "2026-05-15 09:00",
  "content": "تم إطلاق الإصدار 2.3 من كنوز العلمة ويتضمن إصلاحات وتحسينات."
}

## /system/s-example-2
{
  "id": "s-example-2",
  "title": "مشكلة مؤقتة في البحث",
  "sub": "عطل",
  "type": "alert",
  "published": "2026-05-20 14:30",
  "content": "نقوم حالياً بإصلاح خلل يؤثر على نتائج البحث في بعض الأجهزة. نعتذر عن الإزعاج."
}

## Ways to apply
- Use the Firebase Console: create collection `news` and `system`, then add documents with the fields above.
- Or run the seed script included in `scripts/seedFirestore.js`:

```bash
npm init -y
npm install firebase-admin
# download serviceAccountKey.json into project root
node scripts/seedFirestore.js
```

This will create the example documents automatically.
