<img width="3840" height="552" alt="banner_en" src="https://github.com/user-attachments/assets/2cb6a327-eec8-4a59-97e8-59d50c8e2469" />
<div align="center">
<span><i>English</i></span> | <a href="https://github.com/Abdullah-Saeed-BB/mersad-with-midad/blob/main/README.md">عربي</a>
</div>

<h1 align="center">Midad</h1>
<h3 align="center">An AI assistant designed to help photographers and writers create content. It is integrated into Mirsad, a platform for organizing and managing photography workflows.</h3>
<h3 align="center">Powered by the <code>Gemini 3.1 Flash-Lite</code> model.</h3>

<h2 align="center">Midad Features</h2>

<img width="3840" height="552" alt="feature_1_mention_content_en" src="https://github.com/user-attachments/assets/c9d28db6-2e3c-4718-a456-e5b80351d5a7" />
<p align="center" dir="ltr">More than just a chatbot—you can reference previously created content without copying and pasting it.</p>
<br>
<br>

<img width="3840" height="552" alt="feature_2_improve_parts_en" src="https://github.com/user-attachments/assets/076f836d-0c7f-4f44-90a0-39efe70153c3" />
<p align="center" dir="ltr">Improve selected text by highlighting the section you want to refine, then clicking the Midad icon or pressing <code>Ctrl + I</code> (or <code>Cmd + I</code> on macOS).</p>
<br>
<br>

<img width="3840" height="552" alt="feature_3_write_from_scratch_en" src="https://github.com/user-attachments/assets/203d7322-e90b-4219-8cab-377ab3e964a4" />
<p align="center" dir="ltr">Generate complete content from scratch with a single prompt.</p>
<br>
<br>

---

## Project Structure

### Frontend
The complete frontend project structure is available in the [`mersad-base`](https://github.com/Abdullah-Saeed-BB/mersad-with-midad/tree/mersad-base#project-structure) branch. Here, I will only explain the files that were added or modified compared to the original branch.
- `src/js/`:
	- `ai-action.js`: Handles sending user requests to the AI, receiving responses, and inserting them into the content editor.
	- `get-scripts.js`: Contains utility functions for retrieving and formatting content.
	- `notification.js`: Handles creating notifications to alert users about errors or important events.
	- `main.js`: Minor modifications to allow loading some functionality from external files.
	- `icon_animation.js`: Controls the loading animation shown while waiting for AI responses.
- `src/index.html`: Added the HTML for the AI assistant popup, allowing users to interact with Midad.
- `src/styles/`
	- `ai-elements.css`: Styles for the AI assistant popup.
	- `icon_animation.css`: Styles for the loading animation.
	- `notification.css`: Styles for the notification system.
- `src/assets/`:
	- Added an `images/` folder containing the Midad logo.
	- Added an `icon_frames/` folder containing the frames used for the loading animation.

### Backend
**Backend directory contents:**
- `main.py`: FastAPI application entry point. Start the backend server from here.
- `dependencies.py`: Shared dependencies for injecting database sessions and application settings.
- `data/base_system_prompt.txt`: Contains the base system prompt for the AI agent.
- `db/`
	- `config.py`: Loads environment variables and application settings.
	- `schemas.py`: Pydantic schemas and data models used for validation.
- `routers/ai_router.py`: API endpoints that allow the frontend to communicate with the AI assistant.
- `agent/ai_agent.py`: The core implementation of the AI agent.

**Technologies used to build the backend:**

<div align="right">
<img src="https://img.shields.io/badge/Python-Programming%20Language-3776AB?style=for-the-badge&logo=python&logoColor=white" alt="Python">
<img src="https://img.shields.io/badge/FastAPI-Backend-009688?style=for-the-badge&logo=fastapi&logoColor=white" alt="FastAPI">
<img src="https://img.shields.io/badge/LangGraph-AI%20Agent-0F172A?style=for-the-badge&logo=langchain&logoColor=white" alt="LangGraph">
</div>

---

## Installation & Setup

> Setting up the project may be challenging for some users. If you encounter any issues, feel free to contact me on [LinkedIn](https://www.linkedin.com/in/abdullahsaeed-dev/) or [X](https://x.com/Abdullah_SBB).

The project consists of two parts that must be running simultaneously:
- **Frontend** – The user interface built with **HTML**, **CSS**, and **JavaScript**.
- **Backend** – The server that powers the **Midad** AI assistant, built with **Python**.

### 1. Install the Required Tools
Before getting started, install the following:
1. **Python** – [Download Python](https://www.python.org/downloads/) and install the latest version (During installation, make sure to enable the **"Add Python to PATH"** option).
2. **uv** – The package and environment manager used for this project. Open a terminal (**Command Prompt** on Windows or **Terminal** on macOS) and run:

```bash
pip install uv
```

You will also need a code editor to open the project folder. I recommend using [Visual Studio Code](https://code.visualstudio.com/), as it is free, beginner-friendly, and widely used.

### 2. Download the Project
1. Click the green **"Code"** button at the top of the repository, then select **"Download ZIP"**.
2. Extract the ZIP file to an easy-to-access location, such as your Desktop.
3. Open the project folder in Visual Studio Code.

### 3. Set Up and Run the Backend
1. In Visual Studio Code, open a new terminal by selecting **Terminal → New Terminal**.
2. Navigate to the backend directory:

```bash
cd backend
```

3. Install all required Python dependencies by running:

```bash
uv sync
```

4. Create a file named `.env` inside the `backend` directory, then add your Gemini API key as follows:

```env
GEMINI_API_KEY=your-api-key-here
```

*(You can obtain a free Gemini API key from [Google AI Studio](https://aistudio.google.com/).)*

5. Start the backend server by running:

```bash
uv run uvicorn main:app
```

If everything is set up correctly, you should see a message similar to:

```text
INFO:     Started server process [random_process_id]
```

Leave this terminal window open while using the application.

### 4. Run the Frontend
1. Install the **Live Server** extension if you haven't already. In Visual Studio Code, open the **Extensions** panel from the left sidebar, search for **Live Server**, and install it.
2. Open the `/frontend/src` folder and locate the `index.html` file. Right-click the file in Visual Studio Code and select **"Open with Live Server"**.
3. Your default browser will open automatically, displaying the **Mirsad** application.

### 5. You're All Set!
Once both the backend server and the frontend are running, you can start using **Mirsad** and the **Midad** AI assistant directly from your browser.

When you're finished, simply close the backend terminal and stop **Live Server**.

> **Note:** The next time you want to use Mirsad, you only need to repeat **Steps 3 and 4** (starting the backend and frontend). You won't need to reinstall any tools or dependencies.

### 6. (Optional) Install Thmanyah Fonts
Visit the official **[Thmanyah Fonts](https://font.thmanyah.com/)** website and download the font package.

After downloading and extracting it, open the `thmanyah typeface` folder. Inside, you'll find two main folders:
- `thmanyahsans`
- `thmanyahserifdisplay`

Copy all font files from `thmanyahsans/otf` into the project's:

```text
src/assets/fonts/thmanyahsans
```

Then copy all font files from `thmanyahserifdisplay/otf` into:

```text
src/assets/fonts/thmanyahserifdisplay
```

Once copied, the application will use the Thmanyah fonts as intended.
