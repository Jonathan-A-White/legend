// tests/support/licence-chain.ts — a fake testnet chain holding the transactions bsv-kit's licenceStatus reads:
// mint (M), transfer (TR) and the issuer's signed revoke (W) records, each spending a P2PKH output of the signer
// (the issuer rule checks that the pushed key owns the spent output, so a funding transaction is on the chain too).
import { Hash, LockingScript, OP, P2PKH, PrivateKey, Transaction, UnlockingScript, Utils } from '@bsv/sdk';
import { licence } from 'bsv-kit/bsv';

export const HOLDER = PrivateKey.fromHex('11'.repeat(32));
export const HOLDER_PUB = HOLDER.toPublicKey().toString();
export const HOLDER_ADDRESS = HOLDER.toPublicKey().toAddress('testnet');
export const ISSUER = PrivateKey.fromHex('22'.repeat(32));
export const ISSUER_PUB = ISSUER.toPublicKey().toString();
export const STRANGER = PrivateKey.fromHex('33'.repeat(32));

export const MINT_TXID = 'b'.repeat(64);
export const REVOKE_TXID = 'c'.repeat(64);
export const TRANSFER_TXID = 'd'.repeat(64);

type RecordType = 'M' | 'TR' | 'W';

function fundingTxid(owner: PrivateKey): string {
  return Utils.toHex(Hash.sha256(owner.toPublicKey().encode(true) as number[]));
}

/** The transaction that gave `owner` a P2PKH output; the reader can fetch it by txid. */
function fundingTransaction(owner: PrivateKey): string {
  const tx = new Transaction();
  tx.addInput({ sourceTXID: '00'.repeat(32), sourceOutputIndex: 0, unlockingScript: new UnlockingScript() });
  tx.addOutput({ lockingScript: new P2PKH().lock(Hash.hash160(owner.toPublicKey().encode(true) as number[])), satoshis: 1000 });
  return tx.toHex();
}

/** A record transaction whose one input spends `signer`'s funding output and pushes the signer's public key. */
function recordTx(recordType: RecordType, payload: object, signer: PrivateKey): string {
  const script = new LockingScript()
    .writeOpCode(OP.OP_FALSE)
    .writeOpCode(OP.OP_RETURN)
    .writeBin(Utils.toArray('nftgate', 'utf8'))
    .writeBin([0x02])
    .writeBin(Utils.toArray(recordType, 'utf8'))
    .writeBin([0x00])
    .writeBin(Utils.toArray(JSON.stringify(payload), 'utf8'));
  const tx = new Transaction();
  tx.addInput({
    sourceTXID: fundingTxid(signer),
    sourceOutputIndex: 0,
    unlockingScript: new UnlockingScript().writeBin([0x30, 0x01]).writeBin(signer.toPublicKey().encode(true) as number[]),
  });
  tx.addOutput({ lockingScript: script, satoshis: 0 });
  return tx.toHex();
}

/** A reader that already holds the funding transactions of the issuer and the stranger. */
export function newChain(): licence.FakeChainReader {
  const reader = new licence.FakeChainReader();
  for (const owner of [ISSUER, STRANGER]) reader.addKnownTransaction(fundingTxid(owner), fundingTransaction(owner));
  return reader;
}

/** `signer` mints a 'legend' licence to the holder (the holder's history lists it). */
export function addMint(reader: licence.FakeChainReader, signer: PrivateKey = ISSUER, collection = 'legend'): void {
  reader.addTransaction(HOLDER_ADDRESS, MINT_TXID, recordTx('M', { collection, holder: HOLDER_ADDRESS }, signer));
}

/** The mint's outpoint is moved away by a transfer record, listed in the holder's history. */
export function addTransfer(reader: licence.FakeChainReader, signer: PrivateKey = ISSUER): void {
  reader.addTransaction(HOLDER_ADDRESS, TRANSFER_TXID, recordTx('TR', { origin: `${MINT_TXID}:0`, to: 'mzElsewhere' }, signer));
}

/** The issuer's signed revoke (W) record for the mint, listed in the issuer's own history, as Postern writes it. */
export function addRevoke(reader: licence.FakeChainReader, signer: PrivateKey = ISSUER): void {
  const issuerAddress = ISSUER.toPublicKey().toAddress('testnet');
  reader.addTransaction(issuerAddress, REVOKE_TXID, recordTx('W', { kind: 'revoke', origin: `${MINT_TXID}:0` }, signer));
}
