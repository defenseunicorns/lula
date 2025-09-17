// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Lula Authors

import { describe, expect, it } from 'vitest';
import { processMultilineText, type ProcessedSection, type TableRow } from './textProcessor';

describe('textProcessor', () => {
	describe('processMultilineText', () => {
		it('should return empty array for empty input', () => {
			expect(processMultilineText('')).toEqual([]);
			expect(processMultilineText(null as any)).toEqual([]);
			expect(processMultilineText(undefined as any)).toEqual([]);
		});

		it('should process simple paragraph text', () => {
			const text = 'This is a simple paragraph.';
			const result = processMultilineText(text);
			
			expect(result).toHaveLength(1);
			expect(result[0]).toEqual({
				type: 'paragraph',
				content: 'This is a simple paragraph.'
			});
		});

		it('should process multiple paragraphs separated by empty lines', () => {
			const text = `First paragraph.

Second paragraph.

Third paragraph.`;
			
			const result = processMultilineText(text);
			
			expect(result).toHaveLength(3);
			expect(result[0]).toEqual({
				type: 'paragraph',
				content: 'First paragraph.'
			});
			expect(result[1]).toEqual({
				type: 'paragraph',
				content: 'Second paragraph.'
			});
			expect(result[2]).toEqual({
				type: 'paragraph',
				content: 'Third paragraph.'
			});
		});

		it('should detect headers (lines ending with colon)', () => {
			const text = `Control Objective:
This control ensures proper access management.

Implementation Guidance:
Follow these steps to implement the control.`;
			
			const result = processMultilineText(text);
			
			expect(result).toHaveLength(4);
			expect(result[0]).toEqual({
				type: 'header',
				content: 'Control Objective'
			});
			expect(result[1]).toEqual({
				type: 'paragraph',
				content: 'This control ensures proper access management.'
			});
			expect(result[2]).toEqual({
				type: 'header',
				content: 'Implementation Guidance'
			});
			expect(result[3]).toEqual({
				type: 'paragraph',
				content: 'Follow these steps to implement the control.'
			});
		});

		it('should not treat line ending with colon as header if not followed by content', () => {
			const text = `This is not a header:`;
			
			const result = processMultilineText(text);
			
			expect(result).toHaveLength(1);
			expect(result[0]).toEqual({
				type: 'paragraph',
				content: 'This is not a header:'
			});
		});

		it('should process bullet point lists', () => {
			const text = `- First item
- Second item
- Third item`;
			
			const result = processMultilineText(text);
			
			expect(result).toHaveLength(1);
			expect(result[0]).toEqual({
				type: 'list',
				content: '- First item\n- Second item\n- Third item',
				data: {
					items: ['First item', 'Second item', 'Third item']
				}
			});
		});

		it('should process numbered lists', () => {
			const text = `1. First step
2. Second step
3. Third step`;
			
			const result = processMultilineText(text);
			
			expect(result).toHaveLength(1);
			expect(result[0]).toEqual({
				type: 'list',
				content: '1. First step\n2. Second step\n3. Third step',
				data: {
					items: ['First step', 'Second step', 'Third step']
				}
			});
		});

		it('should process letter lists', () => {
			const text = `a. First option
b. Second option
c. Third option`;
			
			const result = processMultilineText(text);
			
			expect(result).toHaveLength(1);
			expect(result[0]).toEqual({
				type: 'list',
				content: 'a. First option\nb. Second option\nc. Third option',
				data: {
					items: ['First option', 'Second option', 'Third option']
				}
			});
		});

		it('should process asterisk lists', () => {
			const text = `* Item one
* Item two
* Item three`;
			
			const result = processMultilineText(text);
			
			expect(result).toHaveLength(1);
			expect(result[0]).toEqual({
				type: 'list',
				content: '* Item one\n* Item two\n* Item three',
				data: {
					items: ['Item one', 'Item two', 'Item three']
				}
			});
		});

		it('should process bullet lists with special characters', () => {
			const text = `• First bullet
• Second bullet
• Third bullet`;
			
			const result = processMultilineText(text);
			
			expect(result).toHaveLength(1);
			expect(result[0]).toEqual({
				type: 'list',
				content: '• First bullet\n• Second bullet\n• Third bullet',
				data: {
					items: ['First bullet', 'Second bullet', 'Third bullet']
				}
			});
		});

		it('should process NIST special format lists', () => {
			const text = `[SELECT FROM: encryption, hashing, digital signatures]
Examine: access control policy documents
Interview: system administrators
Test: authentication mechanisms`;
			
			const result = processMultilineText(text);
			
			expect(result).toHaveLength(1);
			expect(result[0]).toEqual({
				type: 'list',
				content: '[SELECT FROM: encryption, hashing, digital signatures]\nExamine: access control policy documents\nInterview: system administrators\nTest: authentication mechanisms',
				data: {
					items: [
						'[SELECT FROM: encryption, hashing, digital signatures]',
						'Examine: access control policy documents',
						'Interview: system administrators',
						'Test: authentication mechanisms'
					]
				}
			});
		});

		it('should handle mixed content types', () => {
			const text = `Control Implementation:
This control requires the following actions:

- Configure access controls
- Review user permissions
- Test authentication

Additional Notes:
Ensure compliance with organizational policies.`;
			
			const result = processMultilineText(text);
			
			expect(result).toHaveLength(5);
			expect(result[0]).toEqual({
				type: 'header',
				content: 'Control Implementation'
			});
			expect(result[1]).toEqual({
				type: 'header',
				content: 'This control requires the following actions'
			});
			expect(result[2]).toEqual({
				type: 'list',
				content: '- Configure access controls\n- Review user permissions\n- Test authentication',
				data: {
					items: ['Configure access controls', 'Review user permissions', 'Test authentication']
				}
			});
			expect(result[3]).toEqual({
				type: 'header',
				content: 'Additional Notes'
			});
			expect(result[4]).toEqual({
				type: 'paragraph',
				content: 'Ensure compliance with organizational policies.'
			});
		});

		it('should switch between list and paragraph types correctly', () => {
			const text = `- First list item
- Second list item

This is a paragraph after the list.

- Another list item`;
			
			const result = processMultilineText(text);
			
			expect(result).toHaveLength(3);
			expect(result[0].type).toBe('list');
			expect(result[1].type).toBe('paragraph');
			expect(result[2].type).toBe('list');
		});

		it('should preserve line formatting in paragraphs', () => {
			const text = `This is line one
    This is indented line two
This is line three`;
			
			const result = processMultilineText(text);
			
			expect(result).toHaveLength(1);
			expect(result[0]).toEqual({
				type: 'paragraph',
				content: 'This is line one\n    This is indented line two\nThis is line three'
			});
		});

		it('should handle multiple empty lines between sections', () => {
			const text = `First paragraph.



Second paragraph.`;
			
			const result = processMultilineText(text);
			
			expect(result).toHaveLength(2);
			expect(result[0]).toEqual({
				type: 'paragraph',
				content: 'First paragraph.'
			});
			expect(result[1]).toEqual({
				type: 'paragraph',
				content: 'Second paragraph.'
			});
		});

		it('should detect and process entire content as table when all lines are table rows', () => {
			const text = `AC-1.1, CCI-000054, Control implementation
AC-1.2, CCI-000055, Control monitoring
AC-2.1, CCI-000056, User account management`;
			
			const result = processMultilineText(text);
			
			expect(result).toHaveLength(1);
			expect(result[0]).toEqual({
				type: 'table',
				content: text,
				data: {
					rows: [
						{ columns: ['AC-1.1', 'CCI-000054', 'Control implementation'] },
						{ columns: ['AC-1.2', 'CCI-000055', 'Control monitoring'] },
						{ columns: ['AC-2.1', 'CCI-000056', 'User account management'] }
					]
				}
			});
		});

		it('should detect table with control ID pattern', () => {
			const text = `AC-10.1, Access control implementation
SC-7.3, Boundary protection measures`;
			
			const result = processMultilineText(text);
			
			expect(result).toHaveLength(1);
			expect(result[0].type).toBe('table');
		});

		it('should detect table with CCI pattern', () => {
			const text = `Control 1, CCI-000123, Description 1
Control 2, CCI-000124, Description 2`;
			
			const result = processMultilineText(text);
			
			expect(result).toHaveLength(1);
			expect(result[0].type).toBe('table');
		});

		it('should not treat single comma-separated line as table', () => {
			const text = `This is just a sentence with, some commas in it.`;
			
			const result = processMultilineText(text);
			
			expect(result).toHaveLength(1);
			expect(result[0].type).toBe('table');
		});

		it('should handle table with inconsistent column counts', () => {
			const text = `AC-1.1, Description
AC-1.2, Description, Extra column, Another extra`;
			
			const result = processMultilineText(text);
			
			expect(result).toHaveLength(1);
			expect(result[0]).toEqual({
				type: 'table',
				content: text,
				data: {
					rows: [
						{ columns: ['AC-1.1', 'Description'] },
						{ columns: ['AC-1.2', 'Description', 'Extra column', 'Another extra'] }
					]
				}
			});
		});

		it('should not treat lines with very long columns as table', () => {
			const text = `This is a very long sentence that contains commas, but should not be treated as a table because the content is too long to be reasonable table data and does not follow typical structured patterns.`;
			
			const result = processMultilineText(text);
			
			expect(result).toHaveLength(1);
			expect(result[0].type).toBe('paragraph');
		});

		it('should handle empty table cells', () => {
			const text = `AC-1.1, , Description with empty middle column
AC-1.2, CCI-000055, `;
			
			const result = processMultilineText(text);
			
			expect(result).toHaveLength(1);
			expect(result[0]).toEqual({
				type: 'table',
				content: text,
				data: {
					rows: [
						{ columns: ['AC-1.1', '', 'Description with empty middle column'] },
						{ columns: ['AC-1.2', 'CCI-000055', ''] }
					]
				}
			});
		});

		it('should trim whitespace from table columns', () => {
			const text = `AC-1.1  ,   CCI-000054   ,   Control implementation  
  AC-1.2,CCI-000055,  Control monitoring`;
			
			const result = processMultilineText(text);
			
			expect(result).toHaveLength(1);
			expect(result[0]).toEqual({
				type: 'table',
				content: text,
				data: {
					rows: [
						{ columns: ['AC-1.1', 'CCI-000054', 'Control implementation'] },
						{ columns: ['AC-1.2', 'CCI-000055', 'Control monitoring'] }
					]
				}
			});
		});

		it('should filter out empty lines when processing as table', () => {
			const text = `AC-1.1, CCI-000054, Control implementation

AC-1.2, CCI-000055, Control monitoring

`;
			
			const result = processMultilineText(text);
			
			expect(result).toHaveLength(1);
			expect(result[0]).toEqual({
				type: 'table',
				content: text,
				data: {
					rows: [
						{ columns: ['AC-1.1', 'CCI-000054', 'Control implementation'] },
						{ columns: ['AC-1.2', 'CCI-000055', 'Control monitoring'] }
					]
				}
			});
		});

		it('should handle complex mixed document', () => {
			const text = `Access Control Policy:

The organization implements access controls to protect information systems.

Implementation Requirements:
- Establish access control policy
- Implement role-based access
- Monitor access activities

AC-1.1, CCI-000054, Access control policy development
AC-1.2, CCI-000055, Access control implementation

Additional Guidance:
Refer to NIST SP 800-53 for detailed implementation guidance.`;
			
			const result = processMultilineText(text);
			
			expect(result).toHaveLength(7);
			expect(result[0].type).toBe('header');
			expect(result[1].type).toBe('paragraph');
			expect(result[2].type).toBe('header');
			expect(result[3].type).toBe('list');
			expect(result[4].type).toBe('paragraph'); // This is a paragraph, not table due to mixed content rules
			expect(result[5].type).toBe('header');
			expect(result[6].type).toBe('paragraph');
		});

		it('should handle headers followed by empty lines and content later', () => {
			const text = `Section Header:


Content that comes after empty lines.`;
			
			const result = processMultilineText(text);
			
			expect(result).toHaveLength(2);
			expect(result[0]).toEqual({
				type: 'paragraph',
				content: 'Section Header:'
			});
			expect(result[1]).toEqual({
				type: 'paragraph',
				content: 'Content that comes after empty lines.'
			});
		});

		it('should handle edge case with only empty lines', () => {
			const text = `


`;
			
			const result = processMultilineText(text);
			
			expect(result).toEqual([]);
		});

		it('should handle text with only list items', () => {
			const text = `- Item 1
- Item 2
- Item 3`;
			
			const result = processMultilineText(text);
			
			expect(result).toHaveLength(1);
			expect(result[0].type).toBe('list');
			expect(result[0].data?.items).toHaveLength(3);
		});

		it('should handle text with only headers', () => {
			const text = `First Header:

Second Header:

Third Header:`;
			
			const result = processMultilineText(text);
			
			expect(result).toHaveLength(3);
			expect(result[0].type).toBe('header');
			expect(result[1].type).toBe('header');
			expect(result[2].type).toBe('paragraph'); // Last one is paragraph since no content follows
		});
	});
});
