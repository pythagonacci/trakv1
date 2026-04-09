import { describe, expect, it } from 'vitest';
import type { ParsedTemplateTab } from '@/lib/project-templates/markdown-parser';
import {
  buildTemplateChartContent,
  buildTemplateTabBlockLayout,
  inferTemplateTableFieldType,
  normalizeTemplateTableCellValue,
} from '@/lib/project-templates/source-project-seeder';

describe('buildTemplateTabBlockLayout', () => {
  it('pairs adjacent left/right blocks into one row', () => {
    const tab: ParsedTemplateTab = {
      name: 'Brand & Naming',
      parentName: null,
      blocks: [
        {
          kind: 'section_header',
          label: 'Section Header',
          layout: 'full',
          title: 'Product Naming',
          subtitle: 'Candidates',
        },
        {
          kind: 'text',
          label: 'Text Block',
          layout: 'left',
          content: 'Left',
        },
        {
          kind: 'text',
          label: 'Text Block',
          layout: 'right',
          content: 'Right',
        },
      ],
    };

    expect(Array.from(buildTemplateTabBlockLayout(tab).entries())).toEqual([
      [0, { position: 0, column: 0 }],
      [1, { position: 1, column: 0 }],
      [2, { position: 1, column: 1 }],
    ]);
  });

  it('pairs adjacent left/center/right blocks into one row', () => {
    const tab: ParsedTemplateTab = {
      name: 'Products',
      parentName: null,
      blocks: [
        {
          kind: 'shopify_product',
          label: 'SKU 1',
          layout: 'left',
          placeholder: 'Attach SKU 1',
        },
        {
          kind: 'shopify_product',
          label: 'SKU 2',
          layout: 'center',
          placeholder: 'Attach SKU 2',
        },
        {
          kind: 'shopify_product',
          label: 'SKU 3',
          layout: 'right',
          placeholder: 'Attach SKU 3',
        },
      ],
    };

    expect(Array.from(buildTemplateTabBlockLayout(tab).entries())).toEqual([
      [0, { position: 0, column: 0 }],
      [1, { position: 0, column: 1 }],
      [2, { position: 0, column: 2 }],
    ]);
  });

  it('pairs section-header plus content columns across two rows', () => {
    const tab: ParsedTemplateTab = {
      name: 'The Idea',
      parentName: 'Product Vision',
      blocks: [
        {
          kind: 'section_header',
          label: 'Section Header',
          layout: 'full',
          title: 'The Product Concept',
          subtitle: 'Left header',
        },
        {
          kind: 'text',
          label: 'Text Block',
          layout: 'left',
          content: 'Left body',
        },
        {
          kind: 'section_header',
          label: 'Section Header',
          layout: 'full',
          title: 'Product Parameters',
          subtitle: 'Right header',
        },
        {
          kind: 'text',
          label: 'Text Block',
          layout: 'right',
          content: 'Right body',
        },
        {
          kind: 'task',
          label: 'Task Block',
          layout: 'full',
          title: null,
          view: 'List view',
          rollupSource: null,
          tasks: [],
        },
      ],
    };

    expect(Array.from(buildTemplateTabBlockLayout(tab).entries())).toEqual([
      [0, { position: 0, column: 0 }],
      [2, { position: 0, column: 1 }],
      [1, { position: 1, column: 0 }],
      [3, { position: 1, column: 1 }],
      [4, { position: 2, column: 0 }],
    ]);
  });

  it('infers supported table field types for owner, status, due, and priority columns', () => {
    expect(inferTemplateTableFieldType('Owner', [])).toBe('person');
    expect(inferTemplateTableFieldType('Assigned To', [])).toBe('person');
    expect(inferTemplateTableFieldType('Status', [])).toBe('status');
    expect(
      inferTemplateTableFieldType('Shot Progress', [
        { 'Shot Progress': 'Not Started' },
        { 'Shot Progress': 'In Review' },
        { 'Shot Progress': 'Approved' },
      ])
    ).toBe('status');
    expect(
      inferTemplateTableFieldType('Approval State', [
        { 'Approval State': 'Pending' },
        { 'Approval State': 'Needs Revision' },
        { 'Approval State': 'Approved' },
      ])
    ).toBe('status');
    expect(inferTemplateTableFieldType('Due', [])).toBe('date');
    expect(inferTemplateTableFieldType('Due Date', [])).toBe('date');
    expect(inferTemplateTableFieldType('Priority', [])).toBe('priority');
    expect(inferTemplateTableFieldType('Unit Cost', [])).toBe('number');
    expect(inferTemplateTableFieldType('Retail Price', [])).toBe('number');
    expect(inferTemplateTableFieldType('Followers', [])).toBe('number');
    expect(inferTemplateTableFieldType('Min. Selects', [])).toBe('number');
    expect(inferTemplateTableFieldType('Reach', [])).toBe('number');
    expect(inferTemplateTableFieldType('Posts', [])).toBe('number');
    expect(inferTemplateTableFieldType('Seeded', [])).toBe('number');
    expect(inferTemplateTableFieldType('Post Rate (%)', [])).toBe('number');
  });

  it('infers checkbox fields from ballot-box seeded values', () => {
    expect(
      inferTemplateTableFieldType('Brief Sent', [
        { 'Brief Sent': '☐' },
        { 'Brief Sent': '☑' },
      ])
    ).toBe('checkbox');
  });

  it('normalizes seeded status, priority, and date cell values to supported table values', () => {
    expect(normalizeTemplateTableCellValue('priority', 'Must-have')).toBe(
      'urgent'
    );
    expect(
      normalizeTemplateTableCellValue('status', 'Under consideration')
    ).toBe('todo');
    expect(normalizeTemplateTableCellValue('status', 'In review')).toBe(
      'in_progress'
    );
    expect(normalizeTemplateTableCellValue('status', 'In Shoot')).toBe(
      'in_progress'
    );
    expect(normalizeTemplateTableCellValue('status', 'Approved')).toBe('done');
    expect(normalizeTemplateTableCellValue('status', 'Needs Revision')).toBe(
      'blocked'
    );
    expect(normalizeTemplateTableCellValue('status', 'Rejected')).toBe(
      'blocked'
    );
    expect(normalizeTemplateTableCellValue('date', '2026-03-27')).toBe(
      '2026-03-27'
    );
    expect(normalizeTemplateTableCellValue('number', '1,250')).toBe(1250);
    expect(normalizeTemplateTableCellValue('checkbox', '☐')).toBe(false);
    expect(normalizeTemplateTableCellValue('checkbox', '☑')).toBe(true);
  });

  it('builds a refreshable table-backed chart from a seeded template table', () => {
    const content = buildTemplateChartContent({
      title: 'Reach by Platform',
      chartType: 'doughnut',
      purpose:
        'Visual summary of reach by platform based on the results table above.',
      projectId: 'project-1',
      taskRows: [],
      sourceTable: {
        tableId: 'table-1',
        fieldIdsByName: new Map([
          ['Platform', 'field-platform'],
          ['Reach', 'field-reach'],
        ]),
        rows: [
          {
            id: 'row-1',
            data: {
              'field-platform': 'Instagram',
              'field-reach': 1200,
            },
          },
        ],
      },
      breakdownField: 'Platform',
      measure: { type: 'sum', field: 'Reach' },
    }) as Record<string, any>;

    expect(content.spec).toEqual({
      version: 1,
      chartType: 'doughnut',
      breakdown: {
        field: 'field-platform',
        fieldLabel: 'Platform',
      },
      measure: {
        type: 'sum',
        field: 'field-reach',
      },
      normalizeTo: 'focus',
      title: 'Reach by Platform',
      labelLabel: 'Platform',
      valueLabel: 'Reach',
    });
    expect(content.rows).toEqual([
      {
        id: 'row-1',
        'Task Title': 'Instagram',
        'field-platform': 'Instagram',
        'field-reach': 1200,
      },
    ]);
    expect(content.dataSource).toEqual({
      mode: 'refreshable',
      scope: 'query',
      query: {
        type: 'table_rows',
        params: {
          tableId: 'table-1',
          limit: 500,
        },
      },
    });
  });
});
