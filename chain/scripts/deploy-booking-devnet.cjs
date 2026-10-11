const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { Connection, Keypair } = require("@solana/web3.js");
const c = require("./booking-client.cjs");
async function main() {
  const root = path.join(__dirname, "..");
  const rpc =
    process.env.VYNX_DEVNET_RPC_URL || "https://api.devnet.solana.com";
  const connection = new Connection(rpc, "confirmed");
  if (
    (await connection.getGenesisHash()) !==
    "EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG"
  )
    throw Error("Refusing deployment outside devnet");
  const keypair = path.resolve(
    process.env.VYNX_DEPLOYER_KEYPAIR ||
      path.join(root, ".wallets/devnet-deployer.json"),
  );
  const deployer = Keypair.fromSecretKey(
    Uint8Array.from(JSON.parse(fs.readFileSync(keypair, "utf8"))),
  );
  const programKeypair = path.join(
    root,
    "target/deploy/vynx_booking-keypair.json",
  );
  const program = Keypair.fromSecretKey(
    Uint8Array.from(JSON.parse(fs.readFileSync(programKeypair, "utf8"))),
  );
  if (!program.publicKey.equals(c.PROGRAM_ID))
    throw Error("Program keypair does not match declared program ID");
  const binary = path.join(root, "target/deploy/vynx_booking.so");
  const size = fs.statSync(binary).size;
  const rent = await connection.getMinimumBalanceForRentExemption(size + 45);
  const balance = await connection.getBalance(deployer.publicKey);
  if (balance < rent + 200000000)
    throw Error(
      `Devnet deployer ${deployer.publicKey.toBase58()} has ${balance / 1e9} SOL; fund at least ${(rent + 200000000) / 1e9} devnet SOL for initial deployment and smoke testing`,
    );
  const bufferFile = path.join(root, ".wallets/booking-devnet-buffer.json");
  if (!fs.existsSync(bufferFile))
    fs.writeFileSync(
      bufferFile,
      JSON.stringify([...Keypair.generate().secretKey]),
      { mode: 0o600 },
    );
  const result = spawnSync(
    process.env.VYNX_SOLANA_CLI || "solana",
    [
      "program",
      "deploy",
      binary,
      "--url",
      rpc,
      "--keypair",
      keypair,
      "--program-id",
      programKeypair,
      "--buffer",
      bufferFile,
      "--max-len",
      String(size),
      "--max-sign-attempts",
      "2",
    ],
    { stdio: "inherit" },
  );
  if (result.status !== 0) throw Error("Devnet deployment failed");
  const account = await connection.getAccountInfo(c.PROGRAM_ID);
  if (!account?.executable || !account.owner.equals(c.LOADER))
    throw Error("Deployed program verification failed");
  const programData = await connection.getAccountInfo(c.programDataPda());
  const localBinary = fs.readFileSync(binary);
  if (
    !programData?.owner.equals(c.LOADER) ||
    !programData.data.subarray(45, 45 + size).equals(localBinary)
  )
    throw Error("Deployed program bytes do not match the local binary");
  const record = {
    network: "devnet",
    programId: c.PROGRAM_ID.toBase58(),
    configPda: c.configPda().toBase58(),
    deployer: deployer.publicKey.toBase58(),
    binarySha256: require("node:crypto")
      .createHash("sha256")
      .update(fs.readFileSync(binary))
      .digest("hex"),
    deployedAt: new Date().toISOString(),
  };
  fs.writeFileSync(
    path.join(root, "booking-devnet-deployment.json"),
    JSON.stringify(record, null, 2) + "\n",
  );
  console.log("Devnet deployment verified:", record.programId);
}
main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
