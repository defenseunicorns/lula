import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import { tmpdir } from 'os';
import { FileStore } from '../../cli/server/infrastructure/fileStore';
import * as yaml from 'js-yaml';

describe('FileStore Order Preservation', () => {
	let tempDir: string;
	let fileStore: FileStore;

	beforeEach(async () => {
		tempDir = fs.mkdtempSync(path.join(tmpdir(), 'lula-filestore-test-'));

		const metadata = {
			name: 'Test Control Set',
			description: 'Test control set for order preservation',
			version: '1.0.0',
			control_id_field: 'id',
			controlOrder: ['AC-3', 'AC-1', 'AC-7', 'AC-2']
		};

		fs.writeFileSync(path.join(tempDir, 'lula.yaml'), yaml.dump(metadata));

		const controlsDir = path.join(tempDir, 'controls');
		fs.mkdirSync(controlsDir, { recursive: true });

		const acDir = path.join(controlsDir, 'AC');
		fs.mkdirSync(acDir, { recursive: true });

		const controls = [
			{ id: 'AC-1', title: 'Access Control Foundation' },
			{ id: 'AC-2', title: 'Account Management' },
			{ id: 'AC-3', title: 'Access Control Policy' },
			{ id: 'AC-7', title: 'Account Lockout' }
		];

		controls.forEach((control) => {
			const filename = `${control.id}.yaml`;
			const filePath = path.join(acDir, filename);
			fs.writeFileSync(filePath, yaml.dump(control));
		});

		fileStore = new FileStore({ baseDir: tempDir });
	});

	afterEach(() => {
		if (fs.existsSync(tempDir)) {
			fs.rmSync(tempDir, { recursive: true, force: true });
		}
	});

	it('should load controls in the order specified by controlOrder metadata', async () => {
		const controls = await fileStore.loadAllControls();

		const controlIds = controls.map((c) => c.id);
		const expectedOrder = ['AC-3', 'AC-1', 'AC-7', 'AC-2'];

		expect(controlIds).toEqual(expectedOrder);
	});

	it('should handle missing controlOrder gracefully', async () => {
		const metadataPath = path.join(tempDir, 'lula.yaml');
		const metadata = yaml.load(fs.readFileSync(metadataPath, 'utf8')) as any;
		delete metadata.controlOrder;
		fs.writeFileSync(metadataPath, yaml.dump(metadata));

		fileStore = new FileStore({ baseDir: tempDir });

		const controls = await fileStore.loadAllControls();

		expect(controls).toHaveLength(4);

		const controlIds = controls.map((c) => c.id);
		expect(controlIds).toContain('AC-1');
		expect(controlIds).toContain('AC-2');
		expect(controlIds).toContain('AC-3');
		expect(controlIds).toContain('AC-7');
	});

	it('should handle controls not in controlOrder by placing them at the end', async () => {
		const acDir = path.join(tempDir, 'controls', 'AC');
		const newControl = { id: 'AC-5', title: 'New Control' };
		const filePath = path.join(acDir, 'AC-5.yaml');
		fs.writeFileSync(filePath, yaml.dump(newControl));

		fileStore = new FileStore({ baseDir: tempDir });

		const controls = await fileStore.loadAllControls();
		const controlIds = controls.map((c) => c.id);

		expect(controlIds.slice(0, 4)).toEqual(['AC-3', 'AC-1', 'AC-7', 'AC-2']);
		expect(controlIds).toContain('AC-5');
		expect(controlIds).toHaveLength(5);
	});
});
