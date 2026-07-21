// 1. Define your frames here (Replace with your actual image URLs)
const frames = [
  './assets/icon_frames/1.jpg',
  './assets/icon_frames/2.jpg',
  './assets/icon_frames/3.jpg',
  './assets/icon_frames/4.jpg',
  './assets/icon_frames/5.jpg',
  './assets/icon_frames/6.jpg',
  './assets/icon_frames/7.jpg',
  './assets/icon_frames/8.jpg',
];

// 2. Configuration
const FRAME_DURATION = 750; // Time in milliseconds each frame is shown

// 3. Variables to keep track of state
const container = document.getElementById('animation-container');
const imgElement = document.getElementById('animation-frame');
let animationInterval = null;
let lastFrameIndex = -1;

// 4. Preload images to prevent flickering during rapid switching
function preloadImages() {
  frames.forEach(src => {
    const img = new Image();
    img.src = src;
  });
}
preloadImages();

// 5. Helper function to get a random frame (avoiding the same frame twice in a row)
function getRandomFrame() {
  let newIndex;
  do {
    newIndex = Math.floor(Math.random() * frames.length);
  } while (newIndex === lastFrameIndex && frames.length > 1);
  
  lastFrameIndex = newIndex;
  return frames[newIndex];
}

export function showAnimation() {
  if (animationInterval) return; 

  container.style.display = 'flex'; // Use flex to center the icon
  
  imgElement.src = getRandomFrame();

  requestAnimationFrame(() => {
    container.className = "show";
  })

  animationInterval = setInterval(() => {
    imgElement.src = getRandomFrame();
  }, FRAME_DURATION);
}

// 7. HIDE Function
export function hideAnimation() {
  // Stop the loop
  if (animationInterval) {
    clearInterval(animationInterval);
    animationInterval = null;
  }
  
  container.className = "hide";
  // Hide the container
  setTimeout(() => {
    setTimeout(() => {
      container.style.display = 'none';
    }, 220)
  }, 1000)
}
