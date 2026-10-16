"""Shared typography and flowable construction for the bilingual manuals."""
from __future__ import annotations

import html
import re
from pathlib import Path

from PIL import Image as PillowImage
from reportlab.lib import colors
from reportlab.lib.styles import ParagraphStyle
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import Image, Paragraph, Spacer, Table, TableStyle, XPreformatted

INK = colors.HexColor('#243d42')
MUTED = colors.HexColor('#627579')
ACCENT = colors.HexColor('#167c70')
PALE = colors.HexColor('#edf5f3')
LINE = colors.HexColor('#d9e4e2')
DARK = colors.HexColor('#142d32')


def register_fonts(folder: Path):
    for name, file in [('Guide', 'msyh.ttc'), ('Guide-Bold', 'msyhbd.ttc'), ('Mono', 'consola.ttf')]:
        pdfmetrics.registerFont(TTFont(name, str(folder / file), subfontIndex=0))
    pdfmetrics.registerFontFamily('Guide', normal='Guide', bold='Guide-Bold', italic='Guide', boldItalic='Guide-Bold')


def markup(text: str) -> str:
    """Escape literal YAML/MiniMessage before enabling a small Markdown subset."""
    value = html.escape(text).replace('\n', '<br/>')
    value = re.sub(r'\[([^\]]+)\]\((https?://[^)]+)\)', r'<a href="\2" color="#167c70"><u>\1</u></a>', value)
    value = re.sub(r'\*\*(.+?)\*\*', r'<b>\1</b>', value)
    value = re.sub(r'`([^`]+)`', r'<font color="#167c70">\1</font>', value)
    return value


class ManualStyles:
    def __init__(self, language: int, root: Path, width: float):
        self.language, self.root, self.width = language, root, width
        wrap = 'CJK' if language == 0 else None
        self.body = ParagraphStyle('body', fontName='Guide', fontSize=10.1, leading=15.2,
                                   textColor=INK, wordWrap=wrap, splitLongWords=True)
        self.cell = ParagraphStyle('cell', parent=self.body, fontSize=9.3, leading=13.7)
        self.small = ParagraphStyle('small', parent=self.body, fontSize=8.3, leading=12, textColor=MUTED)
        self.title = ParagraphStyle('title', parent=self.body, fontName='Guide-Bold', fontSize=21, leading=29)
        self.callout_title = ParagraphStyle('callout-title', parent=self.body, fontName='Guide-Bold', textColor=ACCENT)

    def pick(self, values):
        return values[self.language]

    def para(self, value, style=None):
        return Paragraph(markup(value), style or self.body)

    def blocks(self, blocks):
        result = []
        for block in blocks:
            kind = block['kind']
            if kind == 'p':
                result.append(self.para(self.pick(block['text'])))
            elif kind == 'steps':
                for number, pair in enumerate(block['items'], 1):
                    row = Table([[self.para(f'**{number:02d}**', self.callout_title), self.para(self.pick(pair))]],
                                colWidths=[27, self.width - 27])
                    row.setStyle(TableStyle([('VALIGN', (0, 0), (-1, -1), 'TOP'),
                                             ('LEFTPADDING', (0, 0), (-1, -1), 0),
                                             ('RIGHTPADDING', (0, 0), (-1, -1), 8),
                                             ('TOPPADDING', (0, 0), (-1, -1), 0),
                                             ('BOTTOMPADDING', (0, 0), (-1, -1), 8)]))
                    result.append(row)
            elif kind == 'table':
                headers = self.pick(block['headers'])
                count = len(headers)
                ratios = [0.32, 0.68] if count == 2 else [0.21, 0.46, 0.33]
                data = [[self.para('**' + h + '**', self.cell) for h in headers]]
                data += [[self.para(c, self.cell) for c in self.pick(row)] for row in block['rows']]
                table = Table(data, colWidths=[self.width * r for r in ratios], hAlign='LEFT')
                table.setStyle(TableStyle([
                    ('VALIGN', (0, 0), (-1, -1), 'TOP'), ('BACKGROUND', (0, 0), (-1, 0), PALE),
                    ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#f8faf9')]),
                    ('LINEBELOW', (0, 0), (-1, -1), 0.4, LINE),
                    ('LEFTPADDING', (0, 0), (-1, -1), 10), ('RIGHTPADDING', (0, 0), (-1, -1), 10),
                    ('TOPPADDING', (0, 0), (-1, -1), 8), ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
                ]))
                result.append(table)
            elif kind == 'callout':
                table = Table([[self.para(self.pick(block['title']), self.callout_title)],
                               [self.para(self.pick(block['text']), self.cell)]], colWidths=[self.width])
                table.setStyle(TableStyle([
                    ('BACKGROUND', (0, 0), (-1, -1), PALE), ('LINEBEFORE', (0, 0), (0, -1), 2.5, ACCENT),
                    ('LEFTPADDING', (0, 0), (-1, -1), 13), ('RIGHTPADDING', (0, 0), (-1, -1), 13),
                    ('TOPPADDING', (0, 0), (-1, 0), 10), ('BOTTOMPADDING', (0, 0), (-1, 0), 2),
                    ('TOPPADDING', (0, 1), (-1, 1), 0), ('BOTTOMPADDING', (0, 1), (-1, 1), 10),
                ]))
                result.append(table)
            elif kind == 'figure':
                path = self.root / 'assets' / block['file']
                with PillowImage.open(path) as source:
                    width, height = source.size
                scale = min(self.width / width, block['height'] / height)
                graphic = Image(str(path), width=width * scale, height=height * scale)
                graphic.hAlign = 'CENTER'
                result += [graphic, Spacer(1, 5), self.para(self.pick(block['caption']), self.small)]
            elif kind in ('code', 'codefile'):
                raw = (self.root / block['file']).read_text(encoding='utf-8').rstrip() if kind == 'codefile' else self.pick(block['text'])
                font = 'Guide' if any(ord(c) > 127 for c in raw) else 'Mono'
                size = block.get('font', 9)
                style = ParagraphStyle('code', fontName=font, fontSize=size, leading=size * 1.26, textColor=INK)
                code = XPreformatted(html.escape(raw), style)
                table = Table([[code]], colWidths=[self.width])
                table.setStyle(TableStyle([
                    ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#f3f6f5')),
                    ('BOX', (0, 0), (-1, -1), 0.6, LINE),
                    ('LEFTPADDING', (0, 0), (-1, -1), 12), ('RIGHTPADDING', (0, 0), (-1, -1), 12),
                    ('TOPPADDING', (0, 0), (-1, -1), 10), ('BOTTOMPADDING', (0, 0), (-1, -1), 10),
                ]))
                result.append(table)
            elif kind == 'flow':
                values = self.pick(block['items'])
                cells = [self.para(f'**{i + 1:02d}**\n{value}', self.cell) for i, value in enumerate(values)]
                table = Table([cells], colWidths=[self.width / len(values)] * len(values))
                table.setStyle(TableStyle([
                    ('BACKGROUND', (0, 0), (-1, -1), PALE), ('VALIGN', (0, 0), (-1, -1), 'TOP'),
                    ('LINEAFTER', (0, 0), (-2, 0), 2, colors.white),
                    ('TOPPADDING', (0, 0), (-1, -1), 9), ('BOTTOMPADDING', (0, 0), (-1, -1), 9),
                    ('LEFTPADDING', (0, 0), (-1, -1), 9), ('RIGHTPADDING', (0, 0), (-1, -1), 7),
                ]))
                result.append(table)
            else:
                raise ValueError(f'Unknown block kind: {kind}')
            result.append(Spacer(1, 11))
        return result[:-1]
