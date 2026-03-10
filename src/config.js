// ============================================================
// Scale Me — LinkedIn Comment-to-DM Extension
// Configuration & Constants
// ============================================================

// LinkedIn DOM Selectors (update these when LinkedIn changes its DOM)
// Last verified: March 2026
export const SELECTORS = {
  // Feed & Post containers
  FEED_CONTAINER: '.scaffold-finite-scroll__content',
  POST_CONTAINER: '.feed-shared-update-v2',
  POST_URN: 'data-urn',
  
  // Comments
  COMMENTS_SECTION: '.comments-comments-list',
  COMMENT_ITEM: '.comments-comment-item',
  COMMENT_ENTITY: '.comments-comment-entity',
  COMMENT_TEXT: '.comments-comment-item__main-content .update-components-text',
  COMMENT_AUTHOR: '.comments-post-meta__name-text',
  COMMENT_AUTHOR_LINK: '.comments-post-meta__name-text a',
  COMMENT_AUTHOR_PROFILE: '.comments-post-meta__profile-link',
  COMMENT_REPLY_BTN: '.comments-comment-social-bar__reply-btn',
  COMMENT_INPUT: '.comments-comment-box__form .ql-editor',
  COMMENT_SUBMIT_BTN: '.comments-comment-box__submit-button',
  
  // "Load more comments" button
  LOAD_MORE_COMMENTS: '.comments-comments-list__load-more-comments-button',
  SHOW_COMMENTS_BTN: '.social-details-social-counts',
  
  // Messaging
  MSG_OVERLAY: '.msg-overlay-conversation-bubble',
  MSG_COMPOSE_BTN: '.msg-overlay-bubble-header__control--new-convo-btn',
  MSG_SEARCH_INPUT: '.msg-connections-typeahead__search-field',
  MSG_RECIPIENT_RESULT: '.msg-connections-typeahead__result-item',
  MSG_BODY_INPUT: '.msg-form__contenteditable',
  MSG_SEND_BTN: '.msg-form__send-button',
  MSG_CLOSE_BTN: '.msg-overlay-bubble-header__control--close-btn',
  
  // Profile mini
  PROFILE_CARD: '.artdeco-card',
};

// Action delays (ms) — randomized between min and max to mimic human behavior
export const DELAYS = {
  BETWEEN_ACTIONS: { min: 30000, max: 120000 },    // 30s - 2min between full actions
  TYPING_CHAR: { min: 30, max: 80 },                // Per character typing speed
  BEFORE_SEND: { min: 2000, max: 5000 },            // Pause before hitting send
  BEFORE_DM: { min: 10000, max: 60000 },            // Wait before sending DM after reply
  COMMENT_SCAN_INTERVAL: { min: 30000, max: 60000 },// How often to scan for new comments
  PAGE_SCROLL: { min: 500, max: 2000 },             // Scroll pause
};

// Daily limits (safety guardrails)
export const LIMITS = {
  MAX_REPLIES_PER_DAY: 25,
  MAX_DMS_PER_DAY: 20,
  MAX_ACTIONS_PER_HOUR: 8,
  COOLDOWN_AFTER_LIMIT_MIN: 120, // 2 hour cooldown if limit reached
};

// Default thematic config template
export const DEFAULT_THEMATIC = {
  id: '',
  name: '',
  keywords: [],
  replyTemplate: "C'est envoyé en DM ! 🚀",
  dmTemplate: "Salut {{firstName}} ! Suite à ton commentaire, voici le document : {{link}}\n\nBonne lecture ! 📖",
  leadMagnetUrl: '',
  enabled: true,
  postUrns: [], // specific post URNs to monitor (empty = all posts)
};

// Storage keys
export const STORAGE_KEYS = {
  THEMATICS: 'scaleme_thematics',
  STATS: 'scaleme_stats',
  ACTION_LOG: 'scaleme_action_log',
  PROCESSED_COMMENTS: 'scaleme_processed_comments',
  SETTINGS: 'scaleme_settings',
  DAILY_COUNTERS: 'scaleme_daily_counters',
};

// Default settings
export const DEFAULT_SETTINGS = {
  enabled: false,
  debugMode: false,
  notificationsEnabled: true,
  autoScrollToComments: false,
  dryRun: false, // if true, logs actions without executing
};
