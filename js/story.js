/**
 * Sushmita Sharma Portfolio - Interactive Scroll Story
 * Visualizes data transformation: Noise -> Grouped Causes -> Downward Incident Trend -> Clean KPI Grid.
 * Architecture: Deterministic Particle Engine coordinated with IntersectionObserver
 * Author: Sushmita Sharma (Refactored to Staff Frontend Standard)
 */

(function () {
  'use strict';

  const TOTAL_PARTICLES = 90;
  const INITIAL_SEED = 11;
  const CLUSTER_COLORS = ['#087a40', '#12b85a', '#8fdcb0'];
  const NOISE_COLOR = '#b8cfc0';
  const PRIMARY_COLOR = '#087a40';

  /**
   * Linear Congruential Generator (LCG) for deterministic pseudo-random distribution.
   */
  const createDeterministicRng = (seedVal) => {
    let seed = seedVal;
    return () => {
      seed = (seed * 9301 + 49297) % 233280;
      return seed / 233280;
    };
  };

  /**
   * Initializes the scroll story animation.
   */
  const initStory = () => {
    const stageElement = document.getElementById('stage');
    if (!stageElement) return;

    // Clear any previous particles (useful if re-run)
    const existingParticles = stageElement.querySelectorAll('i');
    existingParticles.forEach((el) => el.remove());

    const random = createDeterministicRng(INITIAL_SEED);
    const particlePositions = [[], [], [], []];
    const particleElements = [];

    // Precalculate target coordinates for 4 chapters:
    // 0: Scattered random noise
    // 1: Clustered by category (causes)
    // 2: Downward trend line (30% drop)
    // 3: Structured matrix grid (Dashboard)
    for (let index = 0; index < TOTAL_PARTICLES; index++) {
      const dot = document.createElement('i');
      dot.setAttribute('aria-hidden', 'true');
      stageElement.appendChild(dot);
      particleElements.push(dot);

      // Determine cluster affiliation (weighted: 50% cluster 0, 30% cluster 1, 20% cluster 2)
      const clusterIdx = index % 10 < 5 ? 0 : index % 10 < 8 ? 1 : 2;

      // 0: Noise
      particlePositions[0].push([
        6 + random() * 88,
        8 + random() * 78,
        clusterIdx
      ]);

      // 1: Clusters
      const clusterCentersX = [20, 50, 80];
      const centerX = clusterCentersX[clusterIdx];
      particlePositions[1].push([
        centerX + (random() - 0.5) * 20,
        42 + (random() - 0.5) * 36,
        clusterIdx
      ]);

      // 2: Trend Line
      const progressRatio = index / (TOTAL_PARTICLES - 1);
      particlePositions[2].push([
        6 + progressRatio * 88,
        22 + progressRatio * 50 + (random() - 0.5) * 9,
        0
      ]);

      // 3: Clean Matrix Grid
      particlePositions[3].push([
        8 + (index % 15) * 6.1,
        18 + Math.floor(index / 15) * 11,
        0
      ]);
    }

    /**
     * Morphs particles to the requested step index.
     * @param {number} step - Step index 0 to 3.
     */
    const renderStep = (step) => {
      const isReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

      particleElements.forEach((dot, idx) => {
        const point = particlePositions[step][idx];
        dot.style.left = `${point[0]}%`;
        dot.style.top = `${point[1]}%`;

        if (step === 0) {
          dot.style.background = NOISE_COLOR;
          dot.style.opacity = '0.85';
        } else if (step === 1) {
          dot.style.background = CLUSTER_COLORS[point[2]];
          dot.style.opacity = '0.85';
        } else if (step === 2) {
          dot.style.background = PRIMARY_COLOR;
          dot.style.opacity = '0.95';
        } else {
          dot.style.background = PRIMARY_COLOR;
          dot.style.opacity = '1';
        }

        if (isReducedMotion) {
          dot.style.transition = 'none';
        }
      });
    };

    // Render initial noise state
    renderStep(0);

    // Coordinate with IntersectionObserver
    const chapterElements = document.querySelectorAll('.ch');
    if (!chapterElements.length) return;

    if (!('IntersectionObserver' in window)) {
      // Fallback for older browsers without IntersectionObserver
      chapterElements.forEach((ch) => ch.classList.add('on'));
      renderStep(3);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            chapterElements.forEach((ch) => ch.classList.remove('on'));
            entry.target.classList.add('on');
            const stepIndex = Number(entry.target.dataset.i || 0);
            renderStep(stepIndex);
          }
        });
      },
      {
        root: null,
        rootMargin: '-40% 0px -40% 0px',
        threshold: 0
      }
    );

    chapterElements.forEach((chapter) => observer.observe(chapter));
  };

  // Expose to window
  window.initStory = initStory;
})();
