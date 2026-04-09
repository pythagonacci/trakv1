import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { parseProjectTemplateMarkdown } from '@/lib/project-templates/markdown-parser';

describe('parseProjectTemplateMarkdown', () => {
  it('parses tabs and mixed block types from the handoff format', () => {
    const markdown = `
# Trak — Product Launch Template

**Project name:** \`[Product Name] Launch\`
**Suggested tags:** \`launch\`, \`[season/year]\`
**Default status:** \`in_progress\`

# TAB 1 — Launch Brief

### Block 1 — Section Header
**Type:** \`section_header\`
**Title:** \`The Product\`
**Subtitle:** \`What we're launching\`

### Block 2 — Text Block
**Type:** \`text\`
**Content:**

\`\`\`
Hello world
\`\`\`

### Block 3 — Task Block
**Type:** \`task\`
**View:** Board view, grouped by status
**Pre-populated tasks:**

| Task | Priority | Owner |
|---|---|---|
| Ship it | 🔴 Urgent | [Owner] |

# TAB 2 — Post-Launch

### Block 1 — Chart Block
**Type:** \`chart\`
**Purpose:** Task completion overview
`;

    const parsed = parseProjectTemplateMarkdown(markdown);

    expect(parsed.projectName).toBe('[Product Name] Launch');
    expect(parsed.suggestedTags).toEqual(['launch', '[season/year]']);
    expect(parsed.defaultStatus).toBe('in_progress');
    expect(parsed.tabs).toHaveLength(2);
    expect(parsed.tabs[0]?.name).toBe('Launch Brief');
    expect(parsed.tabs[0]?.blocks[0]).toEqual({
      kind: 'section_header',
      label: 'Section Header',
      layout: 'full',
      title: 'The Product',
      subtitle: "What we're launching",
    });
    expect(parsed.tabs[0]?.blocks[1]).toEqual({
      kind: 'text',
      label: 'Text Block',
      layout: 'full',
      content: 'Hello world',
    });
    expect(parsed.tabs[0]?.blocks[2]).toEqual({
      kind: 'task',
      label: 'Task Block',
      layout: 'full',
      title: null,
      view: 'Board view, grouped by status',
      rollupSource: null,
      tasks: [{ Task: 'Ship it', Priority: '🔴 Urgent', Owner: '[Owner]' }],
    });
    expect(parsed.tabs[1]?.blocks[0]).toEqual({
      kind: 'chart',
      label: 'Chart Block',
      layout: 'full',
      chartType: null,
      purpose: 'Task completion overview',
      sourceTable: null,
      breakdownField: null,
      measure: null,
    });
  });

  it('parses parent tabs, subtabs, and row layout markers', () => {
    const markdown = `
# Trak — Product Development Template

**Project name:** \`[Product Name] Development\`
**Suggested tags:** \`product-dev\`
**Default status:** \`in_progress\`

# TAB 1 — Product Vision

**Tab name:** \`Product Vision\`

## SUBTAB 1A — The Idea

**Tab name:** \`The Idea\`
**Parent:** Product Vision

### Block 1 — Text Block [ROW: left]
**Type:** \`text\`
**Content:**

\`\`\`
Left side
\`\`\`

### Block 2 — Text Block [ROW: center]
**Type:** \`text\`
**Content:**

\`\`\`
Center side
\`\`\`

### Block 3 — Text Block [ROW: right]
**Type:** \`text\`
**Content:**

\`\`\`
Right side
\`\`\`

# TAB 2 — Roadmap

**Tab name:** \`Roadmap\`

### Block 1 — Timeline Block
**Type:** \`timeline\`
**Pre-populated events:**

| Milestone | Date | Notes |
|---|---|---|
| Concept Signed Off | [Date] | Start here |
`;

    const parsed = parseProjectTemplateMarkdown(markdown);

    expect(parsed.tabs).toEqual([
      {
        name: 'Product Vision',
        parentName: null,
        blocks: [],
      },
      {
        name: 'The Idea',
        parentName: 'Product Vision',
        blocks: [
          {
            kind: 'text',
            label: 'Text Block',
            layout: 'left',
            content: 'Left side',
          },
          {
            kind: 'text',
            label: 'Text Block',
            layout: 'center',
            content: 'Center side',
          },
          {
            kind: 'text',
            label: 'Text Block',
            layout: 'right',
            content: 'Right side',
          },
        ],
      },
      {
        name: 'Roadmap',
        parentName: null,
        blocks: [
          {
            kind: 'timeline',
            label: 'Timeline Block',
            layout: 'full',
            events: [
              {
                Milestone: 'Concept Signed Off',
                Date: '[Date]',
                Notes: 'Start here',
              },
            ],
          },
        ],
      },
    ]);
  });

  it('parses embed blocks and chart types from the seasonal drop template', () => {
    const fixturePath = path.resolve(
      process.cwd(),
      'scripts/project-templates/seasonal-drop-multi-sku-launch-template.md'
    );
    const markdown = readFileSync(fixturePath, 'utf8');

    const parsed = parseProjectTemplateMarkdown(markdown);

    expect(parsed.projectName).toBe('[Brand Name] — [Drop Name]');
    expect(parsed.suggestedTags).toEqual(['drop', 'launch', 'seasonal']);
    expect(parsed.defaultStatus).toBe('not_started');
    expect(parsed.tabs).toHaveLength(11);

    const creativeDirection = parsed.tabs.find(
      tab => tab.name === 'Creative Direction'
    );
    const postLaunch = parsed.tabs.find(tab => tab.name === 'Post-Launch');

    expect(
      creativeDirection?.blocks.find(block => block.kind === 'embed')
    ).toEqual({
      kind: 'embed',
      label: 'Design Files',
      layout: 'full',
      placeholder:
        'Paste your Figma, Canva, or other design file link here. Moodboard comps, typography direction, packaging mockups.',
    });
    expect(postLaunch?.blocks.find(block => block.kind === 'chart')).toEqual({
      kind: 'chart',
      label: 'Units Sold by SKU',
      layout: 'full',
      chartType: 'Bar',
      purpose:
        'Add your SKU names and units sold. If you sold out all SKUs, all bars hit ceiling — which is the goal.',
      sourceTable: null,
      breakdownField: null,
      measure: null,
    });
  });

  it('parses the influencer seeding template with a table-backed chart', () => {
    const fixturePath = path.resolve(
      process.cwd(),
      'scripts/project-templates/influencer-seeding-template.md'
    );
    const markdown = readFileSync(fixturePath, 'utf8');

    const parsed = parseProjectTemplateMarkdown(markdown);

    expect(parsed.projectName).toBe('[Launch Name] Influencer Seeding');
    expect(parsed.suggestedTags).toEqual(['seeding', 'influencer', 'launch']);
    expect(parsed.defaultStatus).toBe('in_progress');
    expect(parsed.tabs).toHaveLength(2);

    const results = parsed.tabs.find(tab => tab.name === 'Results');
    expect(results?.blocks.find(block => block.kind === 'chart')).toEqual({
      kind: 'chart',
      label: 'Reach by Platform',
      layout: 'full',
      chartType: 'doughnut',
      purpose:
        'Visual summary of reach by platform based on the results table above.',
      sourceTable: 'Reach by Platform',
      breakdownField: 'Platform',
      measure: { type: 'sum', field: 'Reach' },
    });
  });

  it('parses the product development design template fixture with supported sample-round mapping', () => {
    const fixturePath = path.resolve(
      process.cwd(),
      'scripts/project-templates/product-development-roadmap-template.md'
    );
    const markdown = readFileSync(fixturePath, 'utf8');

    const parsed = parseProjectTemplateMarkdown(markdown);

    expect(parsed.projectName).toBe('[Product Name] Development');
    expect(parsed.suggestedTags).toEqual([
      'product-dev',
      'design',
      'production',
    ]);
    expect(parsed.defaultStatus).toBe('in_progress');
    expect(parsed.tabs).toHaveLength(4);

    const designAndSamples = parsed.tabs.find(
      tab => tab.name === 'Design & Samples'
    );
    const manufacturer = parsed.tabs.find(tab => tab.name === 'Manufacturer');

    expect(
      designAndSamples?.blocks.find(block => block.kind === 'gallery')
    ).toEqual({
      kind: 'gallery',
      label: 'Sketches + References',
      layout: 'full',
      placeholder:
        'Empty gallery — upload sketches, technical drawings, reference images, material swatches, and inspiration photos here.',
    });
    expect(
      designAndSamples?.blocks.find(
        block =>
          block.kind === 'table' && block.label === 'Sample Rounds Tracker'
      )
    ).toEqual({
      kind: 'table',
      label: 'Sample Rounds Tracker',
      layout: 'full',
      columns: ['Round', 'Date Received', 'Feedback', 'Revision Status'],
      rows: [
        {
          Round: 'Sample 1',
          'Date Received': '[Date received]',
          Feedback: '[Log what needs to change before the next round]',
          'Revision Status': 'In Progress',
        },
        {
          Round: 'Sample 2',
          'Date Received': '',
          Feedback: '',
          'Revision Status': '',
        },
        {
          Round: 'Sample 3',
          'Date Received': '',
          Feedback: '',
          'Revision Status': '',
        },
      ],
    });
    expect(
      manufacturer?.blocks.find(
        block =>
          block.kind === 'table' && block.label === 'Cost Breakdown — Per Unit'
      )
    ).toEqual({
      kind: 'table',
      label: 'Cost Breakdown — Per Unit',
      layout: 'full',
      columns: ['Item', 'Unit Cost', 'Notes'],
      rows: [
        { Item: 'Materials', 'Unit Cost': '', Notes: '' },
        { Item: 'Labour (cut, sew, finish)', 'Unit Cost': '', Notes: '' },
        { Item: 'Packaging + tags', 'Unit Cost': '', Notes: '' },
        { Item: 'Freight + duties', 'Unit Cost': '', Notes: '' },
        { Item: 'Total COGS', 'Unit Cost': '', Notes: '' },
      ],
    });
  });

  it('parses task rollup source metadata', () => {
    const markdown = `
# Trak — Rollup Template

**Project name:** \`Rollup Template\`
**Suggested tags:** \`ops\`
**Default status:** \`not_started\`

# TAB 1 — Launch HQ

### Block 1 — All Project Tasks
**Type:** \`task\`
**Title:** \`All Project Tasks\`
**View:** List view
**Rollup:** \`Project-wide live mirror\`
`;

    const parsed = parseProjectTemplateMarkdown(markdown);

    expect(parsed.tabs[0]?.blocks[0]).toEqual({
      kind: 'task',
      label: 'All Project Tasks',
      layout: 'full',
      title: 'All Project Tasks',
      view: 'List view',
      rollupSource: 'project',
      tasks: [],
    });
  });

  it('parses cards blocks with seeded card metadata', () => {
    const markdown = `
# Trak — Cards Template

**Project name:** \`Cards Template\`
**Suggested tags:** \`ops\`
**Default status:** \`in_progress\`

# TAB 1 — HQ

### Block 1 — Event Details + Goals
**Type:** \`cards\`
**Title:** \`Event Details + Goals\`
**View:** \`Grid view\`
**Pre-populated cards:**

| Card | Notes | Width | Height |
|---|---|---|---|
| Event Details | Dates:\\nAddress:\\nHours: | half | tall |
| Goals | Revenue target and event objective. | full | compact |
`;

    const parsed = parseProjectTemplateMarkdown(markdown);

    expect(parsed.tabs[0]?.blocks[0]).toEqual({
      kind: 'cards',
      label: 'Event Details + Goals',
      layout: 'full',
      title: 'Event Details + Goals',
      view: 'grid',
      cardVariant: 'asset',
      cards: [
        {
          title: 'Event Details',
          notes: 'Dates:\\nAddress:\\nHours:',
          width: 'half',
          height: 'tall',
        },
        {
          title: 'Goals',
          notes: 'Revenue target and event objective.',
          width: 'full',
          height: 'compact',
        },
      ],
    });
  });

  it('parses the pop-up event template fixture including cards and rollup blocks', () => {
    const fixturePath = path.resolve(
      process.cwd(),
      'scripts/project-templates/pop-up-event-template.md'
    );
    const markdown = readFileSync(fixturePath, 'utf8');

    const parsed = parseProjectTemplateMarkdown(markdown);

    expect(parsed.projectName).toBe('[Pop-Up Event Name]');
    expect(parsed.suggestedTags).toEqual(['popup', 'retail', 'event']);
    expect(parsed.defaultStatus).toBe('in_progress');
    expect(parsed.tabs).toHaveLength(4);

    const eventHq = parsed.tabs.find(tab => tab.name === 'Event HQ');
    const logistics = parsed.tabs.find(tab => tab.name === 'Space & Logistics');

    expect(eventHq?.blocks[1]).toEqual({
      kind: 'cards',
      label: 'Event Details + Goals',
      layout: 'full',
      title: 'Event Details + Goals',
      view: 'grid',
      cardVariant: 'text',
      cards: [
        {
          title: 'Event Details',
          notes: 'Dates:\\nAddress:\\nHours:\\nSpace size:\\nTeam on floor:',
          width: 'half',
          height: 'tall',
        },
        {
          title: 'Goals',
          notes:
            'Revenue goal:\\nAwareness goal:\\nContent goal:\\nCustomer feedback goal:',
          width: 'half',
          height: 'tall',
        },
      ],
    });
    expect(eventHq?.blocks.find(block => block.kind === 'task')).toEqual({
      kind: 'task',
      label: 'All Project Tasks',
      layout: 'full',
      title: 'All Project Tasks',
      view: 'List view',
      rollupSource: 'project',
      tasks: [],
    });
    expect(logistics?.blocks[0]).toEqual({
      kind: 'cards',
      label: 'Venue + Key Contacts',
      layout: 'full',
      title: 'Venue + Key Contacts',
      view: 'grid',
      cardVariant: 'text',
      cards: [
        {
          title: 'Venue',
          notes:
            'Address:\\nSpace size:\\nLease contact + phone:\\nAccess date/time:\\nDeposit amount + paid date:',
          width: 'half',
          height: 'tall',
        },
        {
          title: 'Key Contacts',
          notes:
            'Ops lead:\\nVendor type: Name\\nVendor type: Name\\nVendor type: Name',
          width: 'half',
          height: 'tall',
        },
      ],
    });
  });
});
