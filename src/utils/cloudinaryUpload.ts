const CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME
const UPLOAD_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET

export async function uploadToCloudinary(
  file: File,
  resourceType: 'image' | 'video',
): Promise<string> {
  if (!CLOUD_NAME || !UPLOAD_PRESET) {
    throw new Error(
      'Faltan VITE_CLOUDINARY_CLOUD_NAME o VITE_CLOUDINARY_UPLOAD_PRESET en .env.local',
    )
  }

  const formData = new FormData()
  formData.append('file', file)
  formData.append('upload_preset', UPLOAD_PRESET)

  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/${resourceType}/upload`,
    {
      method: 'POST',
      body: formData,
    },
  )

  const data = (await response.json()) as {
    secure_url?: string
    error?: { message?: string }
  }

  if (!response.ok || !data.secure_url) {
    throw new Error(data.error?.message ?? 'No se pudo subir el archivo.')
  }

  return data.secure_url
}
