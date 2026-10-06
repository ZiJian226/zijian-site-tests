import { test, expect, type Page } from '@playwright/test';

// BASE_URL is validated in playwright.config.ts. We goto it directly (not '/')
// so URLs with a path, e.g. https://zijian226.github.io/zijian-site/, work.
const BASE_URL = process.env.BASE_URL as string;

async function openSite(page: Page) {
  await page.goto(BASE_URL);
}

// Locate the dark-mode toggle: a button inside <nav>.
// SPEC does not name the button. If the nav has several buttons we prefer one
// whose accessible name mentions dark/light/theme/mode; otherwise the first.
function navToggle(page: Page) {
  const nav = page.locator('nav');
  const named = nav.getByRole('button', { name: /dark|light|theme|mode/i });
  return named.or(nav.getByRole('button')).first();
}

const bodyHasDark = (page: Page) =>
  page.evaluate(() => document.body.classList.contains('dark'));

test.describe('Conventions', () => {
  test('SPEC:4 sections #hero #about #skills #projects #repos #contact all exist', async ({ page }) => {
    // Interpretation: "section" = an element with that id; the tag name is not checked.
    await openSite(page);
    for (const id of ['hero', 'about', 'skills', 'projects', 'repos', 'contact']) {
      await expect(page.locator(`#${id}`), `#${id} should exist exactly once`).toHaveCount(1);
    }
  });

  test('SPEC:5 no horizontal scroll at a viewport width of 375px', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await openSite(page);
    // Let async content (e.g. repo cards) render before measuring.
    await page.waitForLoadState('networkidle');
    const { scrollWidth, clientWidth } = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }));
    expect(scrollWidth, `scrollWidth ${scrollWidth} > clientWidth ${clientWidth}`).toBeLessThanOrEqual(clientWidth);
  });

  test('SPEC:6 #repos shows repo cards, or a plain message if none / fetch fails', async ({ page }) => {
    // Interpretation (SPEC does not define "card" or the message text):
    // - cards case: #repos contains at least one link to a GitHub repo,
    //   i.e. https://github.com/<owner>/<repo>.
    // - message case: #repos has no repo links but shows non-empty text
    //   (beyond any heading) that is not a loading indicator.
    // Either is acceptable. We poll until the content has settled out of a
    // "loading" state, since repos are fetched at runtime (and the GitHub API is
    // often rate-limited, so the message case is common).
    await openSite(page);
    const repos = page.locator('#repos');
    await expect(repos).toBeVisible();

    const repoLinkCount = () =>
      repos.locator('a[href*="github.com/"]').evaluateAll((els) =>
        els
          .map((e) => (e as HTMLAnchorElement).href)
          .filter((h) => /^https?:\/\/(www\.)?github\.com\/[^/?#]+\/[^/?#]+\/?([?#].*)?$/.test(h))
          .length,
      );
    const messageText = () =>
      repos.evaluate((el) => {
        const clone = el.cloneNode(true) as HTMLElement;
        clone.querySelectorAll('h1,h2,h3,h4,h5,h6').forEach((h) => h.remove());
        return (clone.textContent || '').replace(/\s+/g, ' ').trim();
      });

    const state = async (): Promise<'cards' | 'message' | 'pending'> => {
      if ((await repoLinkCount()) > 0) return 'cards';
      const text = await messageText();
      if (text.length > 0 && !/loading/i.test(text)) return 'message';
      return 'pending';
    };

    await expect
      .poll(state, { timeout: 20_000, message: '#repos never settled into repo cards or a plain message' })
      .not.toBe('pending');

    const result = await state();
    test.info().annotations.push({
      type: 'repos-state',
      description: result === 'cards' ? `${await repoLinkCount()} repo link(s)` : `message: "${await messageText()}"`,
    });
  });

  test('SPEC:7 #hero and #contact each link to email, GitHub and LinkedIn', async ({ page }) => {
    // Interpretation: email = mailto: link; GitHub = link to github.com;
    // LinkedIn = link to linkedin.com. Each must appear inside each section.
    await openSite(page);
    for (const id of ['hero', 'contact']) {
      const section = page.locator(`#${id}`);
      await expect(section.locator('a[href^="mailto:"]'), `#${id} email link`).not.toHaveCount(0);
      await expect(section.locator('a[href*="github.com"]'), `#${id} GitHub link`).not.toHaveCount(0);
      await expect(section.locator('a[href*="linkedin.com"]'), `#${id} LinkedIn link`).not.toHaveCount(0);
    }
  });
});

test.describe('Issue #1: dark-mode toggle', () => {
  test("SPEC:10 a button in the nav toggles a 'dark' class on <body>", async ({ page }) => {
    // SPEC does not say the initial state, so we toggle relative to it.
    await openSite(page);
    const toggle = navToggle(page);
    await expect(toggle, 'no button found inside <nav>').toBeVisible({ timeout: 5_000 });

    const initial = await bodyHasDark(page);
    await toggle.click();
    await expect.poll(() => bodyHasDark(page)).toBe(!initial);
    await toggle.click();
    await expect.poll(() => bodyHasDark(page)).toBe(initial);
  });

  test('SPEC:11 the dark-mode choice is kept for the session', async ({ page }) => {
    // Interpretation of "kept for the session": within the same browser tab /
    // context, the user's choice survives a page reload. We check both
    // directions (switching away from the default is kept, then switching back
    // is kept too). We do NOT test a fresh browser context, because SPEC does
    // not say whether the choice must be forgotten afterwards (sessionStorage)
    // or may be remembered longer (localStorage); both satisfy this line.
    await openSite(page);
    const toggle = navToggle(page);
    await expect(toggle, 'no button found inside <nav>').toBeVisible({ timeout: 5_000 });

    const initial = await bodyHasDark(page);
    await toggle.click();
    await expect.poll(() => bodyHasDark(page)).toBe(!initial);

    await page.reload();
    await expect.poll(() => bodyHasDark(page), { message: 'choice lost after reload' }).toBe(!initial);

    await navToggle(page).click();
    await expect.poll(() => bodyHasDark(page)).toBe(initial);

    await page.reload();
    await expect.poll(() => bodyHasDark(page), { message: 'second choice lost after reload' }).toBe(initial);
  });
});
