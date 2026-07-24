// Enhanced ManguApp with performance optimizations
const ManguApp = {
  // Initialize the application
  init: function () {
    this.setupEventListeners();
    this.loadUserPreferences();
    this.setupIntersectionObserver();
    this.setupTrendingHovers();
    this.optimizeImages();
    this.setupServiceWorker();
    console.log('MANGU PUBLISHING initialized successfully');
  },

  // Setup Service Worker for offline functionality
  setupServiceWorker: function () {
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker
          .register('/sw.js')
          .then((registration) => {
            console.log('SW registered: ', registration);
          })
          .catch((registrationError) => {
            console.log('SW registration failed: ', registrationError);
          });
      });
    }
  },

  // Optimize images with lazy loading
  optimizeImages: function () {
    document.querySelectorAll('img').forEach((img) => {
      if (img.complete) {
        img.setAttribute('loaded', 'true');
      } else {
        img.addEventListener('load', () => {
          img.setAttribute('loaded', 'true');
        });

        img.addEventListener('error', () => {
          // Add error handling for broken images
          img.alt = 'Image not available';
          img.style.backgroundColor = '#f0f0f0';
          img.style.minHeight = '200px';
        });
      }
    });
  },

  // Setup all event listeners
  setupEventListeners: function () {
    // Existing event listeners remain the same

    // Add these new event listeners for enhanced functionality

    // Premium hover effect for book cards
    document.querySelectorAll('.book-card').forEach((card) => {
      card.addEventListener('mouseenter', function () {
        this.style.transform = 'translateY(-8px) scale(1.02)';
        this.style.boxShadow = '0 20px 40px rgba(0, 0, 0, 0.3)';
      });

      card.addEventListener('mouseleave', function () {
        this.style.transform = '';
        this.style.boxShadow = '';
      });
    });

    // Enhanced focus management for accessibility
    document.addEventListener('keyup', (e) => {
      if (e.key === 'Tab') {
        document.documentElement.classList.add('user-tabbing');
      }
    });

    document.addEventListener('mousedown', () => {
      document.documentElement.classList.remove('user-tabbing');
    });

    // Quick navigation with keyboard
    document.addEventListener('keydown', (e) => {
      // Ctrl/Cmd + K for search focus
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        document.querySelector('.search-input').focus();
      }

      // Escape key to close modals
      if (e.key === 'Escape') {
        document
          .querySelectorAll('.auth-modal.active, .viewer-modal.active, .admin-panel.active')
          .forEach((modal) => {
            modal.classList.remove('active');
          });
      }
    });

    // Performance: requestIdleCallback for non-essential tasks
    if ('requestIdleCallback' in window) {
      requestIdleCallback(() => {
        this.preloadImportantContent();
      });
    }
  },

  // Preload important content during idle time
  preloadImportantContent: function () {
    // Preload next carousel images
    const nextImages = [
      'https://images.unsplash.com/photo-1512820790803-83ca734da794?w=500&h=750&fit=crop',
      'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=500&h=750&fit=crop',
    ];

    nextImages.forEach((src) => {
      const img = new Image();
      img.src = src;
    });
  },

  // The rest of your existing functions remain the same
  // ...
};

// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', function () {
  // Use requestAnimationFrame for smoother initialization
  requestAnimationFrame(() => {
    ManguApp.init();

    // Demo: pop achievement after a moment
    setTimeout(() => document.getElementById('achievementPopup').classList.add('show'), 1200);
    setTimeout(() => document.getElementById('achievementPopup').classList.remove('show'), 5000);
  });
});

// Make functions available globally for onclick attributes
window.addComment = ManguApp.addComment;
window.showToast = ManguApp.showToast;
window.openViewer = ManguApp.openViewer;

// Enhanced trending carousel functionality
let currentIndex = 0;
const totalCards = 5;
const cardWidth = 225; // 200px card + 25px gap
let autoScrollInterval;

function startAutoScroll() {
  autoScrollInterval = setInterval(() => {
    moveCarousel(1);
  }, 5000);
}

function stopAutoScroll() {
  clearInterval(autoScrollInterval);
}

function moveCarousel(direction) {
  const track = document.getElementById('carouselTrack');
  stopAutoScroll();

  currentIndex += direction;

  if (currentIndex < 0) currentIndex = totalCards - 1;
  if (currentIndex >= totalCards) currentIndex = 0;

  const translateX = -currentIndex * cardWidth;
  track.style.transform = `translateX(${translateX}px)`;

  startAutoScroll();
}

// Start auto-scroll on page load
startAutoScroll();

// Add hover effects to pause auto-scroll
document.querySelectorAll('.book-card').forEach((card) => {
  card.addEventListener('mouseenter', () => {
    stopAutoScroll();
  });

  card.addEventListener('mouseleave', () => {
    startAutoScroll();
  });
});

// Make moveCarousel global
window.moveCarousel = moveCarousel;
