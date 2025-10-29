import Decimal from "decimal.js";
import { PieceCID, SIZE_CONSTANTS } from "@filoz/synapse-sdk";
import { UnifiedSizeInfo } from "../types";
import { getSizeFromPieceCID } from "@filoz/synapse-sdk/piece";

// Configure Decimal.js: precision 34 handles Solidity uint256 and wei conversions
Decimal.set({
  precision: 34,
  rounding: Decimal.ROUND_HALF_UP,
  toExpNeg: -21,
  toExpPos: 21,
  maxE: 9e15,
  minE: -9e15,
  modulo: Decimal.ROUND_DOWN,
});

// Type for values that can be converted to Decimal
type DecimalLike = bigint | string | number | Decimal;

/** Converts any numeric type to Decimal */
const toDecimal = (value: DecimalLike): Decimal =>
  value instanceof Decimal ? value : new Decimal(value.toString());

/** Converts bytes to KiB */
export const bytesToKiB = (bytes: DecimalLike): Decimal =>
  toDecimal(bytes).div(new Decimal(SIZE_CONSTANTS.KiB.toString()));

/** Converts bytes to MiB */
export const bytesToMiB = (bytes: DecimalLike): Decimal =>
  toDecimal(bytes).div(new Decimal(SIZE_CONSTANTS.MiB.toString()));

/** Converts bytes to GiB */
export const bytesToGiB = (bytes: DecimalLike): Decimal =>
  toDecimal(bytes).div(new Decimal(SIZE_CONSTANTS.GiB.toString()));

/** Converts TiB to bytes */
export const tibToBytes = (tib: DecimalLike): Decimal =>
  toDecimal(tib).mul(new Decimal(SIZE_CONSTANTS.TiB.toString()));


/**
 * Extracts piece size and metadata from CommP v2 CID.
 * Matches on-chain calculations exactly for smart contract compatibility.
 * Formula: pieceSize = (1 << (height+5)) - (128*padding)/127
 *
 * @param input - CID as Uint8Array or hex string
 * @returns Piece size info with bytes/KiB/MiB/GiB conversions
 */
export const getPieceInfoFromCidBytes = (
  input: string | PieceCID
): UnifiedSizeInfo => {
  const sizeBytes = BigInt(getSizeFromPieceCID(input));
  return {
    sizeBytes,
    sizeKiB: bytesToKiB(sizeBytes).toNumber(),
    sizeMiB: bytesToMiB(sizeBytes).toNumber(),
    sizeGiB: bytesToGiB(sizeBytes).toNumber(),
  };
};

export const sizeInfoMessage = (sizeInfo: {
  sizeInBytes: number;
  sizeInKiB: number;
  sizeInMiB: number;
  sizeInGB: number;
}) => {
  if (sizeInfo.sizeInGB > 0.1) {
    return `Dataset size: ${sizeInfo.sizeInGB.toFixed(4)} GB`;
  }
  if (sizeInfo.sizeInMiB > 0.1) {
    return `Dataset size: ${sizeInfo.sizeInMiB.toFixed(4)} MB`;
  }
  if (sizeInfo.sizeInKiB > 0.1) {
    return `Dataset size: ${sizeInfo.sizeInKiB.toFixed(4)} KB`;
  }
  return `Dataset size: ${sizeInfo.sizeInBytes} Bytes`;
};