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

    // Method 3: scan page scripts
    try {
      const scripts = document.querySelectorAll('script');
      for (const script of scripts) {
        const text = script.textContent;
        if (text.includes('csrfToken')) {
          const match = text.match(/"csrfToken"\s*:\s*"([^"]+)"/);
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
    };
  }

  /**
   * Fetch from Voyager API with error handling
   */
  async apiFetch(path, params = {}) {
    const url = new URL(`https://www.linkedin.com/voyager/api${path}`);
    for (const [k, v] of Object.entries(params)) {
      url.searchParams.set(k, v);
    }

    console.log(`[ScaleMe] [API] GET ${url.pathname}${url.search}`);

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: this.getHeaders(),
      credentials: 'include',
    });

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      throw new Error(`LinkedIn API error: ${response.status} (${response.statusText}) — ${text.substring(0, 200)}`);
    }

    return response.json();
  }

  /**
   * Get the current user's recent posts via multiple endpoint strategies
   */
  async getMyPosts(count = 20) {
    const strategies = [
      // Strategy 1: Member feed
      () => this.apiFetch('/feed/updates', { q: 'memberFeed', count: String(count), start: '0' }),
      // Strategy 2: Dash feed updates  
      () => this.apiFetch('/feed/dash/updates', { q: 'vFeed', moduleKey: 'member-shares:created', count: String(count) }),
      // Strategy 3: Profile network updates
      () => this.apiFetch('/feed/updates', { q: 'networkUpdates', count: String(count), start: '0' }),
    ];

    for (let i = 0; i < strategies.length; i++) {
      try {
        console.log(`[ScaleMe] [API] Trying posts strategy ${i + 1}/${strategies.length}...`);
        const data = await strategies[i]();
        const posts = this._extractPosts(data);
        if (posts.length > 0) {
          console.log(`[ScaleMe] [API] Strategy ${i + 1} found ${posts.length} posts`);
          return posts;
        }
      } catch (err) {
        console.warn(`[ScaleMe] [API] Strategy ${i + 1} failed:`, err.message);
      }
    }

    // If all API strategies fail, return empty (popup will show helpful message)
    console.warn('[ScaleMe] [API] All post fetch strategies failed');
    return [];
  }

  /**
   * Get ALL comments on a post (handles pagination) via multiple endpoint strategies
   */
  async getAllComments(activityUrn) {
    const allComments = [];
    let start = 0;
    const pageSize = 100;
    let hasMore = true;
    let total = 0;
    let workingStrategy = null;

    while (hasMore) {
      let result = null;

      if (workingStrategy !== null) {
        // Reuse the strategy that worked before
        try {
          result = await this._fetchCommentsWithStrategy(workingStrategy, activityUrn, pageSize, start);
        } catch (err) {
          console.warn(`[ScaleMe] [API] Comments strategy ${workingStrategy} broke:`, err.message);
          workingStrategy = null;
        }
      }

      if (!result) {
        // Try all strategies
        result = await this._fetchCommentsAnyStrategy(activityUrn, pageSize, start);
        if (result) {
          workingStrategy = result.strategyIndex;
        }
      }

      if (!result || !result.comments) break;

      allComments.push(...result.comments);
      total = result.total || allComments.length;
      start += pageSize;
      hasMore = allComments.length < total && result.comments.length === pageSize;

      if (allComments.length >= 500) break;
      if (hasMore) await new Promise(r => setTimeout(r, 1000 + Math.random() * 2000));
    }

    return allComments;
  }

  async _fetchCommentsAnyStrategy(activityUrn, count, start) {
    const strategies = this._getCommentStrategies(activityUrn, count, start);

    for (let i = 0; i < strategies.length; i++) {
      try {
        console.log(`[ScaleMe] [API] Trying comments strategy ${i + 1}/${strategies.length}...`);
        const data = await strategies[i]();
        const result = this._extractComments(data);
        if (result.comments.length > 0 || result.total > 0) {
          console.log(`[ScaleMe] [API] Comments strategy ${i + 1} found ${result.comments.length} comments (total: ${result.total})`);
          return { ...result, strategyIndex: i };
        }
      } catch (err) {
        console.warn(`[ScaleMe] [API] Comments strategy ${i + 1} failed:`, err.message);
      }
    }

    return null;
  }

  async _fetchCommentsWithStrategy(strategyIndex, activityUrn, count, start) {
    const strategies = this._getCommentStrategies(activityUrn, count, start);
    const data = await strategies[strategyIndex]();
    return this._extractComments(data);
  }

  _getCommentStrategies(activityUrn, count, start) {
    // Convert URN formats for different endpoints
    const encodedUrn = encodeURIComponent(activityUrn);
    
    // Extract the numeric ID from the URN
    const numericId = activityUrn.split(':').pop();
    
    // Build ugcPost URN variant
    const ugcPostUrn = `urn:li:ugcPost:${numericId}`;
    const encodedUgcUrn = encodeURIComponent(ugcPostUrn);

    return [
      // Strategy 1: comments by update ID
      () => this.apiFetch('/feed/comments', {
        q: 'comments',
        sortOrder: 'REVERSE_CHRONOLOGICAL',
        updateId: activityUrn,
        count: String(count),
        start: String(start),
      }),
      // Strategy 2: ugcPostComments
      () => this.apiFetch('/feed/comments', {
        q: 'ugcPostComments',
        ugcPostUrn: ugcPostUrn,
        sortOrder: 'RELEVANCE',
        count: String(count),
        start: String(start),
      }),
      // Strategy 3: socialActions comments
      () => this.apiFetch(`/socialActions/${encodedUrn}/comments`, {
        count: String(count),
        start: String(start),
      }),
      // Strategy 4: dash comments
      () => this.apiFetch('/feed/dash/comments', {
        q: 'comments',
        updateId: activityUrn,
        count: String(count),
        start: String(start),
      }),
      // Strategy 5: with activity URN as object
      () => this.apiFetch('/feed/comments', {
        q: 'comments',
        objectUrn: activityUrn,
        sortOrder: 'REVERSE_CHRONOLOGICAL',
        count: String(count),
        start: String(start),
      }),
    ];
  }

  /**
   * Extract structured post data from Voyager response
   */
  _extractPosts(data) {
    const posts = [];
    
    // Voyager responses can have data in elements, included, or data
    const elements = data?.elements || data?.included || data?.data?.elements || [];

    for (const el of elements) {
      const urn = el.urn || el.updateUrn || el.activityUrn || el.entityUrn || '';
      
      // Only include activity/ugcPost URNs
      if (!urn.includes('activity') && !urn.includes('ugcPost') && !urn.includes('share')) continue;

      let text = '';
      
      // Multiple ways text can be stored
      if (el.commentary?.text?.text) text = el.commentary.text.text;
      else if (el.commentary?.text) text = typeof el.commentary.text === 'string' ? el.commentary.text : '';
      else if (el.specificContent?.['com.linkedin.ugc.ShareContent']?.shareCommentary?.text) {
        text = el.specificContent['com.linkedin.ugc.ShareContent'].shareCommentary.text;
      }
      else if (el.value?.['com.linkedin.voyager.feed.render.UpdateV2']?.commentary?.text?.text) {
        text = el.value['com.linkedin.voyager.feed.render.UpdateV2'].commentary.text.text;
      }

      // Extract from included if needed
      if (!text && data.included) {
        for (const inc of data.included) {
          if (inc.commentary?.text?.text && inc.updateUrn === urn) {
            text = inc.commentary.text.text;
            break;
          }
        }
      }

      const numComments = 
        el.socialDetail?.totalSocialActivityCounts?.numComments ||
        el.numComments ||
        el.socialCounts?.numComments ||
        0;

      if (urn) {
        posts.push({ urn, text: text || '', numComments });
      }
    }

    // Also scan "included" for posts
    if (data?.included && posts.length === 0) {
      for (const inc of data.included) {
        const urn = inc.updateUrn || inc.activityUrn || inc.entityUrn || '';
        if (urn.includes('activity') || urn.includes('ugcPost')) {
          let text = '';
          if (inc.commentary?.text?.text) text = inc.commentary.text.text;
          posts.push({ urn, text: text || '', numComments: 0 });
        }
      }
    }

    // Deduplicate by URN
    const seen = new Set();
    return posts.filter(p => {
      if (seen.has(p.urn)) return false;
      seen.add(p.urn);
      return true;
    });
  }

  /**
   * Extract structured comment data from Voyager response
   */
  _extractComments(data) {
    const comments = [];
    const total = data?.paging?.total || data?.total || 0;
    const elements = data?.elements || [];
    const included = data?.included || [];

    // Build entity lookup
    const entityMap = {};
    for (const inc of included) {
      const key = inc.entityUrn || inc['*commenter'] || '';
      if (key) entityMap[key] = inc;
    }

    for (const el of elements) {
      let authorName = '';
      let authorProfileUrl = '';
      let commentText = '';
      let timestamp = el.createdTime || el.created?.time || 0;

      // Extract comment text — try multiple formats
      if (el.comment?.values?.[0]?.value) commentText = el.comment.values[0].value;
      else if (el.commentV2?.text) commentText = el.commentV2.text;
      else if (el.message?.text) commentText = el.message.text;
      else if (el.commentary?.text?.text) commentText = el.commentary.text.text;
      else if (typeof el.comment === 'string') commentText = el.comment;
      else if (el.message?.attributedBody?.text) commentText = el.message.attributedBody.text;

      // Extract author — try multiple formats
      const authorRef = el.commenter || el.actor || el['*commenter'] || el.commenterForDashComment;
      
      if (authorRef) {
        const authorEntity = typeof authorRef === 'string' ? entityMap[authorRef] : authorRef;
        
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
          } else if (authorEntity.navigationUrl) {
            authorProfileUrl = authorEntity.navigationUrl;
          }
        }
      }

      // Fallback: search in included for actor/commenter
      if (!authorName) {
        for (const inc of included) {
          if (inc.$type?.includes('MiniProfile') || inc.$type?.includes('Profile')) {
            if (inc.firstName && inc.lastName) {
              // Best effort: take the first profile found for this comment
              authorName = `${inc.firstName} ${inc.lastName}`;
              if (inc.publicIdentifier) {
                authorProfileUrl = `https://www.linkedin.com/in/${inc.publicIdentifier}/`;
              }
              break;
            }
          }
        }
      }

      if (commentText) {
        comments.push({
          urn: el.urn || el.entityUrn || '',
          text: commentText,
          authorName: authorName || 'Unknown',
          authorProfileUrl,
          timestamp,
        });
      }
    }

    return { comments, total: total || comments.length };
  }
}

// Export for use in content script
if (typeof window !== 'undefined') {
  window.ScaleMeLinkedInAPI = LinkedInAPI;
}
