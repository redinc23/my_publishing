# Comprehensive Plan: Manuscript to InDesign EPUB Preparation Tool

## Executive Summary

Transform the existing Pre-Flight Book Production Tool into a comprehensive manuscript preparation system that accepts raw manuscript files (DOCX, Google Docs, PDF) and guides users through a systematic process to prepare publication-ready files for InDesign EPUB production.

---

## Table of Contents

1. [Core Objectives](#core-objectives)
2. [System Architecture](#system-architecture)
3. [Feature Specifications](#feature-specifications)
4. [Technical Implementation](#technical-implementation)
5. [User Workflow](#user-workflow)
6. [File Processing Pipeline](#file-processing-pipeline)
7. [Quality Assurance](#quality-assurance)
8. [Export & Handoff](#export--handoff)
9. [Integration Points](#integration-points)
10. [Testing Strategy](#testing-strategy)

---

## Core Objectives

### Primary Goals

1. **File Ingestion**: Accept multiple manuscript formats (DOCX, PDF, Google Docs, TXT, RTF)
2. **Automated Analysis**: Scan and validate manuscript structure, formatting, and content
3. **Guided Preparation**: Walk users through systematic preparation phases
4. **Quality Assurance**: Automated checks for common issues before InDesign
5. **Export Package**: Generate InDesign-ready files with proper specifications

### Success Metrics

- 95%+ accuracy in structure detection
- 80% reduction in manual formatting cleanup time
- Zero critical errors in exported ICML files
- Complete asset inventory with proper linking
- Full metadata compliance for EPUB standards

---

## System Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Frontend (React + TypeScript)            │
├─────────────────────────────────────────────────────────────┤
│  Upload Interface  │  Analysis Dashboard  │  Phase Workflow  │
│  File Validator    │  Preview System      │  Export Manager  │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                   Processing Layer (Web Workers)             │
├─────────────────────────────────────────────────────────────┤
│  File Parser       │  Structure Analyzer  │  Format Cleaner  │
│  Image Extractor   │  Style Mapper        │  ICML Generator  │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    Storage Layer (IndexedDB)                 │
├─────────────────────────────────────────────────────────────┤
│  Manuscript Files  │  Extracted Assets    │  Analysis Data   │
│  User Progress     │  Export Packages     │  Settings        │
└─────────────────────────────────────────────────────────────┘
```

### Component Architecture

```
app/
├── src/
│   ├── components/
│   │   ├── upload/
│   │   │   ├── FileUploader.tsx          # Drag-drop upload interface
│   │   │   ├── FileList.tsx              # Uploaded files management
│   │   │   └── UploadProgress.tsx        # Upload status tracking
│   │   ├── analysis/
│   │   │   ├── StructureViewer.tsx       # Document structure visualization
│   │   │   ├── IssuesList.tsx            # Validation issues display
│   │   │   ├── StyleMapper.tsx           # Style mapping interface
│   │   │   └── ImageInventory.tsx        # Image asset management
│   │   ├── processing/
│   │   │   ├── CleanupPanel.tsx          # Formatting cleanup controls
│   │   │   ├── ValidationPanel.tsx       # Quality checks display
│   │   │   └── PreviewPanel.tsx          # Live preview of changes
│   │   └── export/
│   │       ├── ExportWizard.tsx          # Export configuration
│   │       ├── PackageBuilder.tsx        # InDesign package assembly
│   │       └── DownloadManager.tsx       # File download interface
│   ├── workers/
│   │   ├── fileParser.worker.ts          # Parse DOCX/PDF files
│   │   ├── analyzer.worker.ts            # Analyze document structure
│   │   ├── cleaner.worker.ts             # Clean formatting
│   │   └── icmlGenerator.worker.ts       # Generate ICML files
│   ├── lib/
│   │   ├── parsers/
│   │   │   ├── docxParser.ts             # DOCX parsing logic
│   │   │   ├── pdfParser.ts              # PDF text extraction
│   │   │   └── gdocParser.ts             # Google Docs API integration
│   │   ├── analyzers/
│   │   │   ├── structureAnalyzer.ts      # Document structure detection
│   │   │   ├── styleAnalyzer.ts          # Style usage analysis
│   │   │   └── contentAnalyzer.ts        # Content validation
│   │   ├── processors/
│   │   │   ├── formatCleaner.ts          # Remove manual formatting
│   │   │   ├── styleMapper.ts            # Map styles to InDesign
│   │   │   └── imageExtractor.ts         # Extract and process images
│   │   └── exporters/
│   │       ├── icmlExporter.ts           # Generate ICML files
│   │       ├── packageBuilder.ts         # Build InDesign package
│   │       └── metadataGenerator.ts      # Generate metadata XML
│   └── types/
│       ├── manuscript.ts                 # Manuscript data types
│       ├── analysis.ts                   # Analysis result types
│       └── export.ts                     # Export configuration types
```

---

## Feature Specifications

### 1. File Upload & Management System

#### Upload Interface

**Features:**
- Drag-and-drop file upload zone
- Multi-file selection support
- Cloud storage integration (Google Drive, Dropbox)
- Paste from clipboard (for Google Docs links)
- File size validation (max 50MB per file)
- Format validation (DOCX, PDF, TXT, RTF, GDOC)

**Technical Specifications:**
```typescript
interface ManuscriptFile {
  id: string;
  name: string;
  originalName: string;
  type: 'docx' | 'pdf' | 'gdoc' | 'txt' | 'rtf';
  size: number;
  uploadedAt: Date;
  status: 'uploading' | 'analyzing' | 'ready' | 'error';
  progress: number;
  analysis?: FileAnalysis;
  blob?: Blob;
  chapters?: ChapterInfo[];
}

interface ChapterInfo {
  id: string;
  title: string;
  order: number;
  wordCount: number;
  startPage: number;
  endPage: number;
}
```

**User Experience:**
1. User drags DOCX file into upload zone
2. File validates (format, size, encoding)
3. Upload progress bar shows status
4. File automatically queues for analysis
5. Analysis results display in dashboard

---

### 2. Manuscript Analysis Engine

#### Structure Detection

**Capabilities:**
- Automatic chapter detection via heading styles
- Section and subsection hierarchy mapping
- Front matter identification (title page, copyright, dedication, TOC)
- Back matter identification (appendices, bibliography, index)
- Paragraph style inventory
- Character style inventory

**Analysis Output:**
```typescript
interface DocumentStructure {
  frontMatter: FrontMatterSection[];
  chapters: Chapter[];
  backMatter: BackMatterSection[];
  hierarchy: HeadingHierarchy;
  outline: DocumentOutline;
}

interface Chapter {
  id: string;
  number: number;
  title: string;
  level: number;
  startPosition: number;
  endPosition: number;
  wordCount: number;
  paragraphs: Paragraph[];
  images: ImageReference[];
  footnotes: Footnote[];
}

interface HeadingHierarchy {
  h1Count: number;
  h2Count: number;
  h3Count: number;
  h4Count: number;
  inconsistencies: HierarchyIssue[];
}
```

#### Format Validation

**Checks:**
- UTF-8 encoding compliance
- Special character validation
- Font embedding status
- Image resolution and format
- Hyperlink integrity
- Table structure validation
- List formatting consistency

**Validation Report:**
```typescript
interface ValidationReport {
  encoding: EncodingCheck;
  characters: CharacterCheck;
  fonts: FontCheck;
  images: ImageCheck[];
  links: LinkCheck[];
  tables: TableCheck[];
  lists: ListCheck[];
  overallScore: number; // 0-100
  criticalIssues: ValidationIssue[];
  warnings: ValidationIssue[];
  suggestions: ValidationIssue[];
}

interface ValidationIssue {
  id: string;
  severity: 'critical' | 'warning' | 'suggestion';
  category: string;
  message: string;
  location: DocumentLocation;
  autoFixable: boolean;
  fixAction?: () => void;
}
```

#### Content Analysis

**Features:**
- Word count and reading time estimation
- Readability scoring (Flesch-Kincaid)
- Dialogue detection and formatting check
- Consistency checks (character names, terminology)
- Style guide compliance (Chicago, AP, etc.)
- Plagiarism detection (optional integration)

---

### 3. Interactive Structure Viewer

**Visual Components:**
- Collapsible document tree view
- Chapter/section navigation
- Quick jump to any section
- Drag-and-drop reordering
- Visual hierarchy indicators
- Issue markers on problematic sections

**Features:**
```typescript
interface StructureViewerProps {
  structure: DocumentStructure;
  onNavigate: (location: DocumentLocation) => void;
  onReorder: (fromId: string, toId: string) => void;
  highlightIssues: boolean;
  expandedSections: Set<string>;
}
```

**User Interactions:**
1. Click chapter to navigate to content
2. Drag chapter to reorder
3. Click issue icon to see details
4. Expand/collapse sections
5. Search within structure

---

### 4. Formatting Cleanup System

#### Automated Cleanup Operations

**Cleanup Categories:**

1. **Whitespace Cleanup**
   - Remove double spaces
   - Remove manual line breaks (except intentional)
   - Standardize paragraph spacing
   - Remove trailing spaces
   - Normalize tab usage

2. **Typography Cleanup**
   - Convert straight quotes to curly quotes
   - Fix em-dash and en-dash usage
   - Standardize ellipsis (... to …)
   - Fix apostrophe usage
   - Correct hyphenation

3. **Style Cleanup**
   - Remove manual formatting (bold, italic applied directly)
   - Convert to character/paragraph styles
   - Standardize heading styles
   - Fix inconsistent indentation
   - Remove empty paragraphs

4. **Special Characters**
   - Replace non-breaking spaces appropriately
   - Fix smart quotes direction
   - Standardize bullet points
   - Convert special symbols to Unicode

**Cleanup Configuration:**
```typescript
interface CleanupConfig {
  whitespace: {
    removeDoubleSpaces: boolean;
    removeManualLineBreaks: boolean;
    standardizeParagraphSpacing: boolean;
    removeTrailingSpaces: boolean;
  };
  typography: {
    convertQuotes: boolean;
    fixDashes: boolean;
    standardizeEllipsis: boolean;
    fixApostrophes: boolean;
  };
  styles: {
    removeManualFormatting: boolean;
    convertToStyles: boolean;
    standardizeHeadings: boolean;
    removeEmptyParagraphs: boolean;
  };
  preview: boolean;
  createBackup: boolean;
}
```

---

### 5. Style Mapping System

#### InDesign Style Mapping

**Purpose:** Map manuscript styles to InDesign paragraph and character styles

**Mapping Interface:**
```typescript
interface StyleMapping {
  sourceStyle: string;
  targetStyle: InDesignStyle;
  category: 'paragraph' | 'character';
  properties: StyleProperties;
}

interface InDesignStyle {
  name: string;
  basedOn?: string;
  nextStyle?: string;
  properties: {
    font?: FontSpec;
    size?: number;
    leading?: number;
    tracking?: number;
    alignment?: 'left' | 'center' | 'right' | 'justified';
    indents?: IndentSpec;
    spacing?: SpacingSpec;
  };
}

interface StyleProperties {
  font: string;
  size: number;
  bold: boolean;
  italic: boolean;
  underline: boolean;
  color: string;
  alignment: string;
  lineHeight: number;
  firstLineIndent: number;
  leftIndent: number;
  rightIndent: number;
  spaceBefore: number;
  spaceAfter: number;
}
```

**Predefined Style Templates:**
- Fiction Novel (standard)
- Non-Fiction Book
- Academic Textbook
- Poetry Collection
- Children's Book
- Cookbook
- Custom (user-defined)

**Mapping Workflow:**
1. System detects all styles in manuscript
2. Suggests InDesign style mappings
3. User reviews and adjusts mappings
4. System validates mapping completeness
5. Mappings saved for export

---

### 6. Image Asset Management

#### Image Extraction & Processing

**Features:**
- Extract all images from manuscript
- Analyze image properties (resolution, format, color mode)
- Generate image inventory
- Validate image quality for print
- Create linked image structure
- Optimize images for EPUB

**Image Processing:**
```typescript
interface ImageAsset {
  id: string;
  originalName: string;
  extractedName: string;
  format: 'jpg' | 'png' | 'gif' | 'tiff' | 'svg';
  width: number;
  height: number;
  dpi: number;
  colorMode: 'RGB' | 'CMYK' | 'Grayscale';
  fileSize: number;
  location: DocumentLocation;
  caption?: string;
  altText?: string;
  issues: ImageIssue[];
  optimized: boolean;
  linkedPath: string;
}

interface ImageIssue {
  type: 'low-resolution' | 'wrong-color-mode' | 'oversized' | 'missing-alt-text';
  severity: 'critical' | 'warning';
  message: string;
  autoFixable: boolean;
}
```

**Image Optimization:**
- Convert RGB to CMYK for print
- Resize oversized images
- Compress without quality loss
- Generate multiple resolutions for responsive EPUB
- Create thumbnail previews

---

### 7. Metadata Management

#### EPUB Metadata Requirements

**Required Fields:**
- Title
- Author(s)
- Publisher
- Publication Date
- Language
- ISBN-13
- Rights Statement

**Optional Fields:**
- Subtitle
- Series Information
- Edition
- Contributors (Editor, Illustrator, Translator)
- Subject/Keywords
- Description
- Cover Image

**Metadata Interface:**
```typescript
interface EPUBMetadata {
  // Dublin Core Required
  title: string;
  creator: Creator[];
  language: string;
  identifier: Identifier[];
  
  // Dublin Core Optional
  contributor: Contributor[];
  coverage?: string;
  date: Date;
  description?: string;
  format?: string;
  publisher?: string;
  relation?: string;
  rights?: string;
  source?: string;
  subject: string[];
  type?: string;
  
  // EPUB-specific
  meta: MetaProperty[];
  link: LinkProperty[];
}

interface Creator {
  name: string;
  role: 'author' | 'editor' | 'translator' | 'illustrator';
  fileAs?: string;
  alternateScript?: string;
}

interface Identifier {
  scheme: 'ISBN' | 'DOI' | 'UUID';
  value: string;
}
```

---

### 8. Quality Assurance Checks

#### Pre-Export Validation

**Critical Checks:**
1. All chapters have proper heading styles
2. No orphaned images or broken links
3. All styles mapped to InDesign equivalents
4. Image resolution meets minimum requirements (300dpi)
5. No manual formatting remaining
6. UTF-8 encoding throughout
7. Metadata complete and valid
8. File structure matches EPUB requirements

**Validation Dashboard:**
```typescript
interface QualityReport {
  overallScore: number; // 0-100
  readyForExport: boolean;
  checks: QualityCheck[];
  criticalIssues: number;
  warnings: number;
  passed: number;
  timestamp: Date;
}

interface QualityCheck {
  id: string;
  category: 'structure' | 'formatting' | 'content' | 'assets' | 'metadata';
  name: string;
  status: 'passed' | 'warning' | 'failed';
  message: string;
  details?: string;
  autoFixable: boolean;
  fixAction?: () => Promise<void>;
}
```

**Quality Score Calculation:**
- Critical issues: -20 points each
- Warnings: -5 points each
- Passed checks: +5 points each
- Minimum score for export: 80/100

---

### 9. ICML Generation

#### InDesign Markup Language Export

**ICML Structure:**
```xml
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Document>
  <Story Self="story_1" AppliedTOCStyle="n" TrackChanges="false">
    <StoryPreference OpticalMarginAlignment="false" />
    <ParagraphStyleRange AppliedParagraphStyle="ParagraphStyle/Chapter Title">
      <CharacterStyleRange AppliedCharacterStyle="CharacterStyle/$ID/[No character style]">
        <Content>Chapter 1: The Beginning</Content>
      </CharacterStyleRange>
    </ParagraphStyleRange>
    <ParagraphStyleRange AppliedParagraphStyle="ParagraphStyle/Body Text">
      <CharacterStyleRange AppliedCharacterStyle="CharacterStyle/$ID/[No character style]">
        <Content>This is the first paragraph of the chapter...</Content>
      </CharacterStyleRange>
    </ParagraphStyleRange>
  </Story>
</Document>
```

**ICML Generator Features:**
- Convert cleaned manuscript to ICML format
- Preserve style mappings
- Handle special characters properly
- Include image placeholders with links
- Generate separate ICML per chapter (optional)
- Include footnotes and endnotes
- Preserve hyperlinks

**Generator Configuration:**
```typescript
interface ICMLConfig {
  splitByChapter: boolean;
  includeImages: boolean;
  preserveHyperlinks: boolean;
  encoding: 'UTF-8' | 'UTF-16';
  lineEndings: 'LF' | 'CRLF';
  indentXML: boolean;
  validateOutput: boolean;
}
```

---

### 10. InDesign Package Export

#### Package Structure

```
InDesign_Package/
├── Document/
│   ├── manuscript.icml              # Main ICML file
│   ├── chapter_01.icml              # Chapter 1 (if split)
│   ├── chapter_02.icml              # Chapter 2
│   └── ...
├── Links/
│   ├── image_001.jpg                # Linked images
│   ├── image_002.png
│   └── ...
├── Styles/
│   ├── paragraph_styles.xml         # Paragraph style definitions
│   ├── character_styles.xml         # Character style definitions
│   └── object_styles.xml            # Object style definitions
├── Metadata/
│   ├── metadata.xml                 # EPUB metadata
│   ├── toc.xml                      # Table of contents
│   └── manifest.xml                 # File manifest
├── Instructions/
│   ├── README.md                    # Setup instructions
│   ├── style_guide.pdf              # Style application guide
│   └── checklist.pdf                # Pre-flight checklist
└── package_info.json                # Package metadata
```

**Package Metadata:**
```typescript
interface PackageInfo {
  packageVersion: '1.0';
  generatedAt: Date;
  generatedBy: string;
  bookInfo: BookInfo;
  statistics: {
    totalChapters: number;
    totalWords: number;
    totalImages: number;
    totalPages: number;
  };
  requirements: {
    indesignVersion: string;
    requiredFonts: string[];
    colorProfile: string;
  };
  warnings: string[];
  notes: string[];
}
```

---

## Technical Implementation

### Technology Stack

**Frontend:**
- React 18+ with TypeScript
- Vite for build tooling
- TailwindCSS for styling
- Framer Motion for animations
- React Router for navigation
- Zustand for state management

**File Processing:**
- mammoth.js for DOCX parsing
- pdf.js for PDF text extraction
- jszip for ZIP file handling
- xml2js for XML parsing/generation
- sharp for image processing (via WASM)

**Storage:**
- IndexedDB for local file storage
- LocalStorage for user preferences
- File System Access API for direct file operations

**Workers:**
- Web Workers for heavy processing
- Comlink for worker communication
- Workbox for service worker caching

### Key Libraries

```json
{
  "dependencies": {
    "mammoth": "^1.6.0",
    "pdfjs-dist": "^3.11.174",
    "jszip": "^3.10.1",
    "xml2js": "^0.6.2",
    "sharp-wasm": "^0.14.0",
    "idb": "^7.1.1",
    "comlink": "^4.4.1",
    "zustand": "^4.4.7",
    "react-dropzone": "^14.2.3",
    "react-markdown": "^9.0.1",
    "lucide-react": "^0.294.0"
  }
}
```

### Performance Considerations

**Optimization Strategies:**
1. Process files in Web Workers to avoid blocking UI
2. Use IndexedDB for large file storage
3. Implement progressive loading for large manuscripts
4. Cache analysis results
5. Lazy load components
6. Virtualize long lists (chapters, images)
7. Debounce user inputs
8. Use React.memo for expensive components

**Memory Management:**
- Stream large files instead of loading entirely
- Release blob URLs after use
- Clear IndexedDB entries for deleted files
- Implement garbage collection triggers
- Monitor memory usage in development

---

## User Workflow

### Complete User Journey

#### Step 1: Upload Manuscript

```
User Action: Drag DOCX file into upload zone
System Response:
  1. Validate file format and size
  2. Show upload progress
  3. Store file in IndexedDB
  4. Queue for analysis
  5. Display success notification
```

#### Step 2: Automatic Analysis

```
System Actions:
  1. Parse DOCX structure
  2. Extract text content
  3. Identify chapters and sections
  4. Extract images
  5. Analyze styles
  6. Detect issues
  7. Generate analysis report
  8. Display results in dashboard

Duration: 5-30 seconds depending on file size
```

#### Step 3: Review Analysis Results

```
User Views:
  - Document structure tree
  - Validation issues list
  - Image inventory
  - Style usage report
  - Quality score

User Actions:
  - Navigate through structure
  - Review flagged issues
  - Check image quality
  - Verify metadata
```

#### Step 4: Phase-Based Preparation

**Phase 1: Manuscript Cleanup**
- Review and fix validation issues
- Run automated cleanup
- Preview changes
- Approve cleanup

**Phase 2: Structure Refinement**
- Verify chapter organization
- Reorder sections if needed
- Add missing front/back matter
- Confirm hierarchy

**Phase 3: Style Mapping**
- Review detected styles
- Map to InDesign styles
- Apply style template
- Validate mappings

**Phase 4: Image Processing**
- Review image inventory
- Fix resolution issues
- Convert color modes
- Add alt text and captions

**Phase 5: Metadata Completion**
- Fill required fields
- Add optional metadata
- Verify ISBN format
- Set publication details

**Phase 6: Quality Assurance**
- Run final validation
- Review quality report
- Fix remaining issues
- Achieve 80+ quality score

#### Step 5: Export Package

```
User Action: Click "Export InDesign Package"
System Actions:
  1. Generate ICML files
  2. Copy linked images
  3. Create style definitions
  4. Generate metadata XML
  5. Build package structure
  6. Create ZIP archive
  7. Trigger download

Output: InDesign_Package_[BookTitle]_[Date].zip
```

#### Step 6: InDesign Import

```
Designer Actions:
  1. Extract ZIP package
  2. Open InDesign
  3. Create new document
  4. Import ICML files
  5. Apply master pages
  6. Link images
  7. Apply styles
  8. Begin layout refinement
```

---

## File Processing Pipeline

### Pipeline Architecture

```
Input File (DOCX/PDF)
    ↓
[Parser Worker]
    ↓
Raw Document Data
    ↓
[Analyzer Worker]
    ↓
Structure + Issues
    ↓
[Cleaner Worker]
    ↓
Cleaned Document
    ↓
[Style Mapper]
    ↓
Mapped Styles
    ↓
[Image Processor]
    ↓
Optimized Images
    ↓
[ICML Generator]
    ↓
ICML Files
    ↓
[Package Builder]
    ↓
InDesign Package (ZIP)
```

### Processing Stages

#### Stage 1: Parsing

**Input:** Raw file (DOCX, PDF, etc.)
**Output:** Structured document data

**Operations:**
- Extract text content
- Parse XML structure (DOCX)
- Extract embedded images
- Read document properties
- Identify styles and formatting

**Error Handling:**
- Corrupted file detection
- Unsupported format warning
- Encoding issues resolution
- Missing content alerts

#### Stage 2: Analysis

**Input:** Structured document data
**Output:** Analysis report

**Operations:**
- Detect document structure
- Identify chapters and sections
- Analyze style usage
- Validate formatting
- Check content quality
- Generate statistics

**Algorithms:**
- Heading detection via style names and formatting
- Chapter boundary detection via page breaks
- Style consistency scoring
- Content quality metrics

#### Stage 3: Cleanup

**Input:** Document data + cleanup config
**Output:** Cleaned document

**Operations:**
- Remove manual formatting
- Fix typography issues
- Standardize spacing
- Convert to proper styles
- Remove artifacts

**Validation:**
- Verify no content loss
- Check style application
- Validate character encoding
- Confirm structure integrity

#### Stage 4: Style Mapping

**Input:** Cleaned document + style mappings
**Output:** Document with InDesign styles

**Operations:**
- Apply style mappings
- Convert paragraph styles
- Convert character styles
- Handle nested styles
- Preserve formatting intent

**Validation:**
- Verify all styles mapped
- Check style hierarchy
- Validate style properties
- Confirm no unmapped styles

#### Stage 5: Image Processing

**Input:** Extracted images + processing config
**Output:** Optimized images + inventory

**Operations:**
- Analyze image properties
- Convert color modes
- Resize if needed
- Optimize file size
- Generate thumbnails
- Create linked structure

**Quality Checks:**
- Minimum resolution (300dpi)
- Proper color mode (CMYK for print)
- File format compatibility
- File size optimization

#### Stage 6: ICML Generation

**Input:** Styled document + images
**Output:** ICML files

**Operations:**
- Convert to ICML XML format
- Apply style references
- Insert image placeholders
- Handle special characters
- Preserve hyperlinks
- Generate proper structure

**Validation:**
- XML well-formedness
- Style reference validity
- Image link integrity
- Character encoding correctness

#### Stage 7: Package Building

**Input:** ICML files + images + metadata
**Output:** Complete InDesign package

**Operations:**
- Create directory structure
- Copy ICML files
- Copy linked images
- Generate style definitions
- Create metadata files
- Write documentation
- Build ZIP archive

**Final Checks:**
- All files present
- Correct directory structure
- Valid file references
- Complete documentation

---

## Quality Assurance

### Validation Framework

#### Validation Categories

**1. Structure Validation**
- Chapter numbering consistency
- Heading hierarchy correctness
- Front matter completeness
- Back matter presence
- TOC accuracy

**2. Content Validation**
- No missing content
- Proper paragraph breaks
- Correct special characters
- Valid hyperlinks
- Footnote integrity

**3. Style Validation**
- All styles mapped
- No manual formatting
- Consistent style application
- Proper style hierarchy
- Character style usage

**4. Image Validation**
- Minimum resolution met
- Correct color mode
- Proper file format
- All images linked
- Alt text present

**5. Metadata Validation**
- Required fields complete
- ISBN format correct
- Valid publication date
- Proper language code
- Rights statement present

### Automated Testing

**Unit Tests:**
- Parser functions
- Analyzer algorithms
- Cleanup operations
- Style mapping logic
- ICML generation

**Integration Tests:**
- End-to-end file processing
- Multi-file handling
- Error recovery
- Export package creation

**Performance Tests:**
- Large file handling (100+ pages)
- Multiple file processing
- Memory usage monitoring
- Processing time benchmarks

---

## Export & Handoff

### Export Options

**1. Standard Package**
- Single ICML file
- Linked images folder
- Style definitions
- Metadata XML
- Basic instructions

**2. Chapter-Split Package**
- Separate ICML per chapter
- Linked images folder
- Style definitions
- Metadata XML
- Chapter index

**3. Complete Package**
- ICML files
- Linked images
- Style definitions
- Metadata XML
- Detailed instructions
- Style guide PDF
- Pre-flight checklist
- Sample InDesign template

### Handoff Documentation

**README.md Contents:**
```markdown
# InDesign Import Package

## Package Information
- Book Title: [Title]
- Author: [Author]
- Generated: [Date]
- Package Version: 1.0

## Contents
- `/Document/` - ICML files for import
- `/Links/` - Linked images (300dpi, CMYK)
- `/Styles/` - Style definitions
- `/Metadata/` - EPUB metadata
- `/Instructions/` - Setup guides

## Import Instructions

### Step 1: Create New Document
1. Open Adobe InDesign
2. File > New > Document
3. Set trim size: [Size]
4. Set margins: [Margins]
5. Set columns: [Columns]

### Step 2: Import ICML
1. File > Place
2. Select `manuscript.icml`
3. Click to place on page
4. Text will flow with styles applied

### Step 3: Link Images
1. Links panel > Relink
2. Navigate to `/Links/` folder
3. Select all images
4. Click Open

### Step 4: Apply Master Pages
1. Create master pages
2. Apply to document pages
3. Adjust as needed

### Step 5: Refine Layout
1. Adjust text flow
2. Position images
3. Fine-tune typography
4. Add page numbers

## Style Guide
See `style_guide.pdf` for detailed style specifications.

## Pre-Flight Checklist
See `checklist.pdf` for final quality checks.

## Support
For issues or questions, contact: [Email]
```

---

## Integration Points

### External Service Integrations

**1. Google Docs API**
- OAuth authentication
- Document download
- Real-time collaboration
- Version history access

**2. Dropbox API**
- File picker integration
- Direct file access
- Automatic sync
- Shared folder support

**3. ISBN Lookup Services**
- Bowker API integration
- Automatic metadata population
- Cover image retrieval
- Publisher information

**4. AI Services (Optional)**
- OpenAI GPT for content analysis
- Grammar checking
- Style consistency
- Readability scoring

**5. Font Services**
- Adobe Fonts integration
- Google Fonts
- Font licensing verification
- Font embedding checks

### API Design

```typescript
// Google Docs Integration
interface GoogleDocsAPI {
  authenticate(): Promise<void>;
  listDocuments(): Promise<Document[]>;
  downloadDocument(id: string): Promise<Blob>;
  getDocumentMetadata(id: string): Promise<Metadata>;
}

// ISBN Lookup
interface ISBNLookupAPI {
  lookup(isbn: string): Promise<BookMetadata>;
  validateISBN(isbn: string): boolean;
  getCoverImage(isbn: string): Promise<string>;
}

// AI Analysis
interface AIAnalysisAPI {
  analyzeContent(text: string): Promise<ContentAnalysis>;
  checkGrammar(text: string): Promise<GrammarIssue[]>;
  scoreReadability(text: string): Promise<ReadabilityScore>;
  suggestImprovements(text: string): Promise<Suggestion[]>;
}
```

---

## Testing Strategy

### Test Coverage Goals

- Unit Tests: 80%+ coverage
- Integration Tests: Key workflows
- E2E Tests: Critical user paths
- Performance Tests: Large files
- Accessibility Tests: WCAG 2.1 AA

### Test Scenarios

**File Upload Tests:**
- Valid DOCX upload
- Invalid file format rejection
- Large file handling (50MB+)
- Multiple file upload
- Corrupted file handling

**Parsing Tests:**
- Simple document parsing
- Complex document with images
- Document with tables
- Document with footnotes
- Multi-chapter document

**Analysis Tests:**
- Chapter detection accuracy
- Style identification
- Issue detection
- Image extraction
- Metadata extraction

**Cleanup Tests:**
- Whitespace removal
- Typography fixes
- Style conversion
- Manual formatting removal
- Special character handling

**Export Tests:**
- ICML generation
- Package structure
- File integrity
- ZIP creation
- Documentation generation

### Performance Benchmarks

**Target Metrics:**
- Small file (10 pages): < 5 seconds
- Medium file (100 pages): < 30 seconds
- Large file (500 pages): < 2 minutes
- Image processing: < 1 second per image
- Export generation: < 10 seconds

---

## Implementation Phases

### Phase 1: Foundation (Weeks 1-2)
- Set up project structure
- Implement file upload system
- Create basic UI components
- Set up IndexedDB storage
- Implement DOCX parser

### Phase 2: Analysis Engine (Weeks 3-4)
- Build structure analyzer
- Implement validation system
- Create issue detection
- Build analysis dashboard
- Add structure viewer

### Phase 3: Processing Pipeline (Weeks 5-6)
- Implement cleanup system
- Build style mapper
- Create image processor
- Add preview system
- Implement undo/redo

### Phase 4: Export System (Weeks 7-8)
- Build ICML generator
- Create package builder
- Implement export wizard
- Add documentation generation
- Create ZIP packaging

### Phase 5: Integration & Polish (Weeks 9-10)
- Add external integrations
- Implement AI features
- Polish UI/UX
- Add animations
- Optimize performance

### Phase 6: Testing & Launch (Weeks 11-12)
- Comprehensive testing
- Bug fixes
- Documentation
- User guides
- Beta launch

---

## Success Criteria

### Functional Requirements
✓ Accept DOCX, PDF, Google Docs files
✓ Automatically detect document structure
✓ Identify and report formatting issues
✓ Clean and standardize formatting
✓ Map styles to InDesign equivalents
✓ Extract and optimize images
✓ Generate valid ICML files
✓ Create complete InDesign package
✓ Export with proper documentation

### Quality Requirements
✓ 95%+ structure detection accuracy
✓ Zero data loss during processing
✓ Valid ICML output (InDesign compatible)
✓ All images properly linked
✓ Complete metadata included
✓ 80+ quality score before export

### Performance Requirements
✓ Process 100-page document in < 30 seconds
✓ Handle files up to 50MB
✓ Support 100+ images per document
✓ Responsive UI (< 100ms interactions)
✓ Efficient memory usage (< 500MB)

### User Experience Requirements
✓ Intuitive upload interface
✓ Clear progress indicators
✓ Helpful error messages
✓ Visual structure navigation
✓ One-click export
✓ Comprehensive documentation

---

## Conclusion

This comprehensive plan transforms the Pre-Flight Book Production Tool into a complete manuscript-to-InDesign preparation system. By implementing automated analysis, intelligent cleanup, and proper ICML export, the tool will significantly reduce the time and effort required to prepare manuscripts for professional book production.

The system bridges the gap between raw manuscript files and InDesign-ready content, ensuring quality, consistency, and EPUB compliance throughout the process.

---

## Next Steps

1. Review and approve this plan
2. Prioritize features for MVP
3. Set up development environment
4. Begin Phase 1 implementation
5. Establish testing framework
6. Create user documentation
7. Plan beta testing program
8. Prepare for launch

---

**Document Version:** 1.0  
**Last Updated:** 2026-05-30  
**Status:** Draft for Review