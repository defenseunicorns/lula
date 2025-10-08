<script lang="ts">
	import { CloudUpload, Draggable } from 'carbon-icons-svelte';
	import { createEventDispatcher } from 'svelte';

	const dispatch = createEventDispatcher();

	// File data
	let fileData: File | null = null;
	let fileName = '';
	let selectedSheet = '';
	let sheets: string[] = [];
	let fields: string[] = [];
	let sampleData: any[] = [];
	let controlCount = 0;
	let rowPreviews: { row: number; preview: string }[] = [];

	// Field configuration for tabs
	type TabAssignment = 'overview' | 'implementation' | 'mappings' | 'custom' | null;

	// Store fields for justification
	let justificationFields: string[] = [];
	let fieldConfigs = new Map<
		string,
		{
			originalName: string;
			tab: TabAssignment;
			displayOrder: number;
			fieldType: 'text' | 'textarea' | 'select' | 'date' | 'number' | 'boolean';
			required: boolean;
		}
	>();

	// Options
	let headerRow = 1;
	let controlIdField = ''; // Start empty to force selection
	let controlSetName = '';
	let controlSetDescription = '';

	// UI State
	let isLoading = false;
	let errorMessage = '';
	let successMessage = '';
	let showFieldMapping = false;
	let dragActive = false;

	// Drag and drop state
	let draggedField: string | null = null;
	let dragOverTab: TabAssignment | null = null;
	let dragOverField: string | null = null;

	// Reset all form state
	function resetFormState() {
		// Reset field data
		fields = [];
		sampleData = [];
		controlCount = 0;
		fieldConfigs.clear();
		fieldConfigs = new Map(); // Force reactivity
		justificationFields = [];

		// Reset selections
		controlIdField = '';

		// Reset UI state
		errorMessage = '';
		successMessage = '';
		draggedField = null;
		dragOverTab = null;
		dragOverField = null;
	}

	function handleDragOver(e: DragEvent) {
		e.preventDefault();
		dragActive = true;
	}

	function handleDragLeave() {
		dragActive = false;
	}

	function handleDrop(e: DragEvent) {
		e.preventDefault();
		dragActive = false;

		const files = e.dataTransfer?.files;
		if (files && files.length > 0) {
			handleFile(files[0]);
		}
	}

	function handleFileSelect(e: Event) {
		const target = e.target as HTMLInputElement;
		if (target.files && target.files.length > 0) {
			handleFile(target.files[0]);
		}
	}

	async function handleFile(file: File) {
		// Reset all form state when loading a new file
		resetFormState();

		fileName = file.name;
		fileData = file;
		errorMessage = '';
		isLoading = true;

		// Auto-populate control set name from filename (remove extension)
		controlSetName = fileName.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' ');
		controlSetDescription = `Imported from ${fileName}`;

		try {
			// Send file to backend for parsing
			const formData = new FormData();
			formData.append('file', file);

			const response = await fetch('/api/parse-excel', {
				method: 'POST',
				body: formData
			});

			if (!response.ok) {
				const error = await response.json();
				throw new Error(error.error || 'Failed to parse file');
			}

			const result = await response.json();

			sheets = result.sheets || [];
			selectedSheet = result.selectedSheet || sheets[0];
			rowPreviews = result.rowPreviews || [];

			// Set default header row
			if (rowPreviews.length > 0 && headerRow === 1) {
				headerRow = rowPreviews[0].row;
			}

			// Load fields from the selected sheet
			await loadSheetData();
			showFieldMapping = true;
		} catch (error) {
			errorMessage = 'Error reading file: ' + (error as Error).message;
		} finally {
			isLoading = false;
		}
	}

	async function loadSheetData() {
		if (!fileData || !selectedSheet) return;

		isLoading = true;

		// Clear previous field configurations when changing sheets
		fieldConfigs.clear();
		fieldConfigs = new Map(); // Force reactivity
		controlIdField = ''; // Reset control ID field selection

		try {
			const previewFormData = new FormData();
			previewFormData.append('file', fileData);
			previewFormData.append('sheetName', selectedSheet);

			const previewResponse = await fetch('/api/parse-excel-sheet-previews', {
				method: 'POST',
				body: previewFormData
			});

			if (previewResponse.ok) {
				const previewResult = await previewResponse.json();
				rowPreviews = previewResult.rowPreviews || [];

				if (rowPreviews.length > 0 && !rowPreviews.some((p) => p.row === headerRow)) {
					headerRow = rowPreviews[0].row;
				}
			} else {
				const error = await previewResponse.json();
				throw new Error(error.error || 'Failed to load sheet previews');
			}

			const formData = new FormData();
			formData.append('file', fileData);
			formData.append('sheetName', selectedSheet);
			formData.append('headerRow', headerRow.toString());

			const response = await fetch('/api/parse-excel-sheet', {
				method: 'POST',
				body: formData
			});

			if (!response.ok) {
				const error = await response.json();
				throw new Error(error.error || 'Failed to parse sheet');
			}

			const result = await response.json();

			fields = result.fields || [];
			sampleData = result.sampleData || [];
			controlCount = result.controlCount || 0;

			// Initialize field configurations with smart defaults
			fields.forEach((field, index) => {
				const lowerField = field.toLowerCase();
				let tab: TabAssignment = 'custom';
				let fieldType: 'text' | 'textarea' | 'select' | 'date' | 'number' | 'boolean' = 'text';

				// Smart tab assignment based on field name
				if (
					lowerField.includes('implementation') ||
					lowerField.includes('status') ||
					lowerField.includes('narrative') ||
					lowerField.includes('guidance')
				) {
					tab = 'implementation';
				} else if (
					lowerField.includes('id') ||
					lowerField.includes('title') ||
					lowerField.includes('family') ||
					lowerField.includes('cci') ||
					lowerField.includes('control') ||
					lowerField.includes('acronym')
				) {
					tab = 'overview';
				}

				// Smart field type detection
				if (
					lowerField.includes('description') ||
					lowerField.includes('narrative') ||
					lowerField.includes('guidance') ||
					lowerField.includes('statement')
				) {
					fieldType = 'textarea';
				} else if (
					lowerField.includes('status') ||
					lowerField.includes('type') ||
					lowerField.includes('designation')
				) {
					fieldType = 'select';
				} else if (lowerField.includes('date')) {
					fieldType = 'date';
				} else if (lowerField.includes('count') || lowerField.includes('number')) {
					fieldType = 'number';
				}

				fieldConfigs.set(field, {
					originalName: field,
					tab,
					displayOrder: index,
					fieldType,
					required: lowerField.includes('id') || lowerField.includes('title')
				});
			});

			// Trigger reactivity for fieldConfigs
			fieldConfigs = fieldConfigs;

			// Reset controlIdField if it doesn't exist in the new sheet
			if (controlIdField && !fields.includes(controlIdField)) {
				controlIdField = '';
			}

			// Default controlIdField to "AP Acronym" if it exists, has short values, and is unique
			if (!controlIdField && fields.includes('AP Acronym')) {
				const hasShortValues =
					!sampleData.length ||
					sampleData.every((row) => !row['AP Acronym'] || String(row['AP Acronym']).length < 25);
				const nonEmptyValues = sampleData
					.map((row) => row['AP Acronym'])
					.filter((v) => v != null && v !== '' && String(v).trim() !== '');
				const uniqueValues = new Set(nonEmptyValues);
				const hasUniqueValues =
					!nonEmptyValues.length || uniqueValues.size === nonEmptyValues.length;
				const hasNonEmptyValues = nonEmptyValues.length > 0;
				if (hasShortValues && hasUniqueValues && hasNonEmptyValues) {
					controlIdField = 'AP Acronym';
				}
			}
		} catch (error) {
			errorMessage = 'Error loading sheet data: ' + (error as Error).message;
		} finally {
			isLoading = false;
		}
	}

	function cleanFieldName(fieldName: string): string {
		if (!fieldName) return fieldName;

		// Always clean and apply kebab-case
		let cleaned = fieldName.trim().replace(/\r?\n/g, ' ').replace(/\s+/g, ' ').trim();

		return toKebabCase(cleaned);
	}

	function toKebabCase(str: string): string {
		return str
			.replace(/\W+/g, ' ')
			.split(/ |\s/)
			.map((word) => word.toLowerCase())
			.join('-');
	}

	// Drag and drop handlers for field assignment
	function handleFieldDragStart(e: DragEvent, field: string) {
		draggedField = field;
		if (e.dataTransfer) {
			e.dataTransfer.effectAllowed = 'move';
			e.dataTransfer.setData('text/plain', field);
		}
	}

	function handleFieldDragEnd() {
		draggedField = null;
		dragOverTab = null;
		dragOverField = null;
	}

	function handleTabDragOver(e: DragEvent, tab: TabAssignment) {
		e.preventDefault();
		dragOverTab = tab;
		if (e.dataTransfer) {
			e.dataTransfer.dropEffect = 'move';
		}
	}

	function handleTabDragLeave() {
		dragOverTab = null;
	}

	function handleTabDrop(e: DragEvent, tab: TabAssignment, targetIndex?: number) {
		e.preventDefault();
		if (draggedField && fieldConfigs.has(draggedField)) {
			const config = fieldConfigs.get(draggedField)!;

			// Special handling for mappings tab
			if (tab === 'mappings') {
				// Add to justificationFields if not already there
				if (!justificationFields.includes(draggedField)) {
					justificationFields = [...justificationFields, draggedField];
				}
			} else {
				config.tab = tab;

				// If dropping at a specific position, update display orders
				if (targetIndex !== undefined && tab !== null) {
					// Get all fields in this tab
					const tabFields = Array.from(fieldConfigs.entries())
						.filter(([_, cfg]) => cfg.tab === tab)
						.sort((a, b) => a[1].displayOrder - b[1].displayOrder);

					// Remove the dragged field from the list if it was already in this tab
					const filteredFields = tabFields.filter(([field]) => field !== draggedField);

					// Insert at the target position
					filteredFields.splice(targetIndex, 0, [draggedField, config]);

					// Update display orders for all fields in this tab
					filteredFields.forEach(([field, cfg], index) => {
						cfg.displayOrder = index;
						fieldConfigs.set(field, cfg);
					});
				} else if (tab !== null) {
					// If no specific position, add to end
					const maxOrder = Math.max(
						0,
						...Array.from(fieldConfigs.values())
							.filter((cfg) => cfg.tab === tab)
							.map((cfg) => cfg.displayOrder)
					);
					config.displayOrder = maxOrder + 1;
				}

				fieldConfigs.set(draggedField, config);
				fieldConfigs = fieldConfigs; // Trigger reactivity
			}
		}
		draggedField = null;
		dragOverTab = null;
	}

	function handleFieldDragOver(e: DragEvent, field: string) {
		e.preventDefault();
		e.stopPropagation();
		dragOverField = field;
	}

	function handleFieldDragLeave() {
		dragOverField = null;
	}

	function handleFieldDrop(e: DragEvent, targetField: string, tab: TabAssignment) {
		e.preventDefault();
		e.stopPropagation();

		if (draggedField && draggedField !== targetField) {
			// Find the index of the target field
			const tabFields = Array.from(fieldConfigs.entries())
				.filter(([_, cfg]) => cfg.tab === tab)
				.sort((a, b) => a[1].displayOrder - b[1].displayOrder);

			const targetIndex = tabFields.findIndex(([field]) => field === targetField);
			if (targetIndex !== -1) {
				handleTabDrop(e, tab, targetIndex);
			}
		}
		dragOverField = null;
	}

	async function importSpreadsheet() {
		if (!fileData || !fileName) return;

		// Validate required fields
		if (!controlIdField) {
			errorMessage = 'Please select a Control ID field before importing';
			successMessage = ''; // Clear any previous success message
			return;
		}

		if (!controlSetName || controlSetName.trim() === '') {
			errorMessage = 'Please enter a Control Set Name before importing';
			successMessage = ''; // Clear any previous success message
			return;
		}

		isLoading = true;
		errorMessage = '';
		successMessage = '';

		try {
			const formData = new FormData();

			// Add the file
			formData.append('file', fileData, fileName);

			// Add configuration
			formData.append('controlIdField', controlIdField);
			formData.append('startRow', headerRow.toString());
			formData.append('sheetName', selectedSheet); // Add the selected sheet name
			formData.append('namingConvention', 'kebab-case');
			formData.append('skipEmpty', 'true');
			formData.append('skipEmptyRows', 'true');
			formData.append('controlSetName', controlSetName || fileName.replace(/\.[^.]+$/, ''));
			formData.append(
				'controlSetDescription',
				controlSetDescription || `Imported from ${fileName}`
			);

			// Add field schema configuration - include all fields that are assigned to a tab
			const fieldSchema = Array.from(fieldConfigs.entries())
				.filter(([_field, config]) => config.tab !== null)
				.map(([field, config]) => ({
					fieldName: cleanFieldName(field),
					...config
				}));
			formData.append('fieldSchema', JSON.stringify(fieldSchema));

			// Add justification fields
			formData.append(
				'justificationFields',
				JSON.stringify(justificationFields.map((field) => cleanFieldName(field)))
			);

			let response: Response;
			try {
				response = await fetch('/api/import-spreadsheet', {
					method: 'POST',
					body: formData
				});
				if (!response.ok) {
					const error = await response.json();
					throw new Error(error.error || 'Import failed');
				}

				const result = await response.json();
				successMessage = `Successfully imported ${result.controlCount} controls into ${result.families.length} families`;

				// Dispatch event to parent
				dispatch('created', { path: result.outputDir });
			} catch (error) {
				console.error('Error importing spreadsheet:', error);
			}
		} catch (error) {
			errorMessage = 'Error importing spreadsheet: ' + (error as Error).message;
		} finally {
			isLoading = false;
		}
	}
</script>

<div class="space-y-6">
	<!-- File Upload Area -->
	<div
		on:dragover={handleDragOver}
		on:dragleave={handleDragLeave}
		on:drop={handleDrop}
		role="button"
		tabindex="0"
		class="relative"
	>
		<label
			class="flex flex-col items-center justify-center w-full h-64 border-2 border-dashed rounded-lg cursor-pointer transition-all duration-300 {dragActive
				? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
				: 'border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600'}"
		>
			<div class="flex flex-col items-center justify-center pt-5 pb-6">
				<CloudUpload class="w-8 h-8 mb-4 text-gray-500 dark:text-gray-400" />
				<p class="mb-2 text-sm text-gray-500 dark:text-gray-400">
					<span class="font-semibold">Click to upload</span> or drag and drop
				</p>
				<p class="text-xs text-gray-500 dark:text-gray-400">XLSX, XLS or CSV files</p>
			</div>
			<input on:change={handleFileSelect} type="file" class="hidden" accept=".xlsx,.xls,.csv" />
		</label>
	</div>

	{#if fileName}
		<div
			class="p-4 text-sm text-blue-800 rounded-lg bg-blue-50 dark:bg-gray-800 dark:text-blue-400"
		>
			<div class="flex items-center">
				<svg
					class="flex-shrink-0 inline w-4 h-4 mr-3"
					aria-hidden="true"
					xmlns="http://www.w3.org/2000/svg"
					fill="currentColor"
					viewBox="0 0 20 20"
				>
					<path
						d="M10 .5a9.5 9.5 0 1 0 9.5 9.5A9.51 9.51 0 0 0 10 .5ZM9.5 4a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3ZM12 15H8a1 1 0 0 1 0-2h1v-3H8a1 1 0 0 1 0-2h2a1 1 0 0 1 1 1v4h1a1 1 0 0 1 0 2Z"
					/>
				</svg>
				<div>
					<span class="font-medium">File loaded:</span>
					{fileName}
					<div class="mt-1">
						<span class="font-medium">Sheets:</span>
						{sheets.length} |
						<span class="font-medium">Fields:</span>
						{fields.length} |
						<span class="font-medium">Controls found:</span>
						{controlCount}
					</div>
				</div>
			</div>
		</div>
	{/if}

	{#if errorMessage}
		<div class="p-4 text-sm text-red-800 rounded-lg bg-red-50 dark:bg-gray-800 dark:text-red-400">
			<div class="flex items-center">
				<svg
					class="flex-shrink-0 inline w-4 h-4 mr-3"
					aria-hidden="true"
					xmlns="http://www.w3.org/2000/svg"
					fill="currentColor"
					viewBox="0 0 20 20"
				>
					<path
						d="M10 .5a9.5 9.5 0 1 0 9.5 9.5A9.51 9.51 0 0 0 10 .5ZM9.5 4a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3ZM12 15H8a1 1 0 0 1 0-2h1v-3H8a1 1 0 0 1 0-2h2a1 1 0 0 1 1 1v4h1a1 1 0 0 1 0 2Z"
					/>
				</svg>
				<span>{errorMessage}</span>
			</div>
		</div>
	{/if}

	{#if successMessage}
		<div
			class="p-4 text-sm text-green-800 rounded-lg bg-green-50 dark:bg-gray-800 dark:text-green-400"
		>
			<div class="flex items-center">
				<svg
					class="flex-shrink-0 inline w-4 h-4 mr-3"
					aria-hidden="true"
					xmlns="http://www.w3.org/2000/svg"
					fill="currentColor"
					viewBox="0 0 20 20"
				>
					<path
						d="M10 .5a9.5 9.5 0 1 0 9.5 9.5A9.51 9.51 0 0 0 10 .5ZM9.5 4a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3ZM12 15H8a1 1 0 0 1 0-2h1v-3H8a1 1 0 0 1 0-2h2a1 1 0 0 1 1 1v4h1a1 1 0 0 1 0 2Z"
					/>
				</svg>
				<span>{successMessage}</span>
			</div>
		</div>
	{/if}

	{#if showFieldMapping && fields.length > 0}
		<!-- Import Options -->
		<div
			class="bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-900 rounded-lg p-4 border border-gray-200 dark:border-gray-700"
		>
			<h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">Import Options</h3>

			<!-- Control Set Details -->
			<div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
				<div>
					<label
						for="controlSetName"
						class="block mb-2 text-sm font-medium text-gray-900 dark:text-white"
					>
						Control Set Name <span class="text-red-500">*</span>
					</label>
					<input
						type="text"
						id="controlSetName"
						bind:value={controlSetName}
						placeholder="e.g., NIST 800-53 Rev 4"
						class="bg-white border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5 dark:bg-gray-600 dark:border-gray-500 dark:text-white"
						required
					/>
					<p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
						This will be used as the display name and folder name
					</p>
				</div>

				<div>
					<label
						for="controlSetDescription"
						class="block mb-2 text-sm font-medium text-gray-900 dark:text-white"
					>
						Description
					</label>
					<input
						type="text"
						id="controlSetDescription"
						bind:value={controlSetDescription}
						placeholder="Optional description"
						class="bg-white border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5 dark:bg-gray-600 dark:border-gray-500 dark:text-white"
					/>
					<p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
						Brief description of this control set
					</p>
				</div>
			</div>

			<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
				<div>
					<label for="sheet" class="block mb-2 text-sm font-medium text-gray-900 dark:text-white">
						Sheet
					</label>
					<select
						id="sheet"
						bind:value={selectedSheet}
						on:change={async () => {
							await loadSheetData();
						}}
						class="bg-white border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5 dark:bg-gray-600 dark:border-gray-500 dark:text-white"
					>
						{#each sheets as sheet (sheet)}
							<option value={sheet}>{sheet}</option>
						{/each}
					</select>
					<p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
						Select which worksheet contains your control data
					</p>
				</div>

				<div>
					<label
						for="headerRow"
						class="block mb-2 text-sm font-medium text-gray-900 dark:text-white"
					>
						Select Header Row
					</label>
					<select
						id="headerRow"
						bind:value={headerRow}
						on:change={loadSheetData}
						class="bg-white border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5 dark:bg-gray-600 dark:border-gray-500 dark:text-white"
					>
						{#each rowPreviews as preview (preview.row)}
							<option value={preview.row}>
								Row {preview.row}: {preview.preview}
							</option>
						{/each}
					</select>
					<p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
						Select the row containing column headers
					</p>
				</div>

				<div>
					<label
						for="controlIdField"
						class="block mb-2 text-sm font-medium text-gray-900 dark:text-white"
					>
						Control ID Field <span class="text-red-500">*</span>
					</label>
					<select
						id="controlIdField"
						bind:value={controlIdField}
						class="bg-white border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5 dark:bg-gray-600 dark:border-gray-500 dark:text-white {!controlIdField
							? 'border-red-500'
							: ''}"
						required
					>
						<option value="" disabled>Select Control ID field</option>
						{#each fields as field (field)}
							{@const exampleValue =
								sampleData.length > 0 && sampleData[0][field]
									? String(sampleData[0][field]).slice(0, 30)
									: ''}
							{@const hasShortValues =
								!sampleData.length ||
								sampleData.every((row) => !row[field] || String(row[field]).length < 25)}
							{@const nonEmptyValues = sampleData
								.map((row) => row[field])
								.filter((v) => v != null && v !== '' && String(v).trim() !== '')}
							{@const uniqueValues = new Set(nonEmptyValues)}
							{@const hasUniqueValues =
								!nonEmptyValues.length || uniqueValues.size === nonEmptyValues.length}
							{@const hasNonEmptyValues = nonEmptyValues.length > 0}
							{#if hasShortValues && hasUniqueValues && hasNonEmptyValues}
								<option value={field}>
									{field}{exampleValue ? ` (e.g., ${exampleValue})` : ''}
								</option>
							{/if}
						{/each}
					</select>
					<p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
						Column containing unique control identifiers (e.g., AC-1, SC-7)
					</p>
				</div>
			</div>
		</div>

		<!-- Field Configuration -->
		<div
			class="bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-900 rounded-lg p-4 border border-gray-200 dark:border-gray-700"
		>
			<h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-2">Organize Fields</h3>
			<p class="text-sm text-gray-600 dark:text-gray-400 mb-4">
				Drag fields to organize them. <strong>Overview fields</strong> will appear as table columns in
				the controls list.
			</p>

			<!-- Column Layout -->
			<div class="grid grid-cols-1 lg:grid-cols-5 gap-4">
				<!-- Excluded Fields Column -->
				<div
					class="border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800"
				>
					<div
						class="p-3 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700 rounded-t-lg"
					>
						<h4 class="text-sm font-semibold text-gray-700 dark:text-gray-300">Excluded Fields</h4>
						<p class="text-xs text-gray-500 dark:text-gray-400 mt-1">Not imported</p>
					</div>
					<div
						class="p-3 min-h-[400px] max-h-[600px] overflow-y-auto space-y-2 transition-colors
              {dragOverTab === null ? 'bg-gray-100 dark:bg-gray-800' : ''}"
						on:dragover={(e) => handleTabDragOver(e, null)}
						on:dragleave={handleTabDragLeave}
						on:drop={(e) => handleTabDrop(e, null)}
						role="region"
						aria-label="Excluded fields drop zone"
					>
						{#each fields.filter((f) => !fieldConfigs.get(f) || fieldConfigs.get(f)?.tab === null) as field (field)}
							<div
								draggable="true"
								on:dragstart={(e) => handleFieldDragStart(e, field)}
								on:dragend={handleFieldDragEnd}
								role="button"
								aria-label="Drag {field} field"
								tabindex="0"
								class="flex items-center px-3 py-2 bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 rounded text-sm cursor-move hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors opacity-75"
							>
								<svg class="w-3 h-3 mr-2 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
									<path
										d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z"
									/>
								</svg>
								<span class="truncate line-through">{field}</span>
								{#if field === controlIdField}
									<span class="ml-auto text-xs text-blue-600 dark:text-blue-400">ID</span>
								{/if}
							</div>
						{/each}
						{#if fields.filter((f) => !fieldConfigs.get(f) || fieldConfigs.get(f)?.tab === null).length === 0}
							<p class="text-xs text-gray-400 dark:text-gray-500 text-center py-4">
								No excluded fields
							</p>
						{/if}
					</div>
				</div>

				<!-- Overview Tab Column -->
				<div
					class="border border-blue-300 dark:border-blue-700 rounded-lg bg-white dark:bg-gray-800"
				>
					<div
						class="p-3 border-b border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20 rounded-t-lg"
					>
						<h4 class="text-sm font-semibold text-blue-700 dark:text-blue-300">Overview Tab</h4>
						<p class="text-xs text-blue-600 dark:text-blue-400 mt-1">
							Shows in details & table columns
						</p>
					</div>
					<div
						class="p-3 min-h-[400px] max-h-[600px] overflow-y-auto space-y-2 transition-colors
              {dragOverTab === 'overview' ? 'bg-blue-50 dark:bg-blue-900/10' : ''}"
						on:dragover={(e) => handleTabDragOver(e, 'overview')}
						on:dragleave={handleTabDragLeave}
						on:drop={(e) => handleTabDrop(e, 'overview')}
						role="region"
						aria-label="Overview tab drop zone"
					>
						{#each Array.from(fieldConfigs.entries())
							.filter(([_field, config]) => config.tab === 'overview')
							.sort((a, b) => a[1].displayOrder - b[1].displayOrder) as [field, _config], _index (field)}
							<div
								draggable="true"
								on:dragstart={(e) => handleFieldDragStart(e, field)}
								on:dragend={handleFieldDragEnd}
								on:dragover={(e) => handleFieldDragOver(e, field)}
								on:dragleave={handleFieldDragLeave}
								on:drop={(e) => handleFieldDrop(e, field, 'overview')}
								role="button"
								aria-label="{field} field in Overview tab"
								tabindex="0"
								class="flex items-center px-3 py-2 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 rounded text-sm cursor-move hover:bg-blue-200 dark:hover:bg-blue-800/30 transition-colors
                  {dragOverField === field && draggedField !== field
									? 'border-t-2 border-blue-500'
									: ''}"
							>
								<Draggable class="w-3 h-3 mr-2 flex-shrink-0" />
								<span class="truncate">{field}</span>
							</div>
						{/each}
						{#if Array.from(fieldConfigs.entries()).filter(([_field, config]) => config.tab === 'overview').length === 0}
							<p class="text-xs text-gray-400 dark:text-gray-500 text-center py-4">
								Drop fields here
							</p>
						{/if}
					</div>
				</div>

				<!-- Implementation Tab Column -->
				<div
					class="border border-green-300 dark:border-green-700 rounded-lg bg-white dark:bg-gray-800"
				>
					<div
						class="p-3 border-b border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20 rounded-t-lg"
					>
						<h4 class="text-sm font-semibold text-green-700 dark:text-green-300">
							Implementation Tab
						</h4>
						<p class="text-xs text-green-600 dark:text-green-400 mt-1">Status & compliance</p>
					</div>
					<div
						class="p-3 min-h-[400px] max-h-[600px] overflow-y-auto space-y-2 transition-colors
              {dragOverTab === 'implementation' ? 'bg-green-50 dark:bg-green-900/10' : ''}"
						on:dragover={(e) => handleTabDragOver(e, 'implementation')}
						on:dragleave={handleTabDragLeave}
						on:drop={(e) => handleTabDrop(e, 'implementation')}
						role="region"
						aria-label="Implementation tab drop zone"
					>
						{#each Array.from(fieldConfigs.entries())
							.filter(([_field, config]) => config.tab === 'implementation')
							.sort((a, b) => a[1].displayOrder - b[1].displayOrder) as [field, _config], _index (field)}
							<div
								draggable="true"
								on:dragstart={(e) => handleFieldDragStart(e, field)}
								on:dragend={handleFieldDragEnd}
								on:dragover={(e) => handleFieldDragOver(e, field)}
								on:dragleave={handleFieldDragLeave}
								on:drop={(e) => handleFieldDrop(e, field, 'implementation')}
								role="button"
								aria-label="{field} field in Implementation tab"
								tabindex="0"
								class="flex items-center px-3 py-2 bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 rounded text-sm cursor-move hover:bg-green-200 dark:hover:bg-green-800/30 transition-colors
                  {dragOverField === field && draggedField !== field
									? 'border-t-2 border-green-500'
									: ''}"
							>
								<Draggable class="w-3 h-3 mr-2 flex-shrink-0" />
								<span class="truncate">{field}</span>
							</div>
						{/each}
						{#if Array.from(fieldConfigs.entries()).filter(([_field, config]) => config.tab === 'implementation').length === 0}
							<p class="text-xs text-gray-400 dark:text-gray-500 text-center py-4">
								Drop fields here
							</p>
						{/if}
					</div>
				</div>

				<!-- Custom Tab Column -->
				<div
					class="border border-purple-300 dark:border-purple-700 rounded-lg bg-white dark:bg-gray-800"
				>
					<div
						class="p-3 border-b border-purple-200 dark:border-purple-800 bg-purple-50 dark:bg-purple-900/20 rounded-t-lg"
					>
						<h4 class="text-sm font-semibold text-purple-700 dark:text-purple-300">Custom Tab</h4>
						<p class="text-xs text-purple-600 dark:text-purple-400 mt-1">Additional fields</p>
					</div>
					<div
						class="p-3 min-h-[400px] max-h-[600px] overflow-y-auto space-y-2 transition-colors
              {dragOverTab === 'custom' ? 'bg-purple-50 dark:bg-purple-900/10' : ''}"
						on:dragover={(e) => handleTabDragOver(e, 'custom')}
						on:dragleave={handleTabDragLeave}
						on:drop={(e) => handleTabDrop(e, 'custom')}
						role="region"
						aria-label="Custom fields drop zone"
					>
						{#each Array.from(fieldConfigs.entries())
							.filter(([_field, config]) => config.tab === 'custom')
							.sort((a, b) => a[1].displayOrder - b[1].displayOrder) as [field, _config], _index (field)}
							<div
								draggable="true"
								on:dragstart={(e) => handleFieldDragStart(e, field)}
								on:dragend={handleFieldDragEnd}
								on:dragover={(e) => handleFieldDragOver(e, field)}
								on:dragleave={handleFieldDragLeave}
								on:drop={(e) => handleFieldDrop(e, field, 'custom')}
								role="button"
								aria-label="{field} field in Custom tab"
								tabindex="0"
								class="flex items-center px-3 py-2 bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300 rounded text-sm cursor-move hover:bg-purple-200 dark:hover:bg-purple-800/30 transition-colors
                  {dragOverField === field && draggedField !== field
									? 'border-t-2 border-purple-500'
									: ''}"
							>
								<Draggable class="w-3 h-3 mr-2 flex-shrink-0" />
								<span class="truncate">{field}</span>
							</div>
						{/each}
						{#if Array.from(fieldConfigs.entries()).filter(([_field, config]) => config.tab === 'custom').length === 0}
							<p class="text-xs text-gray-400 dark:text-gray-500 text-center py-4">
								Drop fields here
							</p>
						{/if}
					</div>
				</div>

				<!-- Mappings Tab Column -->
				<div
					class="border border-orange-300 dark:border-orange-700 rounded-lg bg-white dark:bg-gray-800"
				>
					<div
						class="p-3 border-b border-orange-200 dark:border-orange-800 bg-orange-50 dark:bg-orange-900/20 rounded-t-lg"
					>
						<h4 class="text-sm font-semibold text-orange-700 dark:text-orange-300">Mappings Tab</h4>
						<p class="text-xs text-orange-600 dark:text-orange-400 mt-1">
							Pre-populate justification for a control mapping
						</p>
					</div>
					<div
						class="p-3 min-h-[400px] max-h-[600px] overflow-y-auto transition-colors
						{dragOverTab === 'mappings' ? 'bg-orange-50 dark:bg-orange-900/10' : ''}"
						on:dragover={(e) => handleTabDragOver(e, 'mappings')}
						on:dragleave={handleTabDragLeave}
						on:drop={(e) => handleTabDrop(e, 'mappings')}
						role="region"
						aria-label="Justifications tab drop zone"
					>
						<!-- Justification Fields -->
						<div class="space-y-2">
							{#if justificationFields.length > 0}
								<!-- Display justification fields -->
								{#each justificationFields as field, _index}
									<div
										draggable="false"
										role="button"
										tabindex="0"
										class="flex items-center px-3 py-2 bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-300 rounded text-sm hover:bg-orange-200 dark:hover:bg-orange-800/30 transition-colors"
									>
										<span class="truncate">{field}</span>
										<button
											class="ml-auto text-gray-400 hover:text-red-500 dark:text-gray-500 dark:hover:text-red-400"
											title="Remove from mappings"
											on:click|stopPropagation={() => {
												justificationFields = justificationFields.filter((f) => f !== field);
											}}
										>
											×
										</button>
									</div>
								{/each}
							{:else}
								<!-- Drop zone only shown when no fields are present -->
								<div
									role="region"
									aria-label="Justification field drop zone"
									class="p-4 transition-colors
									{dragOverTab === 'mappings' ? 'bg-orange-50 dark:bg-orange-900/10' : ''}"
									on:dragover={(e) => {
										e.preventDefault();
										handleTabDragOver(e, 'mappings');
									}}
									on:dragleave={handleTabDragLeave}
									on:drop={(e) => {
										e.preventDefault();
										if (draggedField && fieldConfigs.has(draggedField)) {
											// Add to justification fields if not already present
											if (!justificationFields.includes(draggedField)) {
												justificationFields = [...justificationFields, draggedField];
											}

											// Set tab assignment
											const config = fieldConfigs.get(draggedField)!;
											config.tab = 'mappings';
											fieldConfigs.set(draggedField, config);
											fieldConfigs = new Map(fieldConfigs); // Force reactivity

											dragOverTab = null;
										}
									}}
								>
									<p class="text-xs text-gray-400 dark:text-gray-500 text-center py-4">
										Drop fields here
									</p>
								</div>
							{/if}
						</div>
					</div>
				</div>
			</div>
		</div>

		<!-- Sample Data Preview -->
		{#if sampleData.length > 0}
			<div
				class="bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-900 rounded-lg p-4 border border-gray-200 dark:border-gray-700"
			>
				<h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">
					Sample Data Preview
				</h3>
				<div class="overflow-x-auto">
					<table class="w-full text-sm text-left text-gray-500 dark:text-gray-400">
						<thead
							class="text-xs text-gray-700 uppercase bg-gray-100 dark:bg-gray-600 dark:text-gray-400"
						>
							<tr>
								{#each fields.slice(0, 5) as field (field)}
									<th class="px-4 py-2">{field}</th>
								{/each}
							</tr>
						</thead>
						<tbody>
							{#each sampleData as row, i (i)}
								<tr class="bg-white border-b dark:bg-gray-800 dark:border-gray-700">
									{#each fields.slice(0, 5) as field (field)}
										<td class="px-4 py-2">{row[field] || ''}</td>
									{/each}
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			</div>
		{/if}

		<!-- Import Button -->
		<div class="flex justify-center">
			<button
				on:click={importSpreadsheet}
				disabled={isLoading || !fileData || !controlIdField}
				class="px-5 py-2.5 text-white bg-blue-600 hover:bg-blue-700 focus:ring-4 focus:ring-blue-300 font-medium rounded-lg text-sm disabled:opacity-50 disabled:cursor-not-allowed"
				title={!controlIdField ? 'Please select a Control ID field' : ''}
			>
				{#if isLoading}
					<span class="flex items-center">
						<svg
							class="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
							xmlns="http://www.w3.org/2000/svg"
							fill="none"
							viewBox="0 0 24 24"
						>
							<circle
								class="opacity-25"
								cx="12"
								cy="12"
								r="10"
								stroke="currentColor"
								stroke-width="4"
							></circle>
							<path
								class="opacity-75"
								fill="currentColor"
								d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
							></path>
						</svg>
						Importing...
					</span>
				{:else}
					Import to Control Set
				{/if}
			</button>
		</div>
	{/if}
</div>
