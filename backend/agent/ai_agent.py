from typing import TypedDict, Optional, List
from langgraph.graph import StateGraph, START, END
from langchain.chat_models import init_chat_model
import time
import os

from dotenv import load_dotenv
load_dotenv()

# ─────────────────────────────────────────────
# 1. STATE DEFINITION
# ─────────────────────────────────────────────
class AgentState(TypedDict):
    prompt: str                          # User input / request
    context: Optional[str]               # Existing markdown script (optional)
    selected_text: Optional[str]         # Selected portion to update (optional)
    references: Optional[List[str]]      # Previous scripts as reference (optional)
    system_prompt: str                   # Built system prompt fed to LLM
    response: Optional[str]              # Final generated output
    model: Optional[str]                 # Model to use


# ─────────────────────────────────────────────
# 2. SYSTEM PROMPT BUILDER NODES
# ─────────────────────────────────────────────
try:
    with open("./data/base_system_prompt.txt") as f:
        BASE_FORMAT_RULES = f.read()
except Exception as e:
    print("\tError while loading base system prompt:", e)
    
    BASE_FORMAT_RULES = (
        "You are an expert video script writer.\n"
        "Output MUST be simple markdown following these rules:\n"
        " - Write the video title prefixed with a single `#`\n"
        " - Write every scene title prefixed with `##`\n"
        " - Keep the structure clean and easy to read.\n"
        " - No bold ** or italic __, only the markdown format that are provided."
    )


def build_system_prompt_scratch(state: AgentState) -> dict:
    """User wants a brand-new script from scratch."""
    system_prompt = (
        f"{BASE_FORMAT_RULES}\n\n"
        "The user wants you to create a complete video script from scratch. "
        "Plan the scenes, write the narration/dialogue, and keep the pacing engaging."
    )
    return {"system_prompt": system_prompt}


def build_system_prompt_extend(state: AgentState) -> dict:
    """User has a script and wants to add new content to it."""
    system_prompt = (
        f"{BASE_FORMAT_RULES}\n\n"
        "The user has provided an existing video script and wants you to add "
        "new scenes or content after the <|ADD_PART_HERE|> marker that fit "
        "naturally with what already exists. and response only with the new "
        "content, not the whole script.\n\n"
        f"--- Existing script ---\n{state['context']}\n--- End of script ---"
    )
    return {"system_prompt": system_prompt}


def build_system_prompt_update(state: AgentState) -> dict:
    """User wants to update only a specific selected part of the script."""
    system_prompt = (
        f"{BASE_FORMAT_RULES}\n\n"
        "The user wants you to rewrite / update only a specific selected part "
        "of the script. Keep it consistent with the rest of the script, and "
        "response only with new updated part, not with the whole script. \n\n"
        f"--- Full script context ---\n{state['context']}\n--- End of script ---\n\n"
        f"--- Selected text to update ---\n{state['selected_text']}\n--- End of selection ---"
    )
    return {"system_prompt": system_prompt}


# ─────────────────────────────────────────────
# 3. REFERENCES NODE
# ─────────────────────────────────────────────
def add_references(state: AgentState) -> dict:
    """Append references to the system prompt, or skip if none."""
    references = state.get("references")
    system_prompt = state["system_prompt"]

    if references:
        refs_block = "\n\n".join(
            f"Reference #{i + 1}:\n{ref}" for i, ref in enumerate(references)
        )
        system_prompt += (
            "\n\nUse the following previous scripts as a reference for style, "
            "tone and structure:\n" + refs_block
        )
    return {"system_prompt": system_prompt}


# ─────────────────────────────────────────────
# 4. LLM CALL NODE
# ─────────────────────────────────────────────
def call_llm(state: AgentState) -> dict:
    """Feed system_prompt + user prompt to the LLM and return the response."""
    
    model_title = state.get("model") or "gemini-3.1-flash-lite"
    llm = init_chat_model(
        model=model_title,
        model_provider="google_genai",
        api_key=os.getenv("GEMINI_API_KEY")
    )

    print("used model:", model_title)

    messages = [
        {"role": "system", "content": state["system_prompt"]},
        {"role": "user", "content": state["prompt"]},
    ]
    try:
        response = llm.invoke(messages)
        content = response.content[0]["text"]
        # content = "This is a test. content\n# Got the\n## What I\nMean amigo. ;)"
        return {"response": content}
    except Exception as e:
        print("\tError occurs while calling LLM:", e)
        return {"response": f"Error: {str(e)}"}


# ─────────────────────────────────────────────
# 5. ROUTER (decides which prompt-builder to use)
# ─────────────────────────────────────────────
def route_by_context(state: AgentState) -> str:
    has_context = bool(state.get("context"))
    has_selected = bool(state.get("selected_text"))

    if not has_context and not has_selected:
        return "scratch"
    if has_context and not has_selected:
        return "extend"
    if has_context and has_selected:
        return "update"
    return "scratch"


# ─────────────────────────────────────────────
# 6. GRAPH ASSEMBLY
# ─────────────────────────────────────────────
def build_graph():
    graph = StateGraph(AgentState)

    # Register nodes
    graph.add_node("scratch", build_system_prompt_scratch)
    graph.add_node("extend", build_system_prompt_extend)
    graph.add_node("update", build_system_prompt_update)
    graph.add_node("references", add_references)
    graph.add_node("call_llm", call_llm)

    # START → one of the 3 prompt builders (conditional)
    graph.add_conditional_edges(
        START,
        route_by_context,
        {
            "scratch": "scratch",
            "extend": "extend",
            "update": "update",
        },
    )

    # All 3 builders converge → references → call_llm → END
    graph.add_edge("scratch", "references")
    graph.add_edge("extend", "references")
    graph.add_edge("update", "references")
    graph.add_edge("references", "call_llm")
    graph.add_edge("call_llm", END)

    return graph.compile()

agent = build_graph()

def _sse(data: str) -> str:
    """Format a string as a minimal SSE data event."""
    lines = data.split("\n")
    return "".join(f"data: {line}\n" for line in lines) + "\n"    

def call_agent(prompt: str,
               context: Optional[str] = None,
               selected_text: Optional[str] = None,
               references: Optional[List[str]] = None,
               model: Optional[str] = None) -> dict:

    state = {
        "prompt": prompt,
        "context": context,
        "selected_text": selected_text,
        "references": references,
        "system_prompt": "",
        "response": None,
        "model": model,
    }

    result = agent.invoke(state)

    for word in result["response"].split(" "):
        yield _sse(word + " ")
        time.sleep(0.02)
    yield _sse("[DONE]")
