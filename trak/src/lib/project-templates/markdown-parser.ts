export type ParsedTemplateProjectStatus =
  | 'not_started'
  | 'in_progress'
  | 'complete';

export type ParsedTemplateBlockLayout = 'full' | 'left' | 'center' | 'right';
export type ParsedTemplateCardsView = 'grid' | 'list';
export type ParsedTemplateCardWidth = 'half' | 'full';
export type ParsedTemplateCardHeight = 'compact' | 'tall';
export type ParsedTemplateCardVariant = 'asset' | 'text';
export type ParsedTemplateChartMeasure =
  | { type: 'count' }
  | { type: 'sum' | 'avg'; field: string };

export interface ParsedTemplateCardSeed {
  title: string;
  notes: string | null;
  width: ParsedTemplateCardWidth;
  height: ParsedTemplateCardHeight;
}

export type ParsedTemplateBlock =
  | {
      kind: 'section_header';
      label: string;
      layout: ParsedTemplateBlockLayout;
      title: string;
      subtitle: string;
    }
  | {
      kind: 'shopify_product';
      label: string;
      layout: ParsedTemplateBlockLayout;
      placeholder: string | null;
    }
  | {
      kind: 'text';
      label: string;
      layout: ParsedTemplateBlockLayout;
      content: string;
    }
  | {
      kind: 'cards';
      label: string;
      layout: ParsedTemplateBlockLayout;
      title: string | null;
      view: ParsedTemplateCardsView | null;
      cardVariant: ParsedTemplateCardVariant;
      cards: ParsedTemplateCardSeed[];
    }
  | {
      kind: 'task';
      label: string;
      layout: ParsedTemplateBlockLayout;
      title: string | null;
      view: string | null;
      rollupSource: 'project' | null;
      tasks: Array<Record<string, string>>;
    }
  | {
      kind: 'timeline';
      label: string;
      layout: ParsedTemplateBlockLayout;
      events: Array<Record<string, string>>;
    }
  | {
      kind: 'table';
      label: string;
      layout: ParsedTemplateBlockLayout;
      columns: string[];
      rows: Array<Record<string, string>>;
    }
  | {
      kind: 'gallery' | 'image' | 'video' | 'file';
      label: string;
      layout: ParsedTemplateBlockLayout;
      placeholder: string | null;
    }
  | {
      kind: 'chart';
      label: string;
      layout: ParsedTemplateBlockLayout;
      chartType: string | null;
      purpose: string | null;
      sourceTable: string | null;
      breakdownField: string | null;
      measure: ParsedTemplateChartMeasure | null;
    }
  | {
      kind: 'embed';
      label: string;
      layout: ParsedTemplateBlockLayout;
      placeholder: string | null;
    };

export interface ParsedTemplateTab {
  name: string;
  parentName: string | null;
  blocks: ParsedTemplateBlock[];
}

export interface ParsedTemplateSpec {
  documentTitle: string | null;
  projectName: string;
  suggestedTags: string[];
  defaultStatus: ParsedTemplateProjectStatus;
  tabs: ParsedTemplateTab[];
}

function normalizeLine(line: string) {
  return line.replace(/\r$/, '');
}

function stripInlineFormatting(value: string) {
  return value
    .trim()
    .replace(/^`|`$/g, '')
    .replace(/^\*+|\*+$/g, '')
    .trim();
}

function parseLabelLine(line: string, label: string) {
  const match = line.match(new RegExp(`^\\*\\*${label}:\\*\\*\\s*(.+)$`));
  return match ? stripInlineFormatting(match[1] ?? '') : null;
}

function splitMarkdownRow(line: string) {
  const trimmed = line.trim();
  if (!trimmed.startsWith('|') || !trimmed.endsWith('|')) return null;
  return trimmed
    .slice(1, -1)
    .split('|')
    .map(cell => cell.trim());
}

function parseMarkdownTable(lines: string[]) {
  const tableStart = lines.findIndex(line => {
    const cells = splitMarkdownRow(line);
    return Boolean(cells && cells.length > 0);
  });

  if (tableStart === -1 || tableStart + 1 >= lines.length) {
    return { headers: [], rows: [] as Array<Record<string, string>> };
  }

  const headers = splitMarkdownRow(lines[tableStart]) ?? [];
  const divider = splitMarkdownRow(lines[tableStart + 1]) ?? [];
  const looksLikeDivider =
    headers.length > 0 &&
    divider.length === headers.length &&
    divider.every(cell => /^:?-{3,}:?$/.test(cell));

  if (!looksLikeDivider) {
    return { headers: [], rows: [] as Array<Record<string, string>> };
  }

  const rows: Array<Record<string, string>> = [];
  for (let index = tableStart + 2; index < lines.length; index += 1) {
    const cells = splitMarkdownRow(lines[index]);
    if (!cells) break;
    const row: Record<string, string> = {};
    headers.forEach((header, headerIndex) => {
      row[header] = cells[headerIndex] ?? '';
    });
    rows.push(row);
  }

  return { headers, rows };
}

function extractFencedCodeBlock(lines: string[]) {
  const start = lines.findIndex(line => line.trim() === '```');
  if (start === -1) return null;
  const end = lines.findIndex(
    (line, index) => index > start && line.trim() === '```'
  );
  if (end === -1) return null;
  return lines
    .slice(start + 1, end)
    .map(normalizeLine)
    .join('\n')
    .trim();
}

function parseTaskView(lines: string[]) {
  const viewLine = lines.find(line => line.startsWith('**View:**'));
  if (!viewLine) return null;
  return stripInlineFormatting(viewLine.replace('**View:**', ''));
}

function parseTaskRollupSource(lines: string[]) {
  const rollupLine = lines.find(line => line.startsWith('**Rollup:**'));
  if (!rollupLine) return null;
  const value = stripInlineFormatting(
    rollupLine.replace('**Rollup:**', '')
  ).toLowerCase();
  if (value.includes('project')) return 'project';
  return null;
}

function parseChartMeasure(lines: string[]): ParsedTemplateChartMeasure | null {
  const measureLine = lines.find(line => line.startsWith('**Measure:**'));
  if (!measureLine) return null;

  const rawValue = stripInlineFormatting(
    measureLine.replace('**Measure:**', '')
  );
  const normalized = rawValue.toLowerCase();
  if (normalized === 'count') return { type: 'count' };

  const match = rawValue.match(/^(sum|avg)\((.+)\)$/i);
  if (!match) return null;

  const type = match[1]?.toLowerCase();
  const field = stripInlineFormatting(match[2] ?? '');
  if (!field || (type !== 'sum' && type !== 'avg')) return null;

  return { type, field };
}

function parseCardsView(lines: string[]): ParsedTemplateCardsView | null {
  const viewLine = lines.find(line => line.startsWith('**View:**'));
  if (!viewLine) return null;
  const value = stripInlineFormatting(
    viewLine.replace('**View:**', '')
  ).toLowerCase();
  if (value.includes('list')) return 'list';
  if (value.includes('grid')) return 'grid';
  return null;
}

function parseCardsVariant(lines: string[]): ParsedTemplateCardVariant {
  const variantLine = lines.find(line =>
    line.startsWith('**Card variant:**')
  );
  if (!variantLine) return 'asset';
  const value = stripInlineFormatting(
    variantLine.replace('**Card variant:**', '')
  ).toLowerCase();
  return value.includes('text') ? 'text' : 'asset';
}

function parseCardWidth(value: string | undefined): ParsedTemplateCardWidth {
  const normalized = stripInlineFormatting(value ?? '').toLowerCase();
  return normalized.includes('full') ? 'full' : 'half';
}

function parseCardHeight(value: string | undefined): ParsedTemplateCardHeight {
  const normalized = stripInlineFormatting(value ?? '').toLowerCase();
  return normalized.includes('compact') ? 'compact' : 'tall';
}

function parseBlockHeading(rawLabel: string) {
  const rowMatch = rawLabel.match(/\s*`?\[ROW:\s*(left|center|right)\]`?\s*$/i);
  const layout = (rowMatch?.[1]?.toLowerCase() ??
    'full') as ParsedTemplateBlockLayout;
  const label = rawLabel
    .replace(/\s*`?\[ROW:\s*(?:left|center|right)\]`?\s*$/i, '')
    .trim();
  return { label, layout };
}

function parseBlock(
  label: string,
  layout: ParsedTemplateBlockLayout,
  lines: string[]
): ParsedTemplateBlock {
  const type = parseLabelLine(
    lines.find(line => line.startsWith('**Type:**')) ?? '',
    'Type'
  );
  if (!type) {
    throw new Error(`Block "${label}" is missing a type`);
  }

  if (type === 'section_header') {
    const title = parseLabelLine(
      lines.find(line => line.startsWith('**Title:**')) ?? '',
      'Title'
    );
    const subtitle = parseLabelLine(
      lines.find(line => line.startsWith('**Subtitle:**')) ?? '',
      'Subtitle'
    );
    if (!title || subtitle === null) {
      throw new Error(
        `Section header block "${label}" is missing title or subtitle`
      );
    }
    return { kind: 'section_header', label, layout, title, subtitle };
  }

  if (type === 'shopify_product') {
    const placeholder =
      parseLabelLine(
        lines.find(line => line.startsWith('**Placeholder state:**')) ?? '',
        'Placeholder state'
      ) ??
      parseLabelLine(
        lines.find(line => line.startsWith('**Placeholder:**')) ?? '',
        'Placeholder'
      );
    return { kind: 'shopify_product', label, layout, placeholder };
  }

  if (type === 'text') {
    const content = extractFencedCodeBlock(lines);
    if (!content) {
      throw new Error(`Text block "${label}" is missing fenced content`);
    }
    return { kind: 'text', label, layout, content };
  }

  if (type === 'cards') {
    const title = parseLabelLine(
      lines.find(line => line.startsWith('**Title:**')) ?? '',
      'Title'
    );
    const { rows } = parseMarkdownTable(lines);
    return {
      kind: 'cards',
      label,
      layout,
      title,
      view: parseCardsView(lines),
      cardVariant: parseCardsVariant(lines),
      cards: rows
        .map(row => {
          const cardTitle = stripInlineFormatting(
            row.Card ?? row.Title ?? row.Name ?? ''
          );
          if (!cardTitle) return null;
          const notes = stripInlineFormatting(
            row.Notes ?? row.Description ?? row.Content ?? ''
          );
          return {
            title: cardTitle,
            notes: notes || null,
            width: parseCardWidth(row.Width),
            height: parseCardHeight(row.Height),
          };
        })
        .filter((card): card is ParsedTemplateCardSeed => Boolean(card)),
    };
  }

  if (type === 'task') {
    const title = parseLabelLine(
      lines.find(line => line.startsWith('**Title:**')) ?? '',
      'Title'
    );
    const { rows } = parseMarkdownTable(lines);
    return {
      kind: 'task',
      label,
      layout,
      title,
      view: parseTaskView(lines),
      rollupSource: parseTaskRollupSource(lines),
      tasks: rows,
    };
  }

  if (type === 'timeline') {
    const { rows } = parseMarkdownTable(lines);
    return { kind: 'timeline', label, layout, events: rows };
  }

  if (type === 'table') {
    const columnsValue = parseLabelLine(
      lines.find(line => line.startsWith('**Columns:**')) ?? '',
      'Columns'
    );
    const columns = columnsValue
      ? columnsValue
          .split('|')
          .map(column => column.trim())
          .filter(Boolean)
      : [];
    const { rows } = parseMarkdownTable(lines);
    return { kind: 'table', label, layout, columns, rows };
  }

  if (
    type === 'gallery' ||
    type === 'image' ||
    type === 'video' ||
    type === 'file'
  ) {
    const placeholder =
      parseLabelLine(
        lines.find(line => line.startsWith('**Placeholder state:**')) ?? '',
        'Placeholder state'
      ) ??
      parseLabelLine(
        lines.find(line => line.startsWith('**Placeholder:**')) ?? '',
        'Placeholder'
      );
    return { kind: type, label, layout, placeholder };
  }

  if (type === 'chart') {
    const purpose = parseLabelLine(
      lines.find(line => line.startsWith('**Purpose:**')) ?? '',
      'Purpose'
    );
    const chartType = parseLabelLine(
      lines.find(line => line.startsWith('**Chart type:**')) ?? '',
      'Chart type'
    );
    const sourceTable = parseLabelLine(
      lines.find(line => line.startsWith('**Source table:**')) ?? '',
      'Source table'
    );
    const breakdownField = parseLabelLine(
      lines.find(line => line.startsWith('**Breakdown field:**')) ?? '',
      'Breakdown field'
    );
    return {
      kind: 'chart',
      label,
      layout,
      chartType,
      purpose,
      sourceTable,
      breakdownField,
      measure: parseChartMeasure(lines),
    };
  }

  if (type === 'embed') {
    const placeholder =
      parseLabelLine(
        lines.find(line => line.startsWith('**Placeholder state:**')) ?? '',
        'Placeholder state'
      ) ??
      parseLabelLine(
        lines.find(line => line.startsWith('**Placeholder:**')) ?? '',
        'Placeholder'
      );
    return { kind: 'embed', label, layout, placeholder };
  }

  throw new Error(`Unsupported block type "${type}" in block "${label}"`);
}

function parseSuggestedTags(markdown: string) {
  const line = markdown
    .split('\n')
    .map(normalizeLine)
    .find(entry => entry.startsWith('**Suggested tags:**'));
  if (!line) return [];
  const matches = [...line.matchAll(/`([^`]+)`/g)];
  return matches
    .map(match => match[1] ?? '')
    .map(value => value.trim())
    .filter(Boolean);
}

function parseProjectStatus(markdown: string): ParsedTemplateProjectStatus {
  const line = markdown
    .split('\n')
    .map(normalizeLine)
    .find(entry => entry.startsWith('**Default status:**'));
  const value = line ? parseLabelLine(line, 'Default status') : null;
  if (
    value === 'complete' ||
    value === 'not_started' ||
    value === 'in_progress'
  ) {
    return value;
  }
  return 'not_started';
}

function parseProjectName(markdown: string) {
  const line = markdown
    .split('\n')
    .map(normalizeLine)
    .find(entry => entry.startsWith('**Project name:**'));
  const value = line ? parseLabelLine(line, 'Project name') : null;
  if (!value) {
    throw new Error('Template markdown is missing a project name');
  }
  return value;
}

export function parseProjectTemplateMarkdown(
  markdown: string
): ParsedTemplateSpec {
  const lines = markdown.split('\n').map(normalizeLine);
  const tabs: ParsedTemplateTab[] = [];
  const firstHeading = lines.find(line => line.startsWith('# '));
  let currentTab: ParsedTemplateTab | null = null;
  let index = 0;

  while (index < lines.length) {
    const line = lines[index];
    const tabMatch = line.match(/^# TAB \d+\s+[—-]\s+(.+)$/);
    if (tabMatch) {
      currentTab = { name: tabMatch[1]!.trim(), parentName: null, blocks: [] };
      tabs.push(currentTab);
      index += 1;
      continue;
    }

    const subtabMatch = line.match(/^## SUBTAB\s+[^\s]+\s+[—-]\s+(.+)$/);
    if (subtabMatch) {
      currentTab = {
        name: subtabMatch[1]!.trim(),
        parentName: null,
        blocks: [],
      };
      tabs.push(currentTab);
      index += 1;
      continue;
    }

    if (currentTab && line.startsWith('**Tab name:**')) {
      currentTab.name = parseLabelLine(line, 'Tab name') ?? currentTab.name;
      index += 1;
      continue;
    }

    if (currentTab && line.startsWith('**Parent:**')) {
      currentTab.parentName = parseLabelLine(line, 'Parent');
      index += 1;
      continue;
    }

    const blockMatch = line.match(/^### Block \d+\s+[—-]\s+(.+)$/);
    if (blockMatch) {
      if (!currentTab) {
        throw new Error(`Encountered block "${blockMatch[1]}" before any tab`);
      }

      const { label, layout } = parseBlockHeading(blockMatch[1]!.trim());
      let endIndex = index + 1;
      while (endIndex < lines.length) {
        if (
          /^### Block \d+\s+[—-]\s+/.test(lines[endIndex]) ||
          /^# TAB \d+\s+[—-]\s+/.test(lines[endIndex]) ||
          /^## SUBTAB\s+[^\s]+\s+[—-]\s+/.test(lines[endIndex])
        ) {
          break;
        }
        endIndex += 1;
      }

      currentTab.blocks.push(
        parseBlock(label, layout, lines.slice(index + 1, endIndex))
      );
      index = endIndex;
      continue;
    }

    index += 1;
  }

  if (tabs.length === 0) {
    throw new Error('Template markdown did not contain any tabs');
  }

  return {
    documentTitle: firstHeading ? firstHeading.replace(/^# /, '').trim() : null,
    projectName: parseProjectName(markdown),
    suggestedTags: parseSuggestedTags(markdown),
    defaultStatus: parseProjectStatus(markdown),
    tabs,
  };
}
