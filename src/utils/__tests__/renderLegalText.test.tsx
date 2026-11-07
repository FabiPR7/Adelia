import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { renderLegalText } from '../renderLegalText'

describe('renderLegalText', () => {
  it('renders bold, code and https links', () => {
    render(<p>{renderLegalText('Lee **esto**, `_ga` y [AEPD](https://www.aepd.es) ya.')}</p>)

    expect(screen.getByText('esto').tagName).toBe('STRONG')
    expect(screen.getByText('_ga').tagName).toBe('CODE')
    expect(screen.getByRole('link', { name: 'AEPD' })).toHaveAttribute('href', 'https://www.aepd.es')
  })

  it('does not turn other protocols into links', () => {
    render(<p>{renderLegalText('[mal](javascript:alert(1))')}</p>)

    expect(screen.queryByRole('link')).toBeNull()
  })
})
