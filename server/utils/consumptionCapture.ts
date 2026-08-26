export interface ConsumptionLineItem {
  nodeId: string
  name: string
  quantity: number
  unitPriceCents: number
  lineTotalCents: number
}

export type ConsumptionCaptureMode = 'total' | 'products' | 'skip'

export interface ResolvedConsumptionCapture {
  mode: ConsumptionCaptureMode
  totalCents: number
  lineItems: ConsumptionLineItem[]
}

interface ProductSelectionInput {
  nodeId?: unknown
  quantity?: unknown
}

export async function resolveConsumptionCapture(options: {
  companyRef: FirebaseFirestore.DocumentReference
  mode: unknown
  declaredTotalCents: unknown
  productSelections: unknown
  requireDetails: boolean
}): Promise<ResolvedConsumptionCapture | { error: string }> {
  const mode = options.mode === 'total' || options.mode === 'products' || options.mode === 'skip'
    ? options.mode
    : options.requireDetails
      ? null
      : 'skip'

  if (!mode) {
    return { error: 'Indica el consumo con productos o con el precio total.' }
  }

  if (mode === 'skip') {
    if (options.requireDetails) {
      return { error: 'Esta oferta pide un gasto mínimo. Indica productos o el precio.' }
    }
    return { mode: 'skip', totalCents: 0, lineItems: [] }
  }

  if (mode === 'total') {
    const total = Number(options.declaredTotalCents)
    if (!Number.isFinite(total) || total < 0) {
      if (options.requireDetails) {
        return { error: 'Indica un importe total válido.' }
      }
      return { mode: 'skip', totalCents: 0, lineItems: [] }
    }

    return {
      mode: 'total',
      totalCents: Math.round(total),
      lineItems: [],
    }
  }

  const selections = Array.isArray(options.productSelections)
    ? options.productSelections as ProductSelectionInput[]
    : []

  if (selections.length === 0) {
    if (options.requireDetails) {
      return { error: 'Selecciona al menos un producto.' }
    }
    return { mode: 'skip', totalCents: 0, lineItems: [] }
  }

  const nodesSnapshot = await options.companyRef.collection('menuNodes')
    .where('active', '==', true)
    .limit(400)
    .get()

  const productMap = new Map<string, FirebaseFirestore.DocumentData>()
  nodesSnapshot.docs.forEach((docSnap) => {
    const data = docSnap.data()
    if (data.nodeType === 'product') {
      productMap.set(docSnap.id, data)
    }
  })

  const lineItems: ConsumptionLineItem[] = []
  let totalCents = 0

  for (const selection of selections) {
    const nodeId = typeof selection.nodeId === 'string' ? selection.nodeId.trim() : ''
    const quantity = Math.trunc(Number(selection.quantity))
    if (!nodeId || quantity < 1) {
      continue
    }

    const product = productMap.get(nodeId)
    if (!product) {
      return { error: 'Algún producto seleccionado ya no está disponible.' }
    }

    const unitPriceCents = typeof product.priceCents === 'number' ? product.priceCents : null
    if (unitPriceCents == null || unitPriceCents < 0) {
      return { error: `El producto «${product.name ?? nodeId}» no tiene precio.` }
    }

    const lineTotalCents = unitPriceCents * quantity
    totalCents += lineTotalCents
    lineItems.push({
      nodeId,
      name: (product.name as string) ?? 'Producto',
      quantity,
      unitPriceCents,
      lineTotalCents,
    })
  }

  if (lineItems.length === 0) {
    if (options.requireDetails) {
      return { error: 'Selecciona al menos un producto válido.' }
    }
    return { mode: 'skip', totalCents: 0, lineItems: [] }
  }

  return { mode: 'products', totalCents, lineItems }
}
