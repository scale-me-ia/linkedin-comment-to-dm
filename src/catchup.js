// ============================================================
// Catchup Module — Fetch old comments via LinkedIn's internal API
// Runs from content script (same origin = no CORS issues)
// ============================================================

/**
 * LinkedIn internal API helper.
 * Uses the Voyager API (same origin from content script on linkedin.com).
 */
class LinkedInAPI {
  constructor() {
    this._csrfToken = null;
  }

  /**
   * Extract CSRF token from JSESSIONID cookie
   */
  getCsrfToken() {
    if (this._csrfToken) return this._csrfToken;

    // Method 1: from JSESSIONID cookie
    const cookies = document.cookie.split(';');
    for (const cookie of cookies) {
      const [name, ...valueParts] = cookie.trim().split('=');
      if (name === 'JSESSIONID') {
        // Remove surrounding quotes if present
        this._csrfToken = valueParts.join('=').replace(/"/g, '');
        return this._csrfToken;
      }
    }

    // Method 2: from meta tag
    const metaCsrf = document.querySelector('meta[name="csrf-token"]');
    if (metaCsrf) {
      this._csrfToken = metaCsrf.getAttribute('content');
      return this._csrfToken;
    }

    // Method 3: from page scripts (clientApplicationInstance)
    try {
      const scripts = document.querySelectorAll('script');
      for (const script of scripts) {
        const text = script.textContent;
        if (text.includes('csrfToken')) {
          const match = text.match(/"csrfToken":"([^"]+)"/);
          if (match) {
            this._csrfToken = match[1];
            return this._csrfToken;
          }
        }
      }
    } catch (e) {}

    console.warn('[ScaleMe] Could not find CSRF token');
    return null;
  }

  /**
   * Build headers for Voyager API requests
   */
  getHeaders() {
    const csrf = this.getCsrfToken();
    return {
      'accept': 'application/vnd.linkedin.normalized+json+2.1',
      'csrf-token': csrf,
      'x-restli-protocol-version': '2.0.0',
      'x-li-lang': 'fr_FR',
      'x-li-page-instance': 'urn:li:page:feed_index_feed;' + Math.random().toString(36).slice(2),
    };
  }

  /**
   * Fetch from Voyager API
   */
  async fetch(path, params = {}) {
    const url = new URL(`https://www.linkedin.com/voyager/api${path}`);
    for (const [k, v] of Object.entries(params)) {
      url.searchParams.set(k, v);
    }

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: this.getHeaders(),
      credentials: 'include', // send cookies
    });

    if (!response.ok) {
      throw new Error(`LinkedIn API error: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Get the current user's profile URN
   */
  async getMyProfile() {
    const data = await this.fetch('/me');
    return data;
  }

  /**
   * Get the current user's recent posts (activity feed)
   * Returns array of post objects with URNs and text
   */
  async getMyPosts(count = 20, start = 0) {
    // Get the user's member URN first
    const profileData = await this.fetch('/identity/profiles', {
      q: 'me',
    });

    // Alternative: use the feed endpoint filtered to own posts
    const data = await this.fetch('/feed/updates', {
      q: 'memberShareFeed',
      count: count.toString(),
      start: start.toString(),
    });

    return this._extractPosts(data);
  }

  /**
   * Get comments on a specific post/activity
   * @param {string} activityUrn - e.g. "urn:li:activity:1234567890"
   * @param {number} count - max comments to fetch (default 100)
   * @param {number} start - pagination offset
   */
  async getComments(activityUrn, count = 100, start = 0) {
    const data = await this.fetch(`/feed/comments`, {
      q: 'comments',
      sortOrder: 'REVERSE_CHRONOLOGICAL',
      updateId: activityUrn,
      count: count.toString(),
      start: start.toString(),
    });

    return this._extractComments(data);
  }

  /**
   * Get ALL comments on a post (handles pagination)
   */
  async getAllComments(activityUrn) {
    const allComments = [];
    let start = 0;
    const pageSize = 100;
    let hasMore = true;

    while (hasMore) {
      const { comments, total } = await this.getComments(activityUrn, pageSize, start);
      allComments.push(...comments);
      start += pageSize;
      hasMore = allComments.length < total && comments.length === pageSize;

      // Safety: max 500 comments per post
      if (allComments.length >= 500) break;

      // Small delay between pages to not trigger rate limits
      if (hasMore) await new Promise(r => setTimeout(r, 1000 + Math.random() * 2000));
    }

    return allComments;
  }

  /**
   * Extract structured post data from Voyager response
   */
  _extractPosts(data) {
    const posts = [];
    const elements = data?.elements || data?.included || [];

    for (const el of elements) {
      // Look for share/ugcPost entities
      if (el.$type === 'com.linkedin.voyager.feed.render.UpdateV2' ||
          el.updateMetadata ||
          el.$type?.includes('Update')) {
        
        const urn = el.urn || el.updateUrn || el['*updateV2Urn'] || '';
        const activityUrn = el.activityUrn || urn;
        
        // Extract text from commentary
        let text = '';
        if (el.commentary?.text?.text) {
          text = el.commentary.text.text;
        } else if (el.commentary?.text) {
          text = typeof el.commentary.text === 'string' ? el.commentary.text : '';
        }

        // Try to get from included entities
        if (!text && data.included) {
          for (const inc of data.included) {
            if (inc.$type?.includes('TextComponent') && inc.text?.text) {
              // Match by checking if it's referenced by this update
              text = inc.text.text;
              break;
            }
          }
        }

        if (activityUrn) {
          posts.push({
            urn: activityUrn,
            text: text || '[no text extracted]',
            numComments: el.socialDetail?.totalSocialActivityCounts?.numComments || 0,
            numLikes: el.socialDetail?.totalSocialActivityCounts?.numLikes || 0,
          });
        }
      }
    }

    return posts;
  }

  /**
   * Extract structured comment data from Voyager response
   */
  _extractComments(data) {
    const comments = [];
    const total = data?.paging?.total || 0;
    const elements = data?.elements || [];
    const included = data?.included || [];

    // Build a lookup of included entities (profiles, etc.)
    const entityMap = {};
    for (const inc of included) {
      if (inc.entityUrn || inc.$recipeType) {
        entityMap[inc.entityUrn] = inc;
      }
    }

    for (const el of elements) {
      let authorName = '';
      let authorProfileUrl = '';
      let commentText = '';
      let commentUrn = el.urn || '';
      let timestamp = el.createdTime || 0;

      // Extract comment text
      if (el.comment?.values?.[0]?.value) {
        commentText = el.comment.values[0].value;
      } else if (el.commentV2?.text) {
        commentText = el.commentV2.text;
      } else if (el.message?.text) {
        commentText = el.message.text;
      } else if (typeof el.comment === 'string') {
        commentText = el.comment;
      }

      // Extract author info
      const authorRef = el.commenter || el.actor || el['*commenterForDashComment'];
      if (authorRef) {
        const authorEntity = typeof authorRef === 'string' 
          ? entityMap[authorRef] 
          : authorRef;

        if (authorEntity) {
          if (authorEntity.firstName && authorEntity.lastName) {
            authorName = `${authorEntity.firstName} ${authorEntity.lastName}`;
          } else if (authorEntity.title?.text) {
            authorName = authorEntity.title.text;
          } else if (authorEntity.name) {
            authorName = authorEntity.name;
          }

          if (authorEntity.publicIdentifier) {
            authorProfileUrl = `https://www.linkedin.com/in/${authorEntity.publicIdentifier}/`;
          }
        }
      }

      // Try extracting from included entities if author not found
      if (!authorName && el.commenterProfileId) {
        for (const inc of included) {
          if (inc.publicIdentifier === el.commenterProfileId ||
              inc.entityUrn?.includes(el.commenterProfileId)) {
            authorName = `${inc.firstName || ''} ${inc.lastName || ''}`.trim();
            authorProfileUrl = `https://www.linkedin.com/in/${inc.publicIdentifier || el.commenterProfileId}/`;
            break;
          }
        }
      }

      if (commentText || commentUrn) {
        comments.push({
          urn: commentUrn,
          text: commentText,
          authorName: authorName || 'Unknown',
          authorProfileUrl,
          timestamp,
        });
      }
    }

    return { comments, total };
  }
}

// Export for use in content script
if (typeof window !== 'undefined') {
  window.ScaleMeLinkedInAPI = LinkedInAPI;
}
