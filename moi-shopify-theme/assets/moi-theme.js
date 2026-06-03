/**
 * MOI — Shopify Theme JavaScript
 * Handles: header scroll, drawers, cart, search, accordions, scroll animations
 */

(function() {
  'use strict';

  // ━━━ Header Scroll Behavior ━━━━━━━━━━━━━━━━━━━━━━━━━━
  const header = document.getElementById('moi-header');
  if (header) {
    const scrolledClass = header.dataset.scrolledClass || 'moi-header--scrolled';
    const transparentClass = 'moi-header--transparent';
    let lastScroll = 0;

    function updateHeader() {
      const scrollY = window.scrollY;
      if (scrollY > 60) {
        header.classList.remove(transparentClass);
        header.classList.add(scrolledClass);
      } else {
        header.classList.add(transparentClass);
        header.classList.remove(scrolledClass);
      }
      lastScroll = scrollY;
    }

    window.addEventListener('scroll', updateHeader, { passive: true });
    updateHeader();
  }

  // ━━━ Mobile Drawer ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  const drawerToggle = document.getElementById('moi-drawer-toggle');
  const drawer = document.getElementById('moi-drawer');
  const drawerOverlay = document.getElementById('moi-drawer-overlay');
  const drawerClose = document.getElementById('moi-drawer-close');

  function openDrawer() {
    if (drawer) drawer.classList.add('is-open');
    if (drawerOverlay) drawerOverlay.classList.add('is-open');
    document.body.classList.add('is-drawer-open');
  }

  function closeDrawer() {
    if (drawer) drawer.classList.remove('is-open');
    if (drawerOverlay) drawerOverlay.classList.remove('is-open');
    document.body.classList.remove('is-drawer-open');
  }

  if (drawerToggle) drawerToggle.addEventListener('click', openDrawer);
  if (drawerClose) drawerClose.addEventListener('click', closeDrawer);
  if (drawerOverlay) drawerOverlay.addEventListener('click', closeDrawer);

  // ━━━ Cart Drawer ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  const cartToggle = document.getElementById('moi-cart-toggle');
  const cartDrawer = document.getElementById('moi-cart-drawer');
  const cartOverlay = document.getElementById('moi-cart-overlay');
  const cartClose = document.getElementById('moi-cart-close');
  const cartBadge = document.getElementById('moi-cart-badge');

  function openCart() {
    if (cartDrawer) cartDrawer.classList.add('is-open');
    if (cartOverlay) cartOverlay.classList.add('is-open');
    document.body.classList.add('is-drawer-open');
  }

  function closeCart() {
    if (cartDrawer) cartDrawer.classList.remove('is-open');
    if (cartOverlay) cartOverlay.classList.remove('is-open');
    document.body.classList.remove('is-drawer-open');
  }

  if (cartToggle) cartToggle.addEventListener('click', openCart);
  if (cartClose) cartClose.addEventListener('click', closeCart);
  if (cartOverlay) cartOverlay.addEventListener('click', closeCart);

  // Update cart badge
  function updateCartBadge(count) {
    if (cartBadge) {
      cartBadge.textContent = count > 9 ? '9+' : count;
      cartBadge.style.display = count > 0 ? 'flex' : 'none';
    }
  }

  // Fetch cart count on load
  fetch('/cart.js')
    .then(r => r.json())
    .then(cart => updateCartBadge(cart.item_count))
    .catch(() => {});

  // ━━━ Search Drawer ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  const searchToggle = document.getElementById('moi-search-toggle');
  const searchDrawer = document.getElementById('moi-search-drawer');
  const searchOverlay = document.getElementById('moi-search-overlay');
  const searchClose = document.getElementById('moi-search-close');

  function openSearch() {
    if (searchDrawer) searchDrawer.classList.add('is-open');
    if (searchOverlay) searchOverlay.classList.add('is-open');
    document.body.classList.add('is-drawer-open');
    const input = searchDrawer?.querySelector('input');
    if (input) input.focus();
  }

  function closeSearch() {
    if (searchDrawer) searchDrawer.classList.remove('is-open');
    if (searchOverlay) searchOverlay.classList.remove('is-open');
    document.body.classList.remove('is-drawer-open');
  }

  if (searchToggle) searchToggle.addEventListener('click', openSearch);
  if (searchClose) searchClose.addEventListener('click', closeSearch);
  if (searchOverlay) searchOverlay.addEventListener('click', closeSearch);

  // ━━━ Footer Accordion ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  const accordionItems = document.querySelectorAll('.moi-footer__accordion-item');
  accordionItems.forEach(item => {
    const trigger = item.querySelector('.moi-footer__accordion-trigger');
    if (trigger) {
      trigger.addEventListener('click', () => {
        const isOpen = item.classList.contains('is-open');
        // Close all
        accordionItems.forEach(i => i.classList.remove('is-open'));
        // Open clicked if it was closed
        if (!isOpen) {
          item.classList.add('is-open');
        }
      });
    }
  });

  // ━━━ Scroll Animations (Intersection Observer) ━━━━━━━━━━━━━━━━━
  const fadeElements = document.querySelectorAll('.moi-fade-in');
  if (fadeElements.length > 0 && 'IntersectionObserver' in window) {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        }
      });
    }, {
      threshold: 0.1,
      rootMargin: '-40px 0px'
    });

    fadeElements.forEach(el => observer.observe(el));
  } else {
    // Fallback: show all
    fadeElements.forEach(el => el.classList.add('is-visible'));
  }

  // ━━━ Hero scroll to collection ━━━━━━━━━━━━━━━━━━━━━━━━━━
  const heroCta = document.querySelector('.moi-hero__cta');
  if (heroCta) {
    heroCta.addEventListener('click', (e) => {
      const href = heroCta.getAttribute('href');
      if (href && href.startsWith('#')) {
        e.preventDefault();
        const target = document.querySelector(href);
        if (target) {
          target.scrollIntoView({ behavior: 'smooth' });
        }
      }
    });
  }

  // ━━━ Product page variant URL sync ━━━━━━━━━━━━━━━━━━━━━
  const productForm = document.getElementById('moi-product-form');
  if (productForm) {
    const variantIdInput = document.getElementById('variant-id');
    if (variantIdInput) {
      // Update URL when variant changes
      function syncVariantUrl(variantId) {
        const url = new URL(window.location);
        url.searchParams.set('variant', variantId);
        window.history.replaceState({}, '', url);
      }

      // Listen for variant changes from swatches
      const swatches = document.querySelectorAll('.moi-product-info__swatch');
      swatches.forEach(swatch => {
        swatch.addEventListener('click', () => {
          swatches.forEach(s => s.classList.remove('is-selected'));
          swatch.classList.add('is-selected');
        });
      });

      const sizes = document.querySelectorAll('.moi-product-info__size');
      sizes.forEach(size => {
        size.addEventListener('click', () => {
          sizes.forEach(s => s.classList.remove('is-selected'));
          size.classList.add('is-selected');
        });
      });
    }
  }

  // ━━━ Add to Cart AJAX ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  if (productForm) {
    productForm.addEventListener('submit', function(e) {
      e.preventDefault();
      const formData = new FormData(productForm);
      const btn = productForm.querySelector('[type="submit"]');
      const originalText = btn.textContent;

      btn.disabled = true;
      btn.textContent = 'Adding...';

      fetch('/cart/add.js', {
        method: 'POST',
        body: formData
      })
      .then(r => r.json())
      .then(data => {
        btn.textContent = 'Added!';
        updateCartBadge(parseInt(cartBadge?.textContent || 0) + 1);
        openCart();
        setTimeout(() => {
          btn.disabled = false;
          btn.textContent = originalText;
        }, 1500);
      })
      .catch(err => {
        btn.disabled = false;
        btn.textContent = originalText;
        alert('Could not add to cart. Please try again.');
      });
    });
  }

  // ━━━ Cart item removal ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  document.querySelectorAll('.moi-cart-item__remove').forEach(btn => {
    btn.addEventListener('click', function(e) {
      e.preventDefault();
      const href = this.getAttribute('href');
      if (href) {
        fetch(href)
          .then(() => window.location.reload())
          .catch(() => window.location.href = href);
      }
    });
  });

  // ━━━ Mobile image swipe for product cards ━━━━━━━━━━━━━━━━
  const cards = document.querySelectorAll('.moi-color-card');
  cards.forEach(card => {
    const imageContainer = card.querySelector('.moi-color-card__image');
    if (!imageContainer) return;

    let startX = 0;
    let currentX = 0;
    let images = [];
    let currentIndex = 0;

    const mainImg = imageContainer.querySelector('img:not(.moi-color-card__image-hover img)');
    const hoverImg = imageContainer.querySelector('.moi-color-card__image-hover img');
    if (mainImg) images.push(mainImg.src);
    if (hoverImg) images.push(hoverImg.src);

    if (images.length < 2) return;

    imageContainer.addEventListener('touchstart', (e) => {
      startX = e.touches[0].clientX;
    }, { passive: true });

    imageContainer.addEventListener('touchmove', (e) => {
      currentX = e.touches[0].clientX;
    }, { passive: true });

    imageContainer.addEventListener('touchend', () => {
      const diff = currentX - startX;
      if (Math.abs(diff) > 40) {
        if (diff < 0) {
          currentIndex = (currentIndex + 1) % images.length;
        } else {
          currentIndex = (currentIndex - 1 + images.length) % images.length;
        }
        if (mainImg) mainImg.src = images[currentIndex];
      }
    }, { passive: true });
  });

  // ━━━ Escape key closes drawers ━━━━━━━━━━━━━━━━━━━━━━━━━━━
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeDrawer();
      closeCart();
      closeSearch();
    }
  });

  console.log('MOI theme initialized');
})();
