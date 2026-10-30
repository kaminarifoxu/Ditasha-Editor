module.exports = async function checkStudioHome() {
  const $ = (id) => document.getElementById(id);
  const assert = (ok, message) => {
    if (!ok) throw Error(message);
  };
  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const click = (selector) => document.querySelector(selector).click();
  click('[data-page="home"]');
  await wait(450);
  assert(
    !$('studioHome').hidden && document.querySelector('main').hidden,
    'Home does not own the viewport',
  );
  assert(
    document.querySelectorAll('.studio-tool-card:not([hidden])').length === 9,
    'Missing workspace cards',
  );
  click('[data-studio-filter="model"]');
  assert(
    document.querySelectorAll('.studio-tool-card:not([hidden])').length === 3,
    'Model filter is incorrect',
  );
  $('studioToolSearch').value = 'vehicle';
  $('studioToolSearch').dispatchEvent(new Event('input'));
  assert(
    document.querySelectorAll('.studio-tool-card:not([hidden])').length === 1,
    'Search did not compose with category',
  );
  $('studioToolSearch').value = 'no-match-asset';
  $('studioToolSearch').dispatchEvent(new Event('input'));
  assert(!$('studioNoResults').hidden, 'No-result state is missing');
  $('studioToolSearch').value = '';
  $('studioToolSearch').dispatchEvent(new Event('input'));
  click('[data-studio-filter="all"]');
  const original = document.querySelector('#documentTabs').textContent;
  document.querySelector('[data-studio-index="0"]').click();
  assert(
    !$('studioHome').hidden === false && !document.querySelector('main').hidden,
    'Editor card did not activate editor',
  );
  click('[data-page="home"]');
  assert(
    document.querySelector('#documentTabs').textContent === original,
    'Home navigation changed open document tabs',
  );
  $('studioContinue').click();
  assert(document.body.dataset.workspace === 'editor', 'Continue action opened wrong workspace');
  click('[data-page="home"]');
  document.querySelector('[data-studio-index="3"]').click();
  assert(
    document.body.dataset.workspace === 'archives' &&
      !document.querySelector('.archive-workspace').hidden,
    'Explorer shortcut not wired',
  );
  click('[data-page="home"]');
  $('studioContinue').click();
  assert(document.body.dataset.workspace === 'archives', 'Continue did not follow last workspace');
  click('[data-page="home"]');
  $('studioMotionToggle').click();
  assert(document.body.dataset.motion === 'off', 'Motion switch did not disable motion');
  assert(
    getComputedStyle(document.querySelector('.studio-art-core')).animationName === 'none',
    'Ambient motion continues when disabled',
  );
  $('studioMotionToggle').click();
  const expected = matchMedia('(prefers-reduced-motion: reduce)').matches ? 'off' : 'auto';
  assert(document.body.dataset.motion === expected, 'Motion switch ignored system preference');
  const overflow = [...$('studioHome').querySelectorAll('*')].filter(
    (el) =>
      el.getBoundingClientRect().width > 0 &&
      getComputedStyle(el).position !== 'absolute' &&
      el.getBoundingClientRect().right > innerWidth + 2,
  );
  assert(
    !overflow.length,
    'Home has horizontal overflow: ' + overflow.map((el) => el.className).join(', '),
  );
  console.log('DITASHA_SNAPSHOT:studio-home-dark');
  click('[data-page="editor"]');
  return { cards: 9, filters: true, navigation: true, documentPreservation: true, motion: true };
};
