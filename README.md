# Telamorph website

The repository root is the editable source. Firebase Hosting publishes only
the generated `dist/` directory configured in `firebase.json`.

## Build

Run this after changing a page, component, product, or crawl file:

```powershell
python scripts/build_site.py
```

The build safely deletes and recreates only `dist/`. It then:

- copies the production assets, components, and product data;
- embeds `components/nav.html` and `components/footer.html` into every page;
- puts all product cards in the catalogue's initial HTML;
- generates one static HTML file per entry in `data/products.json`;
- generates `sitemap.xml` and the product section of `llms.txt`;
- verifies local links, required images, page counts, and the deploy allowlist.

`dist/` is intentionally ignored by Git because it duplicates the source image
library. Firebase CLI still reads and deploys it from your local machine.

## Add or update a product

1. Add the product images under `assets/images/`.
2. Add or update its entry in `data/products.json`.
3. Run `python scripts/build_site.py`.
4. Inspect the generated file under `dist/products/`.

Do not hand-edit generated files in `dist/`; the next build replaces them.
Product page layout is maintained in `templates/product.html`, and the
non-product content of `llms.txt` is maintained in `templates/llms.txt`.

## Preview locally

For a quick static preview:

```powershell
python -m http.server 8000 --directory dist
```

Then open `http://localhost:8000/`.

For contact-form testing, use the Hosting and Functions emulators together.
Copy `functions/.secret.local.example` to `functions/.secret.local`; keep the
dummy value. The function simulates successful email delivery in the emulator
unless `CONTACT_EMULATOR_SEND_EMAIL=true` is explicitly set, so routine local
tests cannot send mail or use the production Gmail app password:

```powershell
Push-Location functions
npm.cmd test
Pop-Location
npx.cmd -y firebase-tools@latest emulators:start --only "hosting,functions"
```

With those emulators running, execute
`scripts/check_contact_emulator.ps1` in another PowerShell window. It checks the
Hosting rewrite, safe delivery, replay handling, honeypot behavior, native-form
fallback, origin enforcement, and representative malformed requests.

With the emulator running, the reusable checks in
`scripts/check_hosting.ps1` verify public pages, 404 handling, and that
source/development paths are not served. Firebase's Windows Hosting emulator
currently misses glob-based redirect and header rules, so verify those two
rules on the preview channel.

## Firebase deployment workflow

This project uses **Firebase Hosting (Classic)**, not Firebase App Hosting.
The Firebase project and default Hosting site are already selected:

- Firebase project ID: `telamorph`
- Hosting site: `telamorph`
- public Hosting directory: `dist`
- backend source: `functions`

These values are stored in `.firebaserc` and `firebase.json`. Do not run
`firebase init` again unless you intentionally want to replace the existing
configuration. Firebase Hosting can only upload files from `dist`; it cannot
publish the repository root, templates, Python scripts, or function source.

### A. One-time account and project setup

From the repository root, log in and confirm the selected project and site:

```powershell
npx.cmd -y firebase-tools@latest login
npx.cmd -y firebase-tools@latest use telamorph
npx.cmd -y firebase-tools@latest hosting:sites:list
```

Before deploying Cloud Functions, make sure the Firebase project has the
required billing plan and create a Google Cloud budget alert. The contact form
uses the `GMAIL_APP_PASSWORD` secret. Create it once with the Gmail app
password when the CLI prompts; never put the value in this repository:

```powershell
npx.cmd -y firebase-tools@latest functions:secrets:set GMAIL_APP_PASSWORD
```

Deploy the contact function once before testing the form through Hosting:

```powershell
npx.cmd -y firebase-tools@latest deploy --only functions
```

The Telamorph Google Cloud organization restricts public `allUsers` IAM
bindings. The `sendcontactemail` Cloud Run service is therefore made public by
selecting **Security > Allow public access**, which disables its Invoker IAM
check. Do not add `invoker: "public"` to `functions/index.js`; Firebase would
try the organization-blocked IAM binding on every deployment.

### B. Generate and inspect the website

Every deployment must start with a clean build:

```powershell
python scripts/build_site.py
```

This deletes and regenerates `dist`, including the static product pages,
navigation, sitemap, and `llms.txt`. Stop if the build reports a validation
error. For a quick visual inspection:

```powershell
python -m http.server 8000 --directory dist
```

Check at least the home page, catalogue, one product page, contact page, mobile
navigation, and contact form. Stop the server with `Ctrl+C`.

### C. Deploy a Firebase preview

Deploy `dist` and the Hosting configuration to a temporary preview channel:

```powershell
npx.cmd -y firebase-tools@latest hosting:channel:deploy prelaunch --expires 7d
```

The contact rewrite uses `pinTag`, so this preview includes the matching
Functions revision instead of silently testing the previously deployed code.
Preview channels still use the real Firebase project and secret; submit only a
controlled end-to-end test message.

Firebase requires one live-channel deployment after `pinTag` is first added
before pinned previews work. If even the default `web.app` site must remain
private, perform that activation and testing in a separate staging project.

Open the URL printed by the CLI and verify:

- `/`, `/industrial.html`, and several `/products/*.html` pages;
- `/robots.txt`, `/sitemap.xml`, and `/llms.txt`;
- the contact form and the `sendContactEmail` rewrite;
- the custom 404 page using a deliberately invalid URL;
- the `/index.html` and old `/product-detail.html` redirects;
- phone and desktop layouts, images, navigation, and footer links.

Preview-channel URLs are for review, not for submission to search engines.

### D. Publish the live release

For the first complete release, or whenever both frontend and function code
changed, deploy both targets:

```powershell
npx.cmd -y firebase-tools@latest deploy --only "hosting,functions"
```

If only pages, product JSON, styles, scripts, or images changed, rebuild and
deploy Hosting only. Firebase also keeps the pinned contact-function revision
synchronized with that Hosting release:

```powershell
python scripts/build_site.py
npx.cmd -y firebase-tools@latest deploy --only hosting
```

If only `functions/` changed, deploy Functions only:

```powershell
npx.cmd -y firebase-tools@latest deploy --only functions
```

Firebase uploads `dist` directly from the local machine. A Git push does not
deploy anything unless GitHub Actions is configured later. Commit and push the
source files, product JSON, templates, build script, `firebase.json`, and
`.firebaserc` so the release can be reproduced. Do not commit `dist` or any
secret value.

### E. Connect `telamorph.com`

The site's canonical URLs and sitemap use `https://telamorph.com`, so use the
apex domain as the primary domain:

1. Complete the live Firebase deployment first and confirm that
   `https://telamorph.web.app` works.
2. Open the Firebase console, select project `telamorph`, then open
   **Build > Hosting**.
3. On the `telamorph` Hosting site, select **Add custom domain** and
   enter `telamorph.com`.
4. Because this is a new launch, use **Quick Setup**. If the domain is already
   serving a production website elsewhere, use **Advanced Setup** instead.
5. At the domain registrar/DNS provider, add exactly the TXT and A/AAAA records
   shown by Firebase. Keep Firebase's ownership TXT record permanently.
6. Remove conflicting A, AAAA, or CNAME records only when Firebase instructs
   you to do so. Do not guess or copy DNS values from an old tutorial.
7. Add `www.telamorph.com` as well and configure it to redirect to
   `https://telamorph.com` so only one hostname is indexed.
8. Wait until Firebase reports **Connected** and its SSL certificate is active.
   DNS propagation and certificate provisioning can take up to 24 hours.

After connection, test all four forms and confirm they end at the HTTPS apex
domain:

```text
http://telamorph.com
https://telamorph.com
http://www.telamorph.com
https://www.telamorph.com
```

Also confirm that `https://telamorph.com/sitemap.xml` and
`https://telamorph.com/robots.txt` load successfully.

## Post-launch SEO and AIO checks

Do these checks against `https://telamorph.com`, not the preview or `web.app`
address.

### Essential free tools

1. **[Google Search Console](https://search.google.com/search-console/)**
   - Add a Domain property for `telamorph.com` and verify it with DNS.
   - Submit `https://telamorph.com/sitemap.xml`.
   - Use URL Inspection and **Test live URL** for the home page,
     `industrial.html`, one product page, `manufacturing.html`, and
     `contact.html`.
   - Confirm crawling and indexing are allowed, the page fetch succeeds, and
     Google's selected canonical matches the Telamorph URL.
   - Request indexing for the most important pages; do not submit every URL
     repeatedly.

2. **[Bing Webmaster Tools](https://www.bing.com/webmasters/)**
   - Import the verified site from Search Console or verify it separately.
   - Submit the same sitemap and inspect representative URLs.
   - Check Bing's crawl, SEO, and markup reports. Consider IndexNow later when
     product additions become frequent.

3. **[Google Rich Results Test](https://search.google.com/test/rich-results)**
   - Test the home page and at least two product pages.
   - Fix errors in Product or Breadcrumb structured data. Optional warnings do
     not always require invented data such as prices or reviews.

4. **[Schema Markup Validator](https://validator.schema.org/)**
   - Validate the broader JSON-LD that is not covered by Google's rich-result
     eligibility test.

5. **[PageSpeed Insights](https://pagespeed.web.dev/)**
   - Test mobile and desktop for the home page, catalogue, manufacturing page,
     contact page, and the image-heaviest product page.
   - Prioritize image weight and Core Web Vitals. Good field targets are LCP at
     or below 2.5 seconds, CLS at or below 0.1, and INP at or below 200 ms.

6. **Chrome Lighthouse**
   - Run the Performance, Accessibility, Best Practices, and SEO audits from
     Chrome DevTools. Use an incognito window and test mobile throttling.

### Useful additional checks

- **[Screaming Frog SEO Spider](https://www.screamingfrog.co.uk/seo-spider/):**
  crawl the whole site for broken links, duplicate titles, missing metadata,
  canonicals, redirects, and orphan pages.
- **[Ahrefs Webmaster Tools](https://ahrefs.com/webmaster-tools)** or
  **[Semrush Site Audit](https://www.semrush.com/siteaudit/):** monitor technical
  issues and backlinks. One is enough initially.
- **[Facebook Sharing Debugger](https://developers.facebook.com/tools/debug/)**
  and **[LinkedIn Post Inspector](https://www.linkedin.com/post-inspector/):**
  verify Open Graph images, titles, and descriptions.
- Search Google and Bing for `site:telamorph.com` after indexing begins. This is
  a rough discovery check, not an exact count of indexed pages.

For AIO visibility, periodically test real customer questions in Google, Bing,
ChatGPT search, and Perplexity, then record whether Telamorph is cited and which
competitors are cited instead. Use the findings to add genuinely useful product
comparisons, specifications, FAQs, case studies, author/company evidence, and
external industry mentions. `llms.txt` is helpful supplementary context, but it
does not guarantee crawling, citation, or ranking by any AI system.

### First-week launch checklist

- [ ] Firebase live site works on the `web.app` address.
- [ ] `telamorph.com` and `www.telamorph.com` are connected correctly.
- [ ] HTTPS certificate is active with no browser warning.
- [ ] Contact form delivers a real test message.
- [ ] Custom 404 and legacy redirects work in production.
- [ ] `robots.txt`, `sitemap.xml`, and `llms.txt` return HTTP 200.
- [ ] Google Search Console property is verified and sitemap submitted.
- [ ] Bing Webmaster Tools is verified and sitemap submitted.
- [ ] Important URLs pass live inspection and structured-data tests.
- [ ] PageSpeed Insights is recorded for representative mobile pages.
- [ ] Search Console is checked weekly for indexing, security, and Core Web
      Vitals problems.

## Unlinked HMI web demo

The standalone client demo is served at `/hmi-web-demo.html`. It is deliberately
absent from website navigation, sitemap and llms.txt, with noindex metadata and
an X-Robots-Tag header. Anyone with the URL can still access it.

The shared UI source lives in the Furnace HMI V2 repository. Refresh it alongside
LVGL updates using:

```powershell
python scripts/sync_hmi_demo.py C:/dev/Furnance_project/furnace_hmi_version_2/docs/images/theme/hmi-web-demo.html
python scripts/build_site.py
python -m http.server 8000 --directory dist
```

Review `http://localhost:8000/hmi-web-demo.html`. Then publish using the existing
workflow: `firebase.cmd deploy --only hosting --project telamorph`.
The existing pinned contact-function revision can also be synchronized by this
Hosting deployment. No new Firebase project, database or console setup is needed.

Keep client-specific adaptations in `scripts/sync_hmi_demo.py`; the generated
root HTML is committed so standalone website builds need no sibling checkout.
Do not edit the copy in `dist/`. The current adaptation removes engineering
links, adds a client title and simulation wording, and requests no indexing.
The demo uses synthetic data and no furnace connection. Mobile polish remains
future work; the current fixed-size presentation supports desktop review.
