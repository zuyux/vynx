const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { LiteSVM, FailedTransactionMetadata } = require("litesvm");
const { getTransactionDecoder } = require("@solana/kit");
const {
  Keypair,
  PublicKey,
  Transaction,
  SystemProgram,
  ComputeBudgetProgram,
} = require("@solana/web3.js");
const c = require("../scripts/client.cjs");
function info(svm, key) {
  const account = svm.getAccount(key.toBase58());
  return account.exists
    ? {
        owner: new PublicKey(account.programAddress),
        data: Buffer.from(account.data),
        lamports: account.lamports,
      }
    : null;
}
function fixture() {
  const svm = new LiteSVM();
  const admin = Keypair.generate(),
    sponsor = Keypair.generate(),
    treasury = Keypair.generate(),
    owner = Keypair.generate(),
    stranger = Keypair.generate();
  for (const k of [admin, sponsor, treasury, owner, stranger])
    svm.airdrop(k.publicKey.toBase58(), 2000000000n);
  svm.addProgramWithLoader(
    c.PROGRAM_ID.toBase58(),
    fs.readFileSync(path.join(__dirname, "../target/deploy/vynx_alias.so")),
    c.LOADER.toBase58(),
  );
  // Give the real loader-owned program-data fixture its deployment authority.
  const programData = svm.getAccount(c.programDataPda().toBase58());
  assert(programData.exists);
  const data = Buffer.from(programData.data);
  data[12] = 1;
  admin.publicKey.toBuffer().copy(data, 13);
  svm.setAccount({ ...programData, data });
  function send(ix, payer = sponsor, signers = []) {
    const tx = new Transaction({
      feePayer: payer.publicKey,
      recentBlockhash: svm.latestBlockhash(),
    }).add(ComputeBudgetProgram.setComputeUnitLimit({ units: 200000 }), ix);
    const all = [
      ...new Map(
        [payer, ...signers].map((k) => [k.publicKey.toBase58(), k]),
      ).values(),
    ];
    tx.sign(...all);
    return svm.sendTransaction(getTransactionDecoder().decode(tx.serialize()));
  }
  function success(result) {
    assert(
      !(result instanceof FailedTransactionMetadata),
      result instanceof FailedTransactionMetadata
        ? result.meta().logs().join("\n")
        : "",
    );
  }
  function failed(result, code) {
    assert(
      result instanceof FailedTransactionMetadata,
      "Expected transaction failure",
    );
    if (code) assert.match(result.meta().logs().join("\n"), new RegExp(code));
  }
  function initialize(signer = admin) {
    return send(
      c.initializeIx(
        signer.publicKey,
        admin.publicKey,
        sponsor.publicKey,
        treasury.publicKey,
      ),
      signer,
    );
  }
  function config() {
    return c.decodeConfig(info(svm, c.configPda()));
  }
  function register(alias = "fabohax", who = owner, overrides = {}) {
    const cfg = config();
    return send(
      c.registerIx(
        who.publicKey,
        overrides.sponsor?.publicKey || sponsor.publicKey,
        overrides.treasury || treasury.publicKey,
        alias,
        overrides.price ?? cfg.tiers[Math.min(alias.length - 1, 4)],
        overrides.version ?? cfg.priceVersion,
        overrides.expiry ?? svm.getClock().slot + 120n,
      ),
      sponsor,
      [who, ...(overrides.sponsor ? [overrides.sponsor] : [])],
    );
  }
  return {
    svm,
    admin,
    sponsor,
    treasury,
    owner,
    stranger,
    send,
    success,
    failed,
    initialize,
    config,
    register,
  };
}
test("only deployment authority initializes; config cannot be reinitialized", () => {
  const f = fixture();
  f.failed(f.initialize(f.stranger), "Unauthorized");
  assert.equal(info(f.svm, c.configPda()), null);
  f.success(f.initialize());
  assert.deepEqual(f.config().tiers, c.INITIAL_TIERS);
  f.failed(f.initialize());
});
test("registration creates both PDAs and charges exactly the tier including deposits", () => {
  const f = fixture();
  f.success(f.initialize());
  const before = f.svm.getBalance(f.owner.publicKey.toBase58());
  const treasuryBefore = f.svm.getBalance(f.treasury.publicKey.toBase58());
  f.success(f.register());
  assert.equal(
    before - f.svm.getBalance(f.owner.publicKey.toBase58()),
    10000000n,
  );
  const record = c.decodeAlias(info(f.svm, c.aliasPda("fabohax")));
  assert(record.owner.equals(f.owner.publicKey));
  assert.equal(record.alias, "fabohax");
  assert.equal(record.paidLamports, 10000000n);
  const index = info(f.svm, c.ownerPda(f.owner.publicKey));
  assert(index.owner.equals(c.PROGRAM_ID));
  assert(index.data.subarray(40, 72).equals(c.aliasPda("fabohax").toBuffer()));
  const deposits =
    f.svm.minimumBalanceForRentExemption(115n) +
    f.svm.minimumBalanceForRentExemption(73n);
  assert.equal(
    f.svm.getBalance(f.treasury.publicKey.toBase58()) - treasuryBefore,
    10000000n - deposits,
  );
});
test("prefunded PDAs cannot discount registration", () => {
  const f = fixture();
  f.success(f.initialize());
  f.success(
    f.send(
      SystemProgram.transfer({
        fromPubkey: f.stranger.publicKey,
        toPubkey: c.aliasPda("fabohax"),
        lamports: 1000000,
      }),
      f.stranger,
    ),
  );
  const before = f.svm.getBalance(f.owner.publicKey.toBase58());
  f.success(f.register());
  assert.equal(
    before - f.svm.getBalance(f.owner.publicKey.toBase58()),
    10000000n,
  );
});
test("duplicate alias and second alias for a wallet fail without charging creator", () => {
  const f = fixture();
  f.success(f.initialize());
  f.success(f.register());
  const balance = f.svm.getBalance(f.owner.publicKey.toBase58());
  f.failed(f.register("another"), "AlreadyClaimed");
  assert.equal(f.svm.getBalance(f.owner.publicKey.toBase58()), balance);
  const second = f.svm.getBalance(f.stranger.publicKey.toBase58());
  f.failed(f.register("fabohax", f.stranger), "AlreadyClaimed");
  assert.equal(f.svm.getBalance(f.stranger.publicKey.toBase58()), second);
});
test("all length tiers use expected SOL prices", () => {
  const f = fixture();
  f.success(f.initialize());
  for (const name of [
    "a",
    "ab",
    "abc",
    "abcd",
    "abcde",
    "a".repeat(12),
    "b".repeat(30),
  ]) {
    const who = Keypair.generate();
    f.svm.airdrop(who.publicKey.toBase58(), 2000000000n);
    const before = f.svm.getBalance(who.publicKey.toBase58());
    f.success(f.register(name, who));
    assert.equal(
      before - f.svm.getBalance(who.publicKey.toBase58()),
      c.INITIAL_TIERS[Math.min(name.length - 1, 4)],
    );
  }
});
test("reserved and noncanonical names fail atomically", () => {
  const f = fixture();
  f.success(f.initialize());
  for (const name of ["support", "vynx", "api", "A", "alice.sol", "é", ""]) {
    f.failed(f.register(name, f.owner, { price: 10000000n }));
    assert.equal(info(f.svm, c.ownerPda(f.owner.publicKey)), null);
  }
});
test("sponsor, treasury, expiry and price checks cannot be bypassed", () => {
  const f = fixture();
  f.success(f.initialize());
  f.failed(
    f.register("fabohax", f.owner, { sponsor: f.stranger }),
    "Unauthorized",
  );
  f.failed(
    f.register("fabohax", f.owner, { treasury: f.stranger.publicKey }),
    "Unauthorized",
  );
  f.failed(f.register("fabohax", f.owner, { price: 1n }), "PriceChanged");
  f.failed(f.register("fabohax", f.owner, { version: 0n }), "PriceChanged");
  f.failed(
    f.register("fabohax", f.owner, { expiry: f.svm.getClock().slot + 151n }),
    "ExpiredQuote",
  );
  const clock = f.svm.getClock();
  clock.slot = 200n;
  f.svm.setClock(clock);
  f.failed(f.register("fabohax", f.owner, { expiry: 199n }), "ExpiredQuote");
  assert.equal(info(f.svm, c.ownerPda(f.owner.publicKey)), null);
});
test("admin updates prices, invalidates old quotes, and cannot set invalid tiers", () => {
  const f = fixture();
  f.success(f.initialize());
  const tiers = [...c.INITIAL_TIERS];
  tiers[4] = 12000000n;
  f.failed(
    f.send(c.pricesIx(f.stranger.publicKey, tiers), f.stranger),
    "Unauthorized",
  );
  f.failed(
    f.send(c.pricesIx(f.admin.publicKey, [0n, 0n, 0n, 0n, 0n]), f.admin),
    "InvalidTiers",
  );
  f.failed(
    f.send(
      c.pricesIx(f.admin.publicKey, [
        10000000n,
        20000000n,
        10000000n,
        10000000n,
        10000000n,
      ]),
      f.admin,
    ),
    "InvalidTiers",
  );
  f.success(f.send(c.pricesIx(f.admin.publicKey, tiers), f.admin));
  assert.equal(f.config().priceVersion, 2n);
  f.failed(
    f.register("fabohax", f.owner, { price: 10000000n, version: 1n }),
    "PriceChanged",
  );
  f.success(f.register());
  assert.equal(
    c.decodeAlias(info(f.svm, c.aliasPda("fabohax"))).paidLamports,
    12000000n,
  );
});
test("pause and two-step admin rotation preserve existing ownership", () => {
  const f = fixture();
  f.success(f.initialize());
  f.success(f.register());
  f.success(
    f.send(
      c.adminIx("set_paused", f.admin.publicKey, Buffer.from([1])),
      f.admin,
    ),
  );
  f.failed(f.register("newname", f.stranger), "Paused");
  f.success(
    f.send(
      c.adminIx(
        "nominate_admin",
        f.admin.publicKey,
        f.stranger.publicKey.toBuffer(),
      ),
      f.admin,
    ),
  );
  f.failed(
    f.send(c.adminIx("accept_admin", f.admin.publicKey), f.admin),
    "Unauthorized",
  );
  f.success(
    f.send(c.adminIx("accept_admin", f.stranger.publicKey), f.stranger),
  );
  assert(f.config().admin.equals(f.stranger.publicKey));
  f.failed(
    f.send(
      c.adminIx("set_paused", f.admin.publicKey, Buffer.from([0])),
      f.admin,
    ),
    "Unauthorized",
  );
  assert(
    c
      .decodeAlias(info(f.svm, c.aliasPda("fabohax")))
      .owner.equals(f.owner.publicKey),
  );
});
test("insufficient funds roll back both account creations", () => {
  const f = fixture();
  f.success(f.initialize());
  const poor = Keypair.generate();
  f.svm.airdrop(poor.publicKey.toBase58(), 5000000n);
  const before = f.svm.getBalance(poor.publicKey.toBase58());
  f.failed(f.register("fabohax", poor));
  assert.equal(f.svm.getBalance(poor.publicKey.toBase58()), before);
  assert.equal(info(f.svm, c.aliasPda("fabohax")), null);
  assert.equal(info(f.svm, c.ownerPda(poor.publicKey)), null);
});
test("owner and sponsor must sign and substituted PDAs are rejected", () => {
  const f = fixture();
  f.success(f.initialize());
  const cfg = f.config();
  function ix() {
    return c.registerIx(
      f.owner.publicKey,
      f.sponsor.publicKey,
      f.treasury.publicKey,
      "fabohax",
      cfg.tiers[4],
      cfg.priceVersion,
      f.svm.getClock().slot + 120n,
    );
  }
  const unsignedOwner = ix();
  unsignedOwner.keys[0].isSigner = false;
  f.failed(f.send(unsignedOwner));
  const unsignedSponsor = ix();
  unsignedSponsor.keys[1].isSigner = false;
  f.failed(f.send(unsignedSponsor, f.stranger, [f.owner]));
  const wrongAlias = ix();
  wrongAlias.keys[4].pubkey = c.aliasPda("different");
  f.failed(f.send(wrongAlias, f.sponsor, [f.owner]), "ConstraintSeeds");
  const wrongOwner = ix();
  wrongOwner.keys[5].pubkey = c.ownerPda(f.stranger.publicKey);
  f.failed(f.send(wrongOwner, f.sponsor, [f.owner]), "ConstraintSeeds");
  assert.equal(info(f.svm, c.ownerPda(f.owner.publicKey)), null);
});
test("client instruction discriminators and register argument layout match generated Anchor IDL", () => {
  const idl = JSON.parse(
    fs.readFileSync(path.join(__dirname, "../idl/vynx_alias.json"), "utf8"),
  );
  assert.equal(idl.address, c.PROGRAM_ID.toBase58());
  for (const ix of idl.instructions)
    assert.deepEqual(ix.discriminator, [...c.discriminator("global", ix.name)]);
  const register = idl.instructions.find((ix) => ix.name === "register");
  assert.deepEqual(
    register.accounts.map((a) => a.name),
    [
      "owner",
      "sponsor",
      "config",
      "treasury",
      "alias_record",
      "owner_index",
      "system_program",
    ],
  );
  assert.deepEqual(
    register.args.map((a) => a.name),
    [
      "alias",
      "expected_total_lamports",
      "expected_price_version",
      "expires_at_slot",
      "intent_id",
    ],
  );
});

test('legacy migration requires maintenance mode and both authorities; creator pays zero', () => {
  const f = fixture();
  f.success(f.initialize());
  const claimId = Buffer.alloc(16, 7);
  const ix = (admin = f.admin) => c.migrateIx(admin.publicKey, f.owner.publicKey, 'legacy', f.svm.getClock().slot + 120n, claimId);
  f.failed(f.send(ix(), f.admin, [f.owner]), 'MigrationRequiresPause');
  f.success(f.send(c.adminIx('set_paused', f.admin.publicKey, Buffer.from([1])), f.admin));
  f.failed(f.send(ix(f.stranger), f.stranger, [f.owner]), 'Unauthorized');
  const missingOwner = ix();
  missingOwner.keys[1].isSigner = false;
  f.failed(f.send(missingOwner, f.admin));
  const substituted = ix();
  substituted.keys[3].pubkey = c.aliasPda('another');
  f.failed(f.send(substituted, f.admin, [f.owner]), 'ConstraintSeeds');
  const expired = c.migrateIx(f.admin.publicKey, f.owner.publicKey, 'legacy', f.svm.getClock().slot + 151n, claimId);
  f.failed(f.send(expired, f.admin, [f.owner]), 'ExpiredQuote');
  claimId[0] = 8; // Fresh signature after the earlier failed maintenance-mode attempt.
  const before = f.svm.getBalance(f.owner.publicKey.toBase58());
  const treasury = f.svm.getBalance(f.treasury.publicKey.toBase58());
  f.success(f.send(ix(), f.admin, [f.owner]));
  assert.equal(f.svm.getBalance(f.owner.publicKey.toBase58()), before);
  assert.equal(f.svm.getBalance(f.treasury.publicKey.toBase58()), treasury);
  const record = c.decodeAlias(info(f.svm, c.aliasPda('legacy')));
  assert(record.owner.equals(f.owner.publicKey));
  assert.equal(record.paidLamports, 0n);
  assert.equal(record.priceVersion, 0n);
  assert(info(f.svm, c.ownerPda(f.owner.publicKey)).data.subarray(40, 72).equals(c.aliasPda('legacy').toBuffer()));
  f.failed(f.send(c.migrateIx(f.admin.publicKey, f.owner.publicKey, 'other', f.svm.getClock().slot + 120n, claimId), f.admin, [f.owner]), 'AlreadyClaimed');
  f.failed(f.send(c.migrateIx(f.admin.publicKey, f.stranger.publicKey, 'legacy', f.svm.getClock().slot + 120n, claimId), f.admin, [f.stranger]), 'AlreadyClaimed');
});
