import { fetchAttestations } from './npm-api.js';

export interface AttestationInfo {
  present: boolean;
  predicateTypes: string[];
}

const SLSA_PREDICATE_TYPES = [
  'https://slsa.dev/provenance/v0.2',
  'https://slsa.dev/provenance/v1',
  'https://in-toto.io/Statement/v0.1',
];

export async function getAttestation(
  packageName: string,
  version: string,
): Promise<AttestationInfo> {
  const response = await fetchAttestations(packageName, version);
  if (!response || response.attestations.length === 0) {
    return { present: false, predicateTypes: [] };
  }

  const predicateTypes = response.attestations.map((a) => a.predicateType);
  const hasSlsa = predicateTypes.some((t) => SLSA_PREDICATE_TYPES.includes(t));

  return {
    present: hasSlsa || predicateTypes.length > 0,
    predicateTypes,
  };
}
