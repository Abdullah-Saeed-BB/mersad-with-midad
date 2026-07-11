let selectedText = null

document.addEventListener('DOMContentLoaded', () => {
  const writerDiv = document.getElementById('ceWriterDiv');
  const selectionIcon = document.getElementById('ceSelectionIcon');
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

    // Show the top overlay popup with customized text context
    selectedText = selectedTextSnapshot;
    showTopPopup(selectedText);
  });
});

// 3. Popup Utilities
function showTopPopup(message) {
  const popup = document.getElementById('ceTopPopup');

  console.log("Popup", message)
  
  if (!popup) return;

  popup.style.display = 'block';

  requestAnimationFrame(() => {
    popup.classList.add('show');
  });
}

function closeTopPopup() {
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

function submitImprove(prompt) {
  console.log(prompt);
}