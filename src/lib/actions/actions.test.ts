// Copyright 2025 Defense Unicorns

import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { fadeWhenScrollable } from './fadeWhenScrollable'

describe('fadeWhenScrollable action', () => {
  let el: HTMLElement
  let actionReturn: ReturnType<typeof fadeWhenScrollable>

  beforeEach(() => {
    el = document.createElement('div')

    Object.defineProperty(el, 'clientHeight', {
      value: 100,
      configurable: true,
    })
    Object.defineProperty(el, 'scrollHeight', {
      value: 100,
      configurable: true,
    })

    // Apply the action
    actionReturn = fadeWhenScrollable(el)
  })

  afterEach(() => {
    actionReturn.destroy()
    el.remove()
  })

  it('should add the "no-fade" class when content is not scrollable', () => {
    expect(el.classList.contains('no-fade')).toBe(true)
  })

  it('should remove "no-fade" when content becomes scrollable on window.resize', () => {
    expect(el.classList.contains('no-fade')).toBe(true)
    // Simulate overflow by increasing scrollHeight
    Object.defineProperty(el, 'scrollHeight', {
      value: 200,
      configurable: true,
    })

    window.dispatchEvent(new Event('resize'))

    expect(el.classList.contains('no-fade')).toBe(false)
  })

  it('should re-add "no-fade" when content becomes not scrollable again', () => {
    // First, make it scrollable
    Object.defineProperty(el, 'scrollHeight', {
      value: 200,
      configurable: true,
    })
    window.dispatchEvent(new Event('resize'))
    expect(el.classList.contains('no-fade')).toBe(false)

    // shrink content
    Object.defineProperty(el, 'scrollHeight', {
      value: 50,
      configurable: true,
    })
    window.dispatchEvent(new Event('resize'))
    expect(el.classList.contains('no-fade')).toBe(true)
  })

  it('should react to DOM mutations (MutationObserver) and remove "no-fade" when overflow appears', async () => {
    expect(el.classList.contains('no-fade')).toBe(true)

    Object.defineProperty(el, 'scrollHeight', {
      value: 300,
      configurable: true,
    })

    // Append a child node to trigger MutationObserver
    const child = document.createElement('div')
    el.appendChild(child)

    // MutationObserver callback runs asynchronously
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(el.classList.contains('no-fade')).toBe(false)
  })
})
