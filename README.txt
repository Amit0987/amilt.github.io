========================================================================
SUSHMITA SHARMA - DATA ANALYST PORTFOLIO & STATIC CMS
========================================================================

Architecture: Pure static HTML5, CSS3 & Modern ES6+ JavaScript.
Zero server dependencies (No Node.js, PHP, Python runtime required to serve).
Hosted easily on GitHub Pages, Cloudflare Pages, Netlify, or Vercel.

------------------------------------------------------------------------
DIRECTORY STRUCTURE & SEPARATION OF CONCERNS
------------------------------------------------------------------------
Root:
  - index.html         : Home page with Hero, Interactive Scroll Story & Case Studies
  - about.html         : Bio, experience timeline, and analytics toolkit
  - work.html          : Complete catalogue of case studies
  - work-detail.html   : Dynamic case study detail viewer (?slug=...)
  - blog.html          : Data analytics blog catalogue
  - blog-post.html     : Dynamic article reader (?slug=...)
  - admin.html         : In-browser static CMS admin dashboard
  - setup.html         : One-time setup utility to generate hashed credentials
  - robots.txt         : Search engine crawler directives
  - sitemap.xml        : XML Sitemap for search indexing

css/ (Modular Stylesheets):
  - style.css          : Core design tokens, CSS variables, typography & layout
  - home.css           : Hero SVG chart animations, stats grid, and scroll story
  - about.css          : Monogram badge, career timeline, and skill chips
  - detail.css         : Case study and blog post prose layout and typography
  - admin.css          : Admin gate, connection cards, editor forms, and entry list

js/ (Application Controllers & Modules):
  - app.js             : Core utilities (XSS escaping, Markdown parser, dates, store)
  - home.js            : Home page portfolio grid controller
  - story.js           : Interactive scroll-driven data morphing visualization
  - list.js            : Controller for work.html and blog.html
  - detail.js          : Controller for dynamic article/case study detail views
  - auth.js            : Web Crypto PBKDF2-SHA256 client-side hashing module
  - setup.js           : Setup page controller for generating auth credentials
  - admin.js           : Full static CMS manager with GitHub & File System API sync

data/ (Content & Auth Data Layer):
  - content.js         : The data storage file containing all case studies and posts
  - auth.js            : Hashed credentials for admin access

------------------------------------------------------------------------
CMS & CONTENT MANAGEMENT WORKFLOW
------------------------------------------------------------------------
1. Accessing Admin:
   Open admin.html and enter your credentials. Sessions persist across reloads
   until explicitly clicking "Log out".

2. Syncing Content:
   - Option A (Recommended): Connect with your live website URL and GitHub Token
     (fine-grained token with repository Contents: Read & Write). Edits commit
     directly to GitHub and trigger automatic deployment.
   - Option B: Use "Use a local file instead" in Chrome or Edge to save edits
     directly into data/content.js on your computer via File System Access API.
   - Option C: Click "Download a copy" to download updated data/content.js manually.

3. Changing Admin Password:
   Open setup.html, enter a new username and password, generate the PBKDF2
   hash, and save the output as data/auth.js.
========================================================================
