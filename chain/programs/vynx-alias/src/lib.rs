use anchor_lang::prelude::*;
use anchor_lang::system_program::{self, Allocate, Assign, Transfer};

declare_id!("AxQxAgndT6ziUr3FBNafhJzF4PpniGpMX4fVRXXmh5y8");

pub const INITIAL_TIERS: [u64; 5] = [
    920_000_000,
    530_000_000,
    300_000_000,
    140_000_000,
    10_000_000,
];
pub const MAX_QUOTE_SLOTS: u64 = 150;
pub const RESERVED: &[&str] = &[
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
];

#[program]
pub mod vynx_alias {
    use super::*;

    pub fn initialize(
        ctx: Context<Initialize>,
        admin: Pubkey,
        sponsor: Pubkey,
        treasury: Pubkey,
    ) -> Result<()> {
        require!(
            admin != Pubkey::default()
                && sponsor != Pubkey::default()
                && treasury != Pubkey::default(),
            RegistryError::InvalidAuthority
        );
        validate_tiers(&INITIAL_TIERS)?;
        let config = &mut ctx.accounts.config;
        config.admin = admin;
        config.pending_admin = Pubkey::default();
        config.sponsor = sponsor;
        config.treasury = treasury;
        config.tiers = INITIAL_TIERS;
        config.price_version = 1;
        config.paused = false;
        config.bump = ctx.bumps.config;
        Ok(())
    }

    pub fn set_registration_price_tiers(ctx: Context<AdminConfig>, tiers: [u64; 5]) -> Result<()> {
        validate_tiers(&tiers)?;
        let config = &mut ctx.accounts.config;
        let old_tiers = config.tiers;
        config.price_version = config
            .price_version
            .checked_add(1)
            .ok_or(RegistryError::Overflow)?;
        config.tiers = tiers;
        emit!(PricesChanged {
            admin: config.admin,
            old_tiers,
            new_tiers: tiers,
            version: config.price_version
        });
        Ok(())
    }

    pub fn set_paused(ctx: Context<AdminConfig>, paused: bool) -> Result<()> {
        ctx.accounts.config.paused = paused;
        Ok(())
    }

    pub fn set_sponsor(ctx: Context<AdminConfig>, sponsor: Pubkey) -> Result<()> {
        require!(
            sponsor != Pubkey::default(),
            RegistryError::InvalidAuthority
        );
        ctx.accounts.config.sponsor = sponsor;
        Ok(())
    }

    // Passing the default key cancels a pending nomination.
    pub fn nominate_admin(ctx: Context<AdminConfig>, pending_admin: Pubkey) -> Result<()> {
        ctx.accounts.config.pending_admin = pending_admin;
        Ok(())
    }

    pub fn accept_admin(ctx: Context<AcceptAdmin>) -> Result<()> {
        let config = &mut ctx.accounts.config;
        config.admin = ctx.accounts.pending_admin.key();
        config.pending_admin = Pubkey::default();
        Ok(())
    }

    // Admin attests a verified legacy claim; the owner consents to this exact alias.
    // Migration is only available during an explicitly paused maintenance window.
    pub fn migrate_verified_claim(
        ctx: Context<MigrateVerifiedClaim>,
        alias: String,
        expires_at_slot: u64,
        claim_id: [u8; 16],
    ) -> Result<()> {
        validate_alias(&alias)?;
        require!(
            ctx.accounts.config.paused,
            RegistryError::MigrationRequiresPause
        );
        validate_expiry(Clock::get()?.slot, expires_at_slot)?;
        let alias_info = ctx.accounts.alias_record.to_account_info();
        let owner_info = ctx.accounts.owner_index.to_account_info();
        require_unclaimed(&alias_info)?;
        require_unclaimed(&owner_info)?;
        let rent = Rent::get()?;
        let owner_key = ctx.accounts.owner.key();
        create_record(
            &ctx.accounts.admin,
            &alias_info,
            &ctx.accounts.system_program,
            AliasRecord::SPACE,
            rent.minimum_balance(AliasRecord::SPACE)
                .saturating_sub(alias_info.lamports()),
            &[b"alias", alias.as_bytes(), &[ctx.bumps.alias_record]],
        )?;
        create_record(
            &ctx.accounts.admin,
            &owner_info,
            &ctx.accounts.system_program,
            OwnerIndex::SPACE,
            rent.minimum_balance(OwnerIndex::SPACE)
                .saturating_sub(owner_info.lamports()),
            &[b"owner", owner_key.as_ref(), &[ctx.bumps.owner_index]],
        )?;
        let slot = Clock::get()?.slot;
        AliasRecord {
            owner: owner_key,
            alias: alias.clone(),
            registered_at_slot: slot,
            paid_lamports: 0,
            price_version: 0,
            intent_id: claim_id,
            bump: ctx.bumps.alias_record,
        }
        .try_serialize(&mut &mut alias_info.try_borrow_mut_data()?[..])?;
        OwnerIndex {
            owner: owner_key,
            alias_record: alias_info.key(),
            bump: ctx.bumps.owner_index,
        }
        .try_serialize(&mut &mut owner_info.try_borrow_mut_data()?[..])?;
        emit!(AliasRegistered {
            owner: owner_key,
            alias,
            total_lamports: 0,
            treasury_lamports: 0,
            slot,
            intent_id: claim_id,
        });
        Ok(())
    }

    pub fn register(
        ctx: Context<Register>,
        alias: String,
        expected_total_lamports: u64,
        expected_price_version: u64,
        expires_at_slot: u64,
        intent_id: [u8; 16],
    ) -> Result<()> {
        validate_alias(&alias)?;
        let config = &ctx.accounts.config;
        require!(!config.paused, RegistryError::Paused);
        require!(
            ctx.accounts.owner.key() != config.treasury
                && ctx.accounts.owner.key() != config.sponsor,
            RegistryError::InvalidOwner
        );
        let total = config.tiers[tier_index(alias.len())];
        require!(
            total == expected_total_lamports && config.price_version == expected_price_version,
            RegistryError::PriceChanged
        );
        validate_expiry(Clock::get()?.slot, expires_at_slot)?;
        let alias_info = ctx.accounts.alias_record.to_account_info();
        let owner_info = ctx.accounts.owner_index.to_account_info();
        require_unclaimed(&alias_info)?;
        require_unclaimed(&owner_info)?;
        let rent = Rent::get()?;
        let deposits = rent
            .minimum_balance(AliasRecord::SPACE)
            .checked_add(rent.minimum_balance(OwnerIndex::SPACE))
            .ok_or(RegistryError::Overflow)?;
        require!(total >= deposits, RegistryError::PriceBelowRent);
        // Count only the creator-funded rent. Pre-funded PDA donations must not reduce the total charge.
        let alias_deposit = rent
            .minimum_balance(AliasRecord::SPACE)
            .saturating_sub(alias_info.lamports());
        let owner_deposit = rent
            .minimum_balance(OwnerIndex::SPACE)
            .saturating_sub(owner_info.lamports());
        let funded = alias_deposit
            .checked_add(owner_deposit)
            .ok_or(RegistryError::Overflow)?;
        let treasury_payment = total.checked_sub(funded).ok_or(RegistryError::Overflow)?;
        let alias_bump = [ctx.bumps.alias_record];
        let owner_bump = [ctx.bumps.owner_index];
        let owner_key = ctx.accounts.owner.key();
        create_record(
            &ctx.accounts.owner,
            &alias_info,
            &ctx.accounts.system_program,
            AliasRecord::SPACE,
            alias_deposit,
            &[b"alias", alias.as_bytes(), &alias_bump],
        )?;
        create_record(
            &ctx.accounts.owner,
            &owner_info,
            &ctx.accounts.system_program,
            OwnerIndex::SPACE,
            owner_deposit,
            &[b"owner", owner_key.as_ref(), &owner_bump],
        )?;
        system_program::transfer(
            CpiContext::new(
                ctx.accounts.system_program.key(),
                Transfer {
                    from: ctx.accounts.owner.to_account_info(),
                    to: ctx.accounts.treasury.to_account_info(),
                },
            ),
            treasury_payment,
        )?;
        let slot = Clock::get()?.slot;
        let record = AliasRecord {
            owner: owner_key,
            alias: alias.clone(),
            registered_at_slot: slot,
            paid_lamports: total,
            price_version: config.price_version,
            intent_id,
            bump: ctx.bumps.alias_record,
        };
        record.try_serialize(&mut &mut alias_info.try_borrow_mut_data()?[..])?;
        let index = OwnerIndex {
            owner: owner_key,
            alias_record: alias_info.key(),
            bump: ctx.bumps.owner_index,
        };
        index.try_serialize(&mut &mut owner_info.try_borrow_mut_data()?[..])?;
        emit!(AliasRegistered {
            owner: owner_key,
            alias,
            total_lamports: total,
            treasury_lamports: treasury_payment,
            slot,
            intent_id
        });
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(constraint = program.programdata_address()? == Some(program_data.key()) @ RegistryError::Unauthorized)]
    pub program: Program<'info, crate::program::VynxAlias>,
    #[account(constraint = program_data.upgrade_authority_address == Some(authority.key()) @ RegistryError::Unauthorized)]
    pub program_data: Account<'info, ProgramData>,
    #[account(init, payer = authority, space = Config::SPACE, seeds = [b"config"], bump)]
    pub config: Account<'info, Config>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct AdminConfig<'info> {
    pub admin: Signer<'info>,
    #[account(mut, seeds = [b"config"], bump = config.bump, has_one = admin @ RegistryError::Unauthorized)]
    pub config: Account<'info, Config>,
}

#[derive(Accounts)]
pub struct AcceptAdmin<'info> {
    pub pending_admin: Signer<'info>,
    #[account(mut, seeds = [b"config"], bump = config.bump, has_one = pending_admin @ RegistryError::Unauthorized)]
    pub config: Account<'info, Config>,
}

#[derive(Accounts)]
#[instruction(alias: String)]
pub struct Register<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,
    // This signature authorizes the complete transaction, including alias, price, expiry and intent.
    pub sponsor: Signer<'info>,
    #[account(seeds = [b"config"], bump = config.bump, has_one = sponsor @ RegistryError::Unauthorized, has_one = treasury @ RegistryError::Unauthorized)]
    pub config: Account<'info, Config>,
    #[account(mut)]
    pub treasury: SystemAccount<'info>,
    /// CHECK: canonical PDA; manually initialized after name, ownership and pricing validation.
    #[account(mut, seeds = [b"alias", alias.as_bytes()], bump)]
    pub alias_record: UncheckedAccount<'info>,
    /// CHECK: canonical wallet PDA; manually initialized, never reopened or closed.
    #[account(mut, seeds = [b"owner", owner.key().as_ref()], bump)]
    pub owner_index: UncheckedAccount<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(alias: String)]
pub struct MigrateVerifiedClaim<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,
    pub owner: Signer<'info>,
    #[account(seeds = [b"config"], bump = config.bump, has_one = admin @ RegistryError::Unauthorized)]
    pub config: Account<'info, Config>,
    /// CHECK: canonical unclaimed alias PDA, allocated using admin funds.
    #[account(mut, seeds = [b"alias", alias.as_bytes()], bump)]
    pub alias_record: UncheckedAccount<'info>,
    /// CHECK: canonical unclaimed owner PDA, allocated using admin funds.
    #[account(mut, seeds = [b"owner", owner.key().as_ref()], bump)]
    pub owner_index: UncheckedAccount<'info>,
    pub system_program: Program<'info, System>,
}

#[account]
pub struct Config {
    pub admin: Pubkey,
    pub pending_admin: Pubkey,
    pub sponsor: Pubkey,
    pub treasury: Pubkey,
    pub tiers: [u64; 5],
    pub price_version: u64,
    pub paused: bool,
    pub bump: u8,
}
impl Config {
    pub const SPACE: usize = 8 + 32 * 4 + 8 * 5 + 8 + 1 + 1;
}

#[account]
pub struct AliasRecord {
    pub owner: Pubkey,
    pub alias: String,
    pub registered_at_slot: u64,
    pub paid_lamports: u64,
    pub price_version: u64,
    pub intent_id: [u8; 16],
    pub bump: u8,
}
impl AliasRecord {
    pub const SPACE: usize = 8 + 32 + 4 + 30 + 8 * 3 + 16 + 1;
}

#[account]
pub struct OwnerIndex {
    pub owner: Pubkey,
    pub alias_record: Pubkey,
    pub bump: u8,
}
impl OwnerIndex {
    pub const SPACE: usize = 8 + 32 + 32 + 1;
}

#[event]
pub struct PricesChanged {
    pub admin: Pubkey,
    pub old_tiers: [u64; 5],
    pub new_tiers: [u64; 5],
    pub version: u64,
}
#[event]
pub struct AliasRegistered {
    pub owner: Pubkey,
    pub alias: String,
    pub total_lamports: u64,
    pub treasury_lamports: u64,
    pub slot: u64,
    pub intent_id: [u8; 16],
}

fn tier_index(length: usize) -> usize {
    length.saturating_sub(1).min(4)
}
fn validate_alias(alias: &str) -> Result<()> {
    require!(
        !alias.is_empty()
            && alias.len() <= 30
            && alias
                .bytes()
                .all(|b| b.is_ascii_lowercase() || b.is_ascii_digit() || b == b'_'),
        RegistryError::InvalidAlias
    );
    require!(!RESERVED.contains(&alias), RegistryError::ReservedAlias);
    Ok(())
}
fn validate_tiers(tiers: &[u64; 5]) -> Result<()> {
    validate_tiers_with_rent(tiers, &Rent::get()?)
}
fn validate_tiers_with_rent(tiers: &[u64; 5], rent: &Rent) -> Result<()> {
    let minimum = rent
        .minimum_balance(AliasRecord::SPACE)
        .checked_add(rent.minimum_balance(OwnerIndex::SPACE))
        .ok_or(RegistryError::Overflow)?;
    require!(
        tiers.iter().all(|p| *p >= minimum) && tiers.windows(2).all(|w| w[0] >= w[1]),
        RegistryError::InvalidTiers
    );
    Ok(())
}
fn validate_expiry(slot: u64, expiry: u64) -> Result<()> {
    require!(
        expiry >= slot && expiry.saturating_sub(slot) <= MAX_QUOTE_SLOTS,
        RegistryError::ExpiredQuote
    );
    Ok(())
}
fn require_unclaimed(info: &AccountInfo) -> Result<()> {
    require!(
        info.owner == &system_program::ID && info.data_is_empty() && !info.executable,
        RegistryError::AlreadyClaimed
    );
    Ok(())
}
fn create_record<'info>(
    payer: &Signer<'info>,
    account: &AccountInfo<'info>,
    system: &Program<'info, System>,
    size: usize,
    deposit: u64,
    seeds: &[&[u8]],
) -> Result<()> {
    if deposit > 0 {
        system_program::transfer(
            CpiContext::new(
                system.key(),
                Transfer {
                    from: payer.to_account_info(),
                    to: account.clone(),
                },
            ),
            deposit,
        )?;
    }
    system_program::allocate(
        CpiContext::new_with_signer(
            system.key(),
            Allocate {
                account_to_allocate: account.clone(),
            },
            &[seeds],
        ),
        size as u64,
    )?;
    system_program::assign(
        CpiContext::new_with_signer(
            system.key(),
            Assign {
                account_to_assign: account.clone(),
            },
            &[seeds],
        ),
        &crate::ID,
    )?;
    Ok(())
}

#[error_code]
pub enum RegistryError {
    #[msg("Only the configured authority may perform this operation.")]
    Unauthorized,
    #[msg("Invalid admin, sponsor or treasury address.")]
    InvalidAuthority,
    #[msg("Use a creator wallet distinct from sponsor and treasury.")]
    InvalidOwner,
    #[msg("Use 1–30 canonical lowercase ASCII letters, digits or underscores.")]
    InvalidAlias,
    #[msg("This name is reserved.")]
    ReservedAlias,
    #[msg("The alias or wallet already has a registration.")]
    AlreadyClaimed,
    #[msg("The price changed; request a new quote.")]
    PriceChanged,
    #[msg("The quote expired or its validity window is too long.")]
    ExpiredQuote,
    #[msg("New registrations are paused.")]
    Paused,
    #[msg("Prices must be non-increasing and cover the registry rent deposits.")]
    InvalidTiers,
    #[msg("The price cannot cover registry rent deposits.")]
    PriceBelowRent,
    #[msg("Arithmetic overflow.")]
    Overflow,
    #[msg("Pause registration before migrating verified legacy claims.")]
    MigrationRequiresPause,
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn names_are_canonical_and_reserved_names_are_blocked() {
        for name in ["a", "42", "fabohax", "creator_1", &"a".repeat(30)] {
            assert!(validate_alias(name).is_ok());
        }
        for name in [
            "",
            "A",
            "@alice",
            " alice",
            "alice.sol",
            "é",
            "a-b",
            &"a".repeat(31),
        ] {
            assert!(validate_alias(name).is_err());
        }
        for name in RESERVED {
            assert!(validate_alias(name).is_err());
        }
    }
    #[test]
    fn tiers_and_quote_boundaries_are_checked() {
        assert!(validate_tiers_with_rent(&INITIAL_TIERS, &Rent::default()).is_ok());
        assert!(validate_tiers_with_rent(&[0; 5], &Rent::default()).is_err());
        assert!(validate_tiers_with_rent(
            &[10_000_000, 20_000_000, 10_000_000, 10_000_000, 10_000_000],
            &Rent::default()
        )
        .is_err());
        assert_eq!(
            (1..=30).map(tier_index).collect::<Vec<_>>(),
            [vec![0, 1, 2, 3], vec![4; 26]].concat()
        );
        assert!(validate_expiry(100, 100).is_ok());
        assert!(validate_expiry(100, 250).is_ok());
        assert!(validate_expiry(100, 99).is_err());
        assert!(validate_expiry(100, 251).is_err());
    }
}
