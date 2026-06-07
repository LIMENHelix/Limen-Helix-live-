/**
 * markdown-to-docx.js — render a Markdown doc into a 12-point DOCX buffer.
 *
 * Designed for filing-grade output: Times New Roman 12pt body, page-break
 * after major sections, double-line spacing on body paragraphs, single-line
 * headings, 1-inch margins. Returns a Buffer ready to write to disk or
 * pipe to an HTTP response.
 */
const { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, PageBreak } = require('docx');

const FONT = 'Times New Roman';
const BODY_SIZE = 24;   // half-points → 12pt
const H1_SIZE = 32;     // 16pt
const H2_SIZE = 28;     // 14pt
const H3_SIZE = 26;     // 13pt
const MONO_FONT = 'Courier New';

function _runs(text, opts) {
  opts = opts || {};
  return [new TextRun({ text: text, font: opts.font || FONT, size: opts.size || BODY_SIZE, bold: !!opts.bold, italics: !!opts.italics })];
}

function _parsePara(line) {
  // Inline bold/italic — minimal support: **bold** and *italic*
  const out = [];
  const re = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g;
  let last = 0, m;
  while ((m = re.exec(line)) !== null) {
    if (m.index > last) out.push(new TextRun({ text: line.slice(last, m.index), font: FONT, size: BODY_SIZE }));
    const t = m[0];
    if (t.startsWith('**')) out.push(new TextRun({ text: t.slice(2, -2), font: FONT, size: BODY_SIZE, bold: true }));
    else if (t.startsWith('`')) out.push(new TextRun({ text: t.slice(1, -1), font: MONO_FONT, size: BODY_SIZE - 2 }));
    else out.push(new TextRun({ text: t.slice(1, -1), font: FONT, size: BODY_SIZE, italics: true }));
    last = m.index + t.length;
  }
  if (last < line.length) out.push(new TextRun({ text: line.slice(last), font: FONT, size: BODY_SIZE }));
  return out.length ? out : [new TextRun({ text: line || '', font: FONT, size: BODY_SIZE })];
}

function _renderMarkdown(md) {
  // Pre-clean: drop wrapper code fences if Claude returned ```markdown ... ```
  md = String(md || '').trim();
  if (md.startsWith('```')) md = md.replace(/^```[a-z]*\n/, '').replace(/\n```\s*$/, '');

  const paragraphs = [];
  const lines = md.split(/\r?\n/);
  let inCode = false, codeBuf = [];
  let prevWasHeading = false;

  function flushCode() {
    if (codeBuf.length === 0) return;
    for (const cl of codeBuf) {
      paragraphs.push(new Paragraph({
        children: [new TextRun({ text: cl, font: MONO_FONT, size: BODY_SIZE - 2 })],
        spacing: { line: 240, before: 0, after: 0 }
      }));
    }
    codeBuf = [];
  }

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];

    // Code fence
    if (/^```/.test(line)) {
      if (inCode) { flushCode(); inCode = false; }
      else inCode = true;
      continue;
    }
    if (inCode) { codeBuf.push(line); continue; }

    // Page break for major H1 sections (every # ABSTRACT, # CLAIMS, etc.)
    if (/^# /.test(line) && paragraphs.length > 0 && !prevWasHeading) {
      paragraphs.push(new Paragraph({ children: [new PageBreak()] }));
    }

    // Headings
    if (/^### /.test(line)) {
      paragraphs.push(new Paragraph({
        children: [new TextRun({ text: line.replace(/^### /, ''), font: FONT, size: H3_SIZE, bold: true })],
        spacing: { before: 240, after: 120 }, heading: HeadingLevel.HEADING_3
      }));
      prevWasHeading = true;
      continue;
    }
    if (/^## /.test(line)) {
      paragraphs.push(new Paragraph({
        children: [new TextRun({ text: line.replace(/^## /, ''), font: FONT, size: H2_SIZE, bold: true })],
        spacing: { before: 320, after: 160 }, heading: HeadingLevel.HEADING_2
      }));
      prevWasHeading = true;
      continue;
    }
    if (/^# /.test(line)) {
      paragraphs.push(new Paragraph({
        children: [new TextRun({ text: line.replace(/^# /, ''), font: FONT, size: H1_SIZE, bold: true })],
        spacing: { before: 360, after: 240 }, heading: HeadingLevel.HEADING_1,
        alignment: AlignmentType.LEFT
      }));
      prevWasHeading = true;
      continue;
    }

    // Bullet
    if (/^\s*[-*]\s+/.test(line)) {
      paragraphs.push(new Paragraph({
        children: _parsePara(line.replace(/^\s*[-*]\s+/, '')),
        bullet: { level: 0 }, spacing: { line: 360, before: 0, after: 80 }
      }));
      prevWasHeading = false;
      continue;
    }
    // Numbered list
    if (/^\s*\d+\.\s+/.test(line)) {
      paragraphs.push(new Paragraph({
        children: _parsePara(line.replace(/^\s*\d+\.\s+/, '')),
        numbering: { reference: 'numbered-list', level: 0 },
        spacing: { line: 360, before: 0, after: 80 }
      }));
      prevWasHeading = false;
      continue;
    }

    // Blank
    if (line.trim() === '') {
      paragraphs.push(new Paragraph({ children: [new TextRun({ text: '' })] }));
      continue;
    }

    // Body paragraph — double-spaced 360 (line) = 1.5x ; for double use 480
    paragraphs.push(new Paragraph({
      children: _parsePara(line),
      spacing: { line: 360, before: 0, after: 120 },
      alignment: AlignmentType.JUSTIFIED
    }));
    prevWasHeading = false;
  }
  flushCode();
  return paragraphs;
}

async function renderToBuffer(markdown, opts) {
  opts = opts || {};
  const children = _renderMarkdown(markdown);
  const doc = new Document({
    creator: 'LIMEN Helix',
    title: opts.title || 'LIMEN Helix Document',
    subject: opts.subject || 'Filing-ready artifact',
    description: opts.description || 'Generated by LIMEN Helix engine lanes',
    styles: { default: { document: { run: { font: FONT, size: BODY_SIZE } } } },
    sections: [{
      properties: {
        page: {
          margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 }   // 1 inch margins (1440 twips)
        }
      },
      children
    }]
  });
  return await Packer.toBuffer(doc);
}

module.exports = { renderToBuffer };
