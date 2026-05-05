/**
 * Token logosu için gelen URL'yi temizler ve IPFS gibi özel durumları handle eder.
 */
export function formatLogoURI(uri?: string): string | undefined {
  if (!uri) return undefined;

  // IPFS desteği (Gateway ekle)
  if (uri.startsWith('ipfs://')) {
    return `https://ipfs.io/ipfs/${uri.replace('ipfs://', '')}`;
  }

  // Boşlukları temizle
  return uri.trim();
}
