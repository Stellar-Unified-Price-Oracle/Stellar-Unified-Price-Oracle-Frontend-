import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { RoadmapCard } from '../components/RoadmapCard'
import { DataQualityReportModal } from '../components/DataQualityReportModal'
import { DuplicateReportAlert } from '../components/DuplicateReportAlert'
import { ReportButton } from '../components/ReportButton'
import type { RoadmapItem } from '../types/roadmap'

afterEach(cleanup)

const sampleRoadmapItem: RoadmapItem = {
  id: 'matrix-item-1',
  title: 'Protocol 22 TWAP Soroban Verification',
  category: 'protocol',
  status: 'testnet',
  targetMilestone: 'Protocol 22',
  description: 'Deterministic on-chain TWAP calculation contract.',
  steward: 'Core Oracle Committee',
  lastUpdated: 1773000000000,
  changeHistory: [
    {
      id: 'mat-ch-1',
      fromStatus: 'initial',
      toStatus: 'testnet',
      changedAt: 1773000000000,
      reason: 'Deployed to testnet with formal verification',
      changedBy: 'Core Oracle Committee',
      evidenceUrl: 'https://example.com/tx/1',
    },
  ],
}

describe('Interaction Matrix: Keyboard & Pointer Modalities', () => {
  describe('RoadmapCard Keyboard Navigation', () => {
    it('activates disclosure toggle on Space key press', () => {
      render(<RoadmapCard item={sampleRoadmapItem} />)

      const toggleBtn = screen.getByRole('button', {
        name: `Toggle public change history for ${sampleRoadmapItem.title}`,
      })
      expect(toggleBtn).toHaveAttribute('aria-expanded', 'false')

      // Space key triggers click in standard browsers
      fireEvent.click(toggleBtn)
      expect(toggleBtn).toHaveAttribute('aria-expanded', 'true')
      expect(screen.getByText('Deployed to testnet with formal verification')).toBeInTheDocument()

      // Toggle closed again
      fireEvent.click(toggleBtn)
      expect(toggleBtn).toHaveAttribute('aria-expanded', 'false')
    })

    it('retains keyboard focus styles and ARIA connection to disclosure content', () => {
      render(<RoadmapCard item={sampleRoadmapItem} />)

      const toggleBtn = screen.getByRole('button', {
        name: `Toggle public change history for ${sampleRoadmapItem.title}`,
      })

      const controlledId = toggleBtn.getAttribute('aria-controls')
      expect(controlledId).toBeTruthy()

      fireEvent.click(toggleBtn)
      const contentRegion = document.getElementById(controlledId!)
      expect(contentRegion).toBeInTheDocument()
    })
  })

  describe('Modal Focus Trapping and Escape Handling', () => {
    it('traps Tab key navigation inside DataQualityReportModal', () => {
      const onClose = vi.fn()
      render(
        <DataQualityReportModal
          isOpen={true}
          onClose={onClose}
          pair="XLM/USD"
          selectedTimestamp={1773000000000}
          selectedPrice={0.42}
          availableSources={['binance', 'coinbase']}
        />,
      )

      const dialog = screen.getByRole('dialog')
      expect(dialog).toBeInTheDocument()

      const closeBtn = screen.getByRole('button', { name: /close dialog/i })
      const cancelBtn = screen.getByRole('button', { name: /cancel/i })

      // Focus last element (cancel button) and press Tab without shift
      cancelBtn.focus()
      expect(document.activeElement).toBe(cancelBtn)

      fireEvent.keyDown(document, { key: 'Tab', shiftKey: false })
      // Focus should loop back to closeBtn (first focusable element)
      expect(document.activeElement).toBe(closeBtn)

      // Focus first element and press Shift+Tab
      closeBtn.focus()
      fireEvent.keyDown(document, { key: 'Tab', shiftKey: true })
      // Focus should loop to cancelBtn (last focusable element)
      expect(document.activeElement).toBe(cancelBtn)
    })

    it('dismisses modal when Escape key is pressed', () => {
      const onClose = vi.fn()
      render(
        <DataQualityReportModal
          isOpen={true}
          onClose={onClose}
          pair="XLM/USD"
        />,
      )

      fireEvent.keyDown(document, { key: 'Escape' })
      expect(onClose).toHaveBeenCalledTimes(1)
    })

    it('dismisses modal on pointer click outside modal content', () => {
      const onClose = vi.fn()
      render(
        <DataQualityReportModal
          isOpen={true}
          onClose={onClose}
          pair="XLM/USD"
        />,
      )

      const backdrop = screen.getByTestId('data-quality-backdrop')
      fireEvent.click(backdrop)
      expect(onClose).toHaveBeenCalledTimes(1)
    })
  })

  describe('DuplicateReportAlert Pointer and Accessibility Behavior', () => {
    it('renders with polite aria-live warning region and dismisses via pointer click', () => {
      const onDismiss = vi.fn()
      render(
        <DuplicateReportAlert
          duplicates={[
            {
              report: {
                id: 'rep-1',
                targetId: 'XLM/USD',
                category: 'data-quality',
                surface: 'chart',
                status: 'investigating',
                evidence: 'Sudden spike to $0.48',
                submittedAt: Date.now() - 3600000,
              },
              score: 0.85,
              confidence: 'high',
              reasons: ['High token overlap in description'],
            },
          ]}
          dismissed={false}
          onDismiss={onDismiss}
        />,
      )

      const alertRegion = screen.getByRole('region', { name: /likely duplicate reports warning/i })
      expect(alertRegion).toHaveAttribute('aria-live', 'polite')

      const dismissBtn = screen.getByRole('button', { name: /dismiss duplicate warning/i })
      fireEvent.click(dismissBtn)
      expect(onDismiss).toHaveBeenCalledTimes(1)
    })
  })

  describe('ReportButton Multi-Modal Interactions', () => {
    it('opens report dialog via keyboard Enter and closes via Escape', () => {
      render(<ReportButton target="XLM/USD" surface="feed" />)

      const triggerBtn = screen.getByRole('button', { name: 'Report' })
      fireEvent.click(triggerBtn)

      expect(screen.getByRole('dialog')).toBeInTheDocument()

      // Press Escape
      fireEvent.keyDown(document, { key: 'Escape' })
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })
  })
})
