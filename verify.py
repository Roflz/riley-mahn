import sys
from pathlib import Path
from urllib.parse import unquote, urljoin, urlparse

from playwright.sync_api import expect, sync_playwright

OUT = Path(__file__).parent / "verify-shots"
OUT.mkdir(exist_ok=True)
ROOT = Path(__file__).parent
URL = sys.argv[1] if len(sys.argv) > 1 else (ROOT / "index.html").as_uri()


def main() -> None:
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": 1280, "height": 900}, reduced_motion="reduce")
        errors = []
        page.on("pageerror", lambda error: errors.append(str(error)))
        page.goto(URL, wait_until="networkidle")
        page.evaluate("document.fonts.ready")
        expect(page.locator("h1")).to_have_text(
            "I build tools for evaluating AI agents, training models, and testing complex software."
        )
        page.keyboard.press("Tab")
        expect(page.locator("a.skip")).to_be_focused()
        page.keyboard.press("Enter")
        expect(page.locator("main")).to_be_focused()

        for chapter in ["ivy", "osrs", "rshub", "aero", "genome", "flez", "futures", "thrones"]:
            page.locator(f'label:has(input[name="chapter"][value="{chapter}"])').click()
            expect(page.locator(f'[data-chapter="{chapter}"]')).to_be_visible()
            expect(page.locator("[data-chapter]:visible")).to_have_count(1)

        page.locator('label:has(input[name="chapter"][value="osrs"])').click()
        page.locator(".artifact-detail summary").click()
        page.locator('img[src$="boggle-confusion.png"]').scroll_into_view_if_needed()
        page.wait_for_function(
            "Array.from(document.images).filter(i => i.offsetParent !== null).every(i => i.complete && i.naturalWidth > 0)"
        )
        page.locator(".artifact-detail summary").click()
        page.locator('label:has(input[name="chapter"][value="ivy"])').click()
        page.locator(".process-detail summary").click()
        expect(page.locator(".process-detail div")).to_be_visible()
        page.locator(".process-detail summary").click()

        broken_anchors = page.locator('a[href^="#"]').evaluate_all("links => links.map(a => a.hash).filter(hash => !document.querySelector(hash))")
        assert not broken_anchors, broken_anchors
        for href in page.locator('a[href$=".pdf"]').evaluate_all("links => links.map(a => a.getAttribute('href'))"):
            assert (ROOT / href).read_bytes().startswith(b"%PDF")
            if URL.startswith("http"):
                response = page.request.get(urljoin(URL, href))
                assert response.ok and response.body().startswith(b"%PDF")
        for href in page.locator('link[href], script[src], img[src]').evaluate_all("items => items.map(e => e.getAttribute('href') || e.getAttribute('src')).filter(s => !s.startsWith('http'))"):
            assert (ROOT / unquote(urlparse(href).path)).is_file(), href

        for width, height, name in [(1280, 900, "desktop"), (390, 844, "mobile"), (320, 740, "small-mobile"), (768, 1024, "tablet"), (1920, 1080, "wide")]:
            page.set_viewport_size({"width": width, "height": height})
            page.evaluate("window.scrollTo(0, 0)")
            assert page.evaluate("document.documentElement.scrollWidth <= innerWidth"), f"Horizontal overflow at {width}"
            page.screenshot(path=str(OUT / f"{name}-top.png"))
            if name in {"desktop", "mobile"}:
                page.screenshot(path=str(OUT / f"{name}-full.png"), full_page=True)
            if name == "desktop":
                for section in ["ivy", "osrs", "rshub", "method"]:
                    if section == "method":
                        page.locator('.nav a[href="#method"]').click()
                    else:
                        page.locator(f'label:has(input[name="chapter"][value="{section}"])').click()
                        page.locator(f'[data-chapter="{section}"]').scroll_into_view_if_needed()
                    page.screenshot(path=str(OUT / f"desktop-{section}.png"))
                expect(page.locator('.nav a[href="#method"]')).to_have_attribute("aria-current", "location")
        assert not errors, errors

        fallback = browser.new_page(java_script_enabled=False)
        fallback.goto(URL)
        expect(fallback.locator("[data-chapter]")).to_have_count(8)
        expect(fallback.locator("[data-chapter]:visible")).to_have_count(8)
        expect(fallback.locator(".chapter-toolbar")).to_be_hidden()
        fallback.locator(".process-detail summary").click()
        expect(fallback.locator(".process-detail div")).to_be_visible()
        print("PASS: responsive layouts, chapter switcher, keyboard controls, disclosures, images, links, resume, and no-JS fallback")
        print("Preview:", URL)
        browser.close()


if __name__ == "__main__":
    main()
