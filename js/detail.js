/**
 * Sushmita Sharma Portfolio - Detail Page Controller
 * Handles dynamic content loading, JSON-LD metadata, and SEO tags for Work Case Studies and Blog Posts
 */

(function () {
  'use strict';

  /** Returns true if the path is an image file. */
  const isImagePath = (p) => /\.(jpe?g|png|gif|webp|svg|bmp|avif|ico)$/i.test(p);

  /** Returns a safe file name from a path. */
  const baseName = (p) => p.split('/').pop();

  const renderDetailPage = () => {
    const articleContainer = document.getElementById('art');
    if (!articleContainer) return;

    const kind         = document.body.dataset.kind || 'work';
    const isBlog       = kind === 'blog';
    const collectionKey= isBlog ? 'posts' : 'works';
    const backUrl      = isBlog ? 'blog.html'   : 'work.html';
    const backLabel    = isBlog ? 'All posts'    : 'All work';
    const typeLabel    = isBlog ? 'Blog'         : 'Case study';

    const slug  = window.App ? window.App.qs('slug') : null;
    const items = window.App ? window.App.all(collectionKey) : [];
    const item  = items.find((e) => e.slug === slug);

    if (!item) {
      articleContainer.innerHTML = `
        <div class="not-found-state">
          <h1>Entry Not Found</h1>
          <p class="lead">The requested ${typeLabel.toLowerCase()} could not be located or may have been renamed.</p>
          <div class="row"><a class="btn" href="${backUrl}">&larr; Return to ${backLabel.toLowerCase()}</a></div>
        </div>`;
      window.App.meta('Page Not Found', 'The requested page was not found.');
      return;
    }

    window.App.meta(item.title, item.summary);

    // JSON-LD
    const jsonLd = document.createElement('script');
    jsonLd.type = 'application/ld+json';
    jsonLd.textContent = JSON.stringify({
      '@context': 'https://schema.org',
      '@type': isBlog ? 'BlogPosting' : 'CreativeWork',
      headline: item.title, description: item.summary, datePublished: item.date,
      author: { '@type': 'Person', name: 'Sushmita Sharma' }
    });
    document.head.appendChild(jsonLd);

    const fd           = window.App.fd(item.date);
    const escapedTitle = window.App.esc(item.title);
    const subject      = encodeURIComponent(`Discussing: ${item.title}`);

    // ── Dashboard iframe ─────────────────────────────────────────────────
    const dashboardHtml = item.dashboardUrl ? `
      <div class="dashboard-section">
        <div class="dashboard-header">
          <h2 class="dashboard-title">Live Dashboard</h2>
          <a class="btn dashboard-open-btn" href="${window.App.esc(item.dashboardUrl)}" target="_blank" rel="noopener noreferrer">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
            Open in new tab
          </a>
        </div>
        <div class="dashboard-iframe-wrap">
          <div class="dashboard-blocked" id="dashboard-fallback" hidden>
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="9" y1="9" x2="15" y2="15"/><line x1="15" y1="9" x2="9" y2="15"/></svg>
            <p>This site does not allow embedding in iframes.</p>
            <a class="btn" href="${window.App.esc(item.dashboardUrl)}" target="_blank" rel="noopener noreferrer">Open dashboard &rarr;</a>
          </div>
          <iframe src="${window.App.esc(item.dashboardUrl)}" class="dashboard-iframe" id="dashboard-iframe"
            title="Live dashboard for ${escapedTitle}" loading="lazy" allowfullscreen></iframe>
        </div>
      </div>` : '';

    // ── Video player ─────────────────────────────────────────────────────
    const videoHtml = item.videoPath ? `
      <div class="project-video-section">
        <div class="dashboard-header">
          <h2 class="dashboard-title">Project Walkthrough</h2>
          <a class="btn dashboard-open-btn" href="${window.App.esc(item.videoPath)}" target="_blank" rel="noopener noreferrer">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
            Open in new tab
          </a>
        </div>
        <div class="project-video-wrap">
          <video class="project-video-player" controls preload="metadata">
            <source src="${window.App.esc(item.videoPath)}">
            <p class="note">Your browser does not support HTML5 video.
              <a href="${window.App.esc(item.videoPath)}">Download the video</a> to watch it.</p>
          </video>
        </div>
      </div>` : '';

    // ── Attachments gallery (images + documents) ──────────────────────────
    let attachHtml = '';
    if (Array.isArray(item.attachments) && item.attachments.length > 0) {
      const images = item.attachments.filter(isImagePath);
      const docs   = item.attachments.filter(p => !isImagePath(p));

      const imageGrid = images.length ? `
        <div class="attach-image-grid">
          ${images.map(p => `
            <figure class="attach-figure">
              <a href="${window.App.esc(p)}" target="_blank" rel="noopener noreferrer" class="attach-img-link">
                <img src="${window.App.esc(p)}" alt="${window.App.esc(baseName(p))}" loading="lazy" class="attach-img">
              </a>
            </figure>`).join('')}
        </div>` : '';

      const docList = docs.length ? `
        <div class="attach-doc-list">
          ${docs.map(p => {
            const name = baseName(p);
            const ext  = (name.split('.').pop() || '').toUpperCase();
            return `
            <a href="${window.App.esc(p)}" target="_blank" rel="noopener noreferrer" class="attach-doc-card" download>
              <span class="attach-doc-ext">${window.App.esc(ext)}</span>
              <span class="attach-doc-name">${window.App.esc(name)}</span>
              <svg class="attach-doc-dl" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            </a>`;
          }).join('')}
        </div>` : '';

      attachHtml = `
        <div class="attach-section">
          <h2 class="attach-section-title">Images &amp; Documents</h2>
          ${imageGrid}
          ${docList}
        </div>`;
    }

    // ── Assemble full article ─────────────────────────────────────────────
    articleContainer.innerHTML = `
      <a class="art-back" href="${backUrl}"><span aria-hidden="true">&larr;</span> ${backLabel}</a>
      <p class="meta">${typeLabel} &middot; <time datetime="${item.date}">${window.App.esc(fd)}</time></p>
      <h1>${escapedTitle}</h1>
      ${window.App.chips(item.tags)}
      <div class="art-body">${window.App.md(item.body)}</div>
      ${attachHtml}
      ${videoHtml}
      ${dashboardHtml}
      <div class="art-cta-section">
        <div class="row">
          <a class="btn" href="mailto:sushmitasharma741@gmail.com?subject=${subject}">Discuss this with me</a>
          <a class="btn o" href="${backUrl}">Back to ${backLabel.toLowerCase()}</a>
        </div>
      </div>`;

    // Iframe block-detection
    const iframeEl   = document.getElementById('dashboard-iframe');
    const fallbackEl = document.getElementById('dashboard-fallback');
    if (iframeEl && fallbackEl) {
      iframeEl.addEventListener('load', () => {
        try {
          const doc = iframeEl.contentDocument;
          if (!doc || !doc.body || doc.body.innerHTML.trim() === '') {
            iframeEl.hidden = true; fallbackEl.hidden = false;
          }
        } catch { /* cross-origin OK — iframe loaded fine */ }
      });
    }
  };

  if (window.App && window.App.ready) {
    window.App.ready.then(renderDetailPage);
  } else {
    document.addEventListener('DOMContentLoaded', renderDetailPage);
  }
})();
