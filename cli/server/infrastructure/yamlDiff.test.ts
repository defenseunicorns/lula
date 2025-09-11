// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Lula Authors

import { describe, expect, it, vi } from 'vitest';
import { createYamlDiff } from './yamlDiff';

describe('yamlDiff', () => {
	describe('createYamlDiff', () => {
		it('should detect no changes when YAML content is identical', () => {
			const yaml1 = `
name: Test Control
description: A test control
version: 1.0
`;
			const yaml2 = `
name: Test Control
description: A test control
version: 1.0
`;

			const result = createYamlDiff(yaml1, yaml2);

			expect(result.hasChanges).toBe(false);
			expect(result.changes).toHaveLength(0);
			expect(result.summary).toContain('No changes detected');
		});

		it('should detect simple value changes', () => {
			const yaml1 = `
name: Test Control
description: Original description
version: 1.0
`;
			const yaml2 = `
name: Test Control
description: Updated description
version: 1.0
`;

			const result = createYamlDiff(yaml1, yaml2);

			expect(result.hasChanges).toBe(true);
			expect(result.changes).toHaveLength(1);
			expect(result.changes[0].type).toBe('modified');
			expect(result.changes[0].path).toBe('description');
			expect(result.changes[0].oldValue).toBe('Original description');
			expect(result.changes[0].newValue).toBe('Updated description');
		});

		it('should detect added fields', () => {
			const yaml1 = `
name: Test Control
description: A test control
`;
			const yaml2 = `
name: Test Control
description: A test control
version: 1.0
category: security
`;

			const result = createYamlDiff(yaml1, yaml2);

			expect(result.hasChanges).toBe(true);
			expect(result.changes).toHaveLength(2);

			const addedChanges = result.changes.filter((c) => c.type === 'added');
			expect(addedChanges).toHaveLength(2);
			expect(addedChanges.some((c) => c.path === 'version' && c.newValue === 1.0)).toBe(true);
			expect(addedChanges.some((c) => c.path === 'category' && c.newValue === 'security')).toBe(
				true
			);
		});

		it('should detect removed fields', () => {
			const yaml1 = `
name: Test Control
description: A test control
version: 1.0
category: security
`;
			const yaml2 = `
name: Test Control
description: A test control
`;

			const result = createYamlDiff(yaml1, yaml2);

			expect(result.hasChanges).toBe(true);
			expect(result.changes).toHaveLength(2);

			const removedChanges = result.changes.filter((c) => c.type === 'removed');
			expect(removedChanges).toHaveLength(2);
			expect(removedChanges.some((c) => c.path === 'version' && c.oldValue === 1.0)).toBe(true);
			expect(removedChanges.some((c) => c.path === 'category' && c.oldValue === 'security')).toBe(
				true
			);
		});

		it('should detect nested object changes', () => {
			const yaml1 = `
name: Test Control
metadata:
  author: John Doe
  created: 2023-01-01
  tags:
    - security
    - compliance
`;
			const yaml2 = `
name: Test Control
metadata:
  author: Jane Smith
  created: 2023-01-01
  tags:
    - security
    - audit
    - compliance
`;

			const result = createYamlDiff(yaml1, yaml2);

			expect(result.hasChanges).toBe(true);

			// Should detect author change
			const authorChange = result.changes.find((c) => c.path === 'metadata.author');
			expect(authorChange?.type).toBe('modified');
			expect(authorChange?.oldValue).toBe('John Doe');
			expect(authorChange?.newValue).toBe('Jane Smith');

			// Should detect tags array change
			const tagsChange = result.changes.find((c) => c.path === 'metadata.tags');
			expect(tagsChange?.type).toBe('modified');
			// Original implementation doesn't dive deep into array changes
		});

		it('should handle array changes', () => {
			const yaml1 = `
tags:
  - security
  - compliance
`;
			const yaml2 = `
tags:
  - security
  - audit
  - privacy
`;

			const result = createYamlDiff(yaml1, yaml2);

			expect(result.hasChanges).toBe(true);

			const tagsChange = result.changes.find((c) => c.path === 'tags');
			expect(tagsChange?.type).toBe('modified');
		});

		it('should handle different data types', () => {
			const yaml1 = `
name: Test Control
version: "1.0"
enabled: true
count: 5
`;
			const yaml2 = `
name: Test Control
version: 2.0
enabled: false
count: "10"
`;

			const result = createYamlDiff(yaml1, yaml2);

			expect(result.hasChanges).toBe(true);
			expect(result.changes).toHaveLength(3);

			const versionChange = result.changes.find((c) => c.path === 'version');
			expect(versionChange?.oldValue).toBe('1.0');
			expect(versionChange?.newValue).toBe(2.0);

			const enabledChange = result.changes.find((c) => c.path === 'enabled');
			expect(enabledChange?.oldValue).toBe(true);
			expect(enabledChange?.newValue).toBe(false);

			const countChange = result.changes.find((c) => c.path === 'count');
			expect(countChange?.oldValue).toBe(5);
			expect(countChange?.newValue).toBe('10');
		});

		it('should handle null and undefined values', () => {
			const yaml1 = `
name: Test Control
description: null
category: ~
`;
			const yaml2 = `
name: Test Control
description: "Now has value"
category: security
`;

			const result = createYamlDiff(yaml1, yaml2);

			expect(result.hasChanges).toBe(true);

			const descChange = result.changes.find((c) => c.path === 'description');
			expect(descChange?.oldValue).toBeNull();
			expect(descChange?.newValue).toBe('Now has value');

			const categoryChange = result.changes.find((c) => c.path === 'category');
			expect(categoryChange?.oldValue).toBeNull();
			expect(categoryChange?.newValue).toBe('security');
		});

		it('should handle empty YAML documents', () => {
			const result1 = createYamlDiff('', '');
			expect(result1.hasChanges).toBe(false);

			const result2 = createYamlDiff('', 'name: Test');
			expect(result2.hasChanges).toBe(true);

			const result3 = createYamlDiff('name: Test', '');
			expect(result3.hasChanges).toBe(true);
		});

		it('should handle array files differently', () => {
			const yaml1 = '';
			const yaml2 = `
- uuid: test-1
  name: First mapping
- uuid: test-2
  name: Second mapping
`;

			const result = createYamlDiff(yaml1, yaml2, true);

			expect(result.hasChanges).toBe(true);
			expect(result.changes).toHaveLength(1);
			expect(result.changes[0].type).toBe('modified');
		});

		it('should handle malformed YAML gracefully', () => {
			// Mock console.error to suppress stderr output during test
			const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
			
			const yaml1 = 'valid: yaml';
			const yaml2 = 'invalid_yaml: {\n  unclosed_bracket: [';

			const result = createYamlDiff(yaml1, yaml2);

			expect(result.hasChanges).toBe(false);
			expect(result.summary).toBe('Error parsing YAML content');
			
			// Restore console.error
			consoleSpy.mockRestore();
		});

		it('should generate meaningful summaries', () => {
			const yaml1 = `
name: Test Control
version: 1.0
`;
			const yaml2 = `
name: Updated Control
version: 2.0
category: security
`;

			const result = createYamlDiff(yaml1, yaml2);

			expect(result.summary).toContain('2 modified');
			expect(result.summary).toContain('1 added');
			expect(result.changes).toHaveLength(3);
		});

		it('should handle deeply nested objects', () => {
			const yaml1 = `
config:
  security:
    authentication:
      method: password
      required: true
    authorization:
      roles:
        - admin
        - user
`;
			const yaml2 = `
config:
  security:
    authentication:
      method: oauth
      required: true
      provider: google
    authorization:
      roles:
        - admin
        - user
        - guest
`;

			const result = createYamlDiff(yaml1, yaml2);

			expect(result.hasChanges).toBe(true);

			// Should detect method change
			const methodChange = result.changes.find(
				(c) => c.path === 'config.security.authentication.method'
			);
			expect(methodChange?.type).toBe('modified');
			expect(methodChange?.oldValue).toBe('password');
			expect(methodChange?.newValue).toBe('oauth');

			// Should detect added provider
			const providerChange = result.changes.find(
				(c) => c.path === 'config.security.authentication.provider'
			);
			expect(providerChange?.type).toBe('added');
			expect(providerChange?.newValue).toBe('google');

			// Should detect roles array change
			const rolesChange = result.changes.find(
				(c) => c.path === 'config.security.authorization.roles'
			);
			expect(rolesChange?.type).toBe('modified');
		});

		it('should detect array item additions and removals correctly', () => {
			const yaml1 = `
items:
  - id: 1
    name: First
  - id: 2
    name: Second
`;
			const yaml2 = `
items:
  - id: 1
    name: First Modified
  - id: 3
    name: Third
`;

			const result = createYamlDiff(yaml1, yaml2);

			expect(result.hasChanges).toBe(true);
		});

		it('should handle complex mixed data structures', () => {
			const yaml1 = `
control:
  id: AC-1
  properties:
    - name: prop1
      value: original
      metadata:
        created: 2023-01-01
        tags: [a, b]
  settings:
    enabled: true
    level: 3
`;
			const yaml2 = `
control:
  id: AC-1
  properties:
    - name: prop1
      value: updated
      metadata:
        created: 2023-01-01
        tags: [a, b, c]
        author: John
  settings:
    enabled: false
    level: 5
    debug: true
`;

			const result = createYamlDiff(yaml1, yaml2);

			expect(result.hasChanges).toBe(true);
			expect(result.changes.length).toBeGreaterThan(0);

			// Should detect individual settings changes (more granular)
			const enabledChange = result.changes.find((c) => c.path === 'control.settings.enabled');
			expect(enabledChange?.type).toBe('modified');

			const levelChange = result.changes.find((c) => c.path === 'control.settings.level');
			expect(levelChange?.type).toBe('modified');

			const debugChange = result.changes.find((c) => c.path === 'control.settings.debug');
			expect(debugChange?.type).toBe('added');
		});
	});
});
