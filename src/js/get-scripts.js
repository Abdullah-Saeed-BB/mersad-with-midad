import { _allShots, _findSegForShot, getAllProjects } from "./main.js";

let projects = getAllProjects();

export let refreshProjects = async () => projects = await getAllProjects();

export async function getProjectMarkdown(projId) {
  if (!projects) await refreshProjects();
  const project = projects.find(p => p.id == projId);
  
  if (!project || !project.segments) return '';
  
  let markdown = '';
  
  for (const seg of project.segments) {
    markdown += `# ${seg.title}\n`;
    
    for (const shot of (seg.shots || [])) {
      markdown += `## ${shot.title}\n`;
      markdown += `${shot.content || ''}\n\n`;
    }
  }
  return markdown.trim();
}

window.getProjectMarkdown = getProjectMarkdown

async function waitForAllShots({
  delay = 500,
  maxRetries = 10
} = {}) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return _allShots();
    } catch (err) {
    //   console.log(`Erro thorwed (${i}) - let's wait few time ;)`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw new Error("_allShots() failed after maximum retries.");
}

export async function getVideoScriptMarkdown() {
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
