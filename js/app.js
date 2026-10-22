/**
 * Sushmita Sharma Portfolio - Core Application & Utility Library
 * Architecture: Clean Vanilla ES6+ Module with Defensive Helpers and Safe Content Rendering
 * Author: Sushmita Sharma (Refactored to Staff Frontend Standard)
 */

(function () {
  'use strict';

  /**
   * Safe HTML Escaping utility to protect against XSS injections.
   * @param {string|null|undefined} str - Raw string to escape.
   * @returns {string} Sanitized HTML string.
   */
  const escapeHtml = (str) => {
    if (str == null) return '';
    const map = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    };
    return String(str).replace(/[&<>"']/g, (char) => map[char]);
  };

  /**
   * Formats ISO date string into a friendly, human-readable format.
   * @param {string} dateStr - e.g. "2025-06-01"
   * @returns {string} e.g. "Jun 2025"
   */
  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return '';
    return date.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' });
  };

  /**
   * Lightweight, safe Markdown-to-HTML parser.
   * Handles headings, bullet lists, bold text, and paragraphs.
   * @param {string} markdownText - Raw markdown string.
   * @returns {string} HTML string.
   */
  const renderMarkdown = (markdownText) => {
    if (!markdownText) return '';
    
    // Split into distinct blocks by double newline
    const blocks = String(markdownText).split(/\n\s*\n/);
    
    return blocks
      .map((block) => {
        const trimmed = block.trim();
        if (!trimmed) return '';

        const lines = trimmed.split('\n');
        let htmlOutput = '';
        let listBuffer = [];

        const flushList = () => {
          if (listBuffer.length > 0) {
            htmlOutput += `<ul>${listBuffer.join('')}</ul>`;
            listBuffer = [];
          }
        };

        lines.forEach((line) => {
          const trimmedLine = line.trim();

          if (/^### (.*)/.test(trimmedLine)) {
            flushList();
            const headingText = escapeHtml(trimmedLine.replace(/^### /, ''));
            htmlOutput += `<h3>${headingText}</h3>`;
          } else if (/^## (.*)/.test(trimmedLine)) {
            flushList();
            const headingText = escapeHtml(trimmedLine.replace(/^## /, ''));
            htmlOutput += `<h2>${headingText}</h2>`;
          } else if (/^- (.*)/.test(trimmedLine)) {
            const rawContent = trimmedLine.replace(/^- /, '');
            // Simple inline bold formatting
            const parsedContent = escapeHtml(rawContent).replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
            listBuffer.push(`<li>${parsedContent}</li>`);
          } else if (trimmedLine) {
            flushList();
            const parsedContent = escapeHtml(trimmedLine).replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
            htmlOutput += `<p>${parsedContent}</p>`;
          }
        });

        flushList();
        return htmlOutput;
      })
      .join('');
  };

  /**
   * Generates markup for tag chips.
   * @param {Array<string>} tags - Array of tag names.
   * @returns {string} HTML markup.
   */
  const renderChips = (tags = []) => {
    if (!Array.isArray(tags) || tags.length === 0) return '';
    const chipsHtml = tags
      .map((tag) => `<span>${escapeHtml(tag)}</span>`)
      .join('');
    return `<div class="chips">${chipsHtml}</div>`;
  };

  /**
   * Generates card markup for a case study or blog post.
   * @param {Object} item - Data item (title, slug, date, summary, tags).
   * @param {string} kind - 'work' or 'blog'.
   * @returns {string} HTML string.
   */
  const renderCard = (item, kind) => {
    if (!item) return '';
    const targetUrl = kind === 'blog' ? 'blog-post.html' : 'work-detail.html';
    const href = `${targetUrl}?slug=${encodeURIComponent(item.slug)}`;
    const formattedDate = formatDate(item.date);
    
    return `
      <a class="card" href="${href}">
        <small>${escapeHtml(formattedDate)}</small>
        <h3>${escapeHtml(item.title)}</h3>
        <p>${escapeHtml(item.summary)}</p>
        ${renderChips(item.tags)}
      </a>
    `;
  };

  /**
   * Retrieves a URL query parameter by name.
   * @param {string} paramName - Parameter key.
   * @returns {string|null} Parameter value.
   */
  const getQueryParam = (paramName) => {
    return new URLSearchParams(window.location.search).get(paramName);
  };

  /**
   * Updates document title and meta description dynamically.
   * @param {string} pageTitle - Title prefix.
   * @param {string} description - Description content.
   */
  const updateMetaTags = (pageTitle, description) => {
    if (pageTitle) {
      document.title = `${pageTitle} | Sushmita Sharma`;
    }
    if (description) {
      const metaDesc = document.querySelector('meta[name="description"]');
      if (metaDesc) {
        metaDesc.setAttribute('content', String(description).slice(0, 155));
      }
    }
  };

  // State Management
  const initialContent = window.SITE_CONTENT || { works: [], posts: [] };
  const store = {
    works: Array.isArray(initialContent.works) ? [...initialContent.works] : [],
    posts: Array.isArray(initialContent.posts) ? [...initialContent.posts] : []
  };

  /**
   * Fetches all items of a given collection sorted descending by date.
   * @param {'works'|'posts'} collectionKey
   * @returns {Array<Object>} Sorted items copy.
   */
  const getAll = (collectionKey) => {
    const list = store[collectionKey] || [];
    return [...list].sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
  };

  /**
   * Updates the global content store.
   * @param {{ works: Array, posts: Array }} newContent
   */
  const setStore = (newContent) => {
    if (newContent && Array.isArray(newContent.works)) {
      store.works = [...newContent.works];
    }
    if (newContent && Array.isArray(newContent.posts)) {
      store.posts = [...newContent.posts];
    }
  };

  // Auto-update footer copyright year
  const updateCopyrightYear = () => {
    const yearEl = document.getElementById('yr');
    if (yearEl) {
      yearEl.textContent = String(new Date().getFullYear());
    }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', updateCopyrightYear);
  } else {
    updateCopyrightYear();
  }

  // Expose public API on window.App with full backward compatibility
  window.App = {
    store,
    S: store, // Backward compatibility alias
    all: getAll,
    md: renderMarkdown,
    renderMarkdown,
    esc: escapeHtml,
    escapeHtml,
    chips: renderChips,
    renderChips,
    fd: formatDate,
    formatDate,
    card: renderCard,
    renderCard,
    meta: updateMetaTags,
    updateMetaTags,
    qs: getQueryParam,
    getQueryParam,
    ready: Promise.resolve(),
    set: setStore
  };
})();
