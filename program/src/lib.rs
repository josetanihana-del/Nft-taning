use anchor_lang::prelude::*;
use anchor_lang::solana_program::system_instruction;

declare_id!("Vault11111111111111111111111111111111111111");

#[program]
pub mod solana_vault_program {
    use super::*;

    /// Initialize the vault PDA and deposit initial SOL.
    /// Follows official Solana Foundation patterns for PDA initialization.
    pub fn initialize_vault(ctx: Context<InitializeVault>, amount: u64) -> Result<()> {
        let ix = system_instruction::transfer(
            &ctx.accounts.user.key(),
            &ctx.accounts.vault_pda.key(),
            amount,
        );
        anchor_lang::solana_program::program::invoke(
            &ix,
            &[
                ctx.accounts.user.to_account_info(),
                ctx.accounts.vault_pda.to_account_info(),
                ctx.accounts.system_program.to_account_info(),
            ],
        )?;
        Ok(())
    }

    /// Deposits SOL into the program's vault PDA.
    pub fn deposit(ctx: Context<Deposit>, amount: u64) -> Result<()> {
        let ix = system_instruction::transfer(
            &ctx.accounts.user.key(),
            &ctx.accounts.vault_pda.key(),
            amount,
        );
        anchor_lang::solana_program::program::invoke(
            &ix,
            &[
                ctx.accounts.user.to_account_info(),
                ctx.accounts.vault_pda.to_account_info(),
                ctx.accounts.system_program.to_account_info(),
            ],
        )?;
        Ok(())
    }

    /// Withdraws SOL from the program's vault PDA to a recipient.
    /// Follows official 'transfer-sol' patterns for PDA-to-SystemAccount transfers.
    pub fn withdraw(ctx: Context<Withdraw>, amount: u64) -> Result<()> {
        let vault_pda = &ctx.accounts.vault_pda;
        let recipient = &ctx.accounts.recipient;

        if vault_pda.lamports() < amount {
            return Err(error!(ErrorCode::InsufficientFunds));
        }

        // Perform the transfer via lamport adjustment (standard for PDAs)
        **vault_pda.sub_lamports(amount)?;
        **recipient.add_lamports(amount)?;

        Ok(())
    }
}

#[derive(Accounts)]
pub struct InitializeVault<'info> {
    #[account(mut)]
    pub user: Signer<'info>,
    #[account(
        init,
        payer = user,
        space = 8 + 32, // Discriminator + Admin Pubkey
        seeds = [b"vault", user.key().as_ref()],
        bump
    )]
    pub vault_pda: Account<'info, VaultState>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Deposit<'info> {
    #[account(mut)]
    pub user: Signer<'info>,
    #[account(mut, seeds = [b"vault", authority.key().as_ref()], bump)]
    pub vault_pda: Account<'info, VaultState>,
    /// CHECK: The authority who initialized the vault
    pub authority: AccountInfo<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Withdraw<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(mut, seeds = [b"vault", authority.key().as_ref()], bump)]
    pub vault_pda: Account<'info, VaultState>,
    #[account(mut)]
    pub recipient: AccountInfo<'info>,
    pub system_program: Program<'info, System>,
}

#[account]
pub struct VaultState {
    pub admin: Pubkey,
}

#[error_code]
pub enum ErrorCode {
    #[msg("The vault does not have enough SOL to fulfill the withdrawal.")]
    InsufficientFunds,
    #[msg("Unauthorized withdrawal attempt.")]
    Unauthorized,
}
