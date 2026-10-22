/**
 * Sushmita Sharma Portfolio - Home Page Controller
 * Initializes portfolio grid and interactive scroll story visualization
 */

(function () {
  'use strict';

  /**
   * Renders selected work case studies into the home page grid.
   */
  const renderFeaturedWorks = () => {
    const gridContainer = document.getElementById('works-grid');
    if (!gridContainer) return;

    const works = window.App ? window.App.all('works') : [];

    if (works.length === 0) {
      gridContainer.innerHTML = '<p class="note">Case studies are loading or currently empty.</p>';
      return;
    }

    gridContainer.innerHTML = works
      .map((work) => window.App.card(work, 'work'))
      .join('');
  };

  // Initialize interactive story and load portfolio grid
  if (typeof window.initStory === 'function') {
    window.initStory();
  }

  if (window.App && window.App.ready) {
    window.App.ready.then(renderFeaturedWorks);
  } else {
    document.addEventListener('DOMContentLoaded', renderFeaturedWorks);
  }
})();
