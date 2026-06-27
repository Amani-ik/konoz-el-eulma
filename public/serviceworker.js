// تعريف اسم الحاوية البرمجية لإصدار الكاش الحالي
const CACHE_NAME = "konoz-v1";

// المصفوفة البرمجية للملفات الثابتة المراد تخزينها
const ASSETS = ["/", "/index.html", "/style.css", "/script.js"];

// حدث التثبيت: يتم فيه تسجيل الملفات برمجياً داخل المتصفح
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log("✓ تم حفظ الأصول البرمجية بنجاح.");
      return cache.addAll(ASSETS);
    }),
  );
});

// حدث الجلب: استرداد الملفات من الكاش عند تصفح الموقع
self.addEventListener("fetch", (event) => {
  event.respondWith(
    caches.match(event.request).then((response) => {
      return response || fetch(event.request);
    }),
  );
});
