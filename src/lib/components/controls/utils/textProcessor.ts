export interface ProcessedSection {
	type: 'header' | 'paragraph' | 'table' | 'list';
	content: string;
	data?: any;
}

export interface TableRow {
	columns: string[];
}

export function processMultilineText(text: string): ProcessedSection[] {
	if (!text) return [];
	
	// First check if the entire content is a table
	if (isEntireContentTable(text)) {
		return processAsTable(text);
	}
	
	const lines = text.split('\n');
	const sections: ProcessedSection[] = [];
	let currentSection: string[] = [];
	let currentType: 'paragraph' | 'list' = 'paragraph';
	
	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];
		const trimmedLine = line.trim();
		
		// Check for empty lines
		if (!trimmedLine) {
			// Process accumulated section if any
			if (currentSection.length > 0) {
				flushSection();
			}
			continue;
		}
		
		// Check for headers (lines ending with colon and followed by content)
		if (trimmedLine.endsWith(':') && i < lines.length - 1) {
			const nextLine = lines[i + 1]?.trim();
			// Only treat as header if next line has content or is followed by content
			if (nextLine || (i + 2 < lines.length && lines[i + 2]?.trim())) {
				// Flush any accumulated section
				if (currentSection.length > 0) {
					flushSection();
				}
				
				// Add header
				sections.push({
					type: 'header',
					content: trimmedLine.slice(0, -1) // Remove the colon
				});
				continue;
			}
		}
		
		// Check for list items
		if (isListItem(trimmedLine)) {
			if (currentType !== 'list') {
				// Flush previous section if not list
				if (currentSection.length > 0) {
					flushSection();
				}
				currentType = 'list';
			}
			currentSection.push(trimmedLine);
			continue;
		}
		
		// Default to paragraph
		if (currentType === 'list') {
			// Flush previous section if switching from list to paragraph
			if (currentSection.length > 0) {
				flushSection();
			}
			currentType = 'paragraph';
		}
		
		currentSection.push(line); // Preserve original line formatting for paragraphs
	}
	
	// Flush any remaining section
	if (currentSection.length > 0) {
		flushSection();
	}
	
	function flushSection() {
		if (currentType === 'list') {
			const items = currentSection.map(line => {
				// Remove common list prefixes
				return line.replace(/^[-*•]\s*/, '')
					.replace(/^\d+\.\s*/, '')
					.replace(/^[a-zA-Z]\.\s*/, '');
			});
			
			sections.push({
				type: 'list',
				content: currentSection.join('\n'),
				data: { items }
			});
		} else {
			sections.push({
				type: 'paragraph',
				content: currentSection.join('\n').trim()
			});
		}
		
		currentSection = [];
	}
	
	return sections;
}

function isEntireContentTable(text: string): boolean {
	const lines = text.split('\n').filter(line => line.trim());
	if (lines.length === 0) return false;
	
	// Check if ALL non-empty lines are table rows
	return lines.every(line => isTableRow(line.trim()));
}

function processAsTable(text: string): ProcessedSection[] {
	const lines = text.split('\n').filter(line => line.trim());
	const rows: TableRow[] = lines.map(line => ({
		columns: line.split(',').map(col => col.trim())
	}));
	
	return [{
		type: 'table',
		content: text,
		data: { rows }
	}];
}

function isTableRow(line: string): boolean {
	// Check if line contains comma-separated values
	// Must have at least 2 commas and consistent structure
	const parts = line.split(',');
	if (parts.length < 2) return false;
	
	// Common patterns for table data:
	// - Control IDs (AC-10.1)
	// - CCI codes (CCI-000054)
	// - Short descriptive text
	const hasControlPattern = /^[A-Z]{2}-\d+(\.\d+)?/.test(parts[0].trim());
	const hasCCIPattern = parts.some(part => /^CCI-\d+/.test(part.trim()));
	
	// If it looks like structured data with consistent separators
	return hasControlPattern || hasCCIPattern || 
		(parts.length >= 2 && parts.every(p => p.trim().length > 0 && p.trim().length < 100));
}

function isListItem(line: string): boolean {
	// Check for common list patterns
	return /^[-*•]\s+/.test(line) || // Bullet points
		/^\d+\.\s+/.test(line) || // Numbered lists
		/^[a-zA-Z]\.\s+/.test(line) || // Letter lists
		/^\[SELECT FROM:/.test(line) || // Special NIST format
		/^Examine:/.test(line) ||
		/^Interview:/.test(line) ||
		/^Test:/.test(line);
}