// ============================================================
// Catchup Module — DOM-based comment scraper
// Reliable approach: clicks "load comments" + scrapes from DOM
// No API dependency = no breakage when LinkedIn changes endpoints
// ============================================================

class LinkedInCatchup {
  constructor() {
    this.SELECTORS = {
      // Post containers
      POST_CONTAINER: '.feed-shared-update-v2, .profile-creator-shared-feed-update__container, [data-urn*="activity"], article',
      POST_URN_ATTR: 'data-urn',
      
      // Comments
      SHOW_COMMENTS_BTN: '.social-details-social-counts__comments, .social-details-social-counts__item--with-social-proof',
      COMMENTS_SECTION: '.comments-comments-list',
      COMMENT_ITEM: '.comments-comment-item, .comments-comment-entity',
      COMMENT_TEXT: '.comments-comment-item__main-content .update-components-text, .feed-shared-main-content .update-components-text',
      COMMENT_AUTHOR: '.comments-post-meta__name-text, .comment-item__inline-show-more-text',
      COMMENT_AUTHOR_LINK: '.comments-post-meta__name-text a, .comments-post-meta__profile-link',
      LOAD_MORE_COMMENTS: '.comments-comments-list__load-more-comments-button, button[aria-label*="comments"]',
      SHOW_PREVIOUS: '.comments-comments-list__show-previous-button',
      
      // Post text
      POST_TEXT: '.feed-shared-update-v2__description .update-components-text, .update-components-text, .break-words',
    };
  }

  /**
   * Sleep helper
   */
  _sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Scroll to element smoothly
   */
  _scrollTo(el) {
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    return this._sleep(800);
  }

  /**
   * Click an element safely
   */
  async _click(el) {
    if (!el) return false;
    await this._scrollTo(el);
    el.click();
    await this._sleep(1500);
    return true;
  }

  /**
   * Scan posts visible on the current page (DOM only)
   * Works on: feed, profile activity, single post page
   */
  scanVisiblePosts() {
    const posts = [];
    const seen = new Set();

    // Try multiple selectors
    const containers = document.querySelectorAll(this.SELECTORS.POST_CONTAINER);
    
    for (const container of containers) {
      const urn = container.getAttribute('data-urn') || '';
      if (!urn || seen.has(urn)) continue;
      seen.add(urn);

      // Get post text
      let text = '';
      const textEl = container.querySelector(this.SELECTORS.POST_TEXT);
      if (textEl) text = textEl.textContent.trim();

      // Count visible comments if any
      const commentItems = container.querySelectorAll(this.SELECTORS.COMMENT_ITEM);

      posts.push({
        urn,
        text: text.substring(0, 200),
        numComments: commentItems.length,
        element: container,
      });
    }

    // If no URN-bearing containers found, try to extract from page URL
    if (posts.length === 0 && window.location.pathname.includes('/posts/')) {
      const match = window.location.pathname.match(/activity[:-](\d+)/);
      if (match) {
        posts.push({
          urn: `urn:li:activity:${match[1]}`,
          text: document.title || '',
          numComments: document.querySelectorAll(this.SELECTORS.COMMENT_ITEM).length,
          element: document.body,
        });
      }
    }

    console.log(`[ScaleMe] [Catchup] Found ${posts.length} posts on page`);
    return posts;
  }

  /**
   * For a specific post element, load ALL comments by clicking "load more" repeatedly
   * Then scrape them from the DOM
   */
  async loadAndScrapeComments(postElement) {
    const comments = [];

    // Step 1: Click on the comments count to show comments section
    const showBtn = postElement.querySelector(this.SELECTORS.SHOW_COMMENTS_BTN);
    if (showBtn) {
      await this._click(showBtn);
      await this._sleep(2000);
    }

    // Step 2: Click "show previous comments" / "load more" repeatedly
    let maxClicks = 20; // Safety limit
    let clicked = true;
    
    while (clicked && maxClicks > 0) {
      clicked = false;
      maxClicks--;

      // Try "show previous" button
      const showPrevBtn = postElement.querySelector(this.SELECTORS.SHOW_PREVIOUS);
      if (showPrevBtn && showPrevBtn.offsetParent !== null) {
        await this._click(showPrevBtn);
        await this._sleep(2000);
        clicked = true;
        continue;
      }

      // Try "load more" button
      const loadMoreBtn = postElement.querySelector(this.SELECTORS.LOAD_MORE_COMMENTS);
      if (loadMoreBtn && loadMoreBtn.offsetParent !== null) {
        await this._click(loadMoreBtn);
        await this._sleep(2000);
        clicked = true;
      }
    }

    // Step 3: Wait for DOM to settle
    await this._sleep(1000);

    // Step 4: Scrape all comment elements
    const commentElements = postElement.querySelectorAll(this.SELECTORS.COMMENT_ITEM);
    
    for (const commentEl of commentElements) {
      const textEl = commentEl.querySelector(this.SELECTORS.COMMENT_TEXT);
      const authorEl = commentEl.querySelector(this.SELECTORS.COMMENT_AUTHOR);
      const authorLinkEl = commentEl.querySelector(this.SELECTORS.COMMENT_AUTHOR_LINK);

      if (!textEl) continue;

      comments.push({
        text: textEl.textContent.trim(),
        authorName: authorEl ? authorEl.textContent.trim() : 'Unknown',
        authorProfileUrl: authorLinkEl ? authorLinkEl.href || '' : '',
        element: commentEl,
        timestamp: Date.now(),
      });
    }

    console.log(`[ScaleMe] [Catchup] Scraped ${comments.length} comments from post`);
    return comments;
  }

  /**
   * Full catchup flow on current page:
   * 1. Find all posts
   * 2. For each selected post, load & scrape comments
   * 3. Return structured results
   */
  async runCatchup(targetUrns = null) {
    const results = {
      postsScanned: 0,
      commentsScanned: 0,
      postResults: [],
    };

    const posts = this.scanVisiblePosts();
    
    // Filter to target URNs if specified
    const postsToScan = targetUrns 
      ? posts.filter(p => targetUrns.includes(p.urn))
      : posts;

    results.postsScanned = postsToScan.length;

    for (const post of postsToScan) {
      console.log(`[ScaleMe] [Catchup] Scanning post: ${post.urn.slice(-10)}...`);
      
      const comments = await this.loadAndScrapeComments(post.element);
      results.commentsScanned += comments.length;
      
      results.postResults.push({
        urn: post.urn,
        text: post.text,
        comments,
      });

      // Small delay between posts
      await this._sleep(1000 + Math.random() * 2000);
    }

    console.log(`[ScaleMe] [Catchup] Done: ${results.postsScanned} posts, ${results.commentsScanned} comments`);
    return results;
  }
}

// Export for content script
if (typeof window !== 'undefined') {
  window.ScaleMeLinkedInCatchup = LinkedInCatchup;
}
