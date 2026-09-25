# riley-mahn

Personal site for Riley Mahn. It is a measurement write-up for hiring managers who care whether an eval number is real. Built as static HTML for GitHub Pages.

## Local

Port 4173 had a Windows IPv6 gotcha: `python -m http.server 4173` binds `::`, then Chrome on `http://127.0.0.1:4173` gets `ERR_EMPTY_RESPONSE`. Bind IPv4 and use that address.

```powershell
cd D:\_\riley-mahn
python -m http.server 4173 --bind 127.0.0.1
```

Open http://127.0.0.1:4173/ (not `localhost`, which can still go to IPv6).

If the page is blank again, you probably have more than one server on 4173. Stop them with Ctrl+C in each terminal, then start one.

## Publish

1. Create a GitHub repo (suggested: `Roflz/riley-mahn`).
2. Push this folder to `main`.
3. Settings → Pages → Deploy from `main` / root.
4. Site URL will be `https://roflz.github.io/riley-mahn/`.
5. Paste that URL into the Anthropic application Website field.

If you later want `rileymahn.com`, add a `CNAME` file and point DNS.

## Design contract

| Field | Decision |
| --- | --- |
| Screen job | In 30 seconds, a lab hiring manager sees that Riley measures models and distrusts harnesses, then can download a resume or email. |
| Primary user and action | Recruiter / research engineer. Read, then email or open the PDF. |
| Hierarchy | Thesis → current eval work → method → verification lineage → contact. |
| Navigation | Sticky header, in-page anchors, resume is a real PDF link. |
| Visual language | Cool instrument paper, graph-paper hero, Spectral / Public Sans / Spline Sans Mono, claim–evidence–disposition strips. |
| Forbidden | Project-card bento, Inter, dark+neon, cream+terracotta, fake dashboards, naming Handshake client models. |

UIZZE catalogue search was not usable from this environment. Structure is taken from long-form research notes (not card grids) and from Riley’s own eval vocabulary (claim checks, freeze, disposition), not from the Ivy cockpit’s dark dashboard look.
