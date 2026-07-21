const BASE_FORMAT_RULES = `You are an expert video script writer.
Output MUST be simple markdown following these rules:
- If the user's script is in English, respond in English, if the user's script is in Arabic, respond in Arabic.
- Write the video title prefixed with a single \`#\`.
- Write every scene title prefixed with \`##\`.
- Every content must be under scene, and every scene must be under video.
- Do not add scene's content without a title scene, and Do not add scenes without video.
- Keep the structure clean and easy to read.
- No bold **, italic __, or horizontal line ---, only the markdown format that are provided.`;

function buildSystemPrompt(state) {
    let sysPrompt = BASE_FORMAT_RULES + "\n\n";

    if (!state.context && !state.selected_text) {
        sysPrompt += "The user wants you to create a complete video script from scratch. Plan the scenes, write the narration/dialogue, and keep the pacing engaging.";
    } else if (state.context && !state.selected_text) {
        sysPrompt += "The user has provided an existing video script and wants you to add new scenes or content after the <|ADD_PART_HERE|> marker that fit naturally with what already exists. and response only with the new content, not the whole script.\n\n" +
                     "--- Existing script ---\n" + state.context + "\n--- End of script ---";
    } else if (state.context && state.selected_text) {
        sysPrompt += "The user wants you to rewrite / update only a specific selected part of the script. Keep it consistent with the rest of the script, and response only with new updated part, not with the whole script. \n\n" +
                     "--- Full script context ---\n" + state.context + "\n--- End of script ---\n\n" +
                     "--- Selected text to update ---\n" + state.selected_text + "\n--- End of selection ---";
    }

    if (state.references && state.references.length > 0) {
        const refsBlock = state.references.map((ref, i) => {
            const content = ref.markdown || ref.text || JSON.stringify(ref);
            return `Reference #${i + 1}:\n${content}`;
        }).join('\n\n');
        sysPrompt += "\n\nUse the following previous scripts as a reference for style, tone and structure:\n" + refsBlock;
    }

    return sysPrompt;
}

export async function* callAgent(state) {
    let apiKey = localStorage.getItem("GEMINI_API_KEY");
    if (!apiKey) {
        apiKey = prompt("Please enter your Gemini API Key:");
        if (apiKey) {
            localStorage.setItem("GEMINI_API_KEY", apiKey);
        } else {
            throw new Error("API Key required for AI generation.");
        }
    }

    const sysPrompt = buildSystemPrompt(state);
    const model = state.model || "gemini-3.1-flash-lite";

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse&key=${apiKey}`;

    const body = {
        systemInstruction: { parts: [{ text: sysPrompt }] },
        contents: [{ role: "user", parts: [{ text: state.prompt }] }]
    };

    const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
    });

    if (!response.ok) {
        const err = await response.text();
        throw new Error(`Gemini API Error: ${err}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder("utf-8");
    let buffer = "";

    while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        let lines = buffer.split('\n');
        buffer = lines.pop() || "";

        for (let line of lines) {
            if (line.startsWith('data: ')) {
                let dataStr = line.substring(6).trim();
                if (dataStr === "[DONE]") continue;
                try {
                    const data = JSON.parse(dataStr);
                    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
                    if (text) {
                        yield text;
                    }
                } catch (e) {
                    console.error("JSON parse error on SSE chunk:", e, dataStr);
                }
            }
        }
    }
}
