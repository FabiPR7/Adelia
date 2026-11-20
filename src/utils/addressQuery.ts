/** «Calle…», «Avda…» o con número: lo más probable es que se busque una calle, no una ciudad. */
export function looksLikeStreet(text: string): boolean {
  return /\d|^\s*(c\/|calle\b|avda\b|avenida\b|av\.|plaza\b|pza\b|paseo\b|camino\b|carretera\b|ronda\b|travesía\b|glorieta\b)/i.test(text)
}
