const { createHash, randomBytes } = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const {
  PublicKey,
  TransactionInstruction,
  SystemProgram,
} = require("@solana/web3.js");
const PROGRAM_ID = new PublicKey(
  fs.readFileSync(path.join(__dirname, "../program-id.txt"), "utf8").trim(),
);
const LOADER = new PublicKey("BPFLoaderUpgradeab1e11111111111111111111111");
const INITIAL_TIERS = [
  920000000n,
  530000000n,
  300000000n,
  140000000n,
  10000000n,
];
const RESERVED = new Set([
  "admin",
  "api",
  "auth",
  "creators",
  "dashboard",
  "profile",
  "support",
  "settings",
  "login",
  "logout",
  "favicon",
  "robots",
  "sitemap",
  "_next",
  "help",
  "security",
  "treasury",
  "official",
  "vynx",
  "system",
]);
function discriminator(namespace, name) {
  return createHash("sha256")
    .update(`${namespace}:${name}`)
    .digest()
    .subarray(0, 8);
}
function u64(value) {
  const out = Buffer.alloc(8);
  out.writeBigUInt64LE(BigInt(value));
  return out;
}
function key(pubkey, isSigner = false, isWritable = false) {
  return { pubkey, isSigner, isWritable };
}
function pda(seeds) {
  return PublicKey.findProgramAddressSync(seeds, PROGRAM_ID)[0];
}
function configPda() {
  return pda([Buffer.from("config")]);
}
function aliasPda(alias) {
  return pda([Buffer.from("alias"), Buffer.from(alias)]);
}
function ownerPda(owner) {
  return pda([Buffer.from("owner"), owner.toBuffer()]);
}
function programDataPda() {
  return PublicKey.findProgramAddressSync([PROGRAM_ID.toBuffer()], LOADER)[0];
}
function normalizeAlias(value) {
  const alias = value.trim().replace(/^@/, "").toLowerCase();
  if (!/^[a-z0-9_]{1,30}$/.test(alias) || RESERVED.has(alias))
    throw Error("Invalid or reserved VYNX alias");
  return alias;
}
function instruction(name, keys, args = Buffer.alloc(0)) {
  return new TransactionInstruction({
    programId: PROGRAM_ID,
    keys,
    data: Buffer.concat([discriminator("global", name), args]),
  });
}
function initializeIx(authority, admin, sponsor, treasury) {
  return instruction(
    "initialize",
    [
      key(authority, true, true),
      key(PROGRAM_ID),
      key(programDataPda()),
      key(configPda(), false, true),
      key(SystemProgram.programId),
    ],
    Buffer.concat([admin.toBuffer(), sponsor.toBuffer(), treasury.toBuffer()]),
  );
}
function adminIx(name, admin, data) {
  return instruction(
    name,
    [key(admin, true), key(configPda(), false, true)],
    data,
  );
}
function pricesIx(admin, tiers) {
  return adminIx(
    "set_registration_price_tiers",
    admin,
    Buffer.concat(tiers.map(u64)),
  );
}
function registerIx(
  owner,
  sponsor,
  treasury,
  alias,
  price,
  version,
  expiry,
  intent = randomBytes(16),
) {
  const name = Buffer.from(alias);
  const length = Buffer.alloc(4);
  length.writeUInt32LE(name.length);
  return instruction(
    "register",
    [
      key(owner, true, true),
      key(sponsor, true),
      key(configPda()),
      key(treasury, false, true),
      key(aliasPda(alias), false, true),
      key(ownerPda(owner), false, true),
      key(SystemProgram.programId),
    ],
    Buffer.concat([
      length,
      name,
      u64(price),
      u64(version),
      u64(expiry),
      intent,
    ]),
  );
}
function migrateIx(admin, owner, alias, expiry, claimId) {
  if (normalizeAlias(alias) !== alias || claimId.length !== 16) throw Error("Invalid migration arguments");
  const name = Buffer.from(alias);
  const length = Buffer.alloc(4);
  length.writeUInt32LE(name.length);
  return instruction("migrate_verified_claim", [
    key(admin, true, true), key(owner, true), key(configPda()),
    key(aliasPda(alias), false, true), key(ownerPda(owner), false, true),
    key(SystemProgram.programId),
  ], Buffer.concat([length, name, u64(expiry), claimId]));
}
function verifyAccount(info, name) {
  if (
    !info ||
    !info.owner.equals(PROGRAM_ID) ||
    !Buffer.from(info.data)
      .subarray(0, 8)
      .equals(discriminator("account", name))
  )
    throw Error(`Invalid ${name} account`);
  return Buffer.from(info.data);
}
function decodeConfig(info) {
  const d = verifyAccount(info, "Config");
  if (d.length !== 186) throw Error("Unexpected config size");
  return {
    admin: new PublicKey(d.subarray(8, 40)),
    pendingAdmin: new PublicKey(d.subarray(40, 72)),
    sponsor: new PublicKey(d.subarray(72, 104)),
    treasury: new PublicKey(d.subarray(104, 136)),
    tiers: Array.from({ length: 5 }, (_, i) => d.readBigUInt64LE(136 + i * 8)),
    priceVersion: d.readBigUInt64LE(176),
    paused: !!d[184],
  };
}
function decodeAlias(info) {
  const d = verifyAccount(info, "AliasRecord");
  if (d.length !== 115) throw Error("Unexpected alias size");
  const len = d.readUInt32LE(40);
  if (len < 1 || len > 30) throw Error("Invalid alias length");
  const alias = d.subarray(44, 44 + len).toString("utf8");
  if (normalizeAlias(alias) !== alias) throw Error("Noncanonical alias");
  return {
    owner: new PublicKey(d.subarray(8, 40)),
    alias,
    slot: d.readBigUInt64LE(44 + len),
    paidLamports: d.readBigUInt64LE(52 + len),
    priceVersion: d.readBigUInt64LE(60 + len),
  };
}
module.exports = {
  PROGRAM_ID,
  LOADER,
  INITIAL_TIERS,
  discriminator,
  u64,
  key,
  configPda,
  aliasPda,
  ownerPda,
  programDataPda,
  normalizeAlias,
  initializeIx,
  adminIx,
  pricesIx,
  registerIx,
  migrateIx,
  decodeConfig,
  decodeAlias,
};
