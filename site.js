const projectRows = Array.from(document.querySelectorAll(".project-row"));
const filterToolbar = document.querySelector(".project-toolbar");
const projectCount = document.querySelector("#project-count");

function filterProjects(field) {
  let visibleCount = 0;
  for (const row of projectRows) {
    const visible = field === "all" || row.dataset.fields.split(" ").includes(field);
    row.hidden = !visible;
    if (!visible) row.open = false;
    if (visible) visibleCount += 1;
  }
  projectCount.textContent = `${visibleCount} ${visibleCount === 1 ? "project" : "projects"}`;
}

if (filterToolbar && projectCount) {
  filterToolbar.hidden = false;
  filterProjects(document.querySelector('input[name="project-filter"]:checked').value);
  filterToolbar.addEventListener("change", (event) => {
    if (event.target.matches('input[name="project-filter"]')) filterProjects(event.target.value);
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
