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
        expect(page.locator("#project-count")).to_have_text("12 projects")
        page.keyboard.press("Tab")
        expect(page.locator("a.skip")).to_be_focused()
        page.keyboard.press("Enter")
        expect(page.locator("main")).to_be_focused()

        for field, count in [("ai", 4), ("systems", 7), ("science", 5), ("apps", 2), ("all", 12)]:
            page.locator(f'label:has(input[value="{field}"])').click()
            expect(page.locator(".project-row:visible")).to_have_count(count)
            expect(page.locator("#project-count")).to_have_text(f"{count} projects")

        # Exercise keyboard disclosure and verify that filtering closes hidden items.
        first_summary = page.locator(".project-row summary").first
        first_summary.focus()
        page.keyboard.press("Enter")
        expect(page.locator(".project-row").first).to_have_attribute("open", "")
        page.locator('label:has(input[value="apps"])').click()
        assert page.locator(".project-row").first.get_attribute("open") is None
        page.locator('label:has(input[value="all"])').click()
        page.locator(".artifact-detail summary").click()
        page.locator('img[src$="boggle-confusion.png"]').scroll_into_view_if_needed()
        page.wait_for_function("Array.from(document.images).every(i => i.complete && i.naturalWidth > 0)")
        page.locator(".artifact-detail summary").click()
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
                for section in ["ivy", "vision", "rshub", "projects"]:
                    page.locator(f'.nav a[href="#{section}"]').click() if section == "projects" else page.evaluate("id => document.getElementById(id).scrollIntoView()", section)
                    page.screenshot(path=str(OUT / f"desktop-{section}.png"))
                expect(page.locator('.nav a[href="#projects"]')).to_have_attribute("aria-current", "location")
        assert not errors, errors

        fallback = browser.new_page(java_script_enabled=False)
        fallback.goto(URL)
        expect(fallback.locator(".project-row")).to_have_count(12)
        expect(fallback.locator(".project-toolbar")).to_be_hidden()
        fallback.locator(".project-row summary").first.click()
        expect(fallback.locator(".project-body").first).to_be_visible()
        print("PASS: responsive layouts, project filters, keyboard controls, disclosures, images, links, resume, and no-JS fallback")
        print("Preview:", URL)
        browser.close()


if __name__ == "__main__":
    main()
