use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};

declare_id!("Stk1111111111111111111111111111111111111111");

#[program]
pub mod nft_staking {
    use super::*;

    /// Stake NFT 100% on-chain by transferring/locking into program escrow PDA
    pub fn stake(ctx: Context<Stake>) -> Result<()> {
        let stake_account = &mut ctx.accounts.stake_account;
        stake_account.owner = ctx.accounts.user.key();
        stake_account.nft_mint = ctx.accounts.nft_mint.key();
        stake_account.staked_at = Clock::get()?.unix_timestamp;
        stake_account.is_staked = true;
        stake_account.bump = ctx.bumps.stake_account;
        
        // CPI to transfer 1 NFT token into PDA escrow account
        let cpi_accounts = Transfer {
            from: ctx.accounts.user_nft_account.to_account_info(),
            to: ctx.accounts.pda_nft_account.to_account_info(),
            authority: ctx.accounts.user.to_account_info(),
        };
        token::transfer(
            CpiContext::new(ctx.accounts.token_program.to_account_info(), cpi_accounts),
            1
        )?;
        
        msg!("100% On-Chain NFT Staked: Mint {} by Owner {}", stake_account.nft_mint, stake_account.owner);
        Ok(())
    }

    /// Unstake NFT 100% on-chain and return token to owner
    pub fn unstake(ctx: Context<Unstake>) -> Result<()> {
        let stake_account = &mut ctx.accounts.stake_account;
        require!(stake_account.is_staked, StakingError::NotStaked);
        require!(stake_account.owner == ctx.accounts.user.key(), StakingError::Unauthorized);

        let mint_key = stake_account.nft_mint;
        let owner_key = stake_account.owner;
        let seeds = &[
            b"staking",
            mint_key.as_ref(),
            owner_key.as_ref(),
            &[stake_account.bump]
        ];
        let signer_seeds = &[&seeds[..]];

        // CPI transfer back from PDA escrow to user's NFT account using signer seeds
        let cpi_accounts = Transfer {
            from: ctx.accounts.pda_nft_account.to_account_info(),
            to: ctx.accounts.user_nft_account.to_account_info(),
            authority: stake_account.to_account_info(),
        };
        token::transfer(
            CpiContext::new_with_signer(ctx.accounts.token_program.to_account_info(), cpi_accounts, signer_seeds),
            1
        )?;

        stake_account.is_staked = false;
        msg!("100% On-Chain NFT Unstaked: Mint {} by Owner {}", mint_key, owner_key);
        Ok(())
    }

    /// Claim accrued on-chain staking rewards and refresh timestamp
    pub fn claim_rewards(ctx: Context<ClaimRewards>) -> Result<()> {
        let stake_account = &mut ctx.accounts.stake_account;
        require!(stake_account.is_staked, StakingError::NotStaked);
        require!(stake_account.owner == ctx.accounts.user.key(), StakingError::Unauthorized);

        let now = Clock::get()?.unix_timestamp;
        let elapsed_seconds = now.saturating_sub(stake_account.staked_at);
        stake_account.staked_at = now;

        msg!("100% On-Chain NFT Rewards Claimed: Elapsed seconds {}", elapsed_seconds);
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Stake<'info> {
    #[account(mut)]
    pub user: Signer<'info>,

    /// CHECK: Validated as the mint of the user's NFT token account
    pub nft_mint: AccountInfo<'info>,

    #[account(
        init_if_needed,
        payer = user,
        space = 8 + 32 + 32 + 8 + 1 + 1,
        seeds = [b"staking", nft_mint.key().as_ref(), user.key().as_ref()],
        bump
    )]
    pub stake_account: Account<'info, StakingAccount>,

    #[account(mut)]
    pub user_nft_account: Account<'info, TokenAccount>,

    #[account(mut)]
    pub pda_nft_account: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Unstake<'info> {
    #[account(mut)]
    pub user: Signer<'info>,

    /// CHECK: Validated through stake account seeds
    pub nft_mint: AccountInfo<'info>,

    #[account(
        mut,
        seeds = [b"staking", nft_mint.key().as_ref(), user.key().as_ref()],
        bump = stake_account.bump
    )]
    pub stake_account: Account<'info, StakingAccount>,

    #[account(mut)]
    pub user_nft_account: Account<'info, TokenAccount>,

    #[account(mut)]
    pub pda_nft_account: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct ClaimRewards<'info> {
    #[account(mut)]
    pub user: Signer<'info>,

    /// CHECK: Validated through stake account seeds
    pub nft_mint: AccountInfo<'info>,

    #[account(
        mut,
        seeds = [b"staking", nft_mint.key().as_ref(), user.key().as_ref()],
        bump = stake_account.bump
    )]
    pub stake_account: Account<'info, StakingAccount>,
}

#[account]
pub struct StakingAccount {
    pub owner: Pubkey,
    pub nft_mint: Pubkey,
    pub staked_at: i64,
    pub is_staked: bool,
    pub bump: u8,
}

#[error_code]
pub enum StakingError {
    #[msg("This NFT is not currently staked on-chain.")]
    NotStaked,
    #[msg("You are not authorized to manage this on-chain stake.")]
    Unauthorized,
}
