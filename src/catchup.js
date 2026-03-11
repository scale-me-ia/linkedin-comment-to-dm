// ============================================================
// Catchup Module — DOM-based comment scraper
// Reliable approach: clicks "load comments" + scrapes from DOM
// No API dependency = no breakage when LinkedIn changes endpoints
// ============================================================

class LinkedInCatchup {
  constructor() {
    // Use shared selectors (loaded from selectors.js via manifest)
    const shared = window.ScaleMeSelectors || {};
    this.SELECTORS = {
      POST_CONTAINER: shared.POST_CONTAINER_ALL || '.feed-shared-update-v2',
      POST_URN_ATTR: shared.POST_URN || 'data-urn',
      SHOW_COMMENTS_BTN: shared.SHOW_COMMENTS_BTN || '.social-details-social-counts__comments',
      COMMENTS_SECTION: shared.COMMENTS_SECTION || '.comments-comments-list',
      COMMENT_ITEM: shared.COMMENT_ITEM_ALL || '.comments-comment-item',
      COMMENT_TEXT: shared.COMMENT_TEXT_ALL || '.comments-comment-item__main-content .update-components-text',
      COMMENT_AUTHOR: shared.COMMENT_AUTHOR_ALL || '.comments-post-meta__name-text',
      COMMENT_AUTHOR_LINK: shared.COMMENT_AUTHOR_LINK_ALL || '.comments-post-meta__name-text a',
      LOAD_MORE_COMMENTS: shared.LOAD_MORE_COMMENTS || '.comments-comments-list__load-more-comments-button',
      SHOW_PREVIOUS: shared.SHOW_PREVIOUS || '.comments-comments-list__show-previous-button',
      POST_TEXT: shared.POST_TEXT_ALL || '.feed-shared-update-v2__description .update-components-text',
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
   * Extract author name from a comment element using multiple fallback strategies
   * Returns { authorName, authorProfileUrl }
   */
  _extractAuthor(commentEl) {
    let authorName = '';
    let authorProfileUrl = '';

    // Strategy 1: Primary selector
    const authorEl = commentEl.querySelector(this.SELECTORS.COMMENT_AUTHOR);
    if (authorEl) {
      authorName = authorEl.textContent.trim();
    }

    // Strategy 2: Author link text
    if (!authorName) {
      const linkEl = commentEl.querySelector(this.SELECTORS.COMMENT_AUTHOR_LINK);
      if (linkEl) {
        authorName = linkEl.textContent.trim();
        if (linkEl.href) authorProfileUrl = linkEl.href;
      }
    }

    // Strategy 3: aria-label on profile links (e.g. "Voir le profil de Jean Dupont")
    if (!authorName) {
      const profileLink = commentEl.querySelector('a[href*="/in/"]');
      if (profileLink) {
        if (!authorProfileUrl && profileLink.href) authorProfileUrl = profileLink.href;
        const aria = profileLink.getAttribute('aria-label') || '';
        const ariaMatch = aria.match(/(?:profil\s+(?:de\s+)?|profile\s+(?:of\s+)?)(.+)/i);
        if (ariaMatch) {
          authorName = ariaMatch[1].trim();
        } else if (profileLink.textContent.trim()) {
          authorName = profileLink.textContent.trim();
        }
      }
    }

    // Strategy 4: Wildcard class patterns
    if (!authorName) {
      const wildcard = commentEl.querySelector('[class*="name-text"], [class*="actor__name"], [class*="comment-meta"] [class*="name"]');
      if (wildcard) authorName = wildcard.textContent.trim();
    }

    // Strategy 5: Parse name from profile URL slug (/in/john-doe-123/ → John Doe)
    if (!authorName && authorProfileUrl) {
      authorName = this._nameFromProfileUrl(authorProfileUrl);
    }

    // Extract profile URL if still missing
    if (!authorProfileUrl) {
      const anyProfileLink = commentEl.querySelector('a[href*="/in/"]');
      if (anyProfileLink) authorProfileUrl = anyProfileLink.href;
    }

    return {
      authorName: authorName || 'Unknown',
      authorProfileUrl: authorProfileUrl || '',
    };
  }

  /**
   * Parse a display name from a LinkedIn profile URL slug
   * /in/jean-dupont-a1b2c3/ → Jean Dupont
   */
  _nameFromProfileUrl(url) {
    const match = url.match(/\/in\/([^/?#]+)/);
    if (!match) return '';
    return match[1]
      .replace(/-[a-f0-9]{4,}$/i, '') // remove trailing hash
      .replace(/-/g, ' ')
      .replace(/\b\w/g, c => c.toUpperCase())
      .trim();
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
      if (!textEl) continue;

      const { authorName, authorProfileUrl } = this._extractAuthor(commentEl);

      comments.push({
        text: textEl.textContent.trim(),
        authorName,
        authorProfileUrl,
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
