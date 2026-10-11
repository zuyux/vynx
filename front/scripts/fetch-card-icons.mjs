// Development-only asset generation. Run: node --env-file=.env.local scripts/fetch-card-icons.mjs
import { writeFile } from 'node:fs/promises';
if (!process.env.ICONSAX_MCP_KEY) throw new Error('Set ICONSAX_MCP_KEY locally.');
const icons = { Instagram: 'instagram', Youtube: 'youtube', Save: 'document-download', UserRound: 'user', Link2: 'link', Monitor: 'monitor', Smartphone: 'mobile', ImagePlus: 'gallery-add', ArrowUp: 'arrow-up', ArrowDown: 'arrow-down', Trash2: 'trash', Eye: 'eye', Plus: 'add', Check: 'tick-circle' };
let output = '// Iconsax assets fetched through its authenticated MCP; no runtime credentials required.\nimport type { SVGProps } from "react";\ntype Props = SVGProps<SVGSVGElement> & { size?: number };\n';
for (const [component, name] of Object.entries(icons)) {
  const response = await fetch('https://app.iconsax.io/api/mcp', { method: 'POST', headers: { Authorization: `Bearer ${process.env.ICONSAX_MCP_KEY}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: name, method: 'tools/call', params: { name: 'get_icon_as_code', arguments: { name, style: 'linear', format: 'react', color: 'currentColor' } } }) });
  const result = await response.json();
  const source = result.result?.content?.map(c => c.text || '').join('\n') || '';
  let svg = source.match(/<svg[\s\S]*?<\/svg>/)?.[0];
  if (!response.ok || !svg || /<script|<foreignObject|\son\w+=|href=/i.test(svg)) throw new Error(`Unable to fetch safe icon: ${name}`);
  // These icons fit their viewBox; remove redundant clipping to avoid duplicate IDs.
  svg = svg.replace(/<defs>[\s\S]*?<\/defs>/g, '').replace(/ clip-path="[^"]*"/g, '').replace(/<svg \{\.\.\.props\}/, '<svg aria-hidden="true" {...props}').replaceAll('fill-rule=', 'fillRule=').replaceAll('clip-rule=', 'clipRule=');
  output += `export function ${component}({ size = 24, ...props }: Props) { return (${svg}); }\n`;
}
await writeFile('components/CardIcons.tsx', output);
console.log(`Saved ${Object.keys(icons).length} Iconsax components.`);
