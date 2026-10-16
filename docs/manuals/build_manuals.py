"""Build the checked-in bilingual PDFs and tutorial archive from current content."""
from __future__ import annotations

import argparse
import hashlib
import json
import math
import zipfile
from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.utils import ImageReader
from reportlab.pdfgen import canvas

from pdf_styles import ACCENT, DARK, INK, LINE, MUTED, ManualStyles, register_fonts

ROOT = Path(__file__).resolve().parent
REPO = ROOT.parent.parent
WIDTH, HEIGHT = A4
MARGIN = 43
CONTENT_WIDTH = WIDTH - 2 * MARGIN
EDITION_DATE = '2026-10-17'


def header(pdf, version, section, page_number, total):
    pdf.setFillColor(MUTED)
    pdf.setFont('Guide', 8)
    pdf.drawString(MARGIN, HEIGHT - 31, 'FUTUREUI STUDIO / USER GUIDE')
    pdf.drawRightString(WIDTH - MARGIN, HEIGHT - 31, f'v{version}')
    pdf.setStrokeColor(LINE)
    pdf.setLineWidth(0.6)
    pdf.line(MARGIN, HEIGHT - 42, WIDTH - MARGIN, HEIGHT - 42)
    pdf.line(MARGIN, 46, WIDTH - MARGIN, 46)
    pdf.setFillColor(MUTED)
    pdf.setFont('Guide', 7.5)
    pdf.drawString(MARGIN, 29, section)
    pdf.drawRightString(WIDTH - MARGIN, 29, f'{page_number:02d} / {total:02d}')


def cover(pdf, version, language):
    pdf.bookmarkPage('cover')
    pdf.addOutlineEntry('使用手册' if language == 0 else 'User guide', 'cover')
    pdf.setFillColor(DARK)
    pdf.rect(0, 0, WIDTH, HEIGHT, fill=1, stroke=0)
    pdf.setFillColor(colors.HexColor('#203e42'))
    for column, count in enumerate([3, 6, 4, 8, 5, 7, 3]):
        for row in range(count):
            pdf.rect(WIDTH - 204 + column * 23, 82 + row * 23, 18, 18, fill=1, stroke=0)
    logo = ImageReader(str(REPO / 'resources/branding/icon.png'))
    pdf.drawImage(logo, MARGIN - 5, HEIGHT - 172, 110, 110, mask='auto')
    pdf.setFillColor(colors.HexColor('#9ed2c7'))
    pdf.setFont('Guide', 10)
    pdf.drawString(MARGIN, HEIGHT - 208, 'DESIGN / CONFIGURATION / AI ASSISTANCE')
    pdf.setFillColor(colors.white)
    pdf.setFont('Guide-Bold', 31)
    pdf.drawString(MARGIN, HEIGHT - 268, 'FutureUI')
    pdf.drawString(MARGIN, HEIGHT - 309, 'Studio')
    pdf.setFont('Guide-Bold', 27 if language == 0 else 26)
    pdf.drawString(MARGIN, HEIGHT - 380, '使用手册' if language == 0 else 'User guide')
    pdf.setFillColor(colors.HexColor('#c3d9d6'))
    pdf.setFont('Guide', 13)
    lines = ['从第一个菜单，到 AI 辅助创作与发布', '图解步骤 · 练习配置 · 操作回退'] if language == 0 else [
        'From your first menu to AI-assisted creation', 'Illustrated steps, practice files and restore points']
    for index, line in enumerate(lines):
        pdf.drawString(MARGIN, HEIGHT - 416 - index * 25, line)
    pdf.setFillColor(colors.HexColor('#74b8a7'))
    pdf.rect(MARGIN, 263, 52, 4, fill=1, stroke=0)
    pdf.setFont('Guide', 11)
    pdf.setFillColor(colors.white)
    pdf.drawString(MARGIN, 233, f'WINDOWS x64  /  VERSION {version}')
    pdf.setFont('Guide', 10)
    pdf.setFillColor(colors.HexColor('#a7bfbc'))
    pdf.drawString(MARGIN, 208, '简体中文 · 逐步入门版' if language == 0 else 'ENGLISH / Step-by-step edition')
    pdf.drawString(MARGIN, 93, f'FOTIA  /  {EDITION_DATE}')
    pdf.setFont('Guide', 8.5)
    pdf.drawString(MARGIN, 71, 'github.com/Ti-Avanti/FutureUI-Studio')
    pdf.linkURL('https://github.com/Ti-Avanti/FutureUI-Studio', (MARGIN, 65, 350, 84), relative=0)
    pdf.showPage()


def contents(pdf, version, pages, language, total):
    styles = ManualStyles(language, ROOT, CONTENT_WIDTH)
    header(pdf, version, '使用导航' if language == 0 else 'CONTENTS', 2, total)
    pdf.bookmarkPage('contents')
    pdf.addOutlineEntry('目录' if language == 0 else 'Contents', 'contents')
    pdf.setFillColor(INK)
    pdf.setFont('Guide-Bold', 23)
    pdf.drawString(MARGIN, HEIGHT - 85, '按步骤开始，也能随时查阅' if language == 0 else 'Start here. Return when you need it.')
    note = ('点击条目可跳转。英文按钮含义可参考英文版；两版步骤与页码一致。' if language == 0 else
            'Click any entry to jump. Chinese UI labels are retained with English explanations. Both editions use the same page numbers.')
    p = styles.para(note, styles.small)
    _, h = p.wrap(CONTENT_WIDTH, 100)
    p.drawOn(pdf, MARGIN, HEIGHT - 109 - h)
    half = math.ceil(len(pages) / 2)
    col_width = (CONTENT_WIDTH - 28) / 2
    toc_style = ParagraphStyle('toc', parent=styles.body, fontSize=9.5, leading=13.5)
    for index, item in enumerate(pages):
        column, row = divmod(index, half)
        x, y = MARGIN + column * (col_width + 28), HEIGHT - 170 - row * 39
        title = item['title'][language]
        label = styles.para(title, toc_style)
        _, height = label.wrap(col_width - 31, 38)
        if height > 37:
            raise ValueError(f'TOC label too tall: {title}')
        label.drawOn(pdf, x, y - height)
        pdf.setFillColor(ACCENT)
        pdf.setFont('Guide-Bold', 9)
        pdf.drawRightString(x + col_width, y - 11, f'{index + 3:02d}')
        pdf.setStrokeColor(LINE)
        pdf.line(x, y - 34, x + col_width, y - 34)
        pdf.linkRect('', item['id'], (x, y - 34, x + col_width, y + 3), relative=0, thickness=0)
    pdf.showPage()


def content_page(pdf, version, item, language, number, total):
    styles = ManualStyles(language, ROOT, CONTENT_WIDTH)
    section, title = item['section'][language], item['title'][language]
    header(pdf, version, section, number, total)
    pdf.bookmarkPage(item['id'])
    pdf.addOutlineEntry(title, item['id'])
    pdf.setFillColor(ACCENT)
    pdf.setFont('Guide-Bold', 8.5)
    pdf.drawString(MARGIN, HEIGHT - 68, section)
    title_para = styles.para(title, styles.title)
    _, title_height = title_para.wrap(CONTENT_WIDTH, 100)
    title_para.drawOn(pdf, MARGIN, HEIGHT - 83 - title_height)
    y = HEIGHT - 83 - title_height - 18
    elements = styles.blocks(item['blocks'])
    sizes = [element.wrap(CONTENT_WIDTH, HEIGHT) for element in elements]
    needed = sum(height for _, height in sizes)
    available = y - 62
    if needed > available:
        raise ValueError(f'Page {number} ({item["id"]}, language {language}): needs {needed:.1f} pt, has {available:.1f}; edit content or figures')
    for element, (width, height) in zip(elements, sizes):
        x = MARGIN + (CONTENT_WIDTH - width) / 2 if getattr(element, 'hAlign', None) == 'CENTER' else MARGIN
        y -= height
        element.drawOn(pdf, x, y)
    pdf.showPage()
    return {'page': number, 'id': item['id'], 'used_points': round(needed, 1), 'available_points': round(available, 1)}


def tutorial_archive():
    target = ROOT / 'FutureUI-Studio-Tutorial-Examples.zip'
    with zipfile.ZipFile(target, 'w', compression=zipfile.ZIP_DEFLATED) as archive:
        for file in sorted((ROOT / 'examples').rglob('*.yml')):
            info = zipfile.ZipInfo(file.relative_to(ROOT / 'examples').as_posix(), (2026, 10, 16, 0, 0, 0))
            info.compress_type = zipfile.ZIP_DEFLATED
            archive.writestr(info, file.read_bytes())
    return target


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--font-dir', type=Path, default=Path('C:/Windows/Fonts'))
    args = parser.parse_args()
    register_fonts(args.font_dir)
    version = json.loads((REPO / 'package.json').read_text(encoding='utf-8'))['version']
    pages = []
    for file in sorted((ROOT / 'content').glob('*.json')):
        pages.extend(json.loads(file.read_text(encoding='utf-8')))
    ids = [item['id'] for item in pages]
    if len(set(ids)) != len(ids):
        raise ValueError('Duplicate page IDs')
    total, outputs, layouts = len(pages) + 2, [], {}
    for language, locale in enumerate(['zh-CN', 'en']):
        target = ROOT / f'FutureUI-Studio-Guide-{locale}.pdf'
        pdf = canvas.Canvas(str(target), pagesize=A4, pageCompression=1, invariant=1)
        pdf.setTitle(f'FutureUI Studio {version} - ' + ('使用手册' if language == 0 else 'User Guide'))
        pdf.setAuthor('Fotia / FutureUI Studio')
        pdf.setSubject('Step-by-step editor, configuration and Agent manual')
        pdf.setViewerPreference('DisplayDocTitle', 'true')
        cover(pdf, version, language)
        contents(pdf, version, pages, language, total)
        layouts[locale] = [content_page(pdf, version, item, language, index + 3, total) for index, item in enumerate(pages)]
        pdf.save()
        outputs.append(target)
        print(f'{target.name}: {total} pages / {target.stat().st_size:,} bytes')
    outputs.append(tutorial_archive())
    manifest = {'version': version, 'edition_date': EDITION_DATE, 'pages_per_manual': total,
                'files': [{'name': path.name, 'sha256': hashlib.sha256(path.read_bytes()).hexdigest(), 'bytes': path.stat().st_size} for path in outputs]}
    (ROOT / 'manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    qa = REPO / 'artifacts/manuals'
    qa.mkdir(parents=True, exist_ok=True)
    (qa / 'layout.json').write_text(json.dumps(layouts, indent=2) + '\n', encoding='utf-8')


if __name__ == '__main__':
    main()
