/**
 * ═══════════════════════════════════════════════════════════════
 * FIRESTORE DATA STRUCTURE EXAMPLES
 * أمثلة بنية البيانات في Firestore
 * ═══════════════════════════════════════════════════════════════
 * 
 * انسخ هذه الأمثلة إلى Firestore للاختبار
 * أو استخدمها كمرجع لفهم البنية المطلوبة
 */

// ═══════════════════════════════════════════════════════════════
// 1. مجموعة USERS (بيانات المستخدمين)
// ═══════════════════════════════════════════════════════════════

// المسار: /users/user123
{
  // معرّف فريد
  "uid": "user123",
  
  // البيانات الأساسية
  "name": "أحمد محمد علي",
  "email": "ahmed.mohammed@example.com",
  "phone": "+966551234567",
  "city": "الرياض",
  
  // نوع الحساب
  "userType": "عميل",  // أو "مورد" أو "عضو ذهبي"
  
  // البيانات الشخصية الإضافية
  "bio": "مشتري جملة متخصص في الملابس والنسيج",
  "photoURL": "https://storage.googleapis.com/...",
  "companyName": "الشركة العربية للتجارة",
  "commercialRegistration": "1234567890",
  
  // التفضيلات
  "preferences": {
    "language": "ar",
    "currency": "SAR",
    "notifications": true,
    "emailNotifications": true
  },
  
  // الحالة
  "isActive": true,
  "isVerified": true,
  "isBanned": false,
  
  // المفضلة - قائمة معرفات الموردين المفضلين
  "favorites": [
    "supplier001",
    "supplier002",
    "supplier003"
  ],
  
  // الإحصائيات
  "stats": {
    "totalReviews": 5,
    "averageRating": 4.5,
    "totalPurchases": 12,
    "totalSpent": 45000
  },
  
  // الوقت
  "createdAt": "2024-01-15T10:30:00Z",
  "updatedAt": "2024-05-01T14:45:00Z",
  "lastLoginAt": "2024-05-03T09:15:00Z"
}

// مثال ثاني - مستخدم (مورد)
{
  "uid": "user456",
  "name": "فاطمة علي النويري",
  "email": "fatima.supplier@example.com",
  "phone": "+966559876543",
  "city": "جدة",
  "userType": "مورد",
  "companyName": "مصنع الجودة للملابس",
  "bio": "متخصصون في تصنيع الملابس الحريمي والأطفال",
  "photoURL": "https://storage.googleapis.com/...",
  "commercialRegistration": "9876543210",
  "taxNumber": "123456789012345",
  "preferences": {
    "language": "ar",
    "currency": "SAR",
    "notifications": true,
    "emailNotifications": true
  },
  "isActive": true,
  "isVerified": true,
  "isBanned": false,
  "stats": {
    "totalReviews": 28,
    "averageRating": 4.8,
    "totalProducts": 156,
    "totalSales": 850000
  },
  "createdAt": "2023-06-10T08:00:00Z",
  "updatedAt": "2024-05-01T16:20:00Z",
  "lastLoginAt": "2024-05-03T11:45:00Z"
}

// ═══════════════════════════════════════════════════════════════
// 2. مجموعة SUPPLIERS (بيانات الموردين)
// ═══════════════════════════════════════════════════════════════

// المسار: /suppliers/supplier001
{
  // معرّف فريد (يمكن أن يكون نفس uid المورد)
  "id": "supplier001",
  "userId": "user456",  // ربط مع المستخدم الذي يملك المتجر
  
  // معلومات المتجر
  "name": "مصنع الجودة للملابس",
  "description": "نحن متخصصون في تصنيع الملابس الحريمي والأطفال بجودة عالية وأسعار منافسة. نقدم خدمات تصنيع حسب الطلب وشحن سريع إلى جميع أنحاء المملكة.",
  
  // معلومات التواصل
  "phone": "+966559876543",
  "email": "fatima.supplier@example.com",
  "whatsapp": "+966559876543",
  
  // الموقع
  "city": "جدة",
  "district": "النسيم",
  "address": "الشارع التجاري الثالث، مصنع رقم 45",
  "zipCode": "23445",
  "coordinates": {
    "latitude": 21.5433,
    "longitude": 39.1728
  },
  
  // نوع العمل
  "category": "الملابس والنسيج",
  "subcategories": [
    "ملابس نسائية",
    "ملابس أطفال",
    "ملابس رياضية"
  ],
  
  // المنتجات
  "products": [
    {
      "name": "فستان نسائي مطرز",
      "price": 45,
      "minimumOrder": 10,
      "description": "فستان فاخر بتطريز يدوي"
    },
    {
      "name": "ملابس أطفال قطن",
      "price": 20,
      "minimumOrder": 50,
      "description": "ملابس أطفال من القطن 100%"
    }
  ],
  
  // معلومات العمل
  "businessHours": {
    "monday": { "open": "08:00", "close": "17:00" },
    "tuesday": { "open": "08:00", "close": "17:00" },
    "wednesday": { "open": "08:00", "close": "17:00" },
    "thursday": { "open": "08:00", "close": "17:00" },
    "friday": { "open": "off", "close": "off" },
    "saturday": { "open": "09:00", "close": "16:00" },
    "sunday": { "open": "off", "close": "off" }
  },
  
  // الحالة
  "isActive": true,
  "isVerified": true,
  "isFeatured": false,  // متجر مميز؟
  
  // الإحصائيات
  "stats": {
    "totalReviews": 28,
    "averageRating": 4.8,
    "totalProducts": 156,
    "totalSales": 850000,
    "responseTime": "ساعة واحدة",
    "returnRate": "2%"
  },
  
  // الصور
  "images": [
    "https://storage.googleapis.com/store-001-cover.jpg",
    "https://storage.googleapis.com/store-001-product-1.jpg",
    "https://storage.googleapis.com/store-001-product-2.jpg"
  ],
  
  // الشهادات والترخيصات
  "certificates": [
    {
      "name": "شهادة الجودة ISO 9001",
      "issuer": "هيئة التقييس والمقاييس",
      "issueDate": "2023-01-10",
      "expiryDate": "2026-01-10"
    }
  ],
  
  // الوقت
  "createdAt": "2023-06-10T08:00:00Z",
  "updatedAt": "2024-05-01T16:20:00Z"
}

// مثال ثاني - مورد آخر
{
  "id": "supplier002",
  "userId": "user789",
  "name": "أنسجة الفخامة للمفروشات",
  "description": "متخصصون في بيع الأقمشة الفاخرة والمفروشات",
  "phone": "+966541234567",
  "email": "luxury.textiles@example.com",
  "city": "الرياض",
  "category": "الأقمشة والمفروشات",
  "subcategories": ["أقمشة فاخرة", "مفروشات فندقية"],
  "stats": {
    "totalReviews": 15,
    "averageRating": 4.6,
    "totalSales": 500000
  },
  "createdAt": "2023-09-20T12:00:00Z",
  "updatedAt": "2024-05-02T10:30:00Z"
}

// ═══════════════════════════════════════════════════════════════
// 3. مجموعة REVIEWS (التقييمات والتعليقات)
// ═══════════════════════════════════════════════════════════════

// المسار: /reviews/review001
{
  // معرّفات
  "id": "review001",
  "userId": "user123",
  "supplierId": "supplier001",
  "supplierName": "مصنع الجودة للملابس",
  
  // التقييم
  "rating": 5,  // من 1 إلى 5
  "title": "متجر ممتاز وخدمة احترافية",
  "text": "الحمد لله، أول مرة أتعامل معهم وكانت التجربة رائعة جداً. الجودة عالية، السعر مناسب، والخدمة سريعة وموثوقة. بالتأكيد سأتعامل معهم مرة أخرى وأنصح الجميع بهم.",
  
  // التفاصيل الإضافية
  "productCategory": "الملابس النسائية",
  "orderValue": 5000,  // قيمة الطلب
  "deliveryTime": "2 أيام",
  "qualityRating": 5,
  "priceRating": 5,
  "serviceRating": 5,
  "shippingRating": 5,
  
  // التصور
  "helpful": 12,  // عدد من وجدوا التقييم مفيداً
  "images": [
    "https://storage.googleapis.com/review-001-product.jpg",
    "https://storage.googleapis.com/review-001-packaging.jpg"
  ],
  
  // ردود المورد
  "supplierResponse": {
    "text": "شكراً لك على تقييمك الرائع! نحن نسعى دائماً لتقديم أفضل الخدمات. ننتظر منك مرة أخرى.",
    "respondedAt": "2024-04-28T15:30:00Z"
  },
  
  // الوقت
  "createdAt": "2024-04-25T10:15:00Z",
  "updatedAt": "2024-04-28T15:30:00Z"
}

// مثال ثاني - تقييم متوسط
{
  "id": "review002",
  "userId": "user456",
  "supplierId": "supplier002",
  "supplierName": "أنسجة الفخامة للمفروشات",
  "rating": 4,
  "title": "جيد لكن التسليم تأخر قليلاً",
  "text": "المنتج ممتاز والجودة عالية جداً. لكن الشحن استغرق وقت أطول من المتوقع. مع ذلك، الخدمة اللاحقة كانت جيدة والمتجر تعاون معي.",
  "productCategory": "الأقمشة الفاخرة",
  "orderValue": 3500,
  "deliveryTime": "4 أيام",
  "qualityRating": 5,
  "priceRating": 4,
  "serviceRating": 4,
  "shippingRating": 3,
  "helpful": 3,
  "createdAt": "2024-04-20T14:00:00Z"
}

// مثال ثالث - تقييم منخفض
{
  "id": "review003",
  "userId": "user789",
  "supplierId": "supplier001",
  "supplierName": "مصنع الجودة للملابس",
  "rating": 2,
  "title": "جودة أقل من المتوقع",
  "text": "الصور جميلة لكن المنتج الفعلي جودته أقل. الألوان غير متطابقة مع الصور. طلبت استرجاع لكن المتجر لم يرد على رسائلي.",
  "productCategory": "الملابس الأطفال",
  "orderValue": 2000,
  "qualityRating": 2,
  "priceRating": 2,
  "serviceRating": 1,
  "helpful": 8,
  "createdAt": "2024-04-15T09:30:00Z"
}

// ═══════════════════════════════════════════════════════════════
// 4. الحقول المهمة والأنواع المتوقعة
// ═══════════════════════════════════════════════════════════════

/*
معلومات النوع والقيم المتوقعة:

STRING:
- name: "أحمد محمد علي"
- email: "ahmed@example.com"
- phone: "+966551234567"
- city: "الرياض"
- category: "الملابس والنسيج"

NUMBER:
- rating: 5  (1-5)
- price: 45
- minimumOrder: 10
- averageRating: 4.8

BOOLEAN:
- isActive: true
- isVerified: true
- notifications: true

TIMESTAMP:
- createdAt: Timestamp.now()
- updatedAt: Timestamp.now()

ARRAY:
- favorites: ["supplier001", "supplier002"]
- images: ["url1", "url2"]
- subcategories: ["الملابس النسائية", "الملابس الأطفال"]

MAP/OBJECT:
- stats: { totalReviews: 28, averageRating: 4.8 }
- coordinates: { latitude: 21.5433, longitude: 39.1728 }
- businessHours: { monday: { open: "08:00" } }
*/

// ═══════════════════════════════════════════════════════════════
// 5. نصائح مهمة
// ═══════════════════════════════════════════════════════════════

/*
✅ أفضل الممارسات:

1. استخدم معرفات فريدة:
   - للمستخدمين: uid من Firebase Auth
   - للموردين: أنشئ معرف فريد أو استخدم uid المورد
   - للمراجعات: استخدم معرفات تلقائية من Firestore

2. تنظيم البيانات:
   - ضع بيانات المستخدم في مجموعة users
   - ضع بيانات الموردين في مجموعة suppliers
   - ضع التقييمات في مجموعة reviews

3. الفهرسة:
   - أنشئ فهارس للحقول التي تبحث عليها كثيراً
   - مثل: userId في مجموعة reviews
   - مثل: city في مجموعة suppliers

4. الوقت:
   - استخدم Timestamp بدلاً من String
   - هذا يسهل الفرز والمقارنة

5. الحجم:
   - لا تخزن ملفات ضخمة في Firestore
   - استخدم Cloud Storage للصور والملفات
   - ضع روابط الصور فقط في Firestore

6. الأمان:
   - لا تخزن كلمات المرور
   - استخدم Firebase Auth للمصادقة
   - حدد قوانين الأمان بشكل صارم
*/
