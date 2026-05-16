use anchor_lang::prelude::*;

declare_id!("6NikvvCPKpAkbdXWg8NtNes77mno854GjCouQqmkgyBS");

#[program]
pub mod milestone_escrow {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>, escrow_amount: u64) -> Result<()> {
        let escrow = &mut ctx.accounts.escrow_account;
        escrow.contractor = ctx.accounts.contractor.key();
        escrow.freelancer = ctx.accounts.freelancer.key();
        escrow.ai_judge = ctx.accounts.ai_judge.key();
        escrow.amount = escrow_amount;
        escrow.status = MilestoneStatus::InProgress;
        escrow.bump = ctx.bumps.escrow_account;

        // Transfer funds from contractor to the escrow account (the PDA itself)
        let cpi_context = CpiContext::new(
            anchor_lang::system_program::ID,
            anchor_lang::system_program::Transfer {
                from: ctx.accounts.contractor.to_account_info(),
                to: ctx.accounts.escrow_account.to_account_info(),
            },
        );
        anchor_lang::system_program::transfer(cpi_context, escrow_amount)?;

        Ok(())
    }

    pub fn submit_work(ctx: Context<UpdateStatus>) -> Result<()> {
        let escrow = &mut ctx.accounts.escrow_account;
        require!(ctx.accounts.signer.key() == escrow.freelancer, EscrowError::Unauthorized);
        escrow.status = MilestoneStatus::AwaitingApproval;
        Ok(())
    }

    pub fn contractor_decision(ctx: Context<UpdateStatus>, is_approved: bool) -> Result<()> {
        let escrow = &mut ctx.accounts.escrow_account;
        require!(ctx.accounts.signer.key() == escrow.contractor, EscrowError::Unauthorized);
        require!(escrow.status == MilestoneStatus::AwaitingApproval, EscrowError::InvalidState);

        if is_approved {
            escrow.status = MilestoneStatus::Approved;
            // Transfer logic would be added here
        } else {
            escrow.status = MilestoneStatus::InDispute;
        }
        Ok(())
    }

    pub fn ai_judge_decision(ctx: Context<UpdateStatus>, is_approved: bool) -> Result<()> {
        let escrow = &mut ctx.accounts.escrow_account;
        require!(ctx.accounts.signer.key() == escrow.ai_judge, EscrowError::Unauthorized);
        require!(escrow.status == MilestoneStatus::InDispute, EscrowError::InvalidState);

        if is_approved {
            escrow.status = MilestoneStatus::Approved;
        } else {
            escrow.status = MilestoneStatus::InProgress;
        }
        Ok(())
    }
}

#[derive(Accounts)]
#[instruction(escrow_amount: u64)]
pub struct Initialize<'info> {
    #[account(
        init, 
        payer = contractor, 
        space = 8 + 32 + 32 + 32 + 8 + 1 + 1,
        seeds = [b"escrow", contractor.key().as_ref()],
        bump
    )]
    pub escrow_account: Account<'info, EscrowState>,
    
    #[account(mut)]
    pub contractor: Signer<'info>,
    
    /// CHECK: Safe
    pub freelancer: UncheckedAccount<'info>,
    
    /// CHECK: Safe
    pub ai_judge: UncheckedAccount<'info>,
    
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct UpdateStatus<'info> {
    #[account(mut)]
    pub escrow_account: Account<'info, EscrowState>,
    pub signer: Signer<'info>,
}

#[account]
pub struct EscrowState {
    pub contractor: Pubkey,
    pub freelancer: Pubkey,
    pub ai_judge: Pubkey,
    pub amount: u64,
    pub status: MilestoneStatus,
    pub bump: u8,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq)]
pub enum MilestoneStatus {
    InProgress,
    AwaitingApproval,
    InDispute,
    Approved,
}

#[error_code]
pub enum EscrowError {
    #[msg("You are not authorized to perform this action.")]
    Unauthorized,
    #[msg("The milestone is not in the correct state for this action.")]
    InvalidState,
}