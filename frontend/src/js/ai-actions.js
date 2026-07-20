import { ceUpdateStats, ceUpdateWriterPh, ceWriterSave, uid, getAllProjects, _allShots, _findSegForShot } from './main.js';
import { getVideoScriptMarkdown, getProjectMarkdown, refreshProjects } from './get-scripts.js'
import { notify } from './notification.js';
import { showAnimation, hideAnimation } from './icon_animation.js';

let selectedText = null
let currentSelectionRange = null;
let currentAIActionType = null

document.addEventListener('DOMContentLoaded', () => {
  const writerDiv = document.getElementById('ceWriterDiv');
  const selectionIcon = document.getElementById('ceSelectionIcon');
  const buttonIcon = document.getElementById('ceMidadOpenButton');
  let selectedTextSnapshot = ""; // Store chosen text globally to pass it to the popup

  // 1. Listen for user selections globally
  document.addEventListener('selectionchange', () => {
    const sel = window.getSelection();
    
    // Safety check: ensure selection is valid, contains text, and is inside our editor
    if (!sel || sel.isCollapsed || !sel.toString().trim() || !writerDiv.contains(sel.anchorNode)) {
      selectionIcon.style.display = 'none';
      return;
    }

    selectedTextSnapshot = sel.toString().trim();
    const range = sel.getRangeAt(0);
    currentSelectionRange = range.cloneRange();

    const rects = range.getClientRects();

    if (rects.length > 0) {
      // Get structural layout details relative to the visible window viewport
      const rect = rects[0]; 
      
      // Calculate coordinates relative to document flow (accounting for scrolling)
      const topPosition = rect.top + window.scrollY - 8; // 8px margin safety gap above text
      const leftPosition = rect.left + window.scrollX + (rect.width / 2); // Perfectly centered

      selectionIcon.style.top = `${topPosition}px`;
      selectionIcon.style.left = `${leftPosition}px`;
      selectionIcon.style.display = 'flex';
    }
  });

  // Hide the floating icon instantly if the user clicks anywhere else
  document.addEventListener('mousedown', (e) => {
    if (e.target !== selectionIcon && !writerDiv.contains(e.target)) {
      selectionIcon.style.display = 'none';
    }
  });

  // 2. Click handler for the floating action icon
  selectionIcon.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    // Clear the active cursor highlight selection gracefully
    window.getSelection().removeAllRanges();
    selectionIcon.style.display = 'none';

    selectedText = selectedTextSnapshot;
    showTopPopup('improve-part');
  });

  // Click handler for the Midad button, shows when script empty
  buttonIcon.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    // Clear the active cursor highlight selection gracefully
    window.getSelection().removeAllRanges();

    selectedText = selectedTextSnapshot;
    showTopPopup('write-from-scratch');
  });
});

// 3. Popup Utilities
// Types of popups: write-from-scratch, improve-part, add-new-part
async function showTopPopup(type) {
  await refreshProjects();

  const popupBg = document.getElementById("ceTopPopupBg");
  popupBg.style.display = "block";

  currentAIActionType = type

  if (type === 'add-new-part') {
    const sel = window.getSelection();
    const writerDiv = document.getElementById('ceWriterDiv');
    if (sel && sel.rangeCount > 0 && writerDiv && writerDiv.contains(sel.anchorNode)) {
      currentSelectionRange = sel.getRangeAt(0).cloneRange();
    }
  }

  const popup = document.getElementById('ceTopPopup');
  const description = document.getElementById('cePopupDescription');
  const promptInput = document.getElementById('cePromptInput');

  if (promptInput) {
    setTimeout(() => {
      promptInput.focus();
    }, 100);
  } else {
    notify("التطبيق لم يتعرف على مربع الكتابة", "warning");
  }

  if (description) {
    let newDesc = "معك مِداد, "
    if (type == 'improve-part') {
      newDesc = newDesc + 'ما الذي تريد تحسينه في النص المحدد؟'
    } else if (type == 'add-new-part') {
      newDesc = newDesc + 'ما هي المشاهد التي تريد اضافتها؟'
    } else {
      newDesc = newDesc + 'ماذا تريدني ان اكتب لك؟'
    }
    description.innerText = newDesc
  }

  if (!popup) return;

  popup.style.display = 'block';

  requestAnimationFrame(() => {
    popup.classList.add('show');
  });
}

function hidePopupBg() {
  const popupBg = document.getElementById("ceTopPopupBg");
  popupBg.style.display = "none";
}

export function closeTopPopup(shouldHidePopupBg=true) {
  const popup = document.getElementById('ceTopPopup');
  
  if (!popup) return;
  
  if (shouldHidePopupBg) hidePopupBg();
  
  popup.classList.remove('show');
  
  // Wait out the CSS layout opacity transition before setting visibility to none
  setTimeout(() => {
    if (!popup.classList.contains('show')) {
      popup.style.display = 'none';
    }
  }, 300);
}

async function extarctPromptData(promptElm) {
  const clone = promptElm.cloneNode(true);

  const badges = clone.querySelectorAll('.ce-script-badge');

  let references = [];

  for (const badge of badges) {
    const badgeId = badge.dataset.id

    if (!references.find((ref) => ref.id == badgeId)) { 
      const markdown = await getProjectMarkdown(badgeId);
      
      const ref = {
        id: badgeId,
        title: badge.dataset.name,
        markdown: markdown,
      };
      references.push(ref)
    }
      
    let badgeText = badge.textContent.trim();

    badgeText = badgeText.replace(/^📁\s*/, '');

    badge.textContent = `(${badgeText})`;
  }

  return [clone.textContent.trim(), references];
}

// Build markdown from the editor DOM, inserting a cursor marker at the saved range position
function buildContextWithCursorMarker(writerDiv, savedRange) {
  if (!writerDiv || !savedRange) return null;

  // 1. Ensure the selection is actually inside the writerDiv
  if (!writerDiv.contains(savedRange.startContainer)) {
    console.warn("Cursor is outside the writer div. Cannot insert marker.");
    return null; 
  }

  const children = Array.from(writerDiv.children);
  if (children.length === 0) return null;

  // 2. Find which direct child ELEMENT of the writer contains the cursor
  let cursorDiv = savedRange.startContainer;
  
  // If it's a text node or comment, step up to its parent element
  if (cursorDiv.nodeType === Node.TEXT_NODE || cursorDiv.nodeType === Node.COMMENT_NODE) {
    cursorDiv = cursorDiv.parentElement;
  }

  if (cursorDiv === writerDiv) {
    // Cursor is directly on writerDiv; use startOffset to pick the child
    cursorDiv = children[Math.min(savedRange.startOffset, children.length - 1)] || null;
  } else {
    // Walk up to the direct child of writerDiv
    while (cursorDiv && cursorDiv.parentElement !== writerDiv) {
      cursorDiv = cursorDiv.parentElement;
    }
  }

  // 3. Calculate text offset of the cursor within its div
  function getTextOffsetInDiv(div, container, offset) {
    if (container === writerDiv) return 0;
    let textOffset = 0;
    
    if (container.nodeType === Node.TEXT_NODE) {
      const walker = document.createTreeWalker(div, NodeFilter.SHOW_TEXT);
      let node;
      while ((node = walker.nextNode())) {
        // FIX: Clean the text before measuring to perfectly match the final 'text' variable
        const cleanLength = (node.textContent || '').replace(/\p{Cf}/gu, '').length;
        if (node === container) {
          // For the target node, clean the substring up to the offset
          const cleanBefore = (node.textContent || '').substring(0, offset).replace(/\p{Cf}/gu, '').length;
          textOffset += cleanBefore;
          break;
        }
        textOffset += cleanLength;
      }
    } else {
      for (let i = 0; i < offset && i < container.childNodes.length; i++) {
        const cleanLength = (container.childNodes[i].textContent || '').replace(/\p{Cf}/gu, '').length;
        textOffset += cleanLength;
      }
    }
    return textOffset;
  }

  const cursorTextOffset = cursorDiv
    ? getTextOffsetInDiv(cursorDiv, savedRange.startContainer, savedRange.startOffset)
    : 0;

  // 4. Build markdown line by line, injecting the marker at the cursor position
  let markdown = '';

  for (const div of children) {
    const ltype = div.dataset?.ltype;
    // Clean the text consistently
    const text = (div.textContent || '').replace(/\p{Cf}/gu, '');

    let prefix = '';
    if (ltype === 'seg') prefix = '# ';
    else if (ltype === 'shot') prefix = '## ';

    if (div === cursorDiv) {
      // Clamp the offset to prevent any out-of-bounds substring issues
      const safeOffset = Math.min(cursorTextOffset, text.length);
      const before = text.substring(0, safeOffset);
      const after  = text.substring(safeOffset);
      markdown += prefix + before + '<|ADD_PART_HERE|>' + after + '\n';
    } else {
      markdown += prefix + text + '\n';
    }
  }

  return markdown.trim();
}

async function submitPrompt() {
  const inputEl = document.getElementById('cePromptInput');
  
  const editor = document.getElementById('ceWriterDiv');
  editor.contentEditable = false

  showAnimation();
  
  if (!inputEl) {
    notify("لا يوجد عنصر لكتابة الـ prompt فيه", "error")
    return
  };

  const [promptText, references] = await extarctPromptData(inputEl);

  if (!promptText) {
    notify("لا يوجد prompt", "error")
    return
  };

  const writer = document.getElementById('ceWriterDiv');
  if (!writer) {
    notify("لا يوجد عنصر لكتابة الـ script فيه", "error")
    return
  };

  let savedRange = currentSelectionRange;
  if (!savedRange) {
    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      if (writer.contains(range.startContainer)) {
        savedRange = range;
      }
    }
  }

  // Pre-build context with cursor marker BEFORE any DOM manipulation
  let preBuiltContext = null;
  
  // 2. ENSURE ACTION TYPE MATCHES: Verify this is the intended action type
  if (currentAIActionType === 'add-new-part' && savedRange) {
    preBuiltContext = buildContextWithCursorMarker(writer, savedRange);
    
    // Debugging helpers: Check the console if it still fails
    if (!preBuiltContext) {
      console.warn("Failed to build context: Cursor might be outside the editor or editor is empty.");
    } else if (!preBuiltContext.includes('<|ADD_PART_HERE|>')) {
      console.warn("Marker not found in preBuiltContext: Cursor div matching failed.");
    }
  }

  const editorSnapshot = writer.innerHTML;
  
  if (currentSelectionRange) {
    currentSelectionRange.deleteContents();
    currentSelectionRange = null;
  }
  
  // Find or create a clean starting block-level div for streaming text inside the editor
  let activeLineDiv = null;

  if (savedRange) {
    activeLineDiv = savedRange.startContainer;
    while (activeLineDiv && activeLineDiv.parentElement !== writer) {
      activeLineDiv = activeLineDiv.parentElement;
    }
  } else {
    activeLineDiv = document.createElement('div');
    writer.appendChild(activeLineDiv);
  }
  
  if (!activeLineDiv || activeLineDiv.nodeType !== 1) {
    if (savedRange) {
      activeLineDiv = document.createElement('div');
      savedRange.insertNode(activeLineDiv);
    } else {
      activeLineDiv = document.createElement('div');
      writer.appendChild(activeLineDiv);
    }
  }
  
  // Clear saved range after use to prevent stale state
  savedRange = null;

  // Track text updates smoothly
  let currentActiveTextNode = document.createTextNode("");
  activeLineDiv.appendChild(currentActiveTextNode);

  // Helper utility to evaluate Markdown tags (# and ##) ONLY on a completed block-level row div
  function evaluateLineSyntax(divElement) {
    if (!divElement || divElement.dataset.ltype) return;

    // Strip out BIDI control codes and get raw content
    const rawText = (divElement.textContent || '').replace(/\p{Cf}/gu, '').trim();

    if (/^##\s/.test(rawText)) {
      divElement.dataset.ltype = 'shot';
      if (!divElement.dataset.rid) divElement.dataset.rid = uid();
      divElement.textContent = rawText.replace(/^##\s+/, '');
      if (!divElement.textContent) divElement.innerHTML = '<br>';
    } else if (/^#\s/.test(rawText)) {
      divElement.dataset.ltype = 'seg';
      if (!divElement.dataset.rid) divElement.dataset.rid = uid();
      divElement.textContent = rawText.replace(/^#\s+/, '');
      if (!divElement.textContent) divElement.innerHTML = '<br>';
    }
  }

  closeTopPopup(false)

  try {
    let context = null;
    if (currentAIActionType !== 'write-from-scratch') {
      context = preBuiltContext || await getVideoScriptMarkdown();
    }
    
    const selectedTextBody = (currentAIActionType === 'improve-part') ? selectedText : null;

    const selectedModel = document.getElementById('ceModelSelect')?.value || "gemini-3.1-flash-lite";

    const response = await fetch('http://localhost:8000/ai/write', { 
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        "prompt": promptText,
        "context": context,
        "selected_text": selectedTextBody,
        "references": references,
        "model": selectedModel,
      })
    });

    
    if (!response.ok || !response.body) {
      hidePopupBg();
      hideAnimation();
      notify("فشل الاتصال بالخادم", "error")
      throw new Error("Connection to Server Faild");
    }
    
    const reader = response.body.getReader();
    const decoder = new TextDecoder("utf-8");
    let buffer = "";
    let animationHidden = false;

    while (true) {
      const { value, done } = await reader.read();
      
      if (!animationHidden) {
        hidePopupBg();
        hideAnimation();
        animationHidden = true;
      }

      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      let packets = buffer.split('\n\n');
      buffer = packets.pop();

      for (let packet of packets) {
        if (!packet.trim()) continue;

        const lines = packet.split('\n');
        let dataBuffer = [];
        
        for (const line of lines) {
          if (line.startsWith('data:')) {
            let val = line.substring(5);
            if (val.startsWith(' ')) {
              val = val.substring(1);
            }
            dataBuffer.push(val);
          }
        }

        if (dataBuffer.length === 0) continue;
        let rawChunk = dataBuffer.join('\n');

        if (rawChunk.trim() === "[DONE]") {
          editor.contentEditable = true;
          break;
        }

        const components = rawChunk.split(/(\n)/g);

        for (const item of components) {
          if (item === '\n') {
            // ── FIX: Evaluate line syntax ONLY when the line is completely finished ──
            evaluateLineSyntax(activeLineDiv);

            // Generate an official structural paragraph row child element
            const newLineDiv = document.createElement('div');
            
            // Append right after our current operational element block
            activeLineDiv.insertAdjacentElement('afterend', newLineDiv);
            activeLineDiv = newLineDiv;
            
            currentActiveTextNode = document.createTextNode("");
            activeLineDiv.appendChild(currentActiveTextNode);
          } else if (item) {
            currentActiveTextNode.appendData(item);
            // REMOVED evaluateLineSyntax from here so it doesn't interrupt mid-word streaming
          }
        }
        
        // Refresh structural UI parameters, counter displays, and placeholder properties
        ceUpdateWriterPh();
        ceUpdateStats();
      }
    }

    // Final sweep check on the closing block element line state boundary
    evaluateLineSyntax(activeLineDiv);
    
    // Trigger deep rebuild save cycle to compile elements cleanly into internal state models
    ceWriterSave();
    if (typeof autoSave === 'function') autoSave();

    inputEl.value = ""; 
    closeTopPopup();

  } catch (error) {
    editor.contentEditable = true;
    hidePopupBg();
    hideAnimation();
    notify(` [خطأ: ${error.message}] `, "error")
    console.error("Streaming error:", error);
    writer.innerHTML = editorSnapshot;
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const promptInput = document.getElementById('cePromptInput');
  const dropdown = document.getElementById('ceMentionDropdown');

  let activeIndex = 0;
  let projectsList = [];
  let currentMentionRange = null;

  if (!promptInput || !dropdown) return;

  // 1. Listen for key inputs inside contenteditable box
  promptInput.addEventListener('keydown', (e) => {
    if (dropdown.style.display === 'block') {
      const items = dropdown.querySelectorAll('.ce-mention-item');
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        activeIndex = (activeIndex + 1) % items.length;
        updateActiveItem(items);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        activeIndex = (activeIndex - 1 + items.length) % items.length;
        updateActiveItem(items);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (items[activeIndex]) items[activeIndex].click();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        hideDropdown();
      }
    }
  });

  promptInput.addEventListener('input', async () => {
    const sel = window.getSelection();
    if (!sel || !sel.rangeCount) return;

    const range = sel.getRangeAt(0);
    const textBeforeCaret = range.startContainer.textContent || '';
    const caretOffset = range.startOffset;

    // Look backward from cursor to find the closest '@' symbol
    const lastAt = textBeforeCaret.lastIndexOf('@', caretOffset - 1);

    if (lastAt !== -1 && !textBeforeCaret.substring(lastAt, caretOffset).includes(' ')) {
      const query = textBeforeCaret.substring(lastAt + 1, caretOffset).toLowerCase();

      // Store the range location where the text query was written
      currentMentionRange = range.cloneRange();
      currentMentionRange.setStart(range.startContainer, lastAt);
      currentMentionRange.setEnd(range.startContainer, caretOffset);

      if (projectsList.length === 0) {
        try { projectsList = await getAllProjects(); } catch (err) { projectsList = []; }
      }

      const filtered = projectsList.filter(p => (p.name || '').toLowerCase().includes(query));

      if (filtered.length > 0) {
        renderDropdown(filtered);
      } else {
        hideDropdown();
      }
    } else {
      hideDropdown();
    }
  });

  function renderDropdown(list) {
    dropdown.innerHTML = '';
    activeIndex = 0;

    list.forEach((project, idx) => {
      const item = document.createElement('div');
      item.className = 'ce-mention-item';
      if (idx === 0) item.classList.add('active');
      item.textContent = project.name;

      item.addEventListener('click', () => {
        if (!currentMentionRange) return;

        // Delete the typed query string (@name)
        currentMentionRange.deleteContents();

        // Create the protected badge element
        const badge = document.createElement('span');
        badge.className = 'ce-script-badge';
        badge.contentEditable = 'false'; // Locks it so user can't break text internally
        badge.dataset.id = project.id;
        badge.dataset.name = project.name;
        badge.textContent = `📁 ${project.name}`;

        // Insert badge and an adjoining empty space to keep typing smoothly
        currentMentionRange.insertNode(badge);
        
        const spaceNode = document.createTextNode('\u00A0'); // Non-breaking space
        badge.insertAdjacentElement('afterend', document.createElement('span')).appendChild(spaceNode);

        // Advance cursor position directly after the inserted text space
        const sel = window.getSelection();
        const nextRange = document.createRange();
        nextRange.setStartAfter(spaceNode);
        nextRange.collapse(true);
        sel.removeAllRanges();
        sel.addRange(nextRange);

        hideDropdown();
        promptInput.focus();
      });

      dropdown.appendChild(item);
    });

    dropdown.style.display = 'block';
    dropdown.style.top = `${promptInput.offsetTop + promptInput.offsetHeight}px`;
    dropdown.style.left = `${promptInput.offsetLeft}px`;
    dropdown.style.width = `${promptInput.offsetWidth}px`;
  }

  function updateActiveItem(items) {
    items.forEach(item => item.classList.remove('active'));
    if (items[activeIndex]) {
      items[activeIndex].classList.add('active');
      items[activeIndex].scrollIntoView({ block: 'nearest' });
    }
  }

  function hideDropdown() { dropdown.style.display = 'none'; }
  document.addEventListener('click', (e) => {
    if (e.target !== promptInput && !dropdown.contains(e.target)) hideDropdown();
  });
});

document.addEventListener('keydown', function(event) {
  // Check if Ctrl (Windows) or Cmd (Mac) is pressed AND 'i' key is pressed
  if ((event.ctrlKey || event.metaKey) && (event.key === 'i' || event.key === 'I' || event.key === 'ه' )) {
    event.preventDefault(); // Prevent default browser behavior (like opening dev tools)
    
    const selStr = window.getSelection().toString().trim()
    const placeholderDisplay = document.getElementById('ceWriterPh').style.display
    if (selStr) {
      selectedText = selStr.toString().trim()
      showTopPopup("improve-part");
    }
    else if (placeholderDisplay === "none") {
      showTopPopup("add-new-part");
    } else {
      showTopPopup("write-from-scratch");
    }
  }
});


const submitButton = document.getElementById("cePromptSubmit");
submitButton.addEventListener("click", async () => {
   await submitPrompt()
});

window.closeTopPopup = closeTopPopup;