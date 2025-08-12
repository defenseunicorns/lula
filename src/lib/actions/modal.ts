// Copyright 2025 Defense Unicorns
// SPDX-License-Identifier: LicenseRef-Defense-Unicorns-Commercial

/**
 * Modal action for Svelte components
 * Creates a modal dialog that appears when the trigger element is clicked
 */

// Types for the modal action
type ModalOptions = {
  openOnInit?: boolean // Whether to open the modal immediately when component mounts
  closeOnEscape?: boolean // Whether to close on Escape key
  closeOnOutsideClick?: boolean // Whether to close when clicking outside
  onOpen?: () => void // Callback for when modal opens
  onClose?: () => void // Callback for when modal closes
}

/**
 * Creates a click-to-open modal from an element with a .modal-content child
 * @param node The HTML element to attach the modal trigger to
 * @param options Configuration options
 * @returns Svelte action object
 */
// Store a map of modal nodes to their closeModal functions for external access
const modalRegistry = new Map<string, () => void>()

/**
 * Closes a modal by its ID
 * @param modalId The ID of the modal to close
 */
export function closeModalById(modalId: string): void {
  const closeFunction = modalRegistry.get(modalId)
  if (closeFunction) {
    closeFunction()
  } else {
    console.warn(`No modal with ID ${modalId} found in registry`)
  }
}

export function modal(node: HTMLElement, options: ModalOptions = {}) {
  const defaults: ModalOptions = {
    openOnInit: false,
    closeOnEscape: true,
    closeOnOutsideClick: true,
  }

  // Merge defaults with provided options
  const settings = { ...defaults, ...options }

  // Find modal content element
  const modalContent = node.querySelector('.modal-content') as HTMLElement
  // Use the parent element of the node as the trigger element
  const triggerElement = node.parentElement as HTMLElement

  if (!modalContent) {
    return {}
  }

  if (!triggerElement) {
    return {}
  }

  // Create backdrop/overlay element
  const backdrop = document.createElement('div')
  backdrop.className = 'modal-backdrop'
  backdrop.style.display = 'none'
  document.body.appendChild(backdrop)

  // Set initial ARIA attributes
  modalContent.setAttribute('role', 'dialog')
  modalContent.setAttribute('aria-modal', 'true')
  modalContent.setAttribute('aria-hidden', 'true')

  // State to track if modal is open
  let isOpen = false

  // Function to open the modal
  const openModal = () => {
    if (isOpen) return

    isOpen = true
    // Move modal content to body to avoid stacking context issues
    document.body.appendChild(modalContent)
    modalContent.setAttribute('aria-hidden', 'false')
    backdrop.style.display = 'block'

    // Prevent scrolling on the body
    document.body.style.overflow = 'hidden'

    // Call onOpen callback if provided
    if (settings.onOpen) settings.onOpen()

    // Focus first focusable element in modal
    const focusableElements = modalContent.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    )
    if (focusableElements.length > 0) {
      ;(focusableElements[0] as HTMLElement).focus()
    }
  }

  // Function to close the modal
  const closeModal = () => {
    if (!isOpen) return

    isOpen = false
    modalContent.setAttribute('aria-hidden', 'true')
    backdrop.style.display = 'none'

    // Move modal back to original position
    if (document.body.contains(modalContent)) {
      node.appendChild(modalContent)
    }

    // Restore scrolling on body
    document.body.style.overflow = ''

    // Call onClose callback if provided
    if (settings.onClose) settings.onClose()

    // Return focus to trigger element
    if (triggerElement) {
      triggerElement.focus()
    }
  }

  // Register the modal in our registry if it has an ID
  const modalId = node.getAttribute('id')
  if (modalId) {
    modalRegistry.set(modalId, closeModal)
  }

  // Handle click on trigger to open modal
  const handleTriggerClick = (e: Event) => {
    e.preventDefault()
    e.stopPropagation()
    openModal()
  }

  // Handle click on backdrop to close modal if closeOnOutsideClick is true
  const handleBackdropClick = (e: MouseEvent) => {
    if (!settings.closeOnOutsideClick) return

    // Only close if the click was directly on the backdrop, not on modal content
    if (e.target === backdrop) {
      closeModal()
    }
  }

  // Handle escape key to close modal if closeOnEscape is true
  const handleKeyDown = (e: KeyboardEvent) => {
    if (!settings.closeOnEscape) return

    if (e.key === 'Escape' && isOpen) {
      closeModal()
    }
  }

  // Add close button to modal
  const closeButton = document.createElement('button')
  closeButton.className = 'modal-close'
  closeButton.innerHTML = '×'
  closeButton.setAttribute('aria-label', 'Close modal')
  modalContent.appendChild(closeButton)

  // Handle click on close button
  const handleCloseClick = (e: Event) => {
    e.preventDefault()
    e.stopPropagation()
    closeModal()
  }

  // Set up event listeners
  triggerElement.addEventListener('click', handleTriggerClick)

  closeButton.addEventListener('click', handleCloseClick)
  backdrop.addEventListener('click', handleBackdropClick)
  document.addEventListener('keydown', handleKeyDown)

  // Open modal on init if specified
  if (settings.openOnInit) {
    setTimeout(openModal, 0)
  }

  return {
    update(newOptions: ModalOptions) {
      // Update settings
      Object.assign(settings, newOptions)
    },
    destroy() {
      // Clean up event listeners
      triggerElement.removeEventListener('click', handleTriggerClick)

      closeButton.removeEventListener('click', handleCloseClick)
      backdrop.removeEventListener('click', handleBackdropClick)
      document.removeEventListener('keydown', handleKeyDown)

      // Remove backdrop from DOM
      if (document.body.contains(backdrop)) {
        document.body.removeChild(backdrop)
      }

      // Return modal to original position if needed
      if (document.body.contains(modalContent)) {
        node.appendChild(modalContent)
      }

      // Remove close button from modal
      if (modalContent.contains(closeButton)) {
        modalContent.removeChild(closeButton)
      }

      // Reset attributes
      modalContent.removeAttribute('role')
      modalContent.removeAttribute('aria-modal')
      modalContent.removeAttribute('aria-hidden')

      // If modal is open when destroyed, restore body scrolling
      if (isOpen) {
        document.body.style.overflow = ''
      }

      // Remove from registry if it was registered
      const modalId = node.getAttribute('id')
      if (modalId && modalRegistry.has(modalId)) {
        modalRegistry.delete(modalId)
      }
    },
  }
}
