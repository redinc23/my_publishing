# WAW v7.0.3 PRODUCTION - User Guide

**Version:** 7.0.3 PRODUCTION  
**Release Date:** May 31, 2026  
**Status:** ✅ PRODUCTION READY  

---

## What's New in v7.0.3 PRODUCTION

### Critical Improvements

1. **Enhanced Font Fallback System**
   - Expanded fallback chain: Minion Pro → Adobe Garamond Pro → Garamond → Times New Roman → Georgia
   - Last-resort: Uses first available font instead of failing
   - Pre-flight font validation with user warning

2. **Pre-Flight Validation**
   - Checks font availability before starting
   - Shows available fonts if preferred font missing
   - User confirmation before proceeding with fallback

3. **Improved Error Handling**
   - Detailed error messages with line numbers
   - Clear troubleshooting steps
   - Common causes listed in error dialog

4. **Better Emergency Save**
   - Timestamped emergency files (no overwriting)
   - Success confirmation dialog
   - Failure warnings with specific error details

5. **Enhanced User Communication**
   - Updated welcome dialog with backup reminder
   - Version number in dialog (7.0.3 PRODUCTION)
   - Clearer prerequisite instructions

---

## Quick Start Guide

### Prerequisites

**Required:**
- Adobe InDesign CC 2015 or later
- Your manuscript in .docx format with proper styles:
  - Heading 1 (for chapter titles)
  - Heading 2 (for section titles)
  - Normal (for body text)
  - Caption (for image captions)
  - Centered (for centered text)
  - No Indent (for paragraphs without indent)

**Recommended:**
- All images in a single folder
- Image naming: `ch01_description.jpg`, `ch02_description.png`, etc.
- Backup of your manuscript
- At least 2GB free disk space

**Optional:**
- Minion Pro font family (or similar serif font)
- Custom configuration JSON file

---

## Step-by-Step Instructions

### 1. Prepare Your Files

```
Project Folder/
├── manuscript.docx          (Your Word document)
├── images/                  (All your images)
│   ├── ch01_intro.jpg
│   ├── ch02_diagram.png
│   └── ...
└── output/                  (Will be created automatically)
```

### 2. Launch InDesign

- Open Adobe InDesign
- Close any open documents (recommended)
- Save any work in progress

### 3. Run the Script

**Method 1: File Menu**
1. File > Scripts > Other Script...
2. Navigate to `WAW_v7_Standalone_FLAWLESS.jsx`
3. Click Open

**Method 2: Scripts Panel**
1. Window > Utilities > Scripts
2. Right-click User folder
3. Select "Reveal in Finder/Explorer"
4. Copy script to User folder
5. Double-click script in Scripts panel

### 4. Follow the Prompts

**Font Check (if needed):**
- If your preferred font is missing, you'll see a warning
- Review available fonts
- Click OK to continue with fallback, or Cancel to stop

**Welcome Dialog:**
- Review the 10-step process
- Confirm prerequisites are ready
- Click OK to proceed

**Close Documents (if any open):**
- Recommended to close other documents
- Click Yes to close, No to keep open

**Select Manuscript:**
- Browse to your .docx file
- Click Open

**Select Image Folder:**
- Browse to your images folder
- Click Select Folder

### 5. Monitor Progress

- Progress window shows current step
- 12 steps total
- Typical duration: 2-10 minutes depending on book size

### 6. Review Results

**Success Dialog shows:**
- Total duration
- Page count
- Images placed/missing
- Preflight status
- Output folder location

**Output Files:**
```
~/Desktop/WeAreWolf_Output/
├── WeAreWolf_2026-05-31_14-30-22.indd    (InDesign document)
├── WeAreWolf_2026-05-31_14-30-22_print.pdf
├── WeAreWolf_2026-05-31_14-30-22.idml    (Backup format)
├── WeAreWolf_2026-05-31_14-30-22.epub    (Digital version)
├── WeAreWolf_Report_2026-05-31_14-30-22.html
├── WeAreWolf_Report_2026-05-31_14-30-22.txt
├── WeAreWolf_Log_2026-05-31_14-30-22.json
└── WeAreWolf_Package/                     (Print handoff folder)
```

---

## Post-Automation Checklist

### Immediate Review (Required)

- [ ] Open the PDF and review visually
- [ ] Check that all images appear correctly
- [ ] Verify chapter titles are on right-hand pages
- [ ] Review Table of Contents accuracy
- [ ] Check front matter page numbering (roman numerals)
- [ ] Verify body page numbering (arabic numerals)

### Typography Polish (Recommended)

- [ ] Layout > Table of Contents > Update Table of Contents
- [ ] Type > Show Hidden Characters (check for extra spaces)
- [ ] Review widow/orphan control
- [ ] Check hyphenation (especially proper nouns)
- [ ] Verify running headers on each page
- [ ] Review drop caps on chapter openers

### Pre-Print Verification (Critical)

- [ ] Window > Output > Preflight (run InDesign's built-in preflight)
- [ ] Check all images are 300+ PPI
- [ ] Verify no missing fonts
- [ ] Confirm no missing links
- [ ] Check for overset text
- [ ] Review color space (CMYK for print, RGB for digital)

### Final Steps

- [ ] File > Package (for print handoff)
- [ ] Include fonts and links
- [ ] Add instructions for printer
- [ ] Create backup copy
- [ ] Archive source files

---

## Troubleshooting

### Common Issues

#### "Font not found" Warning

**Problem:** Preferred font (Minion Pro) not installed  
**Solution:** 
- Script will use best available fallback
- Install Minion Pro for optimal results
- Or edit config to use installed font

#### "Manuscript import failed"

**Problem:** .docx file corrupted or incompatible  
**Solution:**
- Open in Word and re-save
- Check for special characters in filename
- Ensure file is not password-protected
- Try exporting from Word as .docx (not .doc)

#### "Images not found"

**Problem:** Image filenames don't match placeholders  
**Solution:**
- Check image naming: `[IMAGE:ch01_intro]` needs `ch01_intro.jpg`
- Ensure all images in selected folder
- Check file extensions (.jpg, .png, .tif, etc.)
- Review log file for specific missing images

#### "Overset text" Warning

**Problem:** Text doesn't fit in allocated space  
**Solution:**
- Add pages manually
- Adjust margins or font size
- Edit content to reduce length
- Check for large images pushing text

#### "Emergency save" Dialog

**Problem:** Script encountered fatal error  
**Solution:**
- Note the error message
- Check emergency save file location
- Review log file for details
- Contact support with error details

### Error Messages Explained

**"Configuration failed to load"**
- Config file corrupted or missing
- Script will use defaults
- Check JSON syntax if using custom config

**"Document creation failed"**
- InDesign version incompatibility
- Insufficient memory
- Restart InDesign and try again

**"Style remapping incomplete"**
- Word styles don't match expected names
- Manual style application may be needed
- Check manuscript uses correct style names

**"PDF export failed"**
- No PDF presets available
- Disk space insufficient
- Check InDesign PDF export settings

---

## Advanced Configuration

### Custom Config File (Optional)

Create `WAW_config.json` in same folder as script:

```json
{
  "pageWidth": "6 in",
  "pageHeight": "9 in",
  "bodyFontFamily": "Garamond",
  "bodyFontSize": "11 pt",
  "bodyLeading": "14 pt",
  "heading1FontSize": "24 pt",
  "exportDir": "~/Documents/BookOutput/",
  "imageResolution": 300
}
```

### Supported Fonts

**Recommended Serif Fonts:**
- Minion Pro (default)
- Adobe Garamond Pro
- Garamond
- Adobe Caslon Pro
- Baskerville

**Fallback Chain:**
1. Minion Pro
2. Adobe Garamond Pro
3. Garamond
4. Times New Roman
5. Georgia
6. First available font

### Image Formats Supported

- JPEG (.jpg, .jpeg)
- PNG (.png)
- TIFF (.tif, .tiff)
- Photoshop (.psd)
- EPS (.eps)
- PDF (.pdf)
- GIF (.gif)
- BMP (.bmp)

---

## Performance Guidelines

### Expected Processing Times

| Book Size | Pages | Images | Duration |
|-----------|-------|--------|----------|
| Small | 50-100 | 5-10 | 2-3 min |
| Medium | 100-300 | 10-50 | 5-8 min |
| Large | 300-500 | 50-100 | 10-15 min |
| Very Large | 500+ | 100+ | 15-30 min |

### System Requirements

**Minimum:**
- 4GB RAM
- 2GB free disk space
- InDesign CC 2015

**Recommended:**
- 8GB+ RAM
- 5GB+ free disk space
- InDesign CC 2020 or later
- SSD storage

---

## Support & Resources

### Log Files

All operations logged to:
- `WeAreWolf_Log_[timestamp].json` (machine-readable)
- `WeAreWolf_Report_[timestamp].txt` (human-readable)
- `WeAreWolf_Report_[timestamp].html` (formatted report)

### Getting Help

**Before contacting support:**
1. Check this guide's Troubleshooting section
2. Review the error message carefully
3. Check the log files
4. Try with a smaller test document

**When reporting issues, include:**
- Error message (exact text)
- Log file (JSON or TXT)
- InDesign version
- Operating system
- Book size (pages, images)
- Steps to reproduce

---

## Best Practices

### Manuscript Preparation

1. **Use consistent styles** - Don't mix manual formatting with styles
2. **Clean up before export** - Remove comments, track changes
3. **Test with sample** - Try 10-20 pages first
4. **Backup everything** - Keep original files safe
5. **Name images clearly** - Use descriptive, consistent names

### Workflow Tips

1. **Start small** - Test with one chapter first
2. **Review incrementally** - Check each section as it's created
3. **Save often** - InDesign auto-save recommended
4. **Use version control** - Keep dated backups
5. **Document changes** - Note any manual adjustments

### Quality Control

1. **Print test pages** - Check actual output
2. **Review on different devices** - PDF on tablet/phone
3. **Get second opinion** - Fresh eyes catch errors
4. **Check against original** - Verify content accuracy
5. **Test all links** - Hyperlinks, cross-references

---

## Changelog

### v7.0.3 PRODUCTION (May 31, 2026)
- ✅ Enhanced font fallback system
- ✅ Pre-flight font validation
- ✅ Improved error messages
- ✅ Better emergency save with timestamps
- ✅ Updated user dialogs
- ✅ Production-ready status

### v7.0.2 (May 2026)
- Fixed standalone startup config loading
- Added legacy config aliases
- Corrected HTML report syntax
- Fixed SaveOptions casing
- ES3 compatibility improvements

### v7.0.1 (May 2026)
- Fixed image placement crash
- Corrected optical margin size
- Fixed caption frame height

### v7.0.0 (May 2026)
- Complete modular rewrite
- 50+ configuration options
- Enhanced preflight system
- EPUB export support
- Document packaging
- HTML reporting

---

## License & Credits

**We Are Wolf InDesign Automation v7.0.3**  
© 2026 We Are Wolf  
Licensed under MIT License

**Built with:**
- Adobe InDesign ExtendScript API
- ES3 JavaScript compatibility
- Tested on InDesign CC 2015-2024

---

## Quick Reference Card

### Essential Keyboard Shortcuts (InDesign)

- `Cmd/Ctrl + D` - Place image
- `Cmd/Ctrl + E` - Export
- `Cmd/Ctrl + Shift + P` - Package
- `Cmd/Ctrl + Alt + Shift + I` - Preflight panel
- `Cmd/Ctrl + Alt + I` - Show hidden characters

### Script Locations

**Mac:**
- User: `~/Library/Preferences/Adobe InDesign/[Version]/[Language]/Scripts/Scripts Panel/`
- App: `/Applications/Adobe InDesign [Version]/Scripts/Scripts Panel/`

**Windows:**
- User: `C:\Users\[Username]\AppData\Roaming\Adobe\InDesign\[Version]\[Language]\Scripts\Scripts Panel\`
- App: `C:\Program Files\Adobe\Adobe InDesign [Version]\Scripts\Scripts Panel\`

---

**Ready to automate your book production? Let's go! 🚀**