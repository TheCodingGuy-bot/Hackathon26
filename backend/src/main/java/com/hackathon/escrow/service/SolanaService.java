package com.hackathon.escrow.service;

import com.solana.core.Account;
import com.solana.core.PublicKey;
import com.solana.core.Transaction;
import com.solana.instructions.SystemProgram;
import com.solana.rpc.RpcClient;
import com.solana.rpc.types.AccountInfo;
import com.solana.rpc.types.TokenResult;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.math.BigInteger;
import java.util.Arrays;
import java.util.List;

@Service
@Slf4j
public class SolanaService {

    @Value("${solana.rpc.url:http://localhost:8899}")
    private String rpcUrl;

    @Value("${solana.program.id:6NikvvCPKpAkbdXWg8NtNes77mno854GjCouQqmkgyBS}")
    private String programId;

    @Value("${solana.wallet.private-key:}")
    private String walletPrivateKey;

    private RpcClient getClient() {
        return new RpcClient(rpcUrl);
    }

    /**
     * Initialize a new escrow account for a project milestone
     * Seeds: ["escrow", contractor_pubkey.as_bytes()]
     */
    public String initializeEscrow(
            String contractorPubkey,
            String freelancerPubkey,
            String aiJudgePubkey,
            long amountLamports
    ) throws Exception {
        RpcClient client = getClient();

        // Create account keypairs
        Account contractor = new Account(hexToBytes(walletPrivateKey));
        PublicKey contractorKey = new PublicKey(contractorPubkey);
        
        // Derive escrow PDA
        byte[] seed = ("escrow" + contractorPubkey).getBytes();
        PublicKey escrowPubkey = PublicKey.createProgramAddress(
                Arrays.asList(seed),
                new PublicKey(programId)
        );

        // Build transaction
        Transaction tx = new Transaction();
        
        // Create account instruction
        long space = 8 + 32 + 32 + 32 + 8 + 1 + 1; // EscrowState size
        long rentExempt = client.getMinimumBalanceForRentExemption(space).value;
        
        tx.addInstruction(
                SystemProgram.createAccount(
                        contractor,
                        escrowPubkey,
                        BigInteger.valueOf(rentExempt + amountLamports),
                        BigInteger.valueOf(space),
                        new PublicKey(programId)
                )
        );

        // Initialize instruction (call program)
        // This would need proper instruction encoding based on the Anchor IDL
        
        String signature = client.sendTransaction(tx, contractor);
        log.info("Escrow initialized: {}", signature);
        
        return escrowPubkey.toBase58();
    }

    /**
     * Submit work for a milestone (freelancer calls submitWork)
     */
    public String submitWork(String escrowPubkey, String freelancerPrivateKey) throws Exception {
        RpcClient client = getClient();
        Account freelancer = new Account(hexToBytes(freelancerPrivateKey));
        
        // Build submitWork instruction
        // For now, just return the escrow account to mark it as submitted
        // In production, encode proper instruction data
        
        log.info("Work submitted for escrow: {}", escrowPubkey);
        return "submitted";
    }

    /**
     * AI Judge decision on a disputed milestone
     */
    public String aiJudgeDecision(String escrowPubkey, String aiJudgePrivateKey, boolean approved) throws Exception {
        RpcClient client = getClient();
        Account aiJudge = new Account(hexToBytes(aiJudgePrivateKey));
        PublicKey escrow = new PublicKey(escrowPubkey);
        
        // Build transaction with aiJudgeDecision instruction
        Transaction tx = new Transaction();
        
        // Encode instruction: method = "ai_judge_decision", arg = approved
        byte[] instructionData = encodeAiJudgeDecision(approved);
        
        // In production, create proper Anchor instruction
        // For demo, we just log the decision
        
        log.info("AI Judge decision for {}: approved={}", escrowPubkey, approved);
        
        return approved ? "approved" : "rejected";
    }

    /**
     * Get all escrow accounts in InDispute status
     */
    public List<String> getDisputedEscrows() throws Exception {
        RpcClient client = getClient();
        
        // In production, would fetch all program accounts and filter by status
        // For demo, return empty list
        return List.of();
    }

    /**
     * Check if an account exists on-chain
     */
    public boolean accountExists(String pubkey) throws Exception {
        RpcClient client = getClient();
        try {
            AccountInfo info = client.getApi().getAccountInfo(new PublicKey(pubkey)).join();
            return info.getValue() != null;
        } catch (Exception e) {
            return false;
        }
    }

    /**
     * Get account balance
     */
    public long getBalance(String pubkey) throws Exception {
        RpcClient client = getClient();
        TokenResult<Long> balance = client.getBalance(new PublicKey(pubkey));
        return balance.value;
    }

    // Helper: Convert hex string to byte array
    private byte[] hexToBytes(String hex) {
        if (hex == null || hex.isEmpty()) {
            return new byte[64]; // Empty bytes for default
        }
        hex = hex.replace("0x", "");
        byte[] bytes = new byte[hex.length() / 2];
        for (int i = 0; i < bytes.length; i++) {
            bytes[i] = (byte) Integer.parseInt(hex.substring(i * 2, i * 2 + 2), 16);
        }
        return bytes;
    }

    // Encode AI judge decision instruction data
    private byte[] encodeAiJudgeDecision(boolean approved) {
        // Anchor instruction: variant index 3 (ai_judge_decision)
        // + boolean argument
        byte[] data = new byte[5];
        data[0] = 3; // Method index
        data[1] = approved ? 1 : 0;
        return data;
    }
}