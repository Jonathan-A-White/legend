import { licence } from 'bsv-kit/bsv';
import { describe, expect, it } from 'vitest';
import { fetchLicenceStatus, LicenceConfigError } from '../../src/services/licenceCheck';
import { addMint, addRevoke, addTransfer, HOLDER_PUB, ISSUER, ISSUER_PUB, newChain, STRANGER } from '../support/licence-chain';

const check = (reader: licence.ChainReader) => fetchLicenceStatus(HOLDER_PUB, { issuer: ISSUER_PUB, reader });

describe('fetchLicenceStatus', () => {
  it('is held for a mint the issuer signed', async () => {
    const reader = newChain();
    addMint(reader, ISSUER);
    expect((await check(reader)).state).toBe('held');
  });

  it('is none for a mint someone else signed', async () => {
    const reader = newChain();
    addMint(reader, STRANGER);
    expect((await check(reader)).state).toBe('none');
  });

  it('is revoked when the issuer’s mint was moved away by a transfer', async () => {
    const reader = newChain();
    addMint(reader, ISSUER);
    addTransfer(reader, ISSUER);
    expect((await check(reader)).state).toBe('revoked');
  });

  it('is revoked when the issuer’s signed revoke is in the issuer’s history', async () => {
    const reader = newChain();
    addMint(reader, ISSUER);
    expect((await check(reader)).state).toBe('held');
    addRevoke(reader, ISSUER);
    expect((await check(reader)).state).toBe('revoked');
  });

  it('ignores a revoke the issuer did not sign', async () => {
    const reader = newChain();
    addMint(reader, ISSUER);
    addRevoke(reader, STRANGER);
    expect((await check(reader)).state).toBe('held');
  });

  it('is none for a key with no history, and ignores another collection', async () => {
    const reader = newChain();
    expect((await check(reader)).state).toBe('none');
    addMint(reader, ISSUER, 'postern');
    expect((await check(reader)).state).toBe('none');
  });

  it('throws when the chain cannot be reached', async () => {
    const reader = newChain();
    reader.offline = true;
    await expect(check(reader)).rejects.toThrow();
  });

  it('refuses to check with no issuer set, or on mainnet', async () => {
    await expect(fetchLicenceStatus(HOLDER_PUB, { issuer: '' })).rejects.toBeInstanceOf(LicenceConfigError);
    await expect(fetchLicenceStatus(HOLDER_PUB, { issuer: ISSUER_PUB, chain: 'mainnet' })).rejects.toBeInstanceOf(LicenceConfigError);
  });
});
