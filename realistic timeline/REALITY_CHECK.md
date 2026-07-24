# Brutal Honesty: What We Can Actually Build (And What Will Break)

## TL;DR — The Bottom Line

If we code the **Pre-Flight Checklist Tool** (guided workflow with checklists, AI prompts, and progress tracking), we can ship something genuinely useful in **2–3 weeks** with **minimal bugs**. If we chase the **full Manuscript-to-ICML Pipeline** (automated DOCX parsing, ICML generation, ZIP export), we're looking at **3+ months**, **dozens of hair-on-fire bugs**, and a high probability that core features simply won't work in the browser. The realistic play is to build the checklist tool first, then incrementally add file-processing features that we can actually deliver.

---

## 1. What the Documents Promise vs. Cold Reality

The uploaded plans outline two visions: a **13-phase guided checklist tool** (plan.md) and a **full manuscript processing pipeline** (EPUB_TOOL_COMPREHENSIVE_PLAN.md). One of these is achievable in a reasonable timeframe. The other is a quagmire dressed up as architecture. Understanding which is which requires looking at every component through the lens of what browsers can actually do, what libraries actually exist, and what Adobe InDesign actually accepts.

The comprehensive plan reads like a dream — file ingestion from multiple formats, automated structure analysis, intelligent cleanup, ICML generation, and a complete InDesign package export. The architecture diagram shows a beautiful three-tier system with Web Workers, IndexedDB, and a full processing pipeline. The reality is that **most of these components don't have working JavaScript libraries**, the ones that do have severe limitations, and the output format (ICML) is so poorly documented by Adobe that even experienced developers struggle to produce valid files. The plan allocates 2 weeks for ICML generation. The research suggests 8+ weeks minimum — and that's assuming we discover the format's quirks through trial and error rather than documentation.

---

## 2. Feature-by-Feature Feasibility Breakdown

The feature matrix below rates every component from both documents on implementation difficulty, user value, and the honest probability of shipping it without critical bugs.

![Feature Feasibility Matrix](feasibility_matrix.png)

### 2.1 The Easy Wins (Build These Immediately)

These features are low-effort, high-value, and have mature library support. They're the foundation of any useful tool and can be built with confidence.

**Drag-and-Drop File Upload with react-dropzone** — This is battle-tested, well-documented, and works reliably. The library handles file validation (type, size), drag states, and accessibility. The only caveat from GitHub issues is that multi-file drag with size restrictions has edge-case bugs (dragging two files where one exceeds the limit rejects the oversized file but still accepts the smaller one). For a single-file manuscript upload, this is a non-issue. Large files (2GB+) can trigger a `NotReadableError`, but our 50MB cap avoids this entirely. Implementation time: **1–2 days**.

**Phase-Based Checklist UI** — Pure React + Tailwind work. No external dependencies beyond shadcn/ui components. The 13 phases from the InDesign guide map cleanly to a sidebar navigation with progress indicators. Checkbox state persists to LocalStorage. This is straightforward frontend engineering. Implementation time: **2–3 days**.

**AI Prompt Library** — Static content from the We Are Wolf guide, organized by phase. Copy-to-clipboard functionality with a button. The prompts are already written; we just need to structure them. Implementation time: **1 day**.

**Progress Tracking Dashboard** — Calculating completion percentage across phases, visual progress bars, and a readiness score. All derived state from checkbox values. Implementation time: **1 day**.

**Print-Ready Export Checklist** — A static checklist derived from Section VIII and IX of the InDesign guide. Users check items manually; no automated verification. Implementation time: **1 day**.

### 2.2 The Moderate Challenges (Buildable With Effort)

These features require more engineering but have viable technical paths. They'll take longer and have more edge cases, but they can ship.

**DOCX Text Extraction with mammoth.js** — Here's where the first reality check hits. Mammoth converts DOCX to **HTML**, not to any format InDesign directly consumes. Its explicit design philosophy is to extract **semantic structure** (headings, lists, bold, italic) while **ignoring visual styling** (fonts, sizes, colors, precise spacing). The library's own documentation states: *"There's a large mismatch between the structure used by .docx and the structure of HTML, meaning that the conversion is unlikely to be perfect for more complicated documents."* [^29^] Known issues include: merged cells breaking in markdown conversion, missed headers when styles aren't applied properly, and occasional "uncompressed data size mismatch" errors with certain build tools [^20^]. For our use case — extracting chapter structure and text content — mammoth works well enough. But anyone expecting pixel-perfect style preservation will be disappointed. Implementation time: **3–5 days** including edge-case handling.

**Basic Chapter Structure Detection** — After mammoth extracts HTML, we can detect chapters by looking for `h1` elements or paragraphs with specific style names ("Heading 1", "Chapter Title", etc.). This is heuristic-based, not guaranteed. If the author used manual formatting instead of styles, detection fails. The docxicml project (a Python DOCX-to-ICML converter) notes that mammoth-based detection *"assumes styles are applied semantically"* — when they aren't, the fallback methods are limited [^17^]. We can build a reasonable detector that works for ~80% of well-structured manuscripts, but edge cases (unusual heading patterns, no styles used, mixed formatting) will require manual intervention. Implementation time: **5–7 days**.

**Image Inventory Display** — Extracting images from DOCX files is technically possible (mammoth can convert them to inline base64), but displaying an inventory with metadata requires additional work. We can show file names, dimensions, and approximate sizes. However, **DPI analysis and color mode detection** are impossible in the browser without heavy WASM libraries. The `sharp-wasm32` package exists but is ~2–3x slower than native and primarily designed for Node.js/Cloudflare Workers, not browser use [^35^]. For a web app, we'd be limited to basic image info from the file header. Implementation time: **3–4 days** for basic inventory; **full analysis is browser-infeasible**.

**Typography Cleanup Guidance (Manual)** — Rather than trying to automatically "fix" a manuscript (which risks data loss), the tool can **flag issues** and provide guidance. Detecting double spaces, straight quotes, double hyphens instead of em-dashes — these are regex-based checks on extracted text. The tool shows a report: *"Found 47 instances of straight quotes, 12 instances of double spaces, 3 instances of '--' instead of em-dash."* The user fixes them in Word. This is safe, useful, and avoids the complexity of automated modification. Implementation time: **3–4 days**.

### 2.3 The Deeply Problematic (Major Engineering Challenges)

These features are technically possible but involve significant complexity, unreliable libraries, or browser limitations that make them painful to implement and frustrating to use.

**PDF Text Extraction with pdf.js** — Mozilla's PDF.js is the standard for browser-based PDF rendering, but **text extraction accuracy is notoriously problematic**. PDFs aren't structured documents — they're visual presentations. Text extraction faces: font encoding issues where custom glyphs obscure actual characters [^3^], position inaccuracies where extracted text has incorrect start/end positions [^13^], rendering-based extraction that misses content entirely, and scanned/image-based PDFs that have no text layer at all (requiring OCR, which is a whole separate nightmare). The Syncfusion blog notes that *"most JavaScript viewers fail not because of poor UI, but because they misunderstand how PDFs actually store text"* [^3^]. For manuscripts, this means we might extract text with garbled characters, wrong ordering, or missing content. Implementation time: **1–2 weeks**; accuracy ceiling is **~70–80%** for well-formed text-based PDFs, **much lower** for scanned or complex PDFs.

**Automated Style Mapping to InDesign** — The comprehensive plan envisions detecting all styles in a manuscript and suggesting InDesign equivalents. In reality, mammoth.js strips most styling information during conversion — it maps "Heading 1" to `<h1>` but discards the actual font, size, and spacing. We can't map what we can't detect. Even if we parsed the raw DOCX XML (bypassing mammoth), Word's style system doesn't cleanly map to InDesign's. The InDesign production guide itself acknowledges this mess: importing Word files often creates *"unwanted local overrides"* that scramble formatting [^30^]. The realistic approach is a **manual mapping UI** where users tell us "My 'Body Text' style should map to InDesign's 'Body Text'" — but that's not automated. Implementation time for manual UI: **1 week**. For automated detection: **potentially impossible** with current libraries.

**ICML File Generation** — This is the **single most problematic feature** in the entire plan. ICML (InCopy Markup Language) is Adobe's XML-based format for exchanging text content with InDesign. The comprehensive plan shows a simple XML snippet and implies we can generate ICML by stringing together XML elements. The reality is dramatically more complex. ICML requires specific XML namespaces, document version attributes, story references, paragraph style ranges, character style ranges, and proper encoding that Adobe doesn't fully document. The GitHub issue on Pandoc's ICML output illustrates the problem: a user generated ICML with Pandoc and got the error *"This is not a valid indesign interchange document"* when trying to place it in InDesign [^10^]. Even Pandoc — a mature, widely-used document converter — produces ICML that InDesign sometimes rejects. The only working JavaScript approach would be to reverse-engineer valid ICML by: (1) creating content in InDesign, (2) exporting it as ICML, (3) studying the XML structure, (4) writing a generator that matches it exactly. This is weeks of painstaking work with no guarantee of success. The docxicml project (Python-based) took this approach using XSLT transformations and still lists multiple unimplemented features [^17^]. **Implementation time: 6–8 weeks minimum. Probability of producing InDesign-compatible output: uncertain.**

**ZIP Package Export with jszip** — JSZip works for small packages, but the comprehensive plan's InDesign package includes ICML files, linked images, style definitions, metadata XML, and documentation. For a typical book with 50+ images, this package could easily exceed 100MB. JSZip's GitHub issues are filled with memory horror stories: *"zipping a big file (total about 300MB), I have noticed a huge consumption of RAM about 6–6.5 GB, then the program crashed"* [^57^], and *"when adding just over 2400 files... getting RangeError"* [^59^]. The library's own documentation warns that *"strings in javascript are encoded in UTF-16: a 10MB ascii text file will take 20MB of memory"* [^54^]. For our use case (packages under 100MB), JSZip will work for most users on desktop browsers, but mobile Safari will crash (memory limit ~100–200MB [^37^]) and large image collections will cause problems. Implementation time: **3–5 days** for basic ZIP; **handling large files reliably: ongoing pain**.

### 2.4 The Graveyard (Do Not Build)

These features are either technically impossible in a browser, require backend infrastructure, or have such poor cost/benefit ratios that they're not worth attempting in an MVP.

**Google Docs API Integration** — OAuth 2.0 implementation in 2025 is still *"like wrestling an octopus"* [^24^]. The Google Docs API requires: OAuth consent screen configuration, API key management, handling token refresh, dealing with Google's 17 different RFCs for OAuth implementation, and navigating vendor-specific quirks (Google uses the `prompt` parameter in non-standard ways). Worse, Google Docs documents don't export to DOCX cleanly — formatting often breaks, and the API's export functionality has rate limits. For a tool aimed at publishers who already have DOCX files, this integration adds massive complexity for minimal value. **Recommendation: Skip entirely.**

**CMYK Color Mode Conversion** — Color mode conversion (RGB to CMYK) requires ICC profile-aware image processing. The browser has no native CMYK support — all canvas operations work in RGB. A WASM-based solution like `vips-wasm` could theoretically do this, but it's experimental, adds ~5MB+ to bundle size, and is overkill for a tool that isn't actually doing the printing. InDesign handles CMYK conversion during export. Our tool should recommend CMYK but not attempt conversion. **Recommendation: Skip entirely.**

**Image Resolution Analysis (300 DPI Check)** — Calculating DPI requires knowing both pixel dimensions and intended print size. Pixel dimensions are readable from image headers, but print size depends on how the image will be placed in the layout — something our tool cannot know. We can estimate based on the document's trim size and margins, but this is guesswork, not analysis. A 3000×2000 pixel image is 300 DPI at 10×6.67 inches but only 150 DPI at 20×13.33 inches. Without knowing the final layout, DPI warnings are misleading. **Recommendation: Flag oversized/small images but skip precise DPI analysis.**

**Automated Content Cleanup (Apply Changes)** — The comprehensive plan proposes automatically fixing typography issues: converting straight quotes to curly, standardizing dashes, removing double spaces. In a browser, we're working with extracted text — we can modify it, but we **cannot save changes back to the original DOCX file**. DOCX is a ZIP container of XML files; reconstructing it client-side with modified content while preserving all formatting, relationships, and metadata is enormously complex (the `docx` library can create DOCX from scratch but cannot edit existing files). The user would need to download a "cleaned" version, but this won't be a valid DOCX — more likely plain text or HTML. **Recommendation: Flag issues but do not attempt automated fixes.**

---

## 3. The Architecture Reality

The comprehensive plan proposes a sophisticated three-tier architecture with Web Workers, IndexedDB, Comlink, and a multi-stage processing pipeline. Let's examine what actually works in browsers today.

![Architecture Reality Check](architecture_reality.png)

### 3.1 What Actually Works

**React + TypeScript + Vite + Tailwind** — This stack is rock-solid. Vite's dev server is fast, Tailwind's utility-first approach is perfect for this type of UI, and TypeScript catches errors at build time. The planned warm earthy palette (`#6B4D3A`, `#8B7355`, `#A89080`, `#2B2118`, `#F5F0EB`) maps cleanly to Tailwind custom colors. No concerns here.

**shadcn/ui Components** — Checkbox, Card, Dialog, Progress, Sidebar — all components we need are available and well-maintained. The planned card-based checklist layout, sidebar navigation, and modal dialogs are standard patterns. No custom component engineering required.

**LocalStorage for Checklist State** — Simple, synchronous, well-supported. For checkbox progress across 13 phases, LocalStorage is the right tool. No need for IndexedDB complexity here. The 5MB limit is more than enough for checklist data.

**Vite Web Workers** — Vite supports Web Workers natively with the `?worker` suffix import [^42^]. For a checklist tool, Web Workers are unnecessary — the UI is lightweight. If we add DOCX parsing later, moving mammoth.js to a Worker prevents UI blocking during file processing. This is straightforward to implement.

### 3.2 What's Painful But Doable

**IndexedDB for File Storage** — IndexedDB works in all modern browsers but has quirks that will consume debugging time. Firefox Private Browsing **completely disables IndexedDB** and throws `InvalidStateError` [^1^]. Safari's Intelligent Tracking Prevention **evicts IndexedDB data after 7 days** of no user interaction [^1^]. Safari iOS had a regression (versions 14–14.5) where IndexedDB was **wiped on page load** [^1^]. The raw API is verbose and callback-heavy — you'll want the `idb` wrapper library. For our use case (storing uploaded manuscript files and analysis results), IndexedDB is the right choice, but we need fallback handling for private browsing and graceful degradation when storage is unavailable. Estimated debugging time: **2–3 days** for cross-browser edge cases.

**Zustand State Management** — Zustand is lightweight and works well, but the plan's mention of "IndexedDB persistence" with Zustand requires additional middleware. The `zustand-persist` middleware handles LocalStorage but IndexedDB integration needs custom implementation. For a tool of this complexity, Zustand is appropriate, but persistence adds a day of setup and testing.

**Comlink for Worker Communication** — Comlink simplifies Worker RPC by exposing objects across the boundary. However, TypeScript typing is problematic: *"Property 'method' does not exist on type 'Promise<{ method: () => void }>'"* — the `Remote<T>` type wraps nested objects in Promises in ways that don't match runtime behavior [^39^]. Developers end up fighting the type system or using `as any` workarounds. Vanilla Workers with explicit message passing are more verbose but type-safe. For this project, the complexity isn't justified — we have at most one Worker (for file parsing). **Recommendation: Use vanilla postMessage, skip Comlink.**

### 3.3 What's Misleading in the Plan

**The Full Processing Pipeline** — The plan shows a beautiful 7-stage pipeline: Parser → Analyzer → Cleaner → Style Mapper → Image Processor → ICML Generator → Package Builder. This implies a data flow where each stage feeds cleanly into the next. The reality is that **no JavaScript library produces output compatible with the next stage's input**. Mammoth outputs HTML, not structured data. There's no "cleaner" that accepts mammoth's output and produces something a style mapper can use. The ICML generator would need to accept whatever ad-hoc data structure we invent, and the package builder would need to handle whatever the ICML generator produces. Each stage boundary requires custom data transformation code that the plan doesn't account for. This isn't a pipeline — it's a series of adapter layers that each need individual engineering.

**Sharp-WASM for Image Processing** — The plan lists `sharp-wasm` as a dependency for image processing. The package `@img/sharp-wasm32` exists but is **not designed for browser use** — it's for serverless environments (Cloudflare Workers, Vercel Edge) where native binaries aren't available [^35^]. For browsers, the Squoosh team's WASM codecs are the viable option, but they're individual codec modules (MozJPEG, WebP, AVIF) not a unified processing pipeline. CMYK conversion isn't available at all. The plan's image optimization features (convert RGB to CMYK, resize, compress, generate thumbnails) are **mostly impossible in a browser**.

**Google Docs and Dropbox Integration** — The plan lists cloud storage integration as a feature. Google Docs requires OAuth (nightmare, as detailed above). Dropbox requires OAuth plus their Chooser API. Both add significant complexity, require backend infrastructure for OAuth token handling (client secrets cannot be exposed in frontend code), and serve a tiny fraction of users who can't download their files locally first. **These integrations multiply the project's scope by 2–3x for marginal benefit.**

---

## 4. The Honest Timeline

The comprehensive plan allocates 12 weeks for full implementation. Based on the research, here's a realistic breakdown.

![Timeline Reality Check](timeline_reality.png)

### 4.1 Realistic MVP (The Checklist Tool): 2–3 Weeks

This is the **Pre-Flight Book Production Tool** from plan.md — a guided checklist without file processing. It includes:

| Component | Time | Status |
|---|---|---|
| Project setup (Vite, Tailwind, shadcn) | 4 hours | ✅ Straightforward |
| Sidebar navigation (13 phases) | 1 day | ✅ Standard UI pattern |
| Checklist items per phase | 2 days | ✅ Static content from guide |
| Progress tracking + dashboard | 1 day | ✅ Derived state |
| Book info form (title, author, ISBN) | 4 hours | ✅ Simple form |
| AI prompt library (copy-to-clipboard) | 1 day | ✅ Static content |
| Export readiness report | 1 day | ✅ Summary of checked items |
| Print-ready checklist (Sections VIII–IX) | 1 day | ✅ Static content |
| LocalStorage persistence | 4 hours | ✅ Simple implementation |
| Design polish (warm palette, transitions) | 2 days | ✅ Tailwind customization |
| **Total** | **~10–12 days** | |

This MVP delivers **genuine value**: a production assistant can follow the checklist, track progress, and have all AI prompts at their fingertips. It replaces the printed PDF guide with an interactive tool. Bugs will be minimal (mostly UI edge cases). It can be deployed and used immediately.

### 4.2 File Processing Addition: +2–3 Weeks

Adding DOCX upload, text extraction, and basic analysis:

| Component | Time | Risk |
|---|---|---|
| File upload (react-dropzone) | 1 day | Low |
| mammoth.js integration | 2 days | Medium (edge cases) |
| Chapter structure detection | 3 days | Medium (heuristic accuracy) |
| Text analysis (word count, issues) | 2 days | Low |
| Image inventory (basic) | 2 days | Medium (browser limits) |
| Analysis dashboard UI | 2 days | Low |
| **Total** | **~12–15 days** | |

This extended version provides: upload a DOCX, see chapter breakdown, get a "cleanup report" (straight quotes, double spaces, etc.), view image inventory. It **does not** generate ICML, export packages, or modify files. It's a **diagnostic and guidance tool** — still very useful, but honest about what it can't do.

### 4.3 The Full Pipeline (What the Plan Wants): +3+ Months

Adding ICML generation, package export, and integrations:

| Component | Time | Risk |
|---|---|---|
| ICML format research + reverse engineering | 2–3 weeks | Very High |
| ICML generator (XML construction) | 2–3 weeks | Very High |
| Style mapping system | 1–2 weeks | High |
| Package builder (ZIP structure) | 1 week | Medium |
| Google Docs integration | 2 weeks | High (OAuth hell) |
| Comprehensive testing across file types | 2 weeks | Medium |
| Bug fixes from edge cases | Ongoing | High |
| **Total** | **~12–16 weeks** | |

The ICML generation alone is a research project. Adobe doesn't publish a formal ICML schema — the format is reverse-engineered from exported files. The Stack Overflow question about ICML style references illustrates the problem: a developer generated seemingly valid ICML with proper `AppliedParagraphStyle` attributes, but InDesign left the content unstyled because the style reference format was subtly wrong [^36^]. Getting this right requires extensive trial and error with actual InDesign imports.

---

## 5. What Will Actually Break (Bug Predictions)

Based on the library issues found in research, here are the bugs we can expect at each stage.

### 5.1 Bugs in the MVP (Low Count, Low Severity)

| Bug | Probability | Impact | Fix Time |
|---|---|---|---|
| Checkbox state desync on rapid clicks | 30% | Low | 2 hours |
| Sidebar scroll position lost on phase switch | 40% | Low | 1 hour |
| Progress percentage off-by-one on edge cases | 20% | Cosmetic | 30 min |
| Mobile layout issues on small screens | 60% | Medium | 1 day |
| LocalStorage quota exceeded (very large checklists) | 5% | Low | 2 hours |

**Expected total: 5–10 minor bugs. Fix time: 1–2 days.**

### 5.2 Bugs with File Processing (Moderate Count, Some Severe)

| Bug | Probability | Impact | Fix Time |
|---|---|---|---|
| mammoth.js fails on certain DOCX structures | 40% | High (crash) | 2–3 days |
| Chapter detection fails on non-standard manuscripts | 50% | Medium | 1 week (heuristic improvements) |
| PDF extraction produces garbled text | 60% | High (useless output) | Partial fix only |
| Image extraction fails on embedded SVGs | 30% | Low | 1 day |
| File upload fails on Safari (blob handling) | 20% | Medium | 1 day |
| Memory crash on large manuscripts (100+ pages) | 25% | High | Requires Worker refactoring |
| Firefox Private Browsing breaks IndexedDB | 100% | Medium | 1 day (fallback implementation) |
| Safari evicts stored files after 7 days | 100% | Medium | Cannot fully fix (ITP limitation) |

**Expected total: 15–25 bugs, several requiring significant rework. Fix time: 2–3 weeks.**

### 5.3 Bugs with ICML Generation (High Count, Many Severe)

| Bug | Probability | Impact | Fix Time |
|---|---|---|---|
| Generated ICML rejected by InDesign | 80% | Critical | Days of trial-and-error |
| Styles not applied on ICML import | 70% | Critical | Requires format research |
| Special characters corrupted in ICML | 50% | High | 2–3 days |
| Footnotes/endnotes not preserved | 60% | High | 1 week+ |
| Image placeholders don't link correctly | 50% | Medium | 2–3 days |
| ICML works in one InDesign version, fails in another | 40% | High | Ongoing maintenance |
| Package ZIP corrupted for large files | 30% | High | 2–3 days |

**Expected total: 20–40 bugs, many blocking. Fix time: 4–8 weeks (and counting).**

---

## 6. The Smarter Approach: What to Build Instead

Given all of the above, here's a realistic product roadmap that delivers value at each stage without chasing impossible features.

### 6.1 Phase 1: The Interactive Guide (Weeks 1–2)

Build the **Pre-Flight Checklist Tool** exactly as described in plan.md. No file processing. Just the 13 phases, checklists, AI prompts, progress tracking, and export readiness report. This replaces the printed PDF with an interactive tool that production assistants can actually use.

**Key insight:** The We Are Wolf InDesign Production Guide is 35 pages of detailed instructions. Converting this to an interactive checklist with progress tracking and searchable AI prompts is already a significant product improvement over the static document. Don't underestimate the value of "just" making the guide interactive.

### 6.2 Phase 2: The Diagnostic Tool (Weeks 3–4)

Add DOCX upload and analysis. The tool extracts text, detects structure, and generates a "Pre-Flight Report" showing: word count, chapter breakdown, detected formatting issues (straight quotes, double spaces, inconsistent dashes), and image inventory. The user downloads this report and fixes issues in Word before importing to InDesign.

**Key insight:** The tool becomes a **diagnostic companion** to the workflow, not a replacement for InDesign's import process. It catches problems *before* the designer opens InDesign, which is where the guide's value proposition lives anyway.

### 6.3 Phase 3: The Smart Assistant (Future)

Only after Phases 1 and 2 are stable and user-tested, consider adding: automated cleanup suggestions with copy-paste fixes, template generation for InDesign style mapping (a preset file the designer can load during Word import), and integration with InDesign's scripting API (via ExtendScript or UXP scripts that run inside InDesign, not in the browser).

**Key insight:** Instead of generating ICML (which is hard and poorly supported), generate **InDesign import presets** (XML files that configure the Word import dialog) or **ExtendScript scripts** that run inside InDesign to automate setup tasks. These are Adobe-supported workflows with documented formats.

---

## 7. The Honest Verdict

The documents describe a tool that sits at the intersection of document processing, desktop publishing, and web application development. The uncomfortable truth is that **browsers are the wrong runtime for half of what the plan wants to do**. File format conversion, color space transformation, precise typography analysis, and professional publishing workflows are desktop-domain problems. The browser can do some of it (text extraction, basic analysis, guidance), but pretending it can replace InDesign's import pipeline is setting up for failure.

The good news: **the valuable part of this product is the guidance, not the automation**. The We Are Wolf guide exists because the InDesign workflow is complex and easy to mess up. A tool that guides users through the checklist, provides AI prompts at the right moments, and catches common mistakes before they become expensive problems — that's genuinely useful software. It doesn't need to generate ICML to be valuable. It needs to be reliable, easy to use, and honest about what it can and can't do.

Build the checklist tool. Ship it in two weeks. Make it beautiful and reliable. Then, if users ask for file analysis, add that incrementally. But never chase the ICML dream — it's a trap that will consume months and produce a broken feature that nobody trusts.
