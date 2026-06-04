/**
 * MOI Shopify Theme — theme.js
 * Handles: animate-in observer, cart AJAX, color card interactions
 */

(function() {
  'use strict';

  /* ── Animate-in on scroll ── */
  function initScrollAnimations() {
    var els = document.querySelectorAll('.animate-in');
    if (!els.length) return;

    if ('IntersectionObserver' in window) {
      var io = new IntersectionObserver(function(entries) {
        entries.forEach(function(entry, i) {
          if (entry.isIntersecting) {
            // Stagger siblings slightly
            var delay = (entry.target.dataset.animateDelay || 0);
            setTimeout(function() {
              entry.target.classList.add('visible');
            }, delay);
            io.unobserve(entry.target);
          }
        });
      }, { rootMargin: '-60px 0px', threshold: 0.1 });

      // Add stagger delay to sibling animate-in elements inside the same parent
      document.querySelectorAll('.color-card-grid, .editorial-words, .section-header').forEach(function(parent) {
        parent.querySelectorAll('.animate-in').forEach(function(child, idx) {
          child.dataset.animateDelay = idx * 80;
        });
      });

      els.forEach(function(el) { io.observe(el); });
    } else {
      // Fallback: show all immediately
      els.forEach(function(el) { el.classList.add('visible'); });
    }
  }

  /* ── Add to cart (color card quick-add) ── */
  window.addToCart = function(btn) {
    var variantId = btn.dataset.variantId;
    if (!variantId) return;
    var originalText = btn.textContent;
    btn.textContent = 'Adding…';
    btn.disabled = true;

    fetch('/cart/add.js', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: variantId, quantity: 1 })
    })
    .then(function(r) {
      if (!r.ok) throw new Error('Cart error');
      return r.json();
    })
    .then(function() {
      btn.textContent = 'Added!';
      refreshCartCount();
      setTimeout(function() {
        btn.textContent = originalText;
        btn.disabled = false;
        if (typeof openCart === 'function') openCart();
      }, 900);
    })
    .catch(function() {
      btn.textContent = 'Error';
      btn.disabled = false;
      setTimeout(function() { btn.textContent = originalText; }, 1500);
    });
  };

  /* ── Color swatch selector (on collection grid) ── */
  window.selectColor = function(btn, productId) {
    var colorName = btn.dataset.color;
    var variantId = btn.dataset.variantId;
    var card = btn.closest('.color-card');
    if (!card) return;

    // Toggle active swatch
    card.querySelectorAll('.color-swatch').forEach(function(s) {
      s.classList.remove('color-swatch--selected');
    });
    btn.classList.add('color-swatch--selected');

    // Update add-to-cart button variant id
    var atcBtn = card.querySelector('.btn-add-to-cart');
    if (atcBtn && variantId) {
      atcBtn.dataset.variantId = variantId;
    }
  };

  /* ── Refresh cart count badge ── */
  function refreshCartCount() {
    fetch('/cart.js')
      .then(function(r) { return r.json(); })
      .then(function(cart) {
        var badge = document.getElementById('cart-count');
        if (badge) badge.textContent = cart.item_count;
      })
      .catch(function() {});
  }

  /* ── Parallax hero (desktop only, respects prefers-reduced-motion) ── */
  function initHeroParallax() {
    var hero = document.getElementById('hero');
    if (!hero) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    var media = hero.querySelector('.hero-media');
    var content = document.getElementById('hero-content');

    var ticking = false;
    window.addEventListener('scroll', function() {
      if (!ticking) {
        requestAnimationFrame(function() {
          var scrollY = window.scrollY;
          var heroH = hero.offsetHeight;
          var p = Math.min(scrollY / heroH, 1);
          if (media) media.style.transform = 'translateY(' + (p * 22) + '%)';
          if (content) {
            content.style.transform = 'translateY(' + (p * 38) + '%)';
            content.style.opacity = Math.max(0, 1 - p * 1.6);
          }
          ticking = false;
        });
        ticking = true;
      }
    }, { passive: true });
  }

  /* ── Editorial strip parallax ── */
  function initEditorialParallax() {
    var strip = document.querySelector('.editorial-strip');
    if (!strip) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    var content = strip.querySelector('.editorial-strip-content');
    var ticking = false;

    window.addEventListener('scroll', function() {
      if (!ticking) {
        requestAnimationFrame(function() {
          var rect = strip.getBoundingClientRect();
          var viewH = window.innerHeight;
          var progress = (viewH - rect.top) / (viewH + rect.height);
          var y = (progress - 0.5) * 28;
          if (content) content.style.transform = 'translateY(' + y + 'px)';
          ticking = false;
        });
        ticking = true;
      }
    }, { passive: true });
  }

  /* ── Init ── */
  document.addEventListener('DOMContentLoaded', function() {
    initScrollAnimations();
    initHeroParallax();
    initEditorialParallax();
    refreshCartCount();
  });

})();
