export interface PriceProof {
  pair: string;
  ledger: number;
  result: boolean;
}

export interface VerifiedProofRecord extends PriceProof {
  id: string;
  verifiedAt: number;
}

export interface VerifiedProofExport {
  exportedAt: number;
  proofs: VerifiedProofRecord[];
}
