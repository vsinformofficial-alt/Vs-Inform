const API_BASE = 'https://api.rss2json.com/v1/api.json?rss_url=';

const feeds = {
  top: [
    'https://rss.nytimes.com/services/xml/rss/nyt/HomePage.xml'
  ],
  world: [
    'https://rss.nytimes.com/services/xml/rss/nyt/World.xml',
    'http://feeds.bbci.co.uk/news/world/rss.xml',
    'https://www.aljazeera.com/xml/rss/all.xml'
  ],
  sports: [
    'https://sports.yahoo.com/rss/'
  ]
};

const categoryNames = {
  top: 'Top News',
  world: 'World News',
  sports: 'Sports Updates',
  scores: 'Live Scoreboards'
};

let currentCategory = 'top';
let autoRefreshInterval;
let allFetchedArticles = [];

document.addEventListener('DOMContentLoaded', () => {
  initApp();
});

function initApp() {
  setupNavigation();
  setupSearch();
  setupTrending();
  fetchAndRenderNews(currentCategory);
  
  // Auto refresh every 5 minutes
  autoRefreshInterval = setInterval(() => {
    fetchAndRenderNews(currentCategory, true);
  }, 5 * 60 * 1000);
}

function setupSearch() {
  const searchInput = document.getElementById('search-input');
  
  searchInput.addEventListener('keydown', async (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const query = e.target.value.trim();
      if (query === '') {
        // Reset to current category
        fetchAndRenderNews(currentCategory);
      } else {
        // Fetch global search results
        await fetchSearchResults(query);
      }
    }
  });
}

function setupTrending() {
  const container = document.getElementById('trending-tags');
  if (container) {
    const tags = ['#Viral', '#WorldNews', '#Sports', '#Technology', '#Finance', '#Olympics', '#SriLanka', '#Breaking'];
    container.innerHTML = tags.map(tag => `<span class="hashtag">${tag}</span>`).join('');
    
    container.querySelectorAll('.hashtag').forEach(tagEl => {
      tagEl.addEventListener('click', () => {
         const query = tagEl.textContent.replace('#', '');
         document.getElementById('search-input').value = query;
         fetchSearchResults(query);
      });
    });
  }
}

window.shareArticle = function(title, link) {
  const text = `Check out this news on Vs Inform! ${title} #VsInform #ViralNews #Live`;
  const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(link)}`;
  window.open(twitterUrl, '_blank');
};

async function fetchSearchResults(query) {
  const heroSection = document.getElementById('hero-section');
  const newsGrid = document.getElementById('news-grid');
  
  // Show skeletons
  heroSection.style.display = 'none';
  newsGrid.innerHTML = `
    <div class="skeleton-loader card-skeleton"></div>
    <div class="skeleton-loader card-skeleton"></div>
    <div class="skeleton-loader card-skeleton"></div>
    <div class="skeleton-loader card-skeleton"></div>
  `;

  try {
    const searchUrl = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}`;
    const response = await fetch(API_BASE + encodeURIComponent(searchUrl));
    if (!response.ok) throw new Error('Search failed');
    
    const data = await response.json();
    if (data.status !== 'ok') throw new Error('Failed to parse search feed');
    
    let items = data.items.filter(item => item.title && item.link);
    items.sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate));
    
    // Clear active state on nav since we are in search mode
    document.querySelectorAll('.main-nav a').forEach(l => l.classList.remove('active'));
    document.getElementById('current-category').textContent = `Search Results: "${query}"`;
    
    renderArticles(items, 'Search Results', true);
  } catch (error) {
     console.error('Search error:', error);
     newsGrid.innerHTML = `<div class="error-message"><h3>Search failed</h3><p>Could not load search results.</p></div>`;
  }
}

function setupNavigation() {
  const navLinks = document.querySelectorAll('.main-nav a');
  navLinks.forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      
      // Update active state
      navLinks.forEach(l => l.classList.remove('active'));
      link.classList.add('active');
      
      const target = link.getAttribute('data-target');
      if (target !== currentCategory) {
        currentCategory = target;
        document.getElementById('current-category').textContent = categoryNames[target];
        fetchAndRenderNews(target);
      }
    });
  });
}

async function fetchAndRenderNews(category, isSilentRefresh = false) {
  const heroSection = document.getElementById('hero-section');
  const newsGrid = document.getElementById('news-grid');
  
  if (category === 'scores') {
    heroSection.style.display = 'none';
    if (!isSilentRefresh) {
      newsGrid.innerHTML = `
        <div style="grid-column: 1 / -1; min-height: 800px; background: var(--surface-color); border-radius: 12px; overflow: hidden; border: 1px solid var(--border-color);">
          <iframe src="https://www.scorebat.com/embed/livescore/" frameborder="0" width="100%" height="800" allowfullscreen allow="autoplay; fullscreen" style="width:100%;height:800px;overflow:hidden;display:block;"></iframe>
        </div>
      `;
    }
    return;
  }
  
  heroSection.style.display = 'flex';
  
  if (!isSilentRefresh) {
    // Show skeletons
    heroSection.innerHTML = '<div class="skeleton-loader hero-skeleton"></div>';
    newsGrid.innerHTML = `
      <div class="skeleton-loader card-skeleton"></div>
      <div class="skeleton-loader card-skeleton"></div>
      <div class="skeleton-loader card-skeleton"></div>
      <div class="skeleton-loader card-skeleton"></div>
    `;
  }

  try {
    const categoryFeeds = feeds[category];
    const fetchPromises = categoryFeeds.map(feedUrl => 
      fetch(API_BASE + encodeURIComponent(feedUrl)).then(res => res.json())
    );
    
    const results = await Promise.all(fetchPromises);
    
    let allItems = [];
    results.forEach(data => {
      if (data.status === 'ok' && data.items) {
        allItems = allItems.concat(data.items.filter(item => item.title && item.link));
      }
    });

    // Remove duplicate titles and links
    const seenTitles = new Set();
    const seenLinks = new Set();
    const uniqueItems = [];

    allItems.forEach(item => {
      const titleKey = item.title.trim().toLowerCase();
      const linkKey = item.link.trim().toLowerCase();
      
      if (!seenTitles.has(titleKey) && !seenLinks.has(linkKey)) {
        seenTitles.add(titleKey);
        seenLinks.add(linkKey);
        uniqueItems.push(item);
      }
    });
    
    allItems = uniqueItems;

    // Sort from newest to oldest so we always get the 'now' and 'future' updates first!
    allItems.sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate));
    
    allFetchedArticles = allItems;
    
    if (!isSilentRefresh) {
      document.getElementById('search-input').value = '';
    }

    renderArticles(allFetchedArticles, category);
    
  } catch (error) {
    console.error('Error fetching news:', error);
    if (!isSilentRefresh) {
      const errorHtml = `<div class="error-message">
        <h3>Unable to load news</h3>
        <p>Please try again later. (${error.message})</p>
      </div>`;
      heroSection.innerHTML = '';
      newsGrid.innerHTML = errorHtml;
    }
  }
}

function renderArticles(articles, category, isSearch = false) {
  const heroSection = document.getElementById('hero-section');
  const newsGrid = document.getElementById('news-grid');
  
  if (articles.length === 0) {
     heroSection.style.display = 'none';
     newsGrid.innerHTML = `<div class="error-message"><h3>No results found</h3><p>Try a different search term.</p></div>`;
     return;
  }
  
  if (isSearch || articles.length < 2) {
    heroSection.style.display = 'none';
    renderGrid(articles);
  } else {
    heroSection.style.display = 'flex';
    renderHero(articles[0], category);
    renderGrid(articles.slice(1));
  }
}

function renderHero(article, category) {
  const heroSection = document.getElementById('hero-section');
  const date = new Date(article.pubDate).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  const time = new Date(article.pubDate).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
  
  // Try to find a valid image, fallback to a gradient if none
  let imageUrl = extractImage(article);
  let imageHtml = imageUrl ? `<img src="${imageUrl}" alt="Hero Image" class="hero-image" onerror="this.style.display='none'">` : '';

  heroSection.innerHTML = `
    ${imageHtml}
    <div class="hero-content">
      <span class="category-tag">${categoryNames[category]}</span>
      <h1 class="hero-title">${article.title}</h1>
      <div class="hero-meta">
        <span>${date} &bull; ${time}</span>
        <span>${article.author || 'Editorial'}</span>
      </div>
    </div>
    <a href="${article.link}" target="_blank" rel="noopener noreferrer" class="hero-link" aria-label="Read full article"></a>
  `;
}

function renderGrid(articles) {
  const newsGrid = document.getElementById('news-grid');
  newsGrid.innerHTML = '';
  
  articles.forEach(article => {
    const date = new Date(article.pubDate);
    const timeString = date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
    const dateString = date.toLocaleDateString();
    
    let imageUrl = extractImage(article);
    // If no image, we skip the image container for a cleaner look, or use a placeholder
    let imageContainerHtml = imageUrl 
      ? `<div class="card-image-container">
           <img src="${imageUrl}" alt="Thumbnail" class="card-image" loading="lazy" onerror="this.style.display='none'">
         </div>`
      : `<div class="card-image-container" style="background: linear-gradient(135deg, #1e293b, #0f172a); display:flex; align-items:center; justify-content:center; color: #3b82f6;">
           <svg width="48" height="48" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M19 20H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v1m2 13a2 2 0 0 1-2-2V7m2 13a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z"></path></svg>
         </div>`;

    // Strip HTML from description
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = article.description || '';
    const plainDescription = tempDiv.textContent || tempDiv.innerText || '';

    const card = document.createElement('article');
    card.className = 'news-card';
    
    card.innerHTML = `
      ${imageContainerHtml}
      <div class="card-content">
        <h3 class="card-title">${article.title}</h3>
        <p class="card-description">${plainDescription}</p>
        <div class="card-meta">
          <span>${timeString} - ${dateString}</span>
          <button class="share-btn" onclick="shareArticle('${article.title.replace(/'/g, "\\'")}', '${article.link}')">
            Share <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: middle; margin-left: 2px;"><circle cx="18" cy="5" r="3"></circle><circle cx="6" cy="12" r="3"></circle><circle cx="18" cy="19" r="3"></circle><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line></svg>
          </button>
        </div>
      </div>
      <a href="${article.link}" target="_blank" rel="noopener noreferrer" class="card-link" aria-label="Read ${article.title}"></a>
    `;
    
    newsGrid.appendChild(card);
  });
}

function extractImage(article) {
  if (article.thumbnail) return article.thumbnail;
  if (article.enclosure && article.enclosure.link) return article.enclosure.link;
  
  // Attempt to extract img tag from description/content
  const htmlContent = article.content || article.description || '';
  const imgMatch = htmlContent.match(/<img[^>]+src="([^">]+)"/);
  if (imgMatch && imgMatch[1]) {
    return imgMatch[1];
  }
  
  return null;
}
