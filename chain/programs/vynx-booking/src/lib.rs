use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, Token, TokenAccount, TransferChecked};

declare_id!("B6FdE4aAcavkyh1u7UXadQXTQrGYmGWpPqKbfQ6sX7mY");
const DAY: i64 = 86_400;
const RECOVERY: i64 = 30 * DAY;

#[program]
pub mod vynx_booking {
    use super::*;
    pub fn initialize(
        ctx: Context<Initialize>,
        quote_authority: Pubkey,
        resolver: Pubkey,
    ) -> Result<()> {
        require!(
            quote_authority != Pubkey::default() && resolver != Pubkey::default(),
            BookingError::Unauthorized
        );
        require!(ctx.accounts.mint.decimals == 6, BookingError::InvalidTerms);
        let c = &mut ctx.accounts.config;
        c.quote_authority = quote_authority;
        c.resolver = resolver;
        c.mint = ctx.accounts.mint.key();
        c.bump = ctx.bumps.config;
        Ok(())
    }
    // init (not init_if_needed) makes funding the same booking twice impossible.
    // The server co-signs these immutable terms only after reserving the slot.
    pub fn fund(
        ctx: Context<Fund>,
        id: [u8; 16],
        terms_hash: [u8; 32],
        amount: u64,
        start: i64,
        end: i64,
        expires: i64,
    ) -> Result<()> {
        let now = Clock::get()?.unix_timestamp;
        validate_terms(now, amount, start, end, expires)?;
        require!(
            ctx.accounts.payer.key() != ctx.accounts.creator.key(),
            BookingError::InvalidTerms
        );
        let b = &mut ctx.accounts.booking;
        b.id = id;
        b.terms_hash = terms_hash;
        b.payer = ctx.accounts.payer.key();
        b.creator = ctx.accounts.creator.key();
        b.mint = ctx.accounts.mint.key();
        b.resolver = ctx.accounts.config.resolver;
        b.amount = amount;
        b.start = start;
        b.end = end;
        b.funded_at = now;
        b.state = 1;
        b.bump = ctx.bumps.booking;
        token::transfer_checked(
            CpiContext::new(
                ctx.accounts.token_program.key(),
                TransferChecked {
                    from: ctx.accounts.source.to_account_info(),
                    mint: ctx.accounts.mint.to_account_info(),
                    to: ctx.accounts.vault.to_account_info(),
                    authority: ctx.accounts.payer.to_account_info(),
                },
            ),
            amount,
            6,
        )
    }
    pub fn dispute(ctx: Context<Participant>) -> Result<()> {
        let b = &mut ctx.accounts.booking;
        require!(
            b.state == 1 && Clock::get()?.unix_timestamp <= b.end + DAY,
            BookingError::InvalidState
        );
        b.state = 2;
        Ok(())
    }
    // Creator cancellation or timely fan cancellation refunds all principal.
    // Either participant can recover all principal to the payer after 30 days,
    // including during disputes, if the resolver becomes unavailable.
    pub fn refund(ctx: Context<Settlement>) -> Result<()> {
        let b = &ctx.accounts.booking;
        let now = Clock::get()?.unix_timestamp;
        require!(b.state == 1 || b.state == 2, BookingError::InvalidState);
        require!(
            ctx.accounts.authority.key() == b.payer || ctx.accounts.authority.key() == b.creator,
            BookingError::Unauthorized
        );
        require!(
            now >= b.end + RECOVERY
                || (b.state == 1
                    && (ctx.accounts.authority.key() == b.creator || now <= b.start - DAY)),
            BookingError::InvalidState
        );
        settle(ctx, 0)
    }
    // A resolver is a trusted, disclosed settlement authority. The LLM never signs.
    // Disputed funds require an explicit resolver allocation. Normal payout waits
    // until the dispute window has closed and the server has verified completion.
    pub fn resolve(ctx: Context<Settlement>, creator_amount: u64) -> Result<()> {
        let b = &ctx.accounts.booking;
        let now = Clock::get()?.unix_timestamp;
        require!(
            ctx.accounts.authority.key() == b.resolver,
            BookingError::Unauthorized
        );
        require!(
            (b.state == 1 || b.state == 2) && now > b.end + DAY && now < b.end + RECOVERY,
            BookingError::InvalidState
        );
        require!(creator_amount <= b.amount, BookingError::InvalidTerms);
        settle(ctx, creator_amount)
    }
}
fn validate_terms(now: i64, amount: u64, start: i64, end: i64, expires: i64) -> Result<()> {
    require!(
        (10_000..=1_000_000_000).contains(&amount)
            && start > now
            && start <= now + 90 * DAY
            && end > start
            && end - start >= 900
            && end - start <= 14_400
            && expires >= now
            && expires <= now + 600
            && expires < start,
        BookingError::InvalidTerms
    );
    Ok(())
}
fn settle(ctx: Context<Settlement>, creator_amount: u64) -> Result<()> {
    let b = &ctx.accounts.booking;
    let seeds: &[&[u8]] = &[b"booking", &b.id, &[b.bump]];
    for (destination, amount) in [
        (&ctx.accounts.creator_token, creator_amount),
        (&ctx.accounts.payer_token, b.amount - creator_amount),
    ] {
        if amount > 0 {
            token::transfer_checked(
                CpiContext::new(
                    ctx.accounts.token_program.key(),
                    TransferChecked {
                        from: ctx.accounts.vault.to_account_info(),
                        mint: ctx.accounts.mint.to_account_info(),
                        to: destination.to_account_info(),
                        authority: b.to_account_info(),
                    },
                )
                .with_signer(&[seeds]),
                amount,
                6,
            )?;
        }
    }
    // Retain the receipt permanently; closing would allow the ID to be funded again.
    ctx.accounts.booking.state = 3;
    ctx.accounts.booking.creator_amount = creator_amount;
    Ok(())
}
#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(constraint = program.programdata_address()? == Some(program_data.key()) @ BookingError::Unauthorized)]
    pub program: Program<'info, crate::program::VynxBooking>,
    #[account(constraint = program_data.upgrade_authority_address == Some(authority.key()) @ BookingError::Unauthorized)]
    pub program_data: Account<'info, ProgramData>,
    #[account(init, payer = authority, space = 8 + 97, seeds = [b"config"], bump)]
    pub config: Account<'info, Config>,
    pub mint: Account<'info, Mint>,
    pub system_program: Program<'info, System>,
}
#[derive(Accounts)]
#[instruction(id: [u8; 16])]
pub struct Fund<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    pub quote_authority: Signer<'info>,
    #[account(seeds = [b"config"], bump = config.bump, has_one = quote_authority, has_one = mint)]
    pub config: Account<'info, Config>,
    /// CHECK: Immutable public recipient; never debited or used as an authority.
    pub creator: UncheckedAccount<'info>,
    #[account(init, payer = payer, space = Booking::SPACE, seeds = [b"booking", id.as_ref()], bump)]
    pub booking: Account<'info, Booking>,
    pub mint: Account<'info, Mint>,
    #[account(mut, token::mint = mint, token::authority = payer)]
    pub source: Account<'info, TokenAccount>,
    #[account(init, payer = payer, seeds = [b"vault", booking.key().as_ref()], bump, token::mint = mint, token::authority = booking)]
    pub vault: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}
#[derive(Accounts)]
pub struct Participant<'info> {
    pub authority: Signer<'info>,
    #[account(mut, seeds = [b"booking", &booking.id], bump = booking.bump,
        constraint = authority.key() == booking.payer || authority.key() == booking.creator @ BookingError::Unauthorized)]
    pub booking: Account<'info, Booking>,
}
#[derive(Accounts)]
pub struct Settlement<'info> {
    pub authority: Signer<'info>,
    #[account(mut, seeds = [b"booking", &booking.id], bump = booking.bump, has_one = mint)]
    pub booking: Account<'info, Booking>,
    pub mint: Account<'info, Mint>,
    #[account(mut, seeds = [b"vault", booking.key().as_ref()], bump, token::mint = mint, token::authority = booking)]
    pub vault: Account<'info, TokenAccount>,
    #[account(mut, token::mint = mint, constraint = payer_token.owner == booking.payer @ BookingError::Unauthorized)]
    pub payer_token: Account<'info, TokenAccount>,
    #[account(mut, token::mint = mint, constraint = creator_token.owner == booking.creator @ BookingError::Unauthorized)]
    pub creator_token: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
}
#[account]
pub struct Config {
    pub quote_authority: Pubkey,
    pub resolver: Pubkey,
    pub mint: Pubkey,
    pub bump: u8,
}
#[account]
pub struct Booking {
    pub id: [u8; 16],
    pub terms_hash: [u8; 32],
    pub payer: Pubkey,
    pub creator: Pubkey,
    pub mint: Pubkey,
    pub resolver: Pubkey,
    pub amount: u64,
    pub start: i64,
    pub end: i64,
    pub funded_at: i64,
    pub state: u8,
    pub bump: u8,
    pub creator_amount: u64,
}
impl Booking {
    pub const SPACE: usize = 8 + 16 + 32 + 4 * 32 + 5 * 8 + 2;
}
#[error_code]
pub enum BookingError {
    #[msg("Unauthorized escrow authority")]
    Unauthorized,
    #[msg("Invalid or expired booking terms")]
    InvalidTerms,
    #[msg("Booking state does not allow this operation")]
    InvalidState,
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn quotes_expire_and_amounts_are_bounded() {
        assert!(validate_terms(100, 10_000, 100_000, 101_800, 700).is_ok());
        for args in [
            (100, 0, 100_000, 101_800, 700),
            (701, 10_000, 100_000, 101_800, 700),
            (100, 10_000, 100_000, 101_800, 701),
            (100, 10_000, 100, 1900, 100),
            (100, 10_000, 100_000, 100_001, 700),
        ] {
            assert!(validate_terms(args.0, args.1, args.2, args.3, args.4).is_err());
        }
    }
}
