// ============================================================
// Utility Functions
// ============================================================

/**
 * Random delay between min and max (ms)
 */
export function randomDelay(range) {
  const ms = Math.floor(Math.random() * (range.max - range.min + 1)) + range.min;
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Sleep for exact ms
 */
export function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Extract first name from full name string
 */
export function extractFirstName(fullName) {
  if (!fullName) return '';
  return fullName.trim().split(/\s+/)[0];
}

/**
 * Fill template with variables
 * Supports {{firstName}}, {{fullName}}, {{link}}, {{keyword}}
 */
export function fillTemplate(template, vars) {
  return template
    .replace(/\{\{firstName\}\}/g, vars.firstName || '')
    .replace(/\{\{fullName\}\}/g, vars.fullName || '')
    .replace(/\{\{link\}\}/g, vars.link || '')
    .replace(/\{\{keyword\}\}/g, vars.keyword || '')
    .replace(/\{\{thematic\}\}/g, vars.thematic || '');
}

/**
 * Simulate human-like typing into an element
 */
export async function simulateTyping(element, text, charDelay = { min: 30, max: 80 }) {
  element.focus();
  
  for (const char of text) {
    // Create and dispatch keyboard events
    const keyDown = new KeyboardEvent('keydown', { key: char, bubbles: true });
    const keyPress = new KeyboardEvent('keypress', { key: char, bubbles: true });
    const input = new InputEvent('input', { data: char, inputType: 'insertText', bubbles: true });
    const keyUp = new KeyboardEvent('keyup', { key: char, bubbles: true });
    
    element.dispatchEvent(keyDown);
    element.dispatchEvent(keyPress);
    
    // Actually insert the character
    document.execCommand('insertText', false, char);
    
    element.dispatchEvent(input);
    element.dispatchEvent(keyUp);
    
    await randomDelay(charDelay);
  }
}

/**
 * Simulate a human-like click on an element
 */
export async function simulateClick(element) {
  if (!element) return false;
  
  // Scroll element into view smoothly
  element.scrollIntoView({ behavior: 'smooth', block: 'center' });
  await sleep(500);
  
  // Mouse events sequence
  const rect = element.getBoundingClientRect();
  const x = rect.left + rect.width / 2;
  const y = rect.top + rect.height / 2;
  
  const events = ['mouseenter', 'mouseover', 'mousemove', 'mousedown', 'mouseup', 'click'];
  
  for (const eventType of events) {
    const event = new MouseEvent(eventType, {
      bubbles: true,
      cancelable: true,
      view: window,
      clientX: x,
      clientY: y,
    });
    element.dispatchEvent(event);
    await sleep(50 + Math.random() * 100);
  }
  
  return true;
}

/**
 * Get today's date key (YYYY-MM-DD) for daily counters
 */
export function getTodayKey() {
  return new Date().toISOString().split('T')[0];
}

/**
 * Generate a unique ID for a comment
 */
export function getCommentId(postUrn, authorName, commentText) {
  const raw = `${postUrn}|${authorName}|${commentText.substring(0, 50)}`;
  // Simple hash
  let hash = 0;
  for (let i = 0; i < raw.length; i++) {
    const char = raw.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return `comment_${Math.abs(hash).toString(36)}`;
}

/**
 * Log with prefix
 */
export function log(level, ...args) {
  const prefix = `[ScaleMe] [${level.toUpperCase()}]`;
  const timestamp = new Date().toLocaleTimeString('fr-FR');
  
  switch (level) {
    case 'error':
      console.error(prefix, timestamp, ...args);
      break;
    case 'warn':
      console.warn(prefix, timestamp, ...args);
      break;
    case 'debug':
      console.debug(prefix, timestamp, ...args);
      break;
    default:
      console.log(prefix, timestamp, ...args);
  }
}

/**
 * Safe querySelector with retry
 */
export async function waitForElement(selector, timeout = 10000, parent = document) {
  const start = Date.now();
  
  while (Date.now() - start < timeout) {
    const el = parent.querySelector(selector);
    if (el) return el;
    await sleep(500);
  }
  
  return null;
}

/**
 * Check if we're on a LinkedIn post page
 */
export function isPostPage() {
  return window.location.pathname.startsWith('/posts/') || 
         window.location.pathname.includes('/recent-activity/');
}

/**
 * Check if we're on the LinkedIn feed
 */
export function isFeedPage() {
  return window.location.pathname === '/feed' || 
         window.location.pathname === '/feed/';
}
