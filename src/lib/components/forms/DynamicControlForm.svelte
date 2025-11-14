<!-- SPDX-License-Identifier: Apache-2.0 -->
<!-- SPDX-FileCopyrightText: 2023-Present The Lula Authors -->

<script lang="ts">
	import type { Control } from '$lib/types';
	import type { ControlSchema, ValidationResult } from '$lib/form-types';
	import DynamicField from './DynamicField.svelte';

	interface Props {
		control: Control;
		schema: ControlSchema;
		readonly?: boolean;
		onValidation?: (result: ValidationResult) => void;
		onChange?: () => void;
	}

	let { control = $bindable(), schema, readonly = false, onValidation, onChange }: Props = $props();

	// Track validation errors for each field
	let fieldErrors = $state<Record<string, string>>({});

	// Group fields for better layout
	const fieldGroups = $derived.by(() => {
		const groups: { [key: string]: typeof schema.fields } = {};

		schema.fields.forEach((field) => {
			const group = field.group || 'general';
			if (!groups[group]) {
				groups[group] = [];
			}
			groups[group].push(field);
		});

		return groups;
	});

	function handleFieldChange(fieldId: string) {
		// Run field-specific validation
		validateField(fieldId);
		onChange?.();
	}

	function validateField(fieldId: string) {
		const field = schema.fields.find((f) => f.id === fieldId);
		if (!field) return;

		const value = control[fieldId];
		let error = '';

		// Required field validation
		if (field.required && (!value || (typeof value === 'string' && value.trim() === ''))) {
			error = `${field.label} is required`;
		}

		// Custom validation rules
		if (field.validation && value) {
			for (const rule of field.validation) {
				if (rule.type === 'minLength' && typeof value === 'string' && value.length < rule.value) {
					error = rule.message || `${field.label} must be at least ${rule.value} characters`;
					break;
				}
				if (rule.type === 'maxLength' && typeof value === 'string' && value.length > rule.value) {
					error = rule.message || `${field.label} must be no more than ${rule.value} characters`;
					break;
				}
				if (
					rule.type === 'pattern' &&
					typeof value === 'string' &&
					!new RegExp(rule.pattern!).test(value)
				) {
					error = rule.message || `${field.label} format is invalid`;
					break;
				}
			}
		}

		// Update field errors
		if (error) {
			fieldErrors[fieldId] = error;
		} else {
			delete fieldErrors[fieldId];
		}

		// Trigger validation callback
		const hasErrors = Object.keys(fieldErrors).length > 0;
		const validationResult: ValidationResult = {
			valid: !hasErrors,
			errors: Object.entries(fieldErrors).map(([field, message]) => ({ field, message })),
			warnings: []
		};

		onValidation?.(validationResult);
	}

	// Only validate on explicit changes, not on control object changes
	let isInitialized = $state(false);

	$effect(() => {
		if (control && !isInitialized) {
			isInitialized = true;
			// Initial validation without triggering callbacks
			schema.fields.forEach((field) => {
				if (control[field.id] !== undefined) {
					const fieldId = field.id;
					const fieldDef = schema.fields.find((f) => f.id === fieldId);
					if (!fieldDef) return;

					const value = control[fieldId];
					let error = '';

					// Required field validation
					if (fieldDef.required && (!value || (typeof value === 'string' && value.trim() === ''))) {
						error = `${fieldDef.label} is required`;
					}

					// Update field errors without triggering validation callback
					if (error) {
						fieldErrors[fieldId] = error;
					} else {
						delete fieldErrors[fieldId];
					}
				}
			});
		}
	});
</script>

{#if readonly}
	<!-- View Mode: Clean minimal layout -->
	<div class="space-y-6">
		{#each Object.entries(fieldGroups) as [_groupName, fields], index (index)}
			{#each [fields] as fieldList, a (a)}
				{@const importantFields = fieldList.filter((f) =>
					['id', 'title', 'priority', 'status'].includes(f.id)
				)}
				{@const contentFields = fieldList.filter(
					(f) =>
						!importantFields.includes(f) &&
						control[f.id] !== undefined &&
						control[f.id] !== null &&
						control[f.id] !== ''
				)}

				{#if importantFields.length > 0 || contentFields.length > 0}
					<div class="space-y-6">
						<!-- Key information with natural layout -->
						{#if importantFields.length > 0}
							<div class="pb-4 border-b border-gray-200 dark:border-gray-700">
								<div class="flex flex-wrap items-center gap-6">
									{#each importantFields as field, index (index)}
										{@const value = control[field.id]}
										{#if value !== undefined && value !== null && value !== ''}
											<div class="flex items-center space-x-3">
												<span class="text-sm font-medium text-gray-500 dark:text-gray-400">
													{field.label}:
												</span>
												<span class="text-lg font-semibold text-gray-900 dark:text-white">
													{#if field.type === 'boolean'}
														<span
															class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium {value
																? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
																: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'}"
														>
															{value ? 'Yes' : 'No'}
														</span>
													{:else if field.id === 'family'}
														<span
															class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 uppercase"
														>
															{value}
														</span>
													{:else}
														{value}
													{/if}
												</span>
											</div>
										{/if}
									{/each}
								</div>
							</div>
						{/if}

						<!-- Content sections -->
						{#each contentFields as field, index (index)}
							{@const value = control[field.id]}

							{#if field.type === 'textarea'}
								<!-- Long text content -->
								<div class="space-y-3">
									<h3 class="text-base font-semibold text-gray-900 dark:text-white">
										{field.label}
									</h3>
									<div
										class="text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-wrap bg-gray-50 dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700"
									>
										{value}
									</div>
								</div>
							{:else if field.type === 'string-array' && Array.isArray(value) && value.length > 0}
								<!-- Simple list -->
								<div class="space-y-3">
									<h3 class="text-base font-semibold text-gray-900 dark:text-white">
										{field.label}
										<span class="ml-2 text-sm font-normal text-gray-500 dark:text-gray-400">
											({value.length})
										</span>
									</h3>
									<div class="space-y-2">
										{#each value as item, index (index)}
											<div class="flex items-start space-x-3 py-2">
												<div class="flex-shrink-0 w-1.5 h-1.5 bg-blue-600 rounded-full mt-2"></div>
												<div class="text-gray-900 dark:text-white leading-relaxed">
													{item}
												</div>
											</div>
										{/each}
									</div>
								</div>
							{:else if field.type === 'object-array' && Array.isArray(value) && value.length > 0}
								<!-- Object list -->
								<div class="space-y-3">
									<h3 class="text-base font-semibold text-gray-900 dark:text-white">
										{field.label}
										<span class="ml-2 text-sm font-normal text-gray-500 dark:text-gray-400">
											({value.length})
										</span>
									</h3>
									<div class="space-y-3">
										{#each value as item, index (index)}
											<div
												class="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700"
											>
												{#if field.arraySchema}
													<dl class="space-y-2">
														{#each Object.entries(field.arraySchema) as [key, schema], index (index)}
															{@const schemaObj = schema as any}
															{#if item[key]}
																<div class="flex justify-between">
																	<dt class="text-sm font-medium text-gray-500 dark:text-gray-400">
																		{schemaObj.label || key}:
																	</dt>
																	<dd class="text-sm text-gray-900 dark:text-white">
																		{item[key]}
																	</dd>
																</div>
															{/if}
														{/each}
													</dl>
												{/if}
											</div>
										{/each}
									</div>
								</div>
							{:else}
								<!-- Simple field -->
								<div class="flex justify-between py-2">
									<dt class="text-sm font-medium text-gray-500 dark:text-gray-400">
										{field.label}:
									</dt>
									<dd class="text-sm text-gray-900 dark:text-white font-medium">
										{#if field.type === 'boolean'}
											<span
												class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium {value
													? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
													: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'}"
											>
												{value ? 'Yes' : 'No'}
											</span>
										{:else}
											{value}
										{/if}
									</dd>
								</div>
							{/if}
						{/each}
					</div>
				{/if}
			{/each}
		{/each}
	</div>
{:else}
	<!-- Edit Mode: Enhanced form layout -->
	<div class="space-y-10">
		{#each Object.entries(fieldGroups) as [groupName, fields], index (index)}
			<section
				class="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-sm overflow-hidden"
			>
				{#if groupName !== 'general'}
					<!-- Enhanced group header -->
					<header
						class="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 px-8 py-6 border-b border-gray-200 dark:border-gray-600"
					>
						<h3 class="text-xl font-bold text-gray-900 dark:text-white tracking-tight">
							{groupName.replace(/([A-Z])/g, ' $1').trim()}
						</h3>
					</header>
				{/if}

				<!-- Enhanced form content -->
				<div class="p-8">
					<!-- Improved grid layout for simple fields -->
					<div class="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-8 mb-10">
						{#each fields as field, index (index)}
							{#if !['textarea', 'string-array', 'object-array'].includes(field.type)}
								<div class="space-y-2">
									<DynamicField
										{field}
										bind:value={control[field.id]}
										{readonly}
										error={fieldErrors[field.id]}
										onChange={() => handleFieldChange(field.id)}
									/>
								</div>
							{/if}
						{/each}
					</div>

					<!-- Enhanced full-width fields with better spacing -->
					<div class="space-y-10">
						{#each fields as field, index (index)}
							{#if ['textarea', 'string-array', 'object-array'].includes(field.type)}
								<div
									class="bg-gray-50 dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700"
								>
									<DynamicField
										{field}
										bind:value={control[field.id]}
										{readonly}
										error={fieldErrors[field.id]}
										onChange={() => handleFieldChange(field.id)}
									/>
								</div>
							{/if}
						{/each}
					</div>
				</div>
			</section>
		{/each}
	</div>
{/if}
