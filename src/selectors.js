// ============================================================
// Shared Selectors — Single source of truth for all DOM selectors
// Loaded BEFORE catchup.js and content-script.js via manifest
// ============================================================

(function () {
  'use strict';

  window.ScaleMeSelectors = {
    // Feed & Posts
    FEED_CONTAINER: '.scaffold-finite-scroll__content',
    POST_CONTAINER: '.feed-shared-update-v2',
    POST_CONTAINER_ALL: '.feed-shared-update-v2, .profile-creator-shared-feed-update__container, .occludable-update, [data-urn*="activity"], div[data-urn], article',
    POST_URN: 'data-urn',
    POST_TEXT: '.feed-shared-update-v2__description .update-components-text',
    POST_TEXT_ALL: '.feed-shared-update-v2__description .update-components-text, .update-components-text, .break-words',
    POST_AUTHOR: '.update-components-actor__name',

    // Comments
    COMMENTS_SECTION: '.comments-comments-list',
    COMMENT_ITEM: '.comments-comment-item',
    COMMENT_ITEM_ALL: '.comments-comment-item, .comments-comment-entity',
    COMMENT_ENTITY: '.comments-comment-entity',
    COMMENT_TEXT: '.comments-comment-item__main-content .update-components-text',
    COMMENT_TEXT_ALL: '.comments-comment-item__main-content .update-components-text, .feed-shared-main-content .update-components-text',
    COMMENT_AUTHOR: '.comments-post-meta__name-text',
    COMMENT_AUTHOR_ALL: '.comments-post-meta__name-text, .comment-item__inline-show-more-text',
    COMMENT_AUTHOR_LINK: '.comments-post-meta__name-text a',
    COMMENT_AUTHOR_LINK_ALL: '.comments-post-meta__name-text a, .comments-post-meta__profile-link',
    COMMENT_PROFILE_LINK: 'a[href*="/in/"]',
    AUTHOR_BADGE: '.comments-post-meta__comment-badge, [class*="comment-badge"], [class*="author-badge"]',
    COMMENT_REPLY_BTN: '.comments-comment-social-bar__reply-btn',
    COMMENT_REPLY_BTN_ALL: '.comments-comment-social-bar__reply-btn, button[aria-label*="Reply"], button[aria-label*="Répondre"], [class*="comment-social"] button[class*="reply"], [class*="comment"] button[class*="reply"]',
    COMMENT_INPUT: '.comments-comment-box__form .ql-editor',
    COMMENT_INPUT_ALL: '.comments-comment-box__form .ql-editor, [class*="comment-box"] [contenteditable="true"], [class*="comment"] .ql-editor, [role="textbox"][aria-label*="comment"], [role="textbox"][aria-label*="commentaire"]',
    COMMENT_SUBMIT_BTN: '.comments-comment-box__submit-button',
    COMMENT_SUBMIT_BTN_ALL: '.comments-comment-box__submit-button, [class*="comment-box"] button[type="submit"], [class*="comment-box"] button[class*="submit"], [class*="comment"] button[aria-label*="Post"], [class*="comment"] button[aria-label*="Publier"]',

    // Comment loading
    SHOW_COMMENTS_BTN: '.social-details-social-counts__comments, .social-details-social-counts__item--with-social-proof',
    LOAD_MORE_COMMENTS: '.comments-comments-list__load-more-comments-button, button[aria-label*="comments"]',
    SHOW_PREVIOUS: '.comments-comments-list__show-previous-button',

    // Messaging
    MSG_COMPOSE_BTN: '.msg-overlay-bubble-header__control--new-convo-btn',
    MSG_SEARCH_INPUT: '.msg-connections-typeahead__search-field, input[placeholder*="name"], input[aria-label*="recipient"], input[aria-label*="destinataire"]',
    MSG_RECIPIENT_RESULT: '.msg-connections-typeahead__result-item, .msg-connections-typeahead__result, [class*="typeahead"] li[role="option"], [class*="search-result"] li',
    MSG_BODY_INPUT: '.msg-form__contenteditable',
    MSG_SEND_BTN: '.msg-form__send-button',
    MSG_CLOSE_BTN: '.msg-overlay-bubble-header__control--close-btn',
    MSG_PROFILE_BTN: 'button[aria-label*="Message"], button[aria-label*="Envoyer un message"], .pvs-profile-actions button[aria-label*="Message"]',

    // Connection request (profile page)
    CONNECT_BTN: 'button[aria-label*="Invite"][aria-label*="connect"], .pvs-profile-actions button[aria-label*="Connect"], .pvs-profile-actions button[aria-label*="Se connecter"]',
    CONNECT_BTN_MORE: '.artdeco-dropdown__content button[aria-label*="Connect"], .artdeco-dropdown__content button[aria-label*="Se connecter"]',
    MORE_ACTIONS_BTN: '.pvs-profile-actions .artdeco-dropdown__trigger',
    CONNECT_MODAL_SEND: 'button[aria-label="Send without a note"], button[aria-label="Envoyer sans note"], button[aria-label="Send now"], button[aria-label="Envoyer"]',
  };
})();
