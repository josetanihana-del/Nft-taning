use anchor_lang::prelude::*;
use anchor_spl::token::{self, TokenAccount, Transfer};

declare_id!("YOUR_PROGRAM_ID_HERE"); // Replace with your actual Program ID

#[program]
pub mod nft_staking {
    use super::*;

    pub fn stake(ctx: Context<Stake>) -> Result<()> {
        let stake_account = &mut ctx.accounts.stake_account;
        stake_account.owner = ctx.accounts.user.key();
        stake_account.staked_at = Clock::get()?.unix_timestamp;
        
        // CPI to transfer NFT
        let cpi_accounts = Transfer {
            from: ctx.accounts.user_nft_account.to_account_info(),
            to: ctx.accounts.pda_nft_account.to_account_info(),
            authority: ctx.accounts.user.to_account_info(),
        };
        token::transfer(CpiContext::new(ctx.accounts.token_program.to_account_info(), cpi_accounts), 1)?;
        
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Stake<'info> {
    #[account(mut)]
    pub user: Signer<'info>,
    #[account(init, payer = user, space = 8 + 32 + 8)]
    pub stake_account: Account<'info, StakingAccount>,
    #[account(mut)]
    pub user_nft_account: Account<'info, TokenAccount>,
    #[account(mut)]
    pub pda_nft_account: Account<'info, TokenAccount>,
    pub token_program: Program<'info, token::Token>,
    pub system_program: Program<'info, System>,
}

#[account]
pub struct StakingAccount {
    pub owner: Pubkey,
    pub staked_at: i64,
}
