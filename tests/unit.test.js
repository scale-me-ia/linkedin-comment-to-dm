// ============================================================
// Unit Tests — Scale Me LinkedIn Extension
// Run with: node --test tests/unit.test.js
// Zero dependencies — uses Node.js built-in test runner
// ============================================================

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

// ── Replicate pure functions from content-script.js ──────────

function extractFirstName(fullName) {
  if (!fullName) return '';
  return fullName.trim().split(/\s+/)[0];
}

function fillTemplate(template, vars) {
  return template
    .replace(/\{\{firstName\}\}/g, vars.firstName || '')
    .replace(/\{\{fullName\}\}/g, vars.fullName || '')
    .replace(/\{\{link\}\}/g, vars.link || '')
    .replace(/\{\{keyword\}\}/g, vars.keyword || '')
    .replace(/\{\{thematic\}\}/g, vars.thematic || '');
}

function getCommentId(postUrn, authorName, commentText) {
  const raw = `${postUrn}|${authorName}|${commentText.substring(0, 50)}`;
  let hash = 0;
  for (let i = 0; i < raw.length; i++) {
    hash = ((hash << 5) - hash) + raw.charCodeAt(i);
    hash |= 0;
  }
  return `comment_${Math.abs(hash).toString(36)}`;
}

function getTodayKey() {
  return new Date().toISOString().split('T')[0];
}

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

// Keyword matching logic (from analyzeComment)
function matchKeyword(commentText, keywords) {
  const text = commentText.trim().toLowerCase();
  return keywords.find(k => text.includes(k.toLowerCase())) || null;
}

// Dynamic message generators
const REPLY_VARIATIONS = [
  "C'est envoyé en DM ! 🚀",
  "Envoyé en message privé ✅",
  "C'est parti en DM 📩",
  "Je t'envoie ça en privé ! 🎯",
  "Check tes DMs ! 📬",
  "Message privé envoyé 👍",
  "C'est dans ta boîte de messages ! ✉️",
  "Hop, envoyé en DM ⚡",
  "Je te fais passer ça en privé 🤝",
];

const DM_OPENERS = [
  "Salut {{firstName}} !",
  "Hey {{firstName}} 👋",
  "Hello {{firstName}} !",
  "{{firstName}}, voilà !",
  "Salut {{firstName}} 🙂",
];

const DM_BODIES = [
  "Suite à ton commentaire, voici le contenu : {{link}}",
  "Comme promis, voici le document : {{link}}",
  "Voilà le lien vers le contenu : {{link}}",
  "Tu trouveras tout ici : {{link}}",
  "Comme demandé, le voici : {{link}}",
  "Le contenu est dispo ici : {{link}}",
];

const DM_CLOSERS = [
  "Bonne lecture ! 📖",
  "Hésite pas si t'as des questions 💬",
  "Dis-moi ce que t'en penses !",
  "Bonne lecture, et hésite pas à revenir vers moi 🤝",
  "J'espère que ça t'aidera ! 🚀",
  "Enjoy ! ⚡",
];

function generateDynamicReply(baseTemplate, vars, dynamicMessages) {
  if (!dynamicMessages) return fillTemplate(baseTemplate, vars);
  return fillTemplate(pick(REPLY_VARIATIONS), vars);
}

function generateDynamicDM(baseTemplate, vars, dynamicMessages) {
  if (!dynamicMessages) return fillTemplate(baseTemplate, vars);
  const opener = fillTemplate(pick(DM_OPENERS), vars);
  const body = fillTemplate(pick(DM_BODIES), vars);
  const closer = fillTemplate(pick(DM_CLOSERS), vars);
  return `${opener}\n\n${body}\n\n${closer}`;
}

// ── Tests ────────────────────────────────────────────────────

describe('extractFirstName', () => {
  it('extracts first name from full name', () => {
    assert.equal(extractFirstName('Pierre Dupont'), 'Pierre');
  });

  it('handles single name', () => {
    assert.equal(extractFirstName('Pierre'), 'Pierre');
  });

  it('handles multiple spaces', () => {
    assert.equal(extractFirstName('  Jean  Pierre  Dupont  '), 'Jean');
  });

  it('returns empty for null/undefined/empty', () => {
    assert.equal(extractFirstName(null), '');
    assert.equal(extractFirstName(undefined), '');
    assert.equal(extractFirstName(''), '');
  });

  it('handles compound first names', () => {
    assert.equal(extractFirstName('Jean-Pierre Dupont'), 'Jean-Pierre');
  });
});

describe('fillTemplate', () => {
  const vars = {
    firstName: 'Pierre',
    fullName: 'Pierre Dupont',
    link: 'https://example.com/guide.pdf',
    keyword: 'GUIDE',
    thematic: 'Guide IA',
  };

  it('replaces all template variables', () => {
    const result = fillTemplate('Salut {{firstName}} ({{fullName}}) ! Voici {{link}} pour {{keyword}} de {{thematic}}', vars);
    assert.equal(result, 'Salut Pierre (Pierre Dupont) ! Voici https://example.com/guide.pdf pour GUIDE de Guide IA');
  });

  it('replaces multiple occurrences of same variable', () => {
    const result = fillTemplate('{{firstName}} dit bonjour, {{firstName}} !', vars);
    assert.equal(result, 'Pierre dit bonjour, Pierre !');
  });

  it('handles missing variables gracefully', () => {
    const result = fillTemplate('Salut {{firstName}} ! {{link}}', {});
    assert.equal(result, 'Salut  ! ');
  });

  it('leaves non-template text unchanged', () => {
    const result = fillTemplate('Texte simple sans variables', vars);
    assert.equal(result, 'Texte simple sans variables');
  });

  it('handles empty template', () => {
    assert.equal(fillTemplate('', vars), '');
  });
});

describe('getCommentId', () => {
  it('generates deterministic IDs', () => {
    const id1 = getCommentId('urn:li:activity:123', 'Pierre', 'GUIDE');
    const id2 = getCommentId('urn:li:activity:123', 'Pierre', 'GUIDE');
    assert.equal(id1, id2);
  });

  it('generates different IDs for different inputs', () => {
    const id1 = getCommentId('urn:li:activity:123', 'Pierre', 'GUIDE');
    const id2 = getCommentId('urn:li:activity:456', 'Pierre', 'GUIDE');
    const id3 = getCommentId('urn:li:activity:123', 'Jean', 'GUIDE');
    assert.notEqual(id1, id2);
    assert.notEqual(id1, id3);
  });

  it('starts with comment_ prefix', () => {
    const id = getCommentId('urn:li:activity:123', 'Pierre', 'GUIDE');
    assert.ok(id.startsWith('comment_'));
  });

  it('truncates long comment text to 50 chars for hashing', () => {
    const longText = 'A'.repeat(200);
    const id1 = getCommentId('urn', 'Author', longText);
    const id2 = getCommentId('urn', 'Author', longText + 'EXTRA');
    assert.equal(id1, id2); // Same first 50 chars = same ID
  });
});

describe('matchKeyword', () => {
  it('matches exact keyword (case insensitive)', () => {
    assert.equal(matchKeyword('GUIDE', ['guide', 'pdf']), 'guide');
  });

  it('matches keyword as substring', () => {
    assert.equal(matchKeyword('Je veux le GUIDE svp', ['guide']), 'guide');
  });

  it('is case insensitive', () => {
    assert.equal(matchKeyword('guide', ['GUIDE']), 'GUIDE');
    assert.equal(matchKeyword('GuIdE', ['guide']), 'guide');
  });

  it('returns first matching keyword', () => {
    assert.equal(matchKeyword('GUIDE et PDF', ['guide', 'pdf']), 'guide');
  });

  it('returns null when no match', () => {
    assert.equal(matchKeyword('Bonjour tout le monde', ['guide', 'pdf']), null);
  });

  it('handles empty keywords array', () => {
    assert.equal(matchKeyword('GUIDE', []), null);
  });

  it('handles empty comment text', () => {
    assert.equal(matchKeyword('', ['guide']), null);
  });

  it('matches with surrounding whitespace', () => {
    assert.equal(matchKeyword('  GUIDE  ', ['guide']), 'guide');
  });
});

describe('getTodayKey', () => {
  it('returns date in YYYY-MM-DD format', () => {
    const key = getTodayKey();
    assert.match(key, /^\d{4}-\d{2}-\d{2}$/);
  });
});

describe('generateDynamicReply', () => {
  const vars = { firstName: 'Pierre', link: 'https://example.com' };

  it('returns base template when dynamic is off', () => {
    const result = generateDynamicReply('Template de base {{firstName}}', vars, false);
    assert.equal(result, 'Template de base Pierre');
  });

  it('returns a variation when dynamic is on', () => {
    const result = generateDynamicReply('Unused', vars, true);
    assert.ok(REPLY_VARIATIONS.includes(result));
  });

  it('all variations are non-empty strings', () => {
    for (const v of REPLY_VARIATIONS) {
      assert.ok(typeof v === 'string' && v.length > 0);
    }
  });
});

describe('generateDynamicDM', () => {
  const vars = { firstName: 'Pierre', link: 'https://example.com/guide.pdf' };

  it('returns base template when dynamic is off', () => {
    const result = generateDynamicDM('Salut {{firstName}} ! {{link}}', vars, false);
    assert.equal(result, 'Salut Pierre ! https://example.com/guide.pdf');
  });

  it('returns a 3-part message when dynamic is on', () => {
    const result = generateDynamicDM('Unused', vars, true);
    const parts = result.split('\n\n');
    assert.equal(parts.length, 3, 'Should have opener, body, closer separated by double newlines');
  });

  it('includes firstName in opener', () => {
    const result = generateDynamicDM('Unused', vars, true);
    const opener = result.split('\n\n')[0];
    assert.ok(opener.includes('Pierre'), `Opener should contain firstName: "${opener}"`);
  });

  it('includes link in body', () => {
    const result = generateDynamicDM('Unused', vars, true);
    const body = result.split('\n\n')[1];
    assert.ok(body.includes('https://example.com/guide.pdf'), `Body should contain link: "${body}"`);
  });
});

describe('Daily limits logic', () => {
  const MAX_REPLIES = 25;
  const MAX_DMS = 20;

  it('allows actions within limits', () => {
    const counters = { replies: 10, dms: 5 };
    const blocked = counters.replies >= MAX_REPLIES || counters.dms >= MAX_DMS;
    assert.equal(blocked, false);
  });

  it('blocks when reply limit reached', () => {
    const counters = { replies: 25, dms: 5 };
    const blocked = counters.replies >= MAX_REPLIES || counters.dms >= MAX_DMS;
    assert.equal(blocked, true);
  });

  it('blocks when DM limit reached', () => {
    const counters = { replies: 10, dms: 20 };
    const blocked = counters.replies >= MAX_REPLIES || counters.dms >= MAX_DMS;
    assert.equal(blocked, true);
  });

  it('blocks when both limits reached', () => {
    const counters = { replies: 25, dms: 20 };
    const blocked = counters.replies >= MAX_REPLIES || counters.dms >= MAX_DMS;
    assert.equal(blocked, true);
  });
});

describe('Selectors consistency', () => {
  // Load the selectors file to verify it's valid JS
  it('selectors.js defines all required keys', () => {
    // Simulate what selectors.js does
    const requiredKeys = [
      'FEED_CONTAINER', 'POST_CONTAINER', 'POST_URN',
      'COMMENT_ITEM', 'COMMENT_TEXT', 'COMMENT_AUTHOR',
      'COMMENT_REPLY_BTN', 'COMMENT_INPUT', 'COMMENT_SUBMIT_BTN',
      'MSG_COMPOSE_BTN', 'MSG_BODY_INPUT', 'MSG_SEND_BTN',
    ];

    // Read selectors.js content and verify keys exist
    const fs = require('fs');
    const path = require('path');
    const content = fs.readFileSync(path.join(__dirname, '..', 'src', 'selectors.js'), 'utf8');

    for (const key of requiredKeys) {
      assert.ok(content.includes(key), `selectors.js should contain ${key}`);
    }
  });

  it('all selectors are non-empty strings', () => {
    const fs = require('fs');
    const path = require('path');
    const content = fs.readFileSync(path.join(__dirname, '..', 'src', 'selectors.js'), 'utf8');

    // Extract key-value pairs
    const matches = content.matchAll(/(\w+):\s*'([^']+)'/g);
    for (const match of matches) {
      assert.ok(match[2].length > 0, `${match[1]} should have non-empty value`);
    }
  });
});
