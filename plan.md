# Plan: Pre-Flight Book Production Tool (Web App)

## Vision
Convert the InDesign Production Guide into a generic, interactive web-based tool that guides any author/publisher through the complete pre-InDesign workflow. The tool features:
- Phase-based guided checklist (9 production phases)
- Built-in AI prompts that verify each section
- Progress tracking with visual indicators
- Generic — works for any book title, author, ISBN
- Clean, warm literary aesthetic
- Exportable readiness report

## Skill: vibecoding-webapp-swarm
Build a React + TypeScript + Tailwind CSS + shadcn/ui web application.

## Architecture
- Single-page application with phase navigation
- Left sidebar: phase navigation with progress indicators
- Main content: checklist items, AI prompts, verify buttons
- Top bar: book info input (title, author, ISBN, etc.)
- Progress bar: overall completion percentage
- AI Verification modal: prompts and expected results

## Phases (matching the guide)
1. File Audit & Inventory
2. Manuscript Cleanup
3. Image Asset Preparation
4. Typography & Design Decisions
5. InDesign Document Setup
6. Master Pages & Styles Setup
7. Import & Text Flow
8. Image Placement
9. Typography Refinement
10. Front & Back Matter
11. Color & Print Specs
12. Export & Print-Ready
13. Final Quality Assurance

## Features
- Editable book info (title, author, ISBN, publisher, page count, trim size)
- Checkbox items with persistence (localStorage)
- "Verify with AI" button per phase — shows AI prompt + expected result
- Phase completion indicators
- Overall progress bar
- Export readiness report
- Reset/Start New Book option

## Design
- Warm earthy palette (#6B4D3A, #8B7355, #A89080, #2B2118, #F5F0EB)
- Clean typography
- Sidebar navigation
- Card-based checklist layout
- Smooth transitions between phases
