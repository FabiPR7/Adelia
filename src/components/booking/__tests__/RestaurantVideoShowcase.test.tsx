import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import RestaurantVideoShowcase from '../RestaurantVideoShowcase'

describe('RestaurantVideoShowcase', () => {
  it('no debería renderizar nada sin vídeos', () => {
    const { container } = render(
      <RestaurantVideoShowcase videos={[]} restaurantName="Casa Luna" />,
    )
    expect(container).toBeEmptyDOMElement()
  })

  it('debería mostrar un reproductor con controles', () => {
    render(
      <RestaurantVideoShowcase
        videos={['https://res.cloudinary.com/adelia/video/upload/v1/clip.mp4']}
        restaurantName="Casa Luna"
      />,
    )

    expect(screen.getByLabelText('Ambiente de Casa Luna')).toBeInTheDocument()
    expect(screen.getByText('Ambiente')).toBeInTheDocument()
    const video = screen.getByLabelText('Vídeo de Casa Luna')
    expect(video).toBeInTheDocument()
    expect(video).toHaveAttribute('controls')
  })
})
