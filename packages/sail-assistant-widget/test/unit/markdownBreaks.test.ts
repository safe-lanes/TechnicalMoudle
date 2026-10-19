// 1.0.1 (19-Oct-2026): <br> inside Markdown (table cells) renders as a line break; no other HTML is ever rendered.
import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { remarkBrToBreak } from '../../src/markdownBreaks';

const html = (md: string) => renderToStaticMarkup(createElement(ReactMarkdown, { remarkPlugins: [remarkGfm, remarkBrToBreak] }, md)).replace(/\n/g, '');

describe('remarkBrToBreak', () => {
  it('turns <br>, <br/>, <BR /> in a table cell into real line breaks', () => {
    const out = html('| Step | Action |\n|---|---|\n| 1 | Open<br>Click **Save**<br/>Done<BR /> |');
    expect(out).toContain('<td>Open<br/>Click <strong>Save</strong><br/>Done<br/></td>');
    expect(out).not.toContain('&lt;br');
  });

  it('every other HTML stays escaped text (never markup)', () => {
    const out = html('a <b>bold</b> <img src=x onerror=alert(1)> <br onclick="x"> <script>x</script>');
    expect(out).not.toMatch(/<b>|<img|<script|<br onclick/);
    expect(out).toContain('&lt;b&gt;');
  });

  it('without the plugin the old behaviour shows literal <br> (instrument check)', () => {
    const plain = renderToStaticMarkup(createElement(ReactMarkdown, { remarkPlugins: [remarkGfm] }, '| a |\n|---|\n| x<br>y |'));
    expect(plain).toContain('&lt;br&gt;');
  });
});
