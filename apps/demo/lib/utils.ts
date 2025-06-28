// file :prepaid-gas-website/apps/demo/lib/utils.ts
export function formatAddress(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export function formatNumber(num: number | bigint): string {
  return num.toLocaleString();
}
