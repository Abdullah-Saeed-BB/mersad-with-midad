export function notify(message, type) {
  // 1. Find or create the container element
  let container = document.getElementById('notification-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'notification-container';
    document.body.appendChild(container);
  }

  // 2. Create the notification element
  const toast = document.createElement('div');
  toast.classList.add('notification', type);
  toast.textContent = message;

  // 3. Append toast to the container
  container.appendChild(toast);

  // 4. Trigger the slide-in transition
  // We use requestAnimationFrame to make sure the browser registers the initial 
  // transition state before applying the '.show' class.
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      toast.classList.add('show');
    });
  });

  // 5. Setup auto-dismissal
  const displayDuration = 4000; // How long it stays on screen (4 seconds)
  const transitionDuration = 400; // Must match the CSS transition speed (0.4s)

  setTimeout(() => {
    // Start sliding out
    toast.classList.remove('show');
    toast.classList.add('hide');

    // Remove from the DOM entirely once the slide-out transition finishes
    setTimeout(() => {
      toast.remove();

      // Optional: Clean up the container if there are no more notifications active
      if (container.children.length === 0) {
        container.remove();
      }
    }, transitionDuration);
  }, displayDuration);
}

window._notify = notify;