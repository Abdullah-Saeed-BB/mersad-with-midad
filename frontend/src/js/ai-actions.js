import { ceUpdateStats, ceUpdateWriterPh, ceWriterSave, uid, getAllProjects, _allShots, _findSegForShot } from './main.js';

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
  currentAIActionType = type

  const popup = document.getElementById('ceTopPopup');
  const description = document.getElementById('cePopupDescription');

  if (description) {
    let newDesc = "معك مِداد, "
    if (type == 'improve-part') {
      newDesc = newDesc + 'ما الذي تريد تحسينه في النص المحدد؟'
    } else if (type == 'add-new-parts') {
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

export function closeTopPopup() {
  const popup = document.getElementById('ceTopPopup');
  if (!popup) return;

  popup.classList.remove('show');
  
  // Wait out the CSS layout opacity transition before setting visibility to none
  setTimeout(() => {
    if (!popup.classList.contains('show')) {
      popup.style.display = 'none';
    }
  }, 300);
}

async function waitForAllShots({
  delay = 500,
  maxRetries = 10
} = {}) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return _allShots();
    } catch (err) {
      console.log(`Erro thorwed (${i}) - let's wait few time ;)`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw new Error("_allShots() failed after maximum retries.");
}

async function getVideoScriptMarkdown() {
  const scenes = await waitForAllShots()
  
  const videoGroups = new Map();

  for (const scene of scenes) {
    const videoTitle = _findSegForShot(scene.id);
    
    if (!videoGroups.has(videoTitle.title)) {
      videoGroups.set(videoTitle.title, []);
    }
    
    videoGroups.get(videoTitle.title).push(scene);
  }

  // 3. Build the Markdown string
  let markdown = '';

  for (const [videoTitle, videoScenes] of videoGroups.entries()) {
    // Add the Video Title (Heading 1)
    markdown += `# ${videoTitle}\n`;

    // Add each Scene (Heading 2) and its content
    for (const scene of videoScenes) {
      markdown += `## ${scene.title}\n`;
      markdown += `${scene.content}\n\n`;
    }
  }

  // Return the final string, trimming any trailing whitespace/newlines
  return markdown.trim();
}

async function submitPrompt() {
  const inputEl = document.getElementById('cePromptInput');
  if (!inputEl) {
    alert("لا يوجد input")
    return
  };

  const promptText = inputEl.innerText.trim();
  if (!promptText) {
    alert("لا يوجد prompt")
    return
  };

  const writer = document.getElementById('ceWriterDiv');
  if (!writer) return;

  // 1. Clean the old selection coordinates
  if (currentSelectionRange) {
    currentSelectionRange.deleteContents();
  }
  
  // Find or create a clean starting block-level div for streaming text inside the editor
  let activeLineDiv = null;

  if (currentSelectionRange) {
    activeLineDiv = currentSelectionRange.anchorNode;
    while (activeLineDiv && activeLineDiv.parentElement !== writer) {
      activeLineDiv = activeLineDiv.parentElement;
    }
  } else {
    // Create a new line
    activeLineDiv = document.createElement('div');
    writer.appendChild(activeLineDiv);
  }
  
  if (!activeLineDiv || activeLineDiv.nodeType !== 1) {
    activeLineDiv = document.createElement('div');
    currentSelectionRange.insertNode(activeLineDiv);
  }
  
  currentSelectionRange = null;

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

  try {
    const context = (currentAIActionType !== 'write-from-scratch') ? await getVideoScriptMarkdown() : null
    const selectedTextBody = (currentAIActionType == 'improve-part') ? selectedText : null

    const response = await fetch('http://localhost:8000/ai/write', { 
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        "prompt": promptText,
        "context": context,
        "selected_text": selectedTextBody
      })
    });

    if (!response.ok || !response.body) {
      throw new Error("فشلت عملية الاتصال بالخادم");
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder("utf-8");
    let buffer = "";

    while (true) {
      const { value, done } = await reader.read();
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
    console.error("Streaming error:", error);
    currentActiveTextNode.appendData(` [خطأ: ${error.message}] `);
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
      showTopPopup("improve-part");
    }
    else if (placeholderDisplay === "none") {
      showTopPopup("add-new-parts");
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