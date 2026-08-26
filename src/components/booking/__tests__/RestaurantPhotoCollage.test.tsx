import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import RestaurantPhotoCollage from '../RestaurantPhotoCollage'

describe('RestaurantPhotoCollage', () => {
  it('sin fotos ni vídeos muestra la inicial', () => {
    render(
      <RestaurantPhotoCollage
        photos={[]}
        videos={[]}
        fallbackLabel="Carolina"
        restaurantName="Carolina"
      />,
    )
    expect(screen.getByText('C')).toBeInTheDocument()
  })

  it('si hay vídeo lo pone en la pieza grande con controles', () => {
    render(
      <RestaurantPhotoCollage
        photos={['https://res.cloudinary.com/adelia/image/upload/v1/main.jpg']}
        videos={['https://res.cloudinary.com/adelia/video/upload/v1/clip.mp4']}
        fallbackLabel="Carolina"
        restaurantName="Carolina"
      />,
    )

    const video = screen.getByLabelText('Vídeo de Carolina')
    expect(video).toBeInTheDocument()
    expect(video).toHaveAttribute('controls')
    expect(video).toHaveAttribute('loop')
    expect(video).toHaveAttribute('autoplay')
  })

  it('con dos vídeos no hace bucle y las piezas pequeñas son fotos', () => {
    const { container } = render(
      <RestaurantPhotoCollage
        photos={[
          'https://res.cloudinary.com/adelia/image/upload/v1/a.jpg',
          'https://res.cloudinary.com/adelia/image/upload/v1/b.jpg',
        ]}
        videos={[
          'https://res.cloudinary.com/adelia/video/upload/v1/clip-a.mp4',
          'https://res.cloudinary.com/adelia/video/upload/v1/clip-b.mp4',
        ]}
        fallbackLabel="Carolina"
        restaurantName="Carolina"
      />,
    )

    expect(container.querySelectorAll('video')).toHaveLength(1)
    expect(screen.getByLabelText('Vídeo de Carolina')).not.toHaveAttribute('loop')
    expect(container.querySelectorAll('img').length).toBeGreaterThan(0)
  })
})
