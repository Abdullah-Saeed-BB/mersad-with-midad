<img width="1920" height="422" alt="mersad_repo_banner" src="https://github.com/user-attachments/assets/17d7e1e2-97e3-4780-a357-26ae605d428c" />

# مِرصاد (النسخة المنظمة)

مِرصاد هو مشروع انشائه الاستاذ [حاتم النجار](https://github.com/HatemAlNajjar) ليساعد المصورين في لإدارة وتنظيم عمليات التصوير ( زي الـ **Call Sheet**). يوجد [مقطع في اليوتيوب](https://www.youtube.com/watch?v=77tL-XDIPhk) يشرح المشروع بشكل مفصل.

انشئت هذي نسخة من مشروع مِرصاد (النسخة المنظمة) لتسهل على مجتمع المبرمجين التعديل و التطوير على تطبيق مِرصاد. تم اعادة تصميم هيكلة المشروع لتتماشة مع افضل ممارسات تطوير تطبيقات الويب, فتم وضع الاكواد في مجلد الـ `/src` فصل الاكواد الـ _CSS_ و الـ _Javascript_ في مجلدات مختلفة.

كتبت طريقة تشغيل المشروع وطريقة تثبيت **خطوط ثمانية** في تطبيق مِرصاد في فقرة **"التثبيت و التشغيل"**.

## هيلكة المشروع

```
Mersad-1.0-organized/
├── public/
│   ├── icon-192.png                 # أيقونة تطبيق الـ PWA بحجم 192x192
│   └── icon-512.png                 # أيقونة تطبيق الـ PWA بحجم 512x512
├── src/
│   ├── assets/fonts/
│   │   ├── thmanyahsans/           # يحتوي على جميع ملفات خط ثمانية (thmanyah sans)
│   │   ├── thmanyahserifdisplay/   # يحتوي على جميع ملفات خط ثمانية عريض (thmanyah serif display)
│   ├── js/
│   │   ├── auth.js                  # يتعامل مع مصادقة المستخدمين (الربط مع Firebase Auth)
│   │   ├── main.js                  # المتحكم الرئيسي بالتطبيق لمنطق لوحة التحكم، الحالة (State)، والتفاعل
│   │   ├── service-worker.js       # الإعدادات الأساسية لملف الـ service worker
│   │   └── sony-fx3.js             # منطق الربط وملفات التحكم الخاصة بكاميرا Sony FX3
│   ├── styles/
│   │   ├── global.css               # تنسيقات CSS المظهر العام، الكلاسات المساعدة (Utility)، والمتغيرات الأساسية
│   │   ├── index.css                # تنسيقات CSS واجهة المستخدم الخاصة بلوحة التحكم الرئيسية ومكوناتها
│   │   └── teleprompter.css        # تنسيقات CSS مخصصة لنمط عرض الملقن (Teleprompter)
│   ├── index.html                   # نقطة الدخول الرئيسية وواجهة المستخدم للتطبيق
│   ├── sw.js                        # تفعيل الـ service worker للتخزين المؤقت دون اتصال (Offline Caching) والـ PWA
│   └── teleprompter.html            # هيكل HTML الخاص بوحدة الملقن (Teleprompter) المدمجة
├── firebase.json                    # ملف إعدادات خدمات Firebase Hosting و Firestore و Storage
├── firestore.rules                  # قواعد الأمان التي تحدد صلاحيات الوصول لمجموعات Firestore
├── manifest.json                    # ملف بيان الويب (Manifest) الذي يحدد البيانات الوصفية لتطبيق الـ PWA
├── README.md                        # نظرة عامة على المشروع والتوثيق العام
└── storage.rules                    # قواعد الأمان التي تحدد صلاحيات الوصول لخدمة Firebase Cloud Storage
```

## التثبيت و التشغيل

### تحميل التطبيق

يمكنك تحميل المشروع عن طريق ضغط على زر **"Code"** اعلى صفحة المشروع و الضغط على **"Download ZIP"** وسيتحمل معك, او إذا كان لديك Git مثبت في جهازك اكتب الامر التالي في الـ **Terminal** (او **CMD**) وسيحمل المشروع:

```git
git clone https://github.com/Abdullah-Saeed-BB/Mersad-1.0-organized.git
```

### التشغيل التطبيق

بعد التحميل, افتح المشروع في **Visual Studio Code** (او اي محرر اكواد يناسبك), وقم بي تثبيت اضافة **Live Server** عن طريق الذهاب لقسم **Extensions** و كتابة اسم الإضافة في محرك البحث.

بعد التحميل, اذهب لملف الـ `src/index.html` واضغط على زر الماوس الأيمن, واضغط على خيار  **"Open with Live Server"** وسيفتح لك المتصفح مع صفحة التطبيق. URL الصفحة:

```URL
http://127.0.0.1:5500/src/index.html
```

### تثبيت خطوط ثمانية

إذهب لي موقع الرسمي لي [خطوط ثمانية](https://font.thmanyah.com/) وقم بي تحميل الخطوط, بعد تحميل وفك الضغط للمجلد, إذهب لي مجلد `thmanyah typeface`  وسيتواجد مجلدين اساسين هما:

- مجلد `thmanyahsans`.
- مجلد `thmanyahserifdisplay`.

قم بنسخ جميع الخطوط المتواجدة في `thmanyahsans\otf`, ثم اذهب لي محتويات المشروع والصقها في مسار `src\assets\fonts\thmanyahsans`, وقم بنفس العملية للمسار الاخر, نسخ جميع الخطوط المتواجدة في `thmanyahserifdisplay/otf`, ثم الذهاب لمحتويات المشروع والصقها في مسار `src\assets\fonts\thmanyahserifdisplay`.

وبس ☺️.
