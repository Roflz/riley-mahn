const chapters = Array.from(document.querySelectorAll("[data-chapter]"));
const chapterToolbar = document.querySelector(".chapter-toolbar");

function showChapter(id) {
  for (const chapter of chapters) chapter.hidden = chapter.dataset.chapter !== id;
}

if (chapterToolbar && chapters.length) {
  chapterToolbar.hidden = false;
  const selected = chapterToolbar.querySelector('input[name="chapter"]:checked');
  showChapter(selected ? selected.value : chapters[0].dataset.chapter);
  chapterToolbar.addEventListener("change", (event) => {
    if (event.target.matches('input[name="chapter"]')) showChapter(event.target.value);
  });
}

const sectionLinks = Array.from(document.querySelectorAll('.nav a[href^="#"]'));
const trackedSections = sectionLinks.map((link) => document.querySelector(link.hash)).filter(Boolean);

// Use top edges so tall case studies keep their navigation link selected.
function updateNavigation() {
  let current = null;
  const offset = document.querySelector(".site-header").offsetHeight + 45;
  for (const section of trackedSections) {
    if (section.getBoundingClientRect().top <= offset) current = section.id;
  }
  for (const link of sectionLinks) {
    if (link.hash === `#${current}`) link.setAttribute("aria-current", "location");
    else link.removeAttribute("aria-current");
  }
}

let scrollPending = false;
window.addEventListener("scroll", () => {
  if (scrollPending) return;
  scrollPending = true;
  requestAnimationFrame(() => {
    updateNavigation();
    scrollPending = false;
  });
}, { passive: true });
window.addEventListener("resize", updateNavigation);
updateNavigation();
