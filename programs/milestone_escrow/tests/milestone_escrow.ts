import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { MilestoneEscrow } from "../target/types/milestone_escrow";
import { assert } from "chai";
import { PublicKey } from "@solana/web3.js";

describe("milestone_escrow", () => {
  // Configure the client to use the local cluster.
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.MilestoneEscrow as Program<MilestoneEscrow>;

  // 1. Generate local keypairs for everyone involved
  const contractor = anchor.web3.Keypair.generate();
  const freelancer = anchor.web3.Keypair.generate();
  const aiJudge = anchor.web3.Keypair.generate();

  // The escrow account is a PDA derived from the contractor's public key
  // seeds = [b"escrow", contractor.key().as_ref()]
  const [escrowAccount] = PublicKey.findProgramAddressSync(
    [Buffer.from("escrow"), contractor.publicKey.toBuffer()],
    program.programId
  );

  // 1 SOL is 1,000,000,000 lamports
  const escrowAmount = new anchor.BN(1000000000); // 1 SOL

  it("Airdrop test SOL to the contractor", async () => {
    // We need to give the contractor money so they can fund the escrow
    const signature = await provider.connection.requestAirdrop(
      contractor.publicKey,
      2000000000 // 2 SOL
    );
    const latestBlockhash = await provider.connection.getLatestBlockhash();
    await provider.connection.confirmTransaction({
      signature,
      ...latestBlockhash,
    });

    // Verify balance
    const balance = await provider.connection.getBalance(contractor.publicKey);
    console.log(`Contractor balance: ${balance} lamports`);
    assert.ok(balance >= 2000000000);
  });

  it("Initializes the Escrow", async () => {
    await program.methods
      .initialize(escrowAmount)
      .accounts({
        escrowAccount: escrowAccount,
        contractor: contractor.publicKey,
        freelancer: freelancer.publicKey,
        aiJudge: aiJudge.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([contractor]) // Contractor pays for it
      .rpc();

    // Fetch the account to verify it worked
    const account = await program.account.escrowState.fetch(escrowAccount);
    console.log("Escrow initialized:");
    console.log("  Contractor:", account.contractor.toBase58());
    console.log("  Freelancer:", account.freelancer.toBase58());
    console.log("  AI Judge:", account.aiJudge.toBase58());
    console.log("  Amount:", account.amount.toString());
    
    assert.ok(account.amount.eq(escrowAmount));
    // In Anchor TS, enums are formatted as objects with empty properties
    assert.deepEqual(account.status, { inProgress: {} }); 
  });

  it("Freelancer submits work", async () => {
    await program.methods
      .submitWork()
      .accounts({
        escrowAccount: escrowAccount,
        signer: freelancer.publicKey,
      })
      .signers([freelancer]) // Freelancer must sign this
      .rpc();

    const account = await program.account.escrowState.fetch(escrowAccount);
    console.log("Work submitted, status:", JSON.stringify(account.status));
    assert.deepEqual(account.status, { awaitingApproval: {} });
  });

  it("Contractor disputes the work", async () => {
    // false means they do NOT approve
    await program.methods
      .contractorDecision(false) 
      .accounts({
        escrowAccount: escrowAccount,
        signer: contractor.publicKey,
      })
      .signers([contractor])
      .rpc();

    const account = await program.account.escrowState.fetch(escrowAccount);
    console.log("Contractor disputed, status:", JSON.stringify(account.status));
    assert.deepEqual(account.status, { inDispute: {} }); // Triggers AI Judge
  });

  it("AI Judge resolves the dispute in favor of Freelancer", async () => {
    // true means the AI approves the work
    await program.methods
      .aiJudgeDecision(true) 
      .accounts({
        escrowAccount: escrowAccount,
        signer: aiJudge.publicKey,
      })
      .signers([aiJudge]) // AI backend must sign this
      .rpc();

    const account = await program.account.escrowState.fetch(escrowAccount);
    console.log("AI Judge approved, status:", JSON.stringify(account.status));
    assert.deepEqual(account.status, { approved: {} });
  });
});