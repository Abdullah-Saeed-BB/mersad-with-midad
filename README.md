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



## Getting Started
The project has two parts that both need to be running at the same time:
- **Frontend** – the part you see and click on (built with HTML, CSS, and JavaScript)
- **Backend** – the part that powers the AI assistant, Midād (built with Python)
### 1. Install the required tools
Before you start, install these two programs:
1. **Python** – [Download Python here](https://www.python.org/downloads/) (choose the latest version, and during installation, make sure to check the box that says "Add Python to PATH").
2. **uv** – this is the tool used to manage the backend. Open a terminal (on Windows: search for "Command Prompt" or "PowerShell"; on Mac: search for "Terminal") and run:

```
pip install uv
```

You'll also need a code editor to open the project folder. We recommend **[Visual Studio Code](https://code.visualstudio.com/)** — it's free and beginner-friendly (If you expert, use any IDE you prefer and understand). 
### 2. Download the project

1. Click the green **"Code"** button on this GitHub page and choose **"Download ZIP"**.
2. Extract (unzip) the folder somewhere easy to find, like your Desktop.
3. Open that folder in Visual Studio Code.

### 3. Set up and run the backend
1. In Visual Studio Code, open a new terminal (menu: **Terminal → New Terminal**).
2. Navigate into the backend folder:

```
cd backend
```

3. Install all the required Python packages automatically with:

```
uv sync
```

4. Create a file named `.env` inside the `backend` folder, and add your AI API key like this:

```
GEMINI_API_KEY=your-api-key-here
```
*(You can get a free Gemini API key from [Google AI Studio](https://aistudio.google.com/).)*
5. Start the backend server:

```
uv run main.py
```
If everything worked, you'll see a message saying the server is running — leave this terminal window open.

### 4. Run the frontend (what you'll see in your browser)

1. Open a **second** terminal window (keep the backend one running).
2. Navigate into the frontend folder:

```
cd frontend
```

3. Open `index.html` — the easiest way is to right-click the file in Visual Studio Code's file explorer and choose **"Open with Live Server"** (if you don't have this option, install the **Live Server** extension from the Extensions panel first).
4. Your browser will open automatically and show the Mersad app.

### 5. You're ready to go!

With both the backend and frontend running, you can now use Mersad and the Midād AI assistant in your browser. If you ever want to stop the app, just close both terminal windows.

> **Note:** Every time you want to use Mersad again, repeat step 3 and step 4 (starting both the backend and frontend) — you won't need to reinstall anything again.

A couple of things worth confirming before you publish this:

- Whether `uv run main.py` is the actual start command, or if it's something like `uv run uvicorn main:app --reload`
- The exact name of the environment variable for your Gemini API key (I guessed `GEMINI_API_KEY` based on `db/config.py`)
- Whether the frontend needs any config pointing it to the backend's URL/port

If you paste me the contents of `backend/main.py` and `backend/db/config.py`, I can tighten up the exact commands and env variable names.
