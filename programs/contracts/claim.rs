use anchor_lang::prelude::*;
use anchor_lang::system_program;

declare_id!("ASqvNsj2EWDQmhbnpGoxqqTue7uyWAvSv36GixqpfJop");

// 0.00001 SOL in lamports (1 SOL = 1_000_000_000 lamports)
const CLAIM_FEE: u64 = 10_000;
const MAX_ALIAS_LEN: usize = 32;
const TREASURY_PUBKEY: &str = "DmXZFxeBZbDFM55aSDEcCXqcSnBJBs4U32HMt197MY4E";

// ─── Program ─────────────────────────────────────────────────────────────────

#[program]
pub mod vynx_alias_claim {
    use super::*;

    /// Claim a VYNX alias by paying CLAIM_FEE (0.00001 SOL).
    /// Creates two PDAs:
    ///   - AliasRecord  (seeds: ["alias", alias])   → stores owner pubkey
    ///   - WalletRecord (seeds: ["wallet", owner])  → stores alias string
    pub fn claim_alias(ctx: Context<ClaimAlias>, alias: String) -> Result<()> {
        // Validate alias string
        require!(
            !alias.is_empty() && alias.len() <= MAX_ALIAS_LEN,
            VynxError::InvalidAliasLength
        );
        require!(is_valid_alias(&alias), VynxError::InvalidAliasCharacters);

        // Transfer fee to treasury
        let cpi_ctx = CpiContext::new(
            ctx.accounts.system_program.to_account_info(),
            system_program::Transfer {
                from: ctx.accounts.owner.to_account_info(),
                to: ctx.accounts.treasury.to_account_info(),
            },
        );
        system_program::transfer(cpi_ctx, CLAIM_FEE)?;

        // Populate alias record PDA
        let alias_record = &mut ctx.accounts.alias_record;
        alias_record.owner = ctx.accounts.owner.key();
        alias_record.alias = alias.clone();
        alias_record.claimed_at = Clock::get()?.unix_timestamp;

        // Populate wallet record PDA
        let wallet_record = &mut ctx.accounts.wallet_record;
        wallet_record.owner = ctx.accounts.owner.key();
        wallet_record.alias = alias.clone();

        emit!(AliasClaimed {
            owner: ctx.accounts.owner.key(),
            alias,
        });

        Ok(())
    }

    /// Release the caller's current alias.
    /// Closes both PDAs and returns rent to the owner.
    pub fn release_alias(ctx: Context<ReleaseAlias>) -> Result<()> {
        let alias = ctx.accounts.wallet_record.alias.clone();

        emit!(AliasReleased {
            owner: ctx.accounts.owner.key(),
            alias,
        });

        // Anchor closes the accounts automatically via `close = owner` in the context.
        Ok(())
    }

    /// Transfer an alias to a new owner.
    /// Closes the old WalletRecord, creates a new one for the recipient, and updates AliasRecord.owner.
    pub fn transfer_alias(ctx: Context<TransferAlias>) -> Result<()> {
        // Only the current owner can transfer
        require_keys_eq!(ctx.accounts.owner.key(), ctx.accounts.alias_record.owner, VynxError::Unauthorized);

        // Update AliasRecord owner
        let alias_record = &mut ctx.accounts.alias_record;
        alias_record.owner = ctx.accounts.new_owner.key();

        // Close old WalletRecord (rent goes to old owner)
        // Anchor will close it automatically via close = owner

        // Create new WalletRecord for new owner
        let wallet_record = &mut ctx.accounts.new_wallet_record;
        wallet_record.owner = ctx.accounts.new_owner.key();
        wallet_record.alias = ctx.accounts.alias_record.alias.clone();

        emit!(AliasTransferred {
            from: ctx.accounts.owner.key(),
            to: ctx.accounts.new_owner.key(),
            alias: ctx.accounts.alias_record.alias.clone(),
        });

        Ok(())
    }
#[derive(Accounts)]
pub struct TransferAlias<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,

    /// The alias record to update (must match current owner)
    #[account(
        mut,
        seeds = [b"alias", alias_record.alias.as_bytes()],
        bump,
    )]
    pub alias_record: Account<'info, AliasRecord>,

    /// The old wallet record (will be closed)
    #[account(
        mut,
        seeds = [b"wallet", owner.key().as_ref()],
        bump,
        has_one = owner,
        close = owner,
    )]
    pub old_wallet_record: Account<'info, WalletRecord>,

    /// The new owner who will receive the alias
    #[account(mut)]
    pub new_owner: Signer<'info>,

    /// The new wallet record for the recipient
    #[account(
        init,
        payer = new_owner,
        space = WalletRecord::SPACE,
        seeds = [b"wallet", new_owner.key().as_ref()],
        bump,
    )]
    pub new_wallet_record: Account<'info, WalletRecord>,

    pub system_program: Program<'info, System>,
}
}

// ─── Validation ──────────────────────────────────────────────────────────────

fn is_valid_alias(alias: &str) -> bool {
    alias
        .bytes()
        .all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || c == b'_')
}

// ─── Accounts ─────────────────────────────────────────────────────────────────

#[derive(Accounts)]
#[instruction(alias: String)]
pub struct ClaimAlias<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,

    /// Treasury wallet that receives the claim fee.
    /// CHECK: Unchecked — we only transfer lamports to it; no data is read or written.
    #[account(mut, address = crate::treasury_pubkey())]
    pub treasury: UncheckedAccount<'info>,
// Helper to parse the hardcoded treasury pubkey
pub fn treasury_pubkey() -> Pubkey {
    Pubkey::from_str(TREASURY_PUBKEY).expect("Invalid hardcoded treasury pubkey")
}

    /// One AliasRecord per unique alias string.
    #[account(
        init,
        payer = owner,
        space = AliasRecord::space(&alias),
        seeds = [b"alias", alias.as_bytes()],
        bump,
    )]
    pub alias_record: Account<'info, AliasRecord>,

    /// One WalletRecord per wallet — enforces one-alias-per-wallet at the PDA level.
    #[account(
        init,
        payer = owner,
        space = WalletRecord::SPACE,
        seeds = [b"wallet", owner.key().as_ref()],
        bump,
    )]
    pub wallet_record: Account<'info, WalletRecord>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct ReleaseAlias<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,

    /// Derived from the alias stored in wallet_record.
    #[account(
        mut,
        seeds = [b"alias", wallet_record.alias.as_bytes()],
        bump,
        close = owner,
    )]
    pub alias_record: Account<'info, AliasRecord>,

    #[account(
        mut,
        seeds = [b"wallet", owner.key().as_ref()],
        bump,
        has_one = owner,
        close = owner,
    )]
    pub wallet_record: Account<'info, WalletRecord>,

    pub system_program: Program<'info, System>,
}

// ─── State ───────────────────────────────────────────────────────────────────

/// On-chain record for a claimed alias.
/// PDA seeds: ["alias", alias_string]
#[account]
pub struct AliasRecord {
    pub owner: Pubkey,       // 32
    pub alias: String,       // 4 + len
    pub claimed_at: i64,     // 8
}

impl AliasRecord {
    pub fn space(alias: &str) -> usize {
        8              // Anchor discriminator
        + 32           // owner pubkey
        + 4 + alias.len() // String prefix + bytes
        + 8            // claimed_at i64
    }
}

/// On-chain record linking a wallet to its alias.
/// PDA seeds: ["wallet", owner_pubkey]
#[account]
pub struct WalletRecord {
    pub owner: Pubkey,   // 32
    pub alias: String,   // 4 + MAX_ALIAS_LEN bytes
}

impl WalletRecord {
    // 8 discriminator + 32 owner + 4 string prefix + 32 max alias bytes
    pub const SPACE: usize = 8 + 32 + 4 + MAX_ALIAS_LEN;
}

// ─── Events ──────────────────────────────────────────────────────────────────

#[event]
pub struct AliasClaimed {
    pub owner: Pubkey,
    pub alias: String,
}

#[event]
pub struct AliasReleased {
    pub owner: Pubkey,
    pub alias: String,
}

#[event]
pub struct AliasTransferred {
    pub from: Pubkey,
    pub to: Pubkey,
    pub alias: String,
}

// ─── Errors ──────────────────────────────────────────────────────────────────

#[error_code]
pub enum VynxError {
    #[msg("Alias must be 1–32 characters long.")]
    InvalidAliasLength,
    #[msg("Alias may only contain lowercase letters (a-z), digits (0-9), and underscores (_).")]
    InvalidAliasCharacters,
    #[msg("Only the alias owner can transfer it.")]
    Unauthorized,
}
