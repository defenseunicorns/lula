import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import {
	processSpreadsheetData,
	parseCSV,
	processImportParameters
} from '../../cli/server/spreadsheetRoutes';
import { tmpdir } from 'os';

describe('CSV Import Order Preservation', () => {
	let tempDir: string;

	beforeEach(() => {
		tempDir = fs.mkdtempSync(path.join(tmpdir(), 'lula-test-'));
	});

	afterEach(() => {
		if (fs.existsSync(tempDir)) {
			fs.rmSync(tempDir, { recursive: true, force: true });
		}
	});

	it('should preserve the original spreadsheet row order', () => {
		const csvContent = `Control ID,Title,Description
AC-3,Access Control Policy,Develop and maintain access control policy
AC-1,Access Control Foundation,Foundation for access control
AC-7,Account Lockout,Implement account lockout measures
AC-2,Account Management,Manage user accounts and access
AC-15,Remote Access Control,Control remote access to systems
AC-6,Least Privilege,Implement least privilege principle`;

		const rawData = parseCSV(csvContent);
		const headers = rawData[0] as string[];

		const params = processImportParameters({
			controlIdField: 'Control ID',
			startRow: '1',
			controlSetName: 'Test Control Set',
			controlSetDescription: 'Test control set for order preservation'
		});

		const processedData = processSpreadsheetData(rawData, headers, 0, params);

		const expectedOrder = ['AC-3', 'AC-1', 'AC-7', 'AC-2', 'AC-15', 'AC-6'];
		const actualOrder = processedData.controls.map((control: any) => control['control-id']);

		expect(actualOrder).toEqual(expectedOrder);

		processedData.controls.forEach((control: any, index: number) => {
			expect(control._originalRowIndex).toBe(index + 1); // +1 because row 0 is headers
		});

		const sortedControls = [...processedData.controls].sort(
			(a: any, b: any) => (a._originalRowIndex || 0) - (b._originalRowIndex || 0)
		);
		const sortedOrder = sortedControls.map((control: any) => control['control-id']);
		expect(sortedOrder).toEqual(expectedOrder);
	});

	it('should preserve order within families', () => {
		const csvContent = `Control ID,Title,Description
CA-3,Security Assessment,Conduct security assessments
AC-1,Access Control Foundation,Foundation for access control
CA-1,Assessment Planning,Plan security assessments
AC-3,Access Control Policy,Develop and maintain access control policy
CA-7,Continuous Monitoring,Implement continuous monitoring
AC-2,Account Management,Manage user accounts and access`;

		const rawData = parseCSV(csvContent);
		const headers = rawData[0] as string[];

		const params = processImportParameters({
			controlIdField: 'Control ID',
			startRow: '1',
			controlSetName: 'Test Mixed Families',
			controlSetDescription: 'Test mixed families for order preservation'
		});

		const processedData = processSpreadsheetData(rawData, headers, 0, params);

		const acControls = processedData.families.get('AC') || [];
		const acOrder = acControls.map((control: any) => control['control-id']);
		expect(acOrder).toEqual(['AC-1', 'AC-3', 'AC-2']);

		const caControls = processedData.families.get('CA') || [];
		const caOrder = caControls.map((control: any) => control['control-id']);
		expect(caOrder).toEqual(['CA-3', 'CA-1', 'CA-7']);
	});
});
