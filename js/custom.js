/* ==========================================================================
   Rhys's Blog — 自定义交互增强
   --------------------------------------------------------------------------
   包含三件事，全部是「锦上添花」型，任何一处出错都不会影响页面正常使用：
     1. 顶部阅读进度条
     2. 图片加载完成后淡入（配合原生懒加载，避免图片硬邦邦地跳出来）
     3. 首页文章卡片滚动入场
   已适配 pjax：局部刷新后会自动重新初始化。
   已适配 prefers-reduced-motion：系统开启「减少动态效果」时自动降级。
   ========================================================================== */
(function () {
  'use strict';

  var reduceMotion = window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------------------------------------------------------------------
     1. 顶部阅读进度条
     进度条本身只创建一次，挂在 body 上，不随 pjax 重建。
     --------------------------------------------------------------------- */
  var progressBar = null;
  var rafPending = false;

  function ensureProgressBar() {
    if (progressBar && document.body.contains(progressBar)) return progressBar;

    progressBar = document.createElement('div');
    progressBar.id = 'reading-progress';
    progressBar.setAttribute('aria-hidden', 'true');
    progressBar.style.cssText = [
      'position:fixed',
      'top:0',
      'left:0',
      'height:2px',
      'width:0%',
      'z-index:1001',
      'background:var(--default-bg-color,#4A90E2)',
      'box-shadow:0 0 8px var(--default-bg-color,#4A90E2)',
      'transition:width .1s linear,opacity .3s ease',
      'opacity:0',
      'pointer-events:none'
    ].join(';');
    document.body.appendChild(progressBar);
    return progressBar;
  }

  function updateProgress() {
    rafPending = false;
    var bar = ensureProgressBar();
    var doc = document.documentElement;
    var scrollable = doc.scrollHeight - window.innerHeight;

    if (scrollable <= 0) {
      bar.style.opacity = '0';
      bar.style.width = '0%';
      return;
    }

    var pct = (window.scrollY / scrollable) * 100;
    if (pct > 100) pct = 100;
    if (pct < 0) pct = 0;

    bar.style.width = pct.toFixed(2) + '%';
    bar.style.opacity = pct > 0.5 ? '1' : '0';
  }

  function onScroll() {
    if (rafPending) return;
    rafPending = true;
    window.requestAnimationFrame(updateProgress);
  }

  /* ---------------------------------------------------------------------
     2. 图片淡入
     只处理正文和首页封面，避免影响头像、图标之类的小图。
     --------------------------------------------------------------------- */
  function fadeInImages() {
    if (reduceMotion) return;

    var imgs = document.querySelectorAll(
      '#article-container img, #recent-posts img.post-bg'
    );

    Array.prototype.forEach.call(imgs, function (img) {
      if (img.dataset.fadeBound) return;
      img.dataset.fadeBound = '1';

      // 已经从缓存里加载好的图片直接标记完成，不做动画
      if (img.complete && img.naturalWidth > 0) {
        img.style.opacity = '1';
        return;
      }

      img.style.opacity = '0';
      img.style.transition = 'opacity .45s cubic-bezier(.22,1,.36,1)';

      var reveal = function () {
        img.style.opacity = '1';
      };

      img.addEventListener('load', reveal, { once: true });
      // 加载失败也要显示出来，否则会留下空白
      img.addEventListener('error', reveal, { once: true });
    });
  }

  /* ---------------------------------------------------------------------
     3. 首页文章卡片滚动入场
     --------------------------------------------------------------------- */
  var revealObserver = null;

  function revealCards() {
    if (reduceMotion || !('IntersectionObserver' in window)) return;

    var cards = document.querySelectorAll('#recent-posts .recent-post-item');
    if (!cards.length) return;

    if (revealObserver) revealObserver.disconnect();

    revealObserver = new IntersectionObserver(function (entries, obs) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        var el = entry.target;
        el.style.transition =
          'opacity .5s cubic-bezier(.22,1,.36,1), transform .5s cubic-bezier(.22,1,.36,1)';
        el.style.opacity = '1';
        el.style.transform = 'none';
        obs.unobserve(el);
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.05 });

    Array.prototype.forEach.call(cards, function (card, i) {
      // 首屏前两张不做入场，避免打开首页时闪一下
      if (i < 2) {
        card.style.opacity = '1';
        return;
      }
      card.style.opacity = '0';
      card.style.transform = 'translateY(24px)';
      revealObserver.observe(card);
    });
  }

  /* ---------------------------------------------------------------------
     初始化 / pjax 重新初始化
     --------------------------------------------------------------------- */
  function init() {
    try {
      ensureProgressBar();
      updateProgress();
      fadeInImages();
      revealCards();
    } catch (e) {
      console.debug('[custom.js] init skipped:', e);
    }
  }

  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll, { passive: true });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // pjax 局部刷新后重新绑定
  document.addEventListener('pjax:complete', init);
})();
