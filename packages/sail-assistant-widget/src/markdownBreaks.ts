/**
 * remark plugin (1.0.1, 19-Oct-2026): the assistant sometimes writes `<br>` inside Markdown table cells (a table cell
 * cannot hold a newline). The widget never renders raw HTML, so those showed as literal "<br>" text. This turns ONLY an
 * inline HTML node that is exactly a <br> tag (`<br>`, `<br/>`, `<br />`, any case) into a Markdown line break.
 * Every other HTML stays as it was: escaped text, never markup.
 */
type MdNode = { type: string; value?: string; children?: MdNode[] };

const BR = /^<br\s*\/?>$/i;

function walk(node: MdNode): void {
  if (!node.children) return;
  node.children = node.children.map((c) => (c.type === 'html' && typeof c.value === 'string' && BR.test(c.value.trim()) ? { type: 'break' } : c));
  for (const c of node.children) walk(c);
}

export function remarkBrToBreak() {
  return (tree: MdNode) => walk(tree);
}
