<img width="3840" height="552" alt="banner" src="https://github.com/user-attachments/assets/4419015c-e670-4ce3-a246-4ed81b6d32eb" />

<h1 align="center">مِداد</h1>
<h3 align="center">هو مساعد ذكاء اصطناعي صمم لمساعدة المصورين والكُتاب في كتابة محتوى, وهو اضافة في مِرصاد وهو تطبيق لتنظيم وإدارة عمليات التصوير.</h3>
<h3 align="center">تم استعمال نموذج <code>Gemini 3.1 Flash-Lite</code> كعقل لي مِداد.</h3>


<h2 align="center">إمكانيات مِداد</h2>

<img width="3840" height="552" alt="feature_1_mention_content" src="https://github.com/user-attachments/assets/3e8de1c2-0a09-40e6-98bd-e801485d91ab" />
<p align="center">فهو ليس مجرد روبوت محادثة, فتستطيع الإشارة لمحتويات سابقة من دون حاجة لي نسخ المحتوى ولصقها.</p>
<br>
<br>

<img width="3840" height="552" alt="feature_2_impove_parts" src="https://github.com/user-attachments/assets/e430f28d-670d-4327-8153-8810f5a70e76" />
<p align="center">القدرة على تحسين النص عن طريق تحديد الجزئية التي تريد تحسينها والضغط على ايقونة مِداد او ضغط على Ctrl + I او Cmd + I</p> 
<br>
<br>

<img width="3840" height="552" alt="feature_3_write_from_scratch" src="https://github.com/user-attachments/assets/d0b6db9e-a80b-46fa-81bd-afe7a9b87c1a" />
<p align="center">إنشاء محتوى كامل من الصفر خلال ارسال الطلب واحد لي مِداد.</p> 
<br>
<br>

---

## هيكلة المشروع 
### الواجهة (Frontend)
كامل تفاصيل هيكلة المشروع للواجهة متواجدة في فرع (Branch) الـ [mersad-base](https://github.com/Abdullah-Saeed-BB/Mersad-1.0-organized/tree/mersad-base#%D9%87%D9%8A%D9%84%D9%83%D8%A9-%D8%A7%D9%84%D9%85%D8%B4%D8%B1%D9%88%D8%B9), سأشرح هنا ما تم اضافته وتعديله فقط من الفرع الاصلي:
 - مجلد `src/js`:
	 - إنشاء `ai-action.js`: يحتوي على جميع الاكواد الخاصة لإرسال طلب المستخدم للذكاء الاصطناعي, وتحميل الإجابة ووضعها في محرر المحتوى.
	 - إنشاء `get-scripts.js`: يحتوي على اوامر الخاصة بي بجلب المحتويات وتنسيقها.
	 - إنشاء `notification.js`: يحتوي على اوامر لإنشاء إشعارات لتحذير المستخدم بأمر ما او بحدوث خطأ.
	 - تعديل على `main.js`: تم عمل تعديلات بسيطة, لأتمكن من تحميل بعض الأوامر من خارج الملف.
	 - إنشاء `icon_animation.js`: يحتوي على جميع الاوامر الخاصة بي تشغيل وإطفاء انميشن الانتظار.
 - تعديل على `src/index.html`: تم إضافة اكواد *HTML* الخاصة بي القائمة المنبثقة ليتمكن المستخدم بالتواصل مع الذكاء الاصطناعي. 
 - مجلد `src/styles`:
	 - إنشاء `ai-elements.css`: يحتوي على تنسيقات بالقائمة المنبثقة.
	 - إنشاء `icon_animation.css`: يحتوي على تنسيقات لانميشن الانتظار.
	 - إنشاء `notification.css`: يحتوي على تنسيقات الإشعارات.
 - مجلد `src/assets`:
	 - تم إضافة مجلد `images/` الذي يحتوي على شعار مِداد, و إضافة مجلد `icon_frames/` الذي يحتوي على إطارات لانميشن الانتظار.

### الخادم (Backend)
**محتويات مجلد الخادم:**
 - الـ `main.py`: نقطة الدخول لتطبيق FastAPI. ابدأ تشغيل الخادم من هنا.
 - الـ `dependencies.py`: الاعتماديات المشتركة. حقن جلسات قاعدة البيانات والإعدادات.
 - الـ `data/base_system_prompt.txt`: يحتوي على التعليمات الأساسية لوكيل الذكاء الاصطناعي.
 - الـ `db/`: 
	 - الـ `config.py`: تحميل متغيرات البيئة وإعدادات التطبيق.
	 - الـ `schemas.py`: مخططات التحقق باستخدام Pydantic ونماذج البيانات.
 - الـ `routers/ai_router`: نقاط النهاية التي تمكن الواجهة بالتواصل مع الذكاء الاصطناعي,.
 - الـ `agent/ai_agent.py`: الكود الرئيسي لعمليات وكيل الذكاء الاصطناعي.

**الأدوات المستعملة لبناء الخادم:**

<div align="right">
<img src="https://img.shields.io/badge/Python-Programming%20Languge-3776AB?style=for-the-badge&logo=python&logoColor=white" alt="Python">
<img src="https://img.shields.io/badge/FastAPI-Backend-009688?style=for-the-badge&logo=fastapi&logoColor=white" alt="FastAPI">
<img src="https://img.shields.io/badge/LangGraph-AI%20Agent-0F172A?style=for-the-badge&logo=langchain&logoColor=white" alt="LangGraph">
</div>


## التثبيت و التشغيل
> قد تكون عملية التثبيت المشروع معقدة لدى البعض, فإذا واجهتكم اي مشكلة لا تتردو بالتواصل معي في [لينكدإن](https://www.linkedin.com/in/abdullahsaeed-dev/) او [أكس](https://x.com/Abdullah_SBB) (تويتر سابقاً).

يتكون المشروع من جزأين يجب تشغيلهما في الوقت نفسه:
- **الواجهة الأمامية (Frontend)** – وهي الجزء الذي تراه وتتفاعل معه (مبني باستخدام HTML وCSS وJavaScript).
- **الخادم (Backend)** – وهي الجزء الذي يشغّل المساعد الذكي **مِداد** (مبني باستخدام Python).
### 1. تثبيت الأدوات المطلوبة
قبل البدء، قم بتثبيت البرنامجين التاليين:
1. **لغة بايثون** – قم [بتنزيل بايثون](https://www.python.org/downloads/) واختر أحدث اصدار (أثناء التثبيت تأكد من تفعيل خيار **"Add Python to PATH"**).
2. **اداة uv** – وهي الأداة المستخدمة لإدارة الخادم, لتحميلها افتح الطرفية (في نظام ويندوز: ابحث عن **Command Prompt**, وفي نظام ماك: ابحث عن **Terminal**) ثم نفذ الأمر التالي:

```bash
pip install uv
```

ستحتاج أيضًا إلى محرر أكواد لفتح مجلد المشروع. نوصي باستخدام [Visual Studio Code](https://code.visualstudio.com/)، فهو مجاني وسهل الاستخدام للمبتدئين.
### 2. تنزيل المشروع
1. اضغط على الزر الأخضر **"Code"** في أعلى الصفحة، ثم اختر **"Download ZIP"**.
2. فك ضغط الملف (Extract/Unzip) في مكان يسهل الوصول إليه، مثل سطح المكتب.
3. افتح مجلد المشروع باستخدام Visual Studio Code.
### 3. إعداد وتشغيل الخادم (Backend)
1. في Visual Studio Code، افتح طرفية جديدة من القائمة: **Terminal → New Terminal**.
2. انتقل إلى مجلد الخادم:

```bash
cd backend
```

3. ثبّت جميع حزم Python المطلوبة تلقائيًا باستخدام:

```bash
uv sync
```

4. أنشئ ملفًا باسم `env.` داخل مجلد `backend` ، ثم أضف مفتاح واجهة برمجة التطبيقات (API Key) الخاص بالذكاء الاصطناعي Gemini, بالشكل التالي:

```env
GEMINI_API_KEY=your-api-key-here
```

_(يمكنك الحصول على مفتاح Gemini API مجاني من [Google AI Studio](https://aistudio.google.com/.))_

5. شغّل الخادم عن طريق الأمر التالي:

```bash
uv run uvicorn main:app
```

إذا تم كل شيء بنجاح، فستظهر رسالة تفيد بأن الخادم يعمل، مثل:

```text
INFO:     Started server process [رقم_عشوائي]
```

اترك نافذة الطرفية هذه مفتوحة.
### 4. تشغيل الواجهة الأمامية (Frontend)
1. ثبّت إضافة **Live Server** إذا لم تكن مثبتة، وذلك من الذهاب إلى لوحة **Extensions** الموجودة في الجانب الأيسر من Visual Studio Code, ثم البحث عن **Live Server**.
2. افتح المجلد `/frontend/src`، ثم ابحث عن الملف `index.html`. انقر بزر الفأرة الأيمن على الملف داخل Visual Studio Code، ثم اختر **"Open with Live Server"**.
3. سيفتح المتصفح تلقائيًا، وستظهر لك واجهة تطبيق **مرصاد**.

### 5. أصبح كل شيء جاهزًا!
بعد تشغيل كلٍ من الخادم والواجهة الأمامية، يمكنك الآن استخدام **مرصاد** والمساعد الذكي **مداد** مباشرةً من خلال المتصفح.

وعندما تنتهي من استخدام التطبيق، يكفي إغلاق نافذة الطرفية الخاصة بالخادم وإيقاف **Live Server**.

> **ملاحظة:** في كل مرة ترغب فيها باستخدام مرصاد مرة أخرى، كرر الخطوتين **3** و**4** فقط (تشغيل الخادم والواجهة الأمامية). لن تحتاج إلى إعادة تثبيت أي من الأدوات أو الحزم مرة أخرى.

### 6. (اختياري) تثبيت خطوط ثمانية

إذهب لي موقع الرسمي لي [خطوط ثمانية](https://font.thmanyah.com/) وقم بي تحميل الخطوط, بعد تحميل وفك الضغط للمجلد, إذهب لي مجلد `thmanyah typeface`  وسيتواجد مجلدين اساسين هما:

- مجلد `thmanyahsans`.
- مجلد `thmanyahserifdisplay`.

قم بنسخ جميع الخطوط المتواجدة في `thmanyahsans\otf`, ثم اذهب لي محتويات المشروع والصقها في مسار `src\assets\fonts\thmanyahsans`, وقم بنفس العملية للمسار الاخر, نسخ جميع الخطوط المتواجدة في `thmanyahserifdisplay/otf`, ثم الذهاب لمحتويات المشروع والصقها في مسار `src\assets\fonts\thmanyahserifdisplay`.
