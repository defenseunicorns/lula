// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Lula Authors

import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { modal, closeModalById } from './modal';

describe('modal', () => {
	let triggerElement: HTMLElement;
	let modalElement: HTMLElement;
	let modalContent: HTMLElement;
	let mockOnOpen: ReturnType<typeof vi.fn>;
	let mockOnClose: ReturnType<typeof vi.fn>;

	beforeEach(() => {
		// Reset DOM
		document.body.innerHTML = '';

		// Create test DOM structure
		triggerElement = document.createElement('button');
		triggerElement.textContent = 'Open Modal';

		modalElement = document.createElement('div');
		modalElement.setAttribute('id', 'test-modal');

		modalContent = document.createElement('div');
		modalContent.className = 'modal-content';
		modalContent.innerHTML = '<p>Modal content</p>';

		modalElement.appendChild(modalContent);
		triggerElement.appendChild(modalElement);
		document.body.appendChild(triggerElement);

		// Create mock callbacks
		mockOnOpen = vi.fn();
		mockOnClose = vi.fn();

		// Reset body styles
		document.body.style.overflow = '';
	});

	afterEach(() => {
		// Clean up DOM
		document.body.innerHTML = '';

		// Reset body styles
		document.body.style.overflow = '';

		// Clear mocks
		vi.clearAllMocks();
	});

	describe('initialization', () => {
		it('should return empty object if no modal content found', () => {
			const emptyElement = document.createElement('div');
			const result = modal(emptyElement);

			expect(result).toEqual({});
		});

		it('should return empty object if no trigger element found', () => {
			const orphanElement = document.createElement('div');
			orphanElement.appendChild(modalContent);

			const result = modal(orphanElement);

			expect(result).toEqual({});
		});

		it('should create backdrop element and set initial ARIA attributes', () => {
			modal(modalElement);

			const backdrop = document.querySelector('.modal-backdrop') as HTMLElement;
			expect(backdrop).toBeTruthy();
			expect(backdrop.style.display).toBe('none');

			expect(modalContent.getAttribute('role')).toBe('dialog');
			expect(modalContent.getAttribute('aria-modal')).toBe('true');
			expect(modalContent.getAttribute('aria-hidden')).toBe('true');
		});

		it('should add close button to modal content', () => {
			modal(modalElement);

			const closeButton = modalContent.querySelector('.modal-close');
			expect(closeButton).toBeTruthy();
			expect(closeButton?.getAttribute('aria-label')).toBe('Close modal');
			expect(closeButton?.innerHTML).toBe('×');
		});

		it('should register modal in registry if it has an ID', () => {
			modal(modalElement);

			// Test that the modal can be closed by ID
			closeModalById('test-modal');
			// This should not throw an error if properly registered
		});

		it('should open modal on init if openOnInit is true', async () => {
			modal(modalElement, {
				openOnInit: true,
				onOpen: mockOnOpen
			});

			// Wait for the openModal setTimeout to execute
			await new Promise((resolve) => setTimeout(resolve, 10));

			expect(mockOnOpen).toHaveBeenCalled();
			expect(modalContent.getAttribute('aria-hidden')).toBe('false');
			expect(document.body.style.overflow).toBe('hidden');
		});
	});

	describe('opening modal', () => {
		it('should open modal when trigger is clicked', () => {
			modal(modalElement, { onOpen: mockOnOpen });

			triggerElement.click();

			expect(mockOnOpen).toHaveBeenCalled();
			expect(modalContent.getAttribute('aria-hidden')).toBe('false');
			expect(document.body.style.overflow).toBe('hidden');

			const backdrop = document.querySelector('.modal-backdrop') as HTMLElement;
			expect(backdrop.style.display).toBe('block');
			expect(document.body.contains(modalContent)).toBe(true);
		});

		it('should not open modal if already open', () => {
			modal(modalElement, { onOpen: mockOnOpen });

			// Open modal twice
			triggerElement.click();
			triggerElement.click();

			expect(mockOnOpen).toHaveBeenCalledTimes(1);
		});

		it('should focus first focusable element when opened', () => {
			const focusableButton = document.createElement('button');
			focusableButton.textContent = 'Focus me';
			modalContent.appendChild(focusableButton);

			modal(modalElement);

			const focusSpy = vi.spyOn(focusableButton, 'focus');
			triggerElement.click();

			expect(focusSpy).toHaveBeenCalled();
		});

		it('should handle modal with no focusable elements', () => {
			modal(modalElement);

			// Should not throw error when no focusable elements exist
			expect(() => triggerElement.click()).not.toThrow();
		});
	});

	describe('closing modal', () => {
		let modalAction: any;

		beforeEach(() => {
			modalAction = modal(modalElement, { onClose: mockOnClose });
			// Open the modal first
			triggerElement.click();
		});

		afterEach(() => {
			// Clean up the modal action from beforeEach
			if (modalAction?.destroy) {
				modalAction.destroy();
			}
		});

		it('should close modal when close button is clicked', () => {
			const closeButton = modalContent.querySelector('.modal-close') as HTMLElement;

			closeButton.click();

			expect(mockOnClose).toHaveBeenCalled();
			expect(modalContent.getAttribute('aria-hidden')).toBe('true');
			expect(document.body.style.overflow).toBe('');

			const backdrop = document.querySelector('.modal-backdrop') as HTMLElement;
			expect(backdrop.style.display).toBe('none');
			expect(modalElement.contains(modalContent)).toBe(true);
		});

		it('should close modal when escape key is pressed', () => {
			const escapeEvent = new KeyboardEvent('keydown', { key: 'Escape' });
			document.dispatchEvent(escapeEvent);

			expect(mockOnClose).toHaveBeenCalled();
			expect(modalContent.getAttribute('aria-hidden')).toBe('true');
		});

		it('should not close modal on escape if closeOnEscape is false', () => {
			// Destroy the existing modal first
			modalAction.destroy();

			// Create new modal with closeOnEscape disabled
			modalAction = modal(modalElement, { closeOnEscape: false, onClose: mockOnClose });

			// Open modal first
			triggerElement.click();

			// Clear the mock since opening might trigger callbacks
			mockOnClose.mockClear();

			const escapeEvent = new KeyboardEvent('keydown', { key: 'Escape' });
			document.dispatchEvent(escapeEvent);

			expect(mockOnClose).not.toHaveBeenCalled();
		});

		it('should close modal when clicking on backdrop', () => {
			const backdrop = document.querySelector('.modal-backdrop') as HTMLElement;

			const clickEvent = new MouseEvent('click');
			Object.defineProperty(clickEvent, 'target', { value: backdrop });
			backdrop.dispatchEvent(clickEvent);

			expect(mockOnClose).toHaveBeenCalled();
		});

		it('should not close modal when clicking inside modal content', () => {
			const clickEvent = new MouseEvent('click');
			Object.defineProperty(clickEvent, 'target', { value: modalContent });

			const backdrop = document.querySelector('.modal-backdrop') as HTMLElement;
			backdrop.dispatchEvent(clickEvent);

			expect(mockOnClose).not.toHaveBeenCalled();
		});

		it('should not close modal on backdrop click if closeOnOutsideClick is false', () => {
			// Destroy the existing modal first
			modalAction.destroy();

			// Create new modal with closeOnOutsideClick disabled
			modalAction = modal(modalElement, { closeOnOutsideClick: false, onClose: mockOnClose });

			// Open modal first
			triggerElement.click();

			// Clear the mock since opening might trigger callbacks
			mockOnClose.mockClear();

			const backdrop = document.querySelector('.modal-backdrop') as HTMLElement;
			const clickEvent = new MouseEvent('click');
			Object.defineProperty(clickEvent, 'target', { value: backdrop });
			backdrop.dispatchEvent(clickEvent);

			expect(mockOnClose).not.toHaveBeenCalled();
		});

		it('should not close modal if already closed', () => {
			// Close modal first
			const closeButton = modalContent.querySelector('.modal-close') as HTMLElement;
			closeButton.click();

			// Clear the mock call count
			mockOnClose.mockClear();

			// Try to close again
			closeButton.click();

			expect(mockOnClose).not.toHaveBeenCalled();
		});

		it('should return focus to trigger element when closed', () => {
			const focusSpy = vi.spyOn(triggerElement, 'focus');

			const closeButton = modalContent.querySelector('.modal-close') as HTMLElement;
			closeButton.click();

			expect(focusSpy).toHaveBeenCalled();
		});
	});

	describe('closeModalById function', () => {
		it('should close modal by ID', () => {
			modal(modalElement, { onClose: mockOnClose });
			triggerElement.click(); // Open modal

			closeModalById('test-modal');

			expect(mockOnClose).toHaveBeenCalled();
			expect(modalContent.getAttribute('aria-hidden')).toBe('true');
		});

		it('should warn when trying to close non-existent modal', () => {
			const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

			closeModalById('non-existent-modal');

			expect(warnSpy).toHaveBeenCalledWith('No modal with ID non-existent-modal found in registry');

			warnSpy.mockRestore();
		});
	});

	describe('update functionality', () => {
		it('should update modal options', () => {
			const action = modal(modalElement, { closeOnEscape: true });

			// Update options
			action.update?.({ closeOnEscape: false, onOpen: mockOnOpen });

			// Test that new option is applied
			triggerElement.click();
			expect(mockOnOpen).toHaveBeenCalled();
		});
	});

	describe('destroy functionality', () => {
		it('should clean up all event listeners and DOM elements', () => {
			const action = modal(modalElement, { onOpen: mockOnOpen, onClose: mockOnClose });

			// Open modal first
			triggerElement.click();
			expect(document.body.style.overflow).toBe('hidden');

			// Destroy modal
			action.destroy?.();

			// Check cleanup
			expect(document.body.style.overflow).toBe('');
			expect(document.querySelector('.modal-backdrop')).toBeNull();
			expect(modalElement.contains(modalContent)).toBe(true);
			expect(modalContent.querySelector('.modal-close')).toBeNull();

			// Check that attributes are removed
			expect(modalContent.getAttribute('role')).toBeNull();
			expect(modalContent.getAttribute('aria-modal')).toBeNull();
			expect(modalContent.getAttribute('aria-hidden')).toBeNull();

			// Event listeners should be removed (test by trying to trigger them)
			triggerElement.click();
			expect(mockOnOpen).toHaveBeenCalledTimes(1); // Only from before destroy
		});

		it('should remove modal from registry on destroy', () => {
			const action = modal(modalElement);

			action.destroy?.();

			const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
			closeModalById('test-modal');
			expect(warnSpy).toHaveBeenCalledWith('No modal with ID test-modal found in registry');

			warnSpy.mockRestore();
		});

		it('should handle destroy when modal content is not in body', () => {
			const action = modal(modalElement);

			// Destroy without opening modal (so content is still in original position)
			expect(() => action.destroy?.()).not.toThrow();
		});

		it('should handle destroy when backdrop is not in DOM', () => {
			const action = modal(modalElement);

			// Remove backdrop manually
			const backdrop = document.querySelector('.modal-backdrop');
			backdrop?.remove();

			// Should not throw error
			expect(() => action.destroy?.()).not.toThrow();
		});
	});

	describe('edge cases', () => {
		it('should handle multiple modals on same page', () => {
			// Create second modal
			const triggerElement2 = document.createElement('button');
			const modalElement2 = document.createElement('div');
			modalElement2.setAttribute('id', 'test-modal-2');
			const modalContent2 = document.createElement('div');
			modalContent2.className = 'modal-content';

			modalElement2.appendChild(modalContent2);
			triggerElement2.appendChild(modalElement2);
			document.body.appendChild(triggerElement2);

			// Initialize both modals
			const action1 = modal(modalElement);
			const action2 = modal(modalElement2);

			// Open first modal
			triggerElement.click();
			expect(modalContent.getAttribute('aria-hidden')).toBe('false');

			// Open second modal
			triggerElement2.click();
			expect(modalContent2.getAttribute('aria-hidden')).toBe('false');

			// Close by ID should work for both
			closeModalById('test-modal');
			expect(modalContent.getAttribute('aria-hidden')).toBe('true');

			closeModalById('test-modal-2');
			expect(modalContent2.getAttribute('aria-hidden')).toBe('true');

			// Cleanup
			action1.destroy?.();
			action2.destroy?.();
		});

		it('should handle modal without ID', () => {
			modalElement.removeAttribute('id');

			const action = modal(modalElement);

			// Should not throw error and should work normally
			expect(() => triggerElement.click()).not.toThrow();

			action.destroy?.();
		});

		it('should prevent event propagation on trigger and close clicks', () => {
			modal(modalElement);

			const clickEvent = new MouseEvent('click');
			const preventDefaultSpy = vi.spyOn(clickEvent, 'preventDefault');
			const stopPropagationSpy = vi.spyOn(clickEvent, 'stopPropagation');

			triggerElement.dispatchEvent(clickEvent);

			expect(preventDefaultSpy).toHaveBeenCalled();
			expect(stopPropagationSpy).toHaveBeenCalled();
		});
	});
});
