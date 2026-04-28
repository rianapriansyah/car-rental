import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { TarifInfoDialog } from './TarifInfoDialog'

describe('TarifInfoDialog', () => {
  it('does not render its content when closed', () => {
    render(<TarifInfoDialog open={false} onClose={() => {}} />)
    expect(screen.queryByText('Aturan Tarif Sewa')).not.toBeInTheDocument()
  })

  it('renders title and rule body when open', () => {
    render(<TarifInfoDialog open onClose={() => {}} />)
    expect(screen.getByRole('heading', { name: 'Aturan Tarif Sewa' })).toBeInTheDocument()
    expect(screen.getByText(/25 jam pertama/)).toBeInTheDocument()
    expect(screen.getByText(/segmen 24 jam/)).toBeInTheDocument()
    expect(screen.getByText(/overtime \(OT\)/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Mengerti' })).toBeInTheDocument()
  })

  it('calls onClose when the "Mengerti" button is clicked', () => {
    const onClose = vi.fn()
    render(<TarifInfoDialog open onClose={onClose} />)
    fireEvent.click(screen.getByRole('button', { name: 'Mengerti' }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
